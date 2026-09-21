import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.tsx";
import { Loader2, ListChecks } from "lucide-react";
import { toast } from "sonner";

/*
 * The pages that ought to exist, for somebody to pick from.
 *
 * The nightly job already knew this list and the settings screen already
 * showed a count and six examples — "Brand + gadget missing: vivo-phone-skins
 * (213), realme-phone-skins (206)…" — but there was no way to act on it. The
 * only controls were a cap and a kind filter, so writing the eleven pages you
 * actually want meant setting the cap to eleven and hoping the sort agreed
 * with you. This is the same list, whole, with tick boxes.
 *
 * Order is the job's own: worth, which is how many products sit behind a page
 * times what that gadget is worth. A console page and a phone page cost the
 * same to write and are worth about six times apart.
 */

type Pending = {
  slug: string;
  name: string;
  kind: string;
  gadget: string | null;
  brand: string | null;
  depth: number;
  weight: number;
  worth: number;
  fresh: boolean;
};

const KIND_LABEL: Record<string, string> = {
  "brand-gadget": "Brand + gadget",
  model: "Model",
  theme: "Theme",
  "theme-gadget": "Theme + gadget",
};

/** One click may not start a job that outlives the function that runs it. */
const MAX_PER_RUN = 50;

export function PendingPagesDialog({ onCreated }: { onCreated?: () => void }) {
  const run = useMutation(api.seo.runSeoAutoPages);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Pending[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [kind, setKind] = useState<string>("all");
  const [gadget, setGadget] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await run({ pendingOnly: true });
      setRows(Array.isArray(res?.pending) ? res.pending : []);
      setPicked(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read the pending list");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open && rows === null) void load(); }, [open]);

  const kinds = useMemo(() => [...new Set((rows || []).map((r) => r.kind))].sort(), [rows]);
  const gadgets = useMemo(
    () => [...new Set((rows || []).map((r) => r.gadget).filter(Boolean) as string[])].sort(),
    [rows],
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows || []).filter((r) =>
      (kind === "all" || r.kind === kind) &&
      (gadget === "all" || r.gadget === gadget) &&
      (!q || r.slug.includes(q) || r.name.toLowerCase().includes(q)));
  }, [rows, kind, gadget, search]);

  const toggle = (slug: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });

  // Filling to the cap from the top of the shown list is the common case:
  // "do the next fifty worth doing" without ticking fifty boxes.
  const takeTop = () => setPicked(new Set(shown.slice(0, MAX_PER_RUN).map((r) => r.slug)));

  const create = async () => {
    const slugs = [...picked].slice(0, MAX_PER_RUN);
    if (!slugs.length) return;
    setCreating(true);
    try {
      const res: any = await run({ slugs });
      toast.success(res?.message || `Created ${res?.created ?? slugs.length} pages`, {
        description: (res?.slugs || []).slice(0, 6).join(", ") || undefined,
        duration: 12000,
      });
      if (res?.errors?.length) toast.error(`${res.errors.length} failed — ${res.errors[0]}`);
      await load();
      onCreated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That did not run");
    } finally {
      setCreating(false);
    }
  };

  const overCap = picked.size > MAX_PER_RUN;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <ListChecks className="mr-2 h-4 w-4" />
        Pending pages
        {rows !== null && rows.length > 0 && (
          <Badge variant="secondary" className="ml-2">{rows.length}</Badge>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Pages that do not exist yet</DialogTitle>
            <DialogDescription>
              Every page the generator knows it could write, best first. Tick the ones you want and
              write them now — this ignores the nightly cap.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search name or slug…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-56"
            />
            <div className="flex flex-wrap gap-1">
              {["all", ...kinds].map((k) => (
                <Button key={k} size="sm" variant={kind === k ? "default" : "outline"}
                        className="h-8" onClick={() => setKind(k)}>
                  {k === "all" ? "All types" : KIND_LABEL[k] || k}
                </Button>
              ))}
            </div>
            {gadgets.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {["all", ...gadgets].map((g) => (
                  <Button key={g} size="sm" variant={gadget === g ? "default" : "outline"}
                          className="h-8" onClick={() => setGadget(g)}>
                    {g === "all" ? "All gadgets" : g}
                  </Button>
                ))}
              </div>
            )}
            <Button size="sm" variant="ghost" className="h-8 ml-auto" onClick={takeTop}
                    disabled={!shown.length}>
              Pick top {Math.min(MAX_PER_RUN, shown.length)}
            </Button>
            {picked.size > 0 && (
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setPicked(new Set())}>
                Clear
              </Button>
            )}
          </div>

          <div className="max-h-[52vh] overflow-auto rounded-md border">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Working out what is missing…
              </div>
            ) : !shown.length ? (
              <div className="p-10 text-center text-muted-foreground">
                {rows?.length ? "Nothing matches those filters." : "Every page that should exist, exists."}
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Page</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Designs</TableHead>
                    <TableHead className="text-right">Worth</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((r) => (
                    <TableRow key={r.slug} className="cursor-pointer" onClick={() => toggle(r.slug)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={picked.has(r.slug)} onCheckedChange={() => toggle(r.slug)} />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.name}</div>
                        <code className="text-xs text-muted-foreground">/{r.slug}</code>
                        {r.fresh && <Badge variant="secondary" className="ml-2">new model</Badge>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{KIND_LABEL[r.kind] || r.kind}</Badge>
                        {r.gadget && <span className="ml-2 text-muted-foreground">{r.gadget}</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.depth}</TableCell>
                      {/* depth × what that gadget is worth, which is why a
                          console page outranks a phone page with more behind it */}
                      <TableCell className="text-right tabular-nums text-muted-foreground">{r.worth}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter className="sm:justify-between">
            <span className="text-sm text-muted-foreground">
              {shown.length} shown{rows ? ` of ${rows.length} pending` : ""}
              {picked.size > 0 && ` · ${picked.size} ticked`}
              {overCap && ` · only the first ${MAX_PER_RUN} will be written`}
            </span>
            <Button onClick={create} disabled={!picked.size || creating}>
              {creating
                ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Writing…</>)
                : `Write ${Math.min(picked.size, MAX_PER_RUN) || ""} page${picked.size === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
