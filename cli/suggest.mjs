#!/usr/bin/env node

/**
 * Event suggestion module
 *
 * Reads meta.newsSources, fetches RSS feeds, parses items,
 * filters duplicates against existing events (by URL),
 * and prints candidates to terminal.
 *
 * Does NOT collect or write events — only suggests.
 */

import fs from 'fs';
import path from 'path';

// Simple RSS parser using regex
function parseRSSItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const title = block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)?.[1]?.trim() || '';
    const link = block.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/s)?.[1]?.trim() || '';
    const pubDate = block.match(/<pubDate>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/pubDate>/s)?.[1]?.trim() || '';

    if (title && link) {
      let date = '';
      if (pubDate) {
        try {
          date = new Date(pubDate).toISOString().slice(0, 10);
        } catch {
          date = pubDate;
        }
      }
      items.push({ title, link, date });
    }
  }

  return items;
}

export async function suggest(slug, topicDir) {
  const metaFile = path.join(topicDir, 'meta.json');
  const eventsFile = path.join(topicDir, 'events.json');

  if (!fs.existsSync(metaFile)) {
    console.error(`meta.json not found: ${metaFile}`);
    return;
  }

  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
  const sources = meta.newsSources || [];

  if (sources.length === 0) {
    console.log('newsSources가 정의되지 않았습니다.');
    return;
  }

  // Load existing event source URLs for dedup
  const existingUrls = new Set();
  if (fs.existsSync(eventsFile)) {
    const events = JSON.parse(fs.readFileSync(eventsFile, 'utf-8'));
    for (const ev of events) {
      if (ev.sources) {
        for (const src of ev.sources) {
          if (src.url) existingUrls.add(src.url);
        }
      }
    }
  }

  console.log(`\n기존 이벤트 소스 URL: ${existingUrls.size}건`);
  console.log('─'.repeat(50));

  const allCandidates = [];

  for (const source of sources) {
    if (source.type !== 'rss') {
      console.warn(`  [${source.name}] type "${source.type}" — RSS만 지원`);
      continue;
    }

    console.log(`  [${source.name}] ${source.url} 가져오는 중...`);

    try {
      const res = await globalThis.fetch(source.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (war-history-collector)' },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        console.warn(`  [${source.name}] HTTP ${res.status} — 건너뜀`);
        continue;
      }

      const xml = await res.text();
      const items = parseRSSItems(xml);

      let newCount = 0;
      for (const item of items) {
        if (!existingUrls.has(item.link)) {
          allCandidates.push({ ...item, sourceName: source.name });
          newCount++;
        }
      }

      console.log(`  [${source.name}] ${items.length}건 파싱, ${newCount}건 신규`);
    } catch (e) {
      console.warn(`  [${source.name}] 실패: ${e.message}`);
    }
  }

  console.log('─'.repeat(50));

  if (allCandidates.length === 0) {
    console.log('\n신규 이벤트 후보가 없습니다.');
    return;
  }

  // Sort by date descending
  allCandidates.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  console.log(`\n${'━'.repeat(3)} 이벤트 후보 ${allCandidates.length}건 ${'━'.repeat(3)}`);

  allCandidates.forEach((item, i) => {
    console.log(`[${i + 1}] ${item.date || '날짜 없음'} — ${item.title}`);
    console.log(`    Source: ${item.sourceName}`);
    console.log(`    URL: ${item.link}`);
  });
}
