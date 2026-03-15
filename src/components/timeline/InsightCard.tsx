import type { InsightData } from '../../types';
import s from './InsightCard.module.css';

interface Props {
  insight: InsightData;
}

export default function InsightCard({ insight }: Props) {
  const { headline, impactScore, top3, phaseProgress, phaseColor, phaseTitle } = insight;

  return (
    <div className={s.card}>
      <div className={s.row}>
        {/* Impact score badge */}
        <div className={s.badge} style={{ borderColor: impactScore >= 7 ? '#c0392b' : impactScore >= 4 ? '#e67e22' : '#27ae60' }}>
          <span className={s.badgeNum}>{impactScore}</span>
          <span className={s.badgeLabel}>IMPACT</span>
        </div>

        {/* Headline */}
        <div className={s.content}>
          <h3 className={s.headline}>{headline}</h3>

          {/* Top 3 metrics */}
          {top3.length > 0 && (
            <div className={s.metrics}>
              {top3.map((t, i) => (
                <span key={i} className={s.metric}>
                  <strong>{t.label}</strong> {t.value}
                  {t.context && <em className={s.ctx}>{t.context}</em>}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Phase progress bar */}
      <div className={s.progressWrap}>
        <div className={s.progressBar}>
          <div
            className={s.progressFill}
            style={{ width: `${phaseProgress * 100}%`, background: phaseColor }}
          />
        </div>
        {phaseTitle && <span className={s.phaseLabel}>{phaseTitle}</span>}
      </div>
    </div>
  );
}
