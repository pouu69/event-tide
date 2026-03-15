import type { EconDataPoint } from '../types';

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

export function formatDateShort(dateStr: string): string {
  return dateStr.replace(/-/g, '.');
}

export function formatDateLong(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  const months = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[+m]} ${+d}, ${dateStr.slice(0, 4)}`;
}

const TAG_LABELS: Record<string, string> = {
  military:'군사', diplomacy:'외교', political:'정치', civilian:'민간인',
  protest:'시위', nuclear:'핵', crisis:'위기', analysis:'분석', current:'현재'
};
export function getTagLabel(tag: string): string { return TAG_LABELS[tag] || tag; }
