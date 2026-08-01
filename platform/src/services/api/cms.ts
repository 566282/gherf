import { supabase } from '@/services/supabase/client';
import type {
  CmsCustomPage,
  CmsCustomPageBlock,
  CmsConfig,
  CmsContentItem,
  CmsDocumentState,
  CmsHomeContent,
  CmsOperationalSnapshot,
  CmsPageContent,
  CmsPageKey,
  CmsPublicationStatus,
  CmsRevision,
  CmsPricingTableBlock,
  CmsReusableBlockKey,
} from '@/types';

type SettingRow = {
  key: string;
  value: unknown;
};

const CMS_SETTING_KEY = 'cms_content_config';

const pageLabels: Record<CmsPageKey, string> = {
  home: 'Homepage',
  faqs: 'FAQs',
  about: 'About',
  contact: 'Contact',
  news: 'News',
  announcements: 'Announcements',
  'help-center': 'Help Center',
  'privacy-policy': 'Privacy Policy',
  terms: 'Terms',
  blog: 'Blog',
  seo: 'SEO',
  'meta-tags': 'Meta Tags',
  'open-graph': 'Open Graph',
  sitemap: 'Sitemap',
  robots: 'Robots',
  'custom-urls': 'Custom URLs',
  'landing-pages': 'Landing pages',
  'advertiser-pages': 'Advertiser pages',
  'user-guides': 'User guides',
};

export const cmsPageKeys = Object.keys(pageLabels) as CmsPageKey[];

const defaultItems: Record<CmsPageKey, CmsContentItem[]> = {
  home: [
    { title: 'Premium advertiser controls', body: 'Launch and optimize campaigns with clear spend governance, brand-safe approvals, and fast execution.', meta: 'Trust' },
    { title: 'Rewarding user experiences', body: 'Keep the experience clean, mobile-first, and intuitive so engagement feels polished instead of gimmicky.', meta: 'Engagement' },
    { title: 'Operational clarity', body: 'Finance, support, content, and compliance all run from one reliable operating system.', meta: 'Scale' },
  ],
  faqs: [
    { title: 'How does Go4Wealth work?', body: 'Advertisers launch high-trust campaigns, users complete guided actions, and the platform tracks rewards in a transparent flow.', meta: 'Product' },
    { title: 'Can administrators edit all site content?', body: 'Yes. Homepage copy, legal pages, blog content, landing pages, advertiser pages, and user guides are all managed from the admin CMS.', meta: 'CMS' },
    { title: 'Is the experience mobile-friendly?', body: 'The interface is built mobile-first with responsive layout, streamlined content blocks, and touch-friendly controls.', meta: 'UX' },
  ],
  about: [
    { title: 'Platform story', body: 'Tell the origin story, mission, and operating principles behind the product.', meta: 'Brand' },
    { title: 'Team and values', body: 'Introduce the people, values, and standards that shape the experience.', meta: 'Culture' },
    { title: 'Why trust us', body: 'Highlight security, transparency, and the controls that support the platform.', meta: 'Trust' },
  ],
  contact: [
    { title: 'Support channels', body: 'List support email, contact forms, and response expectations in one clear place.', meta: 'Support' },
    { title: 'Business inquiries', body: 'Share the best route for partnerships, sales, and media requests.', meta: 'Business' },
    { title: 'Office and hours', body: 'Publish operating hours, office details, and escalation contacts when needed.', meta: 'Info' },
  ],
  news: [
    { title: 'Product updates', body: 'Publish launch notes, feature rollouts, and platform improvements for readers.', meta: 'Release' },
    { title: 'Company updates', body: 'Share milestone announcements, partnerships, and organizational changes.', meta: 'Newsroom' },
    { title: 'Industry coverage', body: 'Capture commentary, press mentions, and relevant market developments.', meta: 'Media' },
  ],
  announcements: [
    { title: 'Maintenance notices', body: 'Communicate planned maintenance windows, outage updates, and release timing.', meta: 'Ops' },
    { title: 'Policy updates', body: 'Publish urgent policy changes or compliance notices in a visible format.', meta: 'Policy' },
    { title: 'Live alerts', body: 'Use short, timely notices for operational updates that need immediate attention.', meta: 'Alerts' },
  ],
  'help-center': [
    { title: 'Getting started', body: 'Learn how to create an account, verify your profile, and navigate the dashboards with confidence.', meta: 'Guide' },
    { title: 'Billing and payouts', body: 'Review balances, settlement timing, withdrawal policies, and payout methods in one place.', meta: 'Support' },
    { title: 'Security and compliance', body: 'Understand access controls, audit logs, content approvals, and review workflows.', meta: 'Trust' },
  ],
  'privacy-policy': [
    { title: 'Information we collect', body: 'We collect account, campaign, device, and usage information required to operate the platform.', meta: 'Policy' },
    { title: 'How we use information', body: 'Data is used to deliver services, prevent abuse, personalize experiences, and comply with legal obligations.', meta: 'Policy' },
    { title: 'Your rights and choices', body: 'Users can review account data, manage preferences, and request assistance through support channels.', meta: 'Policy' },
  ],
  terms: [
    { title: 'Eligibility and accounts', body: 'Accounts must be accurate and kept in good standing. Administrators may restrict access when policy rules require it.', meta: 'Agreement' },
    { title: 'Acceptable use', body: 'The platform should be used for lawful, transparent campaign activity that respects audience expectations.', meta: 'Agreement' },
    { title: 'Service changes', body: 'We may update features, pricing, or content policies as the platform evolves and compliance requirements change.', meta: 'Agreement' },
  ],
  blog: [
    { title: 'Designing trustworthy acquisition flows', body: 'Premium fintech-style UX can raise conversion while protecting brand confidence and reducing friction.', meta: '2026-07-03' },
    { title: 'Why content governance matters', body: 'When legal pages, landing pages, and help content are editable in one place, teams move faster without losing control.', meta: 'Editorial' },
    { title: 'Building for performance at scale', body: 'Fast public pages and efficient admin tooling keep the platform responsive as content grows.', meta: 'Performance' },
  ],
  seo: [
    { title: 'Search strategy', body: 'Define target keywords, page priorities, and search intent for the public site.', meta: 'SEO' },
    { title: 'Indexing rules', body: 'Document which pages should be discovered, indexed, or excluded by search engines.', meta: 'SEO' },
    { title: 'Performance signals', body: 'Track metadata, structured content, and page quality signals that affect visibility.', meta: 'SEO' },
  ],
  'meta-tags': [
    { title: 'Title templates', body: 'Create reusable title patterns for public pages and campaign pages.', meta: 'Metadata' },
    { title: 'Description copy', body: 'Manage concise metadata descriptions that support search and sharing snippets.', meta: 'Metadata' },
    { title: 'Canonical targets', body: 'Keep canonical URLs aligned with the preferred public route for each page.', meta: 'Metadata' },
  ],
  'open-graph': [
    { title: 'Social preview title', body: 'Set the title shown when pages are shared on social platforms.', meta: 'Sharing' },
    { title: 'Social preview image', body: 'Control the image displayed in link previews and embeds.', meta: 'Sharing' },
    { title: 'Share description', body: 'Write concise copy optimized for preview cards and messaging apps.', meta: 'Sharing' },
  ],
  sitemap: [
    { title: 'Public URLs', body: 'List the routes that should appear in the generated sitemap.', meta: 'Indexing' },
    { title: 'Priority rules', body: 'Tune priority and change frequency for major site sections.', meta: 'Indexing' },
    { title: 'Freshness checks', body: 'Keep sitemap entries aligned with current content and release cadence.', meta: 'Indexing' },
  ],
  robots: [
    { title: 'Crawler policy', body: 'Define which user agents can crawl the site and at what scope.', meta: 'Indexing' },
    { title: 'Disallow rules', body: 'Block sensitive routes, admin surfaces, and unfinished pages from indexing.', meta: 'Indexing' },
    { title: 'Sitemap reference', body: 'Publish the sitemap location so crawlers can find the current route map.', meta: 'Indexing' },
  ],
  'custom-urls': [
    { title: 'Redirect map', body: 'Document custom routes and redirects for marketing or legacy URLs.', meta: 'Routing' },
    { title: 'Friendly slugs', body: 'Keep public URLs short, readable, and aligned with content hierarchy.', meta: 'Routing' },
    { title: 'Campaign aliases', body: 'Provide alternate URLs for landing pages and seasonal campaign links.', meta: 'Routing' },
  ],
  'landing-pages': [
    { title: 'Campaign launch landing page', body: 'Hero-led conversion page for new advertiser campaigns with strong proof points and a single focused CTA.', meta: 'Template' },
    { title: 'Partner offer landing page', body: 'A polished acquisition page for sponsorships, promotions, and partner activations.', meta: 'Template' },
    { title: 'Seasonal promotion landing page', body: 'A flexible campaign page for time-sensitive offers, tuned for mobile conversion and fast iteration.', meta: 'Template' },
  ],
  'advertiser-pages': [
    { title: 'Advertiser onboarding', body: 'Explain the setup path, approval flow, and expectations before budgets go live.', meta: 'Advertiser' },
    { title: 'Creative and compliance', body: 'Show brand requirements, asset standards, and review expectations clearly and consistently.', meta: 'Advertiser' },
    { title: 'Performance reporting', body: 'Surface the metrics advertisers care about: spend, reach, engagement, and conversion quality.', meta: 'Advertiser' },
  ],
  'user-guides': [
    { title: 'How to complete your profile', body: 'Walk users through verification, profile setup, and first-login steps with clear guidance.', meta: 'Guide' },
    { title: 'How rewards are earned', body: 'Describe the task flow, timing, and eligibility rules in simple language.', meta: 'Guide' },
    { title: 'How withdrawals work', body: 'Explain minimums, processing times, and approval states without jargon.', meta: 'Guide' },
  ],
};

