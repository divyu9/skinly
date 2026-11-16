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

/** Click handler for an <a href={waUrl(...)}>: on a computer, reuse the one WhatsApp Web tab. */
export function openWhatsApp(ev: { preventDefault(): void; stopPropagation(): void }, phone: string, text?: string) {
  ev.stopPropagation();
  if (isPhone()) return; // let the link open wa.me normally
  ev.preventDefault();
  const w = window.open(waUrl(phone, text), TAB);
  if (w) { try { w.opener = null; } catch { /* cross-origin already */ } w.focus(); }
}
