import { useState, useEffect } from 'react';
import type { TopicMeta, TopicEvent, EconDataPoint } from '../types';

export function useTopicData(slug: string) {
  const [meta, setMeta] = useState<TopicMeta | null>(null);
  const [events, setEvents] = useState<TopicEvent[]>([]);
  const [econ, setEcon] = useState<EconDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    const base = `/data/topics/${slug}`;
    Promise.all([
      fetch(`${base}/meta.json`).then(r => { if (!r.ok) throw new Error(`meta: ${r.status}`); return r.json(); }),
      fetch(`${base}/events.json`).then(r => { if (!r.ok) throw new Error(`events: ${r.status}`); return r.json(); }),
      fetch(`${base}/econ.json`).then(r => { if (!r.ok) throw new Error(`econ: ${r.status}`); return r.json(); }),
    ])
      .then(([m, e, ec]) => { setMeta(m); setEvents(e); setEcon(ec); setLoading(false); })
      .catch(err => { setError(err); setLoading(false); });
  }, [slug]);

  return { meta, events, econ, loading, error };
}
