import type { AdminThemeConfig, ThemeMode, ThemePalette, ThemePreset } from '@/types';

export const themeStorageEvent = 'admin-theme-updated';

export const defaultThemeConfig: AdminThemeConfig = {
  mode: 'auto',
  palette: 'deep-blue',
  fontFamily: 'Inter',
};

export const themeModeOptions: Array<{ label: string; value: ThemeMode; description: string }> = [
  { label: 'Light mode', value: 'light', description: 'Bright, airy surfaces with softer contrast.' },
  { label: 'Dark mode', value: 'dark', description: 'Deep, editorial surfaces for premium dashboards.' },
  { label: 'Auto mode', value: 'auto', description: 'Follow the operating system preference.' },
];

export const themePaletteOptions: Array<{ label: string; value: ThemePalette; description: string }> = [
  { label: 'Deep Blue', value: 'deep-blue', description: 'Balanced fintech blue with crisp contrast.' },
  { label: 'Royal Blue', value: 'royal-blue', description: 'Brighter hero blue for high-energy product surfaces.' },
  { label: 'Emerald', value: 'emerald', description: 'Fresh, growth-oriented green with calm secondary tones.' },
  { label: 'Indigo', value: 'indigo', description: 'Editorial indigo with a more refined premium feel.' },
];

export const themeFontOptions = [
  { label: 'Inter', value: 'Inter' },
  { label: 'Geist', value: 'Geist' },
  { label: 'Plus Jakarta Sans', value: 'Plus Jakarta Sans' },
] as const;

export const themePresetOptions: Array<{
  label: string;
  value: ThemePreset;
  description: string;
  theme: AdminThemeConfig;
}> = [
  { label: 'Classic Fintech', value: 'classic', description: 'Balanced default styling with calm blue surfaces.', theme: { mode: 'auto', palette: 'deep-blue', fontFamily: 'Inter' } },
  { label: 'Editorial', value: 'editorial', description: 'A sharper dark-led presentation with premium contrast.', theme: { mode: 'dark', palette: 'indigo', fontFamily: 'Plus Jakarta Sans' } },
  { label: 'Growth', value: 'growth', description: 'Fresh, energetic surfaces for acquisition campaigns.', theme: { mode: 'light', palette: 'emerald', fontFamily: 'Geist' } },
  { label: 'High Contrast', value: 'contrast', description: 'Accessibility-first contrast with stronger text treatment.', theme: { mode: 'dark', palette: 'royal-blue', fontFamily: 'Inter' } },
  {
    label: 'Custom',
    value: 'custom',
    description: 'Manually tuned settings that do not follow a preset.',
    theme: defaultThemeConfig,
  },
];

export function getThemePresetTheme(preset: ThemePreset): AdminThemeConfig {
  return themePresetOptions.find((option) => option.value === preset)?.theme ?? defaultThemeConfig;
}

const fontStacks: Record<AdminThemeConfig['fontFamily'], string> = {
  Inter: "'Inter', 'Segoe UI', system-ui, sans-serif",
  Geist: "'Geist', 'Inter', 'Segoe UI', system-ui, sans-serif",
  'Plus Jakarta Sans': "'Plus Jakarta Sans', 'Inter', 'Segoe UI', system-ui, sans-serif",
};

const baseTokens = {
  light: {
    '--color-background': '220 38% 98%',
    '--color-foreground': '222 47% 11%',
    '--color-surface': '0 0% 100%',
    '--color-surface-elevated': '220 29% 96%',
    '--color-muted': '221 14% 42%',
    '--color-border': '215 18% 87%',
    '--color-accent-foreground': '0 0% 100%',
    '--color-success': '151 61% 37%',
    '--color-warning': '38 92% 50%',
    '--color-error': '0 84% 61%',
    '--color-info': '199 89% 48%',
    '--color-surface-glow': '220 40% 100%',
  },
  dark: {
    '--color-background': '221 47% 8%',
    '--color-foreground': '210 40% 96%',
    '--color-surface': '221 38% 12%',
    '--color-surface-elevated': '221 31% 16%',
    '--color-muted': '215 18% 66%',
    '--color-border': '219 25% 22%',
    '--color-accent-foreground': '223 52% 10%',
    '--color-success': '151 61% 53%',
    '--color-warning': '38 92% 60%',
    '--color-error': '0 84% 68%',
    '--color-info': '199 89% 58%',
    '--color-surface-glow': '221 38% 15%',
  },
} as const;

