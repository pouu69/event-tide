import type { EconDataPoint, MetricDef, TopicEvent } from '../types';
import { getNearestEconData } from './utils';

/** Pearson correlation coefficient between two number arrays */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

/** Paired correlation with normalized series for mini chart */
export interface MetricPair {
  aKey: string; aLabel: string; aColor: string;
  bKey: string; bLabel: string; bColor: string;
  r: number;
  // Normalized % change series for dual-line chart
  aSeries: number[];
  bSeries: number[];
  dates: string[];
  description: string;
}

export function buildMetricPairs(
  metricDefs: MetricDef[],
  econ: EconDataPoint[],
): MetricPair[] {
  const defs = metricDefs.filter(m => m.showOnDetail);
  if (defs.length < 2 || econ.length < 3) return [];

  const pairs: MetricPair[] = [];

  for (let i = 0; i < defs.length; i++) {
    for (let j = i + 1; j < defs.length; j++) {
      const a = defs[i], b = defs[j];
      const aRaw = econ.map(d => Number(d[a.key]));
      const bRaw = econ.map(d => Number(d[b.key]));

      if (aRaw.some(isNaN) || bRaw.some(isNaN)) continue;
      if (aRaw[0] === 0 || bRaw[0] === 0) continue;

      const r = pearsonCorrelation(aRaw, bRaw);
      const aSeries = aRaw.map(v => ((v - aRaw[0]) / aRaw[0]) * 100);
      const bSeries = bRaw.map(v => ((v - bRaw[0]) / bRaw[0]) * 100);

      let description: string;
      if (r > 0.7) description = '강한 동조 — 함께 상승/하락';
      else if (r > 0.4) description = '양의 상관 — 비슷한 방향';
      else if (r < -0.7) description = '강한 역상관 — 반대로 움직임';
      else if (r < -0.4) description = '음의 상관 — 대체로 반대';
      else description = '약한 상관 — 독립적 움직임';

      pairs.push({
        aKey: a.key, aLabel: a.label, aColor: a.chartColor,
        bKey: b.key, bLabel: b.label, bColor: b.chartColor,
        r, aSeries, bSeries,
        dates: econ.map(d => d.date as string),
        description,
      });
    }
  }

  // Sort by absolute correlation
  pairs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  return pairs;
}

/** Cluster: group metrics by correlation behavior */
export interface MetricCluster {
  name: string;
  color: string;
  metrics: { key: string; label: string; color: string; pctChange: number }[];
  direction: 'up' | 'down' | 'mixed';
}

