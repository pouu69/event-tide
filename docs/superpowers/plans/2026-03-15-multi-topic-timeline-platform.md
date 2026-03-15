# Multi-Topic Timeline Platform Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the vanilla JS war-history project into a React+Vite+TS multi-topic dashboard platform with data collection CLI.

**Architecture:** Three sequential phases: (1) Data migration — convert hardcoded data.js to structured JSON files, (2) React SPA — Vite+TS project with dashboard home and timeline detail pages, (3) CLI pipeline — modular crawler system with event suggestion. Phase 1 must complete first as it produces the data files that Phases 2 and 3 consume. Phases 2 and 3 can then run in parallel.

**Tech Stack:** React 19, Vite 6, TypeScript 5, React Router v7, CSS Modules, Canvas API, Node.js ESM CLI

**Spec:** `docs/superpowers/specs/2026-03-15-multi-topic-timeline-platform-design.md`

---

## Chunk 1: Project Scaffold + Data Migration

### Task 1: Initialize Vite + React + TypeScript project

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `index.html` (Vite entry — replaces old index.html)

- [ ] **Step 1: Scaffold Vite project in the existing directory**

Back up old files first, then init Vite in-place:
```bash
cd /Users/kwanung/development/experiments/war-history
mkdir -p legacy
mv app.js data.js style.css index.html collect.mjs legacy/
npm create vite@latest . -- --template react-ts
```
If prompted about non-empty directory, select "Ignore existing files". The old project files are preserved in `legacy/` for reference during porting.

- [ ] **Step 2: Install dependencies**

```bash
npm install react-router-dom@7
npm install -D @types/react @types/react-dom
```

- [ ] **Step 3: Verify dev server starts**

```bash
npm run dev
```
Expected: Vite dev server on localhost, default React page renders.

- [ ] **Step 4: Create minimal App with router**

Create `src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { TimelinePage } from './pages/TimelinePage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/topic/:slug" element={<TimelinePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

Create placeholder pages:
- `src/pages/Dashboard.tsx` — exports `Dashboard` with `<h1>Dashboard</h1>`
- `src/pages/TimelinePage.tsx` — exports `TimelinePage` with `<h1>Timeline: {slug}</h1>` using `useParams()`

- [ ] **Step 5: Verify routing works**

```bash
npm run dev
```
Navigate to `/` → shows Dashboard. Navigate to `/topic/test` → shows "Timeline: test". Navigate to `/nonexistent` → redirects to Dashboard.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite + React + TS project with router"
```

---

### Task 2: Define TypeScript types from spec schemas

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Write all type definitions**

Create `src/types/index.ts`:
```ts
// === Topic Index ===
export interface TopicSummary {
  slug: string;
  title: string;
  status: 'ongoing' | 'developing' | 'monitoring' | 'archived';
  updatedAt: string;
}

export interface TopicIndex {
  topics: TopicSummary[];
}

// === Topic Meta ===
export interface PhaseInfo {
  id: string;
  title: string;
  period: string;
  color: string;
}

export interface KpiConfig {
  key: string;
  label: string;
  unit: string;
  source: 'econ' | 'stats';
  direction: 'up-good' | 'down-good' | 'neutral';
}

export interface StatField {
  key: string;
  label: string;
  color: string;
}

export interface MetricDef {
  key: string;
  label: string;
  unit: string;
  format: 'number' | 'currency' | 'percent';
  direction: 'up-good' | 'down-good' | 'neutral';
  chartColor: string;
  chartDash?: number[];
  chartLineWidth?: number;
  showOnDashboard: boolean;
  showOnDetail: boolean;
}

export interface CollectorConfig {
  key: string;
  type: 'yahoo' | 'coingecko' | 'naver' | 'custom';
  symbol?: string;
  id?: string;
  code?: string;
  transform?: 'round' | 'round2';
}

export interface NewsSource {
  name: string;
  type: 'rss' | 'web';
  url: string;
  language: 'en' | 'ko';
}

export interface TopicMeta {
  slug: string;
  title: string;
  status: 'ongoing' | 'developing' | 'monitoring' | 'archived';
  startDate: string;
  baselineDate: string;
  phases: PhaseInfo[];
  kpis: KpiConfig[];
  statsFields: StatField[];
  metricDefs: MetricDef[];
  collectors: CollectorConfig[];
  newsSources: NewsSource[];
}

// === Events ===
export interface TopicEvent {
  id: number;
  date: string;
  phase: string;
  tag: string;
  title: string;
  desc: string;
  details: string[];
  sources: { name: string; url: string }[];
  metrics: Record<string, number>;
}

// === Econ ===
export interface EconDataPoint {
  date: string;
  [key: string]: number | string;
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add TypeScript type definitions from spec"
```

---

### Task 3: Migrate data.js to JSON files

**Files:**
- Create: `public/data/index.json`
- Create: `public/data/topics/us-iran-war/meta.json`
- Create: `public/data/topics/us-iran-war/events.json`
- Create: `public/data/topics/us-iran-war/econ.json`
- Create: `scripts/migrate-data.mjs` (one-time migration script)

- [ ] **Step 1: Write migration script**

