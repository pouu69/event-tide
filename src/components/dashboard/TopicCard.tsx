import { useNavigate } from 'react-router-dom';
import { useTopicData } from '../../hooks';
import type { TopicSummary } from '../../types';
import StatusBadge from '../common/StatusBadge';
import SparklineChart from '../common/SparklineChart';
import styles from './TopicCard.module.css';

interface TopicCardProps {
  topic: TopicSummary;
}

export default function TopicCard({ topic }: TopicCardProps) {
  const navigate = useNavigate();
  const { meta, events, econ, loading } = useTopicData(topic.slug);

  if (loading || !meta) {
    return <div className={styles.loading}>Loading...</div>;
  }

  // Resolve KPI values
  const kpiValues = meta.kpis.slice(0, 4).map((kpi) => {
    let value: number | undefined;
    if (kpi.source === 'econ' && econ.length > 0) {
      const lastEcon = econ[econ.length - 1];
      const raw = lastEcon[kpi.key];
      value = typeof raw === 'number' ? raw : undefined;
    } else if (kpi.source === 'stats' && events.length > 0) {
      const lastEvent = events[events.length - 1];
      value = lastEvent.metrics[kpi.key];
    }
    return { label: kpi.label, unit: kpi.unit, value };
  });

  // Find first metricDef with showOnDashboard=true
  const dashboardMetric = meta.metricDefs.find((m) => m.showOnDashboard);
  let sparkData: number[] = [];
  let sparkColor = '#888';
  if (dashboardMetric && econ.length > 0) {
    sparkColor = dashboardMetric.chartColor;
    sparkData = econ
      .map((e) => {
        const v = e[dashboardMetric.key];
        return typeof v === 'number' ? v : NaN;
      })
      .filter((v) => !isNaN(v));
  }

  const formatValue = (val: number | undefined, unit: string) => {
    if (val === undefined) return '-';
    return `${val.toLocaleString()}${unit ? ` ${unit}` : ''}`;
  };

  return (
    <div
      className={styles.card}
      onClick={() => navigate(`/topic/${topic.slug}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate(`/topic/${topic.slug}`);
      }}
    >
      <div className={styles.header}>
        <StatusBadge status={topic.status} />
      </div>
      <div className={styles.title}>{meta.title}</div>
      <div className={styles.kpis}>
        {kpiValues.map((kpi) => (
          <div key={kpi.label} className={styles.kpi}>
            <span className={styles.kpiLabel}>{kpi.label}</span>
            <span className={styles.kpiValue}>
              {formatValue(kpi.value, kpi.unit)}
            </span>
          </div>
        ))}
      </div>
      {sparkData.length >= 2 && (
        <div className={styles.sparkline}>
          <SparklineChart data={sparkData} color={sparkColor} width={280} height={40} />
        </div>
      )}
    </div>
  );
}