const paletteTokens: Record<ThemePalette, { light: Record<string, string>; dark: Record<string, string> }> = {
  'deep-blue': {
    light: {
      '--color-accent': '214 86% 46%',
      '--color-accent-soft': '214 90% 94%',
      '--color-accent-strong': '221 83% 38%',
      '--chart-1': '214 86% 38%',
      '--chart-2': '199 89% 42%',
      '--chart-3': '158 64% 36%',
      '--chart-4': '252 70% 50%',
      '--chart-5': '38 92% 47%',
      '--chart-6': '0 84% 55%',
    },
    dark: {
      '--color-accent': '214 92% 62%',
      '--color-accent-soft': '214 80% 18%',
      '--color-accent-strong': '214 92% 68%',
      '--chart-1': '214 90% 66%',
      '--chart-2': '199 89% 61%',
      '--chart-3': '158 72% 58%',
      '--chart-4': '252 84% 71%',
      '--chart-5': '38 92% 63%',
      '--chart-6': '0 84% 69%',
    },
  },
  'royal-blue': {
    light: {
      '--color-accent': '222 88% 44%',
      '--color-accent-soft': '222 88% 94%',
      '--color-accent-strong': '222 82% 36%',
      '--chart-1': '222 88% 40%',
      '--chart-2': '258 70% 47%',
      '--chart-3': '160 64% 36%',
      '--chart-4': '199 89% 42%',
      '--chart-5': '38 92% 47%',
      '--chart-6': '0 84% 55%',
    },
    dark: {
      '--color-accent': '222 92% 64%',
      '--color-accent-soft': '222 82% 18%',
      '--color-accent-strong': '222 92% 70%',
      '--chart-1': '222 92% 68%',
      '--chart-2': '258 82% 72%',
      '--chart-3': '160 72% 58%',
      '--chart-4': '199 89% 61%',
      '--chart-5': '38 92% 63%',
      '--chart-6': '0 84% 69%',
    },
  },
  emerald: {
    light: {
      '--color-accent': '158 64% 39%',
      '--color-accent-soft': '158 74% 93%',
      '--color-accent-strong': '158 62% 30%',
      '--chart-1': '158 64% 34%',
      '--chart-2': '214 80% 43%',
      '--chart-3': '252 70% 50%',
      '--chart-4': '199 89% 42%',
      '--chart-5': '38 92% 47%',
      '--chart-6': '0 84% 55%',
    },
    dark: {
      '--color-accent': '158 72% 55%',
      '--color-accent-soft': '158 66% 17%',
      '--color-accent-strong': '158 72% 61%',
      '--chart-1': '158 72% 59%',
      '--chart-2': '214 92% 64%',
      '--chart-3': '252 84% 70%',
      '--chart-4': '199 89% 61%',
      '--chart-5': '38 92% 63%',
      '--chart-6': '0 84% 69%',
    },
  },
  indigo: {
    light: {
      '--color-accent': '247 72% 54%',
      '--color-accent-soft': '247 82% 94%',
      '--color-accent-strong': '247 70% 40%',
      '--chart-1': '247 72% 44%',
      '--chart-2': '222 88% 44%',
      '--chart-3': '158 64% 39%',
      '--chart-4': '199 89% 42%',
      '--chart-5': '38 92% 47%',
      '--chart-6': '0 84% 55%',
    },
    dark: {
      '--color-accent': '247 84% 69%',
      '--color-accent-soft': '247 74% 19%',
      '--color-accent-strong': '247 84% 74%',
      '--chart-1': '247 84% 72%',
      '--chart-2': '222 92% 66%',
      '--chart-3': '158 72% 58%',
      '--chart-4': '199 89% 61%',
      '--chart-5': '38 92% 63%',
      '--chart-6': '0 84% 69%',
    },
  },
};

function resolveMode(mode: AdminThemeConfig['mode'], prefersDark: boolean): 'light' | 'dark' {
  if (mode === 'auto') {
    return prefersDark ? 'dark' : 'light';
  }

  return mode;
}

export function resolveThemeTokens(config: AdminThemeConfig, prefersDark: boolean): Record<string, string> {
  const resolvedMode = resolveMode(config.mode, prefersDark);
  const base = baseTokens[resolvedMode];
  const palette = paletteTokens[config.palette][resolvedMode];

  return {
    ...base,
    ...palette,
    '--font-sans': fontStacks[config.fontFamily],
  };
}

export function resolveThemeMode(config: AdminThemeConfig, prefersDark: boolean): 'light' | 'dark' {
  return resolveMode(config.mode, prefersDark);
}

export function getThemeFontStack(fontFamily: AdminThemeConfig['fontFamily']): string {
  return fontStacks[fontFamily];
}