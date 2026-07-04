import { defaultThemeConfig, getThemeFontStack, themeFontOptions } from '@/lib/theme';
import type {
  AdminBrandingConfig,
  AdminCustomizationConfig,
  AdminLayoutConfig,
  AdminTemplateConfig,
  AdminTokenConfig,
  AdminTrustConfig,
  ThemePreset,
} from '@/types';

export const customizationStorageEvent = 'admin-theme-updated';

export const themePresetOptions: Array<{ label: string; value: ThemePreset; description: string; theme: typeof defaultThemeConfig }> = [
  { label: 'Classic Fintech', value: 'classic', description: 'Balanced blue surfaces with the default brand tone.', theme: { mode: 'auto', palette: 'deep-blue', fontFamily: 'Inter' } },
  { label: 'Editorial', value: 'editorial', description: 'A sharper dark-led presentation with premium contrast.', theme: { mode: 'dark', palette: 'indigo', fontFamily: 'Plus Jakarta Sans' } },
  { label: 'Growth', value: 'growth', description: 'Fresh, energetic surfaces for acquisition campaigns.', theme: { mode: 'light', palette: 'emerald', fontFamily: 'Geist' } },
  { label: 'High Contrast', value: 'contrast', description: 'Accessibility-first contrast with stronger text treatment.', theme: { mode: 'dark', palette: 'royal-blue', fontFamily: 'Inter' } },
  { label: 'Custom', value: 'custom', description: 'Manually tuned settings that do not follow a preset.', theme: defaultThemeConfig },
];

const defaultBranding: AdminBrandingConfig = {
  logoMark: 'G',
  logoText: 'Go4Wealth',
  iconStyle: 'duotone',
};

const defaultLayout: AdminLayoutConfig = {
  mode: 'sidebar',
  sidebar: 'expanded',
  dashboardWidgets: 'bento',
  landingPageSections: 'full',
  navigation: 'hybrid',
  buttonStyle: 'pill',
  cardStyle: 'glass',
};

const defaultTrust: AdminTrustConfig = {
  sslSecurityIndicators: true,
  verifiedAdvertiserBadges: true,
  verifiedUserBadges: true,
  realTimeStatistics: true,
  transparentPayoutHistory: true,
  auditLogs: true,
  fraudProtectionMessaging: true,
  userTestimonials: true,
  professionalCertifications: true,
  systemStatusIndicators: true,
};

const defaultTemplates: AdminTemplateConfig = {
  campaignTemplate: 'balanced',
  emailTemplate: 'starter',
  notificationTemplate: 'starter',
  rewardRules: 'balanced',
};

const defaultTokens: AdminTokenConfig = {
  spacing: 'balanced',
  typography: defaultThemeConfig.fontFamily,
  radius: 'balanced',
  elevation: 'layered',
  animations: 'polished',
  icons: 'duotone',
  transitions: 'standard',
  opacity: 'balanced',
  gridSystem: '12-column',
  breakpoints: 'standard',
};

