# Multi-Topic Timeline Platform Design

## Overview

전세계 이슈를 타임라인으로 추적하는 대시보드 플랫폼. 현재 단일 토픽(미국-이란 전쟁) 바닐라 JS 프로젝트를 React + Vite + TypeScript 기반 멀티 토픽 SPA로 확장한다.

## Goals

- 여러 글로벌 이슈를 하나의 플랫폼에서 관리
- 대시보드에서 전체 상황을 한눈에 파악
- 토픽별 타임라인에서 이벤트 + 경제 지표를 상세 탐색
- 정적 JSON으로 데이터를 관리해 별도 서버 없이 운영
- CLI로 경제 데이터 자동 수집 + 이벤트 제안

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | React 19 | 컴포넌트 기반 UI, 생태계 |
| Build | Vite | 빠른 HMR, 간단한 설정 |
| Language | TypeScript | 타입 안전성, 토픽 스키마 검증 |
| Routing | React Router v7 | SPA 라우팅, 쿼리 파라미터 지원 |
| Styling | CSS Modules | 현재 CSS 재사용 가능, 스코프 격리 |
| Charts | Canvas API (직접 구현) | 현재 로직 재사용, 외부 의존성 없음 |
| Data | Static JSON | 빌드 시 번들 또는 런타임 fetch |
| CLI | Node.js (ESM) | 수집 스크립트, collect.mjs 확장 |

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `<Dashboard />` | 토픽 그리드 대시보드 |
| `/topic/:slug` | `<TimelinePage />` | 토픽 타임라인 상세 |
| `/topic/:slug?event=N` | `<TimelinePage />` | 특정 이벤트 딥링크 |
| `*` | `<Dashboard />` | 404 → 대시보드로 리다이렉트 |

## Data Architecture

### Directory Structure

```
public/
  data/
    index.json                    # 토픽 목록
    topics/
      us-iran-war/
        meta.json                 # 토픽 메타데이터 + 수집 설정
        events.json               # 이벤트 배열
        econ.json                 # 경제 지표 배열
      global-energy-crisis/
        meta.json
        events.json
        econ.json
```

`public/data/`에 배치하여 빌드 시 정적 에셋으로 서빙. 런타임에 `fetch`로 로드한다.

### Schema: index.json

```ts
interface TopicIndex {
  topics: TopicSummary[];
}

interface TopicSummary {
  slug: string;           // URL-safe identifier
  title: string;          // "미국 vs 이란 전쟁"
  status: "ongoing" | "developing" | "monitoring" | "archived";
  updatedAt: string;      // ISO date of last data update
}
```

### Schema: meta.json

```ts
interface TopicMeta {
  slug: string;
  title: string;
  status: "ongoing" | "developing" | "monitoring" | "archived";
  startDate: string;
  baselineDate: string;       // 경제 지표 % 변동 기준일
  phases: PhaseInfo[];
  kpis: KpiConfig[];          // 대시보드 카드에 표시할 지표
  statsFields: StatField[];   // 이벤트 통계 필드 정의 (토픽별 커스텀)
  metricDefs: MetricDef[];    // 경제 지표 정의 (표시 + 수집)
  collectors: CollectorConfig[];  // 크롤링 소스 설정
  newsSources: NewsSource[];  // 이벤트 제안용 뉴스 소스
}

interface PhaseInfo {
  id: string;
  title: string;
  period: string;
  color: string;
}

interface KpiConfig {
  key: string;
  label: string;
  unit: string;             // "$", "pt", "명", "%"
  source: "econ" | "stats";
  direction: "up-good" | "down-good" | "neutral";
  // "econ" → econ.json 최신 행의 해당 key 값
  // "stats" → events.json 최신 이벤트의 metrics[key] 값
}

interface StatField {
  key: string;              // "strikes", "casualties", etc.
  label: string;
  color: string;
}

interface MetricDef {
  key: string;              // "oil", "sp500", "gdp_growth"
  label: string;            // "브렌트유", "S&P 500"
  unit: string;             // "$", "pt", "%", "₩"
  format: "number" | "currency" | "percent";
  direction: "up-good" | "down-good" | "neutral";
  chartColor: string;
  chartDash?: number[];     // 점선 패턴 (없으면 실선)
  chartLineWidth?: number;
  showOnDashboard: boolean;
  showOnDetail: boolean;
}

interface CollectorConfig {
  key: string;              // metricDefs의 key와 매칭
  type: "yahoo" | "coingecko" | "naver" | "custom";
  symbol?: string;          // yahoo: "BZ=F", "^GSPC"
  id?: string;              // coingecko: "bitcoin"
  code?: string;            // naver: "KOSPI"
  transform?: string;       // "round" | "round2" (소수점 처리)
}

interface NewsSource {
  name: string;             // "Al Jazeera"
  type: "rss" | "web";
  url: string;              // RSS 피드 URL 또는 뉴스 페이지 URL
  language: "en" | "ko";
}
```

