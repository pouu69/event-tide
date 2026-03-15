import { useMemo } from 'react';
import type { TopicMeta, TopicEvent, EconDataPoint } from '../../types';
import { generateBIBriefing } from '../../lib/biInsights';
import type { BIBriefing, BISignal } from '../../lib/biInsights';
import s from './BIPanel.module.css';

interface Props {
  meta: TopicMeta;
  econ: EconDataPoint[];
  events: TopicEvent[];
  currentEvent: TopicEvent;
  currentIndex: number;
}

const RISK_LABEL: Record<BIBriefing['riskLevel'], string> = {
  LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', EXTREME: 'EXTREME',
};

function signalClass(type: BISignal['type']): string {
  switch (type) {
    case 'risk-off': return s.riskOff;
    case 'safe-haven': return s.safeHaven;
    case 'sector': return s.sector;
    default: return s.neutral;
  }
}

export default function BIPanel({ meta, econ, events, currentEvent, currentIndex }: Props) {
  const briefing = useMemo(
    () => generateBIBriefing(meta, events, econ, currentEvent, currentIndex),
    [meta, events, econ, currentEvent, currentIndex],
  );

  if (!briefing) return null;

  const { riskLevel, riskScore, situationSummary, signals, eventPattern, outlook, contrarian } = briefing;
  const levelLower = riskLevel.toLowerCase() as 'low' | 'medium' | 'high' | 'extreme';

  return (
    <div className={s.panel}>
      {/* Header */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <span className={s.headerTitle}>Analyst Briefing</span>
        </div>
        <span className={`${s.riskBadge} ${s[levelLower]}`}>
          <span className={s.riskDot} />
          {RISK_LABEL[riskLevel]}
        </span>
      </div>

      <div className={s.content}>
        {/* Situation Summary */}
        {situationSummary && (
          <section>
            <div className={s.sectionLabel}>상황 요약</div>
            <div className={s.summary}>{situationSummary}</div>
          </section>
        )}

        {/* Risk Meter */}
        <section className={s.riskMeter}>
          <div className={s.sectionLabel}>리스크 스코어 — {riskScore}/100</div>
          <div className={s.meterBar}>
            <div className={s.meterMarker} style={{ left: `${riskScore}%` }} />
          </div>
          <div className={s.meterLabels}>
            <span>LOW</span>
            <span>MEDIUM</span>
            <span>HIGH</span>
            <span>EXTREME</span>
          </div>
        </section>

        {/* Market Signals */}
        {signals.length > 0 && (
          <section>
            <div className={s.sectionLabel}>시장 시그널</div>
            <div className={s.signalList}>
              {signals.map((sig, i) => (
                <div key={i} className={`${s.signal} ${signalClass(sig.type)}`}>
                  <span>{sig.text}</span>
                  <span className={`${s.signalPct} ${sig.pctChange >= 0 ? s.up : s.down}`}>
                    {sig.pctChange > 0 ? '+' : ''}{sig.pctChange.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Event Pattern */}
        {eventPattern && (
          <section>
            <div className={s.sectionLabel}>이벤트 패턴</div>
            <div className={s.patternCard}>
              <span className={s.patternTag}>{eventPattern.tagLabel} 이벤트</span>
              {eventPattern.historicalAvg.length > 0 && (
                <div className={s.patternAvgs}>
                  {eventPattern.historicalAvg.map((avg, i) => (
                    <span key={i} className={`${s.patternAvg} ${avg.avgPct >= 0 ? s.up : s.down}`}>
                      {avg.metric} {avg.avgPct > 0 ? '+' : ''}{avg.avgPct.toFixed(1)}%
                    </span>
                  ))}
                </div>
              )}
              <p className={s.patternCommentary}>{eventPattern.commentary}</p>
            </div>
          </section>
        )}

        {/* Outlook */}
        {outlook.length > 0 && (
          <section>
            <div className={s.sectionLabel}>전망</div>
            <ul className={s.outlookList}>
              {outlook.map((item, i) => (
                <li key={i} className={s.outlookItem}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Contrarian Notes */}
        {contrarian.length > 0 && (
          <section>
            <div className={s.sectionLabel}>역발상 노트</div>
            <div className={s.contrarianList}>
              {contrarian.map((note, i) => (
                <div key={i} className={s.contrarianNote}>{note}</div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
