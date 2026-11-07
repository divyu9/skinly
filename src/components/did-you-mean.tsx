import { ArrowRightIcon, CheckCircle2Icon } from "lucide-react";

export type SuggestedModel = { _id?: string; brandName: string; modelName: string; level?: "exact" | "possible" | "similar" };

/**
 * In a "request your model" form: the models we already list that the
 * customer's typing names, each a button straight to its skins.
 *
 * A request waits until an admin approves it, often the next evening, and by
 * then a customer who wanted a skin today has bought one elsewhere. Most of
 * those requests were for a phone the site already listed under a slightly
 * different name (src/lib/model-match.ts), so the form now shows it and one
 * tap takes them there.
 */
export function DidYouMean({ models, onPick }: { models?: SuggestedModel[] | null; onPick: (m: SuggestedModel) => void }) {
  if (!models?.length) return null;
  const sure = models[0].level === "exact" || models[0].level === "possible";
  return (
    <div className="sticker-sm rounded-xl bg-brand/10 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-bold">
        <CheckCircle2Icon className="size-4 shrink-0 text-brand-deep" />
        {sure ? "Good news: we already have your phone!" : "Is it one of these? We already have them."}
      </p>
      <div className="flex flex-col gap-1.5">
        {models.slice(0, 4).map((m) => (
          <button
            key={m._id || `${m.brandName}|${m.modelName}`}
            type="button"
            onClick={() => {
              window.gtag?.("event", "model_suggestion_click", { brand: m.brandName, model: m.modelName, level: m.level || "" });
              onPick(m);
            }}
            className="sticker-press flex items-center justify-between gap-2 rounded-lg border-2 border-foreground bg-card px-3 py-2 text-left text-sm font-semibold hover:bg-brand/15"
          >
            <span className="truncate">{m.brandName} {m.modelName}</span>
            <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-brand-deep">
              Shop skins <ArrowRightIcon className="size-3.5" />
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Not yours? Carry on below and we'll add it.</p>
    </div>
  );
}

/** Where a picked suggestion goes from a form that is not on a product: the listing narrowed to that phone. */
export const shopLinkFor = (m: SuggestedModel) =>
  `/products?${new URLSearchParams({ brand: m.brandName, model: m.modelName })}`;
