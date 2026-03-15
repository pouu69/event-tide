import { useState, useEffect } from 'react';
import type { TopicSummary } from '../types';

export function useTopicIndex() {
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetch('/data/index.json')
      .then(res => { if (!res.ok) throw new Error(`${res.status}`); return res.json(); })
      .then(data => { setTopics(data.topics); setLoading(false); })
      .catch(err => { setError(err); setLoading(false); });
  }, []);

  return { topics, loading, error };
}
