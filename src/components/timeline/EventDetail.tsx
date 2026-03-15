import { useRef, useEffect } from 'react';
import type { TopicMeta, TopicEvent, EconDataPoint } from '../../types';
import { formatDateLong, getTagLabel, getNearestEconData } from '../../lib/utils';
import s from './EventDetail.module.css';

interface Props {
  event: TopicEvent;
  meta: TopicMeta;
  econ: EconDataPoint[];
}

export default function EventDetail({ event, meta, econ }: Props) {
  const detailRef = useRef<HTMLDivElement>(null);

  // Trigger entry animation on event change
  useEffect(() => {
    const el = detailRef.current;
    if (!el) return;
    el.classList.remove(s.animIn);
    // Force reflow
    void el.offsetWidth;
    el.classList.add(s.animIn);
  }, [event.id]);

  // Build stats from meta.statsFields
  const econPoint = getNearestEconData(event.date, econ);
  const stats = meta.statsFields.map(sf => {
    let value: string;
    const raw = event.metrics[sf.key];
    if (sf.key === 'oil' || sf.key === 'kospi' || sf.key === 'sp500') {
      // econ-sourced values
      const v = econPoint ? econPoint[sf.key] : null;
      value = v != null ? (sf.key === 'oil' ? `$${v}` : `${Number(v).toLocaleString()}`) : '—';
    } else if (sf.key === 'cost') {
      value = raw != null ? `$${raw}B` : '—';
    } else {
      value = raw != null ? Number(raw).toLocaleString() : '—';
    }
    return { ...sf, value };
  });

  return (
    <div className={s.card} ref={detailRef}>
      {/* Top line */}
      <div className={s.topline}>
        <span className={s.date}>{formatDateLong(event.date)}</span>
        <span className={s.tag}>{getTagLabel(event.tag)}</span>
      </div>

      <h2 className={s.title}>{event.title}</h2>
      <p className={s.desc}>{event.desc}</p>

      {/* Detail bullets */}
      {event.details && event.details.length > 0 && (
        <ul className={s.bullets}>
          {event.details.map((d, i) => <li key={i}>{d}</li>)}
        </ul>
      )}

      {/* Source links */}
      {event.sources && event.sources.length > 0 && (
        <div className={s.sources}>
          {event.sources.map((src, i) => (
            <a key={i} href={src.url} className={s.sourceLink} target="_blank" rel="noopener noreferrer">
              {src.name}
            </a>
          ))}
        </div>
      )}

      {/* Stats grid */}
      <div className={s.statsGrid}>
        {stats.map(st => (
          <div key={st.key} className={s.ss}>
            <span className={s.ssVal} style={{ color: st.color }}>{st.value}</span>
            <span className={s.ssLabel}>{st.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
