import { getSetting } from '../lib/settings';
import { useApp, useSettingsVersion } from '../state/store';
import { buildThemeCss, parseSurfaceTheme, SETTING_KEY, type ThemeSurface } from '../lib/theme';

export function ThemeVarsInjector({ surface }: { surface: ThemeSurface }) {
  useApp();
  useSettingsVersion();
  const theme = parseSurfaceTheme(getSetting(SETTING_KEY[surface]));
  const css = buildThemeCss(surface, theme);
  if (!css) return null;
  return <style>{css}</style>;
}
