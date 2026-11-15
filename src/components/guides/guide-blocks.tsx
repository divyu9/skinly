import { Fragment } from "react";
import { Link } from "react-router-dom";
import { InfoIcon, LightbulbIcon } from "lucide-react";
import { imageOf, inlineParts, type Guide, type GuideBlock } from "@/lib/guides.mjs";

/**
 * A guide's text and blocks, drawn from the same data the build turns into
 * plain HTML (src/lib/guides.mjs), so the page and the prerendered copy say
 * the same thing. Internal links are router links; anything else opens out.
 */
export function Inline({ text }: { text: string }) {
  return (
    <>
      {inlineParts(text).map((p, i) =>
        p.t === "b" ? <strong key={i}>{p.v}</strong>
          : p.t === "a" ? (p.href.startsWith("/")
            ? <Link key={i} to={p.href} className="font-semibold text-brand-deep underline decoration-2 underline-offset-2 hover:text-ink">{p.v}</Link>
            : <a key={i} href={p.href} target="_blank" rel="noreferrer" className="font-semibold underline">{p.v}</a>)
            : <Fragment key={i}>{p.v}</Fragment>)}
    </>
  );
}

export function GuideBlockView({ guide, block }: { guide: Guide; block: GuideBlock }) {
  if (typeof block === "string") return <p><Inline text={block} /></p>;
  if ("h3" in block) return <h3><Inline text={block.h3} /></h3>;
  if ("ul" in block) return <ul>{block.ul.map((x, i) => <li key={i}><Inline text={x} /></li>)}</ul>;
  if ("ol" in block) return <ol>{block.ol.map((x, i) => <li key={i}><Inline text={x} /></li>)}</ol>;
  if ("tip" in block || "note" in block) {
    const tip = "tip" in block;
    const Icon = tip ? LightbulbIcon : InfoIcon;
    return (
      <div className={`not-prose my-6 flex gap-3 rounded-2xl border-2 border-ink p-4 text-[15px] leading-relaxed ${tip ? "bg-sunny/60" : "bg-brand/10"}`}>
        <Icon className="mt-0.5 size-5 shrink-0 text-ink" />
        <p><b>{tip ? "Tip: " : "Good to know: "}</b><Inline text={tip ? (block as { tip: string }).tip : (block as { note: string }).note} /></p>
      </div>
    );
  }
  if ("table" in block) {
    return (
      <div className="not-prose my-6 overflow-x-auto rounded-2xl border-2 border-ink">
        <table className="w-full min-w-[520px] border-collapse text-left text-sm">
          <thead className="bg-sunny">
            <tr>{block.table.head.map((h, i) => <th key={i} className="border-b-2 border-ink px-3 py-2.5 font-extrabold text-ink"><Inline text={h} /></th>)}</tr>
          </thead>
          <tbody>
            {block.table.rows.map((r, i) => (
              <tr key={i} className="odd:bg-card even:bg-muted/40">
                {r.map((c, j) => <td key={j} className={`border-t border-ink/10 px-3 py-2.5 align-top ${j === 0 ? "font-bold" : ""}`}><Inline text={c} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if ("img" in block) {
    const img = imageOf(guide, block.img);
    if (!img) return null;
    return (
      <figure className="not-prose my-6">
        <img src={img.src} alt={img.alt} loading="lazy" decoding="async" className="w-full rounded-2xl border-2 border-ink object-cover" />
        {img.caption && <figcaption className="mt-2 text-center text-sm text-muted-foreground">{img.caption}</figcaption>}
      </figure>
    );
  }
  if ("cta" in block) {
    return (
      <p className="not-prose my-6">
        <Link to={block.cta.href} className="sticker sticker-press inline-flex items-center rounded-xl border-2 border-ink bg-brand px-5 py-2.5 text-sm font-bold text-brand-foreground">
          {block.cta.text}
        </Link>
      </p>
    );
  }
  return null;
}
