import type { TopicMeta, EconDataPoint } from '../../types';
import { getNearestEconData } from '../../lib/utils';
import s from './InvestSimPanel.module.css';

interface Props {
  meta: TopicMeta;
  econ: EconDataPoint[];
  currentDate: string;
}

const INVEST_AMOUNT = 1_000_000;

export default function InvestSimPanel({ meta, econ, currentDate }: Props) {
  const baseline = getNearestEconData(meta.baselineDate, econ);
  const current = getNearestEconData(currentDate, econ);

  if (!baseline || !current) return null;

  const metrics = meta.metricDefs
    .filter(m => m.showOnDetail)
    .map(m => {
      const baseVal = Number(baseline[m.key]);
      const curVal = Number(current[m.key]);
      const pctReturn = baseVal !== 0 ? ((curVal - baseVal) / baseVal) * 100 : 0;
      const returnAmount = INVEST_AMOUNT * (1 + pctReturn / 100);
      const gainLoss = returnAmount - INVEST_AMOUNT;
      return { key: m.key, label: m.label, pctReturn, returnAmount, gainLoss };
    })
    .sort((a, b) => b.returnAmount - a.returnAmount);

  return (
    <div className={s.card}>
      <div className={s.header}>
        <h3>투자 시뮬레이션</h3>
        <span className={s.sub}>기준일에 ₩{INVEST_AMOUNT.toLocaleString()} 투자 시</span>
      </div>
      <div className={s.grid}>
        <div className={`${s.row} ${s.headerRow}`}>
          <span>지표</span>
          <span>수익률</span>
          <span>평가금</span>
          <span>손익</span>
        </div>
        {metrics.map(m => {
          const isPos = m.gainLoss >= 0;
          return (
            <div key={m.key} className={`${s.row} ${isPos ? s.pos : s.neg}`}>
              <span className={s.metricName}>{m.label}</span>
              <span className={s.pct}>
                {m.pctReturn > 0 ? '+' : ''}{m.pctReturn.toFixed(1)}%
              </span>
              <span className={s.amount}>₩{Math.round(m.returnAmount).toLocaleString()}</span>
              <span className={s.gain}>
                {isPos ? '+' : ''}₩{Math.round(m.gainLoss).toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
