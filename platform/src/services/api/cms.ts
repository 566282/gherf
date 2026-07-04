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
  'help-center': 'Help Center',
  'privacy-policy': 'Privacy Policy',
  terms: 'Terms',
  blog: 'Blog',
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
      description: 'Go4Wealth CMS content for pages, guides, blog, and legal copy',
    },
    { onConflict: 'key' },
  );

  if (error) throw error;
}
