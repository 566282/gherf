export type EnterpriseModuleRisk = 'Low' | 'Medium' | 'High';

export type EnterpriseModuleRecord = {
  id: string;
  name: string;
  category: string;
  status: string;
  owner: string;
  value: string;
  updatedAt: string;
  risk: EnterpriseModuleRisk;
  notes: string;
};

export type EnterpriseModuleBulkAction = {
  label: string;
  targetStatus: string;
  description: string;
};

export type EnterpriseModuleActivityItem = {
  title: string;
  description: string;
  meta: string;
};

export type EnterpriseModuleSummary = {
  label: string;
  value: string;
  note: string;
};

export type EnterpriseModuleConfig = {
  title: string;
  eyebrow: string;
  description: string;
  entityLabel: string;
  summary: EnterpriseModuleSummary[];
  bulkActions: EnterpriseModuleBulkAction[];
  records: EnterpriseModuleRecord[];
  activity: EnterpriseModuleActivityItem[];
};

type RecordSeed = [string, string, string, string, string, EnterpriseModuleRisk, string];

const baseDate = new Date('2026-07-05T12:00:00.000Z');

function daysAgo(offset: number): string {
  return new Date(baseDate.getTime() - offset * 86_400_000).toISOString();
}

function buildRecords(moduleKey: string, seeds: RecordSeed[]): EnterpriseModuleRecord[] {
  return seeds.map((seed, index) => ({
    id: `${moduleKey}-${index + 1}`,
    name: seed[0],
    category: seed[1],
    status: seed[2],
    owner: seed[3],
    value: seed[4],
    risk: seed[5],
    notes: seed[6],
    updatedAt: daysAgo(index * 2 + 1),
  }));
}

function buildActivity(moduleLabel: string): EnterpriseModuleActivityItem[] {
  return [
    {
      title: `${moduleLabel} reviewed`,
      description: `A recent change set for ${moduleLabel.toLowerCase()} was validated by an admin operator.`,
      meta: 'Activity log',
    },
    {
      title: 'CSV export completed',
      description: `Filtered rows from ${moduleLabel.toLowerCase()} were exported for offline review.`,
      meta: 'Export trail',
    },
    {
      title: 'Bulk update recorded',
      description: `Status changes from a bulk action were written to the activity stream.`,
      meta: 'Bulk action',
    },
  ];
}

