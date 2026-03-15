import { useRef, useEffect } from 'react';
import type { TopicMeta, TopicEvent, EconDataPoint } from '../../types';
import { formatDateLong, getTagLabel, getNearestEconData, pctChange } from '../../lib/utils';
import { computeStatContext } from '../../lib/storytelling';
import MiniTrend from '../common/MiniTrend';
import s from './EventDetail.module.css';

interface Props {
  event: TopicEvent;
  meta: TopicMeta;
  econ: EconDataPoint[];
  events: TopicEvent[];
  currentIndex: number;
}

const DAY_MS = 86400000;

export default function EventDetail({ event, meta, econ, events, currentIndex }: Props) {
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

  // Previous event for delta computation
  const prevEvent = currentIndex > 0 ? events[currentIndex - 1] : null;
  const prevEconPoint = prevEvent ? getNearestEconData(prevEvent.date, econ) : null;

  // Baseline & timing
  const econBaseline = econ[0] || null;
  const daysSinceStart = Math.max(1, Math.floor(
    (new Date(event.date).getTime() - new Date(meta.startDate).getTime()) / DAY_MS
  ) + 1);

  // Build stats from meta.statsFields
  const econPoint = getNearestEconData(event.date, econ);
  const econKeys = new Set(['oil', 'kospi', 'sp500']);

  const stats = meta.statsFields.map(sf => {
    let value: string;
    const raw = event.metrics[sf.key];
    const isEconKey = econKeys.has(sf.key);

    if (isEconKey) {
      const v = econPoint ? econPoint[sf.key] : null;
      value = v != null ? (sf.key === 'oil' ? `$${v}` : `${Number(v).toLocaleString()}`) : '—';
    } else if (sf.key === 'cost') {
      value = raw != null ? `$${raw}B` : '—';
    } else {
      value = raw != null ? Number(raw).toLocaleString() : '—';
    }

    // Delta computation
    let delta: number | null = null;
    if (prevEvent) {
      if (isEconKey) {
        const curVal = econPoint ? Number(econPoint[sf.key]) : null;
        const prevVal = prevEconPoint ? Number(prevEconPoint[sf.key]) : null;
        if (curVal != null && prevVal != null && !isNaN(curVal) && !isNaN(prevVal)) {
          delta = curVal - prevVal;
        }
      } else {
        const curVal = event.metrics[sf.key];
        const prevVal = prevEvent.metrics[sf.key];
        if (curVal != null && prevVal != null) {
          delta = curVal - prevVal;
        }
      }
    }

    // MiniTrend data: last 7 events ending at currentIndex
    const trendStart = Math.max(0, currentIndex - 6);
    const trendData: number[] = [];
    for (let i = trendStart; i <= currentIndex; i++) {
      if (isEconKey) {
        const ep = getNearestEconData(events[i].date, econ);
        const v = ep ? Number(ep[sf.key]) : NaN;
        trendData.push(isNaN(v) ? 0 : v);
      } else {
        const v = events[i].metrics[sf.key];
        trendData.push(v != null ? v : 0);
      }
    }

    // Context text
    let context: string | null = null;
    let pctFromBaseline: string | null = null;

    if (isEconKey && econPoint && econBaseline) {
      const curVal = Number(econPoint[sf.key]);
      const baseVal = Number(econBaseline[sf.key]);
      if (!isNaN(curVal) && !isNaN(baseVal) && baseVal !== 0) {
        pctFromBaseline = `개전 대비 ${pctChange(curVal, baseVal)}`;
      }
    } else if (raw != null && raw > 0 && !isEconKey && sf.key !== 'cost') {
      context = computeStatContext(raw, daysSinceStart);
    }

    // Severity: normalize delta to 0-1
    let severity = 0;
    if (delta != null && delta !== 0) {
      const absDelta = Math.abs(delta);
      severity = Math.min(1, absDelta / (Math.max(Math.abs(raw || 1), 100)));
    }

    return { ...sf, value, delta, trendData, context, pctFromBaseline, severity };
  });

  // Identify highlight: stat with largest absolute delta
  let maxDeltaIdx = -1;
  let maxDeltaAbs = 0;
  stats.forEach((st, i) => {
    if (st.delta != null) {
      const abs = Math.abs(st.delta);
      if (abs > maxDeltaAbs) {
        maxDeltaAbs = abs;
        maxDeltaIdx = i;
      }
    }
  });

  // Market reaction section
  const econNow = getNearestEconData(event.date, econ);
  const econNext = econ.find(d => (d.date as string) > event.date);
  const marketReactions: { label: string; pct: string; isNeg: boolean }[] = [];

  if (econNow && econNext) {
    meta.metricDefs
      .filter(m => m.showOnDetail)
      .forEach(m => {
        const valNow = Number(econNow[m.key]);
        const valNext = Number(econNext[m.key]);
        if (!isNaN(valNow) && !isNaN(valNext) && valNow !== 0) {
          const pctVal = ((valNext - valNow) / valNow) * 100;
          marketReactions.push({
            label: m.label,
            pct: `${pctVal > 0 ? '+' : ''}${pctVal.toFixed(1)}%`,
            isNeg: pctVal < 0,
          });
        }
      });
  }

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
        {stats.map((st, idx) => {
          const isHighlight = idx === maxDeltaIdx;
          const bgAlpha = st.severity > 0.3 ? Math.min(0.08, st.severity * 0.1) : 0;
          return (
            <div
              key={st.key}
              className={`${s.ss} ${isHighlight ? s.ssHighlight : ''}`}
              style={bgAlpha > 0 ? { background: `rgba(192,57,43,${bgAlpha})` } : undefined}
            >
              <div className={s.ssTop}>
                <span className={s.ssVal} style={{ color: st.color }}>{st.value}</span>
                {st.trendData.length >= 2 && (
                  <MiniTrend data={st.trendData} color={st.color} />
                )}
              </div>
              <span className={s.ssLabel}>{st.label}</span>
              {st.delta != null && st.delta !== 0 && (
                <span className={st.delta > 0 ? s.deltaUp : s.deltaDown}>
                  {st.delta > 0 ? `▲ +${Number(Math.abs(st.delta)).toLocaleString()}` : `▼ -${Number(Math.abs(st.delta)).toLocaleString()}`}
                </span>
              )}
              {/* Context text */}
              {(st.context || st.pctFromBaseline) && (
                <span className={s.ssContext}>
                  {st.context || st.pctFromBaseline}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Market reaction */}
      {marketReactions.length > 0 && (
        <div className={s.marketReaction}>
          <span className={s.marketLabel}>시장 반응:</span>
          {marketReactions.map(mr => (
            <span key={mr.label} className={`${s.marketBadge} ${mr.isNeg ? s.marketBadgeNeg : s.marketBadgePos}`}>
              {mr.label} {mr.pct}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
