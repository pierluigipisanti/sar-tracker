import { useState, useCallback, useRef, useEffect } from 'react';
import { parseGpx, type GpxData } from './utils/gpxParser';
import { resetColors } from './utils/colors';
import MapView, { type MapStyle } from './components/MapView';
import Sidebar from './components/Sidebar';
import Timeline from './components/Timeline';
import './App.css';

// SVG icons
const MapPinIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const UploadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const HeatmapIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const TagIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const ZoomFitIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
  </svg>
);

const GpsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const LayersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const RulerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M2 20L20 2" />
    <path d="M5.5 16.5L8 14" />
    <path d="M9 13L11.5 10.5" />
    <path d="M12.5 9.5L15 7" />
    <path d="M16 6L18.5 3.5" />
  </svg>
);

const GridIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="3" x2="3" y2="21" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
    <line x1="21" y1="3" x2="21" y2="21" />
    <line x1="3" y1="3" x2="21" y2="3" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
    <line x1="3" y1="21" x2="21" y2="21" />
  </svg>
);

const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const MAP_STYLE_LABELS: Record<MapStyle, string> = {
  osm: 'Stradale',
  satellite: 'Satellite',
  topo: 'Topografica',
};

const MAP_STYLE_ORDER: MapStyle[] = ['osm', 'satellite', 'topo'];

