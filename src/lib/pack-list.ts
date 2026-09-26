import { collection, documentId, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { designCodeOf } from "@/lib/real-photos";

/**
 * The pack list: which design to fetch from the godown and how many pieces.
 *
 * It used to print each line's *variant* as its SKU — "Back Skin", "Default",
 * "Default Title" — because most order lines never stored their SKU. Each
 * line's SKU is now found the way the courier payload finds it
 * (functions/src/rapidshyp.ts resolveLines): the line's own, then the
 * product's variant of that name, then the SKU the ordered picture was named
 * after, then the product's design upload. It is cut down to the design code
 * the sheets are filed under (R-44-IPH → R-44; M-208 stays M-208), and a
 * variant that spends two sheets (a laptop's keyboard view) counts two.
 */

type Line = {
  productId?: string; productTitle?: string; variant?: string; sku?: string; quantity?: number; productImage?: string;
  phoneBrand?: string; phoneModel?: string; coverage?: string;
};
/** One cut to make: the device, and what it covers. */
export type Cut = { device: string; coverage: string; qty: number };
export type PackRow = { code: string; pieces: number; orders: Set<string>; skin: boolean; title: string; cuts: Map<string, Cut> };

/** "Full Body Wrap" / "Only Back", or a real variant (a laptop's "Top + Keyboard Area"). */
function coverageOf(it: Line): string {
  const c = String(it.coverage || "").toLowerCase();
  if (c === "full_body_wrap") return "Full Body Wrap";
  if (c === "only_back") return "Only Back";
  const v = String(it.variant || "").trim();
  return v && !/^(default( title)?|back skin)$/i.test(v) ? v : "";
}

const SKIN_CODE = /^[A-Z]{1,3}-\d+$/;
const fromImage = (url: unknown) => String(url || "").match(/_([A-Za-z]+-\d+(?:-[A-Za-z0-9]+)?)\.(?:jpe?g|png|webp)$/)?.[1] || "";
const fromDesignUpload = (url: unknown) => String(url || "").match(/\/design-raw\/([A-Z]+-\d+)-/)?.[1] || "";

export async function buildPackList(orders: Array<{ orderNumber?: string; _id: string; items?: Line[] }>) {
  const lines = orders.flatMap((o) => (o.items || []).map((it) => ({ it, order: String(o.orderNumber || o._id) })));
  const pids = [...new Set(lines.map((l) => String(l.it.productId || "")).filter(Boolean))];

  // Variants and products of everything in the list, 30 at a time.
  const variantBy = new Map<string, { sku: string; multiplier: number }>();
  const products = new Map<string, any>();
  for (let i = 0; i < pids.length; i += 30) {
    const chunk = pids.slice(i, i + 30);
    const [vs, ps] = await Promise.all([
      getDocs(query(collection(db, "variants"), where("productId", "in", chunk))),
      getDocs(query(collection(db, "products"), where(documentId(), "in", chunk))),
    ]);
    vs.docs.forEach((d) => {
      const v = d.data() as any;
      if (v.sku) variantBy.set(`${v.productId}::${String(v.title || "").toLowerCase()}`, { sku: String(v.sku), multiplier: Number(v.materialMultiplier) || 1 });
    });
    ps.docs.forEach((d) => products.set(d.id, d.data()));
  }

  const rows = new Map<string, PackRow>();
  const unresolved: Array<{ title: string; qty: number; order: string }> = [];
  for (const { it, order } of lines) {
    const qty = Number(it.quantity) || 1;
    const pid = String(it.productId || "");
    const v = variantBy.get(`${pid}::${String(it.variant || "").toLowerCase()}`);
    const p = products.get(pid);
    const raw = it.sku || v?.sku || fromImage(it.productImage) || fromDesignUpload(p?.designImageUrl) || "";
    const code = raw ? designCodeOf(raw) : "";
    if (!code) { unresolved.push({ title: String(it.productTitle || "Item"), qty, order }); continue; }
    const skin = SKIN_CODE.test(code);
    const key = skin ? code : `${code}::${it.productTitle}`;
    const row = rows.get(key) || { code, pieces: 0, orders: new Set<string>(), skin, title: String(it.productTitle || ""), cuts: new Map<string, Cut>() };
    row.pieces += qty * (v?.multiplier || 1);
    row.orders.add(order);
    // What to cut from this design: each device and its coverage, alike ones counted together.
    const device = [it.phoneBrand, it.phoneModel].filter(Boolean).join(" ").trim() || "Model not given";
    const coverage = coverageOf(it);
    const cutKey = `${device}::${coverage}`;
    const cut = row.cuts.get(cutKey) || { device, coverage, qty: 0 };
    cut.qty += qty;
    row.cuts.set(cutKey, cut);
    rows.set(key, row);
  }

  // Natural order: L-2 before L-10, and families together.
  const natural = (a: PackRow, b: PackRow) => a.code.localeCompare(b.code, undefined, { numeric: true });
  return {
    skins: [...rows.values()].filter((r) => r.skin).sort(natural),
    others: [...rows.values()].filter((r) => !r.skin).sort(natural),
    unresolved,
  };
}

export function packListText(orderCount: number, list: Awaited<ReturnType<typeof buildPackList>>): string {
  const pieces = list.skins.reduce((s, r) => s + r.pieces, 0);
  const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length));
  const out: string[] = [];
  out.push(`PACK LIST — ${new Date().toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`);
  out.push(`${orderCount} orders · ${list.skins.length} designs · ${pieces} pieces`);
  out.push("");
  out.push(`${pad("SKU", 12)}PCS`);
  out.push("-".repeat(18));
  for (const r of list.skins) {
    out.push(`${pad(r.code, 12)}${String(r.pieces).padStart(3)}`);
    // One line per cut under its design: the device, and the coverage chosen.
    for (const c of [...r.cuts.values()].sort((a, b) => a.device.localeCompare(b.device))) {
      out.push(`   - ${c.device}${c.coverage ? ` · ${c.coverage}` : ""}${c.qty > 1 ? `  × ${c.qty}` : ""}`);
    }
    out.push("");
  }
  if (list.others.length) {
    out.push("");
    out.push("OTHER ITEMS");
    out.push("-".repeat(18));
    for (const r of list.others) out.push(`${pad(String(r.pieces), 4)}${r.title} (${r.code})`);
  }
  if (list.unresolved.length) {
    out.push("");
    out.push("SKU NOT FOUND — check these by hand");
    out.push("-".repeat(18));
    for (const u of list.unresolved) out.push(`${pad(String(u.qty), 4)}${u.title} (${u.order})`);
  }
  out.push("");
  out.push("Laptop 'Top + Keyboard' counts as 2 pieces.");
  return out.join("\n") + "\n";
}
