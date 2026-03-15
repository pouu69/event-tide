import { useState, useCallback, useRef, useEffect } from 'react';
import type { TopicEvent } from '../types';

export function useEventNavigation(events: TopicEvent[]) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (events.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    let idx = events.length - 1;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].date <= today) { idx = i; break; }
    }
    setCurrentIndex(idx);
  }, [events]);

  const goTo = useCallback((index: number) => {
    if (index >= 0 && index < events.length) setCurrentIndex(index);
  }, [events.length]);
  const next = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);
  const prev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);

  const stopPlay = useCallback(() => {
    setIsPlaying(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);
  const startPlay = useCallback(() => {
    setIsPlaying(true);
    intervalRef.current = setInterval(() => {
      setCurrentIndex(i => { if (i >= events.length - 1) { stopPlay(); return i; } return i + 1; });
    }, 1500);
  }, [events.length, stopPlay]);
  const togglePlay = useCallback(() => { isPlaying ? stopPlay() : startPlay(); }, [isPlaying, stopPlay, startPlay]);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return { currentIndex, currentEvent: events[currentIndex] ?? null, goTo, next, prev, isPlaying, togglePlay, stopPlay };
}