function App() {
  const [files, setFiles] = useState<GpxData[]>([]);
  const [hiddenTracks, setHiddenTracks] = useState<Set<string>>(new Set());
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showWaypoints, setShowWaypoints] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [fitBoundsKey, setFitBoundsKey] = useState(0);
  const [mapStyle, setMapStyle] = useState<MapStyle>('osm');
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [measureActive, setMeasureActive] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const handleFiles = useCallback(
    (fileList: FileList) => {
      const gpxFiles = Array.from(fileList).filter(
        (f) => f.name.toLowerCase().endsWith('.gpx')
      );

      for (const file of gpxFiles) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const xml = e.target?.result as string;
          const gpxData = parseGpx(xml, file.name);
          setFiles((prev) => {
            // Replace if same filename already loaded
            const filtered = prev.filter((f) => f.fileName !== gpxData.fileName);
            return [...filtered, gpxData];
          });
        };
        reader.readAsText(file);
      }
    },
    []
  );

  // Drag & drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleToggleTrack = useCallback((trackKey: string) => {
    setHiddenTracks((prev) => {
      const next = new Set(prev);
      if (next.has(trackKey)) {
        next.delete(trackKey);
      } else {
        next.add(trackKey);
      }
      return next;
    });
  }, []);

  const handleToggleSquad = useCallback(
    (squadName: string) => {
      // Find all tracks belonging to this squad
      const squadTracks: string[] = [];
      for (const file of files) {
        for (const track of file.tracks) {
          const baseName = track.name.replace(/-\d+$/, '').trim();
          if (baseName === squadName) {
            squadTracks.push(`${file.fileName}::${track.name}`);
          }
        }
      }

      setHiddenTracks((prev) => {
        const next = new Set(prev);
        const allHidden = squadTracks.every((k) => next.has(k));

        if (allHidden) {
          // Show all
          for (const key of squadTracks) next.delete(key);
        } else {
          // Hide all
          for (const key of squadTracks) next.add(key);
        }
        return next;
      });
    },
    [files]
  );

  const handleRemoveFile = useCallback(
    (fileName: string) => {
      setFiles((prev) => prev.filter((f) => f.fileName !== fileName));
      setHiddenTracks((prev) => {
        const next = new Set(prev);
        for (const key of Array.from(next)) {
          if (key.startsWith(`${fileName}::`)) {
            next.delete(key);
          }
        }
        return next;
      });
    },
    []
  );

  const handleWaypointClick = useCallback((_lat: number, _lon: number) => {
    // Could pan to waypoint - for now the sidebar click is informational
    // The map popup handles the detail view
  }, []);

  // Reset colors when files change
  useEffect(() => {
    resetColors();
  }, [files.length]);

  const handleTimeChange = useCallback((timeOrFn: number | null | ((prev: number | null) => number | null)) => {
    if (typeof timeOrFn === 'function') {
      setCurrentTime(timeOrFn);
    } else {
      setCurrentTime(timeOrFn);
    }
  }, []);

  const handleZoomFit = useCallback(() => {
    setFitBoundsKey((k) => k + 1);
  }, []);

  // Memoize files with fitBoundsKey to trigger re-fit
  const filesForBounds = files.length > 0 ? [...files, { _fitKey: fitBoundsKey } as unknown as GpxData] : files;
  // Actually just pass files and use key to force re-render of FitBounds
  void filesForBounds;

  return (
    <div
      className="app"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <GpsIcon />
          <h1>
            SAR <span>Track Viewer</span>
          </h1>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-primary"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon />
            Importa GPX
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".gpx"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>
      </header>

      {/* Main area */}
      <div className="main">
        {/* Sidebar - only show when files loaded */}
        {files.length > 0 && (
          <Sidebar
            files={files}
            hiddenTracks={hiddenTracks}
            onToggleTrack={handleToggleTrack}
            onToggleSquad={handleToggleSquad}
            onRemoveFile={handleRemoveFile}
            onWaypointClick={handleWaypointClick}
          />
        )}

        {/* Map */}
        <div className="map-container">
          <MapView
            key={fitBoundsKey}
            files={files}
            hiddenTracks={hiddenTracks}
            showHeatmap={showHeatmap && !showTimeline}
            showWaypoints={showWaypoints}
            showLabels={showLabels}
            showGrid={showGrid}
            mapStyle={mapStyle}
            currentTime={showTimeline ? currentTime : null}
            measureActive={measureActive}
          />

          {/* Map controls */}
          {files.length > 0 && (
            <div className="map-controls">
              <button
                className={`map-control-btn ${showHeatmap ? 'active' : ''}`}
                onClick={() => setShowHeatmap(!showHeatmap)}
                title={showHeatmap ? 'Mostra tracce' : 'Mostra heatmap copertura'}
              >
                <HeatmapIcon />
              </button>
              <button
                className={`map-control-btn ${showWaypoints ? 'active' : ''}`}
                onClick={() => setShowWaypoints(!showWaypoints)}
                title={showWaypoints ? 'Nascondi waypoint' : 'Mostra waypoint'}
              >
                <MapPinIcon />
              </button>
              <button
                className={`map-control-btn ${showLabels ? 'active' : ''}`}
                onClick={() => setShowLabels(!showLabels)}
                title={showLabels ? 'Nascondi etichette' : 'Mostra etichette'}
              >
                <TagIcon />
              </button>
              <button
                className="map-control-btn"
                onClick={handleZoomFit}
                title="Zoom su tutto"
              >
                <ZoomFitIcon />
              </button>
              <button
                className="map-control-btn"
                onClick={() => {
                  const idx = MAP_STYLE_ORDER.indexOf(mapStyle);
                  setMapStyle(MAP_STYLE_ORDER[(idx + 1) % MAP_STYLE_ORDER.length]);
                }}
                title={`Mappa: ${MAP_STYLE_LABELS[mapStyle]}`}
              >
                <LayersIcon />
              </button>
              <button
                className={`map-control-btn ${showGrid ? 'active' : ''}`}
                onClick={() => setShowGrid(!showGrid)}
                title={showGrid ? 'Nascondi reticolo' : 'Mostra reticolo coordinate'}
              >
                <GridIcon />
              </button>
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              <button
                className={`map-control-btn ${showTimeline ? 'active' : ''}`}
                onClick={() => {
                  setShowTimeline(!showTimeline);
                  if (showTimeline) setCurrentTime(null);
                  if (!showTimeline) setMeasureActive(false);
                }}
                title={showTimeline ? 'Chiudi timeline' : 'Timeline replay'}
              >
                <ClockIcon />
              </button>
              <button
                className={`map-control-btn ${measureActive ? 'active' : ''}`}
                onClick={() => {
                  setMeasureActive(!measureActive);
                  if (!measureActive) setShowTimeline(false);
                }}
                title={measureActive ? 'Chiudi misura' : 'Misura distanza'}
              >
                <RulerIcon />
              </button>
            </div>
          )}

          {/* Timeline */}
          {showTimeline && files.length > 0 && (
            <Timeline
              files={files}
              hiddenTracks={hiddenTracks}
              currentTime={currentTime}
              onTimeChange={handleTimeChange}
            />
          )}

          {/* Measure hint */}
          {measureActive && (
            <div className="measure-hint">
              Clicca due punti sulla mappa per misurare la distanza
            </div>
          )}

          {/* Heatmap legend */}
          {showHeatmap && files.length > 0 && (
            <div className="heatmap-legend">
              <h4>Copertura</h4>
              <div className="heatmap-legend-bar" />
              <div className="heatmap-legend-labels">
                <span>Scoperta</span>
                <span>Coperta</span>
              </div>
              <div className="heatmap-legend-note">Zone senza colore = non perlustrate</div>
            </div>
          )}

          {/* Empty state */}
          {files.length === 0 && !isDragging && (
            <div className="empty-state">
              <div className="empty-state-content">
                <EyeIcon />
                <h2>SAR Track Viewer</h2>
                <p>
                  Trascina file GPX sulla mappa o clicca il pulsante per importare.
                  <br />
                  Supporta export Garmin 62/64.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadIcon />
                  Importa file GPX
                </button>
              </div>
            </div>
          )}

          {/* Drag overlay */}
          {isDragging && (
            <div className="drop-zone-overlay active">
              <div className="drop-zone-box">
                <UploadIcon />
                <h2>Rilascia i file GPX</h2>
                <p>Puoi caricare piu file contemporaneamente</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