const defaultHomeContent: CmsHomeContent = {
  header: { tagline: 'Trust-first growth platform', primaryNavLabel: 'Primary', quickSearchAccessibleLabel: 'Quick search', searchPlaceholder: 'Quick search campaigns, features, or help', benefitsLabel: 'Benefits', howItWorksLabel: 'How it works', securityLabel: 'Security', faqLabel: 'FAQ', notificationsLabel: 'Notifications', profileLabel: 'Profile', loginLabel: 'Log in', signupLabel: 'Create account', businessLabel: 'Business dashboard', menuLabel: 'Menu', mobileSearchPlaceholder: 'Search campaigns or help', campaignsLabel: 'Featured campaigns', profileMenuLabel: 'Profile menu' },
  hero: { badge: 'Trusted platform', logoSystemSuffix: 'logo system', browseCampaignsLabel: 'Browse campaigns', howItWorksLabel: 'How it works', trustedAdvertisersLabel: 'Trusted advertisers', sslLabel: 'SSL verified', verifiedAdvertisersLabel: 'Verified advertisers', verifiedUsersLabel: 'Verified users', auditLogsLabel: 'Audit logs', trustFallbackLabel: 'Trust controls enabled', realTimeStatisticsLabel: 'Real-time statistics', transparentPayoutLabel: 'Transparent payout history', systemStatusLabel: 'System status indicators', certificationsLabel: 'Professional certifications', operationsFallbackLabel: 'Operations monitored', quickSearchLabel: 'Quick search', quickSearchDescription: 'Filter featured campaigns instantly.', livePreviewLabel: 'Live preview', loadingCampaignsLabel: 'Loading live campaigns', matchesSuffix: 'matches', searchAccessibleLabel: 'Search featured campaigns', searchPlaceholder: 'Search featured campaigns', featuredCampaignsLabel: 'Featured campaigns', campaignFallbackLabel: 'Campaign', featuredLabel: 'Featured', loadingEmptyMessage: 'Loading live campaigns from Supabase...', emptyMessage: 'No campaigns match that search. Try a broader term or clear the query.' },
  trustedAdvertisers: ['Northstar Capital', 'Harbor Health', 'BrightEdge Retail', 'Atlas Energy', 'Summit Finance', 'Pulse Media'],
  trustMetrics: [{ label: 'Campaigns launched', value: '1,240+' }, { label: 'Average approval time', value: '< 24 hrs' }, { label: 'User satisfaction', value: '4.9/5' }, { label: 'Policy coverage', value: '99.8%' }],
  steps: [{ title: 'Set up in minutes', description: 'Create a business profile, confirm compliance requirements, and publish a campaign brief.' }, { title: 'Launch with confidence', description: 'Review approvals, budgets, and creative assets in one predictable workflow.' }, { title: 'Track outcomes clearly', description: 'Monitor engagement, rewards, and support signals without chasing spreadsheets.' }],
  testimonials: [{ quote: 'The homepage made the platform feel credible from the first screen. We knew exactly where to start.', name: 'Maya Chen', role: 'Growth Director, BrightEdge Retail' }, { quote: 'Fast navigation, clear proof points, and a simple onboarding path reduced friction for our team.', name: 'Dylan Brooks', role: 'Partnership Lead, Atlas Energy' }],
  security: { badge: 'Security', title: 'Trust is built into the first page.', description: 'Public content is explicit about access, governance, and support, so users do not have to guess how the platform behaves.', points: ['Role-based access controls for each workspace', 'Audit trails for campaign and content updates', 'Transparent policy pages and public help content', 'Mobile-friendly flows with clear error recovery'] },
  faq: { badge: 'Frequently asked questions', title: 'Short answers for faster decisions.', linkLabel: 'View help center', linkHref: '/help-center', items: [{ question: 'How quickly can a campaign go live?', answer: 'Most teams can move from setup to review within a single working session, then launch as soon as approvals are complete.' }, { question: 'Can administrators update the homepage copy?', answer: 'Yes. The homepage content remains CMS-driven, so teams can adjust the headline, summary, and featured items without code changes.' }, { question: 'Does the experience work well on mobile?', answer: 'The layout is responsive, touch-friendly, and built to keep the primary actions visible without extra tapping.' }, { question: 'What content can the CMS manage?', answer: 'The CMS now covers the homepage, about, FAQ, contact, news, announcements, help center, legal pages, blog, SEO metadata, sitemap rules, robots rules, custom URLs, landing pages, advertiser pages, and user guides.' }] },
  pricing: { badge: 'Pricing', title: 'Flexible options that keep the next step obvious.', description: 'If pricing is not relevant for a visitor, the copy still points them toward the right action without burying the page.', tiers: [{ name: 'Starter', price: '$0', description: 'For teams evaluating a launch or preparing a first campaign.', features: ['Landing page access', 'Basic campaign setup', 'Support documentation'], ctaLabel: 'Create account', ctaHref: '/signup' }, { name: 'Growth', price: 'Custom', description: 'For advertisers who need repeatable launches and faster approvals.', features: ['Campaign workflows', 'Reporting visibility', 'Priority support'], ctaLabel: 'Talk to sales', ctaHref: '/business' }] },
  sections: { benefitsBadge: 'Benefits', benefitsTitle: 'Simple flows, fewer clicks, clearer outcomes.', benefitsDescription: 'The product surface is organized to reduce cognitive load, show status early, and keep the next action obvious.', howBadge: 'How it works', howTitle: 'A guided onboarding path from first visit to first result.', howDescription: 'The homepage immediately frames the platform as secure, efficient, and easy to navigate, then gives visitors one obvious route into the product.', stepPrefix: 'Step', actionLabel: 'Action', resultsLabel: 'Results', testimonialsBadge: 'Testimonials', finalBadge: 'Call to action', finalTitle: 'Start with a simple next step and move faster from there.', finalDescription: 'The homepage keeps the decision path short: review the trust signals, search what you need, and choose the right entry point in a single click.', finalLoginLabel: 'Log in' },
  footer: { description: 'A secure, easy-to-navigate platform for advertisers and users, with public pages designed to lower friction and build trust quickly.', companyLabel: 'Company', aboutLabel: 'About', contactLabel: 'Contact', newsLabel: 'News', announcementsLabel: 'Announcements', seoRoutingLabel: 'SEO and routing', seoLabel: 'SEO', metaTagsLabel: 'Meta Tags', openGraphLabel: 'Open Graph', sitemapLabel: 'Sitemap', robotsLabel: 'Robots', customUrlsLabel: 'Custom URLs', privacyLabel: 'Privacy', termsLabel: 'Terms', helpCenterLabel: 'Help center', blogLabel: 'Blog', mobileHomeLabel: 'Home', mobileCampaignsLabel: 'Campaigns', mobileStartLabel: 'Start', startAriaLabel: 'Start now' },
};

