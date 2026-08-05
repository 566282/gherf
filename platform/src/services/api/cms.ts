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
  benefits: 'Benefits',
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
  benefits: [
    { title: 'User earning model that stays realistic', body: 'Users earn by completing verified campaigns, referrals, and daily participation paths. Practical outcomes depend on consistency, campaign availability, geography, and membership level rather than guaranteed fixed income claims.', meta: 'For users' },
    { title: 'How users can grow monthly earnings', body: 'High-intent users can increase results by focusing on campaigns with clear qualification rules, keeping account verification current, maintaining streaks, and avoiding disqualifying behavior that blocks reward eligibility.', meta: 'User income strategy' },
    { title: 'Advertiser ROI through measurable actions', body: 'Advertisers pay for validated outcomes instead of broad untargeted exposure. Better budget efficiency comes from defined task funnels, campaign governance, and conversion-aware optimization rather than inflated vanity traffic.', meta: 'For advertisers' },
    { title: 'What makes Go4Wealth stand out from common alternatives', body: 'Many competitors optimize for raw activity volume. Go4Wealth emphasizes trust controls, review-aware reward operations, and transparent payout policy so both users and advertisers can scale with less dispute risk.', meta: 'Competitive edge' },
    { title: 'Lower friction for serious operators', body: 'Advertisers can work from one business workspace for onboarding, funding visibility, campaign controls, submissions, communications, and analytics, reducing coordination overhead across disconnected tools.', meta: 'Operator advantage' },
    { title: 'Trust signals that protect long-term value', body: 'Clear policies, status-driven workflows, and governed publishing reduce confusion and improve retention. That stability helps users preserve earning continuity and helps advertisers sustain campaign quality over time.', meta: 'Long-term durability' },
  ],
  faqs: [
    { title: 'How does Go4Wealth work?', body: 'Advertisers launch high-trust campaigns, users complete guided actions, and the platform tracks rewards in a transparent flow.', meta: 'Product' },
    { title: 'Can administrators edit all site content?', body: 'Yes. Homepage copy, legal pages, blog content, landing pages, advertiser pages, and user guides are all managed from the admin CMS.', meta: 'CMS' },
    { title: 'Is the experience mobile-friendly?', body: 'The interface is built mobile-first with responsive layout, streamlined content blocks, and touch-friendly controls.', meta: 'UX' },
  ],
  about: [
    { title: 'Who we are', body: 'Go4Wealth is a trust-first growth and rewards platform for advertisers, operators, and participating users. We are headquartered in the United Kingdom and focused on responsible, long-term platform operations.', meta: 'Company' },
    { title: 'What we built', body: 'The platform unifies campaign delivery, user task journeys, reward workflows, wallet operations, communications, and compliance-aware administration in one operating model.', meta: 'Platform' },
    { title: 'Enterprise trust model', body: 'Our approach combines role-based access, verification and anti-abuse controls, payout governance, compliance review paths, and CMS-driven policy communication to support accountable scale.', meta: 'Trust' },
    { title: 'Why teams choose this system', body: 'Enterprise teams use this model to balance growth execution with operational control, using clear workflows for onboarding, rewards, communications, and administrative oversight.', meta: 'Enterprise' },
    { title: 'Governance and resilience', body: 'Security and governance features include session controls, MFA support, protected routes, review states, and escalation pathways that keep operations observable and manageable.', meta: 'Security' },
    { title: 'Our commitment', body: 'We build for reliability, transparency, and user confidence so growth outcomes and trust move together instead of competing.', meta: 'Commitment' },
  ],
  contact: [
    { title: 'Support channels', body: 'Telegram: @helpdesk_go4wealth. Use this channel for day-to-day support coordination and quick routing to the right team.', meta: 'Support' },
    { title: 'Business inquiries', body: 'For partnerships, enterprise discussions, and business requests, email helpdesk@go4wealth.org with your organization name, request type, and operational context.', meta: 'Business' },
    { title: 'Office and hours', body: 'Open Monday through Sunday 8am to 10pm.', meta: 'Hours' },
    { title: 'What to include in requests', body: 'Include your account email, affected route, date/time, visible status text, and relevant task, withdrawal, transaction, reservation, or notification IDs for faster resolution.', meta: 'Response quality' },
    { title: 'Account and security support', body: 'Contact the help desk for login and recovery issues, verification problems, session concerns, or trust and safety escalations requiring operator review.', meta: 'Security' },
    { title: 'Rewards and payout assistance', body: 'Contact support for task verification concerns, reward-status clarifications, withdrawal delays, receipt confirmation questions, or compliance-review follow-ups.', meta: 'Operations' },
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
    { title: 'Contact support', body: 'For support requests, contact helpdesk@go4wealth.org. Include your account email, issue summary, affected page, date/time, and any related task, transaction, withdrawal, or reservation ID.', meta: 'Support' },
    { title: 'New user quick start', body: 'Create your account, verify your email, complete onboarding preferences, and review your profile and membership tier before starting daily tasks and wallet actions.', meta: 'Getting started' },
    { title: 'Login and account access help', body: 'Use email/password, OAuth, phone OTP for existing users where enabled, or password reset. If lock protection is triggered after failed attempts, wait and retry, then contact helpdesk@go4wealth.org if needed.', meta: 'Account access' },
    { title: 'Task and reward troubleshooting', body: 'Start tasks from the task page, keep sessions active to threshold, avoid hidden tabs and seek violations, and claim rewards only after verification. If rewards do not credit, check status and notifications first.', meta: 'Tasks' },
    { title: 'Withdrawal and payout help', body: 'Withdrawals are policy-controlled. Check tier eligibility, limits, fees, payout method details, and compliance state. If delayed, review status and use receipt or non-receipt flows when prompted.', meta: 'Payouts' },
    { title: 'Promotional reward support', body: 'Spin-wheel results may create reward-vault reservations. Release can depend on registration, verification, referrals, membership requirements, and expiration windows.', meta: 'Promotion' },
    { title: 'Notifications and communications', body: 'Check in-app notifications first for reward, compliance, and payout updates. External channel delivery may vary by configuration and environment.', meta: 'Notifications' },
    { title: 'Security, reviews, and escalation', body: 'Some account or transaction states may enter security or compliance review. Follow in-app guidance and contact helpdesk@go4wealth.org for escalation status.', meta: 'Trust and safety' },
  ],
  'privacy-policy': [
    { title: 'Account and identity information', body: 'The service may collect full name, email, role, referral relationships, avatar details, membership state, badges, and profile-status attributes needed to run your account.', meta: 'Collection' },
    { title: 'Authentication and session information', body: 'The platform may process login events, session IDs, device and user-agent hashes, revocation and expiry state, MFA factor status, and lockout signals to protect user access and platform integrity.', meta: 'Security' },
    { title: 'Task, reward, and gamification data', body: 'The service may process onboarding preferences, social profile payloads, verification and anti-fraud signals, watch-session telemetry, XP progression, streaks, achievements, and leaderboard activity.', meta: 'Product telemetry' },
    { title: 'Promotional spin and reservation data', body: 'Spin attempts, outcomes, and reward-vault reservation states may be stored, including requirement progress, release state, and expiration timing.', meta: 'Promotion' },
    { title: 'Wallet, transfer, and withdrawal records', body: 'The service may process balances, transactions, reward ledgers, transfer history, withdrawal destination details, fees, scheduled dates, receipt confirmations, and related review metadata.', meta: 'Finance' },
    { title: 'Why information is processed', body: 'Information is used to provide features, authenticate users, prevent abuse, evaluate rewards, process payouts, send required operational notices, support analytics, and satisfy legal obligations.', meta: 'Use' },
    { title: 'How information may be shared', body: 'Data may be shared with infrastructure, authentication, messaging, payment, analytics, support, compliance, fraud-prevention, and authorized regulatory or legal counterparties when required.', meta: 'Sharing' },
    { title: 'Retention, security, and user rights', body: 'Records may be retained for service, security, accounting, compliance, and legal reasons. Depending on jurisdiction, users may request access, correction, deletion, or related privacy-rights support.', meta: 'Rights' },
  ],
  terms: [
    { title: 'Eligibility and account accuracy', body: 'Users must provide accurate registration information and keep profile data current. Access can be limited by role, verification state, membership tier, or policy status.', meta: 'Accounts' },
    { title: 'Authentication and session safeguards', body: 'The service supports email/password sign-in, OAuth, phone OTP for existing users, MFA enrollment, and session revocation. Security checks and temporary lock protections may limit access.', meta: 'Security' },
    { title: 'Acceptable use and anti-abuse restrictions', body: 'Users must not automate, manipulate, or bypass campaign, task, reward, verification, payout, or communication controls. Fraudulent or deceptive behavior can result in suspension or termination.', meta: 'Use policy' },
    { title: 'Task, campaign, and reward eligibility', body: 'Rewards are conditional and may depend on verification outcomes, anti-cheat checks, cooldowns, completion thresholds, and campaign rules. Rewards may be delayed, denied, reversed, expired, or revoked where appropriate.', meta: 'Rewards' },
    { title: 'Promotional spin and reward vault terms', body: 'Spin outcomes may create reservations instead of immediate payouts. Release may require registration, verification, referrals, membership actions, and completion before expiration.', meta: 'Promotion' },
    { title: 'Wallet, transfer, and withdrawal conditions', body: 'Withdrawal access is policy-controlled. Free-tier members are blocked from withdrawals, limits and fees may apply, requests may be held for review, and compliance or fee-settlement requirements may affect processing.', meta: 'Wallet' },
    { title: 'Operational and compliance messaging', body: 'The platform may send in-app, email, push, SMS, WhatsApp, Telegram, and compliance-related notices as needed for account security and service operations. Some channel delivery is best-effort.', meta: 'Communications' },
    { title: 'Service changes, suspension, and termination', body: 'We may update, pause, or discontinue features and may restrict or terminate access for abuse, compliance, security, or operational reasons, consistent with applicable law.', meta: 'Platform governance' },
  ],
  blog: [
    { title: 'Why trust architecture outperforms growth hacks in reward platforms', body: 'High-conversion systems only sustain when reward logic, policy clarity, and operational controls are visible. Learn why role-gated routes, review states, and transparent payout conditions outperform short-lived growth tactics.', meta: 'Category: Trust architecture | Author: Go4Wealth Editorial | Published: 2026-08-06' },
    { title: 'Campaign governance for enterprise advertisers: from launch velocity to brand safety', body: 'Enterprise campaign teams need more than launch speed. This post explores approval workflows, submission controls, and performance accountability for safe, scalable campaign operations.', meta: 'Category: Enterprise campaigns | Author: Go4Wealth Editorial | Published: 2026-08-07' },
    { title: 'Building anti-abuse into daily task and reward experiences', body: 'Reward credibility depends on verification depth. We unpack session telemetry, anti-cheat indicators, and reviewer pathways that protect both advertisers and legitimate users.', meta: 'Category: Verification | Author: Go4Wealth Editorial | Published: 2026-08-08' },
    { title: 'The operational economics of wallet and withdrawal controls', body: 'Clear limits, fees, and payout-state transitions create predictable financial operations. This article explains why structured withdrawal governance improves trust and reduces support churn.', meta: 'Category: Wallet operations | Author: Go4Wealth Editorial | Published: 2026-08-09' },
    { title: 'Reward vault mechanics: turning promotional spins into accountable incentives', body: 'Promotions become enterprise-safe when outcomes are conditional and auditable. Explore reservation states, unlock requirements, and expiry logic for controlled incentive design.', meta: 'Category: Promotional systems | Author: Go4Wealth Editorial | Published: 2026-08-10' },
    { title: 'Communication reliability in multi-channel platforms: what best effort really means', body: 'In-app, email, push, and messaging channels fail differently. We cover fallback strategies, template governance, and why core status visibility must not depend on one channel.', meta: 'Category: Communications | Author: Go4Wealth Editorial | Published: 2026-08-11' },
    { title: 'Why CMS-governed legal and support pages are now a core enterprise control', body: 'Legal and support content should evolve at operational speed with revision discipline. This post explains how CMS publication workflows strengthen compliance and stakeholder trust.', meta: 'Category: CMS governance | Author: Go4Wealth Editorial | Published: 2026-08-12' },
    { title: 'Membership tiers, reward policy, and user trust: balancing incentives with control', body: 'Tiered reward systems work best when eligibility rules are explicit. We review membership-linked payout policy, fee checkpoints, and messaging patterns that reduce confusion.', meta: 'Category: Membership strategy | Author: Go4Wealth Editorial | Published: 2026-08-13' },
    { title: 'Observability for growth operations: metrics that matter beyond vanity dashboards', body: 'Enterprise teams need actionable telemetry across campaigns, rewards, payouts, and compliance states. Learn which metrics support incident response and strategic iteration.', meta: 'Category: Observability | Author: Go4Wealth Editorial | Published: 2026-08-14' },
    { title: 'Enterprise rollout blueprint for trust-first growth platforms', body: 'Safe rollout requires staged configuration, governance ownership, communication readiness, and escalation paths. This article provides a practical deployment framework for enterprise teams.', meta: 'Category: Enterprise rollout | Author: Go4Wealth Editorial | Published: 2026-08-15' },
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
    { title: 'Business onboarding and verification workflow', body: 'Advertisers can register a business entity, add website and contact email, then move through verification before unlocking full funding and campaign controls in the business workspace.', meta: 'Category: Onboarding | Audience: Advertiser operators' },
    { title: 'Funding reserve and budget governance', body: 'The dashboard tracks reserve balance, committed spend, and available budget so campaign teams can fund activations, control pacing, and prevent over-allocation across active work.', meta: 'Category: Budget controls | Audience: Finance and growth teams' },
    { title: 'Campaign lifecycle controls from one console', body: 'Advertiser roles can create campaigns, edit existing campaigns, and manage lifecycle states with a role-gated business route that keeps operations focused and accountable.', meta: 'Category: Campaign operations | Audience: Campaign managers' },
    { title: 'Submission review and verification posture', body: 'Campaign execution is tied to review logic and verification methods, with configurable evidence expectations designed to support quality outcomes and reduce abuse risk.', meta: 'Category: Verification | Audience: Operations and compliance' },
    { title: 'Cross-functional operational modules', body: 'Beyond campaign editing, business users get dedicated spaces for gamification administration, communication operations, and analytics reporting under a unified advertiser workspace.', meta: 'Category: Platform modules | Audience: Enterprise teams' },
    { title: 'Performance visibility with actionable KPIs', body: 'Advertiser reporting surfaces CTR, conversions, ROI, status mixes, and engagement patterns so teams can tune budget distribution and decision velocity with measurable signals.', meta: 'Category: Reporting | Audience: Performance leads' },
    { title: 'Export-ready reporting for stakeholder workflows', body: 'Operational reports can be exported in CSV or JSON formats, enabling finance, compliance, and leadership teams to consume campaign data in downstream review and audit processes.', meta: 'Category: Data export | Audience: Leadership and audit' },
    { title: 'Premium public positioning for advertiser trust', body: 'Public advertiser pages are CMS-managed so go-to-market teams can continuously refine onboarding language, creative policy messaging, and proof-point narratives without code deploys.', meta: 'Category: CMS governance | Audience: Marketing and admin' },
  ],
  'user-guides': [
    { title: 'Create your account', body: 'Signup requires full name, email, password, role selection, and optional referral code. New accounts are redirected to sign in after registration.', meta: 'Onboarding' },
    { title: 'Sign in and recover access', body: 'Supported access paths include email/password, OAuth providers, password reset, and phone OTP for existing users where enabled. MFA and active-session controls are available.', meta: 'Access' },
    { title: 'Complete profile and task onboarding', body: 'After sign-in, verify email, review profile details, and save preferred task categories plus social profile details used by compliance-aware task checks.', meta: 'Profile' },
    { title: 'Complete daily tasks correctly', body: 'Start tasks from the task page, keep sessions active to threshold, avoid hidden tabs and seek violations, wait for claim availability, and claim only after verification succeeds.', meta: 'Tasks' },
    { title: 'Use daily progression features', body: 'Claim daily login bonuses, build streaks, complete quests, earn XP, track achievements, and use available spin tokens and mystery rewards on the gamification page.', meta: 'Gamification' },
    { title: 'Track balances and reward history', body: 'Use the wallet route to review account balances, reward ledgers, transfers, transactions, withdrawal status, and receipt confirmation queue items.', meta: 'Wallet' },
    { title: 'Request withdrawals', body: 'Withdrawals are policy-controlled. Free-tier members cannot withdraw, limits and fees apply, and requests may be scheduled, held, or delayed by compliance and plan requirements.', meta: 'Payouts' },
    { title: 'Understand promotional reward reservations', body: 'Spin-wheel rewards may create vault reservations that require registration, verification, referrals, membership actions, and completion before expiry before release.', meta: 'Promotion' },
    { title: 'Manage notifications and security', body: 'Watch in-app status and notification history, keep credentials secure, verify email, enable MFA when possible, and revoke unfamiliar active sessions promptly.', meta: 'Support' },
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
  benefits: {
    eyebrow: 'Value outcomes',
    title: 'Benefits for users and advertisers built around real earning and ROI outcomes.',
    summary: 'This page explains who earns, how they earn, what influences performance, and why Go4Wealth is positioned differently from activity-only reward platforms.',
    body: 'Go4Wealth is designed to align verified user effort with advertiser conversion goals. Users can increase earnings through consistent qualified participation, while advertisers improve return through governance, targeting, and measurable campaign execution.',
    ctaLabel: 'View advertiser pages',
    ctaHref: '/advertiser-pages',
    highlights: ['Realistic user earning pathways', 'Advertiser ROI and budget efficiency focus', 'Trust-first differentiation versus volume-first competitors'],
    items: defaultItems.benefits,
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
    title: 'About Go4Wealth: trust-first growth operations headquartered in the United Kingdom.',
    summary: 'We combine growth execution, reward operations, and enterprise-grade governance in one platform designed for accountable scale.',
    body: 'Go4Wealth is headquartered in the United Kingdom and built around transparent workflows for campaigns, tasks, rewards, communications, and compliance-aware operations.',
    ctaLabel: 'Contact us',
    ctaHref: '/contact',
    highlights: ['Headquartered in the United Kingdom', 'Enterprise trust and governance controls', 'Operational clarity across growth and rewards'],
    items: defaultItems.about,
  },
  contact: {
    eyebrow: 'Support',
    title: 'Contact Go4Wealth support and business operations.',
    summary: 'Reach our team through Telegram and email, with clear routing for account, reward, payout, and enterprise inquiries.',
    body: 'Business inquiries email: helpdesk@go4wealth.org. Support channel: Telegram @helpdesk_go4wealth. Office hours are open Monday through Sunday 8am to 10pm.',
    ctaLabel: 'Open help center',
    ctaHref: '/help-center',
    highlights: ['Open Monday through Sunday 8am to 10pm', 'Business inquiries: helpdesk@go4wealth.org', 'Support channel: Telegram @helpdesk_go4wealth'],
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
    title: 'Help Center for account access, tasks, rewards, and payout support.',
    summary: 'Use this page for practical troubleshooting across sign-in, onboarding, daily task completion, wallet activity, promotional reservations, and withdrawals.',
    body: 'Primary support contact: helpdesk@go4wealth.org. Include your account email, affected route, timestamp, and related identifiers for faster resolution.',
    ctaLabel: 'Read the guides',
    ctaHref: '/user-guides',
    highlights: ['helpdesk@go4wealth.org support contact', 'Step-by-step troubleshooting', 'Account, task, and payout escalation paths'],
    items: defaultItems['help-center'],
  },
  'privacy-policy': {
    eyebrow: 'Legal',
    title: 'Privacy policy for account, security, reward, and payout data.',
    summary: 'This page describes what information the platform processes, why it is processed, how it may be shared, and what rights users may have.',
    body: 'The implemented service processes account and authentication data, task and reward telemetry, promotional reservation state, wallet and withdrawal records, and communication history to operate securely and lawfully.',
    ctaLabel: 'Review terms',
    ctaHref: '/terms',
    highlights: ['Account, session, and MFA-related processing', 'Task, reward, and promotional telemetry', 'Wallet, withdrawal, and compliance records'],
    items: defaultItems['privacy-policy'],
  },
  terms: {
    eyebrow: 'Legal',
    title: 'Terms of service for roles, rewards, wallets, and compliance-aware operations.',
    summary: 'These terms define account eligibility, acceptable use, reward conditions, payout restrictions, communications, and enforcement rights based on implemented platform behavior.',
    body: 'Use of the service means you accept role-based controls, verification and anti-abuse checks, promotional reservation rules, wallet and withdrawal policy checks, and operational updates required to run the platform safely.',
    ctaLabel: 'Read the privacy policy',
    ctaHref: '/privacy-policy',
    highlights: ['Role-gated access and account controls', 'Conditional rewards and payout eligibility', 'Security, compliance, and enforcement rights'],
    items: defaultItems.terms,
  },
  blog: {
    eyebrow: 'Insights',
    title: 'Blog posts for trust-first growth, enterprise operations, and platform governance.',
    summary: 'This editorial stream covers campaign quality, reward integrity, payout controls, communications reliability, and enterprise rollout strategy.',
    body: 'The Go4Wealth blog is written for operators, advertisers, and enterprise decision makers who need practical guidance on scaling growth systems without sacrificing trust and control.',
    ctaLabel: 'Browse landing pages',
    ctaHref: '/landing-pages',
    highlights: ['10 enterprise-oriented insight posts', 'Trust, compliance, and payout operations focus', 'CMS-managed publishing and revision control'],
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
    title: 'Advertiser pages for enterprise onboarding, campaign control, and reporting confidence.',
    summary: 'Position advertiser operations around verification, budget discipline, lifecycle control, and measurable performance outcomes.',
    body: 'This content reflects the implemented business workspace: business registration and verification, reserve funding controls, campaign lifecycle management, submission review pathways, communications operations, analytics, and report export tooling.',
    ctaLabel: 'Open user guides',
    ctaHref: '/user-guides',
    highlights: ['Verification-aware advertiser onboarding', 'Reserve funding and lifecycle controls', 'Analytics visibility with export-ready reporting'],
    items: defaultItems['advertiser-pages'],
  },
  'user-guides': {
    eyebrow: 'Learning center',
    title: 'User guides for account setup, daily tasks, rewards, and withdrawals.',
    summary: 'These guides mirror the current product experience so users can complete onboarding, daily tasks, and payout actions with fewer errors.',
    body: 'Use this page to understand signup, sign-in, onboarding, verified task completion, gamification progression, wallet activity, withdrawal requests, and promotional reward reservations.',
    ctaLabel: 'Go back home',
    ctaHref: '/',
    highlights: ['Account creation and secure sign-in', 'Daily task completion and reward claims', 'Wallet usage and withdrawal guidance'],
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
