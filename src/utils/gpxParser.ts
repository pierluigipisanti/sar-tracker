export interface GpxWaypoint {
  name: string;
  lat: number;
  lon: number;
  ele?: number;
  time?: string;
  sym?: string;
}

export interface GpxTrackPoint {
  lat: number;
  lon: number;
  ele?: number;
  time?: string;
}

export interface GpxTrack {
  name: string;
  points: GpxTrackPoint[];
}

export interface GpxData {
  fileName: string;
  waypoints: GpxWaypoint[];
  tracks: GpxTrack[];
  bounds?: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

export function parseGpx(xmlString: string, fileName: string): GpxData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  // Parse waypoints
  const wptElements = doc.querySelectorAll('wpt');
  const waypoints: GpxWaypoint[] = Array.from(wptElements).map((wpt) => ({
    name: wpt.querySelector('name')?.textContent || 'Senza nome',
    lat: parseFloat(wpt.getAttribute('lat') || '0'),
    lon: parseFloat(wpt.getAttribute('lon') || '0'),
    ele: wpt.querySelector('ele')
      ? parseFloat(wpt.querySelector('ele')!.textContent || '0')
      : undefined,
    time: wpt.querySelector('time')?.textContent || undefined,
    sym: wpt.querySelector('sym')?.textContent || undefined,
  }));

  // Parse tracks
  const trkElements = doc.querySelectorAll('trk');
  const tracks: GpxTrack[] = Array.from(trkElements).map((trk) => {
    const name = trk.querySelector('name')?.textContent || 'Traccia senza nome';
    const trkpts = trk.querySelectorAll('trkpt');
    const points: GpxTrackPoint[] = Array.from(trkpts).map((pt) => ({
      lat: parseFloat(pt.getAttribute('lat') || '0'),
      lon: parseFloat(pt.getAttribute('lon') || '0'),
      ele: pt.querySelector('ele')
        ? parseFloat(pt.querySelector('ele')!.textContent || '0')
        : undefined,
      time: pt.querySelector('time')?.textContent || undefined,
    }));
    return { name, points };
  });

  // Calculate bounds
  const allPoints = [
    ...waypoints.map((w) => ({ lat: w.lat, lon: w.lon })),
    ...tracks.flatMap((t) => t.points.map((p) => ({ lat: p.lat, lon: p.lon }))),
  ];

  let bounds: GpxData['bounds'] = undefined;
  if (allPoints.length > 0) {
    bounds = {
      minLat: Math.min(...allPoints.map((p) => p.lat)),
      maxLat: Math.max(...allPoints.map((p) => p.lat)),
      minLon: Math.min(...allPoints.map((p) => p.lon)),
      maxLon: Math.max(...allPoints.map((p) => p.lon)),
    };
  }

  return { fileName, waypoints, tracks, bounds };
}
