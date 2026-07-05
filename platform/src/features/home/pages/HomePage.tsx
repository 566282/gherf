import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/DesignSystem';
import { buildDefaultCmsConfig, listCmsConfig } from '@/services/api/cms';
import { defaultCustomizationConfig } from '@/lib/customization';
import { listAdminConsoleConfig } from '@/services/api/admin';

const trustedAdvertisers = ['Northstar Capital', 'Harbor Health', 'BrightEdge Retail', 'Atlas Energy', 'Summit Finance', 'Pulse Media'];

const trustMetrics = [
  { label: 'Campaigns launched', value: '1,240+' },
  { label: 'Average approval time', value: '< 24 hrs' },
  { label: 'User satisfaction', value: '4.9/5' },
  { label: 'Policy coverage', value: '99.8%' },
];

const steps = [
  { title: 'Set up in minutes', description: 'Create a business profile, confirm compliance requirements, and publish a campaign brief.' },
  { title: 'Launch with confidence', description: 'Review approvals, budgets, and creative assets in one predictable workflow.' },
  { title: 'Track outcomes clearly', description: 'Monitor engagement, rewards, and support signals without chasing spreadsheets.' },
];

const testimonials = [
  {
    quote: 'The homepage made the platform feel credible from the first screen. We knew exactly where to start.',
    name: 'Maya Chen',
    role: 'Growth Director, BrightEdge Retail',
  },
  {
    quote: 'Fast navigation, clear proof points, and a simple onboarding path reduced friction for our team.',
    name: 'Dylan Brooks',
    role: 'Partnership Lead, Atlas Energy',
  },
];

const securityPoints = [
  'Role-based access controls for each workspace',
  'Audit trails for campaign and content updates',
  'Transparent policy pages and public help content',
  'Mobile-friendly flows with clear error recovery',
];

const faqs = [
  {
    question: 'How quickly can a campaign go live?',
    answer: 'Most teams can move from setup to review within a single working session, then launch as soon as approvals are complete.',
  },
  {
    question: 'Can administrators update the homepage copy?',
    answer: 'Yes. The homepage content remains CMS-driven, so teams can adjust the headline, summary, and featured items without code changes.',
  },
  {
    question: 'Does the experience work well on mobile?',
    answer: 'The layout is responsive, touch-friendly, and built to keep the primary actions visible without extra tapping.',
  },
  {
    question: 'What content can the CMS manage?',
    answer: 'The CMS now covers the homepage, about, FAQ, contact, news, announcements, help center, legal pages, blog, SEO metadata, sitemap rules, robots rules, custom URLs, landing pages, advertiser pages, and user guides.',
  },
];

