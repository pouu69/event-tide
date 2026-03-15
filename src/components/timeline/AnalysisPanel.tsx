import { useState, useRef, useEffect, useCallback } from 'react';
import type { TopicMeta, TopicEvent, EconDataPoint } from '../../types';
import {
  buildMetricPairs,
  buildMetricClusters,
  computeEventImpact,
  buildCausalTimeline,
  computeTagReactions,
  computeKeywordImpacts,
  computeScatterData,
} from '../../lib/correlation';
import type { MetricPair, EventImpactItem } from '../../lib/correlation';
import s from './AnalysisPanel.module.css';

interface Props {
  meta: TopicMeta;
  econ: EconDataPoint[];
  events: TopicEvent[];
  currentEvent: TopicEvent;
  currentIndex: number;
}

type Tab = 'pairs' | 'clusters' | 'impact' | 'causal' | 'newsImpact';

const TABS: { key: Tab; label: string }[] = [
  { key: 'pairs', label: '지표 연동' },
  { key: 'clusters', label: '그룹 분석' },
  { key: 'impact', label: '이벤트 임팩트' },
  { key: 'causal', label: '인과 타임라인' },
  { key: 'newsImpact', label: '뉴스 임팩트' },
];

export default function AnalysisPanel({ meta, econ, events, currentEvent, currentIndex }: Props) {
  const [tab, setTab] = useState<Tab>('pairs');

  return (
    <div className={s.card}>
      <div className={s.header}>
        <h3>데이터 분석</h3>
        <div className={s.tabs}>
          {TABS.map(t => (
            <button
              key={t.key}
              className={`${s.tab} ${tab === t.key ? s.tabActive : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'pairs' && <PairsTab meta={meta} econ={econ} />}
      {tab === 'clusters' && <ClustersTab meta={meta} econ={econ} />}
      {tab === 'impact' && <ImpactTab meta={meta} econ={econ} event={currentEvent} />}
      {tab === 'causal' && <CausalTab meta={meta} econ={econ} events={events} currentIndex={currentIndex} />}
      {tab === 'newsImpact' && <NewsImpactTab meta={meta} econ={econ} events={events} />}
    </div>
  );
}

/* ─── Tab 1: Paired Mini Charts ─── */

function PairsTab({ meta, econ }: { meta: TopicMeta; econ: EconDataPoint[] }) {
  const pairs = buildMetricPairs(meta.metricDefs, econ);
  const topPairs = pairs.slice(0, 6);

  if (topPairs.length === 0) return <p className={s.empty}>데이터가 부족합니다</p>;

  return (
    <div className={s.tabContent}>
      <div className={s.pairsGrid}>
        {topPairs.map((pair, i) => (
          <PairCard key={i} pair={pair} />
        ))}
      </div>
    </div>
  );
}

function PairCard({ pair }: { pair: MetricPair }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.parentElement?.getBoundingClientRect().width || 200;
    const H = 80;
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    const pad = { top: 4, right: 4, bottom: 4, left: 4 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;
    const n = pair.aSeries.length;
    if (n < 2) return;

    ctx.clearRect(0, 0, W, H);

    const all = [...pair.aSeries, ...pair.bSeries];
    const yMin = Math.min(...all) - 1;
    const yMax = Math.max(...all) + 1;
    const yRange = yMax - yMin || 1;

    const toX = (i: number) => pad.left + (i / (n - 1)) * chartW;
    const toY = (v: number) => pad.top + chartH - ((v - yMin) / yRange) * chartH;

    // Zero line
    if (yMin < 0 && yMax > 0) {
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(pad.left, toY(0));
      ctx.lineTo(pad.left + chartW, toY(0));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw series A
    drawLine(ctx, pair.aSeries, pair.aColor, toX, toY, n);
    // Draw series B
    drawLine(ctx, pair.bSeries, pair.bColor, toX, toY, n);
  }, [pair]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const h = () => draw();
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, [draw]);

  const rAbs = Math.abs(pair.r);
  const rSign = pair.r > 0 ? '+' : '';

  return (
    <div className={s.pairCard}>
      <div className={s.pairHeader}>
        <div className={s.pairLabels}>
          <span className={s.pairDot} style={{ background: pair.aColor }} />
          <span className={s.pairName}>{pair.aLabel}</span>
          <span className={s.pairX}>×</span>
          <span className={s.pairDot} style={{ background: pair.bColor }} />
          <span className={s.pairName}>{pair.bLabel}</span>
        </div>
        <span className={`${s.pairR} ${rAbs > 0.7 ? s.pairRStrong : rAbs > 0.4 ? s.pairRMid : s.pairRWeak}`}>
          r={rSign}{pair.r.toFixed(2)}
        </span>
      </div>
      <div className={s.pairChartWrap}>
        <canvas ref={canvasRef} />
      </div>
      <span className={s.pairDesc}>{pair.description}</span>
    </div>
  );
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  values: number[],
  color: string,
  toX: (i: number) => number,
  toY: (v: number) => number,
  n: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  values.forEach((v, i) => {
    i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v));
  });
  ctx.stroke();

  // End dot
  const lastIdx = n - 1;
  ctx.beginPath();
  ctx.arc(toX(lastIdx), toY(values[lastIdx]), 3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/* ─── Tab 2: Cluster View ─── */

function ClustersTab({ meta, econ }: { meta: TopicMeta; econ: EconDataPoint[] }) {
  const clusters = buildMetricClusters(meta.metricDefs, econ);

  if (clusters.length === 0) return <p className={s.empty}>데이터가 부족합니다</p>;

  return (
    <div className={s.tabContent}>
      <div className={s.clustersWrap}>
        {clusters.map((cluster, ci) => (
          <div key={ci} className={s.cluster} style={{ borderLeftColor: cluster.color }}>
            <div className={s.clusterHeader}>
              <span className={s.clusterName}>{cluster.name}</span>
              <span className={s.clusterDir}>
                {cluster.direction === 'up' ? '▲' : cluster.direction === 'down' ? '▼' : '◆'}
              </span>
            </div>
            <div className={s.clusterMetrics}>
              {cluster.metrics.map(m => (
                <div key={m.key} className={s.clusterMetric}>
                  <span className={s.cmDot} style={{ background: m.color }} />
                  <span className={s.cmLabel}>{m.label}</span>
                  <span className={`${s.cmPct} ${m.pctChange >= 0 ? s.cmUp : s.cmDown}`}>
                    {m.pctChange > 0 ? '+' : ''}{m.pctChange.toFixed(1)}%
                  </span>
                  <div className={s.cmBarWrap}>
                    <div
                      className={s.cmBar}
                      style={{
                        width: `${Math.min(100, Math.abs(m.pctChange) * 2)}%`,
                        background: m.pctChange >= 0 ? 'var(--green, #27ae60)' : 'var(--accent, #c0392b)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Cross-cluster insight */}
      {clusters.length >= 2 && (
        <div className={s.clusterInsight}>
          <strong>패턴:</strong>{' '}
          {clusters[0].metrics.map(m => m.label).join(', ')}은(는) 동조하며,{' '}
          {clusters.length > 1 && clusters[1].metrics.length > 0
            ? `${clusters[1].metrics.map(m => m.label).join(', ')}과(와) 구분됩니다.`
            : '독립적으로 움직입니다.'}
        </div>
      )}
    </div>
  );
}

/* ─── Tab 3: Event Impact ─── */

function ImpactTab({ meta, econ, event }: { meta: TopicMeta; econ: EconDataPoint[]; event: TopicEvent }) {
  const impacts: EventImpactItem[] = computeEventImpact(event, meta.metricDefs, econ);

  if (impacts.length === 0) {
    return <p className={s.empty}>이벤트 전후 데이터가 부족합니다</p>;
  }

  const maxAbsPct = Math.max(...impacts.map(i => Math.abs(i.pctChange)), 0.1);

  return (
    <div className={s.tabContent}>
      <p className={s.impactSub}>
        이벤트 전후 지표 변동 — <strong>{event.title}</strong>
      </p>
      <div className={s.impactGrid}>
        <div className={`${s.impactRow} ${s.impactHeader}`}>
          <span>지표</span>
          <span>이전</span>
          <span>이후</span>
          <span>변동</span>
          <span></span>
        </div>
        {impacts.map(item => {
          const isPos = item.pctChange >= 0;
          const barWidth = Math.min(100, (Math.abs(item.pctChange) / maxAbsPct) * 100);
          const formatVal = (v: number) =>
            item.unit === '$' ? `$${v.toLocaleString()}` :
            item.unit === '₩' ? `₩${v.toLocaleString()}` :
            item.unit === '%' ? `${v.toFixed(2)}%` :
            v.toLocaleString();

          return (
            <div key={item.key} className={`${s.impactRow} ${isPos ? s.impactPos : s.impactNeg}`}>
              <span className={s.impactLabel}>
                <span className={s.impactDot} style={{ background: item.color }} />
                {item.label}
              </span>
              <span className={s.impactVal}>{formatVal(item.before)}</span>
              <span className={s.impactVal}>{formatVal(item.after)}</span>
              <span className={s.impactPct}>
                {isPos ? '+' : ''}{item.pctChange.toFixed(1)}%
              </span>
              <div className={s.impactBarWrap}>
                <div
                  className={s.impactBar}
                  style={{
                    width: `${barWidth}%`,
                    background: isPos ? 'var(--green, #27ae60)' : 'var(--accent, #c0392b)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {impacts.length > 0 && (
        <div className={s.impactSummary}>
          <strong>핵심:</strong> {impacts[0].label}이(가){' '}
          {Math.abs(impacts[0].pctChange).toFixed(1)}%{' '}
          {impacts[0].pctChange > 0 ? '상승' : '하락'}으로 가장 큰 변동.
          {impacts.length > 1 && ` ${impacts[1].label}도 ${Math.abs(impacts[1].pctChange).toFixed(1)}% ${impacts[1].pctChange > 0 ? '상승' : '하락'}.`}
        </div>
      )}
    </div>
  );
}

/* ─── Tab 4: Causal Timeline ─── */

function CausalTab({
  meta, econ, events, currentIndex,
}: {
  meta: TopicMeta; econ: EconDataPoint[]; events: TopicEvent[]; currentIndex: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const statsKeys = meta.statsFields.map(sf => sf.key).filter(k => !['oil', 'kospi', 'sp500', 'cost'].includes(k));
  const timeline = buildCausalTimeline(events, econ, meta.metricDefs, statsKeys, currentIndex);
  const econDefs = meta.metricDefs.filter(m => m.showOnDetail).slice(0, 3);

  const drawTimeline = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || timeline.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const wrapW = wrap.getBoundingClientRect().width;
    const W = wrapW;
    const H = 260;
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    const pad = { top: 24, right: 16, bottom: 40, left: 40 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;
    const n = timeline.length;

    ctx.clearRect(0, 0, W, H);

    const toX = (i: number) => pad.left + (i / Math.max(n - 1, 1)) * chartW;

    // Draw stat bars
    const mainStatKey = statsKeys[0];
    if (mainStatKey) {
      const statValues = timeline.map(p => p.stats[mainStatKey] ?? 0);
      const maxStat = Math.max(...statValues, 1);
      const barW = Math.max(4, Math.min(20, chartW / n - 4));

      statValues.forEach((v, i) => {
        if (v === 0) return;
        const barH = (v / maxStat) * chartH * 0.6;
        const x = toX(i) - barW / 2;
        const y = pad.top + chartH - barH;

        ctx.fillStyle = 'rgba(192,57,43,0.15)';
        ctx.fillRect(x, y, barW, barH);
        ctx.strokeStyle = 'rgba(192,57,43,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barW, barH);
      });

      ctx.save();
      ctx.fillStyle = '#918a82';
      ctx.font = '500 8px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.translate(W - 6, pad.top + chartH / 2);
      ctx.rotate(-Math.PI / 2);
      const statLabel = meta.statsFields.find(sf => sf.key === mainStatKey)?.label || mainStatKey;
      ctx.fillText(statLabel, 0, 0);
      ctx.restore();
    }

    // Draw econ lines (normalized)
    econDefs.forEach((m) => {
      const values = timeline.map(p => p.econ[m.key]);
      const base = values[0];
      if (base == null || base === 0) return;

      const pctValues = values.map(v => v != null ? ((v - base) / base) * 100 : null);
      const valid = pctValues.filter((v): v is number => v !== null);
      if (valid.length < 2) return;

      const yMin = Math.min(...valid) - 2;
      const yMax = Math.max(...valid) + 2;
      const yRange = yMax - yMin || 1;
      const toY = (v: number) => pad.top + chartH - ((v - yMin) / yRange) * chartH;

      ctx.strokeStyle = m.chartColor;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.setLineDash(m.chartDash || []);
      ctx.beginPath();

      let started = false;
      pctValues.forEach((v, i) => {
        if (v === null) return;
        const x = toX(i);
        const y = toY(v);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      pctValues.forEach((v, i) => {
        if (v === null) return;
        ctx.beginPath();
        ctx.arc(toX(i), toY(v), 3, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = m.chartColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    });

    // Event dots at bottom
    const tagColors: Record<string, string> = {
      military: '#c0392b', crisis: '#e67e22', diplomacy: '#2c6fbb',
      civilian: '#8e44ad', political: '#555', nuclear: '#c0392b',
    };

    timeline.forEach((p, i) => {
      const x = toX(i);
      const color = tagColors[p.eventTag || ''] || '#918a82';

      ctx.beginPath();
      ctx.arc(x, pad.top + chartH + 12, 4, 0, Math.PI * 2);
      ctx.fillStyle = i === currentIndex ? color : color + '60';
      ctx.fill();
      if (i === currentIndex) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (n <= 8 || i % 2 === 0 || i === n - 1) {
        ctx.fillStyle = '#918a82';
        ctx.font = '500 7px DM Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.date.slice(5), x, pad.top + chartH + 28);
      }
    });

    // Left axis label
    ctx.fillStyle = '#918a82';
    ctx.font = '500 8px DM Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(10, pad.top + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('% 변동', 0, 0);
    ctx.restore();
  }, [timeline, econDefs, statsKeys, meta.statsFields, currentIndex]);

  useEffect(() => { drawTimeline(); }, [drawTimeline]);
  useEffect(() => {
    const h = () => drawTimeline();
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, [drawTimeline]);

  if (timeline.length < 2) return <p className={s.empty}>타임라인 데이터가 부족합니다</p>;

  // Escalation notes
  const escalationNotes: string[] = [];
  if (statsKeys[0] && timeline.length >= 3) {
    const statKey = statsKeys[0];
    const statLabel = meta.statsFields.find(sf => sf.key === statKey)?.label || statKey;
    const first = timeline[0].stats[statKey] ?? 0;
    const last = timeline[timeline.length - 1].stats[statKey] ?? 0;
    if (last > first && first > 0) {
      escalationNotes.push(`${statLabel}: ${first.toLocaleString()} → ${last.toLocaleString()} (${((last - first) / first * 100).toFixed(0)}% 증가)`);
    }
  }
  for (const m of econDefs.slice(0, 2)) {
    const firstVal = timeline[0].econ[m.key];
    const lastVal = timeline[timeline.length - 1].econ[m.key];
    if (firstVal && lastVal && firstVal !== 0) {
      const pct = ((lastVal - firstVal) / firstVal * 100).toFixed(1);
      escalationNotes.push(`${m.label}: ${Number(pct) > 0 ? '+' : ''}${pct}%`);
    }
  }

  return (
    <div className={s.tabContent}>
      <div className={s.causalWrap} ref={wrapRef}>
        <canvas ref={canvasRef} />
      </div>

      <div className={s.causalLegend}>
        {statsKeys[0] && (
          <div className={s.causalLegendItem}>
            <div className={s.causalLegendBar} />
            <span>{meta.statsFields.find(sf => sf.key === statsKeys[0])?.label || statsKeys[0]}</span>
          </div>
        )}
        {econDefs.map(m => (
          <div key={m.key} className={s.causalLegendItem}>
            <div className={s.causalLegendLine} style={{ background: m.chartColor }} />
            <span>{m.label}</span>
          </div>
        ))}
      </div>

      {escalationNotes.length > 0 && (
        <div className={s.escalation}>
          <span className={s.escalationTitle}>에스컬레이션 추이</span>
          {escalationNotes.map((note, i) => (
            <span key={i} className={s.escalationNote}>{note}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Tab 5: News Impact ─── */

function NewsImpactTab({
  meta, econ, events,
}: {
  meta: TopicMeta; econ: EconDataPoint[]; events: TopicEvent[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [section, setSection] = useState<'tag' | 'keyword' | 'scatter'>('tag');

  const tagReactions = computeTagReactions(events, econ, meta.metricDefs);
  const keywordImpacts = computeKeywordImpacts(events, econ, meta.metricDefs);
  const scatterData = computeScatterData(events, econ, meta.metricDefs, meta.statsFields);

  // Draw scatter plot
  const drawScatter = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || scatterData.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = wrap.getBoundingClientRect().width;
    const H = 220;
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    const pad = { top: 16, right: 16, bottom: 32, left: 48 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);

    const maxEsc = Math.max(...scatterData.map(p => p.escalationScore), 1);
    const maxMkt = Math.max(...scatterData.map(p => p.marketReaction), 1);

    const toX = (v: number) => pad.left + (v / maxEsc) * chartW;
    const toY = (v: number) => pad.top + chartH - (v / maxMkt) * chartH;

    // Grid
    ctx.strokeStyle = '#e8e4de';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + chartW, y);
      ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = '#918a82';
    ctx.font = '500 8px DM Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('에스컬레이션 강도 →', pad.left + chartW / 2, H - 4);
    ctx.save();
    ctx.translate(10, pad.top + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('시장 변동폭 % →', 0, 0);
    ctx.restore();

    const tagColors: Record<string, string> = {
      military: '#c0392b', crisis: '#e67e22', diplomacy: '#2c6fbb',
      civilian: '#8e44ad', political: '#555', nuclear: '#c0392b',
      protest: '#e67e22', current: '#918a82',
    };

    // Points
    scatterData.forEach(p => {
      const x = toX(p.escalationScore);
      const y = toY(p.marketReaction);
      const color = tagColors[p.tag] || '#918a82';
      const r = 5 + Math.min(5, p.marketReaction / 2);

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color + '40';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Trend line (simple linear regression)
    if (scatterData.length >= 3) {
      const n = scatterData.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      scatterData.forEach(p => {
        sumX += p.escalationScore;
        sumY += p.marketReaction;
        sumXY += p.escalationScore * p.marketReaction;
        sumX2 += p.escalationScore * p.escalationScore;
      });
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
      const intercept = (sumY - slope * sumX) / n;

      ctx.save();
      ctx.strokeStyle = 'rgba(192,57,43,0.3)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(intercept));
      ctx.lineTo(toX(maxEsc), toY(slope * maxEsc + intercept));
      ctx.stroke();
      ctx.restore();
    }
  }, [scatterData]);

  useEffect(() => {
    if (section === 'scatter') drawScatter();
  }, [section, drawScatter]);

  useEffect(() => {
    if (section !== 'scatter') return;
    const h = () => drawScatter();
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, [section, drawScatter]);

  return (
    <div className={s.tabContent}>
      {/* Sub-section switcher */}
      <div className={s.subSections}>
        <button className={`${s.subBtn} ${section === 'tag' ? s.subBtnActive : ''}`} onClick={() => setSection('tag')}>
          A. 태그별 반응
        </button>
        <button className={`${s.subBtn} ${section === 'keyword' ? s.subBtnActive : ''}`} onClick={() => setSection('keyword')}>
          B. 키워드 임팩트
        </button>
        <button className={`${s.subBtn} ${section === 'scatter' ? s.subBtnActive : ''}`} onClick={() => setSection('scatter')}>
          C. 에스컬레이션 × 시장
        </button>
      </div>

      {/* A: Tag reactions */}
      {section === 'tag' && (
        <div className={s.tagSection}>
          {tagReactions.map(tr => (
            <div key={tr.tag} className={s.tagCard}>
              <div className={s.tagCardHeader}>
                <span className={s.tagName}>{tr.tagLabel}</span>
                <span className={s.tagCount}>{tr.count}건</span>
              </div>
              <div className={s.tagMetrics}>
                {tr.avgReactions.slice(0, 4).map(r => (
                  <div key={r.key} className={s.tagMetric}>
                    <span className={s.tagMetricDot} style={{ background: r.color }} />
                    <span className={s.tagMetricLabel}>{r.label}</span>
                    <span className={`${s.tagMetricPct} ${r.avgPct >= 0 ? s.cmUp : s.cmDown}`}>
                      {r.avgPct > 0 ? '+' : ''}{r.avgPct.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {tagReactions.length > 0 && (
            <div className={s.newsInsight}>
              <strong>해석:</strong>{' '}
              {tagReactions[0].tagLabel} 이벤트({tagReactions[0].count}건) 발생 시{' '}
              {tagReactions[0].avgReactions[0]?.label}이(가) 평균{' '}
              {Math.abs(tagReactions[0].avgReactions[0]?.avgPct || 0).toFixed(1)}%{' '}
              {(tagReactions[0].avgReactions[0]?.avgPct || 0) > 0 ? '상승' : '하락'}하는 패턴.
            </div>
          )}
        </div>
      )}

      {/* B: Keyword impacts */}
      {section === 'keyword' && (
        <div className={s.kwSection}>
          {keywordImpacts.map(ki => (
            <div key={ki.keyword} className={s.kwCard}>
              <div className={s.kwHeader}>
                <span className={s.kwWord}>{ki.keyword}</span>
                <span className={s.kwCount}>{ki.matchCount}건 언급</span>
              </div>
              <div className={s.kwBars}>
                {ki.avgReactions.slice(0, 3).map(r => {
                  const maxPct = Math.max(...ki.avgReactions.map(x => Math.abs(x.avgPct)), 0.1);
                  const w = Math.min(100, (Math.abs(r.avgPct) / maxPct) * 100);
                  return (
                    <div key={r.key} className={s.kwBar}>
                      <span className={s.kwBarLabel}>{r.label}</span>
                      <div className={s.kwBarTrack}>
                        <div
                          className={s.kwBarFill}
                          style={{
                            width: `${w}%`,
                            background: r.avgPct >= 0 ? 'var(--green, #27ae60)' : 'var(--accent, #c0392b)',
                          }}
                        />
                      </div>
                      <span className={`${s.kwBarPct} ${r.avgPct >= 0 ? s.cmUp : s.cmDown}`}>
                        {r.avgPct > 0 ? '+' : ''}{r.avgPct.toFixed(2)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* C: Scatter plot */}
      {section === 'scatter' && (
        <div className={s.scatterSection}>
          <div className={s.causalWrap} ref={wrapRef}>
            <canvas ref={canvasRef} />
          </div>
          <div className={s.scatterLegend}>
            {['military', 'crisis', 'diplomacy', 'civilian', 'political'].map(tag => {
              const colors: Record<string, string> = {
                military: '#c0392b', crisis: '#e67e22', diplomacy: '#2c6fbb',
                civilian: '#8e44ad', political: '#555',
              };
              const labels: Record<string, string> = {
                military: '군사', crisis: '위기', diplomacy: '외교',
                civilian: '민간인', political: '정치',
              };
              return (
                <div key={tag} className={s.causalLegendItem}>
                  <span className={s.scatterDot} style={{ background: colors[tag] }} />
                  <span>{labels[tag]}</span>
                </div>
              );
            })}
            <div className={s.causalLegendItem}>
              <span className={s.trendLine} />
              <span>추세선</span>
            </div>
          </div>
          {scatterData.length >= 3 && (
            <div className={s.newsInsight}>
              <strong>패턴:</strong> 에스컬레이션 강도가 높을수록 시장 변동폭이 커지는 경향.
              군사 이벤트(빨강)가 가장 큰 시장 충격을 유발.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