Create `scripts/migrate-data.mjs` — a Node script that:
1. Reads the old `data.js` file from the original project (`/Users/kwanung/development/experiments/war-history/data.js`)
2. Parses `WAR_EVENTS`, `PHASE_INFO`, `ECON_TIMELINE`, `ECON_CATEGORIES` using regex extraction + `eval`
3. Transforms `WAR_EVENTS[].stats` → `metrics` (rename field, remove `oil` from metrics since it's in econ)
4. Writes `events.json`, `econ.json`, `meta.json`, and `index.json`

Key transformations:

**events.json:**
- `stats` → `metrics` rename
- Remove `oil`, `usDead`, `cost` keys that overlap with econ (keep only: `strikes`, `casualties`, `missiles`)
- Wait — actually keep `usDead` and `cost` since they are war-specific stats not in econ.json. Remove only `oil`.

**meta.json phases** — map from `PHASE_INFO` object to array. Extract colors from `legacy/style.css` CSS classes:
```
prelude   → color: "#c45500" (from .seg-prelude orange)
diplomacy → color: "#2c6fbb" (from .seg-diplomacy blue)
war-start → color: "#c0392b" (from .seg-war-start accent)
escalation→ color: "#e74c3c" (from .seg-escalation accent-light)
ongoing   → color: "#7b3fa0" (from .seg-ongoing purple)
```
Drop `summary` field (not in spec schema).

**meta.json statsFields** — define from current event stats keys:
```json
[
  { "key": "strikes", "label": "공습 횟수", "color": "#c0392b" },
  { "key": "casualties", "label": "총 사상자", "color": "#c0392b" },
  { "key": "missiles", "label": "이란 미사일/드론", "color": "#2c6fbb" },
  { "key": "usDead", "label": "미군 사망", "color": "#7b3fa0" },
  { "key": "cost", "label": "작전 비용 $B", "color": "#27864a" }
]
```

**meta.json kpis** — dashboard card indicators:
```json
[
  { "key": "casualties", "label": "사상자", "unit": "명", "source": "stats", "direction": "neutral" },
  { "key": "oil", "label": "유가", "unit": "$", "source": "econ", "direction": "down-good" },
  { "key": "usDead", "label": "미군", "unit": "명", "source": "stats", "direction": "neutral" }
]
```

**meta.json metricDefs** — from `CHART_CONFIG` in `legacy/app.js`:
```json
[
  { "key": "oil", "label": "유가 $", "unit": "$", "format": "currency", "direction": "down-good", "chartColor": "#e8590c", "chartLineWidth": 3, "showOnDashboard": true, "showOnDetail": true },
  { "key": "sp500", "label": "S&P 500", "unit": "pt", "format": "number", "direction": "up-good", "chartColor": "#1864ab", "chartDash": [8,4], "showOnDashboard": false, "showOnDetail": true },
  { "key": "kospi", "label": "KOSPI", "unit": "pt", "format": "number", "direction": "up-good", "chartColor": "#2b8a3e", "chartLineWidth": 2.5, "showOnDashboard": false, "showOnDetail": true },
  { "key": "gold", "label": "금 $", "unit": "$", "format": "currency", "direction": "neutral", "chartColor": "#e8b006", "chartDash": [3,3], "showOnDashboard": false, "showOnDetail": true },
  { "key": "bitcoin", "label": "비트코인 $", "unit": "$", "format": "currency", "direction": "neutral", "chartColor": "#f06595", "chartLineWidth": 2, "showOnDashboard": false, "showOnDetail": true },
  { "key": "usdkrw", "label": "원/달러", "unit": "₩", "format": "number", "direction": "down-good", "chartColor": "#7048e8", "chartDash": [12,4], "showOnDashboard": false, "showOnDetail": true }
]
```

**meta.json collectors** — from `legacy/collect.mjs` YAHOO_SYMBOLS:
```json
[
  { "key": "oil", "type": "yahoo", "symbol": "BZ=F", "transform": "round" },
  { "key": "sp500", "type": "yahoo", "symbol": "^GSPC", "transform": "round" },
  { "key": "kospi", "type": "yahoo", "symbol": "^KS11", "transform": "round" },
  { "key": "usdkrw", "type": "yahoo", "symbol": "KRW=X", "transform": "round" },
  { "key": "gold", "type": "yahoo", "symbol": "GC=F", "transform": "round" },
  { "key": "bitcoin", "type": "coingecko", "id": "bitcoin", "transform": "round" },
  { "key": "gas", "type": "yahoo", "symbol": "RB=F", "transform": "round2" },
  { "key": "lng_eu", "type": "yahoo", "symbol": "TTF=F", "transform": "round" },
  { "key": "defense", "type": "yahoo", "symbol": "ITA", "transform": "round" }
]
```

**meta.json newsSources:**
```json
[
  { "name": "Al Jazeera", "type": "rss", "url": "https://www.aljazeera.com/xml/rss/all.xml", "language": "en" },
  { "name": "Reuters", "type": "rss", "url": "https://www.rss.reuters.com/news/world", "language": "en" }
]
```

- [ ] **Step 2: Run migration script**

```bash
node scripts/migrate-data.mjs
```
Expected: 4 JSON files created in `public/data/`.

- [ ] **Step 3: Verify JSON files are valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('public/data/index.json','utf8')); console.log('index.json OK')"
node -e "JSON.parse(require('fs').readFileSync('public/data/topics/us-iran-war/meta.json','utf8')); console.log('meta.json OK')"
node -e "JSON.parse(require('fs').readFileSync('public/data/topics/us-iran-war/events.json','utf8')); console.log('events.json OK')"
node -e "JSON.parse(require('fs').readFileSync('public/data/topics/us-iran-war/econ.json','utf8')); console.log('econ.json OK')"
```
Expected: All 4 OK.

- [ ] **Step 4: Spot-check data integrity**

```bash
node -e "
const e = JSON.parse(require('fs').readFileSync('public/data/topics/us-iran-war/events.json','utf8'));
console.log('Events:', e.length);
console.log('First:', e[0].title);
console.log('Last:', e[e.length-1].title);
console.log('Has metrics:', 'strikes' in e[0].metrics);
console.log('No oil in metrics:', !('oil' in e[0].metrics));
"
```
Expected: 30 events, first/last titles match, `strikes` exists, `oil` removed from metrics.

- [ ] **Step 5: Commit**

```bash
git add public/data/ scripts/migrate-data.mjs
git commit -m "feat: migrate data.js to structured JSON files"
```

---

### Task 4: Data-loading hooks

**Files:**
- Create: `src/hooks/useTopicIndex.ts`
- Create: `src/hooks/useTopicData.ts`
- Create: `src/hooks/index.ts`

- [ ] **Step 1: Implement useTopicIndex**

Create `src/hooks/useTopicIndex.ts`:
```ts
import { useState, useEffect } from 'react';
import type { TopicSummary } from '../types';

