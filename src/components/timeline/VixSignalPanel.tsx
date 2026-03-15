import { useMemo } from 'react';
import type { EconDataPoint } from '../../types';
import s from './VixSignalPanel.module.css';

interface Props {
  econ: EconDataPoint[];
  currentDate: string;
}

type Signal = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';

interface SignalEntry {
  date: string;
  vix: number;
  signal: Signal;
  sp500Pct: number | null;
  kospiPct: number | null;
  sp500Win: boolean | null;
  kospiWin: boolean | null;
}

function getSignal(vix: number, prevVix?: number): Signal {
  if (vix >= 40) return 'STRONG_BUY';
  if (vix >= 35 && prevVix !== undefined && vix < prevVix) return 'STRONG_BUY';
  if (vix >= 30) return 'BUY';
  if (vix >= 20) return 'HOLD';
  if (vix >= 15) return 'SELL';
  return 'STRONG_SELL';
}

const SIG_LABEL: Record<Signal, string> = {
  STRONG_BUY: '강력 매수', BUY: '매수', HOLD: '관망', SELL: '매도', STRONG_SELL: '강력 매도',
};
const SIG_SHORT: Record<Signal, string> = {
  STRONG_BUY: 'SB', BUY: 'B', HOLD: '—', SELL: 'S', STRONG_SELL: 'SS',
};

function getZoneColor(vix: number): string {
  if (vix >= 35) return '#ef4444';
  if (vix >= 25) return '#f59e0b';
  if (vix >= 18) return '#a3a3a3';
  if (vix >= 12) return '#22c55e';
  return '#06b6d4';
}

function getZoneLabel(vix: number): string {
  if (vix >= 35) return 'EXTREME FEAR';
  if (vix >= 25) return 'FEAR';
  if (vix >= 18) return 'NEUTRAL';
  if (vix >= 12) return 'GREED';
  return 'EXTREME GREED';
}

