import type {
  TopicMeta, TopicEvent, EconDataPoint, InsightData, MetricDef,
} from '../types';
import { getNearestEconData, pctChange } from './utils';

const DAY_MS = 86400000;

function daysSince(startDate: string, currentDate: string): number {
  const diff = new Date(currentDate).getTime() - new Date(startDate).getTime();
  return Math.max(1, Math.floor(diff / DAY_MS) + 1);
}

/** Compute impact score 1-10 based on metric changes, casualties, and event tag */
export function computeImpactScore(
  event: TopicEvent,
  prevEvent: TopicEvent | null,
  econNow: EconDataPoint | null,
  econPrev: EconDataPoint | null,
  meta: TopicMeta,
): number {
  let score = 0;

  // Econ volatility (max contribution: 4)
  if (econNow && econPrev) {
    const changes = meta.metricDefs
      .filter(m => m.showOnDetail)
      .map(m => {
        const cur = Number(econNow[m.key]);
        const prev = Number(econPrev[m.key]);
        return prev !== 0 ? Math.abs((cur - prev) / prev) * 100 : 0;
      });
    const maxChange = Math.max(...changes, 0);
    score += Math.min(4, maxChange / 3); // 12%+ → 4
  }

  // Casualties / stats magnitude (max contribution: 3)
  const casualtyKeys = ['casualties', 'killed', 'wounded', 'displaced'];
  for (const k of casualtyKeys) {
    const val = event.metrics[k];
    if (val != null && val > 0) {
      const prevVal = prevEvent?.metrics[k] ?? 0;
      const delta = val - prevVal;
      if (delta > 1000) score += 3;
      else if (delta > 100) score += 2;
      else if (delta > 0) score += 1;
      break;
    }
  }

  // Tag weight (max contribution: 3)
  const tagWeights: Record<string, number> = {
    military: 3, crisis: 3, nuclear: 3,
    civilian: 2, political: 1, diplomacy: 1,
    protest: 1, analysis: 0, current: 0,
  };
  score += tagWeights[event.tag] ?? 1;

  return Math.max(1, Math.min(10, Math.round(score)));
}

/** Generate daily rate context string */
export function computeStatContext(value: number, daysSinceStart: number): string {
  if (daysSinceStart <= 0 || value === 0) return '';
  const daily = value / daysSinceStart;
  if (daily >= 1) return `일평균 ${Math.round(daily).toLocaleString()}명`;
  return `${daysSinceStart}일간 누적`;
}

/** Sort metric defs by volatility in chart data */
export function computeVolatileMetrics(
  metricDefs: MetricDef[],
  chartData: EconDataPoint[],
): MetricDef[] {
  if (chartData.length < 2) return metricDefs;
  const baseline = chartData[0];

  const withVolatility = metricDefs.map(m => {
    const baseVal = Number(baseline[m.key]);
    if (baseVal === 0 || isNaN(baseVal)) return { metric: m, volatility: 0 };

    let maxAbsChange = 0;
    for (const d of chartData) {
      const val = Number(d[m.key]);
      if (!isNaN(val)) {
        const absChange = Math.abs((val - baseVal) / baseVal) * 100;
        if (absChange > maxAbsChange) maxAbsChange = absChange;
      }
    }
    return { metric: m, volatility: maxAbsChange };
  });

  return withVolatility
    .sort((a, b) => b.volatility - a.volatility)
    .map(v => v.metric);
}

/** Find the biggest single-step move across all datasets */
export function findBiggestMove(
  chartData: EconDataPoint[],
  datasets: { key: string; label: string; color: string }[],
): { dataIndex: number; text: string; pctChange: number; color: string } | null {
  if (chartData.length < 2) return null;

  let best = { dataIndex: 0, text: '', pctChange: 0, color: '' };

  for (const ds of datasets) {
    const baseVal = Number(chartData[0][ds.key]);
    if (baseVal === 0 || isNaN(baseVal)) continue;

    for (let i = 1; i < chartData.length; i++) {
      const prev = Number(chartData[i - 1][ds.key]);
      const cur = Number(chartData[i][ds.key]);
      if (isNaN(prev) || isNaN(cur) || prev === 0) continue;

      const change = Math.abs((cur - prev) / prev) * 100;
      if (change > Math.abs(best.pctChange)) {
        const sign = cur > prev ? '+' : '';
        best = {
          dataIndex: i,
          text: `${ds.label} ${sign}${((cur - prev) / prev * 100).toFixed(1)}%`,
          pctChange: (cur - prev) / prev * 100,
          color: ds.color,
        };
      }
    }
  }

  return best.pctChange !== 0 ? best : null;
}

