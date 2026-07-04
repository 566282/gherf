import { useEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { listAdminConsoleConfig } from '@/services/api/admin';
import { defaultCustomizationConfig, resolveCustomizationCssVariables } from '@/lib/customization';
import { defaultThemeConfig, resolveThemeMode, resolveThemeTokens, themeStorageEvent } from '@/lib/theme';
import type { AdminCustomizationConfig, AdminThemeConfig } from '@/types';

function applyTheme(theme: AdminThemeConfig, prefersDark: boolean): void {
  const root = document.documentElement;
  const resolvedMode = resolveThemeMode(theme, prefersDark);
  const tokens = resolveThemeTokens(theme, prefersDark);

  root.dataset.theme = resolvedMode;
  root.dataset.themeMode = theme.mode;
  root.dataset.themePalette = theme.palette;
  root.dataset.themeFont = theme.fontFamily;
  root.style.colorScheme = resolvedMode;

  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

function applyCustomization(customization: AdminCustomizationConfig): void {
  const root = document.documentElement;
  const tokens = resolveCustomizationCssVariables(customization);

  root.dataset.layoutMode = customization.layout.mode;
  root.dataset.sidebarStyle = customization.layout.sidebar;
  root.dataset.cardStyle = customization.layout.cardStyle;
  root.dataset.buttonStyle = customization.layout.buttonStyle;
  root.dataset.themePreset = customization.themePreset;

  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  let styleElement = document.getElementById('admin-custom-css') as HTMLStyleElement | null;
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'admin-custom-css';
    document.head.appendChild(styleElement);
  }

  styleElement.textContent = customization.customCss;
}

export function ThemeProvider({ children }: PropsWithChildren): JSX.Element {
  const [theme, setTheme] = useState<AdminThemeConfig>(defaultThemeConfig);
  const [customization, setCustomization] = useState<AdminCustomizationConfig>(defaultCustomizationConfig);
  const themeRef = useRef(theme);
  const customizationRef = useRef(customization);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    customizationRef.current = customization;
  }, [customization]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemChange = () => {
      applyTheme(themeRef.current, mediaQuery.matches);
    };

    const handleThemeUpdate = () => {
      void listAdminConsoleConfig()
        .then((config) => {
          setTheme(config.theme ?? defaultThemeConfig);
          setCustomization(config.customization ?? defaultCustomizationConfig);
        })
        .catch(() => {
          setTheme(defaultThemeConfig);
          setCustomization(defaultCustomizationConfig);
        });
    };

    void listAdminConsoleConfig()
      .then((config) => {
        setTheme(config.theme ?? defaultThemeConfig);
        setCustomization(config.customization ?? defaultCustomizationConfig);
      })
      .catch(() => {
        setTheme(defaultThemeConfig);
        setCustomization(defaultCustomizationConfig);
      });

    applyTheme(theme, mediaQuery.matches);
    applyCustomization(customization);
    mediaQuery.addEventListener('change', handleSystemChange);
    window.addEventListener(themeStorageEvent, handleThemeUpdate as EventListener);

    return () => {
      mediaQuery.removeEventListener('change', handleSystemChange);
      window.removeEventListener(themeStorageEvent, handleThemeUpdate as EventListener);
    };
  }, []);

  useEffect(() => {
    applyTheme(theme, window.matchMedia('(prefers-color-scheme: dark)').matches);
    applyCustomization(customization);
  }, [customization, theme]);

  return <>{children}</>;
}