export function buildMetricClusters(
  metricDefs: MetricDef[],
  econ: EconDataPoint[],
): MetricCluster[] {
  const defs = metricDefs.filter(m => m.showOnDetail);
  if (defs.length < 2 || econ.length < 2) return [];

  const baseline = econ[0];
  const latest = econ[econ.length - 1];

  // Compute pct change for each metric
  const withChange = defs.map(m => {
    const baseVal = Number(baseline[m.key]);
    const curVal = Number(latest[m.key]);
    const pctChange = baseVal !== 0 ? ((curVal - baseVal) / baseVal) * 100 : 0;
    return { key: m.key, label: m.label, color: m.chartColor, pctChange };
  });

  // Build correlation groups using simple threshold clustering
  const n = defs.length;
  const series = defs.map(m => econ.map(d => Number(d[m.key])));
  const assigned = new Set<number>();
  const groups: number[][] = [];

  for (let i = 0; i < n; i++) {
    if (assigned.has(i)) continue;
    const group = [i];
    assigned.add(i);

    for (let j = i + 1; j < n; j++) {
      if (assigned.has(j)) continue;
      const r = pearsonCorrelation(series[i], series[j]);
      if (r > 0.5) {
        group.push(j);
        assigned.add(j);
      }
    }
    groups.push(group);
  }

  // Find the largest group and build an inverse group from remaining metrics
  const largestGroup = groups.reduce((a, b) => a.length >= b.length ? a : b, []);
  const largestSet = new Set(largestGroup);

  // Separate remaining indices into inverse vs independent
  const inverseIndices: number[] = [];
  const independentIndices: number[] = [];
  for (let j = 0; j < n; j++) {
    if (largestSet.has(j)) continue;
    const avgR = largestGroup.reduce((sum, i) => sum + pearsonCorrelation(series[i], series[j]), 0) / largestGroup.length;
    if (avgR < -0.3) {
      inverseIndices.push(j);
    } else {
      independentIndices.push(j);
    }
  }

  const clusterColors = ['#c0392b', '#2c6fbb', '#27ae60', '#e67e22', '#8e44ad'];
  const clusters: MetricCluster[] = [];

  // Main cluster
  const mainMetrics = largestGroup.map(i => withChange[i]);
  const mainDir: 'up' | 'down' | 'mixed' =
    mainMetrics.every(m => m.pctChange > 0) ? 'up' :
    mainMetrics.every(m => m.pctChange < 0) ? 'down' : 'mixed';
  const mainLabel = mainDir === 'up' ? '상승' : mainDir === 'down' ? '하락' : '혼조';
  clusters.push({
    name: `주요 동조 그룹 — ${mainLabel}`,
    color: clusterColors[0],
    metrics: mainMetrics.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange)),
    direction: mainDir,
  });

  // Inverse cluster
  if (inverseIndices.length > 0) {
    const metrics = inverseIndices.map(i => withChange[i]);
    const dir: 'up' | 'down' | 'mixed' =
      metrics.every(m => m.pctChange > 0) ? 'up' :
      metrics.every(m => m.pctChange < 0) ? 'down' : 'mixed';
    clusters.push({
      name: '역방향 그룹',
      color: clusterColors[1],
      metrics: metrics.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange)),
      direction: dir,
    });
  }

  // Independent metrics (not correlated with main group)
  if (independentIndices.length > 0) {
    const metrics = independentIndices.map(i => withChange[i]);
    clusters.push({
      name: '독립 지표',
      color: clusterColors[2],
      metrics: metrics.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange)),
      direction: 'mixed',
    });
  }

  return clusters.filter(c => c.metrics.length > 0);
}

/** Event impact: metric values before and after an event */
export interface EventImpactItem {
  label: string;
  key: string;
  color: string;
  before: number;
  after: number;
  pctChange: number;
  unit: string;
}

export function computeEventImpact(
  event: TopicEvent,
  metricDefs: MetricDef[],
  econ: EconDataPoint[],
): EventImpactItem[] {
  const defs = metricDefs.filter(m => m.showOnDetail);

  // Find econ point at/before the event
  const econAt = getNearestEconData(event.date, econ);
  // Find econ point AFTER the event
  const econAfter = econ.find(d => (d.date as string) > event.date);

  // If no "after" data, compare previous point → current point
  let before: EconDataPoint | null;
  let after: EconDataPoint | null;

  if (econAfter) {
    before = econAt;
    after = econAfter;
  } else if (econAt) {
    // Last event: use prior econ point as "before"
    const idx = econ.findIndex(d => d.date === econAt.date);
    before = idx > 0 ? econ[idx - 1] : null;
    after = econAt;
  } else {
    before = null;
    after = null;
  }

  if (!before || !after) return [];

  return defs.map(m => {
    const bVal = Number(before![m.key]);
    const aVal = Number(after![m.key]);
    const pctChange = bVal !== 0 ? ((aVal - bVal) / bVal) * 100 : 0;
    return {
      label: m.label,
      key: m.key,
      color: m.chartColor,
      before: bVal,
      after: aVal,
      pctChange,
      unit: m.unit,
    };
  }).filter(item => !isNaN(item.before) && !isNaN(item.after))
    .sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange));
}

/** Causal timeline: merge military stats + econ metrics over time */
export interface CausalPoint {
  date: string;
  eventTitle?: string;
  eventTag?: string;
  stats: Record<string, number>;
  econ: Record<string, number>;
}