### Schema: events.json

```ts
interface TopicEvent {
  id: number;
  date: string;
  phase: string;
  tag: string;
  title: string;
  desc: string;
  details: string[];
  sources: { name: string; url: string }[];
  metrics: Record<string, number>;  // meta.statsFields의 key 기반
}
```

### Schema: econ.json

```ts
// 배열. 각 항목은 meta.metricDefs의 key를 필드로 가짐
type EconTimeline = EconDataPoint[];

interface EconDataPoint {
  date: string;
  [key: string]: number | string;  // meta.metricDefs 기준
}
```

## Data Collection Pipeline

### Overview

```
node collect.mjs <topic-slug> [options]

Options:
  --econ          경제 지표 수집 (자동, 즉시 econ.json에 추가)
  --suggest       이벤트 후보 제안 (뉴스 크롤링 → 터미널 출력만)
  --dry-run       수집 결과만 출력, 파일 수정 안 함
  --date YYYY-MM-DD   수집 날짜 지정 (기본: 오늘)
```

### 경제 지표 수집 (자동)

```bash
node collect.mjs us-iran-war --econ
```

1. `meta.json`의 `collectors` 배열을 읽는다
2. 각 collector의 `type`에 따라 크롤러 모듈 실행
3. 결과를 `metricDefs` 기준으로 정규화 (반올림, 단위 변환)
4. 중복 날짜 확인 후 `econ.json`에 새 행 추가
5. `index.json`의 `updatedAt` 갱신

### 크롤러 모듈

```
cli/
  collect.mjs                 # 메인 진입점
  crawlers/
    yahoo.mjs                 # Yahoo Finance 차트 엔드포인트
    coingecko.mjs              # CoinGecko 공개 엔드포인트
    naver.mjs                  # 네이버 금융 페이지 크롤링
    custom.mjs                 # 커스텀 크롤러 (확장용)
  suggest.mjs                 # 이벤트 제안 엔진
```

각 크롤러는 동일한 인터페이스를 구현:

```ts
interface Crawler {
  fetch(config: CollectorConfig): Promise<number | null>;
}
```

새 소스가 필요하면 크롤러 파일 하나를 추가하고, meta.json에 `type`을 등록하면 된다.

### 크롤링 안정성

**주말/휴일 처리:**
- 수집 시 대상 시장의 거래일 여부를 체크
- 비거래일이면 직전 거래일 종가를 사용하되 `"carried": true` 플래그 추가
- 크립토(bitcoin)는 24/7이므로 항상 수집

**Yahoo Finance 불안정 대비:**
- v8 엔드포인트 차단 시 `yahoo-finance2` npm 패키지로 전환
- KOSPI, USD/KRW는 네이버 금융 크롤러를 1차 소스로 사용

**LNG 데이터:**
- TTF(유럽)와 NG(미국)는 별개 상품 — fallback으로 대체하지 않음
- TTF 수집 실패 시 `null` 반환, 수동 입력 유도

**변환 규칙:**
- 크롤러는 원시 값을 반환, 변환은 `collectAll()`에서 `CollectorConfig.transform` 기반으로 일괄 적용
- `"round"`: 정수 반올림, `"round2"`: 소수 2자리

### 데이터 정합성 규칙

**이벤트 metrics vs 경제 지표:**
- `events.json`의 `metrics`에 경제 지표(oil 등)를 중복 저장하지 않음
- 이벤트 시점의 경제 지표는 `econ.json`에서 가장 가까운 날짜를 조회 (`getNearestEconData()`)
- `events.json`의 `metrics`에는 전쟁 고유 통계만 저장 (strikes, casualties, missiles 등)

**누적 통계 검증:**
- 수집 스크립트에서 새 이벤트 추가 시 직전 이벤트 대비 monotonic increase 체크
- 감소하면 경고 출력 (의도적 감소인지 확인 유도)

