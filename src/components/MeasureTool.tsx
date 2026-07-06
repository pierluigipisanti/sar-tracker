import { useState, useCallback } from 'react';
import { useMapEvents, Polyline, CircleMarker, Tooltip } from 'react-leaflet';

interface MeasureToolProps {
  active: boolean;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

export default function MeasureTool({ active }: MeasureToolProps) {
  const [points, setPoints] = useState<[number, number][]>([]);

  const handleClick = useCallback(
    (e: L.LeafletMouseEvent) => {
      if (!active) return;
      const { lat, lng } = e.latlng;
      setPoints((prev) => {
        if (prev.length >= 2) {
          // Reset: start new measurement
          return [[lat, lng]];
        }
        return [...prev, [lat, lng]];
      });
    },
    [active]
  );

  useMapEvents({
    click: handleClick,
  });

  // Clear points when deactivated
  if (!active && points.length > 0) {
    // Can't call setState in render, use effect-like pattern
    // This is fine because react will re-render
    setTimeout(() => setPoints([]), 0);
    return null;
  }

  if (!active || points.length === 0) return null;

  const totalDistance =
    points.length >= 2
      ? haversineDistance(points[0][0], points[0][1], points[1][0], points[1][1])
      : 0;

  return (
    <>
      {/* Points */}
      {points.map((pt, i) => (
        <CircleMarker
          key={`measure-${i}`}
          center={pt}
          radius={5}
          pathOptions={{
            color: '#ff5722',
            fillColor: '#ff5722',
            fillOpacity: 1,
            weight: 2,
          }}
        />
      ))}

      {/* Line between points */}
      {points.length >= 2 && (
        <>
          <Polyline
            positions={points}
            pathOptions={{
              color: '#ff5722',
              weight: 2,
              dashArray: '8, 8',
              opacity: 0.9,
            }}
          />
          {/* Distance label at midpoint */}
          <CircleMarker
            center={[
              (points[0][0] + points[1][0]) / 2,
              (points[0][1] + points[1][1]) / 2,
            ]}
            radius={0}
          >
            <Tooltip permanent direction="top" offset={[0, -8]} className="measure-label">
              {formatDistance(totalDistance)}
            </Tooltip>
          </CircleMarker>
        </>
      )}

      {/* Hint for first point */}
      {points.length === 1 && (
        <CircleMarker center={points[0]} radius={0}>
          <Tooltip permanent direction="top" offset={[0, -8]} className="measure-label">
            Clicca il secondo punto
          </Tooltip>
        </CircleMarker>
      )}
    </>
  );
}
