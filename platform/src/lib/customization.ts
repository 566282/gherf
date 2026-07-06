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

  const branding = isRecord(value.branding) ? value.branding : undefined;
  const layout = isRecord(value.layout) ? value.layout : undefined;
  const trust = isRecord(value.trust) ? value.trust : undefined;
  const templates = isRecord(value.templates) ? value.templates : undefined;
  const tokens = isRecord(value.tokens) ? value.tokens : undefined;

  return {
    themePreset: themePresetOptions.some((option) => option.value === value.themePreset) ? (value.themePreset as ThemePreset) : defaultCustomizationConfig.themePreset,
    customCss: typeof value.customCss === 'string' ? value.customCss : defaultCustomizationConfig.customCss,
    branding: {
      logoMark: toStringValue(branding?.logoMark, defaultBranding.logoMark),
      logoText: toStringValue(branding?.logoText, defaultBranding.logoText),
      iconStyle: branding?.iconStyle === 'line' || branding?.iconStyle === 'solid' || branding?.iconStyle === 'duotone' ? branding.iconStyle : defaultBranding.iconStyle,
    },
    layout: {
      mode: layout?.mode === 'stacked' || layout?.mode === 'sidebar' || layout?.mode === 'split' ? layout.mode : defaultLayout.mode,
      sidebar: layout?.sidebar === 'compact' ? 'compact' : defaultLayout.sidebar,
      dashboardWidgets: layout?.dashboardWidgets === 'stacked' || layout?.dashboardWidgets === 'bento' || layout?.dashboardWidgets === 'dense' ? layout.dashboardWidgets : defaultLayout.dashboardWidgets,
      landingPageSections: layout?.landingPageSections === 'full' || layout?.landingPageSections === 'focused' || layout?.landingPageSections === 'minimal' ? layout.landingPageSections : defaultLayout.landingPageSections,
      navigation: layout?.navigation === 'top' || layout?.navigation === 'side' || layout?.navigation === 'hybrid' ? layout.navigation : defaultLayout.navigation,
      buttonStyle: layout?.buttonStyle === 'rounded' || layout?.buttonStyle === 'pill' || layout?.buttonStyle === 'sharp' ? layout.buttonStyle : defaultLayout.buttonStyle,
      cardStyle: layout?.cardStyle === 'flat' || layout?.cardStyle === 'elevated' || layout?.cardStyle === 'glass' ? layout.cardStyle : defaultLayout.cardStyle,
    },
    trust: {
      sslSecurityIndicators: toBoolean(trust?.sslSecurityIndicators, defaultTrust.sslSecurityIndicators),
      verifiedAdvertiserBadges: toBoolean(trust?.verifiedAdvertiserBadges, defaultTrust.verifiedAdvertiserBadges),
      verifiedUserBadges: toBoolean(trust?.verifiedUserBadges, defaultTrust.verifiedUserBadges),
      realTimeStatistics: toBoolean(trust?.realTimeStatistics, defaultTrust.realTimeStatistics),
      transparentPayoutHistory: toBoolean(trust?.transparentPayoutHistory, defaultTrust.transparentPayoutHistory),
      auditLogs: toBoolean(trust?.auditLogs, defaultTrust.auditLogs),
      fraudProtectionMessaging: toBoolean(trust?.fraudProtectionMessaging, defaultTrust.fraudProtectionMessaging),
      userTestimonials: toBoolean(trust?.userTestimonials, defaultTrust.userTestimonials),
      professionalCertifications: toBoolean(trust?.professionalCertifications, defaultTrust.professionalCertifications),
      systemStatusIndicators: toBoolean(trust?.systemStatusIndicators, defaultTrust.systemStatusIndicators),
    },
    templates: {
      campaignTemplate: templates?.campaignTemplate === 'starter' || templates?.campaignTemplate === 'balanced' || templates?.campaignTemplate === 'premium' ? templates.campaignTemplate : defaultTemplates.campaignTemplate,
      emailTemplate: templates?.emailTemplate === 'starter' || templates?.emailTemplate === 'balanced' || templates?.emailTemplate === 'premium' ? templates.emailTemplate : defaultTemplates.emailTemplate,
      notificationTemplate: templates?.notificationTemplate === 'starter' || templates?.notificationTemplate === 'balanced' || templates?.notificationTemplate === 'premium' ? templates.notificationTemplate : defaultTemplates.notificationTemplate,
      rewardRules: templates?.rewardRules === 'starter' || templates?.rewardRules === 'balanced' || templates?.rewardRules === 'premium' ? templates.rewardRules : defaultTemplates.rewardRules,
    },
    tokens: {
      spacing: tokens?.spacing === 'compact' || tokens?.spacing === 'balanced' || tokens?.spacing === 'cozy' ? tokens.spacing : defaultTokens.spacing,
      typography: themeFontOptions.some((option) => option.value === tokens?.typography) ? tokens.typography : defaultTokens.typography,
      radius: tokens?.radius === 'sharp' || tokens?.radius === 'balanced' || tokens?.radius === 'soft' ? tokens.radius : defaultTokens.radius,
      elevation: tokens?.elevation === 'flat' || tokens?.elevation === 'layered' || tokens?.elevation === 'floating' ? tokens.elevation : defaultTokens.elevation,
      animations: tokens?.animations === 'calm' || tokens?.animations === 'polished' || tokens?.animations === 'expressive' ? tokens.animations : defaultTokens.animations,
      icons: tokens?.icons === 'line' || tokens?.icons === 'solid' || tokens?.icons === 'duotone' ? tokens.icons : defaultTokens.icons,
      transitions: tokens?.transitions === 'snappy' || tokens?.transitions === 'standard' || tokens?.transitions === 'slow' ? tokens.transitions : defaultTokens.transitions,
      opacity: tokens?.opacity === 'subtle' || tokens?.opacity === 'balanced' || tokens?.opacity === 'bold' ? tokens.opacity : defaultTokens.opacity,
      gridSystem: tokens?.gridSystem === '12-column' || tokens?.gridSystem === '14-column' || tokens?.gridSystem === '16-column' ? tokens.gridSystem : defaultTokens.gridSystem,
      breakpoints: tokens?.breakpoints === 'standard' || tokens?.breakpoints === 'touch-optimized' || tokens?.breakpoints === 'foldable-aware' ? tokens.breakpoints : defaultTokens.breakpoints,
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