export function buildCausalTimeline(
  events: TopicEvent[],
  econ: EconDataPoint[],
  metricDefs: MetricDef[],
  statsKeys: string[],
  upToIndex: number,
): CausalPoint[] {
  const points: CausalPoint[] = [];
  const econDefs = metricDefs.filter(m => m.showOnDetail);

  for (let i = 0; i <= Math.min(upToIndex, events.length - 1); i++) {
    const ev = events[i];
    const ep = getNearestEconData(ev.date, econ);

    const stats: Record<string, number> = {};
    for (const k of statsKeys) {
      if (ev.metrics[k] != null) stats[k] = ev.metrics[k];
    }

    const econValues: Record<string, number> = {};
    if (ep) {
      for (const m of econDefs) {
        const v = Number(ep[m.key]);
        if (!isNaN(v)) econValues[m.key] = v;
      }
    }

    points.push({
      date: ev.date,
      eventTitle: ev.title,
      eventTag: ev.tag,
      stats,
      econ: econValues,
    });
  }

  return points;
}

/* ─── News Impact Analysis ─── */

/** A) Tag-based average market reaction */
export interface TagReaction {
  tag: string;
  tagLabel: string;
  count: number;
  avgReactions: { key: string; label: string; color: string; avgPct: number }[];
}

export function computeTagReactions(
  events: TopicEvent[],
  econ: EconDataPoint[],
  metricDefs: MetricDef[],
): TagReaction[] {
  const defs = metricDefs.filter(m => m.showOnDetail);
  const tagMap: Record<string, { pcts: Record<string, number[]>; count: number }> = {};

  const tagLabels: Record<string, string> = {
    military: '군사', diplomacy: '외교', political: '정치', civilian: '민간인',
    protest: '시위', nuclear: '핵', crisis: '위기', analysis: '분석', current: '현재',
  };

  for (const ev of events) {
    const econAt = getNearestEconData(ev.date, econ);
    const econAfter = econ.find(d => (d.date as string) > ev.date);
    if (!econAt || !econAfter) continue;

    if (!tagMap[ev.tag]) tagMap[ev.tag] = { pcts: {}, count: 0 };
    tagMap[ev.tag].count++;

    for (const m of defs) {
      const before = Number(econAt[m.key]);
      const after = Number(econAfter[m.key]);
      if (isNaN(before) || isNaN(after) || before === 0) continue;
      const pct = ((after - before) / before) * 100;
      if (!tagMap[ev.tag].pcts[m.key]) tagMap[ev.tag].pcts[m.key] = [];
      tagMap[ev.tag].pcts[m.key].push(pct);
    }
  }

  return Object.entries(tagMap)
    .filter(([, v]) => v.count >= 2)
    .map(([tag, data]) => ({
      tag,
      tagLabel: tagLabels[tag] || tag,
      count: data.count,
      avgReactions: defs.map(m => {
        const arr = data.pcts[m.key] || [];
        const avg = arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
        return { key: m.key, label: m.label, color: m.chartColor, avgPct: avg };
      }).sort((a, b) => Math.abs(b.avgPct) - Math.abs(a.avgPct)),
    }))
    .sort((a, b) => b.count - a.count);
}

/** B) Keyword impact analysis */
export interface KeywordImpact {
  keyword: string;
  matchCount: number;
  avgReactions: { key: string; label: string; color: string; avgPct: number }[];
}

const KEYWORDS = [
  { word: '공습', pattern: /공습|폭격|타격|strikes/i },
  { word: '봉쇄', pattern: /봉쇄|해협|호르무즈/i },
  { word: '미사일', pattern: /미사일|드론|로켓/i },
  { word: '휴전·협상', pattern: /휴전|협상|합의|외교/i },
  { word: '민간인 피해', pattern: /민간인|학교|사망|사상자/i },
  { word: '제재·경제', pattern: /제재|경제|유가|시장/i },
  { word: '시위·반전', pattern: /시위|반전|반정부|protest/i },
  { word: '핵', pattern: /핵|nuclear|IAEA/i },
];

