import { useEffect, useRef, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Tooltip,
  Popup,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import type { GpxData, GpxTrack, GpxWaypoint } from '../utils/gpxParser';
import { getTrackColor, getWaypointColor } from '../utils/colors';
import MeasureTool from './MeasureTool';
import { Graticule, CursorCoordinates } from './CoordinateGrid';

export type MapStyle = 'osm' | 'satellite' | 'topo';

interface MapViewProps {
  files: GpxData[];
  hiddenTracks: Set<string>;
  showHeatmap: boolean;
  showWaypoints: boolean;
  showLabels: boolean;
  showGrid: boolean;
  mapStyle: MapStyle;
  currentTime: number | null;
  measureActive: boolean;
}

const TILE_LAYERS: Record<MapStyle, { url: string; attribution: string; maxNativeZoom: number }> = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxNativeZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    maxNativeZoom: 19,
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    maxNativeZoom: 17,
  },
};

// Component to fit map bounds when data changes
function FitBounds({ files }: { files: GpxData[] }) {
  const map = useMap();

  useEffect(() => {
    if (files.length === 0) return;

    const allPoints: [number, number][] = [];
    for (const file of files) {
      for (const wpt of file.waypoints) {
        allPoints.push([wpt.lat, wpt.lon]);
      }
      for (const trk of file.tracks) {
        for (const pt of trk.points) {
          allPoints.push([pt.lat, pt.lon]);
        }
      }
    }

    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    }
  }, [files, map]);

  return null;
}

// Heatmap layer using leaflet.heat (dynamic import for CJS compatibility)
let heatPluginLoaded = false;

function HeatmapLayer({ files, hiddenTracks }: { files: GpxData[]; hiddenTracks: Set<string> }) {
  const map = useMap();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const heatLayerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  // Load the plugin once
  useEffect(() => {
    if (heatPluginLoaded) {
      setReady(true);
      return;
    }
    import('leaflet.heat').then(() => {
      heatPluginLoaded = true;
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;

    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    const heatPoints: [number, number, number][] = [];
    for (const file of files) {
      for (const trk of file.tracks) {
        const trackKey = `${file.fileName}::${trk.name}`;
        if (hiddenTracks.has(trackKey)) continue;
        for (const pt of trk.points) {
          heatPoints.push([pt.lat, pt.lon, 0.15]);
        }
      }
    }

    if (heatPoints.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const heat = (L as any).heatLayer(heatPoints, {
        radius: 22,
        blur: 14,
        maxZoom: 15,
        minOpacity: 0.4,
        gradient: {
          0.0: '#b71c1c',
          0.15: '#d32f2f',
          0.3: '#f44336',
          0.45: '#ff9800',
          0.6: '#fdd835',
          0.75: '#8bc34a',
          0.9: '#43a047',
          1.0: '#1b5e20',
        },
      });
      heat.addTo(map);
      heatLayerRef.current = heat;
    }

    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    };
  }, [files, hiddenTracks, map, ready]);

  return null;
}

function TrackLine({
  track,
  fileKey,
  hiddenTracks,
  currentTime,
}: {
  track: GpxTrack;
  fileKey: string;
  hiddenTracks: Set<string>;
  currentTime: number | null;
}) {
  const trackKey = `${fileKey}::${track.name}`;
  const isHidden = hiddenTracks.has(trackKey);
  const color = getTrackColor(track.name);

  const positions: [number, number][] = useMemo(() => {
    if (currentTime === null) {
      return track.points.map((p) => [p.lat, p.lon]);
    }
    // Filter points up to currentTime
    return track.points
      .filter((p) => {
        if (!p.time) return false;
        return new Date(p.time).getTime() <= currentTime;
      })
      .map((p) => [p.lat, p.lon]);
  }, [track.points, currentTime]);

  if (isHidden || positions.length === 0) return null;

  const firstTime = track.points.find((p) => p.time)?.time;
  const lastTime = [...track.points].reverse().find((p) => p.time)?.time;

  // Show a "head" marker at the last visible point during playback
  const headPos = currentTime !== null && positions.length > 0 ? positions[positions.length - 1] : null;

  return (
    <>
      <Polyline
        positions={positions}
        pathOptions={{
          color,
          weight: 3,
          opacity: 0.85,
        }}
      >
        <Popup>
          <h3>{track.name}</h3>
          <p className="popup-detail">Punti: {track.points.length}</p>
          {firstTime && (
            <p className="popup-detail">
              Inizio: {new Date(firstTime).toLocaleTimeString('it-IT')}
            </p>
          )}
          {lastTime && (
            <p className="popup-detail">
              Fine: {new Date(lastTime).toLocaleTimeString('it-IT')}
            </p>
          )}
        </Popup>
      </Polyline>
      {headPos && (
        <CircleMarker
          center={headPos}
          radius={5}
          pathOptions={{
            color: '#fff',
            fillColor: color,
            fillOpacity: 1,
            weight: 2,
          }}
        />
      )}
    </>
  );
}

function WaypointMarker({
  waypoint,
  showLabels,
}: {
  waypoint: GpxWaypoint;
  showLabels: boolean;
}) {
  const color = getWaypointColor(waypoint.sym);

  return (
    <CircleMarker
      center={[waypoint.lat, waypoint.lon]}
      radius={6}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: 0.9,
        weight: 2,
      }}
    >
      {showLabels && (
        <Tooltip permanent direction="right" offset={[8, 0]} className="waypoint-label">
          {waypoint.name}
        </Tooltip>
      )}
      <Popup>
        <h3>{waypoint.name}</h3>
        {waypoint.ele && <p className="popup-detail">Quota: {waypoint.ele}m</p>}
        {waypoint.sym && <p className="popup-detail">Simbolo: {waypoint.sym}</p>}
        {waypoint.time && (
          <p className="popup-detail">
            Ora: {new Date(waypoint.time).toLocaleString('it-IT')}
          </p>
        )}
        <p className="popup-detail">
          {waypoint.lat.toFixed(6)}, {waypoint.lon.toFixed(6)}
        </p>
      </Popup>
    </CircleMarker>
  );
}

