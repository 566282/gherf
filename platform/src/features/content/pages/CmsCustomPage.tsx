import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/DesignSystem';
import { buildDefaultCmsConfig, listCmsConfig, type CmsConfig } from '@/services/api/cms';
import type { CmsCustomPageBlock, CmsPricingTableBlock } from '@/types';

function PricingTableSection({ pricing }: { pricing: CmsPricingTableBlock }): JSX.Element {
  return (
    <section className="mt-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge tone="accent">{pricing.badge}</Badge>
          <h2 className="mt-3 text-3xl font-semibold text-foreground">{pricing.title}</h2>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-muted">{pricing.description}</p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {pricing.tiers.map((tier) => (
          <Card key={tier.name} className="border border-border bg-surface-elevated">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted">{tier.name}</p>
                <h3 className="mt-2 text-3xl font-semibold text-foreground">{tier.price}</h3>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">{tier.description}</p>
            <ul className="mt-4 space-y-2 text-sm text-foreground/85">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-accent" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Link to={tier.ctaHref} className="mt-5 inline-flex rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-strong">
              {tier.ctaLabel}
            </Link>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function CmsCustomPage(): JSX.Element {
  const { slug = '' } = useParams();
  const [config, setConfig] = useState<CmsConfig>(buildDefaultCmsConfig());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void listCmsConfig()
      .then(setConfig)
      .catch(() => setConfig(buildDefaultCmsConfig()))
      .finally(() => setIsLoading(false));
  }, []);

  const customPage = useMemo(() => config.customPages.find((page) => page.slug === slug), [config.customPages, slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-hero text-foreground">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-12 sm:px-6 lg:px-8">
          <Card className="border border-border bg-surface/80 p-8">
            <p className="text-sm uppercase tracking-[0.3em] text-accent/80">Custom page</p>
            <h1 className="mt-3 text-3xl font-semibold text-foreground">Loading page...</h1>
            <p className="mt-3 text-muted">Fetching the published CMS content for this route.</p>
          </Card>
        </div>
      </div>
    );
  }

  if (!customPage) {
    return (
      <div className="min-h-screen bg-hero text-foreground">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-12 sm:px-6 lg:px-8">
          <Card className="border border-border bg-surface/80 p-8">
            <p className="text-sm uppercase tracking-[0.3em] text-accent/80">Custom page</p>
            <h1 className="mt-3 text-3xl font-semibold text-foreground">Page not found</h1>
            <p className="mt-3 text-muted">No CMS page is published for the slug “{slug || 'unknown'}”.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/" className="rounded-xl bg-accent px-5 py-3 text-sm font-medium text-accent-foreground transition hover:bg-accent-strong">
                Open homepage
              </Link>
              <Link to="/login" className="rounded-xl border border-border bg-surface-elevated px-5 py-3 text-sm text-foreground transition hover:border-success/60 hover:text-accent">
                Log in
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hero text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface/80 px-5 py-4 backdrop-blur-xl">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent/80">Custom page</p>
            <h1 className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">{customPage.title}</h1>
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
                <p className="text-sm uppercase tracking-[0.3em] text-accent/80">{customPage.eyebrow}</p>
                <h2 className="max-w-3xl text-4xl font-semibold leading-tight text-foreground md:text-5xl">{customPage.title}</h2>
                <p className="max-w-3xl text-lg text-foreground/80">{customPage.summary}</p>
                <p className="max-w-3xl text-base leading-7 text-muted">{customPage.body}</p>
              </div>

              {customPage.blocks.map((block: CmsCustomPageBlock) => (block.type === 'pricingTable' ? <PricingTableSection key={block.id} pricing={block.content} /> : null))}

              <div className="flex flex-wrap gap-3">
                <Link to={customPage.ctaHref} className="rounded-xl bg-accent px-5 py-3 text-sm font-medium text-accent-foreground transition hover:bg-accent-strong">
                  {customPage.ctaLabel}
                </Link>
                <Link to="/signup" className="rounded-xl border border-border bg-surface-elevated px-5 py-3 text-sm text-foreground transition hover:border-success/60 hover:text-accent">
                  Create account
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="border border-border bg-surface-elevated">
                <p className="text-sm text-muted">Slug</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{customPage.slug}</p>
              </Card>
              <Card className="border border-border bg-surface-elevated">
                <p className="text-sm text-muted">Highlights</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{customPage.highlights.length}</p>
              </Card>
              <Card className="border border-border bg-surface-elevated">
                <p className="text-sm text-muted">Sections</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{customPage.items.length}</p>
              </Card>
              <Card className="border border-border bg-surface-elevated">
                <p className="text-sm text-muted">Status</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">Published from CMS</p>
              </Card>
            </div>
          </div>
        </Card>

        {customPage.highlights.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-3">
            {customPage.highlights.map((highlight) => (
              <Card key={highlight} className="border border-border bg-surface-elevated">
                <Badge tone="info">Highlight</Badge>
                <p className="mt-3 text-lg font-medium text-foreground">{highlight}</p>
              </Card>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          {customPage.items.map((item) => (
            <Card key={`${item.title}-${item.meta ?? 'item'}`} className="border border-border bg-surface-elevated">
              <p className="text-xs uppercase tracking-[0.24em] text-muted">{item.meta ?? customPage.eyebrow}</p>
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
