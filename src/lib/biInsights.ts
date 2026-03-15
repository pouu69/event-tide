import type { TopicMeta, TopicEvent, EconDataPoint } from '../types';
import { getNearestEconData, pctChange } from './utils';
import { computeImpactScore } from './storytelling';
import {
  buildMetricClusters,
  buildMetricPairs,
  computeTagReactions,
  computeScatterData,
} from './correlation';

/* ─── Types ─── */

export interface BIBriefing {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  riskScore: number; // 0-100
  situationSummary: string;
  signals: BISignal[];
  eventPattern: BIEventPattern | null;
  outlook: string[];
  contrarian: string[];
}

export interface BISignal {
  type: 'risk-off' | 'safe-haven' | 'sector' | 'neutral';
  text: string;
  metric: string;
  pctChange: number;
}

export interface BIEventPattern {
  tag: string;
  tagLabel: string;
  historicalAvg: { metric: string; avgPct: number }[];
  currentDeviation: number | null;
  commentary: string;
}

/* ─── VIX Zone helpers ─── */

function getVixZone(vix: number): string {
  if (vix >= 35) return '극단적 공포';
  if (vix >= 25) return '공포';
  if (vix >= 18) return '중립';
  if (vix >= 12) return '탐욕';
  return '극단적 탐욕';
}

/* ─── Risk level from score ─── */

