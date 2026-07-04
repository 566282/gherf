import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--color-background) / <alpha-value>)',
        foreground: 'hsl(var(--color-foreground) / <alpha-value>)',
        surface: 'hsl(var(--color-surface) / <alpha-value>)',
        'surface-elevated': 'hsl(var(--color-surface-elevated) / <alpha-value>)',
        muted: 'hsl(var(--color-muted) / <alpha-value>)',
        border: 'hsl(var(--color-border) / <alpha-value>)',
        accent: 'hsl(var(--color-accent) / <alpha-value>)',
        'accent-soft': 'hsl(var(--color-accent-soft) / <alpha-value>)',
        'accent-strong': 'hsl(var(--color-accent-strong) / <alpha-value>)',
        'accent-foreground': 'hsl(var(--color-accent-foreground) / <alpha-value>)',
        success: 'hsl(var(--color-success) / <alpha-value>)',
        warning: 'hsl(var(--color-warning) / <alpha-value>)',
        error: 'hsl(var(--color-error) / <alpha-value>)',
        info: 'hsl(var(--color-info) / <alpha-value>)',
        'chart-1': 'hsl(var(--chart-1) / <alpha-value>)',
        'chart-2': 'hsl(var(--chart-2) / <alpha-value>)',
        'chart-3': 'hsl(var(--chart-3) / <alpha-value>)',
        'chart-4': 'hsl(var(--chart-4) / <alpha-value>)',
        'chart-5': 'hsl(var(--chart-5) / <alpha-value>)',
        'chart-6': 'hsl(var(--chart-6) / <alpha-value>)',
        ink: 'hsl(var(--color-background) / <alpha-value>)',
        mist: 'hsl(var(--color-foreground) / <alpha-value>)',
        slate: 'hsl(var(--color-surface-elevated) / <alpha-value>)',
        ember: 'hsl(var(--color-accent) / <alpha-value>)',
        mint: 'hsl(var(--color-success) / <alpha-value>)',
      },
      boxShadow: {
        depth: '0 24px 70px hsl(var(--color-background) / 0.24)',
      },
      borderRadius: {
        card: '1rem',
      },
      backgroundImage: {
        hero: 'radial-gradient(circle at 18% 10%, hsl(var(--color-accent) / 0.18), transparent 34%), radial-gradient(circle at 82% 0%, hsl(var(--color-success) / 0.12), transparent 28%), linear-gradient(160deg, hsl(var(--color-background)) 0%, hsl(var(--color-surface)) 45%, hsl(var(--color-background)) 100%)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
      },
    },
  },
  plugins: [],
} satisfies Config;
