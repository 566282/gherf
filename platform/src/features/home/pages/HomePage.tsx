import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/DesignSystem';
import { buildDefaultCmsConfig, listCmsConfig } from '@/services/api/cms';
import { defaultCustomizationConfig } from '@/lib/customization';
import { listAdminConsoleConfig } from '@/services/api/admin';
import { listCampaigns } from '@/services/api/campaigns';

export function HomePage(): JSX.Element {
  const [query, setQuery] = useState('');
  const [siteName, setSiteName] = useState(buildDefaultCmsConfig().siteName);
  const [featuredItems, setFeaturedItems] = useState(buildDefaultCmsConfig().pages.home.items);
  const [headline, setHeadline] = useState(buildDefaultCmsConfig().pages.home.title);
  const [summary, setSummary] = useState(buildDefaultCmsConfig().pages.home.summary);
  const [body, setBody] = useState(buildDefaultCmsConfig().pages.home.body);
  const [ctaLabel, setCtaLabel] = useState(buildDefaultCmsConfig().pages.home.ctaLabel);
  const [ctaHref, setCtaHref] = useState(buildDefaultCmsConfig().pages.home.ctaHref);
  const [highlights, setHighlights] = useState(buildDefaultCmsConfig().pages.home.highlights);
  const [homeContent, setHomeContent] = useState(buildDefaultCmsConfig().pages.home.homeContent!);
  const [brandingLabel, setBrandingLabel] = useState(defaultCustomizationConfig.branding.logoText);
  const [brandingMark, setBrandingMark] = useState(defaultCustomizationConfig.branding.logoMark);
  const [trustBadgeKeys, setTrustBadgeKeys] = useState<string[]>(['sslLabel', 'auditLogsLabel', 'verifiedAdvertisersLabel']);
  const [statusIndicatorKeys, setStatusIndicatorKeys] = useState<string[]>(['systemStatusLabel', 'transparentPayoutLabel', 'certificationsLabel']);

  const { data: liveCampaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ['home-campaigns'],
    queryFn: listCampaigns,
  });

  useEffect(() => {
    void listCmsConfig()
      .then((config) => {
        const home = config.pages.home;
        setSiteName(config.siteName);
        setFeaturedItems(home.items);
        setHeadline(home.title);
        setSummary(home.summary);
        setBody(home.body);
        setCtaLabel(home.ctaLabel);
        setCtaHref(home.ctaHref);
        setHighlights(home.highlights);
        setHomeContent(home.homeContent ?? buildDefaultCmsConfig().pages.home.homeContent!);
      })
      .catch(() => {
        const fallback = buildDefaultCmsConfig();
        setSiteName(fallback.siteName);
        setFeaturedItems(fallback.pages.home.items);
        setHeadline(fallback.pages.home.title);
        setSummary(fallback.pages.home.summary);
        setBody(fallback.pages.home.body);
        setCtaLabel(fallback.pages.home.ctaLabel);
        setCtaHref(fallback.pages.home.ctaHref);
        setHighlights(fallback.pages.home.highlights);
        setHomeContent(fallback.pages.home.homeContent!);
      });

    void listAdminConsoleConfig()
      .then((config) => {
        const customization = config.customization ?? defaultCustomizationConfig;
        setBrandingLabel(customization.branding.logoText);
        setBrandingMark(customization.branding.logoMark);

        const badges = [
          customization.trust.sslSecurityIndicators ? 'sslLabel' : null,
          customization.trust.verifiedAdvertiserBadges ? 'verifiedAdvertisersLabel' : null,
          customization.trust.verifiedUserBadges ? 'verifiedUsersLabel' : null,
          customization.trust.auditLogs ? 'auditLogsLabel' : null,
        ].filter((entry): entry is string => Boolean(entry));

        const indicators = [
          customization.trust.realTimeStatistics ? 'realTimeStatisticsLabel' : null,
          customization.trust.transparentPayoutHistory ? 'transparentPayoutLabel' : null,
          customization.trust.systemStatusIndicators ? 'systemStatusLabel' : null,
          customization.trust.professionalCertifications ? 'certificationsLabel' : null,
        ].filter((entry): entry is string => Boolean(entry));

        setTrustBadgeKeys(badges.length ? badges : ['trustFallbackLabel']);
        setStatusIndicatorKeys(indicators.length ? indicators : ['operationsFallbackLabel']);
      })
      .catch(() => {
        setBrandingLabel(defaultCustomizationConfig.branding.logoText);
        setBrandingMark(defaultCustomizationConfig.branding.logoMark);
      });
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const { header, hero, trustedAdvertisers, trustMetrics, steps, testimonials, security, faq, pricing, sections, footer } = homeContent;
  const trustBadges = trustBadgeKeys.map((key) => hero[key]);
  const statusIndicators = statusIndicatorKeys.map((key) => hero[key]);

  const featuredCampaigns = useMemo(
    () =>
      (liveCampaigns.length
        ? liveCampaigns.slice(0, 6).map((campaign) => ({
            title: campaign.title,
            body: campaign.description ?? campaign.instructions,
            meta: campaign.campaignType.replace(/_/g, ' '),
          }))
        : featuredItems
      ).filter((item) => [item.title, item.body, item.meta ?? ''].some((field) => field.toLowerCase().includes(normalizedQuery))),
    [featuredItems, liveCampaigns, normalizedQuery],
  );

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-hero text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(circle_at_top,hsl(var(--color-accent)_/_0.18),transparent_42%),radial-gradient(circle_at_30%_20%,hsl(var(--color-success)_/_0.12),transparent_30%)]" />

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3 rounded-xl px-2 py-1 transition hover:bg-surface-elevated">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-accent text-sm font-bold text-accent-foreground">{brandingMark}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{brandingLabel || siteName}</p>
              <p className="text-xs text-muted">{header.tagline}</p>
            </div>
          </Link>

          <div className="hidden flex-1 items-center justify-center lg:flex">
            <label className="w-full max-w-lg">
              <span className="sr-only">{header.quickSearchAccessibleLabel}</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={header.searchPlaceholder}
                className="input-base w-full bg-surface-elevated/80"
              />
            </label>
          </div>

          <nav className="hidden items-center gap-2 xl:flex" aria-label={header.primaryNavLabel}>
            <Link to="#benefits" className="rounded-full px-3 py-2 text-sm text-muted transition hover:bg-surface-elevated hover:text-foreground">
              {header.benefitsLabel}
            </Link>
            <Link to="#how-it-works" className="rounded-full px-3 py-2 text-sm text-muted transition hover:bg-surface-elevated hover:text-foreground">
              {header.howItWorksLabel}
            </Link>
            <Link to="#security" className="rounded-full px-3 py-2 text-sm text-muted transition hover:bg-surface-elevated hover:text-foreground">
              {header.securityLabel}
            </Link>
            <Link to="#faq" className="rounded-full px-3 py-2 text-sm text-muted transition hover:bg-surface-elevated hover:text-foreground">
              {header.faqLabel}
            </Link>
          </nav>

          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <Link
              to="/help-center"
              className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent"
            >
              {header.notificationsLabel}
            </Link>
            <details className="relative">
              <summary className="list-none cursor-pointer rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                {header.profileLabel}
              </summary>
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-border bg-surface p-2 shadow-2xl shadow-black/25">
                <Link to="/login" className="block rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-surface-elevated">
                  {header.loginLabel}
                </Link>
                <Link to="/signup" className="block rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-surface-elevated">
                  {header.signupLabel}
                </Link>
                <Link to="/business" className="block rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-surface-elevated">
                  {header.businessLabel}
                </Link>
              </div>
            </details>
          </div>

          <details className="relative ml-auto sm:hidden">
            <summary className="list-none cursor-pointer rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
              {header.menuLabel}
            </summary>
            <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-border bg-surface p-3 shadow-2xl shadow-black/25">
              <label className="block">
                <span className="sr-only">{header.quickSearchAccessibleLabel}</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={header.mobileSearchPlaceholder}
                  className="input-base w-full"
                />
              </label>
              <div className="mt-3 grid gap-1">
                <Link to="#benefits" className="rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-surface-elevated">
                  {header.benefitsLabel}
                </Link>
                <Link to="#how-it-works" className="rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-surface-elevated">
                  {header.howItWorksLabel}
                </Link>
                <Link to="#campaigns" className="rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-surface-elevated">
                  {header.campaignsLabel}
                </Link>
                <Link to="#security" className="rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-surface-elevated">
                  {header.securityLabel}
                </Link>
                <Link to="/login" className="rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-surface-elevated">
                  {header.profileMenuLabel}
                </Link>
              </div>
            </div>
          </details>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8 lg:pb-16">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-6">
            <Badge tone="accent">{hero.badge}</Badge>
            <div className="flex flex-wrap gap-2">
              <span className="semantic-chip">{brandingLabel}</span>
              <span className="semantic-chip">{brandingMark} {hero.logoSystemSuffix}</span>
              {statusIndicators.slice(0, 2).map((indicator) => (
                <span key={indicator} className="semantic-chip">
                  {indicator}
                </span>
              ))}
            </div>
            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">{headline}</h1>
              <p className="max-w-3xl text-lg leading-8 text-foreground/82">{summary}</p>
              <p className="max-w-3xl text-base leading-7 text-muted">{body}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link to={ctaHref} className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:bg-accent-strong">
                {ctaLabel}
              </Link>
              <Link to="#campaigns" className="rounded-full border border-border bg-surface-elevated px-5 py-3 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                {hero.browseCampaignsLabel}
              </Link>
              <Link to="/help-center" className="rounded-full border border-border bg-transparent px-5 py-3 text-sm text-foreground transition hover:border-accent/40 hover:bg-surface-elevated">
                {hero.howItWorksLabel}
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {trustMetrics.map((metric) => (
                <Card key={metric.label} className="border border-border/80 bg-surface/85 p-4">
                  <p className="text-sm text-muted">{metric.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{metric.value}</p>
                </Card>
              ))}
            </div>

            <div className="rounded-3xl border border-border bg-surface/75 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-muted">{hero.trustedAdvertisersLabel}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {trustedAdvertisers.map((advertiser) => (
                  <span key={advertiser} className="rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-sm text-foreground">
                    {advertiser}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {trustBadges.map((badge) => (
                  <span key={badge} className="semantic-chip">
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <Card className="relative overflow-hidden border border-border/80 bg-[linear-gradient(180deg,hsl(var(--color-surface-elevated))_0%,hsl(var(--color-surface))_100%)] p-0 shadow-2xl shadow-black/30">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--color-accent)_/_0.16),transparent_40%),radial-gradient(circle_at_bottom_left,hsl(var(--color-success)_/_0.14),transparent_38%)]" />
            <div className="relative grid gap-4 p-6 sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted">{hero.quickSearchLabel}</p>
                  <p className="mt-1 text-sm text-foreground/80">{hero.quickSearchDescription}</p>
                </div>
                <Badge tone={normalizedQuery ? 'success' : 'neutral'}>{normalizedQuery ? `${featuredCampaigns.length} ${hero.matchesSuffix}` : campaignsLoading ? hero.loadingCampaignsLabel : hero.livePreviewLabel}</Badge>
              </div>

              <label className="block">
                <span className="sr-only">{hero.searchAccessibleLabel}</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={hero.searchPlaceholder}
                  className="input-base bg-surface-elevated/80"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                {highlights.map((highlight) => (
                  <div key={highlight} className="rounded-2xl border border-border bg-surface/80 p-4 text-sm text-foreground/85 transition duration-200 hover:-translate-y-0.5 hover:border-accent/40">
                    {highlight}
                  </div>
                ))}
              </div>

              <div className="rounded-3xl border border-border bg-surface/80 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-muted">{hero.featuredCampaignsLabel}</p>
                <div id="campaigns" className="mt-4 grid gap-3">
                  {featuredCampaigns.length ? (
                    featuredCampaigns.slice(0, 3).map((item) => (
                      <div key={`${item.title}-${item.meta ?? 'campaign'}`} className="rounded-2xl border border-border bg-surface-elevated p-4 transition duration-200 hover:-translate-y-0.5 hover:border-accent/40">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-muted">{item.meta ?? hero.campaignFallbackLabel}</p>
                            <h2 className="mt-2 text-lg font-semibold text-foreground">{item.title}</h2>
                          </div>
                          <Badge tone="info">{hero.featuredLabel}</Badge>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-muted">{item.body}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border bg-surface/70 p-6 text-center text-sm text-muted">
                      {campaignsLoading ? hero.loadingEmptyMessage : hero.emptyMessage}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section id="benefits" className="mt-16 scroll-mt-24 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Badge tone="accent">{sections.benefitsBadge}</Badge>
              <h2 className="mt-3 text-3xl font-semibold text-foreground">{sections.benefitsTitle}</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-muted">
              {sections.benefitsDescription}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <Card key={step.title} className="border border-border/80 bg-surface/85 p-6 transition duration-300 hover:-translate-y-1 hover:border-accent/40">
                <p className="text-xs uppercase tracking-[0.28em] text-muted">0{index + 1}</p>
                <h3 className="mt-3 text-xl font-semibold text-foreground">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted">{step.description}</p>
              </Card>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="mt-16 scroll-mt-24 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="border border-border/80 bg-surface/85 p-6">
            <Badge tone="success">{sections.howBadge}</Badge>
            <h2 className="mt-4 text-3xl font-semibold text-foreground">{sections.howTitle}</h2>
            <p className="mt-4 text-sm leading-7 text-muted">
              {sections.howDescription}
            </p>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            {steps.map((step, index) => (
              <Card key={`${step.title}-compact`} className="border border-border/80 bg-surface/80 p-5">
                <div className="flex items-center justify-between gap-3">
                  <Badge tone="neutral">{sections.stepPrefix} {index + 1}</Badge>
                  <span className="text-xs uppercase tracking-[0.22em] text-muted">{index === 2 ? sections.resultsLabel : sections.actionLabel}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{step.description}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-2">
          <Card className="border border-border/80 bg-surface/85 p-6">
            <Badge tone="info">{sections.testimonialsBadge}</Badge>
            <div className="mt-4 grid gap-4">
              {testimonials.map((testimonial) => (
                <blockquote key={testimonial.name} className="rounded-2xl border border-border bg-surface-elevated p-5">
                  <p className="text-sm leading-7 text-foreground/85">“{testimonial.quote}”</p>
                  <footer className="mt-4 text-sm">
                    <p className="font-medium text-foreground">{testimonial.name}</p>
                    <p className="text-muted">{testimonial.role}</p>
                  </footer>
                </blockquote>
              ))}
            </div>
          </Card>

          <Card id="security" className="border border-border/80 bg-surface/85 p-6 scroll-mt-24">
            <Badge tone="success">{security.badge}</Badge>
            <h2 className="mt-4 text-3xl font-semibold text-foreground">{security.title}</h2>
            <p className="mt-4 text-sm leading-7 text-muted">
              {security.description}
            </p>
            <ul className="mt-5 grid gap-3">
              {security.points.map((point) => (
                <li key={point} className="rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm text-foreground/85">
                  {point}
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section id="faq" className="mt-16 scroll-mt-24">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <Badge tone="neutral">{faq.badge}</Badge>
              <h2 className="mt-3 text-3xl font-semibold text-foreground">{faq.title}</h2>
            </div>
            <Link to={faq.linkHref} className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
              {faq.linkLabel}
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {faq.items.map((item) => (
              <Card key={item.question} className="border border-border/80 bg-surface/85 p-6">
                <h3 className="text-lg font-semibold text-foreground">{item.question}</h3>
                <p className="mt-3 text-sm leading-7 text-muted">{item.answer}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <Badge tone="accent">{pricing.badge}</Badge>
              <h2 className="mt-3 text-3xl font-semibold text-foreground">{pricing.title}</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-muted">{pricing.description}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {pricing.tiers.map((tier) => (
              <Card key={tier.name} className="border border-border/80 bg-surface/85 p-6 transition duration-300 hover:-translate-y-1 hover:border-accent/40">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-semibold text-foreground">{tier.name}</h3>
                    <p className="mt-2 text-sm leading-7 text-muted">{tier.description}</p>
                  </div>
                  <p className="text-3xl font-semibold text-foreground">{tier.price}</p>
                </div>
                <ul className="mt-5 grid gap-3 text-sm text-muted">
                  {tier.features.map((feature) => (
                    <li key={feature} className="rounded-xl border border-border bg-surface-elevated px-4 py-3 text-foreground/85">
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link to={tier.ctaHref} className="mt-6 inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:bg-accent-strong">
                  {tier.ctaLabel}
                </Link>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <Card className="border border-border/80 bg-[linear-gradient(135deg,hsl(var(--color-surface-elevated))_0%,hsl(var(--color-surface))_100%)] p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <Badge tone="accent">{sections.finalBadge}</Badge>
                <h2 className="mt-4 max-w-2xl text-3xl font-semibold text-foreground">{sections.finalTitle}</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
                  {sections.finalDescription}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to={ctaHref} className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:bg-accent-strong">
                  {ctaLabel}
                </Link>
                <Link to="/login" className="rounded-full border border-border bg-surface-elevated px-5 py-3 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                  {sections.finalLoginLabel}
                </Link>
              </div>
            </div>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-background/90 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold text-foreground">{siteName}</p>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
              {footer.description}
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:justify-end">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted">{footer.companyLabel}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link to="/about" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                  {footer.aboutLabel}
                </Link>
                <Link to="/contact" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                  {footer.contactLabel}
                </Link>
                <Link to="/news" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                  {footer.newsLabel}
                </Link>
                <Link to="/announcements" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                  {footer.announcementsLabel}
                </Link>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted">{footer.seoRoutingLabel}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link to="/seo" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                  {footer.seoLabel}
                </Link>
                <Link to="/meta-tags" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                  {footer.metaTagsLabel}
                </Link>
                <Link to="/open-graph" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                  {footer.openGraphLabel}
                </Link>
                <Link to="/sitemap" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                  {footer.sitemapLabel}
                </Link>
                <Link to="/robots" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                  {footer.robotsLabel}
                </Link>
                <Link to="/custom-urls" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                  {footer.customUrlsLabel}
                </Link>
              </div>
            </div>

            <div className="sm:col-span-2 flex flex-wrap gap-3 lg:justify-end">
              <Link to="/privacy-policy" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                {footer.privacyLabel}
              </Link>
              <Link to="/terms" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                {footer.termsLabel}
              </Link>
              <Link to="/help-center" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                {footer.helpCenterLabel}
              </Link>
              <Link to="/blog" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                {footer.blogLabel}
              </Link>
            </div>
          </div>
        </div>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/90 px-4 py-3 backdrop-blur-xl sm:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <Link to="/" className="flex-1 rounded-full border border-border bg-surface-elevated px-4 py-3 text-center text-sm font-medium text-foreground">
            {footer.mobileHomeLabel}
          </Link>
          <Link to="#campaigns" className="flex-1 rounded-full border border-border bg-surface-elevated px-4 py-3 text-center text-sm font-medium text-foreground">
            {footer.mobileCampaignsLabel}
          </Link>
          <Link to="/signup" className="flex-1 rounded-full bg-accent px-4 py-3 text-center text-sm font-semibold text-accent-foreground">
            {footer.mobileStartLabel}
          </Link>
        </div>
      </div>

      <Link
        to="/signup"
        className="fixed bottom-20 right-4 z-50 grid h-14 w-14 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground shadow-2xl shadow-black/35 transition hover:bg-accent-strong sm:hidden"
        aria-label={footer.startAriaLabel}
      >
        +
      </Link>
    </div>
  );
}
