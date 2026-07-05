import { supabase } from '@/services/supabase/client';
import type { CmsConfig, CmsContentItem, CmsPageContent, CmsPageKey } from '@/types';

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

  return { siteName, pages };
}

export function buildDefaultCmsConfig(): CmsConfig {
  return DEFAULT_CONFIG;
}

export function getCmsPageLabel(pageKey: CmsPageKey): string {
  return pageLabels[pageKey];
}

export async function listCmsConfig(): Promise<CmsConfig> {
  const { data, error } = await supabase.from('platform_settings').select('key,value').eq('key', CMS_SETTING_KEY).single();

  if (error || !data) {
    return DEFAULT_CONFIG;
  }

  return mergeCmsConfig((data as SettingRow).value);
}

export async function updateCmsConfig(config: CmsConfig): Promise<void> {
  const { error } = await supabase.from('platform_settings').upsert(
    {
      key: CMS_SETTING_KEY,
      value: config,
      description: 'Go4Wealth CMS content for public pages, legal copy, SEO, and routing metadata',
    },
    { onConflict: 'key' },
  );

  if (error) throw error;
}
