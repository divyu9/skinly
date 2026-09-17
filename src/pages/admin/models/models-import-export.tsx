import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { collection, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Label } from "@/components/ui/label.tsx";
import { DownloadIcon, Loader2Icon, UploadIcon } from "lucide-react";
import { LAUNCHES_2026 } from "./launches-2026.ts";

/**
 * Export and import for the supported-models table.
 *
 * Export writes a CSV — Brand, Model, Category, Active — for everything, one
 * brand, or one gadget type. Import reads the same CSV (or pasted lines, or the
 * bundled 2026 launch list) and only ever adds: a model already in the table
 * (same brand and name, ignoring case and spacing) is left exactly as it is,
 * so an edited export can be re-imported safely. Every line is checked before
 * anything is written — the category must be an active gadget type — and
 * brands are matched to the spelling already in use, so "xiaomi" lands under
 * "Xiaomi".
 */

/** RFC-4180-ish CSV: quoted fields, doubled quotes, commas inside quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.map((r) => r.map((f) => f.trim())).filter((r) => r.some(Boolean));
}

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function download(name: string, text: string) {
  // BOM so Excel reads the file as UTF-8.
  const url = URL.createObjectURL(new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function ExportModels({ models, gadgetTypes, onClose }: {
  models: any[];
  gadgetTypes: any[];
  onClose: () => void;
}) {
  const [scope, setScope] = useState<"all" | "brand" | "type">("all");
  const [brand, setBrand] = useState("");
  const [type, setType] = useState("");

  const brands = useMemo(
    () => [...new Set(models.map((m) => String(m.brandName || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [models]
  );
  const types = useMemo(
    () => [...new Set(models.map((m) => String(m.category || "").trim()).filter(Boolean))].sort(),
    [models]
  );
  const label = (t: string) => gadgetTypes.find((g) => g.name === t)?.displayName || t;

  const chosen = models.filter((m) =>
    scope === "all" ? true
    : scope === "brand" ? norm(m.brandName) === norm(brand)
    : String(m.category || "") === type
  );

  const run = () => {
    const rows = [...chosen].sort((a, b) =>
      String(a.brandName).localeCompare(String(b.brandName)) ||
      String(a.category).localeCompare(String(b.category)) ||
      String(a.modelName).localeCompare(String(b.modelName), undefined, { numeric: true })
    );
    const csv = ["Brand,Model,Category,Active", ...rows.map((m) =>
      [m.brandName, String(m.modelName || "").trim(), m.category, m.isActive === false ? "no" : "yes"].map(csvCell).join(",")
    )].join("\n") + "\n";
    const tag = scope === "all" ? "all" : scope === "brand" ? brand : type;
    download(`models-${tag.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success(`Exported ${rows.length} models`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export models</DialogTitle>
          <DialogDescription>A CSV you can edit in Excel or Sheets and import back.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 text-sm">
            {([["all", "All"], ["brand", "By brand"], ["type", "By gadget type"]] as const).map(([k, t]) => (
              <button
                key={k}
                onClick={() => setScope(k)}
                className={`flex-1 rounded-md px-2 py-1.5 font-medium transition ${scope === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t}
              </button>
            ))}
          </div>
          {scope === "brand" && (
            <div className="space-y-1">
              <Label className="text-xs">Brand</Label>
              <Select value={brand} onValueChange={setBrand}>
                <SelectTrigger><SelectValue placeholder="Pick a brand" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {scope === "type" && (
            <div className="space-y-1">
              <Label className="text-xs">Gadget type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue placeholder="Pick a gadget type" /></SelectTrigger>
                <SelectContent>
                  {types.map((t) => <SelectItem key={t} value={t}>{label(t)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <p className="text-sm text-muted-foreground">{chosen.length.toLocaleString()} models</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!chosen.length || (scope === "brand" && !brand) || (scope === "type" && !type)}
            onClick={run}
          >
            <DownloadIcon className="mr-1.5 size-4" />
            Download CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Line = {
  raw: string;
  brand: string;
  model: string;
  category: string;
  gadgetTypeId?: string;
  status: "new" | "exists" | "duplicate" | "invalid";
  reason?: string;
  active: boolean;
};

/** The bundled list, narrowed to one brand. */
const onlyBrand = (brand: string) =>
  LAUNCHES_2026.split("\n").filter((l) => l.startsWith(`${brand},`)).join("\n");

const norm = (s: string) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