export function useTopicIndex() {
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetch('/data/index.json')
      .then(res => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then(data => { setTopics(data.topics); setLoading(false); })
      .catch(err => { setError(err); setLoading(false); });
  }, []);

  return { topics, loading, error };
}
```

- [ ] **Step 2: Implement useTopicData**

Create `src/hooks/useTopicData.ts`:
```ts
import { useState, useEffect } from 'react';
import type { TopicMeta, TopicEvent, EconDataPoint } from '../types';

export function useTopicData(slug: string) {
  const [meta, setMeta] = useState<TopicMeta | null>(null);
  const [events, setEvents] = useState<TopicEvent[]>([]);
  const [econ, setEcon] = useState<EconDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const base = `/data/topics/${slug}`;
    Promise.all([
      fetch(`${base}/meta.json`).then(r => { if (!r.ok) throw new Error(`meta: ${r.status}`); return r.json(); }),
      fetch(`${base}/events.json`).then(r => { if (!r.ok) throw new Error(`events: ${r.status}`); return r.json(); }),
      fetch(`${base}/econ.json`).then(r => { if (!r.ok) throw new Error(`econ: ${r.status}`); return r.json(); }),
    ])
      .then(([m, e, ec]) => { setMeta(m); setEvents(e); setEcon(ec); setLoading(false); })
      .catch(err => { setError(err); setLoading(false); });
  }, [slug]);

  return { meta, events, econ, loading, error };
}
```

- [ ] **Step 3: Create barrel export**

Create `src/hooks/index.ts`:
```ts
export { useTopicIndex } from './useTopicIndex';
export { useTopicData } from './useTopicData';
```

- [ ] **Step 4: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/
git commit -m "feat: add data-loading hooks (useTopicIndex, useTopicData)"
```

---

## Chunk 2: Dashboard Page

### Task 5: Dashboard page with TopicCard grid

**Files:**
- Create: `src/pages/Dashboard.tsx`
- Create: `src/pages/Dashboard.module.css`
- Create: `src/components/common/StatusBadge.tsx`
- Create: `src/components/common/StatusBadge.module.css`
- Create: `src/components/dashboard/TopicCard.tsx`
- Create: `src/components/dashboard/TopicCard.module.css`
- Create: `src/components/common/SparklineChart.tsx`

- [ ] **Step 1: Create StatusBadge component**

A reusable badge showing topic status with color coding.

`src/components/common/StatusBadge.tsx`:
```tsx
import type { TopicSummary } from '../../types';
import styles from './StatusBadge.module.css';

const STATUS_CONFIG = {
  ongoing: { label: 'ONGOING', color: '#c0392b' },
  developing: { label: 'DEVELOPING', color: '#e67e22' },
  monitoring: { label: 'MONITORING', color: '#27ae60' },
  archived: { label: 'ARCHIVED', color: '#888' },
} as const;

export function StatusBadge({ status }: { status: TopicSummary['status'] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={styles.badge} style={{ color: cfg.color, backgroundColor: cfg.color + '18' }}>
      {cfg.label}
    </span>
  );
}
```

`src/components/common/StatusBadge.module.css`:
```css
.badge {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
```

- [ ] **Step 2: Create SparklineChart component**

A tiny Canvas chart for dashboard cards. Takes an array of numbers and renders a sparkline.

`src/components/common/SparklineChart.tsx`:
```tsx
import { useRef, useEffect } from 'react';

interface Props {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}

export function SparklineChart({ data, color, width = 120, height = 32 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pad = 2;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = pad + (i / (data.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (v - min) / range) * (height - pad * 2);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [data, color, width, height]);

  return <canvas ref={canvasRef} style={{ width, height }} />;
}
```

- [ ] **Step 3: Create TopicCard component**

Each card loads its own meta.json + last few econ points for the sparkline.