function riskLevelFromScore(score: number): BIBriefing['riskLevel'] {
  if (score >= 75) return 'EXTREME';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

/* ─── Signal type classification ─── */

const RISK_OFF_KEYS = new Set(['vix', 'gold', 'usd_idx']);
const SAFE_HAVEN_KEYS = new Set(['us10y', 'gold', 'usd_idx']);
const SECTOR_KEYS = new Set(['oil', 'xle', 'wheat', 'copper', 'nikkei']);

function classifySignal(key: string): BISignal['type'] {
  if (RISK_OFF_KEYS.has(key)) return 'risk-off';
  if (SAFE_HAVEN_KEYS.has(key)) return 'safe-haven';
  if (SECTOR_KEYS.has(key)) return 'sector';
  return 'neutral';
}

/* ─── Main briefing generator ─── */

export function generateBIBriefing(
  meta: TopicMeta,
  events: TopicEvent[],
  econ: EconDataPoint[],
  currentEvent: TopicEvent,
  currentIndex: number,
): BIBriefing {
  const prevEvent = currentIndex > 0 ? events[currentIndex - 1] : null;
  const econNow = getNearestEconData(currentEvent.date, econ);
  const econPrev = prevEvent ? getNearestEconData(prevEvent.date, econ) : null;
  const econBaseline = econ[0] || null;

  // ── Impact score (1-10) → risk score (0-100)
  const impact = computeImpactScore(currentEvent, prevEvent, econNow, econPrev, meta);

  // ── VIX contribution
  const vix = econNow ? Number(econNow.vix) : NaN;
  const vixContribution = !isNaN(vix) ? Math.min(30, (vix / 50) * 30) : 0;

  // ── Metric volatility contribution
  let maxPctFromBaseline = 0;
  let topMetricLabel = '';
  let topMetricVal = '';
  let topMetricPct = '';

  if (econNow && econBaseline) {
    for (const m of meta.metricDefs.filter(md => md.showOnDetail)) {
      const baseVal = Number(econBaseline[m.key]);
      const curVal = Number(econNow[m.key]);
      if (isNaN(baseVal) || isNaN(curVal) || baseVal === 0) continue;
      const absPct = Math.abs((curVal - baseVal) / baseVal) * 100;
      if (absPct > maxPctFromBaseline) {
        maxPctFromBaseline = absPct;
        topMetricLabel = m.label;
        topMetricVal = m.unit === '$' ? `$${curVal}` : `${curVal.toLocaleString()}${m.unit}`;
        topMetricPct = pctChange(curVal, baseVal);
      }
    }
  }

  const volatilityContribution = Math.min(20, maxPctFromBaseline);
  const riskScore = Math.min(100, Math.round(
    (impact / 10) * 50 + vixContribution + volatilityContribution
  ));
  const riskLevel = riskLevelFromScore(riskScore);

  // ── Days since start
  const daysSince = Math.max(1, Math.floor(
    (new Date(currentEvent.date).getTime() - new Date(meta.startDate).getTime()) / 86400000
  ) + 1);

  // ── Phase info
  const currentPhase = meta.phases.find(p => p.id === currentEvent.phase);
  const phaseLabel = currentPhase?.title || '';

  // ── 1. Situation Summary
  let situationSummary = `${daysSince}일차.`;
  if (phaseLabel) {
    situationSummary += ` ${phaseLabel} 국면.`;
  }
  if (topMetricLabel && maxPctFromBaseline > 3) {
    situationSummary += ` ${topMetricLabel} ${topMetricVal}(${topMetricPct}).`;
  }
  if (!isNaN(vix)) {
    situationSummary += ` VIX ${vix.toFixed(1)} — ${getVixZone(vix)}.`;
  }

  // ── 2. Market Signals from clusters
  const signals: BISignal[] = [];
  const clusters = buildMetricClusters(meta.metricDefs, econ);
  const pairs = buildMetricPairs(meta.metricDefs, econ);

  for (const cluster of clusters) {
    for (const m of cluster.metrics) {
      const type = classifySignal(m.key);
      let text = `${m.label} ${m.pctChange > 0 ? '+' : ''}${m.pctChange.toFixed(1)}%`;

      // Add correlation context from top pairs
      const relevantPair = pairs.find(
        p => (p.aKey === m.key || p.bKey === m.key) && Math.abs(p.r) > 0.6
      );
      if (relevantPair) {
        const other = relevantPair.aKey === m.key ? relevantPair.bLabel : relevantPair.aLabel;
        if (relevantPair.r > 0.6) {
          text += ` — ${other}과(와) 동조`;
        } else if (relevantPair.r < -0.6) {
          text += ` — ${other}과(와) 역상관`;
        }
      }

      signals.push({ type, text, metric: m.label, pctChange: m.pctChange });
    }
  }

  // Sort by absolute pctChange
  signals.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange));

  // ── 3. Event Pattern (tag-based)
  let eventPattern: BIEventPattern | null = null;
  const tagReactions = computeTagReactions(events, econ, meta.metricDefs);
  const currentTagReaction = tagReactions.find(tr => tr.tag === currentEvent.tag);

  if (currentTagReaction && currentTagReaction.count >= 2) {
    const historicalAvg = currentTagReaction.avgReactions
      .filter(r => Math.abs(r.avgPct) > 0.1)
      .slice(0, 4)
      .map(r => ({ metric: r.label, avgPct: r.avgPct }));

    // Compare current event's actual reaction to historical avg
    let currentDeviation: number | null = null;
    if (econNow && econPrev && historicalAvg.length > 0) {
      const topAvg = historicalAvg[0];
      const matchingDef = meta.metricDefs.find(m => m.label === topAvg.metric);
      if (matchingDef) {
        const curVal = Number(econNow[matchingDef.key]);
        const prevVal = Number(econPrev[matchingDef.key]);
        if (!isNaN(curVal) && !isNaN(prevVal) && prevVal !== 0) {
          const actualPct = ((curVal - prevVal) / prevVal) * 100;
          currentDeviation = actualPct - topAvg.avgPct;
        }
      }
    }

    let commentary = `${currentTagReaction.tagLabel} 이벤트(${currentTagReaction.count}건) 발생 시 `;
    if (historicalAvg.length > 0) {
      const top = historicalAvg[0];
      commentary += `${top.metric}이(가) 평균 ${top.avgPct > 0 ? '+' : ''}${top.avgPct.toFixed(1)}% 반응.`;
    }
    if (currentDeviation !== null && Math.abs(currentDeviation) > 1) {
      commentary += ` 현재는 평균 대비 ${currentDeviation > 0 ? '+' : ''}${currentDeviation.toFixed(1)}%p 벗어남.`;
    }

    eventPattern = {
      tag: currentEvent.tag,
      tagLabel: currentTagReaction.tagLabel,
      historicalAvg,
      currentDeviation,
      commentary,
    };
  }

  // ── 4. Outlook
  const outlook: string[] = [];
  const scatterData = computeScatterData(events, econ, meta.metricDefs, meta.statsFields);

  // Trend slope from scatter
  if (scatterData.length >= 3) {
    const n = scatterData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (const p of scatterData) {
      sumX += p.escalationScore;
      sumY += p.marketReaction;
      sumXY += p.escalationScore * p.marketReaction;
      sumX2 += p.escalationScore * p.escalationScore;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
    if (slope > 0.3) {
      outlook.push('에스컬레이션 강도와 시장 변동이 강한 양의 상관 — 추가 확전 시 충격 확대 가능');
    } else if (slope < 0.1) {
      outlook.push('시장이 에스컬레이션에 점차 둔감해지는 추세 — 내성(tolerance) 형성 가능성');
    }
  }

  // VIX-based outlook
  if (!isNaN(vix)) {
    if (vix >= 35) {
      outlook.push('VIX 극단적 공포 구간 — 역사적으로 단기 반등 확률이 높은 영역');
    } else if (vix >= 25) {
      outlook.push('VIX 공포 구간 — 변동성 확대 지속 가능, 추가 하락 리스크 존재');
    } else if (vix < 15) {
      outlook.push('VIX 안정 구간 — 시장 자신감 회복, 다만 급변 리스크 경계 필요');
    }
  }

  // Risk level based outlook
  if (riskLevel === 'EXTREME') {
    outlook.push('리스크 스코어 최고 수준 — 포트폴리오 방어 전략 권고');
  } else if (riskLevel === 'HIGH') {
    outlook.push('리스크 스코어 상승 — 안전자산 비중 확대 고려');
  }

  if (outlook.length === 0) {
    outlook.push('현재 시장 지표는 뚜렷한 방향성을 보이지 않음 — 관망 권고');
  }

  // ── 5. Contrarian notes
  const contrarian: string[] = [];

  // Diplomacy tag average reaction
  const diplomacyReaction = tagReactions.find(tr => tr.tag === 'diplomacy');
  if (diplomacyReaction && diplomacyReaction.count >= 2) {
    const topReaction = diplomacyReaction.avgReactions[0];
    if (topReaction && Math.abs(topReaction.avgPct) > 1) {
      contrarian.push(
        `외교 이벤트 시 ${topReaction.label} 평균 ${topReaction.avgPct > 0 ? '+' : ''}${topReaction.avgPct.toFixed(1)}% — ${topReaction.avgPct < 0 ? '하락' : '상승'} 패턴`
      );
    }
  }

  // VIX extreme contrarian signal
  if (!isNaN(vix) && vix >= 35) {
    contrarian.push('극단적 공포 구간은 역사적으로 역발상 매수 시그널 — 패닉 셀링 후 반등 경향');
  }

  // Cluster-based contrarian: if main group is all down, find inverse
  if (clusters.length >= 2) {
    const mainCluster = clusters[0];
    const inverseCluster = clusters[1];
    if (mainCluster.direction === 'down' && inverseCluster.direction === 'up') {
      const topInverse = inverseCluster.metrics[0];
      if (topInverse) {
        contrarian.push(
          `주요 지표 하락 속 ${topInverse.label}은 +${topInverse.pctChange.toFixed(1)}% 상승 — 안전자산 수요 또는 디커플링 시그널`
        );
      }
    }
  }

  if (contrarian.length === 0 && signals.length > 0) {
    const biggestMover = signals[0];
    if (Math.abs(biggestMover.pctChange) > 10) {
      contrarian.push(
        `${biggestMover.metric} ${Math.abs(biggestMover.pctChange).toFixed(0)}% 급변동 — 과도한 반응일 경우 평균회귀 가능성`
      );
    }
  }

  return {
    riskLevel,
    riskScore,
    situationSummary,
    signals: signals.slice(0, 6),
    eventPattern,
    outlook,
    contrarian,
  };
}
