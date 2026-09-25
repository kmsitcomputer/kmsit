/**
 * Minimal Google Maps JavaScript API loader (IMP-005 remediation).
 * Single-flight script load, modern bootstrap (no deprecated APIs).
 * Uses the project's existing browser key model (google_maps_api_key
 * setting); OpenRoute keys never enter the frontend.
 */
let loadPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(apiKey: string): Promise<typeof google> {
  if (typeof window !== 'undefined' && window.google?.maps) return Promise.resolve(window.google);
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => (window.google?.maps ? resolve(window.google) : reject(new Error('Google Maps gagal dimuat.')));
    script.onerror = () => { loadPromise = null; reject(new Error('Google Maps gagal dimuat. Periksa koneksi / API key.')); };
    document.head.appendChild(script);
  });
  return loadPromise;
}
