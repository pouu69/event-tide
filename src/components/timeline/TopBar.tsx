import { useNavigate } from 'react-router-dom';
import type { TopicMeta, TopicEvent, EconDataPoint } from '../../types';
import { getNearestEconData } from '../../lib/utils';
import s from './TopBar.module.css';

interface Props {
  meta: TopicMeta;
  event: TopicEvent;
  econ: EconDataPoint[];
}

const DAY_MS = 86400000;

function warDay(dateStr: string, startDate: string): number | null {
  const d = new Date(dateStr).getTime();
  const ws = new Date(startDate).getTime();
  return d >= ws ? Math.floor((d - ws) / DAY_MS) + 1 : null;
}

export default function TopBar({ meta, event, econ }: Props) {
  const navigate = useNavigate();
  const day = warDay(event.date, meta.startDate);

  // Pick top 2-3 statsFields that have values
  const topStats = meta.statsFields.slice(0, 3).map(sf => {
    let value: string;
    const raw = event.metrics[sf.key];
    if (sf.key === 'oil') {
      const ep = getNearestEconData(event.date, econ);
      value = ep ? `$${ep[sf.key]}` : '—';
    } else if (sf.key === 'cost') {
      value = raw != null ? `$${raw}B` : '—';
    } else {
      value = raw != null ? raw.toLocaleString() : '—';
    }
    return { ...sf, value };
  });

  return (
    <header className={s.topbar}>
      <div className={s.left}>
        <button className={s.back} onClick={() => navigate('/')} aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className={s.brand}>
          <div className={s.flag} />
          <h1>{meta.title}</h1>
        </div>
      </div>
      <div className={s.right}>
        <div className={s.dayCounter}>
          <span className={s.dayValue}>
            {day !== null ? `DAY ${day}` : `D-${Math.floor((new Date(meta.startDate).getTime() - new Date(event.date).getTime()) / DAY_MS)}`}
          </span>
          <span className={s.dayLabel}>{day !== null ? 'OF WAR' : 'TO WAR'}</span>
        </div>
        {topStats.map((st, i) => (
          <div key={st.key} className={s.stat}>
            {i === 0 && <div className={s.divider} />}
            <span className={s.statVal}>{st.value}</span>
            <span className={s.statLabel}>{st.label}</span>
            {i < topStats.length - 1 && <div className={s.divider} />}
          </div>
        ))}
      </div>
    </header>
  );
}