/* ── Gauge with tick marks ── */
function Gauge({ vix, signal }: { vix: number; signal: Signal }) {
  const cx = 140, cy = 120, r = 100, sw = 6;
  const pct = Math.min(1, Math.max(0, vix / 50));
  const startA = Math.PI * 0.85;
  const sweep = Math.PI * 1.3;

  const zones: [number, number, string][] = [
    [0, 0.24, '#06b6d4'], [0.24, 0.36, '#22c55e'], [0.36, 0.50, '#737373'],
    [0.50, 0.70, '#f59e0b'], [0.70, 1.0, '#ef4444'],
  ];

  const arcD = (from: number, to: number, radius: number) => {
    const a1 = startA + sweep * from, a2 = startA + sweep * to;
    const x1 = cx + radius * Math.cos(a1), y1 = cy + radius * Math.sin(a1);
    const x2 = cx + radius * Math.cos(a2), y2 = cy + radius * Math.sin(a2);
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${to - from > 0.5 ? 1 : 0} 1 ${x2} ${y2}`;
  };

  // needle
  const needleA = startA + sweep * pct;
  const nl = r - 20;
  const nx = cx + nl * Math.cos(needleA), ny = cy + nl * Math.sin(needleA);
  // needle tail
  const ntl = 14;
  const ntx = cx - ntl * Math.cos(needleA), nty = cy - ntl * Math.sin(needleA);

  // tick marks
  const ticks = [0, 10, 15, 20, 25, 30, 35, 40, 50];

  return (
    <svg viewBox="0 0 280 160" className={s.gaugeSvg}>
      {/* outer glow ring */}
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* bg arcs */}
      {zones.map(([from, to, color], i) => (
        <path key={i} d={arcD(from, to, r)} fill="none" stroke={color} strokeWidth={sw}
              opacity={0.15} strokeLinecap={i === 0 || i === zones.length - 1 ? 'round' : 'butt'} />
      ))}
      {/* active arcs */}
      {zones.map(([from, to, color], i) => {
        const ct = Math.min(to, pct);
        if (ct <= from) return null;
        return (
          <path key={`a${i}`} d={arcD(from, ct, r)} fill="none" stroke={color} strokeWidth={sw}
                strokeLinecap={i === 0 ? 'round' : ct >= pct ? 'round' : 'butt'}
                 />
        );
      })}

      {/* tick marks + labels */}
      {ticks.map(t => {
        const tp = t / 50;
        const a = startA + sweep * tp;
        const ix = cx + (r + 10) * Math.cos(a), iy = cy + (r + 10) * Math.sin(a);
        const ox = cx + (r + 18) * Math.cos(a), oy = cy + (r + 18) * Math.sin(a);
        return (
          <g key={t}>
            <line x1={ix} y1={iy} x2={ox} y2={oy} stroke="#918a82" strokeWidth={1} opacity={0.3} />
            <text x={cx + (r + 26) * Math.cos(a)} y={cy + (r + 26) * Math.sin(a) + 3}
                  textAnchor="middle" className={s.tickLabel}>{t}</text>
          </g>
        );
      })}

      {/* needle */}
      <line x1={ntx} y1={nty} x2={nx} y2={ny}
            stroke={getZoneColor(vix)} strokeWidth={2} strokeLinecap="round"  />
      <circle cx={cx} cy={cy} r={6} fill="#fff" stroke={getZoneColor(vix)} strokeWidth={2} />
      <circle cx={cx} cy={cy} r={2.5} fill={getZoneColor(vix)} />

      {/* center value */}
      <text x={cx} y={cy + 30} textAnchor="middle" className={s.gaugeValue}>{vix.toFixed(1)}</text>
      <text x={cx} y={cy + 42} textAnchor="middle" className={s.gaugeZone} fill={getZoneColor(vix)}>
        {getZoneLabel(vix)}
      </text>

      {/* signal badge */}
      <text x={cx} y={cy + 56} textAnchor="middle" className={s.gaugeSignal}>
        {SIG_LABEL[signal]}
      </text>
    </svg>
  );
}

export default function VixSignalPanel({ econ, currentDate }: Props) {
  const analysis = useMemo(() => {
    const filtered = econ.filter(d => (d.date as string) <= currentDate && d.vix !== undefined);
    if (filtered.length === 0) return null;

    const current = filtered[filtered.length - 1];
    const prev = filtered.length >= 2 ? filtered[filtered.length - 2] : undefined;
    const vix = Number(current.vix);
    const prevVix = prev ? Number(prev.vix) : undefined;
    const signal = getSignal(vix, prevVix);

    const history = filtered.map((d, i) => ({
      date: d.date as string,
      vix: Number(d.vix),
      signal: getSignal(Number(d.vix), i > 0 ? Number(filtered[i - 1].vix) : undefined),
    }));

    const entries: SignalEntry[] = [];
    filtered.forEach((d, i) => {
      const v = Number(d.vix);
      const pv = i > 0 ? Number(filtered[i - 1].vix) : undefined;
      const sig = getSignal(v, pv);
      if (sig === 'HOLD') return;

      const isBuy = sig === 'BUY' || sig === 'STRONG_BUY';
      const sp500 = Number(d.sp500), kospi = Number(d.kospi);
      const next = i < filtered.length - 1 ? filtered[i + 1] : null;
      const sp500N = next ? Number(next.sp500) : null;
      const kospiN = next ? Number(next.kospi) : null;

      let sp500Pct: number | null = null, kospiPct: number | null = null;
      let sp500Win: boolean | null = null, kospiWin: boolean | null = null;
      if (sp500 && sp500N) { sp500Pct = ((sp500N - sp500) / sp500) * 100; sp500Win = isBuy ? sp500N > sp500 : sp500N < sp500; }
      if (kospi && kospiN) { kospiPct = ((kospiN - kospi) / kospi) * 100; kospiWin = isBuy ? kospiN > kospi : kospiN < kospi; }

      entries.push({ date: d.date as string, vix: v, signal: sig, sp500Pct, kospiPct, sp500Win, kospiWin });
    });

    const sp500D = entries.filter(e => e.sp500Win !== null);
    const kospiD = entries.filter(e => e.kospiWin !== null);
    const sp500WR = sp500D.length > 0 ? (sp500D.filter(e => e.sp500Win).length / sp500D.length) * 100 : null;
    const kospiWR = kospiD.length > 0 ? (kospiD.filter(e => e.kospiWin).length / kospiD.length) * 100 : null;

    const sbE = entries.filter(e => e.signal === 'STRONG_BUY');
    const sbSp = sbE.filter(e => e.sp500Win !== null);
    const sbKo = sbE.filter(e => e.kospiWin !== null);
    const sbSpWR = sbSp.length > 0 ? (sbSp.filter(e => e.sp500Win).length / sbSp.length) * 100 : null;
    const sbKoWR = sbKo.length > 0 ? (sbKo.filter(e => e.kospiWin).length / sbKo.length) * 100 : null;

    return {
      vix, signal, history, entries,
      sp500WR, kospiWR, sp500Total: sp500D.length, kospiTotal: kospiD.length,
      sbSpWR, sbKoWR, sbSpTotal: sbSp.length, sbKoTotal: sbKo.length,
    };
  }, [econ, currentDate]);

  if (!analysis) return null;
  const { vix, signal, history, entries } = analysis;
  const maxVix = Math.max(...history.map(h => h.vix), 50);
  const maxPct = Math.max(...entries.map(x => Math.max(Math.abs(x.sp500Pct || 0), Math.abs(x.kospiPct || 0))), 1);

  return (
    <div className={s.panel}>
      {/* ── Header strip ── */}
      <div className={s.headerStrip}>
        <div className={s.headerLeft}>
          <span className={s.headerDot} style={{ background: getZoneColor(vix) }} />
          <span className={s.headerTitle}>CBOE VIX</span>
          <span className={s.headerSub}>FEAR · GREED INDEX</span>
        </div>
        <div className={s.signalChip} style={{ '--sig-color': getZoneColor(vix) } as React.CSSProperties}>
          {SIG_LABEL[signal]}
        </div>
      </div>

      {/* ── Gauge ── */}
      <div className={s.gaugeWrap}>
        <Gauge vix={vix} signal={signal} />
      </div>

      {/* ── Heatmap timeline ── */}
      <div className={s.heatSection}>
        <div className={s.sectionLabel}>VIX TIMELINE</div>
        <div className={s.heatStrip}>
          {history.map((h, i) => {
            const isLast = i === history.length - 1;
            const heightPct = (h.vix / maxVix) * 100;
            const hasSig = h.signal !== 'HOLD';
            return (
              <div key={h.date} className={`${s.heatCol} ${isLast ? s.heatColActive : ''}`}
                   title={`${h.date}\nVIX ${h.vix.toFixed(1)}\n${SIG_LABEL[h.signal]}`}>
                <div className={s.heatBar} style={{ height: `${heightPct}%`, background: getZoneColor(h.vix) }}>
                  {hasSig && (
                    <span className={s.heatSig} style={{ color: getZoneColor(h.vix) }}>
                      {SIG_SHORT[h.signal]}
                    </span>
                  )}
                </div>
                <span className={s.heatVal}>{h.vix.toFixed(0)}</span>
                <span className={s.heatDate}>{h.date.slice(8)}</span>
              </div>
            );
          })}
        </div>
        {/* zone reference lines */}
        <div className={s.heatZones}>
          <div className={s.heatZoneLine} style={{ bottom: `${(30 / maxVix) * 100}%` }}>
            <span>30 — 매수</span>
          </div>
          <div className={s.heatZoneLine} style={{ bottom: `${(20 / maxVix) * 100}%` }}>
            <span>20</span>
          </div>
        </div>
      </div>

      {/* ── Win rates ── */}
      <div className={s.winSection}>
        <div className={s.sectionLabel}>SIGNAL ACCURACY</div>
        <div className={s.winCards}>
          {/* S&P 500 */}
          {analysis.sp500WR !== null && (
            <div className={s.winCard}>
              <div className={s.winIndex}>S&P 500</div>
              <div className={s.winBig} style={{ color: analysis.sp500WR >= 50 ? '#22c55e' : '#ef4444' }}>
                {analysis.sp500WR.toFixed(0)}<span className={s.winPctSign}>%</span>
              </div>
              <div className={s.winMeta}>{analysis.sp500Total}전 중 {Math.round(analysis.sp500WR * analysis.sp500Total / 100)}승</div>
              <div className={s.winBar}>
                <div className={s.winBarFill} style={{ width: `${analysis.sp500WR}%`, background: analysis.sp500WR >= 50 ? '#22c55e' : '#ef4444' }} />
              </div>
            </div>
          )}
          {/* KOSPI */}
          {analysis.kospiWR !== null && (
            <div className={s.winCard}>
              <div className={s.winIndex}>KOSPI</div>
              <div className={s.winBig} style={{ color: analysis.kospiWR >= 50 ? '#22c55e' : '#ef4444' }}>
                {analysis.kospiWR.toFixed(0)}<span className={s.winPctSign}>%</span>
              </div>
              <div className={s.winMeta}>{analysis.kospiTotal}전 중 {Math.round(analysis.kospiWR * analysis.kospiTotal / 100)}승</div>
              <div className={s.winBar}>
                <div className={s.winBarFill} style={{ width: `${analysis.kospiWR}%`, background: analysis.kospiWR >= 50 ? '#22c55e' : '#ef4444' }} />
              </div>
            </div>
          )}
        </div>

        {/* Strong Buy — only when active */}
        {signal === 'STRONG_BUY' && (analysis.sbSpTotal > 0 || analysis.sbKoTotal > 0) && (
          <div className={s.sbBlock}>
            <div className={s.sbHeader}>
              <span className={s.sbPulse} />
              <span>강력 매수 시그널 승률</span>
            </div>
            <div className={s.winCards}>
              {analysis.sbSpWR !== null && (
                <div className={s.winCard}>
                  <div className={s.winIndex}>S&P 500</div>
                  <div className={s.winBig} style={{ color: '#22c55e' }}>
                    {analysis.sbSpWR.toFixed(0)}<span className={s.winPctSign}>%</span>
                  </div>
                  <div className={s.winMeta}>{analysis.sbSpTotal}전</div>
                </div>
              )}
              {analysis.sbKoWR !== null && (
                <div className={s.winCard}>
                  <div className={s.winIndex}>KOSPI</div>
                  <div className={s.winBig} style={{ color: '#22c55e' }}>
                    {analysis.sbKoWR.toFixed(0)}<span className={s.winPctSign}>%</span>
                  </div>
                  <div className={s.winMeta}>{analysis.sbKoTotal}전</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Signal log with diverging bars ── */}
      <div className={s.logSection}>
        <div className={s.sectionLabel}>SIGNAL LOG</div>
        <div className={s.logGrid}>
          {/* header */}
          <div className={s.logHeaderRow}>
            <span>DATE</span><span>SIG</span><span>VIX</span>
            <span className={s.logHeaderCenter}>S&P 500</span>
            <span className={s.logHeaderCenter}>KOSPI</span>
          </div>
          {entries.map(e => (
            <div key={e.date} className={`${s.logRow} ${e.signal === 'STRONG_BUY' ? s.logRowSB : ''}`}>
              <span className={s.logDate}>{e.date.slice(5)}</span>
              <span className={s.logSig} style={{ color: getZoneColor(e.vix) }}>
                {SIG_SHORT[e.signal]}
              </span>
              <span className={s.logVix}>{e.vix.toFixed(0)}</span>
              {/* S&P diverging bar */}
              <div className={s.logDiverge}>
                {e.sp500Pct !== null ? (
                  <>
                    <div className={s.logDivHalf}>
                      {e.sp500Pct < 0 && (
                        <div className={s.logDivBarNeg}
                             style={{ width: `${(Math.abs(e.sp500Pct) / maxPct) * 100}%` }} />
                      )}
                    </div>
                    <div className={s.logDivCenter} />
                    <div className={s.logDivHalf}>
                      {e.sp500Pct > 0 && (
                        <div className={s.logDivBarPos}
                             style={{ width: `${(e.sp500Pct / maxPct) * 100}%` }} />
                      )}
                    </div>
                    <span className={e.sp500Win ? s.logPctG : s.logPctR}>
                      {e.sp500Pct > 0 ? '+' : ''}{e.sp500Pct.toFixed(1)}
                    </span>
                  </>
                ) : <span className={s.logPending}>—</span>}
              </div>
              {/* KOSPI diverging bar */}
              <div className={s.logDiverge}>
                {e.kospiPct !== null ? (
                  <>
                    <div className={s.logDivHalf}>
                      {e.kospiPct < 0 && (
                        <div className={s.logDivBarNeg}
                             style={{ width: `${(Math.abs(e.kospiPct) / maxPct) * 100}%` }} />
                      )}
                    </div>
                    <div className={s.logDivCenter} />
                    <div className={s.logDivHalf}>
                      {e.kospiPct > 0 && (
                        <div className={s.logDivBarPos}
                             style={{ width: `${(e.kospiPct / maxPct) * 100}%` }} />
                      )}
                    </div>
                    <span className={e.kospiWin ? s.logPctG : s.logPctR}>
                      {e.kospiPct > 0 ? '+' : ''}{e.kospiPct.toFixed(1)}
                    </span>
                  </>
                ) : <span className={s.logPending}>—</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className={s.footer}>
        역발상 매매: 공포 시 매수, 탐욕 시 매도
      </div>
    </div>
  );
}
