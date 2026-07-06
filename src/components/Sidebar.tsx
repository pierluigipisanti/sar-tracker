import type { GpxData } from '../utils/gpxParser';
import { getTrackColor, getWaypointColor } from '../utils/colors';

interface SidebarProps {
  files: GpxData[];
  hiddenTracks: Set<string>;
  onToggleTrack: (trackKey: string) => void;
  onToggleSquad: (squadName: string) => void;
  onRemoveFile: (fileName: string) => void;
  onWaypointClick: (lat: number, lon: number) => void;
}

// SVG Icons as inline components
const FileIcon = () => (
  <svg className="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function trackDistance(points: { lat: number; lon: number }[]): number {
  let dist = 0;
  for (let i = 1; i < points.length; i++) {
    dist += haversineDistance(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
  }
  return dist;
}

function formatDist(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

interface SquadGroup {
  baseName: string;
  color: string;
  tracks: { track: { name: string; points: { lat: number; lon: number }[] }; fileKey: string; trackKey: string; distance: number }[];
  totalDistance: number;
}

function groupTracksBySquad(files: GpxData[]): SquadGroup[] {
  const groups = new Map<string, SquadGroup>();

  for (const file of files) {
    for (const track of file.tracks) {
      const baseName = track.name.replace(/-\d+$/, '').trim();
      const trackKey = `${file.fileName}::${track.name}`;

      if (!groups.has(baseName)) {
        groups.set(baseName, {
          baseName,
          color: getTrackColor(track.name),
          tracks: [],
          totalDistance: 0,
        });
      }

      const dist = trackDistance(track.points);
      groups.get(baseName)!.tracks.push({
        track: { name: track.name, points: track.points },
        fileKey: file.fileName,
        trackKey,
        distance: dist,
      });
      groups.get(baseName)!.totalDistance += dist;
    }
  }

  return Array.from(groups.values());
}

export default function Sidebar({
  files,
  hiddenTracks,
  onToggleTrack,
  onToggleSquad,
  onRemoveFile,
  onWaypointClick,
}: SidebarProps) {
  const squadGroups = groupTracksBySquad(files);
  const allWaypoints = files.flatMap((f) => f.waypoints);

  const totalTracks = files.reduce((sum, f) => sum + f.tracks.length, 0);
  const totalPoints = files.reduce(
    (sum, f) => sum + f.tracks.reduce((s, t) => s + t.points.length, 0),
    0
  );
  const totalKm = squadGroups.reduce((sum, g) => sum + g.totalDistance, 0);

  return (
    <aside className="sidebar">
      {/* Files section */}
      <div className="sidebar-section">
        <h3>File GPX ({files.length})</h3>
        {files.map((file) => (
          <div key={file.fileName} className="file-item">
            <div className="file-info">
              <FileIcon />
              <div>
                <div className="file-name">{file.fileName}</div>
                <div className="file-meta">
                  {file.tracks.length} tracce, {file.waypoints.length} waypoint
                </div>
              </div>
            </div>
            <button className="file-remove" onClick={() => onRemoveFile(file.fileName)}>
              <XIcon />
            </button>
          </div>
        ))}
      </div>

      <div className="sidebar-scroll">
        {/* Tracks section */}
        {squadGroups.length > 0 && (
          <div className="sidebar-section" style={{ border: 'none' }}>
            <h3>Squadre ({squadGroups.length})</h3>
            {squadGroups.map((group) => {
              const allHidden = group.tracks.every((t) => hiddenTracks.has(t.trackKey));
              const someHidden = group.tracks.some((t) => hiddenTracks.has(t.trackKey));

              return (
                <div key={group.baseName} className="track-group">
                  <div
                    className="track-group-header"
                    onClick={() => onToggleSquad(group.baseName)}
                  >
                    <div
                      className="checkbox"
                      style={{
                        borderColor: group.color,
                        background: allHidden ? 'transparent' : group.color,
                        opacity: someHidden && !allHidden ? 0.5 : 1,
                      }}
                    >
                      {!allHidden && <CheckIcon />}
                    </div>
                    <span
                      className="track-color-dot"
                      style={{ background: group.color }}
                    />
                    <span className="track-name">{group.baseName}</span>
                    <span className="track-dist">{formatDist(group.totalDistance)}</span>
                  </div>

                  {group.tracks.map((item) => {
                    const isHidden = hiddenTracks.has(item.trackKey);
                    return (
                      <div
                        key={item.trackKey}
                        className={`track-item ${isHidden ? 'hidden' : ''}`}
                        onClick={() => onToggleTrack(item.trackKey)}
                      >
                        <span
                          className="track-color-line"
                          style={{ background: isHidden ? '#555' : group.color }}
                        />
                        <span className="track-name">
                          {item.track.name.replace(group.baseName, '').replace(/^-/, '').trim() || 'Passata principale'}
                        </span>
                        <span className="track-dist">{formatDist(item.distance)}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Waypoints section */}
        {allWaypoints.length > 0 && (
          <div className="sidebar-section" style={{ border: 'none' }}>
            <h3>Waypoint ({allWaypoints.length})</h3>
            {allWaypoints.map((wpt, i) => (
              <div
                key={`${wpt.name}-${i}`}
                className="waypoint-item"
                onClick={() => onWaypointClick(wpt.lat, wpt.lon)}
              >
                <span
                  className="waypoint-marker"
                  style={{ borderColor: getWaypointColor(wpt.sym) }}
                />
                <span className="waypoint-name">{wpt.name}</span>
                {wpt.ele && <span className="waypoint-ele">{wpt.ele}m</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats bar */}
      {files.length > 0 && (
        <div className="stats-bar">
          <div className="stat">
            Tracce: <span className="stat-value">{totalTracks}</span>
          </div>
          <div className="stat">
            Punti: <span className="stat-value">{totalPoints.toLocaleString()}</span>
          </div>
          <div className="stat">
            Km tot: <span className="stat-value">{formatDist(totalKm)}</span>
          </div>
        </div>
      )}

      <div className="sidebar-credit">SAR Track Viewer · by Pierluigi Pisanti</div>
    </aside>
  );
}
