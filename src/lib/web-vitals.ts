import { onCLS, onFID, onFCP, onLCP, onTTFB } from 'web-vitals';

export function reportWebVitals() {
  const send = (metric: { name: string; value: number; id: string }) => {
    if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', metric.name, {
        value: metric.value,
        metric_id: metric.id,
      });
    }
  };

  onCLS(send);
  onFID(send);
  onFCP(send);
  onLCP(send);
  onTTFB(send);
}