export const enterpriseModuleConfigs: Record<string, EnterpriseModuleConfig> = {
  dashboardAnalytics: {
    title: 'Dashboard analytics',
    eyebrow: 'Executive reporting',
    description: 'Monitor portfolio performance, traffic quality, revenue, and funnel health from a dedicated analytics workspace.',
    entityLabel: 'Dashboard',
    summary: [
      { label: 'Dashboards tracked', value: '14', note: 'Across acquisition, retention, revenue, and operations.' },
      { label: 'Live widgets', value: '38', note: 'Refreshes every 15 minutes from reporting feeds.' },
      { label: 'Export targets', value: '4', note: 'CSV, Excel, PDF, and scheduled deliveries.' },
      { label: 'Alerts active', value: '9', note: 'Threshold alerts for conversion, fraud, and payout behavior.' },
    ],
    bulkActions: [
      { label: 'Publish selected', targetStatus: 'Published', description: 'Mark dashboards as available to stakeholders.' },
      { label: 'Archive selected', targetStatus: 'Archived', description: 'Move stale dashboards out of the active set.' },
      { label: 'Refresh selected', targetStatus: 'Refreshed', description: 'Queue a fresh data pull for the selected dashboards.' },
    ],
    records: buildRecords('dashboard-analytics', [
      ['Acquisition overview', 'Growth', 'Published', 'Growth Ops', 'CTR 4.8%', 'Medium', 'Top-of-funnel traffic trends and paid channel mix.'],
      ['Revenue snapshot', 'Finance', 'Published', 'Finance', 'USD 84.2k', 'High', 'Revenue, fees, and net margin rollups.'],
      ['Retention cohort view', 'Lifecycle', 'Refreshed', 'Analytics', '81% retention', 'Medium', 'Cohort retention by signup week and campaign source.'],
      ['Risk activity chart', 'Trust', 'Draft', 'Risk Ops', '12 alerts', 'High', 'Rolling fraud and review alerts across the platform.'],
      ['Funnel health', 'Product', 'Published', 'Data', '92% completion', 'Low', 'Signup-to-claim conversion flow and drop-off points.'],
    ]),
    activity: buildActivity('Dashboard analytics'),
  },
  adManagement: {
    title: 'Ad management',
    eyebrow: 'Growth operations',
    description: 'Run a professional multi-format advertising platform with campaign controls for launch timing, targeting, analytics, and risk review.',
    entityLabel: 'Campaign',
    summary: [
      { label: 'Ad types supported', value: '10', note: 'Banner, video, native, popup, interstitial, rewarded, slider, sidebar, homepage, and sponsored posts.' },
      { label: 'Targeting dimensions', value: '9', note: 'Country, city, device, OS, language, age, gender, interests, and referral source.' },
      { label: 'Analytics suite', value: 'CTR, CVR, revenue', note: 'Live performance tracking for clicks, conversions, and monetization.' },
      { label: 'Fraud detection', value: 'Enabled', note: 'Bot, proxy, and invalid-traffic checks with review queues.' },
    ],
    bulkActions: [
      { label: 'Launch selected', targetStatus: 'Live', description: 'Push approved campaigns into market.' },
      { label: 'Pause selected', targetStatus: 'Paused', description: 'Pause campaigns while creative or targeting is adjusted.' },
      { label: 'Optimize selected', targetStatus: 'Optimizing', description: 'Flag campaigns for bid, audience, and budget optimization.' },
    ],
    records: buildRecords('ad-management', [
      ['Homepage hero takeover', 'Homepage', 'Live', 'Media Ops', 'CTR 4.8%', 'High', 'Premium homepage unit with country, device, and age targeting.'],
      ['Rewarded video campaign', 'Rewarded', 'Optimizing', 'Performance', 'CVR 12.3%', 'Medium', 'Rewarded format tied to conversions and revenue pacing.'],
      ['Native discovery card', 'Native', 'Scheduled', 'Creative Ops', 'CTR 3.2%', 'Low', 'Soft-sell unit optimized for interests and language segments.'],
      ['Interstitial launch burst', 'Interstitial', 'Review', 'Brand', 'CTR 5.1%', 'Medium', 'Full-screen creative with fraud screening enabled.'],
      ['Sponsored post series', 'Sponsored Posts', 'Paused', 'Partnerships', 'Revenue USD 18.2k', 'Low', 'Creator-led placement with referral-source attribution.'],
    ]),
    activity: [
      {
        title: 'Campaign optimization queued',
        description: 'Bid rules and audience splits were prepared for the next optimization cycle.',
        meta: 'Optimization',
      },
      {
        title: 'Fraud review completed',
        description: 'Invalid-traffic signals were cleared before the latest campaign launch.',
        meta: 'Trust and safety',
      },
      {
        title: 'CTR report exported',
        description: 'Click-through, conversion, and revenue performance were exported for review.',
        meta: 'Analytics',
      },
    ],
  },
  videoManagement: {
    title: 'Video management',
    eyebrow: 'Content operations',
    description: 'Manage video creatives, review queues, publishing windows, and lifecycle states independently.',
    entityLabel: 'Video asset',
    summary: [
      { label: 'Published videos', value: '11', note: 'Live assets available to the marketing team.' },
      { label: 'Review queue', value: '5', note: 'Uploads awaiting moderation or caption checks.' },
      { label: 'Storage used', value: '3.6 TB', note: 'Encoded and source media combined.' },
      { label: 'Auto captions', value: '92%', note: 'Coverage across approved uploads.' },
    ],
    bulkActions: [
      { label: 'Publish selected', targetStatus: 'Published', description: 'Push reviewed videos live.' },
      { label: 'Send to review', targetStatus: 'Review', description: 'Return assets to the moderation queue.' },
      { label: 'Archive selected', targetStatus: 'Archived', description: 'Retire superseded media.' },
    ],
    records: buildRecords('video-management', [
      ['Product explainer', 'Explainers', 'Published', 'Content', '4:32', 'Low', 'Primary explainer used on the landing page.'],
      ['Feature teaser', 'Launch', 'Review', 'Creative Ops', '1:18', 'Medium', 'Short teaser queued for launch approval.'],
      ['Affiliate intro clip', 'Partnership', 'Scheduled', 'Partnerships', '0:46', 'Low', 'Partner onboarding asset for affiliate pages.'],
      ['Compliance bumper', 'Compliance', 'Archived', 'Legal', '0:21', 'High', 'Mandatory bumper for regulated flows.'],
      ['Testimonial reel', 'Social', 'Published', 'Marketing', '2:10', 'Medium', 'Customer story reel with subtitles.'],
    ]),
    activity: buildActivity('Video management'),
  },
  rewardSettings: {
    title: 'Reward settings',
    eyebrow: 'Incentive engine',
    description: 'Tune reward rules, rate limits, seasonal multipliers, and payout thresholds from a dedicated module.',
    entityLabel: 'Reward rule',
    summary: [
      { label: 'Rules enabled', value: '15', note: 'Current reward and bonus policies in force.' },
      { label: 'Pending changes', value: '3', note: 'Rules awaiting approval or rollout.' },
      { label: 'Average payout', value: 'USD 14.70', note: 'Across standard reward events.' },
      { label: 'Seasonal boosts', value: '2', note: 'Active promotional multipliers.' },
    ],
    bulkActions: [
      { label: 'Enable selected', targetStatus: 'Enabled', description: 'Turn on the selected reward rules.' },
      { label: 'Disable selected', targetStatus: 'Disabled', description: 'Pause reward issuance for the selected rules.' },
      { label: 'Review selected', targetStatus: 'Review', description: 'Send selected rules back to review.' },
    ],
    records: buildRecords('reward-settings', [
      ['Signup reward', 'Acquisition', 'Enabled', 'Lifecycle', 'USD 5.00', 'Low', 'Welcome reward issued after registration.'],
      ['Task completion bonus', 'Engagement', 'Enabled', 'Product', 'USD 2.50', 'Low', 'Awarded after verified task completion.'],
      ['Streak multiplier', 'Retention', 'Review', 'Lifecycle', '1.5x', 'Medium', 'Boost for consecutive daily activity.'],
      ['Referral reward', 'Growth', 'Enabled', 'Growth Ops', 'USD 12.00', 'High', 'Commission paid on qualified referrals.'],
      ['Campaign completion boost', 'Campaigns', 'Disabled', 'Finance', 'USD 8.00', 'Medium', 'Temporary uplift for seasonal campaigns.'],
    ]),
    activity: buildActivity('Reward settings'),
  },
  referralSettings: {
    title: 'Referral settings',
    eyebrow: 'Growth loops',
    description: 'Manage referral links, referral codes, multi-level commissions, campaign-specific referrals, milestones, leaderboards, bonuses, analytics hooks, and anti-abuse rules from one module.',
    entityLabel: 'Referral rule',
    summary: [
      { label: 'Active programs', value: '6', note: 'Referral programs currently accepting invites.' },
      { label: 'Tier rules', value: '3', note: 'Commission ladders for multi-level referrals.' },
      { label: 'Pending reviews', value: '2', note: 'Changes awaiting policy review.' },
      { label: 'Lifetime referrals', value: '18.4k', note: 'Users tracked through the referral engine.' },
    ],
    bulkActions: [
      { label: 'Activate selected', targetStatus: 'Active', description: 'Publish selected referral rules.' },
      { label: 'Suspend selected', targetStatus: 'Suspended', description: 'Pause selected referral programs.' },
      { label: 'Review selected', targetStatus: 'Review', description: 'Send selected rules to compliance review.' },
    ],
    records: buildRecords('referral-settings', [
      ['Referral links', 'Acquisition', 'Active', 'Growth Ops', 'Dynamic URL', 'Low', 'Branded invite links for acquisition campaigns.'],
      ['Referral codes', 'Identity', 'Active', 'Growth Ops', 'CODE-2401', 'Low', 'Unique codes used during signup and profile sharing.'],
      ['Tier-1 commission', 'Payouts', 'Active', 'Finance', '8%', 'Medium', 'First-tier commission for direct referrals.'],
      ['Tier-2 commission', 'Payouts', 'Review', 'Finance', '3%', 'Medium', 'Second-tier commission for extended network reach.'],
      ['Campaign-specific referrals', 'Campaigns', 'Active', 'Growth Ops', '12 campaigns', 'Medium', 'Per-campaign invite routing and reward rules.'],
      ['Referral milestones', 'Engagement', 'Active', 'Lifecycle', '5 stages', 'Medium', 'Rewards unlocked when referral thresholds are reached.'],
      ['Referral leaderboard', 'Gamification', 'Active', 'Growth Ops', 'Monthly', 'Low', 'Ranks top inviters by qualified referrals and earnings.'],
      ['Referral bonuses', 'Rewards', 'Active', 'Finance', 'USD 4.00', 'Low', 'Fixed reward for successful invites.'],
      ['Qualification window', 'Policy', 'Active', 'Risk Ops', '14 days', 'High', 'Defines when a referral remains valid.'],
      ['Fraud holdback', 'Risk', 'Suspended', 'Risk Ops', '7 days', 'High', 'Temporary reserve for suspicious referrals.'],
    ]),
    activity: buildActivity('Referral settings'),
  },
  fraudDetection: {
    title: 'Fraud detection',
    eyebrow: 'Trust and safety',
    description: 'Control scoring rules, watchlists, quarantines, and alert thresholds from an isolated fraud console.',
    entityLabel: 'Detection rule',
    summary: [
      { label: 'Active rules', value: '21', note: 'Scoring, velocity, and device rules enabled.' },
      { label: 'Quarantined cases', value: '13', note: 'Cases currently paused for investigation.' },
      { label: 'Manual reviews', value: '8', note: 'Outstanding cases assigned to the risk team.' },
      { label: 'False positives', value: '1.4%', note: 'Current tuning quality for the active model.' },
    ],
    bulkActions: [
      { label: 'Quarantine selected', targetStatus: 'Quarantined', description: 'Move selected cases into quarantine.' },
      { label: 'Block selected', targetStatus: 'Blocked', description: 'Block the selected rules or cases.' },
      { label: 'Review selected', targetStatus: 'Review', description: 'Assign selected cases to manual review.' },
    ],
    records: buildRecords('fraud-detection', [
      ['Duplicate device rule', 'Device', 'Active', 'Risk Ops', 'Score 94', 'High', 'Flags repeated device fingerprints.'],
      ['VPN anomaly watch', 'Network', 'Quarantined', 'Risk Ops', 'Score 81', 'High', 'Captures suspicious VPN usage.'],
      ['Velocity spike rule', 'Behavior', 'Active', 'Data', 'Score 76', 'Medium', 'Detects bursty signups or submissions.'],
      ['Referral abuse filter', 'Growth', 'Review', 'Growth Ops', 'Score 68', 'High', 'Checks invite loops and self-referrals.'],
      ['Manual override list', 'Operations', 'Blocked', 'Trust & Safety', '41 IDs', 'Medium', 'Staff-maintained exceptions list.'],
    ]),
    activity: buildActivity('Fraud detection'),
  },
  reports: {
    title: 'Reports',
    eyebrow: 'Export center',
    description: 'Schedule operational packs, review report ownership, and export governed outputs from a dedicated reports module.',
    entityLabel: 'Report',
    summary: [
      { label: 'Scheduled packs', value: '9', note: 'Daily, weekly, and monthly report bundles.' },
      { label: 'Recipients', value: '27', note: 'Distribution list members and shared mailboxes.' },
      { label: 'Export formats', value: '3', note: 'CSV, Excel, and PDF are available.' },
      { label: 'Latency SLA', value: '< 10m', note: 'Typical generation time for most packs.' },
    ],
    bulkActions: [
      { label: 'Schedule selected', targetStatus: 'Scheduled', description: 'Queue reports for future delivery.' },
      { label: 'Deliver selected', targetStatus: 'Delivered', description: 'Send selected report packs now.' },
      { label: 'Archive selected', targetStatus: 'Archived', description: 'Archive stale reports.' },
    ],
    records: buildRecords('reports', [
      ['Daily executive pack', 'Leadership', 'Delivered', 'Operations', '08:00 UTC', 'Low', 'Executive summary for daily operating metrics.'],
      ['Revenue digest', 'Finance', 'Scheduled', 'Finance', 'Weekly', 'High', 'Revenue, fees, and margin pack.'],
      ['Fraud watch report', 'Trust', 'Draft', 'Risk Ops', 'On demand', 'High', 'Trend report for suspicious activity.'],
      ['Campaign performance pack', 'Growth', 'Delivered', 'Growth Ops', 'Daily', 'Medium', 'Campaign spend and conversion overview.'],
      ['Referral leaderboard', 'Growth', 'Archived', 'Lifecycle', 'Monthly', 'Low', 'Referral rank list for promotional updates.'],
    ]),
    activity: buildActivity('Reports'),
  },
  withdrawalApproval: {
    title: 'Withdrawal approval',
    eyebrow: 'Finance operations',
    description: 'Review, approve, or reject pending withdrawals in a dedicated finance queue with auditability.',
    entityLabel: 'Request',
    summary: [
      { label: 'Pending requests', value: '24', note: 'Awaiting manual or hybrid review.' },
      { label: 'Approved today', value: '19', note: 'Cleared by finance and ops reviewers.' },
      { label: 'Rejected today', value: '2', note: 'Failed checks or policy violations.' },
      { label: 'Queue value', value: 'USD 48.3k', note: 'Total value waiting in the approval lane.' },
    ],
    bulkActions: [
      { label: 'Approve selected', targetStatus: 'Approved', description: 'Approve the selected payout requests.' },
      { label: 'Reject selected', targetStatus: 'Rejected', description: 'Reject the selected payout requests.' },
      { label: 'Hold selected', targetStatus: 'Held', description: 'Place the selected requests on hold.' },
    ],
    records: buildRecords('withdrawal-approval', [
      ['Bank transfer request', 'Bank', 'Pending', 'Finance', 'USD 2,400', 'High', 'Needs a second approver before release.'],
      ['Crypto payout', 'Crypto', 'Held', 'Payments', 'USD 1,100', 'High', 'Held for address verification.'],
      ['Mobile money payout', 'Mobile', 'Approved', 'Operations', 'USD 540', 'Medium', 'Approved under the hybrid workflow.'],
      ['Weekly earnings withdrawal', 'Bank', 'Pending', 'Finance', 'USD 880', 'Medium', 'Awaiting receipt validation.'],
      ['Referral commission payout', 'Bank', 'Rejected', 'Risk Ops', 'USD 210', 'High', 'Rejected due to duplicate beneficiary details.'],
    ]),
    activity: buildActivity('Withdrawal approval'),
  },
  walletManagement: {
    title: 'Wallet management',
    eyebrow: 'Treasury ledger',
    description: 'Manage balances, treasury accounts, reserves, and wallet health from a dedicated wallet module.',
    entityLabel: 'Wallet',
    summary: [
      { label: 'Wallets tracked', value: '8', note: 'Operational, reserve, escrow, and promo accounts.' },
      { label: 'Ledger balance', value: 'USD 2.6M', note: 'Combined balances across all wallets.' },
      { label: 'Holds active', value: '3', note: 'Wallets temporarily frozen or restricted.' },
      { label: 'Recent reconciliations', value: '12', note: 'Ledger checks completed this week.' },
    ],
    bulkActions: [
      { label: 'Freeze selected', targetStatus: 'Frozen', description: 'Freeze wallet access for selected accounts.' },
      { label: 'Reconcile selected', targetStatus: 'Reconciled', description: 'Mark selected wallets as reconciled.' },
      { label: 'Flag selected', targetStatus: 'Flagged', description: 'Flag the selected wallets for review.' },
    ],
    records: buildRecords('wallet-management', [
      ['Operating wallet', 'Treasury', 'Healthy', 'Finance', 'USD 1.8M', 'High', 'Primary operating treasury account.'],
      ['Promo wallet', 'Rewards', 'Healthy', 'Growth Ops', 'USD 84k', 'Medium', 'Funds used for promotional payouts.'],
      ['Escrow reserve', 'Reserve', 'Reconciled', 'Finance', 'USD 420k', 'Low', 'Reserve account for settlement buffers.'],
      ['Chargeback buffer', 'Risk', 'Flagged', 'Risk Ops', 'USD 65k', 'High', 'Dedicated buffer for reversals.'],
      ['Dormant wallet', 'Archive', 'Frozen', 'Operations', 'USD 3.4k', 'Low', 'Low activity wallet held for migration.'],
    ]),
    activity: buildActivity('Wallet management'),
  },
  systemSettings: {
    title: 'System settings',
    eyebrow: 'Platform control',
    description: 'Adjust runtime flags, maintenance windows, security defaults, and environment-level controls independently.',
    entityLabel: 'Setting',
    summary: [
      { label: 'Settings managed', value: '22', note: 'Feature toggles, defaults, and guardrails.' },
      { label: 'Live overrides', value: '7', note: 'Temporary overrides in production or staging.' },
      { label: 'Maintenance windows', value: '2', note: 'Upcoming controlled downtime periods.' },
      { label: 'Safe defaults', value: '96%', note: 'Percent of guarded settings with rollback history.' },
    ],
    bulkActions: [
      { label: 'Enable selected', targetStatus: 'Enabled', description: 'Enable the selected system settings.' },
      { label: 'Disable selected', targetStatus: 'Disabled', description: 'Disable the selected system settings.' },
      { label: 'Stage selected', targetStatus: 'Staged', description: 'Move the selected settings into staging.' },
    ],
    records: buildRecords('system-settings', [
      ['Maintenance mode', 'Availability', 'Disabled', 'Operations', 'Off', 'High', 'Global maintenance gate and messaging.'],
      ['Rate limiting', 'Security', 'Enabled', 'Security', 'On', 'High', 'API and auth throttling limits.'],
      ['Feature flag rollout', 'Release', 'Staged', 'Engineering', '25%', 'Medium', 'Controlled feature rollout schedule.'],
      ['Locale fallback', 'Localization', 'Enabled', 'Platform', 'en-US', 'Low', 'Fallback locale and translation priority.'],
      ['Backup cadence', 'Infrastructure', 'Enabled', 'Platform', 'Daily', 'Medium', 'Snapshot and restore schedule.'],
    ]),
    activity: buildActivity('System settings'),
  },
  emailTemplates: {
    title: 'Email templates',
    eyebrow: 'Messaging studio',
    description: 'Edit transactional and lifecycle email templates with governance, search, and export support.',
    entityLabel: 'Template',
    summary: [
      { label: 'Templates live', value: '12', note: 'Transactional, lifecycle, and campaign templates.' },
      { label: 'Locales', value: '4', note: 'Localized template variants available.' },
      { label: 'Brand-safe', value: '100%', note: 'Templates follow approved brand copy.' },
      { label: 'Pending edits', value: '3', note: 'Changes awaiting review or approval.' },
    ],
    bulkActions: [
      { label: 'Publish selected', targetStatus: 'Published', description: 'Publish the selected email templates.' },
      { label: 'Lock selected', targetStatus: 'Locked', description: 'Lock templates from further edits.' },
      { label: 'Review selected', targetStatus: 'Review', description: 'Send selected templates to approval.' },
    ],
    records: buildRecords('email-templates', [
      ['Welcome email', 'Onboarding', 'Published', 'Lifecycle', 'v3', 'Low', 'Welcome series sent after account creation.'],
      ['Password reset', 'Security', 'Published', 'Security', 'v2', 'High', 'Reset instructions and secure action links.'],
      ['Withdrawal approved', 'Finance', 'Review', 'Finance', 'v1', 'High', 'Approval receipt with transfer details.'],
      ['Campaign digest', 'Growth', 'Draft', 'Growth Ops', 'v4', 'Medium', 'Digest for campaign owners and operators.'],
      ['KYC reminder', 'Compliance', 'Locked', 'Compliance', 'v2', 'High', 'Template used for pending verification nudges.'],
    ]),
    activity: buildActivity('Email templates'),
  },
  notificationCenter: {
    title: 'Notification center',
    eyebrow: 'Omnichannel alerts',
    description: 'Manage email, SMS, push, in-app, WhatsApp, Telegram, admin announcements, scheduled notifications, campaign notifications, reward notifications, and system notifications from a single isolated module with templates, variables, queueing, and retry controls.',
    entityLabel: 'Notification',
    summary: [
      { label: 'Active notifications', value: '18', note: 'Templates, live campaigns, and triggered alerts currently enabled.' },
      { label: 'Channels', value: '6', note: 'Email, SMS, push, in-app, WhatsApp, and Telegram delivery.' },
      { label: 'Automation', value: '5', note: 'Admin announcements, scheduled, campaign, reward, and system notifications.' },
      { label: 'Delivery SLA', value: '99.2%', note: 'Queueing and retry handling keep delivery reliable.' },
    ],
    bulkActions: [
      { label: 'Send selected', targetStatus: 'Sent', description: 'Dispatch selected notifications immediately.' },
      { label: 'Schedule selected', targetStatus: 'Scheduled', description: 'Queue selected notifications for later.' },
      { label: 'Pause selected', targetStatus: 'Paused', description: 'Pause selected notifications.' },
    ],
    records: buildRecords('notification-center', [
      ['Reward alert', 'In-app', 'Sent', 'Lifecycle', 'Instant', 'Low', 'Notifications for new rewards and bonuses.'],
      ['Maintenance notice', 'Push', 'Scheduled', 'Operations', '15 minutes', 'High', 'Advance warning before platform downtime.'],
      ['Referral milestone', 'Email', 'Draft', 'Growth Ops', 'Daily', 'Medium', 'Milestone update for referral achievements.'],
      ['SMS fallback', 'SMS', 'Paused', 'Support', 'On demand', 'Medium', 'Fallback notification for critical alerts.'],
      ['WhatsApp broadcast', 'WhatsApp', 'Scheduled', 'Community', 'Daily', 'Low', 'Broadcast to opted-in community members.'],
      ['Telegram alert', 'Telegram', 'Sent', 'Community', 'Instant', 'Low', 'Fast update for channel subscribers and admin teams.'],
      ['Admin announcement', 'Admin announcements', 'Draft', 'Operations', 'Weekly', 'Medium', 'Internal announcement for control-plane updates.'],
      ['System retry notice', 'System notifications', 'Sent', 'Platform', 'On demand', 'High', 'Automatic retry event for failed deliveries.'],
    ]),
    activity: buildActivity('Notification center'),
  },
  supportTickets: {
    title: 'Support tickets',
    eyebrow: 'Service desk',
    description: 'Track ticket queues, SLA targets, escalations, and resolution status in an isolated support module.',
    entityLabel: 'Ticket',
    summary: [
      { label: 'Open tickets', value: '27', note: 'Unresolved issues in the active queue.' },
      { label: 'Escalated', value: '4', note: 'Cases above normal handling thresholds.' },
      { label: 'SLA hit rate', value: '94%', note: 'Percentage of tickets resolved on time.' },
      { label: 'Average age', value: '1.8d', note: 'Mean time tickets remain open.' },
    ],
    bulkActions: [
      { label: 'Close selected', targetStatus: 'Closed', description: 'Close selected tickets.' },
      { label: 'Escalate selected', targetStatus: 'Escalated', description: 'Escalate selected tickets to senior support.' },
      { label: 'Assign selected', targetStatus: 'Assigned', description: 'Assign selected tickets to a team member.' },
    ],
    records: buildRecords('support-tickets', [
      ['KYC mismatch', 'Compliance', 'Open', 'Support', '$0', 'High', 'User provided details do not match the verification record.'],
      ['Referral payout delay', 'Billing', 'Assigned', 'Finance', '$120', 'Medium', 'Investigating delayed commission payout.'],
      ['Login recovery issue', 'Access', 'Escalated', 'Security', '$0', 'High', 'Two-factor recovery flow needs review.'],
      ['Campaign budget question', 'Campaigns', 'Closed', 'Growth Ops', '$0', 'Low', 'Budget explanation delivered to the advertiser.'],
      ['Withdrawal status check', 'Finance', 'Open', 'Payments', '$540', 'Medium', 'Customer requested an update on queue position.'],
    ]),
    activity: buildActivity('Support tickets'),
  },
  permissions: {
    title: 'Permissions',
    eyebrow: 'Access control',
    description: 'Review role permissions, route ownership, and administrative access boundaries independently from other modules.',
    entityLabel: 'Permission',
    summary: [
      { label: 'Roles defined', value: '9', note: 'Distinct access profiles across the platform.' },
      { label: 'Scoped grants', value: '41', note: 'Fine-grained grants assigned by module and action.' },
      { label: 'Denied actions', value: '12', note: 'Blocked attempts captured in policy logs.' },
      { label: 'Admins enabled', value: '6', note: 'Accounts with broad platform access.' },
    ],
    bulkActions: [
      { label: 'Grant selected', targetStatus: 'Granted', description: 'Grant the selected permissions.' },
      { label: 'Revoke selected', targetStatus: 'Revoked', description: 'Revoke the selected permissions.' },
      { label: 'Review selected', targetStatus: 'Review', description: 'Send selected permissions back to review.' },
    ],
    records: buildRecords('permissions', [
      ['Admin console access', 'Admin', 'Granted', 'Security', 'Full', 'High', 'Full access to the administrative shell.'],
      ['Campaign editor', 'Growth', 'Granted', 'Growth Ops', 'Edit', 'Medium', 'Create and update campaign definitions.'],
      ['Wallet approver', 'Finance', 'Review', 'Finance', 'Approve', 'High', 'Can approve withdrawal and treasury changes.'],
      ['Support responder', 'Service', 'Granted', 'Support', 'Reply', 'Medium', 'Respond to customer issues.'],
      ['Fraud reviewer', 'Trust', 'Revoked', 'Risk Ops', 'View', 'High', 'Read-only access for risk investigators.'],
    ]),
    activity: buildActivity('Permissions'),
  },
  auditLogs: {
    title: 'Audit logs',
    eyebrow: 'Activity trail',
    description: 'Inspect administrative and system actions with search, filters, export, pagination, and sorting.',
    entityLabel: 'Event',
    summary: [
      { label: 'Events captured', value: '128k', note: 'Cumulative admin and system actions.' },
      { label: 'Today', value: '1,240', note: 'Events captured in the latest day.' },
      { label: 'High risk', value: '38', note: 'Events tagged for additional review.' },
      { label: 'Exported logs', value: '15', note: 'Recent log extracts downloaded by staff.' },
    ],
    bulkActions: [
      { label: 'Mark reviewed', targetStatus: 'Reviewed', description: 'Mark selected log events as reviewed.' },
      { label: 'Flag selected', targetStatus: 'Flagged', description: 'Flag selected events for follow-up.' },
      { label: 'Archive selected', targetStatus: 'Archived', description: 'Archive selected log entries.' },
    ],
    records: buildRecords('audit-logs', [
      ['Permission granted', 'Security', 'Reviewed', 'Security', 'Full', 'Medium', 'Admin access granted to a new reviewer.'],
      ['Withdrawal approved', 'Finance', 'Flagged', 'Finance', 'USD 540', 'High', 'Manual approval completed in queue.'],
      ['Template published', 'Content', 'Reviewed', 'Lifecycle', 'v3', 'Low', 'Email template rollout recorded.'],
      ['Wallet reconciled', 'Treasury', 'Archived', 'Finance', 'Complete', 'Medium', 'Ledger reconciliation completed.'],
      ['Fraud rule updated', 'Trust', 'Reviewed', 'Risk Ops', 'Score 81', 'High', 'Fraud scoring threshold changed.'],
    ]),
    activity: buildActivity('Audit logs'),
  },
};