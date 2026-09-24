import { useEffect, useState } from 'react';
import { useApp } from '../../state/store';
import { api } from '../../lib/api';
import { patchRemoteSettings } from '../../lib/settings';
import { Icon } from '../../components/icons';
import { ColorField, PageHeader, Tabs } from '../../components/ui';
import { DashShell } from '../../components/Shell';
import {
  THEME_CATALOG, emptySurfaceTheme, parseSurfaceTheme,
  type ThemeSurface, type ThemeModeKey, type SurfaceTheme, type BlockTokens, type ColorFieldKey,
} from '../../lib/theme';

const TAB_STORAGE_KEY = 'kmsit_theme_settings_tab';

function readLastTab(): { surface: ThemeSurface; mode: ThemeModeKey } {
  try {
    const raw = localStorage.getItem(TAB_STORAGE_KEY) ?? '';
    const [surface, mode] = raw.split(':');
    if ((surface === 'website' || surface === 'dashboard') && (mode === 'light' || mode === 'dark')) return { surface, mode };
  } catch { /* localStorage unavailable */ }
  return { surface: 'dashboard', mode: 'dark' };
}

function BlockPanel({ tokens, fields, opacity, onChange }: {
  tokens: BlockTokens; fields: ColorFieldKey[]; opacity?: boolean;
  onChange: (next: BlockTokens) => void;
}) {
  const set = (patch: Partial<BlockTokens>) => onChange({ ...tokens, ...patch });
  const labels: Record<ColorFieldKey, string> = { bg: 'Background', text: 'Warna Teks', border: 'Border', accent: 'Aksen' };
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => f === 'bg' ? (
        <ColorField key="bg" label={labels.bg} value={tokens.bg ?? ''} onChange={(v) => set({ bg: v })}
          opacity={opacity ? tokens.bgOpacity ?? 85 : undefined}
          onOpacityChange={opacity ? (v) => set({ bgOpacity: v }) : undefined} />
      ) : (
        <ColorField key={f} label={labels[f]} value={tokens[f] ?? ''} onChange={(v) => set({ [f]: v } as Partial<BlockTokens>)} />
      ))}
    </div>
  );
}

export function SettingsTheme() {
  const { user, toast } = useApp();
  const [tab, setTab] = useState(readLastTab);
  const [data, setData] = useState<Record<ThemeSurface, SurfaceTheme>>({ website: emptySurfaceTheme(), dashboard: emptySurfaceTheme() });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void api.adminSettings().then((remote) => {
      setData({
        website: parseSurfaceTheme(remote.theme_website ?? undefined) ?? emptySurfaceTheme(),
        dashboard: parseSurfaceTheme(remote.theme_dashboard ?? undefined) ?? emptySurfaceTheme(),
      });
    }).finally(() => setLoading(false));
  }, []);

  const setTabAndPersist = (patch: Partial<{ surface: ThemeSurface; mode: ThemeModeKey }>) => {
    const next = { ...tab, ...patch };
    setTab(next);
    try { localStorage.setItem(TAB_STORAGE_KEY, `${next.surface}:${next.mode}`); } catch { /* ignore */ }
  };

  if (!user) return null;

  const setBlock = (surface: ThemeSurface, mode: ThemeModeKey, blockId: string, tokens: BlockTokens) => {
    setData((prev) => ({ ...prev, [surface]: { ...prev[surface], [mode]: { ...prev[surface][mode], [blockId]: tokens } } }));
  };

  const resetBlock = (surface: ThemeSurface, mode: ThemeModeKey, blockId: string) => {
    setData((prev) => {
      const map = { ...prev[surface][mode] };
      delete map[blockId];
      return { ...prev, [surface]: { ...prev[surface], [mode]: map } };
    });
  };

  const save = () => {
    setSaving(true);
    const websiteJson = JSON.stringify(data.website);
    const dashboardJson = JSON.stringify(data.dashboard);
    void api.updateSettings({ theme_website: websiteJson, theme_dashboard: dashboardJson }).then(() => {
      patchRemoteSettings({ theme_website: websiteJson, theme_dashboard: dashboardJson });
      toast('success', 'Tema warna disimpan.');
    }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal menyimpan tema warna.')).finally(() => setSaving(false));
  };

  const blocks = THEME_CATALOG[tab.surface];
  const map = data[tab.surface][tab.mode];

  return (
    <DashShell title="Tema Warna">
      <PageHeader title="Tema Warna" sub="Atur warna per blok/card untuk Website dan Dashboard, terpisah Dark Mode & Light Mode. Kosongkan field untuk kembali ke desain default."
        actions={<button className="btn-primary" onClick={save} disabled={loading || saving}><Icon name="check" size={15} /> Simpan</button>} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs tabs={[{ key: 'dashboard', label: 'Dashboard' }, { key: 'website', label: 'Website' }]} active={tab.surface} onChange={(k) => setTabAndPersist({ surface: k as ThemeSurface })} />
        <Tabs tabs={[{ key: 'dark', label: 'Dark Mode' }, { key: 'light', label: 'Light Mode' }]} active={tab.mode} onChange={(k) => setTabAndPersist({ mode: k as ThemeModeKey })} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {blocks.map((block, i) => {
          const tokens = map[block.id] ?? {};
          const hasCustom = Object.keys(tokens).length > 0;
          return (
            <div key={block.id} className="card p-5 anim-rise" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-base-900 dark:text-base-50">{block.label}</h3>
                {hasCustom && (
                  <button type="button" className="btn-ghost btn-sm" onClick={() => resetBlock(tab.surface, tab.mode, block.id)}>
                    <Icon name="refresh" size={12} /> Reset
                  </button>
                )}
              </div>
              <BlockPanel tokens={tokens} fields={block.fields} opacity={block.opacity} onChange={(next) => setBlock(tab.surface, tab.mode, block.id, next)} />
            </div>
          );
        })}
      </div>
    </DashShell>
  );
}