export function computeKeywordImpacts(
  events: TopicEvent[],
  econ: EconDataPoint[],
  metricDefs: MetricDef[],
): KeywordImpact[] {
  const defs = metricDefs.filter(m => m.showOnDetail);

  return KEYWORDS.map(({ word, pattern }) => {
    const pcts: Record<string, number[]> = {};
    let matchCount = 0;

    for (const ev of events) {
      const text = `${ev.title} ${ev.desc} ${ev.details.join(' ')}`;
      if (!pattern.test(text)) continue;

      const econAt = getNearestEconData(ev.date, econ);
      const econAfter = econ.find(d => (d.date as string) > ev.date);
      if (!econAt || !econAfter) continue;

      matchCount++;
      for (const m of defs) {
        const before = Number(econAt[m.key]);
        const after = Number(econAfter[m.key]);
        if (isNaN(before) || isNaN(after) || before === 0) continue;
        const pct = ((after - before) / before) * 100;
        if (!pcts[m.key]) pcts[m.key] = [];
        pcts[m.key].push(pct);
      }
    }

    return {
      keyword: word,
      matchCount,
      avgReactions: defs.map(m => {
        const arr = pcts[m.key] || [];
        const avg = arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
        return { key: m.key, label: m.label, color: m.chartColor, avgPct: avg };
      }).sort((a, b) => Math.abs(b.avgPct) - Math.abs(a.avgPct)),
    };
  }).filter(k => k.matchCount >= 1)
    .sort((a, b) => b.matchCount - a.matchCount);
}

/** C) Escalation score vs market scatter data */
export interface ScatterPoint {
  eventTitle: string;
  date: string;
  escalationScore: number; // 0-100 normalized
  marketReaction: number;  // avg % change across top metrics
  tag: string;
}

export function computeScatterData(
  events: TopicEvent[],
  econ: EconDataPoint[],
  metricDefs: MetricDef[],
  _statsFields: { key: string; label: string }[],
): ScatterPoint[] {
  const defs = metricDefs.filter(m => m.showOnDetail).slice(0, 3);
  const points: ScatterPoint[] = [];

  // Find max values for normalization
  const allCasualties = events.map(e => e.metrics.casualties ?? 0);
  const allStrikes = events.map(e => e.metrics.strikes ?? 0);
  const maxCas = Math.max(...allCasualties, 1);
  const maxStr = Math.max(...allStrikes, 1);

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const econAt = getNearestEconData(ev.date, econ);
    const econAfter = econ.find(d => (d.date as string) > ev.date);

    // Escalation score: weighted combination of casualties + strikes delta
    const prevEv = i > 0 ? events[i - 1] : null;
    const casDelta = (ev.metrics.casualties ?? 0) - (prevEv?.metrics.casualties ?? 0);
    const strDelta = (ev.metrics.strikes ?? 0) - (prevEv?.metrics.strikes ?? 0);
    const escalationScore = Math.min(100,
      (Math.max(0, casDelta) / maxCas * 50) +
      (Math.max(0, strDelta) / maxStr * 50)
    );

    // Market reaction: average absolute % change
    let marketReaction = 0;
    if (econAt && econAfter) {
      const changes = defs.map(m => {
        const before = Number(econAt[m.key]);
        const after = Number(econAfter[m.key]);
        return before !== 0 ? ((after - before) / before) * 100 : 0;
      });
      // Use VIX-weighted average (VIX is the fear gauge)
      marketReaction = changes.reduce((s, v) => s + Math.abs(v), 0) / changes.length;
    }

    if (escalationScore > 0 || marketReaction > 0) {
      points.push({
        eventTitle: ev.title.length > 25 ? ev.title.slice(0, 25) + '..' : ev.title,
        date: ev.date,
        escalationScore,
        marketReaction,
        tag: ev.tag,
      });
    }
  }

  return points;
}
