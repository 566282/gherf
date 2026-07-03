type WebVitalMetric = {
  id: string;
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  navigationType: string;
};

function dispatchMetric(metric: WebVitalMetric, endpoint?: string): void {
  if (!endpoint) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info('[web-vitals]', metric.name, metric.value, metric.rating);
    }
    return;
  }

  const payload = JSON.stringify({
    ...metric,
    path: window.location.pathname,
    ts: Date.now(),
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon(endpoint, blob);
    return;
  }

  void fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  });
}

export function reportWebVitals(endpoint?: string): void {
  void import('web-vitals')
    .then(({ onCLS, onINP, onLCP, onFCP, onTTFB }) => {
      const send = (metric: WebVitalMetric) => dispatchMetric(metric, endpoint);
      onCLS(send);
      onINP(send);
      onLCP(send);
      onFCP(send);
      onTTFB(send);
    })
    .catch(() => {
      // Keep startup resilient even if metric collection fails.
    });
}
