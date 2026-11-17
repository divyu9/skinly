/**
 * Opening a customer's WhatsApp chat from the admin.
 *
 * wa.me stops on a "Open app / Continue to WhatsApp Web" page, and "Continue"
 * opened a fresh WhatsApp Web tab every time; the tab already logged in then
 * went dead ("WhatsApp is open in another window"). On a computer we go
 * straight to web.whatsapp.com/send in one named tab, so every click reuses
 * the same WhatsApp Web tab. On a phone wa.me hands over to the app.
 */
const TAB = "skinly_whatsapp";

const isPhone = () => {
  try { return window.matchMedia("(pointer: coarse)").matches; } catch { return false; }
};

export function waUrl(phone: string, text?: string): string {
  const p = String(phone || "").replace(/\D/g, "");
  const num = p.length === 10 ? `91${p}` : p;
  const t = text ? encodeURIComponent(text) : "";
  return isPhone()
    ? `https://wa.me/${num}${t ? `?text=${t}` : ""}`
    : `https://web.whatsapp.com/send?phone=${num}${t ? `&text=${t}` : ""}`;
}

/**
 * WhatsApp's send link carries text only, never a picture. On a computer we put
 * the product photo on the clipboard as PNG (WhatsApp Web won't take webp), so
 * Ctrl/Cmd+V in the chat attaches it. The ClipboardItem gets a promise so the
 * write stays inside the click; the R2 bucket allows goskinly.com (CORS).
 */
function copyImage(url: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") return Promise.resolve(false);
    const png = new Promise<Blob>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext("2d")!.drawImage(img, 0, 0);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error("no blob"))), "image/png");
      };
      img.onerror = () => reject(new Error("image failed"));
      img.src = url;
    });
    return navigator.clipboard.write([new ClipboardItem({ "image/png": png })]).then(() => true, () => false);
  } catch { return Promise.resolve(false); }
}

/** Click handler for an <a href={waUrl(...)}>: on a computer, reuse the one WhatsApp Web tab. */
export function openWhatsApp(ev: { preventDefault(): void; stopPropagation(): void }, phone: string, text?: string, imageUrl?: string) {
  ev.stopPropagation();
  if (isPhone()) return; // let the link open wa.me normally
  ev.preventDefault();
  if (imageUrl) {
    copyImage(imageUrl).then((ok) => {
      if (!ok) return;
      import("sonner").then(({ toast }) => toast.success("Product photo copied: WhatsApp chat mein Ctrl/Cmd + V dabao", { duration: 6000 }));
    });
  }
  const w = window.open(waUrl(phone, text), TAB);
  if (w) { try { w.opener = null; } catch { /* cross-origin already */ } w.focus(); }
}