export const defaultCustomizationConfig: AdminCustomizationConfig = {
  themePreset: 'classic',
  customCss: '',
  branding: defaultBranding,
  layout: defaultLayout,
  trust: defaultTrust,
  templates: defaultTemplates,
  tokens: defaultTokens,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function toStringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

export function mergeCustomizationConfig(value: unknown): AdminCustomizationConfig {
  if (!isRecord(value)) {
    return defaultCustomizationConfig;
  }

  return {
    themePreset: themePresetOptions.some((option) => option.value === value.themePreset) ? (value.themePreset as ThemePreset) : defaultCustomizationConfig.themePreset,
    customCss: typeof value.customCss === 'string' ? value.customCss : defaultCustomizationConfig.customCss,
    branding: {
      logoMark: toStringValue(value.branding?.logoMark, defaultBranding.logoMark),
      logoText: toStringValue(value.branding?.logoText, defaultBranding.logoText),
      iconStyle: value.branding?.iconStyle === 'line' || value.branding?.iconStyle === 'solid' || value.branding?.iconStyle === 'duotone' ? value.branding.iconStyle : defaultBranding.iconStyle,
    },
    layout: {
      mode: value.layout?.mode === 'stacked' || value.layout?.mode === 'sidebar' || value.layout?.mode === 'split' ? value.layout.mode : defaultLayout.mode,
      sidebar: value.layout?.sidebar === 'compact' ? 'compact' : defaultLayout.sidebar,
      dashboardWidgets: value.layout?.dashboardWidgets === 'stacked' || value.layout?.dashboardWidgets === 'bento' || value.layout?.dashboardWidgets === 'dense' ? value.layout.dashboardWidgets : defaultLayout.dashboardWidgets,
      landingPageSections: value.layout?.landingPageSections === 'full' || value.layout?.landingPageSections === 'focused' || value.layout?.landingPageSections === 'minimal' ? value.layout.landingPageSections : defaultLayout.landingPageSections,
      navigation: value.layout?.navigation === 'top' || value.layout?.navigation === 'side' || value.layout?.navigation === 'hybrid' ? value.layout.navigation : defaultLayout.navigation,
      buttonStyle: value.layout?.buttonStyle === 'rounded' || value.layout?.buttonStyle === 'pill' || value.layout?.buttonStyle === 'sharp' ? value.layout.buttonStyle : defaultLayout.buttonStyle,
      cardStyle: value.layout?.cardStyle === 'flat' || value.layout?.cardStyle === 'elevated' || value.layout?.cardStyle === 'glass' ? value.layout.cardStyle : defaultLayout.cardStyle,
    },
    trust: {
      sslSecurityIndicators: toBoolean(value.trust?.sslSecurityIndicators, defaultTrust.sslSecurityIndicators),
      verifiedAdvertiserBadges: toBoolean(value.trust?.verifiedAdvertiserBadges, defaultTrust.verifiedAdvertiserBadges),
      verifiedUserBadges: toBoolean(value.trust?.verifiedUserBadges, defaultTrust.verifiedUserBadges),
      realTimeStatistics: toBoolean(value.trust?.realTimeStatistics, defaultTrust.realTimeStatistics),
      transparentPayoutHistory: toBoolean(value.trust?.transparentPayoutHistory, defaultTrust.transparentPayoutHistory),
      auditLogs: toBoolean(value.trust?.auditLogs, defaultTrust.auditLogs),
      fraudProtectionMessaging: toBoolean(value.trust?.fraudProtectionMessaging, defaultTrust.fraudProtectionMessaging),
      userTestimonials: toBoolean(value.trust?.userTestimonials, defaultTrust.userTestimonials),
      professionalCertifications: toBoolean(value.trust?.professionalCertifications, defaultTrust.professionalCertifications),
      systemStatusIndicators: toBoolean(value.trust?.systemStatusIndicators, defaultTrust.systemStatusIndicators),
    },
    templates: {
      campaignTemplate: value.templates?.campaignTemplate === 'starter' || value.templates?.campaignTemplate === 'balanced' || value.templates?.campaignTemplate === 'premium' ? value.templates.campaignTemplate : defaultTemplates.campaignTemplate,
      emailTemplate: value.templates?.emailTemplate === 'starter' || value.templates?.emailTemplate === 'balanced' || value.templates?.emailTemplate === 'premium' ? value.templates.emailTemplate : defaultTemplates.emailTemplate,
      notificationTemplate: value.templates?.notificationTemplate === 'starter' || value.templates?.notificationTemplate === 'balanced' || value.templates?.notificationTemplate === 'premium' ? value.templates.notificationTemplate : defaultTemplates.notificationTemplate,
      rewardRules: value.templates?.rewardRules === 'starter' || value.templates?.rewardRules === 'balanced' || value.templates?.rewardRules === 'premium' ? value.templates.rewardRules : defaultTemplates.rewardRules,
    },
    tokens: {
      spacing: value.tokens?.spacing === 'compact' || value.tokens?.spacing === 'balanced' || value.tokens?.spacing === 'cozy' ? value.tokens.spacing : defaultTokens.spacing,
      typography: themeFontOptions.some((option) => option.value === value.tokens?.typography) ? value.tokens.typography : defaultTokens.typography,
      radius: value.tokens?.radius === 'sharp' || value.tokens?.radius === 'balanced' || value.tokens?.radius === 'soft' ? value.tokens.radius : defaultTokens.radius,
      elevation: value.tokens?.elevation === 'flat' || value.tokens?.elevation === 'layered' || value.tokens?.elevation === 'floating' ? value.tokens.elevation : defaultTokens.elevation,
      animations: value.tokens?.animations === 'calm' || value.tokens?.animations === 'polished' || value.tokens?.animations === 'expressive' ? value.tokens.animations : defaultTokens.animations,
      icons: value.tokens?.icons === 'line' || value.tokens?.icons === 'solid' || value.tokens?.icons === 'duotone' ? value.tokens.icons : defaultTokens.icons,
      transitions: value.tokens?.transitions === 'snappy' || value.tokens?.transitions === 'standard' || value.tokens?.transitions === 'slow' ? value.tokens.transitions : defaultTokens.transitions,
      opacity: value.tokens?.opacity === 'subtle' || value.tokens?.opacity === 'balanced' || value.tokens?.opacity === 'bold' ? value.tokens.opacity : defaultTokens.opacity,
      gridSystem: value.tokens?.gridSystem === '12-column' || value.tokens?.gridSystem === '14-column' || value.tokens?.gridSystem === '16-column' ? value.tokens.gridSystem : defaultTokens.gridSystem,
      breakpoints: value.tokens?.breakpoints === 'standard' || value.tokens?.breakpoints === 'touch-optimized' || value.tokens?.breakpoints === 'foldable-aware' ? value.tokens.breakpoints : defaultTokens.breakpoints,
    },
  };
}

export function resolveCustomizationCssVariables(config: AdminCustomizationConfig): Record<string, string> {
  const spacingMap: Record<AdminTokenConfig['spacing'], string> = {
    compact: '0.75rem',
    balanced: '1rem',
    cozy: '1.25rem',
  };

  const radiusMap: Record<AdminTokenConfig['radius'], string> = {
    sharp: '0.75rem',
    balanced: '1rem',
    soft: '1.5rem',
  };

  const elevationMap: Record<AdminTokenConfig['elevation'], string> = {
    flat: 'none',
    layered: '0 18px 45px hsl(var(--color-background) / 0.16)',
    floating: '0 28px 70px hsl(var(--color-background) / 0.24)',
  };

  const animationMap: Record<AdminTokenConfig['animations'], string> = {
    calm: '180ms',
    polished: '260ms',
    expressive: '360ms',
  };

  const transitionMap: Record<AdminTokenConfig['transitions'], string> = {
    snappy: '120ms',
    standard: '200ms',
    slow: '320ms',
  };

  const opacityMap: Record<AdminTokenConfig['opacity'], string> = {
    subtle: '0.56',
    balanced: '0.72',
    bold: '0.88',
  };

  const gridMap: Record<AdminTokenConfig['gridSystem'], string> = {
    '12-column': '12',
    '14-column': '14',
    '16-column': '16',
  };

  const layoutMap: Record<AdminLayoutConfig['mode'], string> = {
    stacked: 'stacked',
    sidebar: 'sidebar',
    split: 'split',
  };

  return {
    '--custom-spacing-unit': spacingMap[config.tokens.spacing],
    '--custom-radius-card': radiusMap[config.tokens.radius],
    '--custom-radius-pill': config.layout.buttonStyle === 'sharp' ? '0.75rem' : config.layout.buttonStyle === 'rounded' ? '999rem' : '1.5rem',
    '--custom-shadow-depth': elevationMap[config.tokens.elevation],
    '--custom-animation-duration': animationMap[config.tokens.animations],
    '--custom-transition-duration': transitionMap[config.tokens.transitions],
    '--custom-opacity-muted': opacityMap[config.tokens.opacity],
    '--custom-grid-columns': gridMap[config.tokens.gridSystem],
    '--custom-sidebar-width': config.layout.sidebar === 'compact' ? '17rem' : '21rem',
    '--custom-layout-mode': layoutMap[config.layout.mode],
    '--font-sans': getThemeFontStack(config.tokens.typography),
  };
}