import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CameraIcon, FolderOpenIcon, SendIcon, SquareIcon, Trash2Icon, VideoIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";

/**
 * A packing video for the order, recorded from the webcam, as proof of what
 * went into the parcel when a customer claims it was lost or the wrong thing
 * arrived. A CCTV-style date and time (top right), and the order number and
 * customer (bottom bar), are drawn onto every frame, so the video speaks for itself.
 *
 * A copy also goes up to R2 (packing/<orderId>/<random>) so the customer can
 * watch it on their order page, with the rules for receiving the parcel.
 *
 * The file is saved on this computer too: Chrome's folder access saves it into a
 * "Packing Videos" folder inside the folder picked once (Downloads), named
 * "<order> - <customer> - <date time>". Browsers without it (Safari, Firefox)
 * download it to Downloads instead. Recorded as MP4 where the browser can (plays on every phone), else WebM. The order keeps each file's name, time
 * and the online copy's url (packingVideos).
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
  // MP4 first: it plays on every phone (older iPhones can't play WebM) and in QuickTime.
  // Chrome records MP4 since 2024; older browsers fall back to WebM.
  const options = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
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
  // landscape: as the camera sees it; portrait: the middle of the frame, upright;
  // rotated: a webcam mounted on its side, turned upright.
  const [shape, setShape] = useState<"landscape" | "portrait" | "rotated">(() => {
    try { const v = localStorage.getItem("packingShape"); return v === "portrait" || v === "rotated" ? v : "landscape"; } catch { return "landscape"; }
  });

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
        // 720p is plenty to read a label; a 4K camera (DJI Osmo Pocket as a webcam) is asked for less.
        video: { width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 }, frameRate: { ideal: 30, max: 30 }, ...(cam ? { deviceId: { exact: cam } } : {}) },
        audio: true,
      }).catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: true }));
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
      setCams(devices);

      const v = preview.current!, c = canvas.current!;
      v.srcObject = stream;
      v.muted = true;
      await v.play();
      const vs = stream.getVideoTracks()[0]?.getSettings() || {};
      const camW = Number(vs.width) || v.videoWidth || 1280;
      const camH = Number(vs.height) || v.videoHeight || 720;
      const portrait = shape !== "landscape";
      // The recorded frame's long side stays at 1280 px whatever the camera sends: a 4K canvas
      // redrawn 30 times a second would load the computer for no gain (the bitrate sets the size).
      const k = Math.min(1, 1280 / Math.max(camW, camH));
      const sw = Math.round(camW * k), sh = Math.round(camH * k);
      if (shape === "landscape") { c.width = sw; c.height = sh; }
      else if (shape === "rotated") { c.width = sh; c.height = sw; }
      else { c.height = sh; c.width = Math.round(sh * 9 / 16); }
      const ctx = c.getContext("2d")!;
      const frame = () => {
        if (shape === "rotated") {
          // The camera lies on its side: turn its picture a quarter turn to stand up.
          ctx.save();
          ctx.translate(c.width, 0);
          ctx.rotate(Math.PI / 2);
          ctx.drawImage(v, 0, 0, camW, camH, 0, 0, sw, sh);
          ctx.restore();
        } else if (shape === "portrait") {
          // The upright middle strip of the camera's picture.
          const cropW = Math.round(camH * 9 / 16);
          ctx.drawImage(v, Math.round((camW - cropW) / 2), 0, cropW, camH, 0, 0, c.width, c.height);
        } else {
          ctx.drawImage(v, 0, 0, c.width, c.height);
        }
      };
      const started = Date.now();
      // A timer rather than requestAnimationFrame, which stops when the tab is in the background.
      const draw = window.setInterval(() => {
        frame();
        // Sized from the short side, so the stamp fits a portrait frame too.
        const h = Math.round(Math.min(c.width, c.height) * 0.09);
        const m = Math.round(h * 0.3);
        // CCTV-style stamp, top corners: white monospace with a black outline, readable on any background.
        const d = new Date();
        const cctv = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}  ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        ctx.textBaseline = "top";
        ctx.lineJoin = "round";
        ctx.font = `bold ${Math.round(h * 0.5)}px ui-monospace, Menlo, Consolas, monospace`;
        ctx.lineWidth = Math.max(3, Math.round(h * 0.08));
        ctx.strokeStyle = "#000";
        ctx.fillStyle = "#fff";
        const tw = ctx.measureText(cctv).width;
        ctx.strokeText(cctv, c.width - tw - m, m);
        ctx.fillText(cctv, c.width - tw - m, m);
        // "● REC" blinks once a second, as on a recorder.
        ctx.font = `bold ${Math.round(h * 0.38)}px ui-monospace, Menlo, Consolas, monospace`;
        const label = "REC  SKINLY PACKING";
        const dot = Math.round(h * 0.16);
        // Portrait has no room beside the clock: the label goes on the line below it.
        const ly = portrait ? m + Math.round(h * 0.7) : m;
        if (d.getSeconds() % 2 === 0) {
          ctx.fillStyle = "#e11";
          ctx.beginPath();
          ctx.arc(m + dot, ly + Math.round(h * 0.2), dot, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "#fff";
        ctx.strokeText(label, m + dot * 3, ly);
        ctx.fillText(label, m + dot * 3, ly);
        // Bottom bar: which order this is.
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, c.height - h, c.width, h);
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.round(h * 0.42)}px system-ui, sans-serif`;
        ctx.textBaseline = "middle";
        let line = `${orderNo} · ${customer}`;
        while (line.length > 8 && ctx.measureText(line).width > c.width - m * 2) line = line.slice(0, -2) + "…";
        ctx.fillText(line, m, c.height - h / 2);
      }, 1000 / 30);

      const out = c.captureStream(30);
      stream.getAudioTracks().forEach((t) => out.addTrack(t));
      const mime = pickMime();
      const rec = new MediaRecorder(out, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 1_200_000 });
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
    // A copy online, for the customer's order page: proof of what was packed and how the
    // parcel looked. Behind a random name; shown only to whoever can see the full order.
    let url = "";
    try {
      const [{ functions }, { httpsCallable }] = await Promise.all([import("@/lib/firebase"), import("firebase/functions")]);
      const rnd = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      const key = `packing/${String(order._id)}/${rnd}.${ext}`;
      const type = (blob.type || "").split(";")[0] || (ext === "mp4" ? "video/mp4" : "video/webm");
      const r: any = await httpsCallable(functions, "generateUploadUrl")({ fileName: key, contentType: type });
      const put = await fetch(r.data.uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": type } });
      if (!put.ok) throw new Error(`upload ${put.status}`);
      url = String(r.data.publicUrl || "");
      toast.success("Uploaded — the customer can watch it on their order page");
    } catch (e: any) {
      toast.warning(`Saved on this computer, but the online copy failed (${e?.message || e}). Record again to share it with the customer.`);
    }
    // A note on the order: the file's name and time, and the online copy if it went up.
    try {
      const { db, doc, updateDoc, arrayUnion } = await (await import("@/lib/fs")).loadFs();
      await updateDoc(doc(db, "orders", String(order._id)), {
        packingVideos: arrayUnion({ fileName, recordedAt: l.started, seconds, bytes: blob.size, savedTo, ...(url ? { url } : {}) }),
      });
    } catch { /* the file is saved; only the note failed */ }
    // The first video online tells the customer (WhatsApp + email, with the unboxing rules).
    if (url && !order?.packingVideoNotice) await notify(true);
    setState("idle");
  };

  // A wrong take: off the order, its online copy deleted (so the customer never sees it),
  // and the file removed from the Packing Videos folder when this browser can reach it.
  const [deleting, setDeleting] = useState("");
  const remove = async (v: any) => {
    if (!window.confirm(`Delete this packing video?\n\n${v.fileName}\n\nThe customer will no longer see it.`)) return;
    setDeleting(v.fileName);
    try {
      const [{ functions }, { httpsCallable }] = await Promise.all([import("@/lib/firebase"), import("firebase/functions")]);
      if (v.url) {
        const key = decodeURIComponent(new URL(v.url).pathname.replace(/^\//, ""));
        if (key.startsWith(`packing/${String(order._id)}/`)) await httpsCallable(functions, "deleteR2Object")({ key });
      }
      const { db, doc, updateDoc, arrayRemove } = await (await import("@/lib/fs")).loadFs();
      await updateDoc(doc(db, "orders", String(order._id)), { packingVideos: arrayRemove(v) });
      let local = false;
      try {
        const dir = await packingFolder(false);
        if (dir) { await dir.removeEntry(v.fileName); local = true; }
      } catch { /* not in the folder, or no access: leave it */ }
      toast.success(local ? "Video deleted (online and from the Packing Videos folder)" : "Video deleted online — delete the file from Downloads yourself if you want");
    } catch (e: any) {
      toast.error(e?.message || "Could not delete the video");
    } finally {
      setDeleting("");
    }
  };

  const [notifying, setNotifying] = useState(false);
  const notify = async (auto = false) => {
    setNotifying(true);
    try {
      const [{ functions }, { httpsCallable }] = await Promise.all([import("@/lib/firebase"), import("firebase/functions")]);
      const r: any = (await httpsCallable(functions, "sendPackingVideoNotice")({ orderId: String(order._id) })).data;
      const went = [r?.whatsapp && "WhatsApp", r?.email && "email"].filter(Boolean).join(" and ");
      if (went) toast.success(`Customer told on ${went}`);
      else if (!auto) toast.warning("Nothing sent: switch on the packing_video WhatsApp / email usecase once its template is approved");
    } catch (e: any) {
      if (!auto) toast.error(e?.message || "Could not send");
    } finally {
      setNotifying(false);
    }
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
          Record the parcel being packed: proof for a lost or "wrong item" claim. The order number, customer and time are stamped on the video, and the customer can watch it on their order page.
          {canPickFolder()
            ? ` Saved on this computer in Downloads › Packing Videos${folderName ? "" : " (you'll pick the Downloads folder once)"}.`
            : " This browser saves it to Downloads (use Chrome to save into a Packing Videos folder)."}
        </p>

        <div className={state === "idle" ? "hidden" : "relative overflow-hidden rounded-lg bg-black"}>
          <video ref={preview} playsInline className="hidden" />
          <canvas ref={canvas} className={shape === "landscape" ? "block w-full" : "mx-auto block max-h-[70vh] w-auto"} />
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
          {!recording && state !== "saving" && (
            <select value={shape} disabled={state === "starting"}
              onChange={(e) => { const v = e.target.value as typeof shape; setShape(v); try { localStorage.setItem("packingShape", v); } catch { /* fine */ } }}
              className="h-9 rounded-md border px-2 text-xs" aria-label="Video shape">
              <option value="landscape">Landscape</option>
              <option value="portrait">Portrait</option>
              <option value="rotated">Portrait (camera turned on its side)</option>
            </select>
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

        {videos.some((v) => v.url) && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-2 text-xs">
            <span className="text-muted-foreground">
              {order?.packingVideoNotice
                ? `Customer told on ${[order.packingVideoNotice.whatsapp && "WhatsApp", order.packingVideoNotice.email && "email"].filter(Boolean).join(" + ")} · ${new Date(order.packingVideoNotice.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`
                : "Customer not told yet"}
            </span>
            <Button type="button" size="sm" variant="outline" disabled={notifying || recording} onClick={() => notify(false)}>
              <SendIcon className="mr-1 size-3.5" /> {notifying ? "Sending…" : order?.packingVideoNotice ? "Send again" : "Send to customer"}
            </Button>
          </div>
        )}
        {videos.length > 0 && (
          <ul className="space-y-1 border-t pt-2 text-xs">
            {videos.map((v, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2">
                <span className="font-mono">{v.fileName}{v.url ? <a href={v.url} target="_blank" rel="noopener noreferrer" className="ml-2 font-sans text-primary underline">online ↗</a> : <span className="ml-2 font-sans text-amber-700">not online</span>}</span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {new Date(v.recordedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · {Math.floor((v.seconds || 0) / 60)}:{pad((v.seconds || 0) % 60)} · {v.savedTo}
                  <button type="button" onClick={() => remove(v)} disabled={!!deleting || recording} aria-label={`Delete ${v.fileName}`}
                    className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-40">
                    <Trash2Icon className="size-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
