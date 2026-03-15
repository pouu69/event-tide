import { useState, useRef, useEffect } from 'react';
import type { TopicMeta, TopicEvent } from '../../types';
import { formatDateShort, getTagLabel } from '../../lib/utils';
import s from './EventSidebar.module.css';

interface Props {
  events: TopicEvent[];
  currentIndex: number;
  onGoTo: (index: number) => void;
  meta: TopicMeta;
}

export default function EventSidebar({ events, currentIndex, onGoTo, meta }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const cardsRef = useRef<HTMLDivElement>(null);

  // Current phase info
  const currentPhase = events[currentIndex]?.phase;
  const phaseInfo = meta.phases.find(p => p.id === currentPhase);

  // Auto-scroll active card into view
  useEffect(() => {
    const container = cardsRef.current;
    if (!container || collapsed) return;
    const active = container.querySelector(`.${s.active}`) as HTMLElement | null;
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentIndex, collapsed]);

  return (
    <aside className={`${s.sidebar} ${collapsed ? s.collapsed : ''}`}>
      <div className={s.inner}>
        <div className={s.header}>
          <div className={s.headerRow}>
            <div>
              <h2>{phaseInfo?.title ?? ''}</h2>
              <p>{phaseInfo?.period ?? ''}</p>
            </div>
            <button
              className={s.toggle}
              onClick={() => setCollapsed(c => !c)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          </div>
        </div>
        <div className={s.cards} ref={cardsRef}>
          {events.map((evt, i) => (
            <div
              key={evt.id}
              className={`${s.card} ${i === currentIndex ? s.active : ''}`}
              onClick={() => onGoTo(i)}
            >
              <div className={s.cardDate}>{formatDateShort(evt.date)}</div>
              <div className={s.cardTitle}>{evt.title}</div>
              <span className={`${s.cardTag} ${s[`t_${evt.tag}`] || ''}`}>
                {getTagLabel(evt.tag)}
              </span>
            </div>
          ))}
        </div>
      </div>
      {collapsed && (
        <button
          className={s.toggleCollapsed}
          onClick={() => setCollapsed(false)}
          aria-label="Expand sidebar"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      )}
    </aside>
  );
}