`src/components/dashboard/TopicCard.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TopicSummary, TopicMeta, EconDataPoint } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { SparklineChart } from '../common/SparklineChart';
import styles from './TopicCard.module.css';

export function TopicCard({ topic }: { topic: TopicSummary }) {
  const navigate = useNavigate();
  const [meta, setMeta] = useState<TopicMeta | null>(null);
  const [econ, setEcon] = useState<EconDataPoint[]>([]);
  const [latestEvent, setLatestEvent] = useState<any>(null);

  useEffect(() => {
    const base = `/data/topics/${topic.slug}`;
    Promise.all([
      fetch(`${base}/meta.json`).then(r => r.json()),
      fetch(`${base}/econ.json`).then(r => r.json()),
      fetch(`${base}/events.json`).then(r => r.json()),
    ]).then(([m, ec, ev]) => {
      setMeta(m);
      setEcon(ec);
      setLatestEvent(ev[ev.length - 1]);
    }).catch(() => {});
  }, [topic.slug]);

  if (!meta) return <div className={styles.card} />;

  // Resolve KPI values
  const kpiValues = meta.kpis.slice(0, 4).map(kpi => {
    let val: number | string = '—';
    if (kpi.source === 'econ' && econ.length > 0) {
      val = econ[econ.length - 1][kpi.key] as number;
    } else if (kpi.source === 'stats' && latestEvent) {
      val = latestEvent.metrics[kpi.key];
    }
    return { ...kpi, val };
  });

  // Sparkline from first metricDef that has showOnDashboard
  const sparkMetric = meta.metricDefs.find(d => d.showOnDashboard);
  const sparkData = sparkMetric ? econ.map(d => d[sparkMetric.key] as number) : [];

  return (
    <div className={styles.card} onClick={() => navigate(`/topic/${topic.slug}`)}>
      <div className={styles.header}>
        <StatusBadge status={topic.status} />
        <h3 className={styles.title}>{meta.title}</h3>
      </div>
      <div className={styles.kpis}>
        {kpiValues.map(k => (
          <div key={k.key} className={styles.kpi}>
            <span className={styles.kpiVal}>
              {typeof k.val === 'number' ? k.val.toLocaleString() : k.val}
            </span>
            <span className={styles.kpiLabel}>{k.label}</span>
          </div>
        ))}
      </div>
      {sparkData.length > 1 && (
        <SparklineChart data={sparkData} color={sparkMetric!.chartColor} />
      )}
    </div>
  );
}
```

`src/components/dashboard/TopicCard.module.css`:
```css
.card {
  background: #fff;
  border: 1px solid #e0dcd6;
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}
.card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  border-color: #c8c3bb;
}
.header { margin-bottom: 0.75rem; }
.title {
  font-family: 'Noto Sans KR', sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  margin-top: 0.4rem;
  color: #1a1814;
}
.kpis {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}
.kpi { text-align: center; }
.kpiVal {
  display: block;
  font-family: 'DM Sans', sans-serif;
  font-size: 1.1rem;
  font-weight: 800;
  color: #c0392b;
  font-variant-numeric: tabular-nums;
}
.kpiLabel {
  display: block;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.6rem;
  color: #918a82;
  text-transform: uppercase;
}
```

- [ ] **Step 4: Implement Dashboard page**

`src/pages/Dashboard.tsx`:
```tsx
import { useTopicIndex } from '../hooks';
import { TopicCard } from '../components/dashboard/TopicCard';
import styles from './Dashboard.module.css';

export function Dashboard() {
  const { topics, loading, error } = useTopicIndex();

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (error) return <div className={styles.error}>Failed to load topics</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.brand}>WORLD CHRONICLE</h1>
        <p className={styles.subtitle}>글로벌 이슈 트래커</p>
      </header>
      <div className={styles.grid}>
        {topics.map(t => <TopicCard key={t.slug} topic={t} />)}
      </div>
    </div>
  );
}
```

`src/pages/Dashboard.module.css`:
```css
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}
.header {
  margin-bottom: 2rem;
}
.brand {
  font-family: 'Playfair Display', serif;
  font-size: 1.8rem;
  font-weight: 900;
  color: #1a1814;
  letter-spacing: 0.05em;
}
.subtitle {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.8rem;
  color: #918a82;
  margin-top: 0.3rem;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}
.loading, .error {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  font-family: 'DM Sans', sans-serif;
  color: #918a82;
}
```

- [ ] **Step 5: Add Google Fonts to index.html**

Update `index.html` to include the font link:
```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Source+Serif+4:ital,wght@0,300;0,400;0,600;0,700;1,400&family=DM+Sans:wght@400;500;600;700&family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap" rel="stylesheet">
```

- [ ] **Step 6: Verify dashboard renders with topic cards**

```bash
npm run dev
```
Open `http://localhost:5173/` — should show "WORLD CHRONICLE" header and at least one topic card (us-iran-war) with status badge, KPI values, and sparkline.

- [ ] **Step 7: Commit**

```bash
git add src/pages/ src/components/
git commit -m "feat: dashboard page with topic card grid"
```

---

## Chunk 3: Timeline Page

### Task 6: Event navigation hook + keyboard controls

**Files:**
- Create: `src/hooks/useEventNavigation.ts`
- Create: `src/hooks/useKeyboardNav.ts`
- Modify: `src/hooks/index.ts`

- [ ] **Step 1: Implement useEventNavigation**

Port the current `goToEvent`, `startPlay`, `stopPlay` logic as a React hook.

`src/hooks/useEventNavigation.ts`:
```ts
import { useState, useCallback, useRef, useEffect } from 'react';
import type { TopicEvent } from '../types';

const PLAY_SPEED = 1500;

export function useEventNavigation(events: TopicEvent[]) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize to today's event or latest
  useEffect(() => {
    if (events.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    let idx = events.length - 1;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].date <= today) { idx = i; break; }
    }
    setCurrentIndex(idx);
  }, [events]);

  const goTo = useCallback((index: number) => {
    if (index >= 0 && index < events.length) setCurrentIndex(index);
  }, [events.length]);

  const next = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);
  const prev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);

  const stopPlay = useCallback(() => {
    setIsPlaying(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const startPlay = useCallback(() => {
    setIsPlaying(true);
    intervalRef.current = setInterval(() => {
      setCurrentIndex(i => {
        if (i >= events.length - 1) { stopPlay(); return i; }
        return i + 1;
      });
    }, PLAY_SPEED);
  }, [events.length, stopPlay]);

  const togglePlay = useCallback(() => {
    isPlaying ? stopPlay() : startPlay();
  }, [isPlaying, stopPlay, startPlay]);

  // Cleanup on unmount
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return {
    currentIndex,
    currentEvent: events[currentIndex] ?? null,
    goTo, next, prev,
    isPlaying, togglePlay, stopPlay,
  };
}
```

