import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { GpxData } from '../utils/gpxParser';
import { getTrackColor } from '../utils/colors';

interface TimelineProps {
  files: GpxData[];
  hiddenTracks: Set<string>;
  currentTime: number | null;
  onTimeChange: (time: number | null | ((prev: number | null) => number | null)) => void;
}

const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const PauseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
);

const StopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </svg>
);

const SpeedIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="13 17 18 12 13 7" />
    <polyline points="6 17 11 12 6 7" />
  </svg>
);

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Collect all timestamps sorted, to detect gaps and skip them
function collectTimestamps(files: GpxData[], hiddenTracks: Set<string>): number[] {
  const times: number[] = [];
  for (const file of files) {
    for (const trk of file.tracks) {
      const trackKey = `${file.fileName}::${trk.name}`;
      if (hiddenTracks.has(trackKey)) continue;
      for (const pt of trk.points) {
        if (pt.time) {
          times.push(new Date(pt.time).getTime());
        }
      }
    }
  }
  times.sort((a, b) => a - b);
  return times;
}

// Find the next timestamp after `current`, skipping gaps > threshold
function skipGap(sortedTimes: number[], current: number, gapThreshold: number): number | null {
  for (const t of sortedTimes) {
    if (t > current + gapThreshold) {
      return t; // Jump to this timestamp
    }
    if (t > current) {
      return null; // No gap, normal playback
    }
  }
  return null;
}

export default function Timeline({ files, hiddenTracks, currentTime, onTimeChange }: TimelineProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(50);
  const animRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);

  const sortedTimes = useMemo(
    () => collectTimestamps(files, hiddenTracks),
    [files, hiddenTracks]
  );

  const minTime = sortedTimes.length > 0 ? sortedTimes[0] : 0;
  const maxTime = sortedTimes.length > 0 ? sortedTimes[sortedTimes.length - 1] : 0;
  const duration = maxTime - minTime;

  // Squad activity bars
  const squadBars = useMemo(() => {
    if (duration === 0) return [];

    const squads = new Map<string, { color: string; minT: number; maxT: number }>();

    for (const file of files) {
      for (const trk of file.tracks) {
        const trackKey = `${file.fileName}::${trk.name}`;
        if (hiddenTracks.has(trackKey)) continue;

        const baseName = trk.name.replace(/-\d+$/, '').trim();
        const color = getTrackColor(trk.name);

        if (!squads.has(baseName)) {
          squads.set(baseName, { color, minT: Infinity, maxT: -Infinity });
        }

        const squad = squads.get(baseName)!;
        for (const pt of trk.points) {
          if (pt.time) {
            const t = new Date(pt.time).getTime();
            if (t < squad.minT) squad.minT = t;
            if (t > squad.maxT) squad.maxT = t;
          }
        }
      }
    }

    return Array.from(squads.entries()).map(([name, data]) => ({
      name,
      color: data.color,
      startPct: ((data.minT - minTime) / duration) * 100,
      widthPct: ((data.maxT - data.minT) / duration) * 100,
    }));
  }, [files, hiddenTracks, minTime, duration]);

  // Animation loop with gap skipping
  const animate = useCallback(
    (timestamp: number) => {
      if (!lastFrameRef.current) lastFrameRef.current = timestamp;
      const delta = timestamp - lastFrameRef.current;
      lastFrameRef.current = timestamp;

      onTimeChange((prev) => {
        const cur = prev ?? minTime;
        let next = cur + delta * speed;

        // Skip gaps larger than 60 seconds in real time (= 60s * speed in playback time)
        // But check in REAL data time: if next 30 real seconds have no data, jump ahead
        const GAP_THRESHOLD = 30000; // 30 seconds in data time
        const gap = skipGap(sortedTimes, cur, GAP_THRESHOLD);
        if (gap !== null && next < gap) {
          next = gap; // Jump to next activity
        }

        if (next >= maxTime) {
          setIsPlaying(false);
          return maxTime;
        }
        return next;
      });

      animRef.current = requestAnimationFrame(animate);
    },
    [speed, minTime, maxTime, sortedTimes, onTimeChange]
  );

  useEffect(() => {
    if (isPlaying) {
      lastFrameRef.current = 0;
      animRef.current = requestAnimationFrame(animate);
    } else {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, animate]);

  const handlePlay = () => {
    if (currentTime === null || currentTime >= maxTime) {
      onTimeChange(minTime);
    }
    setIsPlaying(true);
  };

  const handleStop = () => {
    setIsPlaying(false);
    onTimeChange(null);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    onTimeChange(val);
    if (isPlaying) setIsPlaying(false);
  };

  const cycleSpeed = () => {
    const speeds = [10, 25, 50, 100, 200, 500];
    const idx = speeds.indexOf(speed);
    setSpeed(speeds[(idx + 1) % speeds.length]);
  };

  if (duration === 0) return null;

  const progress = currentTime !== null ? ((currentTime - minTime) / duration) * 100 : 0;

  return (
    <div className="timeline">
      <div className="timeline-controls">
        {!isPlaying ? (
          <button className="timeline-btn" onClick={handlePlay} title="Play">
            <PlayIcon />
          </button>
        ) : (
          <button className="timeline-btn" onClick={() => setIsPlaying(false)} title="Pausa">
            <PauseIcon />
          </button>
        )}
        <button className="timeline-btn" onClick={handleStop} title="Stop">
          <StopIcon />
        </button>
        <button className="timeline-btn speed-btn" onClick={cycleSpeed} title="Velocita'">
          <SpeedIcon />
          <span>{speed}x</span>
        </button>
      </div>

      <div className="timeline-track-area">
        {/* Squad activity bars */}
        <div className="timeline-bars">
          {squadBars.map((bar) => (
            <div
              key={bar.name}
              className="timeline-squad-bar"
              style={{
                left: `${bar.startPct}%`,
                width: `${Math.max(bar.widthPct, 0.5)}%`,
                backgroundColor: bar.color,
              }}
              title={bar.name}
            />
          ))}
        </div>

        {/* Slider */}
        <input
          type="range"
          className="timeline-slider"
          min={minTime}
          max={maxTime}
          value={currentTime ?? minTime}
          onChange={handleSliderChange}
          style={{
            background: `linear-gradient(to right, var(--accent) ${progress}%, var(--border) ${progress}%)`,
          }}
        />
      </div>

      <div className="timeline-time">
        <span className="timeline-current">
          {currentTime !== null ? formatTime(currentTime) : formatTime(minTime)}
        </span>
        <span className="timeline-date">
          {formatDate(minTime)}
        </span>
        <span className="timeline-end">
          {formatTime(maxTime)}
        </span>
      </div>
    </div>
  );
}
