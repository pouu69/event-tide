import { useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTopicData, useEventNavigation, useKeyboardNav } from '../hooks';
import TopBar from '../components/timeline/TopBar';
import TimelineStrip from '../components/timeline/TimelineStrip';
import EventSidebar from '../components/timeline/EventSidebar';
import InsightCard from '../components/timeline/InsightCard';
import EventDetail from '../components/timeline/EventDetail';
import EconPanel from '../components/timeline/EconPanel';
import VixSignalPanel from '../components/timeline/VixSignalPanel';
import BIPanel from '../components/timeline/BIPanel';
import AnalysisPanel from '../components/timeline/AnalysisPanel';
import CollapsibleSection from '../components/timeline/CollapsibleSection';
import { generateInsight } from '../lib/storytelling';
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
          <CollapsibleSection title="인사이트" defaultOpen>
            <InsightCard insight={generateInsight(
              currentEvent,
              currentIndex > 0 ? events[currentIndex - 1] : null,
              meta, econ, events, currentIndex
            )} />
          </CollapsibleSection>
          <CollapsibleSection title="이벤트 상세" defaultOpen>
            <EventDetail event={currentEvent} meta={meta} econ={econ} events={events} currentIndex={currentIndex} />
          </CollapsibleSection>
          <CollapsibleSection title="경제 지표" defaultOpen>
            <EconPanel meta={meta} econ={econ} currentDate={currentEvent.date} events={events} />
          </CollapsibleSection>
          <CollapsibleSection title="VIX 시그널" defaultOpen={false}>
            <VixSignalPanel econ={econ} currentDate={currentEvent.date} />
          </CollapsibleSection>
          <CollapsibleSection title="애널리스트 브리핑" defaultOpen>
            <BIPanel meta={meta} econ={econ} events={events} currentEvent={currentEvent} currentIndex={currentIndex} />
          </CollapsibleSection>
          <CollapsibleSection title="데이터 분석" defaultOpen={false}>
            <AnalysisPanel meta={meta} econ={econ} events={events} currentEvent={currentEvent} currentIndex={currentIndex} />
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
}
