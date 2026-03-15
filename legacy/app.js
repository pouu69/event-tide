// === STATE ===
let currentIndex = 0;
let isPlaying = false;
let playInterval = null;
const playSpeed = 1500;
const WAR_START = new Date('2026-02-28');
const DAY_MS = 86400000;
let currentEconDate = '2026-03-15';

// === CACHED DOM REFS ===
let stripEvents, evCards, phaseLbls, chartTooltip, chartCanvas, chartCtx, chartWrap;

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
  chartCanvas = document.getElementById('econ-chart');
  chartCtx = chartCanvas.getContext('2d');
  chartWrap = chartCanvas.parentElement;

  // Create tooltip once
  chartTooltip = document.createElement('div');
  chartTooltip.className = 'chart-tooltip';
  chartWrap.appendChild(chartTooltip);

  buildStrip();
  buildEventCards();

  // Cache collections after build
  stripEvents = document.querySelectorAll('.strip-event');
  evCards = document.querySelectorAll('.ev-card');
  phaseLbls = document.querySelectorAll('.strip-phase-lbl');

  // Start at today's event
  const today = new Date().toISOString().slice(0, 10);
  let startIdx = WAR_EVENTS.length - 1;
  for (let i = WAR_EVENTS.length - 1; i >= 0; i--) {
    if (WAR_EVENTS[i].date <= today) { startIdx = i; break; }
  }
  goToEvent(startIdx);
  setupControls();
  setupChartInteraction();
  setupPanelToggle();

  setTimeout(() => document.getElementById('loader').classList.add('hidden'), 500);
});

// === HELPERS ===
function formatDateShort(dateStr) {
  // ISO dates: "YYYY-MM-DD" — avoid Date constructor
  return dateStr.replace(/-/g, '.');
}