### 이벤트 제안 (반자동)

```bash
node collect.mjs us-iran-war --suggest
```

1. `meta.json`의 `newsSources` 배열을 읽는다
2. 각 소스의 RSS/페이지를 크롤링하여 최근 기사 수집
3. 기존 `events.json`의 최신 이벤트와 비교하여 중복 필터링
4. 후보 이벤트를 터미널에 출력:

```
━━━ 이벤트 후보 3건 ━━━

[1] 2026-03-16 — Iran launches drone wave targeting Saudi Aramco facilities
    Source: Al Jazeera
    URL: https://...
    → 추가하려면 events.json에 직접 작성하세요

[2] 2026-03-16 — US deploys 2,500 Marines to Gulf region
    Source: Reuters
    URL: https://...

[3] 2026-03-16 — Oil prices surge past $110 amid Hormuz tensions
    Source: CNN
    URL: https://...
```

5. **수집하지 않는다** — 사용자가 후보를 검토하고 직접 events.json에 작성한다
6. 출처 URL이 제공되므로 팩트 검증이 가능하다
7. 중복 판정 기준: 기존 이벤트와 같은 날짜 + 출처 URL 일치 시 필터링

### 새 토픽 추가 워크플로우

1. `public/data/topics/<new-slug>/` 디렉토리 생성
2. `meta.json` 작성 — phases, metricDefs, collectors, newsSources 정의
3. `events.json` 초기 이벤트 작성 (최소 1개)
4. `econ.json` 초기 데이터 작성 (기준일 1행)
5. `public/data/index.json`에 토픽 추가
6. `node collect.mjs <new-slug> --econ --dry-run`으로 수집 테스트
7. 이후 정기적으로 `--econ`과 `--suggest` 실행

## Component Architecture

### Page Components

```
<App>
├── <Dashboard />              # "/"
│   ├── <GlobalKpiBar />       # 상단 글로벌 지표 요약
│   └── <TopicGrid />          # 토픽 카드 그리드
│       └── <TopicCard />      # 개별 토픽 카드 (KPI + 스파크라인)
│
└── <TimelinePage />           # "/topic/:slug"
    ├── <TopBar />             # 대시보드 복귀 + 토픽 제목 + 핵심 통계
    ├── <TimelineStrip />      # 수평 타임라인 (단계 + 이벤트 도트 + 컨트롤)
    └── <MainContent />
        ├── <EventSidebar />   # 접기 가능 이벤트 카드 리스트
        └── <DetailView />
            ├── <EventDetail />   # 이벤트 상세 + 통계 그리드
            └── <EconPanel />     # 경제 차트 + KPI
```

### Shared Components

```
components/common/
  <SparklineChart />     # 미니 스파크라인 (대시보드 카드용)
  <EconChart />          # Canvas 경제 차트 (상세 페이지용)
  <KpiBadge />           # KPI 수치 + 변동률 표시
  <StatusBadge />        # ongoing/developing/archived 상태 뱃지
  <PhaseBar />           # 단계 컬러 바
```

### Key Hooks

```ts
// 토픽 데이터 로딩 (meta + events + econ)
function useTopicData(slug: string): {
  meta: TopicMeta | null;
  events: TopicEvent[];
  econ: EconDataPoint[];
  loading: boolean;
  error: Error | null;
}

// 토픽 목록 로딩
function useTopicIndex(): {
  topics: TopicSummary[];
  loading: boolean;
  error: Error | null;
}

// 이벤트 네비게이션 (현재 goToEvent 로직)
function useEventNavigation(events: TopicEvent[]): {
  currentIndex: number;
  currentEvent: TopicEvent;
  goTo: (index: number) => void;
  next: () => void;
  prev: () => void;
  isPlaying: boolean;
  togglePlay: () => void;
}

// 키보드 단축키 (←→, space)
function useKeyboardNav(nav: EventNavigation): void;
```

### Data-Driven Rendering

통계 그리드와 경제 차트는 meta.json 설정에 따라 동적으로 렌더링:

