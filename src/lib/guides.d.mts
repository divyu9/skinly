export type GuideBlock =
  | string
  | { ul: string[] } | { ol: string[] } | { h3: string } | { tip: string } | { note: string }
  | { table: { head: string[]; rows: string[][] } } | { img: string } | { cta: { text: string; href: string } };
export interface GuideImage { alt: string; caption?: string; prompt: string; src?: string }
export interface Guide {
  slug: string;
  cluster: string;
  title: string;
  metaTitle: string;
  description: string;
  updated: string;
  published?: string;
  answer: string;
  cover?: string;
  images?: Record<string, GuideImage>;
  sections: { id: string; h2: string; blocks: GuideBlock[] }[];
  faqs?: { q: string; a: string }[];
  related?: string[];
  shop?: { label: string; href: string }[];
  auto?: boolean;
}
export type InlinePart = { t: "text" | "b"; v: string } | { t: "a"; v: string; href: string };
export const GUIDE_SITE: string;
export const GUIDES_META: { title: string; description: string };
export const GUIDE_CLUSTERS: { id: string; name: string; blurb: string }[];
export function inlineParts(text: string): InlinePart[];
export function plainText(text: string): string;
export function guideLinks(g: Guide): string[];
export function guideText(g: Guide): string;
export function readingMinutes(g: Guide): number;
export function imageOf(g: Guide, key: string): GuideImage | null;
export function guideBodyHtml(g: Guide, bySlug?: Map<string, Guide>): string;
export function guideJsonLd(g: Guide): Record<string, unknown>[];
export function guideIssues(g: Guide, opts?: { minWords?: number }): string[];
