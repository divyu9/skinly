import { Link } from "react-router-dom";
import { RefreshCwIcon } from "lucide-react";

/**
 * AutoApply glass: the tool is reusable, so anyone who bought a pack can keep
 * buying glass alone. Nothing told them — the refills never had a listing.
 * On a pack with the tool this points to the refills; on a refill it points
 * back to the pack, for someone who landed here without the tool.
 */
const HD_REFILL = "/products/refill-hd-glass-autoapply-iphone";
const PRIVACY_REFILL = "/products/refill-privacy-glass-autoapply-iphone";
const HD_PACK = "/products/screen-guard-twin-pack-2x-hd-glass";

export function RefillLine({ title, category }: { title: string; category?: string }) {
  if (String(category || "").toLowerCase() !== "glass" || !/autoapply/i.test(title)) return null;
  const box = "flex items-start gap-2 rounded-xl border-2 border-ink bg-[#e8f6f2] px-3 py-2 text-sm";
  if (/refill/i.test(title)) {
    return (
      <div className={box}>
        <RefreshCwIcon className="mt-0.5 size-4 shrink-0" />
        <p><b>Glass only — the AutoApply tool is not included.</b> Don't have it yet? <Link to={HD_PACK} className="font-bold underline">Get the pack with the tool →</Link></p>
      </div>
    );
  }
  return (
    <div className={box}>
      <RefreshCwIcon className="mt-0.5 size-4 shrink-0" />
      <p>
        <b>Keep the tool — it's reusable.</b> Next time, buy just the glass for <b>₹129</b>:{" "}
        <Link to={HD_REFILL} className="font-bold underline">HD refill</Link> ·{" "}
        <Link to={PRIVACY_REFILL} className="font-bold underline">Privacy refill</Link>
      </p>
    </div>
  );
}
