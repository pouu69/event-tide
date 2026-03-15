import { useRef, useEffect, useCallback } from 'react';
import type { TopicMeta, TopicEvent, EconDataPoint } from '../../types';
import { pctChange, getNearestEconData } from '../../lib/utils';
import { drawChart } from '../../lib/drawChart';
import type { ChartDataset } from '../../lib/drawChart';
import s from './EconPanel.module.css';

interface Props {
  meta: TopicMeta;
  econ: EconDataPoint[];
  currentDate: string;
  events?: TopicEvent[];
}

const DAY_MS = 86400000;

function warDay(dateStr: string, startDate: string): number | null {
  const d = new Date(dateStr).getTime();
  const ws = new Date(startDate).getTime();
  return d >= ws ? Math.floor((d - ws) / DAY_MS) + 1 : null;
}

function getEconDataUpTo(dateStr: string, econ: EconDataPoint[]): EconDataPoint[] {
  const filtered = econ.filter(d => (d.date as string) <= dateStr);
  return filtered.length >= 2 ? filtered : econ.slice(0, 2);
}

export default function EconPanel({ meta, econ, currentDate, events }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  // Build datasets from metricDefs that are showOnDetail
  const datasets: ChartDataset[] = meta.metricDefs
    .filter(m => m.showOnDetail)
    .map(m => ({
      key: m.key,
      label: m.label,
      color: m.chartColor,
      dash: m.chartDash,
      lineWidth: m.chartLineWidth,
    }));

  const chartData = getEconDataUpTo(currentDate, econ);

  // Build event markers from significant events
  const eventMarkers = (events || [])
    .filter(e => e.tag === 'military' || e.tag === 'crisis')
    .slice(0, 5)
    .map(e => ({ date: e.date, label: e.title }));

  // Draw chart
  const renderChart = useCallback((hover?: number) => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (hover === undefined) {
      const rect = wrap.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = 300;
    }

    drawChart(ctx, canvas, datasets, chartData, hover, meta.startDate, eventMarkers);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasets, chartData, meta.startDate, JSON.stringify(eventMarkers)]);

  useEffect(() => {
    renderChart();
  }, [renderChart]);

  // Resize
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => renderChart(), 150);
    };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); clearTimeout(timer); };
  }, [renderChart]);

  // Mouse interaction
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const tooltip = tooltipRef.current;
    if (!canvas || !tooltip || chartData.length < 2) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const pad = { left: 52, right: 16 };
    const chartW = canvas.width - pad.left - pad.right;
    const n = chartData.length;

    const col = Math.round(((mx - pad.left) / chartW) * (n - 1));
    const idx = Math.max(0, Math.min(n - 1, col));
    const colX = pad.left + (idx / (n - 1)) * chartW;

    if (Math.abs(mx - colX) < 30) {
      const data = chartData[idx];
      let html = `<strong>${data.date}</strong><br>`;
      datasets.forEach(ds => {
        const val = Number(data[ds.key]);
        const base = Number(chartData[0][ds.key]);
        const chg = pctChange(val, base);
        const unit = meta.metricDefs.find(m => m.key === ds.key)?.unit || '';
        const actual = unit === '$' ? `$${val.toLocaleString()}` :
                       unit === '\u20A9' ? `\u20A9${val.toLocaleString()}` :
                       val.toLocaleString();
        html += `<span style="color:${ds.color}">${ds.label}: ${actual} (${chg})</span><br>`;
      });
      tooltip.innerHTML = html;
      tooltip.classList.add(s.visible);

      let tx = colX + 12;
      if (tx + 180 > rect.width) tx = colX - 180;
      tooltip.style.left = tx + 'px';
      tooltip.style.top = Math.max(10, my - 20) + 'px';

      renderChart(idx);
    } else {
      tooltip.classList.remove(s.visible);
      renderChart();
    }
  }, [chartData, datasets, meta.metricDefs, renderChart]);

  const handleMouseLeave = useCallback(() => {
    tooltipRef.current?.classList.remove(s.visible);
    renderChart();
  }, [renderChart]);

  // KPI row
  const baseline = econ[0];
  const current = getNearestEconData(currentDate, econ);
  const day = warDay(currentDate, meta.startDate);
  const asofText = day !== null ? `\u2014 DAY ${day} \uAE30\uC900` : '\u2014 \uC804\uC7C1 \uC804';

  return (
    <div className={s.card}>
      <div className={s.header}>
        <div>
          <h3>{'\uACBD\uC81C \uC9C0\uD45C'}</h3>
          <span className={s.asof}>{asofText}</span>
        </div>
      </div>

      <div className={s.chartWrap} ref={wrapRef}>
        <canvas ref={canvasRef} className={s.canvas} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} />
        <div ref={tooltipRef} className={s.tooltip} />
      </div>

      {/* Legend */}
      <div className={s.legend}>
        {datasets.map(ds => {
          const lineStyle = ds.dash
            ? { borderTop: `2px dashed ${ds.color}`, background: 'none', width: '16px', height: '0', borderRadius: '0' }
            : { background: ds.color, width: '16px', height: '3px', borderRadius: '2px' };
          return (
            <div key={ds.key} className={s.legendItem}>
              <div className={s.legendLine} style={lineStyle} />
              <span>{ds.label}</span>
            </div>
          );
        })}
      </div>

      {/* KPI row */}
      {baseline && current && (
        <div className={s.kpiRow}>
          {datasets.map(ds => {
            const baseVal = Number(baseline[ds.key]);
            const curVal = Number(current[ds.key]);
            const chg = pctChange(curVal, baseVal);
            const isNeg = chg.startsWith('-');
            const direction = meta.metricDefs.find(m => m.key === ds.key)?.direction;
            let cls = '';
            if (direction === 'up-good') cls = isNeg ? s.down : s.up;
            else if (direction === 'down-good') cls = isNeg ? s.up : s.down;
            else cls = isNeg ? s.down : s.up;

            return (
              <div key={ds.key} className={`${s.ekpi} ${cls}`}>
                <span className={s.ekpiVal}>{chg}</span>
                <span className={s.ekpiLabel}>{ds.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