function formatDateLong(dateStr) {
  const [, m, d] = dateStr.split('-');
  const months = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[+m]} ${+d}, ${dateStr.slice(0, 4)}`;
}

function stripEmoji(text) {
  return text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}🔴💥⚔️🕊️🌍🔥]/gu, '').trim();
}

const TAG_LABELS = { military:'군사', diplomacy:'외교', political:'정치', civilian:'민간인',
  protest:'시위', nuclear:'핵', crisis:'위기', analysis:'분석', current:'현재' };
function getTagLabel(tag) { return TAG_LABELS[tag] || tag; }

function pctChange(current, base) {
  return ((current - base) / base * 100).toFixed(1);
}

function warDay(dateStr) {
  const d = new Date(dateStr);
  return d >= WAR_START ? Math.floor((d - WAR_START) / DAY_MS) + 1 : null;
}

function getEconDataUpTo(dateStr) {
  const filtered = ECON_TIMELINE.filter(d => d.date <= dateStr);
  return filtered.length >= 2 ? filtered : ECON_TIMELINE.slice(0, 2);
}

// === HORIZONTAL STRIP ===
function buildStrip() {
  const phaseCounts = {};
  WAR_EVENTS.forEach(e => { phaseCounts[e.phase] = (phaseCounts[e.phase] || 0) + 1; });
  const phasesEl = document.getElementById('strip-phases');
  const labelsEl = document.getElementById('strip-phase-labels');
  const phaseOrder = ['prelude', 'diplomacy', 'war-start', 'escalation', 'ongoing'];
  const phaseShortNames = { prelude: '전주곡', diplomacy: '외교', 'war-start': '개전', escalation: '확전', ongoing: '현재' };

  phaseOrder.forEach(p => {
    if (!phaseCounts[p]) return;

    const goToPhase = () => {
      const idx = WAR_EVENTS.findIndex(e => e.phase === p);
      if (idx >= 0) goToEvent(idx);
    };

    const seg = document.createElement('div');
    seg.className = `strip-phase-seg seg-${p}`;
    seg.style.flex = phaseCounts[p];
    seg.title = PHASE_INFO[p].title;
    seg.addEventListener('click', goToPhase);
    phasesEl.appendChild(seg);

    const lbl = document.createElement('div');
    lbl.className = 'strip-phase-lbl';
    lbl.dataset.phase = p;
    lbl.style.flex = phaseCounts[p];
    lbl.textContent = phaseShortNames[p];
    lbl.addEventListener('click', goToPhase);
    labelsEl.appendChild(lbl);
  });

  // Event dots
  const track = document.getElementById('strip-track');
  WAR_EVENTS.forEach((evt, i) => {
    const el = document.createElement('div');
    el.className = 'strip-event';
    el.dataset.index = i;
    el.innerHTML = `<div class="strip-tooltip">${stripEmoji(evt.title)}</div><div class="strip-dot"></div><span class="strip-event-label">${evt.date.slice(5)}</span>`;
    el.addEventListener('click', () => goToEvent(i));
    track.appendChild(el);
  });
}

// === EVENT CARDS ===
function buildEventCards() {
  const container = document.getElementById('event-cards');
  WAR_EVENTS.forEach((evt, i) => {
    const card = document.createElement('div');
    card.className = 'ev-card';
    card.dataset.index = i;
    card.innerHTML = `
      <div class="ev-card-date">${formatDateShort(evt.date)}</div>
      <div class="ev-card-title">${stripEmoji(evt.title)}</div>
      <span class="ev-card-tag t-${evt.tag}">${getTagLabel(evt.tag)}</span>
    `;
    card.addEventListener('click', () => goToEvent(i));
    container.appendChild(card);
  });
}

// === NAVIGATE TO EVENT ===
const detailEls = {};
function getDetailEl(id) {
  if (!detailEls[id]) detailEls[id] = document.getElementById(id);
  return detailEls[id];
}

function goToEvent(index) {
  if (index < 0 || index >= WAR_EVENTS.length) return;
  currentIndex = index;
  const evt = WAR_EVENTS[index];

  // Detail panel
  getDetailEl('detail-date').textContent = formatDateLong(evt.date);
  getDetailEl('detail-tag').textContent = getTagLabel(evt.tag);
  getDetailEl('detail-tag').className = 'detail-tag';
  getDetailEl('detail-title').textContent = evt.title;
  getDetailEl('detail-desc').textContent = evt.desc;

  // Detail bullets
  const bulletsEl = getDetailEl('detail-bullets');
  if (evt.details && evt.details.length > 0) {
    bulletsEl.innerHTML = evt.details.map(d => `<li>${d}</li>`).join('');
    bulletsEl.style.display = '';
  } else {
    bulletsEl.innerHTML = '';
    bulletsEl.style.display = 'none';
  }

  // Source links
  const sourcesEl = getDetailEl('detail-sources');
  sourcesEl.innerHTML = (evt.sources || []).map(s =>
    `<a href="${s.url}" class="source-link" target="_blank" rel="noopener">${s.name}</a>`
  ).join('');

  // Animate detail
  const detail = getDetailEl('event-detail');
  detail.classList.remove('anim-in');
  void detail.offsetWidth;
  detail.classList.add('anim-in');

  // Stats
  const s = evt.stats;
  getDetailEl('ds-strikes').textContent = s.strikes.toLocaleString();
  getDetailEl('ds-casualties').textContent = s.casualties.toLocaleString();
  getDetailEl('ds-missiles').textContent = s.missiles.toLocaleString();
  getDetailEl('ds-oil').textContent = `$${s.oil}`;
  getDetailEl('ds-usdead').textContent = s.usDead;
  getDetailEl('ds-cost').textContent = `$${s.cost}B`;

  // Top bar
  getDetailEl('display-date').textContent = formatDateLong(evt.date);
  updateTopbarStats(evt);

  // Phase info
  const info = PHASE_INFO[evt.phase];
  getDetailEl('phase-title').textContent = info.title;
  getDetailEl('phase-period').textContent = info.period;

  // Strip dots
  stripEvents.forEach(el => {
    const idx = +el.dataset.index;
    el.classList.toggle('active', idx === index);
    el.classList.toggle('passed', idx < index);
  });

  // Scroll strip to active
  stripEvents[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

  // Phase labels
  phaseLbls.forEach(lbl => {
    lbl.classList.toggle('lbl-active', lbl.dataset.phase === evt.phase);
  });

  // Economy
  updateEconForDate(evt.date);

  // Card list
  evCards.forEach(card => {
    card.classList.toggle('active', +card.dataset.index === index);
  });
  evCards[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function updateTopbarStats(evt) {
  const dayEl = getDetailEl('stat-day');
  const dayLabel = dayEl.nextElementSibling;
  const day = warDay(evt.date);

  if (day !== null) {
    dayEl.textContent = `DAY ${day}`;
    dayLabel.textContent = 'OF WAR';
  } else {
    const daysUntil = Math.floor((WAR_START - new Date(evt.date)) / DAY_MS);
    dayEl.textContent = `D-${daysUntil}`;
    dayLabel.textContent = 'TO WAR';
  }

  getDetailEl('stat-casualties').textContent =
    evt.stats.casualties > 0 ? evt.stats.casualties.toLocaleString() : '—';
  getDetailEl('stat-oil').textContent = `$${evt.stats.oil}`;
}

// === CONTROLS ===
function setupControls() {
  document.getElementById('btn-play').addEventListener('click', togglePlay);
  document.getElementById('btn-prev').addEventListener('click', () => { stopPlay(); goToEvent(currentIndex - 1); });
  document.getElementById('btn-next').addEventListener('click', () => { stopPlay(); goToEvent(currentIndex + 1); });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); stopPlay(); goToEvent(currentIndex + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); stopPlay(); goToEvent(currentIndex - 1); }
    else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  });
}

function setupPanelToggle() {
  document.getElementById('panel-toggle').addEventListener('click', () => {
    const panel = document.getElementById('event-list');
    panel.classList.toggle('collapsed');
    // Redraw chart after transition to use new width
    setTimeout(() => { cachedChartData = null; renderEconChart(); }, 320);
  });
}

function togglePlay() { isPlaying ? stopPlay() : startPlay(); }

function startPlay() {
  isPlaying = true;
  document.getElementById('icon-play').style.display = 'none';
  document.getElementById('icon-pause').style.display = 'block';
  document.getElementById('btn-play').classList.add('playing');
  playInterval = setInterval(() => {
    if (currentIndex >= WAR_EVENTS.length - 1) { stopPlay(); return; }
    goToEvent(currentIndex + 1);
  }, playSpeed);
}

function stopPlay() {
  isPlaying = false;
  document.getElementById('icon-play').style.display = 'block';
  document.getElementById('icon-pause').style.display = 'none';
  document.getElementById('btn-play').classList.remove('playing');
  clearInterval(playInterval);
  playInterval = null;
}

// === ECON DATE SYNC ===
function updateEconForDate(dateStr) {
  const asofEl = getDetailEl('econ-asof');
  const kpiRow = getDetailEl('econ-kpi-row');
  const baseline = ECON_TIMELINE[0];
  let current = baseline;
  for (let i = ECON_TIMELINE.length - 1; i >= 0; i--) {
    if (ECON_TIMELINE[i].date <= dateStr) { current = ECON_TIMELINE[i]; break; }
  }

  const day = warDay(dateStr);
  asofEl.textContent = day !== null ? `— DAY ${day} 기준` : '— 전쟁 전';

  const indicators = [
    { key: 'oil', label: '유가', fmt: v => `$${v}`, cls: v => v > 0 ? 'down' : 'up' },
    { key: 'kospi', label: 'KOSPI', fmt: v => v.toLocaleString(), cls: v => v < 0 ? 'critical' : 'up' },
    { key: 'sp500', label: 'S&P 500', fmt: () => '', cls: v => v < 0 ? 'down' : 'up' },
    { key: 'bitcoin', label: '비트코인', fmt: () => '', cls: v => v > 0 ? 'up' : 'down' },
    { key: 'usdkrw', label: '원/달러', fmt: v => `₩${current.usdkrw.toLocaleString()}`, cls: () => current.usdkrw > baseline.usdkrw ? 'down' : 'up', raw: true },
    { key: 'defense', label: '방산지수', fmt: () => '', cls: v => v > 0 ? 'up' : 'down' },
  ];

  kpiRow.innerHTML = indicators.map(ind => {
    const chg = pctChange(current[ind.key], baseline[ind.key]);
    const sign = chg > 0 ? '+' : '';
    const valText = ind.raw ? ind.fmt() : `${sign}${chg}%`;
    const detail = ind.fmt(current[ind.key]);
    const cls = ind.cls(+chg);
    return `<div class="ekpi ${cls}"><span class="ekpi-val">${valText}</span><span class="ekpi-label">${ind.label}${detail ? ' ' + detail : ''}</span></div>`;
  }).join('');

  currentEconDate = dateStr;
  renderEconChart();
}

// === CHART CONFIG (constant) ===
const CHART_CONFIG = {
  datasets: [
    { key: 'oil', label: '유가 $', color: '#e8590c', normalize: true, unit: '$', lineWidth: 3 },
    { key: 'sp500', label: 'S&P 500', color: '#1864ab', normalize: true, unit: 'pt', dash: [8, 4] },
    { key: 'kospi', label: 'KOSPI', color: '#2b8a3e', normalize: true, unit: 'pt', lineWidth: 2.5 },
    { key: 'gold', label: '금 $', color: '#e8b006', normalize: true, unit: '$', dash: [3, 3] },
    { key: 'bitcoin', label: '비트코인 $', color: '#f06595', normalize: true, unit: '$', lineWidth: 2 },
    { key: 'usdkrw', label: '원/달러', color: '#7048e8', normalize: true, unit: '₩', dash: [12, 4] },
  ],
};

// Current chart data (cached to avoid refiltering on hover)
let cachedChartData = null;

function renderEconChart(hoverIndex) {
  if (!hoverIndex && hoverIndex !== 0) {
    // Full rebuild — recalculate data
    const rect = chartWrap.getBoundingClientRect();
    chartCanvas.width = rect.width;
    chartCanvas.height = 300;
    cachedChartData = getEconDataUpTo(currentEconDate);
  }
  drawChart(chartCtx, chartCanvas, CHART_CONFIG, hoverIndex, cachedChartData);
}

function setupChartInteraction() {
  chartCanvas.addEventListener('mousemove', (e) => {
    if (!cachedChartData) return;
    const rect = chartCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const pad = { left: 52, right: 16 };
    const chartW = chartCanvas.width - pad.left - pad.right;
    const n = cachedChartData.length;
    if (n < 2) return;

    // Find nearest column index
    const col = Math.round(((mx - pad.left) / chartW) * (n - 1));
    const idx = Math.max(0, Math.min(n - 1, col));
    const colX = pad.left + (idx / (n - 1)) * chartW;

    if (Math.abs(mx - colX) < 30) {
      const data = cachedChartData[idx];
      let html = `<strong>${data.date}</strong><br>`;
      CHART_CONFIG.datasets.forEach(ds => {
        const val = data[ds.key];
        const base = cachedChartData[0][ds.key];
        const chg = pctChange(val, base);
        const sign = chg > 0 ? '+' : '';
        let actual = ds.unit === '$' ? `$${val.toLocaleString()}` :
                     ds.unit === '₩' ? `₩${val.toLocaleString()}` :
                     val.toLocaleString();
        html += `<span style="color:${ds.color}">${ds.label}: ${actual} (${sign}${chg}%)</span><br>`;
      });
      chartTooltip.innerHTML = html;
      chartTooltip.classList.add('visible');

      let tx = colX + 12;
      if (tx + 180 > rect.width) tx = colX - 180;
      chartTooltip.style.left = tx + 'px';
      chartTooltip.style.top = Math.max(10, my - 20) + 'px';

      renderEconChart(idx);
    } else {
      chartTooltip.classList.remove('visible');
      renderEconChart();
    }
  });

  chartCanvas.addEventListener('mouseleave', () => {
    chartTooltip.classList.remove('visible');
    renderEconChart();
  });

  // Legend (static — build once)
  const legendEl = document.getElementById('chart-legend');
  legendEl.innerHTML = CHART_CONFIG.datasets.map(ds => {
    const style = ds.dash
      ? `border-top: 2px dashed ${ds.color}; background: none; width: 16px; height: 0; border-radius: 0;`
      : `background:${ds.color}; width: 16px; height: 3px; border-radius: 2px;`;
    return `<div class="chart-legend-item"><div class="chart-legend-line" style="${style}"></div><span>${ds.label}</span></div>`;
  }).join('');
}

// === DRAW CHART ===
function drawChart(ctx, canvas, config, hoverIndex, data) {
  const W = canvas.width, H = canvas.height;
  const pad = { top: 24, right: 16, bottom: 32, left: 52 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const n = data.length;
  const dates = data.map(d => d.date);

  ctx.clearRect(0, 0, W, H);

  // Calculate normalized values for all datasets
  const dsVals = config.datasets.map(ds =>
    data.map(d => ((d[ds.key] - data[0][ds.key]) / data[0][ds.key]) * 100)
  );

  // Y range from all values
  const flat = dsVals.flat();
  let yMin = Math.min(...flat), yMax = Math.max(...flat);
  const range = yMax - yMin || 1;
  yMin -= range * 0.1;
  yMax += range * 0.1;

  // Grid
  ctx.strokeStyle = '#e8e4de';
  ctx.lineWidth = 1;
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = pad.top + (chartH / gridLines) * i;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y); ctx.stroke();
    const val = yMax - ((yMax - yMin) / gridLines) * i;
    ctx.fillStyle = '#918a82';
    ctx.font = '500 10px DM Sans, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(val.toFixed(1), pad.left - 8, y + 3);
  }

  // Zero baseline
  const zeroY = pad.top + chartH - ((0 - yMin) / (yMax - yMin)) * chartH;
  if (zeroY > pad.top && zeroY < pad.top + chartH) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(pad.left, zeroY); ctx.lineTo(pad.left + chartW, zeroY); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#918a82';
    ctx.font = '600 9px DM Sans, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('0%', pad.left - 8, zeroY + 3);
  }

  // War start marker
  const warIdx = dates.indexOf('2026-02-28');
  if (warIdx >= 0) {
    const x = pad.left + (warIdx / (n - 1)) * chartW;
    ctx.save();
    ctx.strokeStyle = 'rgba(192,57,43,0.25)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + chartH); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#c0392b';
    ctx.font = 'bold 9px DM Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WAR', x, pad.top - 6);
  }

  // Hover crosshair
  if (hoverIndex !== undefined) {
    const hx = pad.left + (hoverIndex / (n - 1)) * chartW;
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.moveTo(hx, pad.top); ctx.lineTo(hx, pad.top + chartH); ctx.stroke();
    ctx.restore();
  }

  // Draw each dataset
  const toY = v => pad.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;
  const toX = i => pad.left + (i / (n - 1)) * chartW;

  config.datasets.forEach((ds, dsIdx) => {
    const vals = dsVals[dsIdx];

    // Line
    ctx.strokeStyle = ds.color;
    ctx.lineWidth = ds.lineWidth || 2;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.setLineDash(ds.dash || []);
    ctx.beginPath();
    vals.forEach((v, i) => { i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)); });
    ctx.stroke();
    ctx.setLineDash([]);

    // Fill under first dataset only
    if (dsIdx === 0) {
      ctx.lineTo(toX(n - 1), pad.top + chartH);
      ctx.lineTo(toX(0), pad.top + chartH);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
      grad.addColorStop(0, ds.color + '15');
      grad.addColorStop(1, ds.color + '02');
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Dots
    vals.forEach((v, i) => {
      const x = toX(i), y = toY(v);
      const hover = hoverIndex === i;
      ctx.beginPath();
      ctx.arc(x, y, hover ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = hover ? ds.color : '#fff';
      ctx.fill();
      ctx.strokeStyle = ds.color;
      ctx.lineWidth = hover ? 2.5 : 1.5;
      ctx.stroke();
    });
  });

  // X labels
  ctx.fillStyle = '#918a82';
  ctx.font = '500 9px DM Sans, sans-serif';
  ctx.textAlign = 'center';
  dates.forEach((d, i) => {
    if (n <= 6 || i % 2 === 0 || i === n - 1) {
      ctx.fillText(d.slice(5), toX(i), pad.top + chartH + 16);
    }
  });
}

// Resize (debounced)
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    cachedChartData = null;
    renderEconChart();
  }, 150);
});
