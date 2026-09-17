import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { LISTING_PRESETS, PHASE_1_LISTINGS } from "@/lib/ai-mockup-shots.ts";

/**
 * Which listings each roll has, from the rolls on the shelf rather than from
 * the listings that happen to exist — so a roll with nothing made yet shows up
 * as a row of gaps instead of not showing up at all.
 *
 * A cell is live (studio listing published), draft (made, waiting for its
 * first picture) or missing. "Old" counts the pre-studio listings still up,
 * which the studio's retire tool archives and redirects.
 */

type Cell = "live" | "draft" | "missing";

const titleCase = (s: string) => s.replace(/(^|\s)(\w)/g, (_, a, b) => a + b.toUpperCase());

export function RollCoverage() {
  const rolls = useQuery(api.rollsManagement.getRollInventory) as any[] | undefined;
  const [data, setData] = useState<{ byRoll: Map<string, Map<string, Cell>>; old: Map<string, number> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [phaseOnly, setPhaseOnly] = useState(true);
  const [filter, setFilter] = useState<"all" | "gaps" | "drafts" | "uncalibrated" | "old">("gaps");

  const kinds = useMemo(
    () => Object.keys(LISTING_PRESETS).filter((k) => !phaseOnly || PHASE_1_LISTINGS.has(k)),
    [phaseOnly]
  );

  // Reads every product and variant once, on request: an admin check, not a
  // live view, so it does not hold 3,000 documents open.
  const load = async () => {
    setLoading(true);
    try {
      const [products, variants] = await Promise.all([getDocs(collection(db, "products")), getDocs(collection(db, "variants"))]);
      const product = new Map(products.docs.map((d) => [d.id, d.data() as any]));
      const byRoll = new Map<string, Map<string, Cell>>();
      const oldSeen = new Map<string, Set<string>>();
      for (const d of variants.docs) {
        const v = d.data() as any;
        const m = /^(R-\d+)/i.exec(String(v.sku || ""));
        const p = product.get(v.productId);
        if (!m || !p) continue;
        const code = `R-${Number(m[1].slice(2))}`;
        if (!p.listingKind) {
          if (p.status !== "archived") (oldSeen.get(code) || oldSeen.set(code, new Set()).get(code)!).add(v.productId);
          continue;
        }
        const kind = String(p.listingKind).toLowerCase();
        const row = byRoll.get(code) || new Map<string, Cell>();
        const cell: Cell = p.status === "active" ? "live" : p.status === "archived" ? "missing" : "draft";
        if (row.get(kind) !== "live") row.set(kind, cell);
        byRoll.set(code, row);
      }
      setData({ byRoll, old: new Map([...oldSeen].map(([k, s]) => [k, s.size])) });
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(() => {
    if (!rolls || !data) return [];
    return rolls
      .map((r) => {
        const code = `R-${Number(String(r.rNumber || "").replace(/\D/g, ""))}`;
        const have = data.byRoll.get(code) || new Map<string, Cell>();
        const cells = kinds.map((k) => have.get(k) || "missing");
        return {
          id: r._id,
          code: String(r.rNumber || ""),
          name: String(r.designName || ""),
          meters: Number(r.metersAvailable) || 0,
          calibrated: !!r.flatImageUrl,
          photo: !!r.rawImageUrl,
          cells,
          live: cells.filter((c) => c === "live").length,
          drafts: cells.filter((c) => c === "draft").length,
          old: data.old.get(code) || 0,
        };
      })
      .filter((r) =>
        filter === "all" ? true
        : filter === "gaps" ? r.live < kinds.length
        : filter === "drafts" ? r.drafts > 0
        : filter === "uncalibrated" ? !r.calibrated
        : r.old > 0
      )
      .sort((a, b) => b.meters - a.meters || a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [rolls, data, kinds, filter]);

  const totals = useMemo(() => {
    const all = rows.flatMap((r) => r.cells);
    return { live: all.filter((c) => c === "live").length, draft: all.filter((c) => c === "draft").length, cells: all.length };
  }, [rows]);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Coverage</h3>
            <p className="text-sm text-muted-foreground">
              Every roll on the shelf against every listing it should have. Sorted by metres in stock, so the
              rolls worth doing first are at the top.
            </p>
          </div>
          <Button size="sm" onClick={() => void load()} disabled={loading || !rolls}>
            {loading ? <Loader2Icon className="mr-1.5 size-4 animate-spin" /> : <RefreshCwIcon className="mr-1.5 size-4" />}
            {data ? "Refresh" : "Load coverage"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={phaseOnly} onCheckedChange={setPhaseOnly} />
            Phase 1 listings ({PHASE_1_LISTINGS.size})
          </label>
          {([["gaps", "Has gaps"], ["drafts", "Waiting for pictures"], ["uncalibrated", "Not calibrated"], ["old", "Old listings up"], ["all", "All"]] as const).map(([k, label]) => (
            <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} className="h-7 text-xs" onClick={() => setFilter(k)}>
              {label}
            </Button>
          ))}
          {data && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {rows.length} rolls · {totals.live}/{totals.cells} live · {totals.draft} drafts
            </span>
          )}
        </div>

        {!data ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {loading ? "Reading every listing — a few seconds…" : "Load coverage to see which listings each roll is missing."}
          </p>
        ) : (
          <div className="max-h-[70vh] overflow-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-muted">
                <tr>
                  <th className="sticky left-0 z-10 bg-muted px-2 py-1.5 text-left font-medium">Roll</th>
                  <th className="px-2 py-1.5 text-right font-medium">m</th>
                  <th className="px-2 py-1.5 font-medium">Ready</th>
                  {kinds.map((k) => (
                    <th key={k} className="whitespace-nowrap px-1.5 py-1.5 font-medium">
                      <span className="inline-block max-w-[5.5rem] truncate align-bottom" title={titleCase(k)}>{titleCase(k)}</span>
                    </th>
                  ))}
                  <th className="px-2 py-1.5 font-medium">Old</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="sticky left-0 bg-background px-2 py-1">
                      <span className="font-mono font-semibold">{r.code}</span>
                      <span className="block max-w-[10rem] truncate text-muted-foreground">{r.name}</span>
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">{r.meters}</td>
                    <td className="px-2 py-1">
                      <div className="flex gap-1">
                        {!r.photo && <Badge variant="destructive" className="text-[9px]">no photo</Badge>}
                        {r.photo && !r.calibrated && <Badge className="bg-amber-500 text-[9px]">calibrate</Badge>}
                        {r.calibrated && <Badge className="bg-emerald-600 text-[9px]">ok</Badge>}
                      </div>
                    </td>
                    {r.cells.map((c, i) => (
                      <td key={kinds[i]} className="px-1.5 py-1 text-center">
                        {c === "live" ? <span className="text-emerald-600" title="live">●</span>
                          : c === "draft" ? <span className="text-amber-500" title="draft — waiting for a picture">◐</span>
                          : <span className="text-muted-foreground/40" title="missing">○</span>}
                      </td>
                    ))}
                    <td className="px-2 py-1 text-center tabular-nums">{r.old || ""}</td>
                    <td className="px-2 py-1">
                      <Link className="whitespace-nowrap text-violet-600 hover:underline" to={`/backend-skinly/ai-mockups?design=${encodeURIComponent(r.code)}`}>
                        Open in studio
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">● live · ◐ draft, waiting for its first picture · ○ missing</p>
      </CardContent>
    </Card>
  );
}
