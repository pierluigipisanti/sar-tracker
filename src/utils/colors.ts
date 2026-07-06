// Distinct colors for tracks - high contrast, colorblind-friendly
const TRACK_COLORS = [
  '#e6194b', // rosso
  '#3cb44b', // verde
  '#4363d8', // blu
  '#f58231', // arancione
  '#911eb4', // viola
  '#42d4f4', // ciano
  '#f032e6', // magenta
  '#bfef45', // lime
  '#fabed4', // rosa
  '#469990', // teal
  '#dcbeff', // lavanda
  '#9A6324', // marrone
  '#800000', // bordeaux
  '#aaffc3', // menta
  '#808000', // oliva
  '#000075', // navy
];

// Map squad names to consistent colors
const squadColorMap = new Map<string, string>();

export function getTrackColor(trackName: string): string {
  // Extract squad base name (e.g., "SQUADRA ALFA" from "SQUADRA ALFA-1")
  const baseName = trackName.replace(/-\d+$/, '').trim();

  if (!squadColorMap.has(baseName)) {
    const index = squadColorMap.size % TRACK_COLORS.length;
    squadColorMap.set(baseName, TRACK_COLORS[index]);
  }

  return squadColorMap.get(baseName)!;
}

export function resetColors(): void {
  squadColorMap.clear();
}

// Waypoint marker colors based on Garmin symbol
export function getWaypointColor(sym?: string): string {
  if (!sym) return '#e6194b';
  const s = sym.toLowerCase();
  if (s.includes('red')) return '#e6194b';
  if (s.includes('blue')) return '#4363d8';
  if (s.includes('green')) return '#3cb44b';
  if (s.includes('yellow')) return '#ffe119';
  return '#e6194b';
}
