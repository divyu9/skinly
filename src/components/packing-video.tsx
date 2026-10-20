import { useRef } from "react";
import { AlertTriangleIcon, VideoIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";

/** Tells the server how far the customer watched (logPackingVideoView); never gets in the way. */
async function logView(orderId: string, pct: number) {
  try {
    const qs = new URLSearchParams(window.location.search);
    const [{ functions }, { httpsCallable }] = await Promise.all([import("@/lib/firebase"), import("firebase/functions")]);
    await httpsCallable(functions, "logPackingVideoView")({
      orderId, pct, ...(qs.get("k") ? { k: qs.get("k") } : {}), ...(qs.get("t") ? { t: qs.get("t") } : {}),
    });
  } catch { /* viewing works whether or not this lands */ }
}

/**
 * The order's packing video (recorded in Admin › order › Packing video and
 * uploaded to R2), with the rules for receiving the parcel: refuse a parcel
 * that looks different, and keep one uncut unboxing video showing the label,
 * or no claim can be made with the courier. Shown only on the full order view
 * (the customer's own link or account): the label in the video carries their
 * name and address.
 */
export function PackingVideo({ order }: { order: any }) {
  const videos = (Array.isArray(order?.packingVideos) ? order.packingVideos : []).filter((v: any) => /^https:\/\//.test(String(v?.url || "")));
  // Milestones already reported in this visit, per video, so each is sent once.
  const sent = useRef<Record<number, Set<number>>>({});
  if (!videos.length) return null;
  const orderId = String(order?._id || "");
  const report = (i: number, pct: number) => {
    const done = (sent.current[i] ||= new Set());
    if (done.has(pct)) return;
    done.add(pct);
    void logView(orderId, pct);
  };
  const onTime = (i: number, el: HTMLVideoElement) => {
    if (!el.duration || !isFinite(el.duration)) return;
    const p = (el.currentTime / el.duration) * 100;
    for (const m of [25, 50, 75]) if (p >= m) report(i, m);
  };
  return (
    <Card className="border-2 border-ink">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <VideoIcon className="h-5 w-5" />
          Your packing video
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p>
          This is your order being packed — proof that the correct item was sent, and how the sealed parcel looked when it left us.
        </p>
        {videos.map((v: any, i: number) => (
          <video key={i} src={v.url} controls playsInline preload="metadata" className="w-full max-h-[70vh] rounded-lg bg-black"
            onPlay={() => report(i, 0)} onTimeUpdate={(e) => onTime(i, e.currentTarget)} onEnded={() => report(i, 100)} />
        ))}
        <div className="space-y-3 rounded-xl border-2 border-heart bg-heart/10 p-4">
          <p className="flex items-center gap-2 text-lg font-extrabold leading-tight text-heart">
            <AlertTriangleIcon className="h-5 w-5 shrink-0" /> Protect yourself from courier scams
          </p>
          <p>
            Parcels can be opened, swapped or emptied on the way. These steps are <b>for your safety</b> — they are the only way a courier will accept a claim, and the only way we can get your money or item back for you.
          </p>
          <div>
            <p className="text-base font-extrabold">1. DO NOT ACCEPT a different or opened parcel</p>
            <p>Check it at the door. If the packing looks different from the video, or the parcel looks opened, torn or tampered with, <b>refuse it</b> and hand it back to the courier.</p>
          </div>
          <div>
            <p className="text-base font-extrabold">2. Record ONE complete, UNCUT unboxing video</p>
            <p>Start recording <b>before</b> you open it. Show the sealed parcel <b>from all sides</b>, with the <b>shipping label clearly visible — your name and the AWB number</b>. Then open it on the same video and check every item.</p>
          </div>
          <div>
            <p className="text-base font-extrabold">3. Never cut, pause or edit the video</p>
            <p>Couriers reject claims made with a cut or edited video. With one uncut video, if anything is missing or different, <b>we fight the claim with the courier for you.</b></p>
          </div>
          <p className="rounded-lg bg-heart px-3 py-2.5 font-extrabold text-white">
            Without this uncut unboxing video, NO claim for a missing, wrong or damaged item can be accepted — in any situation.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