- [ ] **Step 2: Implement useKeyboardNav**

`src/hooks/useKeyboardNav.ts`:
```ts
import { useEffect } from 'react';

interface NavControls {
  next: () => void;
  prev: () => void;
  togglePlay: () => void;
  stopPlay: () => void;
}

export function useKeyboardNav({ next, prev, togglePlay, stopPlay }: NavControls) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); stopPlay(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); stopPlay(); prev(); }
      else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [next, prev, togglePlay, stopPlay]);
}
```

- [ ] **Step 3: Update barrel export**

Add to `src/hooks/index.ts`:
```ts
export { useEventNavigation } from './useEventNavigation';
export { useKeyboardNav } from './useKeyboardNav';
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/
git commit -m "feat: event navigation hook with keyboard controls"
```

---

### Task 7: Timeline page — TopBar + TimelineStrip

**Files:**
- Create: `src/components/timeline/TopBar.tsx`
- Create: `src/components/timeline/TopBar.module.css`
- Create: `src/components/timeline/TimelineStrip.tsx`
- Create: `src/components/timeline/TimelineStrip.module.css`

- [ ] **Step 1: Implement TopBar**

Port the current topbar — back button + title + stats.

`src/components/timeline/TopBar.tsx`:
```tsx
import { useNavigate } from 'react-router-dom';
import type { TopicMeta, TopicEvent, EconDataPoint } from '../../types';
import styles from './TopBar.module.css';

interface Props {
  meta: TopicMeta;
  event: TopicEvent;
  econ: EconDataPoint[];
}

export function TopBar({ meta, event, econ }: Props) {
  const navigate = useNavigate();
  const startDate = new Date(meta.startDate);
  const evtDate = new Date(event.date);
  const dayNum = evtDate >= startDate
    ? Math.floor((evtDate.getTime() - startDate.getTime()) / 86400000) + 1
    : null;

  // Resolve KPI values for topbar (first 3 statsFields)
  const topStats = meta.statsFields.slice(0, 3).map(f => ({
    label: f.label,
    val: event.metrics[f.key]?.toLocaleString() ?? '—',
  }));

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <button className={styles.back} onClick={() => navigate('/')}>←</button>
        <h1 className={styles.title}>{meta.title}</h1>
      </div>
      <div className={styles.stats}>
        {dayNum !== null && (
          <div className={styles.stat}>
            <span className={styles.statVal}>DAY {dayNum}</span>
          </div>
        )}
        {topStats.map(s => (
          <div key={s.label} className={styles.stat}>
            <span className={styles.statVal}>{s.val}</span>
            <span className={styles.statLabel}>{s.label}</span>
          </div>
        ))}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Implement TimelineStrip**

Port the horizontal strip with phase segments, event dots, and controls.

`src/components/timeline/TimelineStrip.tsx` — React version of `buildStrip()` from app.js. Renders:
- Phase color bar segments (from `meta.phases`)
- Phase labels
- Event dot track (scrollable)
- Prev/Play/Next controls

Props: `{ meta, events, currentIndex, onGoTo, isPlaying, onTogglePlay, onPrev, onNext }`

Rendering structure (port from `legacy/app.js` `buildStrip()` lines 100-123):
1. Phase labels row: `meta.phases.map(p => <div>)` with `flex: phaseCounts[p.id]`
2. Phase color bar: same flex proportions, each segment `background: p.color`, clickable → `onGoTo(firstEventOfPhase)`
3. Event dot track: scrollable `div` with `overflow-x: auto`. Each event is a dot + date label. Active dot highlighted, passed dots dimmed. Use `useEffect` + `scrollIntoView` to center active dot.
4. Controls row: Prev/Play-Pause/Next buttons (SVG icons from `legacy/index.html` lines 58-67)

- [ ] **Step 3: Add CSS for both components**

Port relevant styles from the old `style.css` into CSS Modules.

- [ ] **Step 4: Commit**

```bash
git add src/components/timeline/
git commit -m "feat: TopBar and TimelineStrip components"
```

---

### Task 8: Timeline page — EventSidebar + EventDetail

**Files:**
- Create: `src/components/timeline/EventSidebar.tsx`
- Create: `src/components/timeline/EventSidebar.module.css`
- Create: `src/components/timeline/EventDetail.tsx`
- Create: `src/components/timeline/EventDetail.module.css`

- [ ] **Step 1: Implement EventSidebar**

Port the collapsible left sidebar with event card list.

Props: `{ events, currentIndex, onGoTo, meta }`

Features:
- Collapsible toggle button
- Event card list (date + title + tag badge)
- Active card highlight + auto-scroll via `useEffect` + `scrollIntoView`
- Phase title/period in header (derived from current event's phase + meta.phases)

- [ ] **Step 2: Implement EventDetail**

Port the right-side detail view.

Props: `{ event, meta, econ }`

Port from `legacy/app.js` `goToEvent()` lines 140-188 and `legacy/index.html` lines 94-113. Structure:
- Date line + tag badge (use `getTagLabel()` from `legacy/app.js`)
- Title (h2) + description (p) + detail bullets (ul)
- Source links row
- Stats grid: `meta.statsFields.map(f => <div><span style={{color: f.color}}>{event.metrics[f.key]}</span><span>{f.label}</span></div>)`
- Entry animation: toggle CSS class `animIn` on event change using `useEffect` + `key={event.id}`
- For econ KPIs (like oil price), use helper: `getNearestEconData(event.date, econ)` — find last econ entry with `date <= event.date`

- [ ] **Step 3: Commit**

```bash
git add src/components/timeline/
git commit -m "feat: EventSidebar and EventDetail components"
```

---

### Task 9: Timeline page — EconPanel (Canvas chart)

**Files:**
- Create: `src/components/timeline/EconPanel.tsx`
- Create: `src/components/timeline/EconPanel.module.css`
- Create: `src/lib/drawChart.ts`

- [ ] **Step 1: Extract chart drawing logic**

Port `drawChart()` from `app.js` to a pure function in `src/lib/drawChart.ts`.

Signature:
```ts
export function drawChart(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  datasets: { key: string; label: string; color: string; dash?: number[]; lineWidth?: number }[],
  data: EconDataPoint[],
  hoverIndex?: number,
  warStartDate?: string,
): void;
```

Same Canvas rendering logic, but parameterized by `datasets` (from `meta.metricDefs`) instead of hardcoded config.

- [ ] **Step 2: Implement EconPanel component**

`src/components/timeline/EconPanel.tsx` — port from `legacy/app.js` lines 296-528.

Props: `{ meta, econ, currentDate }`

Structure:
1. Filter econ data: `econ.filter(d => d.date <= currentDate)` (min 2 points)
2. Build datasets from `meta.metricDefs.filter(d => d.showOnDetail)`
3. Canvas ref — resize on mount and on window resize (debounced 150ms)
4. Call `drawChart()` from `src/lib/drawChart.ts`
5. Mouse interaction (port from `setupChartInteraction()` in `legacy/app.js` lines 343-397):
   - `onMouseMove`: find nearest column index, build tooltip HTML with actual values + pctChange, position tooltip div
   - `onMouseLeave`: hide tooltip, redraw without hover
6. KPI row: for each metricDef, show `pctChange(current, baseline)` with color coding
7. Legend: line style indicator + label per dataset

Helper function (create in `src/lib/utils.ts`):
```ts
export function getNearestEconData(date: string, econ: EconDataPoint[]): EconDataPoint | null {
  for (let i = econ.length - 1; i >= 0; i--) {
    if (econ[i].date <= date) return econ[i];
  }
  return econ[0] ?? null;
}