/** Generate the headline insight for an event */
export function generateInsight(
  event: TopicEvent,
  prevEvent: TopicEvent | null,
  meta: TopicMeta,
  econ: EconDataPoint[],
  events: TopicEvent[],
  currentIndex: number,
): InsightData {
  const econNow = getNearestEconData(event.date, econ);
  const econPrev = prevEvent ? getNearestEconData(prevEvent.date, econ) : null;
  const econBaseline = econ[0] || null;
  const days = daysSince(meta.startDate, event.date);

  // Impact score
  const impactScore = computeImpactScore(event, prevEvent, econNow, econPrev, meta);

  // Headline: find the largest change metric from baseline
  let headline = event.title;
  if (econNow && econBaseline) {
    let maxChange = 0;
    let maxLabel = '';
    let maxVal = '';
    let maxPct = '';

    for (const m of meta.metricDefs.filter(md => md.showOnDetail)) {
      const baseVal = Number(econBaseline[m.key]);
      const curVal = Number(econNow[m.key]);
      if (isNaN(baseVal) || isNaN(curVal) || baseVal === 0) continue;

      const change = Math.abs((curVal - baseVal) / baseVal) * 100;
      if (change > maxChange) {
        maxChange = change;
        maxLabel = m.label;
        const displayVal = m.unit === '$' ? `$${curVal}` : curVal.toLocaleString();
        maxVal = displayVal;
        maxPct = pctChange(curVal, baseVal);
      }
    }

    if (maxChange > 5) {
      headline = `${maxLabel} ${maxVal} — 전쟁 전 대비 ${maxPct}`;
    }
  }

  // Top 3: biggest changing stats/metrics
  const top3: InsightData['top3'] = [];

  // Check stat fields
  for (const sf of meta.statsFields) {
    const val = event.metrics[sf.key];
    if (val == null) continue;
    const context = computeStatContext(val, days);
    top3.push({
      label: sf.label,
      value: val.toLocaleString(),
      context,
    });
  }

  // Check econ metrics
  if (econNow && econBaseline) {
    for (const m of meta.metricDefs.filter(md => md.showOnDetail)) {
      const curVal = Number(econNow[m.key]);
      const baseVal = Number(econBaseline[m.key]);
      if (isNaN(curVal) || isNaN(baseVal) || baseVal === 0) continue;
      const displayVal = m.unit === '$' ? `$${curVal}` : `${curVal.toLocaleString()}${m.unit}`;
      top3.push({
        label: m.label,
        value: displayVal,
        context: `개전 대비 ${pctChange(curVal, baseVal)}`,
      });
    }
  }

  // Sort by absolute change magnitude and take top 3
  top3.sort((a, b) => {
    const aPct = parseFloat(a.context.replace(/[^-\d.]/g, '')) || 0;
    const bPct = parseFloat(b.context.replace(/[^-\d.]/g, '')) || 0;
    return Math.abs(bPct) - Math.abs(aPct);
  });
  top3.splice(3);

  // Phase progress
  const currentPhase = meta.phases.find(p => p.id === event.phase);
  const phaseIdx = meta.phases.findIndex(p => p.id === event.phase);
  const phaseProgress = meta.phases.length > 1
    ? (phaseIdx + (currentIndex / Math.max(events.length - 1, 1))) / meta.phases.length
    : currentIndex / Math.max(events.length - 1, 1);

  return {
    headline,
    impactScore,
    top3,
    phaseProgress: Math.min(1, phaseProgress),
    phaseColor: currentPhase?.color || '#918a82',
    phaseTitle: currentPhase?.title || '',
  };
}
