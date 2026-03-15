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

// Data Storytelling types
export interface InsightData {
  headline: string;
  impactScore: number; // 1-10
  top3: { label: string; value: string; context: string }[];
  phaseProgress: number; // 0-1
  phaseColor: string;
  phaseTitle: string;
}

export interface StatWithContext {
  key: string;
  label: string;
  color: string;
  value: string;
  delta: number | null;
  trendData: number[];
  context: string | null;      // e.g. "일평균 362명"
  pctFromBaseline: string | null; // e.g. "개전 대비 +37%"
  severity: number;            // 0-1 severity for background tinting
  isHighlight: boolean;        // largest change → accent border
}

export interface ChartAnnotation {
  dataIndex: number;
  text: string;
  color: string;
}
