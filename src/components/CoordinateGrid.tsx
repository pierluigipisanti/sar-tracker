import { useEffect, useState } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Draw a lat/lon graticule on the map
export function Graticule() {
  const map = useMap();

  useEffect(() => {
    const layer = L.layerGroup();
    layer.addTo(map);

    function drawGrid() {
      layer.clearLayers();

      const bounds = map.getBounds();
      const zoom = map.getZoom();

      // Choose grid interval based on zoom level
      let interval: number;
      if (zoom >= 16) interval = 0.001;      // ~111m
      else if (zoom >= 14) interval = 0.005;  // ~555m
      else if (zoom >= 12) interval = 0.01;   // ~1.1km
      else if (zoom >= 10) interval = 0.05;   // ~5.5km
      else if (zoom >= 8) interval = 0.1;     // ~11km
      else if (zoom >= 6) interval = 0.5;     // ~55km
      else if (zoom >= 4) interval = 1;       // ~111km
      else interval = 5;

      const south = Math.floor(bounds.getSouth() / interval) * interval;
      const north = Math.ceil(bounds.getNorth() / interval) * interval;
      const west = Math.floor(bounds.getWest() / interval) * interval;
      const east = Math.ceil(bounds.getEast() / interval) * interval;

      const lineStyle: L.PolylineOptions = {
        color: '#888',
        weight: 0.6,
        opacity: 0.5,
        dashArray: '4,4',
        interactive: false,
      };

      // Decimal precision for labels
      const precision = interval < 0.01 ? 4 : interval < 0.1 ? 3 : interval < 1 ? 2 : 1;

      // Horizontal lines (latitude)
      for (let lat = south; lat <= north; lat += interval) {
        const roundedLat = Math.round(lat / interval) * interval;
        L.polyline(
          [[roundedLat, west - 1], [roundedLat, east + 1]],
          lineStyle
        ).addTo(layer);

        // Label on left edge
        const marker = L.marker([roundedLat, bounds.getWest()], {
          icon: L.divIcon({
            className: 'grid-label grid-label-lat',
            html: `${roundedLat.toFixed(precision)}°`,
            iconSize: [60, 14],
            iconAnchor: [-4, 7],
          }),
          interactive: false,
        });
        marker.addTo(layer);
      }

      // Vertical lines (longitude)
      for (let lon = west; lon <= east; lon += interval) {
        const roundedLon = Math.round(lon / interval) * interval;
        L.polyline(
          [[south - 1, roundedLon], [north + 1, roundedLon]],
          lineStyle
        ).addTo(layer);

        // Label on bottom edge
        const marker = L.marker([bounds.getSouth(), roundedLon], {
          icon: L.divIcon({
            className: 'grid-label grid-label-lon',
            html: `${roundedLon.toFixed(precision)}°`,
            iconSize: [60, 14],
            iconAnchor: [30, -4],
          }),
          interactive: false,
        });
        marker.addTo(layer);
      }
    }

    drawGrid();
    map.on('moveend zoomend', drawGrid);

    return () => {
      map.off('moveend zoomend', drawGrid);
      map.removeLayer(layer);
    };
  }, [map]);

  return null;
}

// Show coordinates at cursor position
export function CursorCoordinates() {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  useMapEvents({
    mousemove(e) {
      setCoords({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
    mouseout() {
      setCoords(null);
    },
  });

  if (!coords) return null;

  // Convert to DMS (degrees, minutes, seconds)
  const toDMS = (dd: number, isLon: boolean) => {
    const dir = isLon ? (dd >= 0 ? 'E' : 'W') : (dd >= 0 ? 'N' : 'S');
    const abs = Math.abs(dd);
    const d = Math.floor(abs);
    const mFloat = (abs - d) * 60;
    const m = Math.floor(mFloat);
    const s = ((mFloat - m) * 60).toFixed(1);
    return `${d}° ${m}' ${s}" ${dir}`;
  };

  return (
    <div className="cursor-coords">
      <span>{toDMS(coords.lat, false)}</span>
      <span className="coords-sep">|</span>
      <span>{toDMS(coords.lon, true)}</span>
      <span className="coords-sep">|</span>
      <span className="coords-decimal">{coords.lat.toFixed(6)}, {coords.lon.toFixed(6)}</span>
    </div>
  );
}