const defaultReusableBlocks: Record<CmsReusableBlockKey, CmsPricingTableBlock> = {
  pricingTable: defaultHomeContent.pricing,
};

const defaultCustomPages: CmsCustomPage[] = [];

const defaultPages: Record<CmsPageKey, CmsPageContent> = {
  home: {
    eyebrow: 'Go4Wealth / Premium Growth Platform',
    title: 'A trustworthy business marketing platform built for advertisers and engaged users.',
    summary: 'Go4Wealth brings campaign management, content governance, support, and rewards into one elegant operating system.',
    body: 'The experience is designed to feel secure, modern, and enterprise-grade from the very first interaction.',
    ctaLabel: 'Open business dashboard',
    ctaHref: '/business',
    highlights: ['Premium fintech-style UI', 'Fast mobile-first flows', 'Editable by administrators'],
    items: defaultItems.home,
    homeContent: defaultHomeContent,
  },
  faqs: {
    eyebrow: 'Knowledge base',
    title: 'Frequently asked questions for new users and advertisers.',
    summary: 'Clear answers reduce support load and help users move with confidence.',
    body: 'Use this page to surface the most important policy, product, and onboarding questions.',
    ctaLabel: 'Contact support',
    ctaHref: '/help-center',
    highlights: ['Simple answers', 'Policy clarity', 'Self-serve support'],
    items: defaultItems.faqs,
  },
  about: {
    eyebrow: 'Company',
    title: 'About the platform and the team behind it.',
    summary: 'Use this page to explain the mission, values, and trust model.',
    body: 'The about page is a good place for the origin story, leadership message, and proof points.',
    ctaLabel: 'Contact us',
    ctaHref: '/contact',
    highlights: ['Mission driven', 'Team story', 'Trust signals'],
    items: defaultItems.about,
  },
  contact: {
    eyebrow: 'Support',
    title: 'Contact information and support pathways.',
    summary: 'Keep business, support, and media contact details easy to find.',
    body: 'This page can host contact forms, help email addresses, and routing guidance for different requests.',
    ctaLabel: 'Open help center',
    ctaHref: '/help-center',
    highlights: ['Fast response paths', 'Business inquiries', 'Support routing'],
    items: defaultItems.contact,
  },
  news: {
    eyebrow: 'Newsroom',
    title: 'News and product updates from the platform team.',
    summary: 'Use this page for announcements, release notes, and company news.',
    body: 'The newsroom keeps public updates organized so readers can scan the latest changes quickly.',
    ctaLabel: 'Read announcements',
    ctaHref: '/announcements',
    highlights: ['Release notes', 'Company updates', 'Media-ready copy'],
    items: defaultItems.news,
  },
  announcements: {
    eyebrow: 'Live updates',
    title: 'Announcements for urgent and time-sensitive updates.',
    summary: 'Use this page for maintenance notices, policy changes, and live alerts.',
    body: 'Announcements should be brief, visible, and easy to revise when operations change.',
    ctaLabel: 'View news',
    ctaHref: '/news',
    highlights: ['Operational notices', 'Policy alerts', 'Time-sensitive updates'],
    items: defaultItems.announcements,
  },
  'help-center': {
    eyebrow: 'Support hub',
    title: 'Help Center for account, billing, and product guidance.',
    summary: 'Keep support content organized, accessible, and easy to update.',
    body: 'This page is ideal for step-by-step help topics, troubleshooting notes, and escalation paths.',
    ctaLabel: 'Read the guides',
    ctaHref: '/user-guides',
    highlights: ['Support routing', 'Step-by-step guidance', 'Accessible content'],
    items: defaultItems['help-center'],
  },
  'privacy-policy': {
    eyebrow: 'Legal',
    title: 'Privacy Policy with editable policy sections and disclosures.',
    summary: 'Administrators can keep legal language current without touching code.',
    body: 'Use this page for privacy, data usage, retention, and user rights disclosures.',
    ctaLabel: 'Review terms',
    ctaHref: '/terms',
    highlights: ['Data transparency', 'Editable legal copy', 'Audit-friendly updates'],
    items: defaultItems['privacy-policy'],
  },
  terms: {
    eyebrow: 'Legal',
    title: 'Terms of service written for a secure, enterprise-grade platform.',
    summary: 'Keep the agreement concise, clear, and easy to revise as the product evolves.',
    body: 'This section covers access, acceptable use, and service change disclosures.',
    ctaLabel: 'Read the privacy policy',
    ctaHref: '/privacy-policy',
    highlights: ['Plain language', 'Versionable policy content', 'Administrator controlled'],
    items: defaultItems.terms,
  },
  blog: {
    eyebrow: 'Insights',
    title: 'Blog content that supports trust, education, and conversion.',
    summary: 'Publish thought leadership, product updates, and educational articles from the same admin workflow.',
    body: 'Use the blog to reinforce authority and keep the platform fresh with relevant updates.',
    ctaLabel: 'Browse landing pages',
    ctaHref: '/landing-pages',
    highlights: ['Editorial governance', 'Conversion-focused stories', 'Reusable content blocks'],
    items: defaultItems.blog,
  },
  seo: {
    eyebrow: 'Search',
    title: 'SEO settings and search visibility guidance.',
    summary: 'Manage how the platform is discovered and indexed.',
    body: 'Use this page to coordinate search strategy, indexing rules, and optimization priorities.',
    ctaLabel: 'Edit meta tags',
    ctaHref: '/meta-tags',
    highlights: ['Search strategy', 'Indexing control', 'Visibility tuning'],
    items: defaultItems.seo,
  },
  'meta-tags': {
    eyebrow: 'Metadata',
    title: 'Meta tags for titles, descriptions, and canonical URLs.',
    summary: 'Keep share and search snippets consistent across the site.',
    body: 'This section is best for page titles, descriptions, and canonical targets that support search quality.',
    ctaLabel: 'Open Open Graph',
    ctaHref: '/open-graph',
    highlights: ['Title templates', 'Description copy', 'Canonical URLs'],
    items: defaultItems['meta-tags'],
  },
  'open-graph': {
    eyebrow: 'Sharing',
    title: 'Open Graph settings for link previews.',
    summary: 'Control how pages appear when shared in social and messaging apps.',
    body: 'Use this page for preview titles, descriptions, and preview images.',
    ctaLabel: 'Open sitemap',
    ctaHref: '/sitemap',
    highlights: ['Preview title', 'Preview image', 'Share description'],
    items: defaultItems['open-graph'],
  },
  sitemap: {
    eyebrow: 'Indexing',
    title: 'Sitemap coverage for public routes.',
    summary: 'Keep the public route map discoverable and current.',
    body: 'This page can coordinate the URLs, priorities, and freshness signals that search engines use.',
    ctaLabel: 'Open robots rules',
    ctaHref: '/robots',
    highlights: ['Route coverage', 'Priority rules', 'Freshness signals'],
    items: defaultItems.sitemap,
  },
  robots: {
    eyebrow: 'Crawlers',
    title: 'Robots policy for indexing and crawl behavior.',
    summary: 'Control what search engines and agents can access.',
    body: 'Use this page to document crawler permissions, blocked routes, and sitemap references.',
    ctaLabel: 'Open custom URLs',
    ctaHref: '/custom-urls',
    highlights: ['Crawler policy', 'Route exclusions', 'Sitemap link'],
    items: defaultItems.robots,
  },
  'custom-urls': {
    eyebrow: 'Routing',
    title: 'Custom URLs and redirects for campaign pages.',
    summary: 'Manage clean routes, aliases, and redirect targets.',
    body: 'This section is useful for short campaign URLs, legacy redirects, and marketing-friendly paths.',
    ctaLabel: 'Browse landing pages',
    ctaHref: '/landing-pages',
    highlights: ['Friendly slugs', 'Redirect map', 'Campaign aliases'],
    items: defaultItems['custom-urls'],
  },
  'landing-pages': {
    eyebrow: 'Campaign assets',
    title: 'Landing pages optimized for conversion and brand consistency.',
    summary: 'Create polished, fast pages for campaigns, promotions, and partner activations.',
    body: 'Administrators can revise page narratives, highlights, and calls to action without a deploy.',
    ctaLabel: 'View advertiser pages',
    ctaHref: '/advertiser-pages',
    highlights: ['Campaign-specific copy', 'Mobile-first layouts', 'Fast iteration'],
    items: defaultItems['landing-pages'],
  },
  'advertiser-pages': {
    eyebrow: 'Business growth',
    title: 'Advertiser pages that feel premium, reliable, and performance-driven.',
    summary: 'Show advertisers the controls, outcomes, and proof points they need to invest with confidence.',
    body: 'The content model is flexible enough for onboarding, creative specs, reporting, and account support.',
    ctaLabel: 'Open user guides',
    ctaHref: '/user-guides',
    highlights: ['Brand-safe messaging', 'Conversion clarity', 'Data-driven reporting'],
    items: defaultItems['advertiser-pages'],
  },
  'user-guides': {
    eyebrow: 'Learning center',
    title: 'User guides written for a clean, easy onboarding experience.',
    summary: 'Give users concise walkthroughs that reduce confusion and improve adoption.',
    body: 'Use the guides to support onboarding, tasks, and reward processes with a premium tone of voice.',
    ctaLabel: 'Go back home',
    ctaHref: '/',
    highlights: ['Onboarding support', 'Task guidance', 'Reward clarity'],
    items: defaultItems['user-guides'],
  },
};

