import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CameraIcon, FolderOpenIcon, SquareIcon, VideoIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";

/**
 * A packing video for the order, recorded from the webcam, as proof of what
 * went into the parcel when a customer claims it was lost or the wrong thing
 * arrived. The order number, customer and a running clock are drawn onto
 * every frame, so the video speaks for itself.
 *
 * The file stays on this computer: Chrome's folder access saves it into a
 * "Packing Videos" folder inside the folder picked once (Downloads), named
 * "<order> - <customer> - <date time>". Browsers without it (Safari, Firefox)
 * download it to Downloads instead. Only the file's name and time are kept
 * on the order (packingVideos), never the video.
 */

const MAX_MS = 10 * 60_000;
const DB = "skinly-packing";
const STORE = "handles";

function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onerror = () => resolve(undefined);
      open.onsuccess = () => {
        try {
          const req = run(open.result.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => resolve(req.result as T);
          req.onerror = () => resolve(undefined);
        } catch { resolve(undefined); }
      };
    } catch { resolve(undefined); }
  });
}

const canPickFolder = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

/** The "Packing Videos" folder, asking for it (or for permission again) only when `ask`. */
async function packingFolder(ask: boolean): Promise<any | null> {
  if (!canPickFolder()) return null;
  const saved: any = await idb("readonly", (s) => s.get("dir"));
  if (saved) {
    try {
      if ((await saved.queryPermission({ mode: "readwrite" })) === "granted") return saved;
      if (ask && (await saved.requestPermission({ mode: "readwrite" })) === "granted") return saved;
    } catch { /* stale handle: pick again */ }
  }
  if (!ask) return null;
  const root = await (window as any).showDirectoryPicker({ id: "skinly-packing", mode: "readwrite", startIn: "downloads" });
  const dir = await root.getDirectoryHandle("Packing Videos", { create: true });
  await idb("readwrite", (s) => s.put(dir, "dir"));
  return dir;
}

const pickMime = () => {
  const options = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return options.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) || "";
};

