import { useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTopicData, useEventNavigation, useKeyboardNav } from '../hooks';
import TopBar from '../components/timeline/TopBar';
import TimelineStrip from '../components/timeline/TimelineStrip';
import EventSidebar from '../components/timeline/EventSidebar';
import EventDetail from '../components/timeline/EventDetail';
import EconPanel from '../components/timeline/EconPanel';
import InvestSimPanel from '../components/timeline/InvestSimPanel';
import s from './TimelinePage.module.css';

export default function TimelinePage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { meta, events, econ, loading, error } = useTopicData(slug!);
  const {
    currentIndex, currentEvent, goTo, next, prev, isPlaying, togglePlay, stopPlay,
  } = useEventNavigation(events);

  useKeyboardNav({ next, prev, togglePlay, stopPlay });

  const fromUrl = useRef(false);

  // Deep link: read ?event=N on mount (1-indexed in URL)
  useEffect(() => {
    const eventParam = searchParams.get('event');
    if (eventParam != null && events.length > 0) {
      const idx = parseInt(eventParam, 10) - 1; // URL is 1-indexed
      if (!isNaN(idx) && idx >= 0 && idx < events.length) {
        fromUrl.current = true;
        goTo(idx);
      }
    }
    // Only run on initial load / events change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.length]);

  // Sync URL on navigation (1-indexed in URL)
  useEffect(() => {
    if (events.length === 0) return;
    if (fromUrl.current) {
      fromUrl.current = false;
      return;
    }
    setSearchParams({ event: String(currentIndex + 1) }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, events.length]);

  if (loading) {
    return (
      <div className={s.loader}>
        <div className={s.loaderInner}>
          <div className={s.loaderBar} />
          <span>LOADING</span>
        </div>
      </div>
    );
  }

  if (error || !meta || !currentEvent) {
    return (
      <div className={s.loader}>
        <p>{error?.message || 'Failed to load topic data'}</p>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <TopBar meta={meta} event={currentEvent} econ={econ} />
      <TimelineStrip
        meta={meta}
        events={events}
        currentIndex={currentIndex}
        onGoTo={goTo}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        onPrev={() => { stopPlay(); prev(); }}
        onNext={() => { stopPlay(); next(); }}
      />
      <div className={s.main}>
        <EventSidebar events={events} currentIndex={currentIndex} onGoTo={goTo} meta={meta} />
        <div className={s.detailView}>
          <EventDetail event={currentEvent} meta={meta} econ={econ} events={events} currentIndex={currentIndex} />
          <EconPanel meta={meta} econ={econ} currentDate={currentEvent.date} events={events} />
          <InvestSimPanel meta={meta} econ={econ} currentDate={currentEvent.date} />
        </div>
      </div>
    </div>
  );
}
