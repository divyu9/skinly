import { useEffect, useState } from "react";
import { deleteField, doc, onSnapshot, setDoc } from "firebase/firestore";
import { MegaphoneIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { ANNOUNCEMENT_STYLES, Countdown } from "@/components/announcement-bar.tsx";

/**
 * The notice bar at the very top of the shop — free shipping, a sale, an
 * offer. It lived at the bottom of the Settings tab, and saving it there
 * failed whenever a field was left empty (Firestore refuses `undefined`),
 * so clearing a link was impossible. Here, first on the page, it saves only
 * itself, and a sale can be given an end time so it comes down on its own.
 */

const STYLES = [
  { value: "brand", label: "Brand green" },
  { value: "sale", label: "Sale red" },
  { value: "dark", label: "Black" },
];

/** A timestamp as the value a datetime-local input takes, in local time. */
const toLocalInput = (ms: number) => {
  if (!ms) return "";
  const d = new Date(ms - new Date().getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
};

export function AnnouncementCard() {
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [style, setStyle] = useState("brand");
  const [endsAt, setEndsAt] = useState("");
  const [countdown, setCountdown] = useState(false);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => onSnapshot(doc(db, "homepageSettings", "default"), (s) => {
    const d: any = s.data() || {};
    const next = {
      enabled: d.announcementEnabled === true, text: d.announcementText || "", link: d.announcementLink || "",
      style: d.announcementStyle || "brand", endsAt: toLocalInput(Number(d.announcementEndsAt) || 0),
      countdown: d.announcementCountdown === true,
    };
    setSaved(JSON.stringify(next));
    if (!loaded) {
      setEnabled(next.enabled); setText(next.text); setLink(next.link); setStyle(next.style); setEndsAt(next.endsAt); setCountdown(next.countdown);
      setLoaded(true);
    }
  }), [loaded]);

  const current = JSON.stringify({ enabled, text, link, style, endsAt, countdown });
  const dirty = loaded && current !== saved;
  const endsMs = endsAt ? new Date(endsAt).getTime() : 0;
  const expired = !!endsMs && endsMs < Date.now();

  const save = async () => {
    if (enabled && !text.trim()) { toast.error("Write the notice first"); return; }
    const l = link.trim();
    if (l && !l.startsWith("/") && !/^https?:\/\//.test(l)) { toast.error("A link starts with / (a page on the site) or https://"); return; }
    setBusy(true);
    try {
      await setDoc(doc(db, "homepageSettings", "default"), {
        announcementEnabled: enabled,
        announcementText: text.trim() || deleteField(),
        announcementLink: l || deleteField(),
        announcementStyle: style,
        announcementEndsAt: endsMs || deleteField(),
        // A countdown needs an end to count to.
        announcementCountdown: !!endsMs && countdown,
        updatedAt: Date.now(),
      }, { merge: true });
      toast.success(enabled ? "Notice is live — it shows on the site within seconds" : "Notice turned off");
    } catch (e: any) {
      toast.error(e?.message || "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-lg"><MegaphoneIcon className="size-5" /> Notice bar</CardTitle>
        {loaded && (
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch checked={enabled} onCheckedChange={setEnabled} /> {enabled ? "Showing" : "Off"}
          </label>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* What customers will see, as they'll see it. */}
        <div className={`flex items-center justify-center gap-2 rounded-md px-4 py-1.5 text-xs ${ANNOUNCEMENT_STYLES[style]} ${enabled && !expired ? "" : "opacity-40"}`}>
          <span className="truncate">{text || "Your notice will appear here"}</span>
          {countdown && endsMs > Date.now() && <Countdown key={endsMs} endsAt={endsMs} />}
          {link && <span className="font-semibold">→</span>}
        </div>
        {expired && enabled && <p className="text-xs text-amber-700">The end time has passed, so the bar is hidden. Clear or change it to show the notice again.</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notice-text">Notice</Label>
            <Input id="notice-text" value={text} maxLength={120} onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Diwali Sale — flat 20% off all skins, today only!" />
            <p className="text-xs text-muted-foreground">{text.length}/120 · keep it short: phones show about 45 characters, about 28 with the countdown on.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notice-link">Opens (optional)</Label>
            <Input id="notice-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/products or /products?collection=sale" />
          </div>
          <div className="space-y-1.5">
            <Label>Colour</Label>
            <div className="flex gap-2">
              {STYLES.map((s) => (
                <button key={s.value} type="button" onClick={() => setStyle(s.value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${ANNOUNCEMENT_STYLES[s.value]} ${style === s.value ? "ring-2 ring-offset-2 ring-foreground" : "opacity-70"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notice-ends">Take it down at (optional)</Label>
            <div className="flex gap-2">
              <Input id="notice-ends" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="w-56" />
              {endsAt && <Button variant="ghost" size="sm" onClick={() => setEndsAt("")}>Clear</Button>}
            </div>
            <p className="text-xs text-muted-foreground">For a sale: the bar hides itself at this time.</p>
            <label className={`flex items-center gap-2 pt-1 text-sm ${endsAt ? "" : "opacity-50"}`}>
              <Switch checked={countdown && !!endsAt} disabled={!endsAt} onCheckedChange={setCountdown} />
              Show a live countdown (e.g. "Ends in 05:23:11")
            </label>
            {!endsAt && <p className="text-xs text-muted-foreground">Set an end time to use the countdown.</p>}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={save} disabled={busy || !dirty}><SaveIcon className="mr-1.5 size-4" />{busy ? "Saving…" : "Save notice"}</Button>
          {dirty && <span className="self-center text-xs text-muted-foreground">Unsaved changes</span>}
        </div>
      </CardContent>
    </Card>
  );
}
