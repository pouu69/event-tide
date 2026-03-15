import { useTopicIndex } from '../hooks';
import TopicCard from '../components/dashboard/TopicCard';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { topics, loading, error } = useTopicIndex();

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (error) {
    return <div className={styles.error}>Failed to load topics.</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>WORLD CHRONICLE</h1>
        <p className={styles.subtitle}>글로벌 이슈 트래커</p>
      </header>
      <div className={styles.grid}>
        {topics.map((topic) => (
          <TopicCard key={topic.slug} topic={topic} />
        ))}
      </div>
    </div>
  );
}
