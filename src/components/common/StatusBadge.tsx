import styles from './StatusBadge.module.css';

const statusColors: Record<string, string> = {
  ongoing: '#c0392b',
  developing: '#e67e22',
  monitoring: '#27ae60',
  archived: '#888',
};

const statusLabels: Record<string, string> = {
  ongoing: 'ONGOING',
  developing: 'DEVELOPING',
  monitoring: 'MONITORING',
  archived: 'ARCHIVED',
};

interface StatusBadgeProps {
  status: 'ongoing' | 'developing' | 'monitoring' | 'archived';
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const color = statusColors[status] ?? '#888';
  return (
    <span
      className={styles.badge}
      style={{ backgroundColor: color }}
    >
      {statusLabels[status] ?? status.toUpperCase()}
    </span>
  );
}
