import { useEffect, useRef, useState } from 'react';
import { Field, TextInput } from './ui';
import { getSetting } from '../lib/settings';
import { loadGoogleMaps } from '../lib/googleMaps';

export interface MapPoint { lat: number; lng: number; }

/**
 * Interactive Google Maps picker (IMP-005 remediation F01). Click/tap on the
 * map moves a draggable AdvancedMarkerElement; the marker position is the
 * coordinate callback. Location selection ONLY — route distance, eligibility
 * and price stay backend authoritative.
 *
 * Manual lat/lng inputs remain as an optional fallback (admin/debug friendly),
 * never the primary UX. Changing coordinates invalidates the parent quote via
 * onChange (parent clears its quote state).
 */
export function MapsPicker({ latitude, longitude, onChange, compact, label }: {
  latitude: number | null; longitude: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
  compact?: boolean; label?: string;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<google.maps.Map | null>(null);
  const markerObj = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [latText, setLatText] = useState(latitude != null ? String(latitude) : '');
  const [lngText, setLngText] = useState(longitude != null ? String(longitude) : '');
  const [error, setError] = useState('');
  const [mapError, setMapError] = useState('');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const apiKey = getSetting('google_maps_api_key');

  const valid = (lat: number, lng: number) =>
    Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

  const emit = (lat: number | null, lng: number | null) => {
    if (lat == null || lng == null) { setError('Koordinat tidak valid (latitude −90…90, longitude −180…180).'); onChangeRef.current(null, null); return; }
    if (!valid(lat, lng)) { setError('Koordinat tidak valid (latitude −90…90, longitude −180…180).'); onChangeRef.current(null, null); return; }
    setError('');
    setLatText(String(lat)); setLngText(String(lng));
    onChangeRef.current(lat, lng);
  };

  useEffect(() => {
    if (!mapRef.current || !apiKey) { if (!apiKey) setMapError('API key Google Maps belum dikonfigurasi — gunakan input manual di bawah.'); return; }
    let cancelled = false;
    setMapError('');
    const mapId = getSetting('google_maps_map_id', 'DEMO_MAP_ID');
    void loadGoogleMaps(apiKey).then(async (g) => {
      if (cancelled || !mapRef.current) return;
      const { Map } = await g.maps.importLibrary('maps') as google.maps.MapsLibrary;
      const { AdvancedMarkerElement } = await g.maps.importLibrary('marker') as google.maps.MarkerLibrary;
      const center = latitude != null && longitude != null && valid(latitude, longitude)
        ? { lat: latitude, lng: longitude } : { lat: -6.9175, lng: 107.6191 };
      const map = new Map(mapRef.current, { center, zoom: 14, mapId, clickableIcons: false });
      mapObj.current = map;
      const marker = new AdvancedMarkerElement({ map, position: latitude != null && longitude != null ? center : undefined, gmpDraggable: true });
      markerObj.current = marker;
      marker.addListener('dragend', () => {
        const pos = marker.position as google.maps.LatLng | google.maps.LatLngLiteral | null;
        if (!pos) return;
        const ll = pos instanceof google.maps.LatLng ? pos : new google.maps.LatLng((pos as google.maps.LatLngLiteral).lat, (pos as google.maps.LatLngLiteral).lng);
        emit(ll.lat(), ll.lng());
      });
      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        marker.position = e.latLng;
        emit(e.latLng.lat(), e.latLng.lng());
      });
    }).catch((e: unknown) => { if (!cancelled) setMapError(e instanceof Error ? e.message : 'Google Maps gagal dimuat.'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Keep the marker in sync when coordinates change externally (e.g. store load).
  useEffect(() => {
    if (latitude == null || longitude == null || !valid(latitude, longitude)) return;
    setLatText(String(latitude)); setLngText(String(longitude));
    if (mapObj.current && markerObj.current && window.google?.maps) {
      const pos = new window.google.maps.LatLng(latitude, longitude);
      markerObj.current.position = pos;
      mapObj.current.panTo(pos);
    }
  }, [latitude, longitude]);

  const inputCls = compact ? 'py-2 text-xs font-mono' : 'font-mono';

  return (
    <div className="space-y-2.5">
      {mapError ? (
        <p className="rounded-xl border border-warn-400/30 bg-warn-400/[0.07] p-3 text-[11px] leading-5 text-base-500">{mapError}</p>
      ) : (
        <div ref={mapRef} className="h-52 w-full overflow-hidden rounded-xl border border-base-200 dark:border-base-800" aria-label={label ?? 'Peta pilih lokasi'} />
      )}
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field label="Latitude" required error={error ? ' ' : undefined}>
          <TextInput value={latText} inputMode="decimal" placeholder="cth: -6.9200"
            className={inputCls} onChange={(e) => { setLatText(e.target.value); const lng = Number(lngText); emit(Number(e.target.value), lngText.trim() === '' ? NaN : lng); }} />
        </Field>
        <Field label="Longitude" required>
          <TextInput value={lngText} inputMode="decimal" placeholder="cth: 107.6250"
            className={inputCls} onChange={(e) => { setLngText(e.target.value); const lat = Number(latText); emit(latText.trim() === '' ? NaN : lat, Number(e.target.value)); }} />
        </Field>
      </div>
      {error && <p className="text-[11px] font-semibold text-danger-500">{error}</p>}
      <p className="text-[11px] text-base-400">Klik/tap peta untuk menaruh & menggeser marker — koordinat terisi otomatis. Jarak & ongkir dihitung server.</p>
    </div>
  );
}