const pricingTiers = [
  {
    name: 'Starter',
    price: '$0',
    description: 'For teams evaluating a launch or preparing a first campaign.',
    features: ['Landing page access', 'Basic campaign setup', 'Support documentation'],
    ctaLabel: 'Create account',
    ctaHref: '/signup',
  },
  {
    name: 'Growth',
    price: 'Custom',
    description: 'For advertisers who need repeatable launches and faster approvals.',
    features: ['Campaign workflows', 'Reporting visibility', 'Priority support'],
    ctaLabel: 'Talk to sales',
    ctaHref: '/business',
  },
];

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
  const [brandingLabel, setBrandingLabel] = useState(defaultCustomizationConfig.branding.logoText);
  const [brandingMark, setBrandingMark] = useState(defaultCustomizationConfig.branding.logoMark);
  const [trustBadges, setTrustBadges] = useState<string[]>(['SSL verified', 'Audit logs', 'Verified advertisers']);
  const [statusIndicators, setStatusIndicators] = useState<string[]>(['System status live', 'Transparent payout history', 'Professional certification ready']);

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
      });

    void listAdminConsoleConfig()
      .then((config) => {
        const customization = config.customization ?? defaultCustomizationConfig;
        setBrandingLabel(customization.branding.logoText);
        setBrandingMark(customization.branding.logoMark);

        const badges = [
          customization.trust.sslSecurityIndicators ? 'SSL verified' : null,
          customization.trust.verifiedAdvertiserBadges ? 'Verified advertisers' : null,
          customization.trust.verifiedUserBadges ? 'Verified users' : null,
          customization.trust.auditLogs ? 'Audit logs' : null,
        ].filter((entry): entry is string => Boolean(entry));

        const indicators = [
          customization.trust.realTimeStatistics ? 'Real-time statistics' : null,
          customization.trust.transparentPayoutHistory ? 'Transparent payout history' : null,
          customization.trust.systemStatusIndicators ? 'System status indicators' : null,
          customization.trust.professionalCertifications ? 'Professional certifications' : null,
        ].filter((entry): entry is string => Boolean(entry));

        setTrustBadges(badges.length ? badges : ['Trust controls enabled']);
        setStatusIndicators(indicators.length ? indicators : ['Operations monitored']);
      })
      .catch(() => {
        setBrandingLabel(defaultCustomizationConfig.branding.logoText);
        setBrandingMark(defaultCustomizationConfig.branding.logoMark);
      });
  }, []);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredCampaigns = useMemo(
    () =>
      featuredItems.filter((item) => {
        if (!normalizedQuery) {
          return true;
        }

        return [item.title, item.body, item.meta ?? ''].some((field) => field.toLowerCase().includes(normalizedQuery));
      }),
    [featuredItems, normalizedQuery],
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
              <p className="text-xs text-muted">Trust-first growth platform</p>
            </div>
          </Link>

          <div className="hidden flex-1 items-center justify-center lg:flex">
            <label className="w-full max-w-lg">
              <span className="sr-only">Quick search</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Quick search campaigns, features, or help"
                className="input-base w-full bg-surface-elevated/80"
              />
            </label>
          </div>

          <nav className="hidden items-center gap-2 xl:flex" aria-label="Primary">
            <Link to="#benefits" className="rounded-full px-3 py-2 text-sm text-muted transition hover:bg-surface-elevated hover:text-foreground">
              Benefits
            </Link>
            <Link to="#how-it-works" className="rounded-full px-3 py-2 text-sm text-muted transition hover:bg-surface-elevated hover:text-foreground">
              How it works
            </Link>
            <Link to="#security" className="rounded-full px-3 py-2 text-sm text-muted transition hover:bg-surface-elevated hover:text-foreground">
              Security
            </Link>
            <Link to="#faq" className="rounded-full px-3 py-2 text-sm text-muted transition hover:bg-surface-elevated hover:text-foreground">
              FAQ
            </Link>
          </nav>

          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <Link
              to="/help-center"
              className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent"
            >
              Notifications
            </Link>
            <details className="relative">
              <summary className="list-none cursor-pointer rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                Profile
              </summary>
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-border bg-surface p-2 shadow-2xl shadow-black/25">
                <Link to="/login" className="block rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-surface-elevated">
                  Log in
                </Link>
                <Link to="/signup" className="block rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-surface-elevated">
                  Create account
                </Link>
                <Link to="/business" className="block rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-surface-elevated">
                  Business dashboard
                </Link>
              </div>
            </details>
          </div>

          <details className="relative ml-auto sm:hidden">
            <summary className="list-none cursor-pointer rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
              Menu
            </summary>
            <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-border bg-surface p-3 shadow-2xl shadow-black/25">
              <label className="block">
                <span className="sr-only">Quick search</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search campaigns or help"
                  className="input-base w-full"
                />
              </label>
              <div className="mt-3 grid gap-1">
                <Link to="#benefits" className="rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-surface-elevated">
                  Benefits
                </Link>
                <Link to="#how-it-works" className="rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-surface-elevated">
                  How it works
                </Link>
                <Link to="#campaigns" className="rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-surface-elevated">
                  Featured campaigns
                </Link>
                <Link to="#security" className="rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-surface-elevated">
                  Security
                </Link>
                <Link to="/login" className="rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-surface-elevated">
                  Profile menu
                </Link>
              </div>
            </div>
          </details>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8 lg:pb-16">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-6">
            <Badge tone="accent">Trusted platform</Badge>
            <div className="flex flex-wrap gap-2">
              <span className="semantic-chip">{brandingLabel}</span>
              <span className="semantic-chip">{brandingMark} logo system</span>
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
                Browse campaigns
              </Link>
              <Link to="/help-center" className="rounded-full border border-border bg-transparent px-5 py-3 text-sm text-foreground transition hover:border-accent/40 hover:bg-surface-elevated">
                How it works
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
              <p className="text-xs uppercase tracking-[0.3em] text-muted">Trusted advertisers</p>
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
                  <p className="text-xs uppercase tracking-[0.3em] text-muted">Quick search</p>
                  <p className="mt-1 text-sm text-foreground/80">Filter featured campaigns instantly.</p>
                </div>
                <Badge tone={normalizedQuery ? 'success' : 'neutral'}>{normalizedQuery ? `${filteredCampaigns.length} matches` : 'Live preview'}</Badge>
              </div>

              <label className="block">
                <span className="sr-only">Search featured campaigns</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search featured campaigns"
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
                <p className="text-xs uppercase tracking-[0.3em] text-muted">Featured campaigns</p>
                <div id="campaigns" className="mt-4 grid gap-3">
                  {filteredCampaigns.length ? (
                    filteredCampaigns.slice(0, 3).map((item) => (
                      <div key={`${item.title}-${item.meta ?? 'campaign'}`} className="rounded-2xl border border-border bg-surface-elevated p-4 transition duration-200 hover:-translate-y-0.5 hover:border-accent/40">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-muted">{item.meta ?? 'Campaign'}</p>
                            <h2 className="mt-2 text-lg font-semibold text-foreground">{item.title}</h2>
                          </div>
                          <Badge tone="info">Featured</Badge>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-muted">{item.body}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border bg-surface/70 p-6 text-center text-sm text-muted">
                      No campaigns match that search. Try a broader term or clear the query.
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
              <Badge tone="accent">Benefits</Badge>
              <h2 className="mt-3 text-3xl font-semibold text-foreground">Simple flows, fewer clicks, clearer outcomes.</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-muted">
              The product surface is organized to reduce cognitive load, show status early, and keep the next action obvious.
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
            <Badge tone="success">How it works</Badge>
            <h2 className="mt-4 text-3xl font-semibold text-foreground">A guided onboarding path from first visit to first result.</h2>
            <p className="mt-4 text-sm leading-7 text-muted">
              The homepage immediately frames the platform as secure, efficient, and easy to navigate, then gives visitors one obvious route into the product.
            </p>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            {steps.map((step, index) => (
              <Card key={`${step.title}-compact`} className="border border-border/80 bg-surface/80 p-5">
                <div className="flex items-center justify-between gap-3">
                  <Badge tone="neutral">Step {index + 1}</Badge>
                  <span className="text-xs uppercase tracking-[0.22em] text-muted">{index === 2 ? 'Results' : 'Action'}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{step.description}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-2">
          <Card className="border border-border/80 bg-surface/85 p-6">
            <Badge tone="info">Testimonials</Badge>
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
            <Badge tone="success">Security</Badge>
            <h2 className="mt-4 text-3xl font-semibold text-foreground">Trust is built into the first page.</h2>
            <p className="mt-4 text-sm leading-7 text-muted">
              Public content is explicit about access, governance, and support, so users do not have to guess how the platform behaves.
            </p>
            <ul className="mt-5 grid gap-3">
              {securityPoints.map((point) => (
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
              <Badge tone="neutral">Frequently asked questions</Badge>
              <h2 className="mt-3 text-3xl font-semibold text-foreground">Short answers for faster decisions.</h2>
            </div>
            <Link to="/help-center" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
              View help center
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {faqs.map((faq) => (
              <Card key={faq.question} className="border border-border/80 bg-surface/85 p-6">
                <h3 className="text-lg font-semibold text-foreground">{faq.question}</h3>
                <p className="mt-3 text-sm leading-7 text-muted">{faq.answer}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <Badge tone="accent">Pricing</Badge>
              <h2 className="mt-3 text-3xl font-semibold text-foreground">Flexible options that keep the next step obvious.</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-muted">If pricing is not relevant for a visitor, the copy still points them toward the right action without burying the page.</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {pricingTiers.map((tier) => (
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
                <Badge tone="accent">Call to action</Badge>
                <h2 className="mt-4 max-w-2xl text-3xl font-semibold text-foreground">Start with a simple next step and move faster from there.</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
                  The homepage keeps the decision path short: review the trust signals, search what you need, and choose the right entry point in a single click.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to={ctaHref} className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:bg-accent-strong">
                  {ctaLabel}
                </Link>
                <Link to="/login" className="rounded-full border border-border bg-surface-elevated px-5 py-3 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                  Log in
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
              A secure, easy-to-navigate platform for advertisers and users, with public pages designed to lower friction and build trust quickly.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:justify-end">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted">Company</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link to="/about" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                  About
                </Link>
                <Link to="/contact" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                  Contact
                </Link>
                <Link to="/news" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                  News
                </Link>
                <Link to="/announcements" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                  Announcements
                </Link>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted">SEO and routing</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link to="/seo" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                  SEO
                </Link>
                <Link to="/meta-tags" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                  Meta Tags
                </Link>
                <Link to="/open-graph" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                  Open Graph
                </Link>
                <Link to="/sitemap" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                  Sitemap
                </Link>
                <Link to="/robots" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                  Robots
                </Link>
                <Link to="/custom-urls" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                  Custom URLs
                </Link>
              </div>
            </div>

            <div className="sm:col-span-2 flex flex-wrap gap-3 lg:justify-end">
              <Link to="/privacy-policy" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                Privacy
              </Link>
              <Link to="/terms" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                Terms
              </Link>
              <Link to="/help-center" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                Help center
              </Link>
              <Link to="/blog" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                Blog
              </Link>
            </div>
          </div>
        </div>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/90 px-4 py-3 backdrop-blur-xl sm:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <Link to="/" className="flex-1 rounded-full border border-border bg-surface-elevated px-4 py-3 text-center text-sm font-medium text-foreground">
            Home
          </Link>
          <Link to="#campaigns" className="flex-1 rounded-full border border-border bg-surface-elevated px-4 py-3 text-center text-sm font-medium text-foreground">
            Campaigns
          </Link>
          <Link to="/signup" className="flex-1 rounded-full bg-accent px-4 py-3 text-center text-sm font-semibold text-accent-foreground">
            Start
          </Link>
        </div>
      </div>

      <Link
        to="/signup"
        className="fixed bottom-20 right-4 z-50 grid h-14 w-14 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground shadow-2xl shadow-black/35 transition hover:bg-accent-strong sm:hidden"
        aria-label="Start now"
      >
        +
      </Link>
    </div>
  );
}
