export type ThemeSurface = 'website' | 'dashboard';
export type ThemeModeKey = 'light' | 'dark';

export interface BlockTokens {
  bg?: string;
  bgOpacity?: number;
  text?: string;
  border?: string;
  accent?: string;
}
export type BlockThemeMap = Record<string, BlockTokens>;
export interface SurfaceTheme { light: BlockThemeMap; dark: BlockThemeMap; }

export type ColorFieldKey = 'bg' | 'text' | 'border' | 'accent';
export interface BlockDef { id: string; label: string; fields: ColorFieldKey[]; opacity?: boolean; }

export const THEME_CATALOG: Record<ThemeSurface, BlockDef[]> = {
  website: [
    { id: 'header', label: 'Header / Navbar', fields: ['bg', 'text', 'border'], opacity: true },
    { id: 'hero', label: 'Hero Section', fields: ['bg', 'text', 'accent'] },
    { id: 'card', label: 'Card (Kelas, Artikel, Kategori, Instructor, dll)', fields: ['bg', 'text', 'border', 'accent'] },
    { id: 'cta', label: 'CTA Band', fields: ['bg', 'text'] },
    { id: 'footer', label: 'Footer', fields: ['bg', 'text', 'border'], opacity: true },
    { id: 'button_primary', label: 'Tombol Utama', fields: ['bg', 'text', 'accent'] },
    { id: 'page', label: 'Latar Halaman', fields: ['bg', 'text'] },
  ],
  dashboard: [
    { id: 'sidebar', label: 'Sidebar', fields: ['bg', 'text', 'border', 'accent'] },
    { id: 'topbar', label: 'Topbar', fields: ['bg', 'text', 'border'], opacity: true },
    { id: 'card', label: 'Card (Panel, Section)', fields: ['bg', 'text', 'border', 'accent'] },
    { id: 'table', label: 'Tabel', fields: ['text', 'border'] },
    { id: 'button_primary', label: 'Tombol Utama', fields: ['bg', 'text', 'accent'] },
    { id: 'page', label: 'Latar Halaman', fields: ['bg', 'text'] },
  ],
};

export const SETTING_KEY: Record<ThemeSurface, string> = { website: 'theme_website', dashboard: 'theme_dashboard' };

const hexToRgb = (hex: string): [number, number, number] | null => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

function bgValue(tok: BlockTokens): string | null {
  if (!tok.bg) return null;
  const rgb = hexToRgb(tok.bg);
  if (!rgb) return null;
  const pct = tok.bgOpacity != null ? Math.min(95, Math.max(10, tok.bgOpacity)) : 100;
  if (pct >= 100) return tok.bg;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${(pct / 100).toFixed(2)})`;
}

export function buildThemeCss(surface: ThemeSurface, theme: SurfaceTheme | null): string {
  if (!theme) return '';
  const rules: string[] = [];
  (['light', 'dark'] as ThemeModeKey[]).forEach((mode) => {
    const map = theme[mode] ?? {};
    const decls: string[] = [];
    Object.entries(map).forEach(([blockId, tok]) => {
      const bg = bgValue(tok);
      if (bg) decls.push(`--${blockId}-bg: ${bg};`);
      if (tok.text) decls.push(`--${blockId}-text: ${tok.text};`);
      if (tok.border) decls.push(`--${blockId}-border: ${tok.border};`);
      if (tok.accent) decls.push(`--${blockId}-accent: ${tok.accent};`);
    });
    if (decls.length === 0) return;
    const selector = mode === 'dark' ? `.dark [data-theme-scope="${surface}"]` : `[data-theme-scope="${surface}"]`;
    rules.push(`${selector}{${decls.join(' ')}}`);
  });
  return rules.join('\n');
}

export function parseSurfaceTheme(raw: string | undefined | null): SurfaceTheme | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SurfaceTheme>;
    if (parsed && typeof parsed === 'object') return { light: parsed.light ?? {}, dark: parsed.dark ?? {} };
  } catch {
    return null;
  }
  return null;
}

export const emptySurfaceTheme = (): SurfaceTheme => ({ light: {}, dark: {} });
