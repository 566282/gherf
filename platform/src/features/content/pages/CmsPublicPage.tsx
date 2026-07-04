import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/DesignSystem';
import { buildDefaultCmsConfig, getCmsPageLabel, listCmsConfig, type CmsConfig, type CmsPageKey } from '@/services/api/cms';

interface CmsPublicPageProps {
  pageKey: CmsPageKey;
}

export function CmsPublicPage({ pageKey }: CmsPublicPageProps): JSX.Element {
  const [config, setConfig] = useState<CmsConfig>(buildDefaultCmsConfig());

  useEffect(() => {
    void listCmsConfig().then(setConfig).catch(() => setConfig(buildDefaultCmsConfig()));
  }, []);

  const content = config.pages[pageKey];

  const metaCards = useMemo(
    () => [
      { label: 'Site', value: config.siteName },
      { label: 'Section', value: getCmsPageLabel(pageKey) },
      { label: 'Highlights', value: String(content.highlights.length) },
      { label: 'Items', value: String(content.items.length) },
    ],
    [config.siteName, content.highlights.length, content.items.length, pageKey],
  );

  return (
    <div className="min-h-screen bg-hero text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface/80 px-5 py-4 backdrop-blur-xl">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent/80">{config.siteName}</p>
            <h1 className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">{content.title}</h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/" className="rounded-xl border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/50 hover:text-accent">
              Home
            </Link>
            <Link to="/login" className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-strong">
              Log in
            </Link>
          </div>
        </div>

        <Card className="overflow-hidden border border-border bg-[linear-gradient(145deg,hsl(var(--color-surface))_0%,hsl(var(--color-surface-elevated))_100%)] shadow-2xl shadow-black/30">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div className="space-y-6">
              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.3em] text-accent/80">{content.eyebrow}</p>
                <h2 className="max-w-3xl text-4xl font-semibold leading-tight text-foreground md:text-5xl">{content.title}</h2>
                <p className="max-w-3xl text-lg text-foreground/80">{content.summary}</p>
                <p className="max-w-3xl text-base leading-7 text-muted">{content.body}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link to={content.ctaHref} className="rounded-xl bg-accent px-5 py-3 text-sm font-medium text-accent-foreground transition hover:bg-accent-strong">
                  {content.ctaLabel}
                </Link>
                <Link to="/signup" className="rounded-xl border border-border bg-surface-elevated px-5 py-3 text-sm text-foreground transition hover:border-success/60 hover:text-accent">
                  Create account
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {metaCards.map((card) => (
                <Card key={card.label} className="border border-border bg-surface-elevated">
                  <p className="text-sm text-muted">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{card.value}</p>
                </Card>
              ))}
            </div>
          </div>
        </Card>

        {content.highlights.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-3">
            {content.highlights.map((highlight) => (
              <Card key={highlight} className="border border-border bg-surface-elevated">
                <Badge tone="info">Highlight</Badge>
                <p className="mt-3 text-lg font-medium text-foreground">{highlight}</p>
              </Card>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          {content.items.map((item) => (
            <Card key={`${item.title}-${item.meta ?? 'item'}`} className="border border-border bg-surface-elevated">
              <p className="text-xs uppercase tracking-[0.24em] text-muted">{item.meta ?? getCmsPageLabel(pageKey)}</p>
              <h3 className="mt-2 text-2xl font-semibold text-foreground">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted">{item.body}</p>
              {item.href ? (
                <Link to={item.href} className="mt-4 inline-flex text-sm font-medium text-accent transition hover:text-accent-strong">
                  Open content
                </Link>
              ) : null}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