const DEFAULT_CONFIG: CmsConfig = {
  siteName: 'Go4Wealth',
  pages: defaultPages,
  reusableBlocks: defaultReusableBlocks,
  customPages: defaultCustomPages,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toContentItem(value: unknown): CmsContentItem | null {
  if (!isRecord(value) || typeof value.title !== 'string' || typeof value.body !== 'string') {
    return null;
  }

  return {
    title: value.title,
    body: value.body,
    meta: typeof value.meta === 'string' ? value.meta : undefined,
    href: typeof value.href === 'string' ? value.href : undefined,
  };
}

function createPricingTableBlock(id: string, content?: unknown): CmsCustomPageBlock {
  return {
    id,
    type: 'pricingTable',
    content: toPricingTableBlock(content, structuredClone(defaultHomeContent.pricing)),
  };
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function toCustomPageBlock(value: unknown, index: number): CmsCustomPageBlock | null {
  if (!isRecord(value) || value.type !== 'pricingTable') {
    return null;
  }

  const id = typeof value.id === 'string' && value.id.trim().length > 0 ? value.id : `pricing-table-${index + 1}`;
  return createPricingTableBlock(id, value.content);
}

function toCustomPageFromRow(value: unknown, fallback?: CmsCustomPage): CmsCustomPage | null {
  if (!isRecord(value)) {
    return fallback ?? null;
  }

  const highlights = toStringArray(value.highlights);
  const blocks = Array.isArray(value.blocks)
    ? value.blocks.map(toCustomPageBlock).filter((entry): entry is CmsCustomPageBlock => Boolean(entry))
    : fallback?.blocks ?? [];
  const items = Array.isArray(value.items)
    ? value.items.map(toContentItem).filter((entry): entry is CmsContentItem => Boolean(entry))
    : fallback?.items ?? [];

  return {
    slug: typeof value.slug === 'string' && value.slug.trim().length > 0 ? value.slug : fallback?.slug ?? '',
    eyebrow: typeof value.eyebrow === 'string' ? value.eyebrow : fallback?.eyebrow ?? '',
    title: typeof value.title === 'string' ? value.title : fallback?.title ?? '',
    summary: typeof value.summary === 'string' ? value.summary : fallback?.summary ?? '',
    body: typeof value.body === 'string' ? value.body : fallback?.body ?? '',
    ctaLabel: typeof value.ctaLabel === 'string' ? value.ctaLabel : fallback?.ctaLabel ?? '',
    ctaHref: typeof value.ctaHref === 'string' ? value.ctaHref : fallback?.ctaHref ?? '/',
    highlights: highlights.length > 0 ? highlights : fallback?.highlights ?? [],
    blocks,
    items,
  };
}

type CmsCustomPageRow = {
  id: string;
  slug: string;
  sort_order: number;
  eyebrow: string;
  title: string;
  summary: string;
  body: string;
  cta_label: string;
  cta_href: string;
  highlights: unknown;
  items: unknown;
  blocks: unknown;
  created_at: string;
  updated_at: string;
};

function toCustomPageFromRowRecord(row: CmsCustomPageRow): CmsCustomPage {
  return {
    slug: row.slug,
    eyebrow: row.eyebrow,
    title: row.title,
    summary: row.summary,
    body: row.body,
    ctaLabel: row.cta_label,
    ctaHref: row.cta_href,
    highlights: toStringArray(row.highlights),
    items: Array.isArray(row.items) ? row.items.map(toContentItem).filter((entry): entry is CmsContentItem => Boolean(entry)) : [],
    blocks: Array.isArray(row.blocks) ? row.blocks.map(toCustomPageBlock).filter((entry): entry is CmsCustomPageBlock => Boolean(entry)) : [],
  };
}

function toPricingTableBlock(value: unknown, fallback: CmsPricingTableBlock): CmsPricingTableBlock {
  if (!isRecord(value)) {
    return fallback;
  }

  const tiers = Array.isArray(value.tiers)
    ? value.tiers
        .map((entry) => {
          if (!isRecord(entry) || typeof entry.name !== 'string' || typeof entry.price !== 'string' || typeof entry.description !== 'string' || !Array.isArray(entry.features)) {
            return null;
          }

          return {
            name: entry.name,
            price: entry.price,
            description: entry.description,
            features: entry.features.filter((feature): feature is string => typeof feature === 'string' && feature.trim().length > 0),
            ctaLabel: typeof entry.ctaLabel === 'string' ? entry.ctaLabel : '',
            ctaHref: typeof entry.ctaHref === 'string' ? entry.ctaHref : '',
          };
        })
        .filter((entry): entry is CmsPricingTableBlock['tiers'][number] => Boolean(entry))
    : fallback.tiers;

  return {
    badge: typeof value.badge === 'string' ? value.badge : fallback.badge,
    title: typeof value.title === 'string' ? value.title : fallback.title,
    description: typeof value.description === 'string' ? value.description : fallback.description,
    tiers,
  };
}

function toCustomPage(value: unknown, fallback?: CmsCustomPage): CmsCustomPage | null {
  if (!isRecord(value)) {
    return fallback ?? null;
  }

  const items = Array.isArray(value.items)
    ? value.items.map(toContentItem).filter((entry): entry is CmsContentItem => Boolean(entry))
    : fallback?.items ?? [];
  const blocks = Array.isArray(value.blocks)
    ? value.blocks
        .map((entry, index) => {
          if (!isRecord(entry) || entry.type !== 'pricingTable') {
            return null;
          }

          const blockId = typeof entry.id === 'string' && entry.id.trim().length > 0 ? entry.id : `pricing-table-${index + 1}`;
          return createPricingTableBlock(blockId, entry.content);
        })
        .filter((entry): entry is CmsCustomPageBlock => Boolean(entry))
    : fallback?.blocks ?? [];

  return {
    slug: typeof value.slug === 'string' ? value.slug : fallback?.slug ?? '',
    eyebrow: typeof value.eyebrow === 'string' ? value.eyebrow : fallback?.eyebrow ?? '',
    title: typeof value.title === 'string' ? value.title : fallback?.title ?? '',
    summary: typeof value.summary === 'string' ? value.summary : fallback?.summary ?? '',
    body: typeof value.body === 'string' ? value.body : fallback?.body ?? '',
    ctaLabel: typeof value.ctaLabel === 'string' ? value.ctaLabel : fallback?.ctaLabel ?? '',
    ctaHref: typeof value.ctaHref === 'string' ? value.ctaHref : fallback?.ctaHref ?? '/',
    highlights: Array.isArray(value.highlights)
      ? value.highlights.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      : fallback?.highlights ?? [],
    blocks,
    items,
  };
}

function mergeHomeContent(value: unknown, fallback: CmsHomeContent): CmsHomeContent {
  const merge = (current: unknown, base: unknown): unknown => {
    if (Array.isArray(base)) {
      if (!Array.isArray(current)) return base;
      return current.map((entry, index) => isRecord(base[0]) ? merge(entry, base[index] ?? base[0]) : typeof entry === 'string' ? entry : base[index]).filter((entry) => entry !== undefined);
    }
    if (isRecord(base)) {
      const source = isRecord(current) ? current : {};
      return Object.fromEntries(Object.entries(base).map(([key, baseValue]) => [key, merge(source[key], baseValue)]));
    }
    return typeof current === typeof base ? current : base;
  };
  return merge(value, fallback) as CmsHomeContent;
}

function toPageContent(value: unknown, fallback: CmsPageContent): CmsPageContent {
  if (!isRecord(value)) {
    return fallback;
  }

  const highlights = Array.isArray(value.highlights)
    ? value.highlights.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : fallback.highlights;

  const items = Array.isArray(value.items)
    ? value.items.map(toContentItem).filter((entry): entry is CmsContentItem => Boolean(entry))
    : fallback.items;

  return {
    eyebrow: typeof value.eyebrow === 'string' ? value.eyebrow : fallback.eyebrow,
    title: typeof value.title === 'string' ? value.title : fallback.title,
    summary: typeof value.summary === 'string' ? value.summary : fallback.summary,
    body: typeof value.body === 'string' ? value.body : fallback.body,
    ctaLabel: typeof value.ctaLabel === 'string' ? value.ctaLabel : fallback.ctaLabel,
    ctaHref: typeof value.ctaHref === 'string' ? value.ctaHref : fallback.ctaHref,
    homeContent: fallback.homeContent ? mergeHomeContent(value.homeContent, fallback.homeContent) : undefined,
    highlights,
    items,
  };
}

function mergeCmsConfig(value: unknown): CmsConfig {
  if (!isRecord(value)) {
    return DEFAULT_CONFIG;
  }

  const siteName = typeof value.siteName === 'string' && value.siteName.trim().length > 0 ? value.siteName : DEFAULT_CONFIG.siteName;

  const pages = Object.entries(DEFAULT_CONFIG.pages).reduce<Record<CmsPageKey, CmsPageContent>>((accumulator, [key, fallback]) => {
    accumulator[key as CmsPageKey] = toPageContent(value.pages?.[key], fallback);
    return accumulator;
  }, {} as Record<CmsPageKey, CmsPageContent>);

  const reusableBlocks = Object.entries(DEFAULT_CONFIG.reusableBlocks).reduce<Record<CmsReusableBlockKey, CmsPricingTableBlock>>((accumulator, [key, fallback]) => {
    accumulator[key as CmsReusableBlockKey] = toPricingTableBlock(value.reusableBlocks?.[key], fallback);
    return accumulator;
  }, {} as Record<CmsReusableBlockKey, CmsPricingTableBlock>);

  const customPages = Array.isArray(value.customPages)
    ? value.customPages.map((entry) => toCustomPage(entry)).filter((entry): entry is CmsCustomPage => Boolean(entry && entry.slug.trim()))
    : DEFAULT_CONFIG.customPages;

  const pricingTable = pages.home.homeContent?.pricing ?? reusableBlocks.pricingTable ?? defaultReusableBlocks.pricingTable;

  return {
    siteName,
    pages: {
      ...pages,
      home: {
        ...pages.home,
        homeContent: pages.home.homeContent
          ? {
              ...pages.home.homeContent,
              pricing: pricingTable,
            }
          : pages.home.homeContent,
      },
    },
    reusableBlocks: {
      ...reusableBlocks,
      pricingTable,
    },
    customPages,
  };
}

export function buildDefaultCmsConfig(): CmsConfig {
  return DEFAULT_CONFIG;
}

export function getCmsPageLabel(pageKey: CmsPageKey): string {
  return pageLabels[pageKey];
}

export async function listCmsConfig(): Promise<CmsConfig> {
  const [{ data: documents, error: documentsError }, { data: customPages }, { data: settings }] = await Promise.all([
    supabase
      .from('cms_documents')
      .select('page_key,site_name,published_content,status')
      .eq('status', 'published'),
    supabase
      .from('cms_custom_pages')
      .select('id,slug,sort_order,eyebrow,title,summary,body,cta_label,cta_href,highlights,items,blocks,created_at,updated_at')
      .order('sort_order', { ascending: true })
      .order('slug', { ascending: true }),
    supabase.from('platform_settings').select('value').eq('key', CMS_SETTING_KEY).maybeSingle(),
  ]);

  const publishedPages = !documentsError && documents && documents.length > 0 ? documents.reduce<Record<CmsPageKey, CmsPageContent>>((accumulator, row) => {
    const pageKey = (row as { page_key?: string }).page_key as CmsPageKey;
    if (pageLabels[pageKey]) {
      accumulator[pageKey] = toPageContent((row as { published_content?: unknown }).published_content, DEFAULT_CONFIG.pages[pageKey]);
    }
    return accumulator;
  }, { ...DEFAULT_CONFIG.pages }) : DEFAULT_CONFIG.pages;

  const legacyCustomPages = settings?.value && isRecord(settings.value) && Array.isArray((settings.value as Record<string, unknown>).customPages)
    ? (settings.value as Record<string, unknown>).customPages
        .map((entry) => toCustomPageFromRow(entry))
        .filter((entry): entry is CmsCustomPage => Boolean(entry && entry.slug.trim()))
    : DEFAULT_CONFIG.customPages;

  const resolvedCustomPages = Array.isArray(customPages) && customPages.length > 0
    ? customPages.map((row) => toCustomPageFromRowRecord(row as CmsCustomPageRow))
    : legacyCustomPages;

  const documentConfig = {
    siteName: !documentsError && documents && documents.length > 0 && typeof documents[0]?.site_name === 'string'
      ? (documents[0]?.site_name as string)
      : DEFAULT_CONFIG.siteName,
    pages: publishedPages,
    reusableBlocks: DEFAULT_CONFIG.reusableBlocks,
    customPages: resolvedCustomPages,
  };

  if (settings?.value) {
    return mergeCmsConfig({ ...documentConfig, ...(settings.value as Record<string, unknown>), customPages: resolvedCustomPages });
  }

  return mergeCmsConfig(documentConfig);
}

export async function updateCmsConfig(config: CmsConfig): Promise<void> {
  const normalizedConfig = mergeCmsConfig(config);
  const { data: userData } = await supabase.auth.getUser();
  const updatedBy = userData.user?.id ?? null;
  const { data: existing } = await supabase.from('cms_documents').select('page_key,status,version').in('page_key', [...cmsPageKeys]);
  const existingByKey = new Map((existing ?? []).map((row) => [row.page_key as CmsPageKey, row as { status: CmsPublicationStatus; version: number }]));

  const rows = cmsPageKeys.map((pageKey) => {
    const current = existingByKey.get(pageKey);
    return {
      page_key: pageKey,
      site_name: normalizedConfig.siteName,
      draft_content: normalizedConfig.pages[pageKey],
      published_content: current ? undefined : normalizedConfig.pages[pageKey],
      status: current?.status ?? 'draft',
      version: current?.version ?? 1,
      updated_by: updatedBy,
    };
  });

  const { error } = await supabase.from('cms_documents').upsert(rows, { onConflict: 'page_key' });
  if (error) {
    // Compatibility fallback keeps the existing settings path usable during migration rollout.
    const { error: settingsError } = await supabase.from('platform_settings').upsert(
      { key: CMS_SETTING_KEY, value: normalizedConfig, description: 'Go4Wealth CMS content for public pages, legal copy, SEO, reusable blocks, and custom pages', updated_by: updatedBy },
      { onConflict: 'key' },
    );
    if (settingsError) throw settingsError;
    return;
  }

  const customPageRows = normalizedConfig.customPages.map((page, index) => ({
    slug: page.slug,
    sort_order: index,
    eyebrow: page.eyebrow,
    title: page.title,
    summary: page.summary,
    body: page.body,
    cta_label: page.ctaLabel,
    cta_href: page.ctaHref,
    highlights: page.highlights,
    items: page.items,
    blocks: page.blocks,
  }));

  const { data: existingCustomPages, error: customPagesError } = await supabase.from('cms_custom_pages').select('id,slug');
  if (customPagesError && customPagesError.code !== '42P01') {
    throw customPagesError;
  }

  if (!customPagesError) {
    if (customPageRows.length > 0) {
      const { error: customPagesUpsertError } = await supabase.from('cms_custom_pages').upsert(customPageRows, { onConflict: 'slug' });
      if (customPagesUpsertError) throw customPagesUpsertError;
    }

    const existingSlugs = new Set((existingCustomPages ?? []).map((row) => (row as { slug?: string }).slug).filter((slug): slug is string => typeof slug === 'string' && slug.length > 0));
    const nextSlugs = new Set(customPageRows.map((row) => row.slug));
    const slugsToDelete = [...existingSlugs].filter((slug) => !nextSlugs.has(slug));
    if (slugsToDelete.length > 0) {
      const { error: deleteError } = await supabase.from('cms_custom_pages').delete().in('slug', slugsToDelete);
      if (deleteError) throw deleteError;
    }
  }

  const { error: settingsError } = await supabase.from('platform_settings').upsert(
    { key: CMS_SETTING_KEY, value: normalizedConfig, description: 'Go4Wealth CMS content for public pages, legal copy, SEO, reusable blocks, and custom pages', updated_by: updatedBy },
    { onConflict: 'key' },
  );
  if (settingsError) throw settingsError;
}

type CmsDocumentRow = {
  id: string;
  page_key: CmsPageKey;
  site_name: string;
  draft_content: unknown;
  published_content: unknown;
  status: CmsPublicationStatus;
  version: number;
  scheduled_publish_at: string | null;
  published_at: string | null;
  updated_at: string;
};

function toDocumentState(row: CmsDocumentRow): CmsDocumentState {
  return {
    pageKey: row.page_key,
    status: row.status,
    version: row.version,
    scheduledPublishAt: row.scheduled_publish_at,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

async function publishCmsConfigLocally(config: CmsConfig, changeSummary: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const actorUserId = userData.user?.id ?? null;
  const { data: documents, error: documentsError } = await supabase.from('cms_documents').select('id,page_key,version,status').in('page_key', [...cmsPageKeys]);
  if (documentsError) throw documentsError;

  for (const pageKey of cmsPageKeys) {
    const current = (documents ?? []).find((row) => row.page_key === pageKey) as { id: string; version: number; status: CmsPublicationStatus } | undefined;
    const nextVersion = (current?.version ?? 0) + 1;
    const { data: document, error } = await supabase.from('cms_documents').upsert({
      id: current?.id,
      page_key: pageKey,
      site_name: config.siteName,
      draft_content: config.pages[pageKey],
      published_content: config.pages[pageKey],
      status: 'published',
      version: nextVersion,
      published_at: new Date().toISOString(),
      scheduled_publish_at: null,
      updated_by: actorUserId,
      published_by: actorUserId,
    }, { onConflict: 'page_key' }).select('id').single();
    if (error || !document) throw error ?? new Error(`Unable to publish ${pageKey}`);

    await supabase.from('cms_document_revisions').insert({
      document_id: document.id,
      version: nextVersion,
      content: config.pages[pageKey],
      status: 'published',
      change_summary: changeSummary,
      created_by: actorUserId,
    });
    await supabase.from('cms_publication_events').insert({
      document_id: document.id,
      event_type: 'published',
      from_status: current?.status ?? null,
      to_status: 'published',
      version: nextVersion,
      actor_user_id: actorUserId,
      metadata: { changeSummary },
    });
  }
}

async function scheduleCmsPublishLocally(config: CmsConfig, scheduledPublishAt: string, changeSummary: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const actorUserId = userData.user?.id ?? null;
  const { data: documents, error } = await supabase.from('cms_documents').select('id,page_key,version,status,published_content').in('page_key', [...cmsPageKeys]);
  if (error) throw error;

  for (const pageKey of cmsPageKeys) {
    const current = (documents ?? []).find((row) => row.page_key === pageKey) as { id: string; version: number; status: CmsPublicationStatus; published_content?: unknown } | undefined;
    const nextVersion = (current?.version ?? 0) + 1;
    const { data: document, error: updateError } = await supabase.from('cms_documents').upsert({
      id: current?.id,
      page_key: pageKey,
      site_name: config.siteName,
      draft_content: config.pages[pageKey],
      published_content: current?.published_content ?? config.pages[pageKey],
      status: 'scheduled',
      version: nextVersion,
      scheduled_publish_at: scheduledPublishAt,
      updated_by: actorUserId,
    }, { onConflict: 'page_key' }).select('id').single();
    if (updateError || !document) throw updateError ?? new Error(`Unable to schedule ${pageKey}`);
    await supabase.from('cms_document_revisions').insert({ document_id: document.id, version: nextVersion, content: config.pages[pageKey], status: 'scheduled', change_summary: changeSummary, created_by: actorUserId });
    await supabase.from('cms_publication_events').insert({ document_id: document.id, event_type: 'scheduled', from_status: current?.status ?? null, to_status: 'scheduled', version: nextVersion, actor_user_id: actorUserId, scheduled_for: scheduledPublishAt, metadata: { changeSummary } });
  }
}

export async function listCmsOperationalSnapshot(): Promise<CmsOperationalSnapshot> {
  const [{ data, error }, { data: customPages, error: customPagesError }] = await Promise.all([
    supabase.from('cms_documents').select('*').in('page_key', [...cmsPageKeys]),
    supabase
      .from('cms_custom_pages')
      .select('id,slug,sort_order,eyebrow,title,summary,body,cta_label,cta_href,highlights,items,blocks,created_at,updated_at')
      .order('sort_order', { ascending: true })
      .order('slug', { ascending: true }),
  ]);

  if (error || !data || data.length === 0) {
    return { config: await listCmsConfig(), documents: {} as Record<CmsPageKey, CmsDocumentState> };
  }

  const rows = data as CmsDocumentRow[];
  const first = rows[0];
  const pages = rows.reduce<Record<CmsPageKey, CmsPageContent>>((accumulator, row) => {
    accumulator[row.page_key] = toPageContent(row.draft_content, DEFAULT_CONFIG.pages[row.page_key]);
    return accumulator;
  }, { ...DEFAULT_CONFIG.pages });

  const resolvedCustomPages = !customPagesError && Array.isArray(customPages) && customPages.length > 0
    ? customPages.map((row) => toCustomPageFromRowRecord(row as CmsCustomPageRow))
    : DEFAULT_CONFIG.customPages;

  return {
    config: mergeCmsConfig({ siteName: first.site_name, pages, customPages: resolvedCustomPages }),
    documents: rows.reduce<Record<CmsPageKey, CmsDocumentState>>((accumulator, row) => {
      accumulator[row.page_key] = toDocumentState(row);
      return accumulator;
    }, {} as Record<CmsPageKey, CmsDocumentState>),
  };
}

export async function publishCmsConfig(config: CmsConfig, changeSummary = 'Published CMS content'): Promise<void> {
  const { error } = await supabase.rpc('publish_cms_documents', {
    p_config: config,
    p_change_summary: changeSummary,
  });
  if (!error) {
    return;
  }

  await publishCmsConfigLocally(config, changeSummary);
}

export async function scheduleCmsPublish(config: CmsConfig, scheduledPublishAt: string, changeSummary = 'Scheduled CMS publication'): Promise<void> {
  const { error } = await supabase.rpc('schedule_cms_documents', {
    p_config: config,
    p_scheduled_publish_at: scheduledPublishAt,
    p_change_summary: changeSummary,
  });
  if (!error) {
    return;
  }

  await scheduleCmsPublishLocally(config, scheduledPublishAt, changeSummary);
}

export async function listCmsRevisions(pageKey: CmsPageKey): Promise<CmsRevision[]> {
  const { data, error } = await supabase.from('cms_document_revisions').select('id,version,status,change_summary,created_at,cms_documents!inner(page_key)').eq('cms_documents.page_key', pageKey).order('created_at', { ascending: false }).limit(20);
  if (error || !data) return [];
  return data.map((row) => ({ id: row.id, pageKey, version: row.version, status: row.status, changeSummary: row.change_summary, createdAt: row.created_at }));
}

export async function rollbackCmsRevision(pageKey: CmsPageKey, revisionId: string): Promise<CmsPageContent> {
  const { data: revision, error: revisionError } = await supabase
    .from('cms_document_revisions')
    .select('content')
    .eq('id', revisionId)
    .single();
  if (revisionError || !revision) throw revisionError ?? new Error('Revision not found');

  const { data: document, error: documentError } = await supabase.from('cms_documents').select('id,version').eq('page_key', pageKey).single();
  if (documentError || !document) throw documentError ?? new Error('CMS document not found');

  const content = toPageContent(revision.content, DEFAULT_CONFIG.pages[pageKey]);
  const nextVersion = Number(document.version) + 1;
  const { data: userData } = await supabase.auth.getUser();
  const actorUserId = userData.user?.id ?? null;
  const { error: updateError } = await supabase.from('cms_documents').update({
    draft_content: content,
    status: 'draft',
    version: nextVersion,
    scheduled_publish_at: null,
    updated_by: actorUserId,
  }).eq('id', document.id);
  if (updateError) throw updateError;

  await supabase.from('cms_document_revisions').insert({ document_id: document.id, version: nextVersion, content, status: 'draft', change_summary: `Rolled back to revision ${revisionId}`, created_by: actorUserId });
  await supabase.from('cms_publication_events').insert({ document_id: document.id, event_type: 'rolled_back', from_status: 'published', to_status: 'draft', version: nextVersion, actor_user_id: actorUserId, metadata: { sourceRevisionId: revisionId } });
  return content;
}

/** Invoked by a trusted scheduled worker, never by the public CMS UI. */
export async function publishScheduledCmsDocuments(): Promise<number> {
  const { data, error } = await supabase.rpc('publish_scheduled_cms_documents');
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}