```tsx
// EventDetail — statsFields 기반 동적 통계 그리드
{meta.statsFields.map(field => (
  <div className={styles.stat} key={field.key}>
    <span style={{ color: field.color }}>
      {event.metrics[field.key]?.toLocaleString()}
    </span>
    <span>{field.label}</span>
  </div>
))}

// EconChart — metricDefs 기반 동적 차트 데이터셋
const datasets = meta.metricDefs
  .filter(d => d.showOnDetail)
  .map(d => ({
    key: d.key,
    label: d.label,
    color: d.chartColor,
    dash: d.chartDash,
    lineWidth: d.chartLineWidth ?? 2,
  }));
```

## Dashboard Home

### Layout

상단에 글로벌 KPI 바 (선택적), 그 아래 토픽 카드 그리드.

### TopicCard

각 카드에 포함:
- 상태 뱃지 (ongoing: 빨강, developing: 주황, monitoring: 초록, archived: 회색)
- 토픽 제목
- meta.json의 kpis 설정에 따른 2~4개 핵심 수치
- 최근 econ 데이터 기반 스파크라인 차트
- 클릭 시 `/topic/:slug`로 이동

그리드는 반응형: 데스크톱 2~3열, 태블릿 2열, 모바일 1열.

## Timeline Page

현재 서비스 구조를 React 컴포넌트로 분리한다.

### TopBar
- 왼쪽: 대시보드 복귀 버튼 + 토픽 제목
- 오른쪽: 핵심 통계 — meta.json의 statsFields 기반 동적 생성

### TimelineStrip
- 단계 컬러 바 + 라벨 (phases 기반)
- 이벤트 도트 트랙
- 재생/이전/다음 컨트롤
- 현재 로직 그대로 React로 포팅

### EventSidebar
- 접기/펼치기 토글 (현재 구현 유지)
- 이벤트 카드 리스트 (날짜 + 제목 + 태그)
- 활성 카드 하이라이트 + 자동 스크롤

### EventDetail
- 날짜, 태그, 제목, 설명, 상세 bullet, 출처 링크
- 통계 그리드 — meta.json의 statsFields에 따라 동적 생성
- 진입 애니메이션

### EconPanel
- Canvas 차트 (현재 drawChart 로직 재사용)
- 호버 툴팁 (실제 수치 + 변동률)
- KPI 행
- 범례
- meta.json의 baselineDate 기준 변동률 계산

## Data Migration

현재 `data.js`를 JSON 파일로 분리:

1. `WAR_EVENTS` → `public/data/topics/us-iran-war/events.json`
   - `stats` 필드를 `metrics`로 리네임
2. `ECON_TIMELINE` → `public/data/topics/us-iran-war/econ.json`
3. `PHASE_INFO` + 현재 차트 설정 + 크롤러 설정 → `public/data/topics/us-iran-war/meta.json`
4. 토픽 목록 → `public/data/index.json`
5. `collect.mjs` → `cli/collect.mjs` (크롤러 모듈 분리)

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| 데이터 관리 | 정적 JSON | 1인 프로젝트, 서버 불필요, collect.mjs 호환 |
| 라우팅 | 2단 + 쿼리 | 이벤트 딥링크 가능, 단일 페이지 UX 유지 |
| 홈 레이아웃 | 그리드 대시보드 | 여러 토픽 한눈에 비교, KPI + 미니 차트 |
| 상세 레이아웃 | 사이드바 + 상세 + 차트 | 현재 검증된 UX 유지 |
| 차트 | Canvas 직접 구현 | 현재 코드 재사용, 번들 크기 절약 |
| 스타일링 | CSS Modules | 현재 CSS 마이그레이션 용이, 스코프 격리 |
| 통계/지표 | meta.json으로 설정화 | 토픽별 다른 통계, 수집 설정 통합 |
| 경제 데이터 | CLI 자동 수집 | meta.json의 collectors 기반 크롤링 |
| 이벤트 | CLI 제안 + 수동 확인 | 뉴스 크롤링 → 후보 출력, 사람이 최종 판단 |
| 수집 트리거 | 수동 CLI | 단순, 나중에 cron 호환 가능 |
| 수집 설정 | meta.json에 통합 | 토픽 추가 시 한 파일만 편집 |

## Out of Scope

- 사용자 인증/로그인
- 서버사이드 렌더링 (SSR)
- 실시간 데이터 업데이트 (WebSocket)
- 댓글/소셜 기능
- 다국어 지원 (현재 한국어 단일)
- 검색/필터 기능 (토픽 수가 적은 동안 불필요)
- 이벤트 자동 수집 (제안만, 최종 판단은 사람)
