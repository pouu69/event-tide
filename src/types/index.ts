export interface TopicSummary {
  slug: string;
  title: string;
  status: 'ongoing' | 'developing' | 'monitoring' | 'archived';
  updatedAt: string;
}
export interface TopicIndex { topics: TopicSummary[]; }
export interface PhaseInfo { id: string; title: string; period: string; color: string; }
export interface KpiConfig { key: string; label: string; unit: string; source: 'econ' | 'stats'; direction: 'up-good' | 'down-good' | 'neutral'; }
export interface StatField { key: string; label: string; color: string; }
export interface MetricDef {
  key: string; label: string; unit: string;
  format: 'number' | 'currency' | 'percent';
  direction: 'up-good' | 'down-good' | 'neutral';
  chartColor: string; chartDash?: number[]; chartLineWidth?: number;
  showOnDashboard: boolean; showOnDetail: boolean;
}
export interface CollectorConfig { key: string; type: 'yahoo' | 'coingecko' | 'naver' | 'custom'; symbol?: string; id?: string; code?: string; transform?: 'round' | 'round2'; }
export interface NewsSource { name: string; type: 'rss' | 'web'; url: string; language: 'en' | 'ko'; }
export interface TopicMeta {
  slug: string; title: string; status: 'ongoing' | 'developing' | 'monitoring' | 'archived';
  startDate: string; baselineDate: string;
  phases: PhaseInfo[]; kpis: KpiConfig[]; statsFields: StatField[];
  metricDefs: MetricDef[]; collectors: CollectorConfig[]; newsSources: NewsSource[];
}
export interface TopicEvent {
  id: number; date: string; phase: string; tag: string; title: string; desc: string;
  details: string[]; sources: { name: string; url: string }[];
  metrics: Record<string, number>;
}
export interface EconDataPoint { date: string; [key: string]: number | string; }
