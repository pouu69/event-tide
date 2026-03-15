import { useRef, useEffect } from 'react';
import type { TopicMeta, TopicEvent } from '../../types';
import s from './TimelineStrip.module.css';

interface Props {
  meta: TopicMeta;
  events: TopicEvent[];
  currentIndex: number;
  onGoTo: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export default function TimelineStrip({
  meta, events, currentIndex, onGoTo, isPlaying, onTogglePlay, onPrev, onNext,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  // Count events per phase
  const phaseCounts: Record<string, number> = {};
  events.forEach(e => { phaseCounts[e.phase] = (phaseCounts[e.phase] || 0) + 1; });

  const currentPhase = events[currentIndex]?.phase;

  // Auto-scroll active dot into view
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const active = track.querySelector(`.${s.active}`) as HTMLElement | null;
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [currentIndex]);

  return (
    <div className={s.strip}>
      {/* Phase labels */}
      <div className={s.phaseLabels}>
        {meta.phases.map(p => {
          if (!phaseCounts[p.id]) return null;
          return (
            <div
              key={p.id}
              className={`${s.phaseLbl} ${currentPhase === p.id ? s.lblActive : ''}`}
              style={{ flex: phaseCounts[p.id] }}
              onClick={() => {
                const idx = events.findIndex(e => e.phase === p.id);
                if (idx >= 0) onGoTo(idx);
              }}
            >
              {p.title.split(':')[0]}
            </div>
          );
        })}
      </div>

      {/* Phase color bar */}
      <div className={s.phases}>
        {meta.phases.map(p => {
          if (!phaseCounts[p.id]) return null;
          return (
            <div
              key={p.id}
              className={s.phaseSeg}
              style={{ flex: phaseCounts[p.id], background: p.color }}
              title={p.title}
              onClick={() => {
                const idx = events.findIndex(e => e.phase === p.id);
                if (idx >= 0) onGoTo(idx);
              }}
            />
          );
        })}
      </div>

      {/* Event dot track */}
      <div className={s.trackWrapper}>
        <div className={s.track} ref={trackRef}>
          {events.map((evt, i) => (
            <div
              key={evt.id}
              className={`${s.event} ${i === currentIndex ? s.active : ''} ${i < currentIndex ? s.passed : ''}`}
              onClick={() => onGoTo(i)}
            >
              <div className={s.tooltip}>{evt.title}</div>
              <div className={s.dot} />
              <span className={s.eventLabel}>{evt.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className={s.controls}>
        <button className={s.btn} onClick={onPrev} aria-label="Previous">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button
          className={`${s.btn} ${s.btnPlay} ${isPlaying ? s.playing : ''}`}
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>
          )}
        </button>
        <button className={s.btn} onClick={onNext} aria-label="Next">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
  );
}
