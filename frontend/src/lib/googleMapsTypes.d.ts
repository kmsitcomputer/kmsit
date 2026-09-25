/**
 * Minimal ambient types for the Google Maps JavaScript API surface used by
 * MapsPicker (IMP-005). Covers only Map + AdvancedMarkerElement + the events
 * we wire. Avoids a new @types dependency for a two-call-site integration.
 */
declare global {
  namespace google {
    namespace maps {
      interface LatLngLiteral { lat: number; lng: number }
      class LatLng {
        constructor(lat: number, lng: number);
        lat(): number;
        lng(): number;
      }
      interface MapOptions {
        center: LatLngLiteral;
        zoom: number;
        mapId?: string;
        clickableIcons?: boolean;
      }
      class Map {
        constructor(el: HTMLElement, opts: MapOptions);
        addListener(event: 'click', handler: (e: MapMouseEvent) => void): void;
        panTo(pos: LatLng | LatLngLiteral): void;
      }
      interface MapMouseEvent { latLng: LatLng | null }
      interface MapsLibrary { Map: typeof Map }
      namespace marker {
        interface AdvancedMarkerOptions {
          map?: Map | null;
          position?: LatLng | LatLngLiteral | null;
          gmpDraggable?: boolean;
        }
        class AdvancedMarkerElement {
          constructor(opts: AdvancedMarkerOptions);
          position: LatLng | LatLngLiteral | null;
          addListener(event: 'dragend', handler: () => void): void;
        }
      }
      interface MarkerLibrary { AdvancedMarkerElement: typeof marker.AdvancedMarkerElement }
      function importLibrary(name: 'maps'): Promise<MapsLibrary>;
      function importLibrary(name: 'marker'): Promise<MarkerLibrary>;
    }
    const maps: typeof google.maps;
  }
  interface Window { google?: typeof google }
}

export {};
