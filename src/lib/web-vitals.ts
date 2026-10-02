import { onCLS, onINP, onFCP, onLCP, onTTFB } from 'web-vitals/attribution';
import type { MetricWithAttribution } from 'web-vitals/attribution';

// Real-user speed numbers into GA4 as one event, `web_vitals`, with the
// element that caused the number: LCP's element, the biggest layout shift's
// source, INP's target. Custom dimensions to register in GA4 (event-scoped):
// metric_name, metric_rating, page_type, device, target.

function pageType(): string {
  const p = location.pathname;
  if (p === '/' || p === '') return 'home';
  if (p.startsWith('/products/')) return 'product';
  if (p.startsWith('/cart')) return 'cart';
  if (p.startsWith('/checkout')) return 'checkout';
  if (p.startsWith('/orders')) return 'order';
  if (p.startsWith('/collections') || p.startsWith('/category') || p.startsWith('/brand')) return 'listing';
  return 'other';
}

function targetOf(m: MetricWithAttribution): string {
  const a = m.attribution as unknown as Record<string, unknown>;
  const pick =
    (a.element as string) ||
    (a.largestShiftTarget as string) ||
    (a.interactionTarget as string) ||
    (a.target as string) ||
    '';
  return String(pick).slice(0, 100);
}

export function reportWebVitals() {
  const device = window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop';
  const send = (metric: MetricWithAttribution) => {
    const gtag = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
    if (typeof gtag !== 'function') return;
    gtag('event', 'web_vitals', {
      metric_name: metric.name,
      metric_id: metric.id,
      metric_rating: metric.rating,
      // CLS is a unitless score; the rest are milliseconds.
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      page_type: pageType(),
      device,
      target: targetOf(metric),
      non_interaction: true,
    });
  };

  onCLS(send);
  onINP(send);
  onFCP(send);
  onLCP(send);
  onTTFB(send);
}
