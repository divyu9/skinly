/**
 * The device the shopper is browsing for, remembered.
 *
 * It used to live only in the query string, which meant it survived exactly as
 * long as the next link that happened to carry `?brand=&model=` forward. Tap a
 * category pill, open Cases, come back from a product — and the pair was gone,
 * along with the "change model" chip and the filtering it stood for. That is
 * why the chip appeared on some routes and not others: nothing was keeping it.
 *
 * Every entry point already pushes the pair into the URL, so this reads from
 * there and writes it down, rather than asking six call sites to remember.
 */

const KEY = "skinly_device_preference";

export interface ActiveDevice {
  brand: string;
  model: string;
  /** True when the shopper picked it, rather than the UA sniffer guessing. */
  isConfirmed?: boolean;
}

export function readActiveDevice(): ActiveDevice | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveDevice>;
    if (!parsed?.brand || !parsed?.model) return null;
    return { brand: parsed.brand, model: parsed.model, isConfirmed: parsed.isConfirmed };
  } catch {
    // Private windows and cleared site data both land here. No device is a
    // perfectly good answer; it just means we show the picker instead.
    return null;
  }
}

export function writeActiveDevice(brand: string, model: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ brand, model, isConfirmed: true }));
  } catch {
    /* storage unavailable — the URL still carries it for this visit */
  }
}

export function clearActiveDevice() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