const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}`;

export function PackingVideoPanel({ order }: { order: any }) {
  const orderNo = String(order?.orderNumber || order?.checkoutRef || order?._id || "order");
  const customer = String(order?.shippingAddress?.fullName || order?.customerName || "Customer");
  const videos: any[] = Array.isArray(order?.packingVideos) ? order.packingVideos : [];

  const [state, setState] = useState<"idle" | "starting" | "recording" | "saving">("idle");
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [cam, setCam] = useState<string>(() => { try { return localStorage.getItem("packingCam") || ""; } catch { return ""; } });
  const [elapsed, setElapsed] = useState(0);
  const [folderName, setFolderName] = useState("");

  const preview = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef<{ stream?: MediaStream; rec?: MediaRecorder; draw?: number; tick?: number; stop?: number; chunks: Blob[]; started: number; dir?: any; mime: string }>({ chunks: [], started: 0, mime: "" });

  useEffect(() => {
    packingFolder(false).then((d) => setFolderName(d ? "Packing Videos" : "")).catch(() => {});
    return () => teardown();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const teardown = () => {
    const l = live.current;
    if (l.draw) clearInterval(l.draw);
    if (l.tick) clearInterval(l.tick);
    if (l.stop) clearTimeout(l.stop);
    l.stream?.getTracks().forEach((t) => t.stop());
    l.stream = undefined;
  };

  const start = async () => {
    setState("starting");
    try {
      // The folder first, while the click still counts as the user's: the browser
      // only shows its folder prompt in direct response to one.
      let dir: any = null;
      if (canPickFolder()) {
        try { dir = await packingFolder(true); setFolderName("Packing Videos"); }
        catch (e: any) { if (e?.name === "AbortError") { setState("idle"); return; } }
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, ...(cam ? { deviceId: { exact: cam } } : {}) },
        audio: true,
      }).catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: true }));
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
      setCams(devices);

      const v = preview.current!, c = canvas.current!;
      v.srcObject = stream;
      v.muted = true;
      await v.play();
      const vs = stream.getVideoTracks()[0]?.getSettings() || {};
      c.width = Number(vs.width) || 1280;
      c.height = Number(vs.height) || 720;
      const ctx = c.getContext("2d")!;
      const started = Date.now();
      // A timer rather than requestAnimationFrame, which stops when the tab is in the background.
      const draw = window.setInterval(() => {
        ctx.drawImage(v, 0, 0, c.width, c.height);
        const h = Math.round(c.height * 0.09);
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, c.height - h, c.width, h);
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.round(h * 0.42)}px system-ui, sans-serif`;
        ctx.textBaseline = "middle";
        ctx.fillText(`${orderNo} · ${customer}`, Math.round(h * 0.3), c.height - h / 2);
        const now = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const w = ctx.measureText(now).width;
        ctx.fillText(now, c.width - w - Math.round(h * 0.3), c.height - h / 2);
      }, 1000 / 30);

      const out = c.captureStream(30);
      stream.getAudioTracks().forEach((t) => out.addTrack(t));
      const mime = pickMime();
      const rec = new MediaRecorder(out, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 2_500_000 });
      live.current = { stream, rec, draw, chunks: [], started, dir, mime: rec.mimeType || mime };
      rec.ondataavailable = (e) => { if (e.data.size) live.current.chunks.push(e.data); };
      rec.onstop = () => void save();
      rec.start(1000);
      live.current.tick = window.setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500);
      live.current.stop = window.setTimeout(() => { toast.info("Stopped at 10 minutes"); stop(); }, MAX_MS);
      setElapsed(0);
      setState("recording");
    } catch (e: any) {
      teardown();
      setState("idle");
      toast.error(e?.name === "NotAllowedError" ? "Camera blocked — allow the camera for this site in the browser" : e?.message || "Could not start the camera");
    }
  };

  const stop = () => {
    const rec = live.current.rec;
    if (rec && rec.state !== "inactive") { setState("saving"); rec.stop(); }
  };

  const save = async () => {
    const l = live.current;
    teardown();
    const blob = new Blob(l.chunks, { type: l.mime || "video/webm" });
    const ext = (l.mime || "").includes("mp4") ? "mp4" : "webm";
    const fileName = `${safe(orderNo)} - ${safe(customer)} - ${stamp(new Date(l.started))}.${ext}`;
    const seconds = Math.round((Date.now() - l.started) / 1000);
    let savedTo = "Downloads";
    try {
      if (l.dir) {
        const fh = await l.dir.getFileHandle(fileName, { create: true });
        const w = await fh.createWritable();
        await w.write(blob);
        await w.close();
        savedTo = "Downloads/Packing Videos";
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      }
      toast.success(`Saved: ${fileName}`);
    } catch (e: any) {
      toast.error(`Could not save the video: ${e?.message || e}`);
      setState("idle");
      return;
    }
    // A note on the order that the video exists (the file itself stays on this computer).
    try {
      const { db, doc, updateDoc, arrayUnion } = await (await import("@/lib/fs")).loadFs();
      await updateDoc(doc(db, "orders", String(order._id)), {
        packingVideos: arrayUnion({ fileName, recordedAt: l.started, seconds, bytes: blob.size, savedTo }),
      });
    } catch { /* the file is saved; only the note failed */ }
    setState("idle");
  };

  const chooseCam = (id: string) => {
    setCam(id);
    try { localStorage.setItem("packingCam", id); } catch { /* fine */ }
  };

  const changeFolder = async () => {
    try {
      const root = await (window as any).showDirectoryPicker({ id: "skinly-packing", mode: "readwrite", startIn: "downloads" });
      const dir = await root.getDirectoryHandle("Packing Videos", { create: true });
      await idb("readwrite", (s) => s.put(dir, "dir"));
      setFolderName("Packing Videos");
      toast.success("Videos will be saved in this Packing Videos folder");
    } catch { /* cancelled */ }
  };

  const mmss = `${Math.floor(elapsed / 60)}:${pad(elapsed % 60)}`;
  const recording = state === "recording";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><VideoIcon className="size-4" /> Packing video</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          Record the parcel being packed: proof for a lost or "wrong item" claim. The order number, customer and time are stamped on the video.
          {canPickFolder()
            ? ` Saved on this computer in Downloads › Packing Videos${folderName ? "" : " (you'll pick the Downloads folder once)"}.`
            : " This browser saves it to Downloads (use Chrome to save into a Packing Videos folder)."}
        </p>

        <div className={state === "idle" ? "hidden" : "relative overflow-hidden rounded-lg bg-black"}>
          <video ref={preview} playsInline className="hidden" />
          <canvas ref={canvas} className="block w-full" />
          {recording && (
            <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
              <span className="size-2 animate-pulse rounded-full bg-white" /> REC {mmss}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {recording || state === "saving" ? (
            <Button type="button" variant="destructive" onClick={stop} disabled={state === "saving"}>
              <SquareIcon className="mr-2 size-4" /> {state === "saving" ? "Saving…" : "Stop & save"}
            </Button>
          ) : (
            <Button type="button" onClick={start} disabled={state === "starting"}>
              <CameraIcon className="mr-2 size-4" /> {state === "starting" ? "Starting camera…" : videos.length ? "Record another" : "Record packing video"}
            </Button>
          )}
          {cams.length > 1 && !recording && (
            <select value={cam} onChange={(e) => chooseCam(e.target.value)} className="h-9 rounded-md border px-2 text-xs">
              <option value="">Default camera</option>
              {cams.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
            </select>
          )}
          {canPickFolder() && folderName && !recording && (
            <Button type="button" variant="ghost" size="sm" onClick={changeFolder}><FolderOpenIcon className="mr-1 size-4" /> Change folder</Button>
          )}
        </div>

        {videos.length > 0 && (
          <ul className="space-y-1 border-t pt-2 text-xs">
            {videos.map((v, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2">
                <span className="font-mono">{v.fileName}</span>
                <span className="text-muted-foreground">
                  {new Date(v.recordedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · {Math.floor((v.seconds || 0) / 60)}:{pad((v.seconds || 0) % 60)} · {v.savedTo}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
