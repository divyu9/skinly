/**
 * What is wrong with a product's gadget and finish, and the fix when it is
 * certain. Admin › Classification lists these and applies the fixes.
 *
 * The gadget is two fields naming one thing: gadgetTypeId (the shop's gadget
 * filter) and gadgetCategory (the name — "fits your device", breadcrumbs, SEO
 * pages). Only skins must have a gadget and a finish; open-box gadgets, cases
 * and the rest need neither.
 */

export type Product = {
  _id: string; title?: string; status?: string; productCategory?: string;
  gadgetTypeId?: string; gadgetCategory?: string; finishTypeId?: string; finishType?: string;
};
export type TypeRow = { _id: string; name: string; displayName?: string; isActive?: boolean };
export type Issue = { label: string; fix?: Partial<Product> };

/** A skin's finish from its own words, only where the answer is plain. */
export function finishFromTitle(p: Product, finishes: TypeRow[]): string | undefined {
  const t = `${p.finishType || ""} ${p.title || ""}`.toLowerCase();
  const by = (n: string) => finishes.find((f) => f.name === n)?._id;
  if (/\b3d\b|emboss|textur/.test(t)) return by("embossed");
  if (/transparent|\btranz|membrane/.test(t)) return by("transparent");
  if (/leather/.test(t)) return by("premium-leather");
  if (/matte/.test(t)) return by("matte");
  return undefined;
}

/** What is wrong with a product's classification, and the fix when it is certain. */
export function issuesOf(p: Product, gadgets: TypeRow[], finishes: TypeRow[]): Issue[] {
  const out: Issue[] = [];
  const byId = gadgets.find((g) => g._id === p.gadgetTypeId);
  const byName = gadgets.find((g) => g.name === p.gadgetCategory);
  const skin = p.productCategory === "skin";

  if (p.gadgetTypeId && !byId) out.push({ label: "Gadget type deleted" });
  else if (byId && !p.gadgetCategory) out.push({ label: "Gadget name missing", fix: { gadgetCategory: byId.name } });
  // Linking puts the product in that gadget's filter, so only a skin is linked
  // unasked: a non-skin's stray name ("phone" on a toy) is shown, not trusted.
  else if (!p.gadgetTypeId && byName) out.push({ label: "Gadget link missing", ...(skin ? { fix: { gadgetTypeId: byName._id } } : {}) });
  else if (byId && p.gadgetCategory && byId.name !== p.gadgetCategory) out.push({ label: `Gadget says ${byId.name} and ${p.gadgetCategory}` });
  else if (!p.gadgetTypeId && !p.gadgetCategory && skin) out.push({ label: "No gadget" });

  if (p.finishTypeId && !finishes.some((f) => f._id === p.finishTypeId)) out.push({ label: "Finish type deleted" });
  else if (!p.finishTypeId && skin) {
    const f = finishFromTitle(p, finishes);
    out.push({ label: "No finish", ...(f ? { fix: { finishTypeId: f } } : {}) });
  }
  return out;
}
