#!/usr/bin/env node

/**
 * 경제 지표 수집 스크립트
 *
 * 사용법:
 *   node collect.mjs              # 오늘 날짜 기준 수집
 *   node collect.mjs 2026-03-16   # 특정 날짜 지정
 *   node collect.mjs --dry-run    # 수집만 하고 파일 수정 안 함
 *
 * 수집 소스 (무료 API):
 *   - Yahoo Finance: S&P500, KOSPI, USD/KRW, 금, 방산 ETF(ITA)
 *   - CoinGecko: 비트코인
 *   - EIA: 브렌트유, 미국 휘발유
 *   - Trading Economics 대체: LNG (fallback 수동 입력)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data.js');

// === CONFIG ===
const YAHOO_SYMBOLS = {
  sp500:  '^GSPC',
  kospi:  '^KS11',
  usdkrw: 'KRW=X',
  gold:   'GC=F',
  ita:    'ITA',       // 방산 ETF (defense 지수 산출용)
};

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd';

// === ARGS ===
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const dateArg = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
const targetDate = dateArg || new Date().toISOString().slice(0, 10);

// === FETCH HELPERS ===
async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (war-history-collector)' }
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.json();
}

async function yahooQuote(symbol) {
  // Yahoo Finance v8 API (공개)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
  try {
    const data = await fetchJSON(url);
    const result = data.chart?.result?.[0];
    if (!result) return null;
    const close = result.meta?.regularMarketPrice;
    return close ?? null;
  } catch (e) {
    console.error(`  [Yahoo] ${symbol} 실패: ${e.message}`);
    return null;
  }
}

async function fetchBitcoin() {
  try {
    const data = await fetchJSON(COINGECKO_URL);
    return data.bitcoin?.usd ?? null;
  } catch (e) {
    console.error(`  [CoinGecko] 실패: ${e.message}`);
    return null;
  }
}

async function fetchOilPrice() {
  // Yahoo Finance 브렌트유 선물
  try {
    return await yahooQuote('BZ=F');
  } catch (e) {
    console.error(`  [Oil] 실패: ${e.message}`);
    return null;
  }
}

async function fetchGasPrice() {
  // Yahoo Finance 가솔린 선물 (근사치)
  try {
    const raw = await yahooQuote('RB=F');
    // 선물은 갤런당 달러이므로 그대로 사용
    return raw ? Math.round(raw * 100) / 100 : null;
  } catch (e) {
    console.error(`  [Gas] 실패: ${e.message}`);
    return null;
  }
}

// === 방산지수 산출 ===
function calcDefense(itaPrice, baselineIta) {
  if (!itaPrice || !baselineIta) return null;
  return Math.round(100 * (itaPrice / baselineIta));
}

// === 수집 ===
async function collectAll() {
  console.log(`\n수집 날짜: ${targetDate}`);
  console.log('─'.repeat(40));

  // 병렬 수집
  const [sp500, kospi, usdkrw, gold, ita, bitcoin, oil, gas] = await Promise.all([
    yahooQuote(YAHOO_SYMBOLS.sp500).then(v  => { console.log(`  S&P 500:    ${v}`); return v; }),
    yahooQuote(YAHOO_SYMBOLS.kospi).then(v  => { console.log(`  KOSPI:      ${v}`); return v; }),
    yahooQuote(YAHOO_SYMBOLS.usdkrw).then(v => { console.log(`  USD/KRW:    ${v}`); return v; }),
    yahooQuote(YAHOO_SYMBOLS.gold).then(v   => { console.log(`  금:         ${v}`); return v; }),
    yahooQuote(YAHOO_SYMBOLS.ita).then(v    => { console.log(`  ITA(방산):  ${v}`); return v; }),
    fetchBitcoin().then(v                   => { console.log(`  비트코인:   ${v}`); return v; }),
    fetchOilPrice().then(v                  => { console.log(`  브렌트유:   ${v}`); return v; }),
    fetchGasPrice().then(v                  => { console.log(`  휘발유:     ${v}`); return v; }),
  ]);

  console.log('─'.repeat(40));

  // ITA 기준 방산지수 산출: 2026-02-27 기준 ITA 종가
  // data.js의 ECON_TIMELINE 첫 행에서 defense=100일 때의 ITA 가격
  // 최초 실행 시 아래 값을 당시 ITA 종가로 설정하세요
  const BASELINE_ITA = 179.0;
  const defense = calcDefense(ita, BASELINE_ITA);
  console.log(`  방산지수:   ${defense} (ITA: ${ita} / baseline: ${BASELINE_ITA})`);

  // LNG: Yahoo Finance TTF 선물 시도
  let lng_eu = null;
  try {
    lng_eu = await yahooQuote('TTF=F');
    if (!lng_eu) lng_eu = await yahooQuote('NG=F'); // 천연가스 대체
    console.log(`  LNG(EU):    ${lng_eu}`);
  } catch (e) {
    console.log(`  LNG(EU):    수집 실패`);
  }

  const entry = {
    date: targetDate,
    oil:     oil     !== null ? Math.round(oil) : '??',
    sp500:   sp500   !== null ? Math.round(sp500) : '??',
    kospi:   kospi   !== null ? Math.round(kospi) : '??',
    usdkrw:  usdkrw  !== null ? Math.round(usdkrw) : '??',
    gold:    gold    !== null ? Math.round(gold) : '??',
    bitcoin: bitcoin !== null ? Math.round(bitcoin) : '??',
    gas:     gas     !== null ? Math.round(gas * 100) / 100 : '??',
    lng_eu:  lng_eu  !== null ? Math.round(lng_eu) : '??',
    defense: defense !== null ? defense : '??',
  };

  return entry;
}

// === data.js에 ECON_TIMELINE 행 추가 ===
function appendEconEntry(entry) {
  const content = fs.readFileSync(DATA_FILE, 'utf-8');

  // 중복 확인
  if (content.includes(`"${entry.date}"`)) {
    console.log(`\n이미 ${entry.date} 데이터가 존재합니다. 건너뜁니다.`);
    return false;
  }

  // ECON_TIMELINE 마지막 행 뒤에 삽입
  const line = `  { date: "${entry.date}", oil: ${entry.oil}, sp500: ${entry.sp500}, kospi: ${entry.kospi}, usdkrw: ${entry.usdkrw}, gold: ${entry.gold}, bitcoin: ${entry.bitcoin}, gas: ${entry.gas}, lng_eu: ${entry.lng_eu}, defense: ${entry.defense} }`;

  // 마지막 ECON_TIMELINE 데이터 행 찾기
  const pattern = /(  \{ date: "\d{4}-\d{2}-\d{2}".*defense: \d+.*\})\n\];/;
  const match = content.match(pattern);
  if (!match) {
    console.error('\ndata.js에서 ECON_TIMELINE 마지막 행을 찾을 수 없습니다.');
    return false;
  }

  const updated = content.replace(pattern, `${match[1]},\n${line}\n];`);
  fs.writeFileSync(DATA_FILE, updated);
  return true;
}

// === MAIN ===
async function main() {
  const entry = await collectAll();

  // 결과 출력
  console.log('\n수집 결과:');
  console.log('─'.repeat(40));

  const missing = Object.entries(entry)
    .filter(([k, v]) => v === '??')
    .map(([k]) => k);

  // JS 코드로 출력 (복사-붙여넣기용)
  const jsLine = `  { date: "${entry.date}", oil: ${entry.oil}, sp500: ${entry.sp500}, kospi: ${entry.kospi}, usdkrw: ${entry.usdkrw}, gold: ${entry.gold}, bitcoin: ${entry.bitcoin}, gas: ${entry.gas}, lng_eu: ${entry.lng_eu}, defense: ${entry.defense} }`;
  console.log(jsLine);

  if (missing.length > 0) {
    console.log(`\n수동 입력 필요: ${missing.join(', ')}`);
    console.log('위 값을 채운 후 data.js의 ECON_TIMELINE에 추가하세요.');
    return;
  }

  if (dryRun) {
    console.log('\n--dry-run: 파일 수정하지 않음');
    return;
  }

  // data.js에 자동 추가
  const ok = appendEconEntry(entry);
  if (ok) {
    console.log(`\ndata.js에 ${entry.date} 경제 데이터 추가 완료`);
  }
}

main().catch(e => {
  console.error('오류:', e.message);
  process.exit(1);
});
