#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const dataJs = fs.readFileSync(path.join(ROOT, 'legacy', 'data.js'), 'utf8');

// Extract arrays/objects using regex + Function constructor
function extract(varName) {
  const match = dataJs.match(new RegExp(`const ${varName} = (\\[|\\{)`));
  if (!match) throw new Error(`Cannot find ${varName}`);
  const start = match.index + `const ${varName} = `.length;
  let depth = 0, i = start;
  for (; i < dataJs.length; i++) {
    if (dataJs[i] === '{' || dataJs[i] === '[') depth++;
    if (dataJs[i] === '}' || dataJs[i] === ']') { depth--; if (depth === 0) { i++; break; } }
  }
  const code = dataJs.slice(start, i);
  return new Function(`return ${code}`)();
}

const WAR_EVENTS = extract('WAR_EVENTS');
const PHASE_INFO = extract('PHASE_INFO');
const ECON_TIMELINE = extract('ECON_TIMELINE');

// === events.json ===
const events = WAR_EVENTS.map(e => {
  const { stats, ...rest } = e;
  // Remove oil from stats (it's in econ), rename stats->metrics
  const { oil, ...metrics } = stats;
  return { ...rest, metrics };
});

// === econ.json ===
const econ = ECON_TIMELINE;

// === meta.json ===
const phaseColors = {
  prelude: '#c45500', diplomacy: '#2c6fbb', 'war-start': '#c0392b',
  escalation: '#e74c3c', ongoing: '#7b3fa0'
};
const phases = Object.entries(PHASE_INFO).map(([id, info]) => ({
  id, title: info.title, period: info.period, color: phaseColors[id] || '#888'
}));

const meta = {
  slug: 'us-iran-war',
  title: '\uBBF8\uAD6D vs \uC774\uB780 \uC804\uC7C1',
  status: 'ongoing',
  startDate: '2026-02-28',
  baselineDate: '2026-02-27',
  phases,
  kpis: [
    { key: 'casualties', label: '\uC0AC\uC0C1\uC790', unit: '\uBA85', source: 'stats', direction: 'neutral' },
    { key: 'oil', label: '\uC720\uAC00', unit: '$', source: 'econ', direction: 'down-good' },
    { key: 'usDead', label: '\uBBF8\uAD70', unit: '\uBA85', source: 'stats', direction: 'neutral' }
  ],
  statsFields: [
    { key: 'strikes', label: '\uACF5\uC2B5 \uD69F\uC218', color: '#c0392b' },
    { key: 'casualties', label: '\uCD1D \uC0AC\uC0C1\uC790', color: '#c0392b' },
    { key: 'missiles', label: '\uC774\uB780 \uBBF8\uC0AC\uC77C/\uB4DC\uB860', color: '#2c6fbb' },
    { key: 'usDead', label: '\uBBF8\uAD70 \uC0AC\uB9DD', color: '#7b3fa0' },
    { key: 'cost', label: '\uC791\uC804 \uBE44\uC6A9 $B', color: '#27864a' }
  ],
  metricDefs: [
    { key: 'oil', label: '\uC720\uAC00 $', unit: '$', format: 'currency', direction: 'down-good', chartColor: '#e8590c', chartLineWidth: 3, showOnDashboard: true, showOnDetail: true },
    { key: 'sp500', label: 'S&P 500', unit: 'pt', format: 'number', direction: 'up-good', chartColor: '#1864ab', chartDash: [8,4], showOnDashboard: false, showOnDetail: true },
    { key: 'kospi', label: 'KOSPI', unit: 'pt', format: 'number', direction: 'up-good', chartColor: '#2b8a3e', chartLineWidth: 2.5, showOnDashboard: false, showOnDetail: true },
    { key: 'gold', label: '\uAE08 $', unit: '$', format: 'currency', direction: 'neutral', chartColor: '#e8b006', chartDash: [3,3], showOnDashboard: false, showOnDetail: true },
    { key: 'bitcoin', label: '\uBE44\uD2B8\uCF54\uC778 $', unit: '$', format: 'currency', direction: 'neutral', chartColor: '#f06595', chartLineWidth: 2, showOnDashboard: false, showOnDetail: true },
    { key: 'usdkrw', label: '\uC6D0/\uB2EC\uB7EC', unit: '\u20A9', format: 'number', direction: 'down-good', chartColor: '#7048e8', chartDash: [12,4], showOnDashboard: false, showOnDetail: true }
  ],
  collectors: [
    { key: 'oil', type: 'yahoo', symbol: 'BZ=F', transform: 'round' },
    { key: 'sp500', type: 'yahoo', symbol: '^GSPC', transform: 'round' },
    { key: 'kospi', type: 'yahoo', symbol: '^KS11', transform: 'round' },
    { key: 'usdkrw', type: 'yahoo', symbol: 'KRW=X', transform: 'round' },
    { key: 'gold', type: 'yahoo', symbol: 'GC=F', transform: 'round' },
    { key: 'bitcoin', type: 'coingecko', id: 'bitcoin', transform: 'round' },
    { key: 'gas', type: 'yahoo', symbol: 'RB=F', transform: 'round2' },
    { key: 'lng_eu', type: 'yahoo', symbol: 'TTF=F', transform: 'round' },
    { key: 'defense', type: 'yahoo', symbol: 'ITA', transform: 'round' }
  ],
  newsSources: [
    { name: 'Al Jazeera', type: 'rss', url: 'https://www.aljazeera.com/xml/rss/all.xml', language: 'en' },
    { name: 'Reuters', type: 'rss', url: 'https://www.rss.reuters.com/news/world', language: 'en' }
  ]
};

// === index.json ===
const index = {
  topics: [{ slug: 'us-iran-war', title: '\uBBF8\uAD6D vs \uC774\uB780 \uC804\uC7C1', status: 'ongoing', updatedAt: '2026-03-15' }]
};

// Write files
const topicDir = path.join(ROOT, 'public', 'data', 'topics', 'us-iran-war');
fs.mkdirSync(topicDir, { recursive: true });
fs.writeFileSync(path.join(topicDir, 'events.json'), JSON.stringify(events, null, 2) + '\n');
fs.writeFileSync(path.join(topicDir, 'econ.json'), JSON.stringify(econ, null, 2) + '\n');
fs.writeFileSync(path.join(topicDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
fs.writeFileSync(path.join(ROOT, 'public', 'data', 'index.json'), JSON.stringify(index, null, 2) + '\n');

console.log('Migration complete:');
console.log(`  events.json: ${events.length} events`);
console.log(`  econ.json: ${econ.length} data points`);
console.log(`  meta.json: ${phases.length} phases, ${meta.metricDefs.length} metrics`);
console.log(`  index.json: ${index.topics.length} topics`);