export function ImportModels({ models, gadgetTypes, onClose }: {
  models: any[];
  gadgetTypes: any[];
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const lines = useMemo<Line[]>(() => {
    const existing = new Set(models.map((m) => `${norm(m.brandName)}|${norm(m.modelName)}`));
    const brandSpelling = new Map<string, string>();
    models.forEach((m) => { if (m.brandName) brandSpelling.set(norm(m.brandName), String(m.brandName).trim()); });
    const types = new Map(gadgetTypes.map((g) => [norm(g.name), g]));
    const seen = new Set<string>();

    const table = parseCsv(text);
    // A header row from an export (or a hand-made sheet) is not a model.
    if (table.length && norm(table[0][0]).replace(/^\ufeff/, "") === "brand") table.shift();
    return table
      .map((cells): Line => {
        const [b = "", m = "", c = "", active = ""] = cells;
        const brand = brandSpelling.get(norm(b)) || b;
        const category = norm(c) || "phone";
        const gt = types.get(category);
        const line: Line = {
          raw: cells.join(", "), brand, model: m.replace(/\s+/g, " "), category, gadgetTypeId: gt?._id, status: "new",
          active: !/^(no|false|0|inactive)$/i.test(active),
        };
        const key = `${norm(brand)}|${norm(m)}`;
        if (!b || !m) return { ...line, status: "invalid", reason: "needs Brand, Model" };
        if (!gt) return { ...line, status: "invalid", reason: `no gadget type "${c}"` };
        if (existing.has(key)) return { ...line, status: "exists" };
        if (seen.has(key)) return { ...line, status: "duplicate" };
        seen.add(key);
        return line;
      });
  }, [text, models, gadgetTypes]);

  const toAdd = lines.filter((l) => l.status === "new");
  const count = (s: Line["status"]) => lines.filter((l) => l.status === s).length;
  const newBrands = [...new Set(toAdd.map((l) => l.brand))].filter(
    (b) => !models.some((m) => norm(m.brandName) === norm(b))
  );

  const save = async () => {
    if (!toAdd.length) return;
    if (!confirm(`Add ${toAdd.length} model(s)?`)) return;
    setSaving(true);
    try {
      const now = Date.now();
      for (let i = 0; i < toAdd.length; i += 400) {
        const batch = writeBatch(db);
        toAdd.slice(i, i + 400).forEach((l, k) => {
          batch.set(doc(collection(db, "supportedModels")), {
            brandName: l.brand,
            modelName: l.model,
            category: l.category,
            gadgetTypeId: l.gadgetTypeId,
            isActive: l.active,
            // The storefront picks up models added since its last build by this.
            _creationTime: now + i + k,
            createdAt: now,
            source: "import",
          });
        });
        await batch.commit();
      }
      toast.success(`${toAdd.length} new model${toAdd.length === 1 ? "" : "s"} added`);
      setText("");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the models");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import models</DialogTitle>
          <DialogDescription>
            Upload a CSV (<code>Brand, Model, Category, Active</code> — the export's format) or paste lines. Only
            new models are added; a model already in the list is left unchanged. Category is a gadget type such as
            phone or tablet (phone if left out).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setText((await f.text()).replace(/^\ufeff/, ""));
              e.target.value = "";
            }}
          />
          <Button size="sm" disabled={saving} onClick={() => fileRef.current?.click()}>
            <UploadIcon className="mr-1.5 size-3.5" />
            Choose CSV file
          </Button>
          <Button size="sm" variant="outline" disabled={saving} onClick={() => setText(LAUNCHES_2026)}>
            Feb–Sep 2026 launches ({LAUNCHES_2026.split("\n").length})
          </Button>
          <Button size="sm" variant="outline" disabled={saving} onClick={() => setText(onlyBrand("Apple"))}>
            Apple only ({onlyBrand("Apple").split("\n").length})
          </Button>
          {lines.length > 0 && (
            <>
              <Badge className="bg-emerald-600">{toAdd.length} to add</Badge>
              <Badge variant="outline">{count("exists")} already there</Badge>
              {count("duplicate") > 0 && <Badge variant="outline">{count("duplicate")} repeated</Badge>}
              {count("invalid") > 0 && <Badge variant="destructive">{count("invalid")} with problems</Badge>}
            </>
          )}
        </div>

        <Textarea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Samsung, Galaxy A57, phone\nApple, iPad Air 11 (2026), tablet"}
          className="font-mono text-xs"
        />

        {newBrands.length > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            New brand{newBrands.length === 1 ? "" : "s"}: {newBrands.join(", ")} — check the spelling before adding.
          </p>
        )}

        {lines.length > 0 && (
          <div className="max-h-72 overflow-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted text-left">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Brand</th>
                  <th className="px-2 py-1.5 font-medium">Model</th>
                  <th className="px-2 py-1.5 font-medium">Type</th>
                  <th className="px-2 py-1.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className={`border-t ${l.status === "new" ? "" : "text-muted-foreground"}`}>
                    <td className="px-2 py-1">{l.brand}</td>
                    <td className="px-2 py-1">{l.model}</td>
                    <td className="px-2 py-1">{l.category}</td>
                    <td className="px-2 py-1">
                      {l.status === "new" ? (
                        <span className="text-emerald-600">add</span>
                      ) : l.status === "exists" ? (
                        "already there"
                      ) : l.status === "duplicate" ? (
                        "repeated line"
                      ) : (
                        <span className="text-rose-600">{l.reason}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button disabled={saving || !toAdd.length} onClick={() => void save()}>
            {saving && <Loader2Icon className="mr-1.5 size-4 animate-spin" />}
            Add {toAdd.length} new model{toAdd.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