export function pctChange(current: number, base: number): string {
  const pct = ((current - base) / base * 100).toFixed(1);
  return `${+pct > 0 ? '+' : ''}${pct}%`;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/timeline/ src/lib/
git commit -m "feat: EconPanel with Canvas chart"
```

---

### Task 10: Assemble TimelinePage

**Files:**
- Modify: `src/pages/TimelinePage.tsx`
- Create: `src/pages/TimelinePage.module.css`

- [ ] **Step 1: Wire all timeline components together**

`src/pages/TimelinePage.tsx`:
```tsx
import { useParams, useSearchParams } from 'react-router-dom';
import { useTopicData, useEventNavigation, useKeyboardNav } from '../hooks';
import { TopBar } from '../components/timeline/TopBar';
import { TimelineStrip } from '../components/timeline/TimelineStrip';
import { EventSidebar } from '../components/timeline/EventSidebar';
import { EventDetail } from '../components/timeline/EventDetail';
import { EconPanel } from '../components/timeline/EconPanel';
import styles from './TimelinePage.module.css';

export function TimelinePage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { meta, events, econ, loading, error } = useTopicData(slug!);
  const nav = useEventNavigation(events);
  useKeyboardNav(nav);

  // Sync URL query param
  const eventParam = searchParams.get('event');
  // ... handle ?event=N deep link

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (error || !meta || !nav.currentEvent) return <div>Error</div>;

  return (
    <div className={styles.page}>
      <TopBar meta={meta} event={nav.currentEvent} econ={econ} />
      <TimelineStrip
        meta={meta} events={events}
        currentIndex={nav.currentIndex}
        onGoTo={nav.goTo}
        isPlaying={nav.isPlaying}
        onTogglePlay={nav.togglePlay}
        onPrev={() => { nav.stopPlay(); nav.prev(); }}
        onNext={() => { nav.stopPlay(); nav.next(); }}
      />
      <main className={styles.main}>
        <EventSidebar events={events} currentIndex={nav.currentIndex} onGoTo={nav.goTo} meta={meta} />
        <section className={styles.detail}>
          <EventDetail event={nav.currentEvent} meta={meta} econ={econ} />
          <EconPanel meta={meta} econ={econ} currentDate={nav.currentEvent.date} />
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Add layout CSS**

Port the main layout from old `style.css` (flex layout, sidebar width, scroll behavior).

- [ ] **Step 3: Verify full flow**

```bash
npm run dev
```
1. Dashboard shows topic card
2. Click card → navigates to timeline
3. Event sidebar shows cards, clicking changes detail
4. Chart renders with hover tooltips
5. Keyboard arrows navigate events
6. Back button returns to dashboard

- [ ] **Step 4: Commit**

```bash
git add src/pages/ src/components/
git commit -m "feat: complete timeline page with all components"
```

---

## Chunk 4: CLI Data Collection Pipeline

### Task 11: Modular CLI — crawler architecture

**Files:**
- Create: `cli/collect.mjs`
- Create: `cli/crawlers/yahoo.mjs`
- Create: `cli/crawlers/coingecko.mjs`
- Create: `cli/crawlers/naver.mjs`
- Create: `cli/crawlers/custom.mjs`
- Create: `cli/crawlers/index.mjs`

- [ ] **Step 1: Create crawler modules**

Each module exports a single `fetch(config)` function that returns `Promise<number | null>`.

`cli/crawlers/yahoo.mjs` — port `yahooQuote()` from current `collect.mjs`:
```js
export async function fetch(config) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(config.symbol)}?range=1d&interval=1d`;
  try {
    const res = await globalThis.fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch { return null; }
}
```

`cli/crawlers/coingecko.mjs` — port `fetchBitcoin()`:
```js
export async function fetch(config) {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${config.id}&vs_currencies=usd`;
    const res = await globalThis.fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    return data[config.id]?.usd ?? null;
  } catch { return null; }
}
```

`cli/crawlers/naver.mjs` — placeholder for Korean market data:
```js
export async function fetch(config) {
  // TODO: implement Naver Finance crawler
  console.warn(`  [Naver] ${config.code} — not yet implemented, skipping`);
  return null;
}
```

`cli/crawlers/custom.mjs` — extensible placeholder:
```js
export async function fetch(config) {
  console.warn(`  [Custom] ${config.key} — custom crawler not configured, skipping`);
  return null;
}
```

`cli/crawlers/index.mjs`:
```js
import * as yahoo from './yahoo.mjs';
import * as coingecko from './coingecko.mjs';
import * as naver from './naver.mjs';
import * as custom from './custom.mjs';

const crawlers = { yahoo, coingecko, naver, custom };

export function getCrawler(type) {
  return crawlers[type] ?? null;
}
```

- [ ] **Step 2: Create main CLI**

`cli/collect.mjs` — reads `meta.json`, dispatches to crawlers, writes to `econ.json`:

```js
#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCrawler } from './crawlers/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'public', 'data');

// Parse args
const args = process.argv.slice(2);
const slug = args.find(a => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const doEcon = args.includes('--econ');
const doSuggest = args.includes('--suggest');
const dateIdx = args.indexOf('--date');
const targetDate = (dateIdx >= 0 && args[dateIdx + 1]) ? args[dateIdx + 1] : new Date().toISOString().slice(0, 10);

if (!slug) { console.error('Usage: node collect.mjs <topic-slug> [--econ] [--suggest] [--dry-run]'); process.exit(1); }

async function main() {
  const topicDir = path.join(DATA_DIR, 'topics', slug);
  const meta = JSON.parse(fs.readFileSync(path.join(topicDir, 'meta.json'), 'utf8'));

  if (doEcon) await collectEcon(meta, topicDir);
  if (doSuggest) await suggestEvents(meta, topicDir);
  if (!doEcon && !doSuggest) { console.log('Specify --econ and/or --suggest'); }
}

async function collectEcon(meta, topicDir) {
  console.log(`\n수집: ${slug} (${targetDate})`);
  console.log('─'.repeat(40));

  const results = {};
  await Promise.all(meta.collectors.map(async (cfg) => {
    const crawler = getCrawler(cfg.type);
    if (!crawler) { console.warn(`  Unknown crawler type: ${cfg.type}`); return; }
    let val = await crawler.fetch(cfg);

    // Apply transform
    if (val !== null && cfg.transform === 'round') val = Math.round(val);
    else if (val !== null && cfg.transform === 'round2') val = Math.round(val * 100) / 100;
    else if (val !== null) val = Math.round(val); // default: round

    results[cfg.key] = val;
    console.log(`  ${cfg.key}: ${val}`);
  }));

  console.log('─'.repeat(40));

  const entry = { date: targetDate, ...results };
  const missing = Object.entries(entry).filter(([k, v]) => v === null).map(([k]) => k);

  console.log(JSON.stringify(entry, null, 2));

  if (missing.length > 0) {
    console.log(`\n수동 입력 필요: ${missing.join(', ')}`);
  }

  if (dryRun) return;
  // Write even with some nulls — mark them for manual fill
  // Replace nulls with "??" string for manual input
  for (const [k, v] of Object.entries(entry)) {
    if (v === null) entry[k] = '??';
  }

  // Append to econ.json
  const econPath = path.join(topicDir, 'econ.json');
  const econ = JSON.parse(fs.readFileSync(econPath, 'utf8'));
  if (econ.some(d => d.date === targetDate)) {
    console.log(`\n이미 ${targetDate} 데이터 존재. 건너뜁니다.`);
    return;
  }
  econ.push(entry);
  fs.writeFileSync(econPath, JSON.stringify(econ, null, 2) + '\n');

  // Update index.json updatedAt
  const indexPath = path.join(DATA_DIR, 'index.json');
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const topic = index.topics.find(t => t.slug === slug);
  if (topic) { topic.updatedAt = targetDate; fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n'); }

  console.log(`\necon.json에 ${targetDate} 추가 완료`);
}

async function suggestEvents(meta, topicDir) {
  // Lazy import suggest module
  const { suggest } = await import('./suggest.mjs');
  await suggest(meta, topicDir, targetDate);
}

main().catch(e => { console.error(e.message); process.exit(1); });
```

- [ ] **Step 3: Test econ collection**

```bash
node cli/collect.mjs us-iran-war --econ --dry-run
```
Expected: Prints collected values for all configured collectors. No file modifications.

- [ ] **Step 4: Commit**

```bash
git add cli/
git commit -m "feat: modular CLI with crawler architecture"
```

---

### Task 12: Event suggestion engine

**Files:**
- Create: `cli/suggest.mjs`

- [ ] **Step 1: Implement RSS-based event suggestion**

`cli/suggest.mjs`:
```js
import fs from 'fs';
import path from 'path';

export async function suggest(meta, topicDir, targetDate) {
  const eventsPath = path.join(topicDir, 'events.json');
  const events = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
  const existingUrls = new Set(events.flatMap(e => e.sources.map(s => s.url)));
  const existingDates = new Set(events.map(e => e.date));

  console.log(`\n이벤트 제안: ${meta.slug} (${targetDate})`);
  console.log('━'.repeat(40));

  let candidates = [];

  for (const source of meta.newsSources) {
    try {
      if (source.type === 'rss') {
        const items = await fetchRSS(source.url);
        candidates.push(...items.map(item => ({ ...item, sourceName: source.name })));
      }
    } catch (e) {
      console.warn(`  [${source.name}] 수집 실패: ${e.message}`);
    }
  }

  // Filter duplicates
  candidates = candidates.filter(c => {
    if (existingUrls.has(c.url)) return false;
    return true;
  });

  // Show top candidates
  if (candidates.length === 0) {
    console.log('\n새로운 이벤트 후보 없음');
    return;
  }

  console.log(`\n━━━ 이벤트 후보 ${Math.min(candidates.length, 10)}건 ━━━\n`);
  candidates.slice(0, 10).forEach((c, i) => {
    console.log(`[${i + 1}] ${c.date || targetDate} — ${c.title}`);
    console.log(`    Source: ${c.sourceName}`);
    console.log(`    URL: ${c.url}`);
    console.log('');
  });
  console.log('→ 추가하려면 events.json에 직접 작성하세요');
}

async function fetchRSS(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`${res.status}`);
  const text = await res.text();

  // Simple XML parsing for RSS items
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(text)) !== null) {
    const content = match[1];
    const title = content.match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/)?.[1] || content.match(/<title>(.*?)<\/title>/)?.[1] || '';
    const link = content.match(/<link>(.*?)<\/link>/)?.[1] || '';
    const pubDate = content.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
    const date = pubDate ? new Date(pubDate).toISOString().slice(0, 10) : '';
    items.push({ title: title.trim(), url: link.trim(), date });
  }
  return items;
}
```

- [ ] **Step 2: Test event suggestion**

```bash
node cli/collect.mjs us-iran-war --suggest
```
Expected: Prints candidate events from configured RSS sources with titles and URLs.

- [ ] **Step 3: Commit**

```bash
git add cli/suggest.mjs
git commit -m "feat: event suggestion engine via RSS crawling"
```

---

## Chunk 5: Polish + Final Integration

### Task 13: Global styles + responsive

**Files:**
- Create: `src/index.css`
- Modify: `src/main.tsx`

- [ ] **Step 1: Port global styles**

Create `src/index.css` with CSS reset, CSS variables (from old `:root`), and font imports. This replaces the old monolithic `style.css`.

- [ ] **Step 2: Responsive breakpoints**

Add media queries to Dashboard and Timeline CSS Modules for mobile (stack to 1 column, sidebar collapses).

- [ ] **Step 3: Commit**

```bash
git add src/index.css src/main.tsx
git commit -m "feat: global styles and responsive layout"
```

---

### Task 14: URL deep-link sync + production build

**Files:**
- Modify: `src/pages/TimelinePage.tsx`
- Modify: `vite.config.ts`

- [ ] **Step 1: Sync event index with URL query parameter**

In `TimelinePage.tsx`, add effect to:
- On mount: read `?event=N` and call `nav.goTo(N-1)` (events are 1-indexed in URL)
- On event change: update `?event=N` in URL without navigation

- [ ] **Step 2: Configure Vite for SPA fallback**

In `vite.config.ts`, ensure history API fallback works for client-side routing.

- [ ] **Step 3: Test production build**

```bash
npm run build
npm run preview
```
Expected: Production build succeeds. Preview serves correctly. Navigate directly to `/topic/us-iran-war?event=5` — shows correct event.

- [ ] **Step 4: Commit**

```bash
git add src/pages/TimelinePage.tsx vite.config.ts
git commit -m "feat: URL deep-link sync and production build"
```

---

### Task 15: Copy old project files + cleanup

- [ ] **Step 1: Move old vanilla JS files to `legacy/` for reference**

```bash
mkdir -p legacy
cp /Users/kwanung/development/experiments/war-history/{app.js,data.js,style.css,index.html,collect.mjs} legacy/
```

- [ ] **Step 2: Add .gitignore entries**

Ensure `.superpowers/`, `node_modules/`, `dist/` are in `.gitignore`.

- [ ] **Step 3: Update DATA_SOURCES.md**

Update paths to point to new JSON file locations (`public/data/topics/...`) and new CLI path (`cli/collect.mjs`).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: cleanup and documentation update"
```

---

## Dependency Graph

```
Task 1 (Scaffold) ──→ Task 2 (Types) ──→ Task 3 (Data Migration) ──→ Task 4 (Hooks)
                                                                          │
                                              ┌───────────────────────────┤
                                              ↓                           ↓
                                    Task 5 (Dashboard)         Task 11 (CLI Crawlers)
                                              ↓                           ↓
                                    Task 6 (Nav Hooks)         Task 12 (Suggest)
                                              ↓
                                    Task 7 (TopBar+Strip)
                                              ↓
                                    Task 8 (Sidebar+Detail)
                                              ↓
                                    Task 9 (EconPanel)
                                              ↓
                                    Task 10 (Assemble)
                                              ↓
                                    Task 13 (Styles)
                                              ↓
                                    Task 14 (Deep-link)
                                              ↓
                                    Task 15 (Cleanup)
```

**Parallelizable:** After Task 4, the Dashboard (Task 5) and CLI (Tasks 11-12) can run in parallel with Timeline (Tasks 6-10).