export default function MapView({
  files,
  hiddenTracks,
  showHeatmap,
  showWaypoints,
  showLabels,
  showGrid,
  mapStyle,
  currentTime,
  measureActive,
}: MapViewProps) {
  const defaultCenter: [number, number] = [45.46, 9.19]; // Milan area
  const tileConfig = TILE_LAYERS[mapStyle];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={13}
      maxZoom={22}
      zoomSnap={0.25}
      zoomDelta={0.5}
      wheelPxPerZoomLevel={120}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        key={mapStyle}
        url={tileConfig.url}
        attribution={tileConfig.attribution}
        maxZoom={22}
        maxNativeZoom={tileConfig.maxNativeZoom}
      />

      <FitBounds files={files} />

      {/* Tracks */}
      {!showHeatmap &&
        files.map((file) =>
          file.tracks.map((track) => (
            <TrackLine
              key={`${file.fileName}::${track.name}`}
              track={track}
              fileKey={file.fileName}
              hiddenTracks={hiddenTracks}
              currentTime={currentTime}
            />
          ))
        )}

      {/* Heatmap */}
      {showHeatmap && <HeatmapLayer files={files} hiddenTracks={hiddenTracks} />}

      {/* Waypoints */}
      {showWaypoints &&
        files.map((file) =>
          file.waypoints.map((wpt, i) => (
            <WaypointMarker
              key={`${file.fileName}::wpt::${i}`}
              waypoint={wpt}
              showLabels={showLabels}
            />
          ))
        )}
      {/* Coordinate grid */}
      {showGrid && <Graticule />}
      <CursorCoordinates />
      {/* Measure tool */}
      <MeasureTool active={measureActive} />
    </MapContainer>
  );
}
