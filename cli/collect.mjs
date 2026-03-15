#!/usr/bin/env node

/**
 * CLI data collection pipeline
 *
 * Usage:
 *   node cli/collect.mjs <topic-slug> [--econ] [--suggest] [--dry-run] [--date YYYY-MM-DD]
 *
 * Examples:
 *   node cli/collect.mjs us-iran-war --econ --dry-run
 *   node cli/collect.mjs us-iran-war --econ --date 2026-03-16
 *   node cli/collect.mjs us-iran-war --suggest
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCrawler } from './crawlers/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'public', 'data');

// === ARGS ===
const args = process.argv.slice(2);
const slug = args.find(a => !a.startsWith('--'));

if (!slug) {
  console.error('Usage: node cli/collect.mjs <topic-slug> [--econ] [--suggest] [--dry-run] [--date YYYY-MM-DD]');
  process.exit(1);
}

const dryRun = args.includes('--dry-run');
const doEcon = args.includes('--econ');
const doSuggest = args.includes('--suggest');
const dateIdx = args.indexOf('--date');
const targetDate = dateIdx !== -1 && args[dateIdx + 1]
  ? args[dateIdx + 1]
  : new Date().toISOString().slice(0, 10);

const TOPIC_DIR = path.join(DATA_DIR, 'topics', slug);
const META_FILE = path.join(TOPIC_DIR, 'meta.json');
const ECON_FILE = path.join(TOPIC_DIR, 'econ.json');
const INDEX_FILE = path.join(DATA_DIR, 'index.json');

// === TRANSFORMS ===
const transforms = {
  round:  (v) => v !== null ? Math.round(v) : null,
  round2: (v) => v !== null ? Math.round(v * 100) / 100 : null,
};

// === ECON COLLECTION ===
async function collectEcon() {
  if (!fs.existsSync(META_FILE)) {
    console.error(`meta.json not found: ${META_FILE}`);
    process.exit(1);
  }

  const meta = JSON.parse(fs.readFileSync(META_FILE, 'utf-8'));
  const collectors = meta.collectors || [];

  if (collectors.length === 0) {
    console.error('No collectors defined in meta.json');
    process.exit(1);
  }

  console.log(`\n수집 날짜: ${targetDate}  (topic: ${slug})`);
  console.log('─'.repeat(50));

  const entry = { date: targetDate };
  const warnings = [];

  // Collect all in parallel
  const results = await Promise.all(
    collectors.map(async (cfg) => {
      const crawler = getCrawler(cfg.type);
      if (!crawler) {
        console.warn(`  [${cfg.key}] Unknown crawler type: ${cfg.type}`);
        return { key: cfg.key, value: null };
      }

      let raw = await crawler.fetchPrice(cfg);
      const transform = transforms[cfg.transform] || transforms.round;
      const value = transform(raw);

      return { key: cfg.key, value };
    })
  );

  // Apply results
  for (const { key, value } of results) {
    entry[key] = value;
    const display = value !== null ? value : 'null (수집 실패)';
    const marker = value === null ? ' ⚠' : '';
    console.log(`  ${key.padEnd(12)} ${display}${marker}`);
    if (value === null) {
      warnings.push(key);
    }
  }

  console.log('─'.repeat(50));

  if (warnings.length > 0) {
    console.warn(`\n경고: ${warnings.length}개 지표 수집 실패 — ${warnings.join(', ')}`);
    console.warn('null 값은 그대로 기록됩니다.');
  }

  if (dryRun) {
    console.log('\n--dry-run: 파일 수정하지 않음');
    console.log('\n수집 결과 (JSON):');
    console.log(JSON.stringify(entry, null, 2));
    return;
  }

  // Write to econ.json
  let econ = [];
  if (fs.existsSync(ECON_FILE)) {
    econ = JSON.parse(fs.readFileSync(ECON_FILE, 'utf-8'));
  }

  // Check for duplicate date
  const existing = econ.findIndex(e => e.date === targetDate);
  if (existing !== -1) {
    console.log(`\n${targetDate} 데이터가 이미 존재합니다. 업데이트합니다.`);
    econ[existing] = entry;
  } else {
    econ.push(entry);
    // Sort by date
    econ.sort((a, b) => a.date.localeCompare(b.date));
  }

  fs.writeFileSync(ECON_FILE, JSON.stringify(econ, null, 2) + '\n');
  console.log(`\necon.json 업데이트 완료 (${econ.length}건)`);

  // Update index.json updatedAt
  if (fs.existsSync(INDEX_FILE)) {
    const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
    const topic = index.topics?.find(t => t.slug === slug);
    if (topic) {
      topic.updatedAt = targetDate;
      fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2) + '\n');
      console.log(`index.json updatedAt → ${targetDate}`);
    }
  }
}

// === MAIN ===
async function main() {
  if (!doEcon && !doSuggest) {
    console.error('하나 이상의 모드를 지정하세요: --econ, --suggest');
    process.exit(1);
  }

  if (doEcon) {
    await collectEcon();
  }

  if (doSuggest) {
    const { suggest } = await import('./suggest.mjs');
    await suggest(slug, TOPIC_DIR);
  }
}

main().catch(e => {
  console.error('오류:', e.message);
  process.exit(1);
});
