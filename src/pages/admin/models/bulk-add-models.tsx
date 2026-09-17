import { useMemo, useState } from "react";
import { toast } from "sonner";
import { collection, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Loader2Icon } from "lucide-react";
import { LAUNCHES_2026 } from "./launches-2026.ts";

/**
 * Adds many supported models at once.
 *
 * One line per model — "Brand, Model, category" — pasted or loaded from the
 * 2026 launch list. Every line is checked before anything is written: the
 * category must be an active gadget type, and a model already in the table
 * (same brand and name, ignoring case and spacing) is skipped rather than
 * duplicated. Brands are matched to the spelling already in use, so "xiaomi"
 * lands under "Xiaomi".
 */

type Line = {
  raw: string;
  brand: string;
  model: string;
  category: string;
  gadgetTypeId?: string;
  status: "new" | "exists" | "duplicate" | "invalid";
  reason?: string;
};

const norm = (s: string) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

export function BulkAddModels({ models, gadgetTypes, onClose }: {
  models: any[];
  gadgetTypes: any[];
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const lines = useMemo<Line[]>(() => {
    const existing = new Set(models.map((m) => `${norm(m.brandName)}|${norm(m.modelName)}`));
    const brandSpelling = new Map<string, string>();
    models.forEach((m) => { if (m.brandName) brandSpelling.set(norm(m.brandName), String(m.brandName).trim()); });
    const types = new Map(gadgetTypes.map((g) => [norm(g.name), g]));
    const seen = new Set<string>();

    return text
      .split("\n")
      .map((raw) => raw.trim())
      .filter(Boolean)
      .map((raw): Line => {
        const [b = "", m = "", c = "phone"] = raw.split(",").map((p) => p.trim());
        const brand = brandSpelling.get(norm(b)) || b;
        const category = norm(c) || "phone";
        const gt = types.get(category);
        const line: Line = { raw, brand, model: m.replace(/\s+/g, " "), category, gadgetTypeId: gt?._id, status: "new" };
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
            isActive: true,
            // The storefront picks up models added since its last build by this.
            _creationTime: now + i + k,
            createdAt: now,
            source: "bulk-add",
          });
        });
        await batch.commit();
      }
      toast.success(`${toAdd.length} models added`);
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
          <DialogTitle>Bulk add models</DialogTitle>
          <DialogDescription>
            One model per line: <code>Brand, Model, category</code> (category is a gadget type such as phone or
            tablet; phone if left out). Models already in the list are skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={saving} onClick={() => setText(LAUNCHES_2026)}>
            Load Jan–Sep 2026 launches ({LAUNCHES_2026.split("\n").length})
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
            Add {toAdd.length} model{toAdd.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
