# Eventide

국제 정세 이벤트의 타임라인을 따라가며 경제 지표 인사이트를 얻는 서비스.

전쟁, 외교 위기, 지정학적 사건이 유가, 주가, 섹터 ETF에 어떤 영향을 미치는지 시각적으로 분석합니다.

## Features

### 타임라인 기반 이벤트 추적
사건을 시간순으로 탐색하며 각 이벤트가 경제에 미친 영향을 확인합니다. 재생 버튼으로 자동 진행하거나, 키보드(←/→)로 이동할 수 있습니다.

### 경제 지표 차트
17개 경제 지표를 기준일 대비 % 변화로 정규화하여 한 차트에 비교합니다. 변동성이 큰 지표를 자동으로 상위 표시합니다.

**주요 지표:**

| 카테고리 | 지표 |
|----------|------|
| 글로벌 지수 | S&P 500, KOSPI, 닛케이 225 |
| 원자재 | 브렌트유, 금, 구리, 밀 |
| 변동성/통화 | VIX, 달러 인덱스(DXY), 원/달러, 미국 10Y 국채 |
| 섹터 ETF | 방산(ITA), 반도체(SMH), AI·로봇(BOTZ), 에너지(XLE) |
| 개별종목 | HD한국조선해양, 비트코인 |

### VIX 공포/탐욕 시그널
VIX 지수 기반 역발상 매매 신호를 제공합니다.
- VIX 30+ (공포) → **매수** 시그널 (시장 과매도)
- VIX 15 미만 (탐욕) → **매도** 시그널 (시장 과매수)
- S&P 500, KOSPI 대비 승률을 자동 계산하여 시그널 정확도를 보여줍니다.

### 상관관계 분석 (5개 탭)
- **지표 연동** — 지표 쌍별 피어슨 상관계수 + 듀얼 라인 차트 (예: VIX ↔ 반도체 r=-0.95)
- **그룹 분석** — 동조/역행하는 지표를 자동 클러스터링 (방산+조선 vs 반도체+AI)
- **이벤트 임팩트** — 각 군사/외교 이벤트 전후 지표 변화율 비교
- **인과 타임라인** — 군사 통계(공습, 사상자)와 경제 지표를 시간축으로 겹쳐 보기
- **뉴스 임팩트** — 이벤트 태그/키워드별 시장 반응 패턴 분석

### 데이터 스토리텔링
이벤트마다 자동 생성되는 인사이트 카드가 핵심 수치, 변화율, 추세를 한눈에 요약합니다.

## Topics

| 토픽 | 설명 |
|------|------|
| 미국 vs 이란 전쟁 | 2026년 미-이란 전쟁 타임라인 + 글로벌 경제 영향 |
| 호르무즈 해협 위기 | 해협 봉쇄가 유가, 해운, 에너지에 미치는 충격 |
| 대한민국 방산 부흥 | 전쟁 특수로 인한 한국 방산주 급등 분석 |

## Tech Stack

- React 19 + TypeScript
- Vite
- React Router
- Canvas 기반 차트 (라이브러리 없음)
- CSS Modules

## Getting Started

```bash
npm install
npm run dev
```

http://localhost:5173 에서 확인.

## Adding a New Topic

### 1. 디렉토리 생성

```bash
mkdir -p public/data/topics/{slug}
```

### 2. meta.json — 토픽 설정

```json
{
  "slug": "my-topic",
  "title": "토픽 제목",
  "status": "ongoing",           // ongoing | developing | monitoring | archived
  "startDate": "2026-03-01",     // 핵심 사건 시작일 (차트에 WAR 마커 표시)
  "baselineDate": "2026-02-27",  // 경제 지표 기준일 (% 변화 계산 기준점)
  "phases": [
    { "id": "phase-1", "title": "1단계", "period": "2026년 3월", "color": "#c0392b" }
  ],
  "kpis": [
    { "key": "oil", "label": "유가", "unit": "$", "source": "econ", "direction": "down-good" }
  ],
  "statsFields": [
    { "key": "casualties", "label": "사상자", "color": "#c0392b" }
  ],
  "metricDefs": [...],
  "collectors": [...],
  "newsSources": [...]
}
```

### 3. metricDefs — 경제 지표 정의

`showOnDetail: true`로 설정한 지표는 자동으로 경제 차트, 상관관계 분석, 이벤트 임팩트에 포함됩니다.

```json
{
  "key": "smh",                   // econ.json의 필드명과 일치
  "label": "반도체 ETF (SMH)",     // UI 표시 이름
  "unit": "$",                    // $, pt, %, ₩, ¢
  "format": "currency",           // currency | number | percent
  "direction": "up-good",         // up-good | down-good | neutral
  "chartColor": "#5c7cfa",        // 차트 라인 색상
  "chartDash": [6, 3],            // (선택) 점선 패턴 [dash, gap]
  "chartLineWidth": 2,            // (선택) 라인 두께
  "showOnDashboard": false,       // 대시보드 KPI 표시 여부
  "showOnDetail": true            // 경제 차트 + 분석 패널 포함 여부
}
```

**direction 값에 따라:**
- `up-good`: 상승=초록, 하락=빨강 (주가, 지수)
- `down-good`: 상승=빨강, 하락=초록 (유가, VIX, 환율)
- `neutral`: 방향성 없음 (금, 비트코인)

### 4. collectors — 데이터 수집 설정

Yahoo Finance, CoinGecko 등에서 자동 수집할 심볼을 정의합니다.

```json
{
  "key": "smh",                   // metricDef의 key와 일치
  "type": "yahoo",                // yahoo | coingecko
  "symbol": "SMH",                // Yahoo Finance 심볼
  "transform": "round2"           // round (정수) | round2 (소수 2자리)
}
```

**주요 심볼 예시:**

| 지표 | 심볼 | type |
|------|------|------|
| S&P 500 | `^GSPC` | yahoo |
| KOSPI | `^KS11` | yahoo |
| VIX | `^VIX` | yahoo |
| 브렌트유 | `BZ=F` | yahoo |
| 금 | `GC=F` | yahoo |
| 비트코인 | `bitcoin` | coingecko |
| 한화에어로 | `012450.KS` | yahoo |
| SMH (반도체) | `SMH` | yahoo |
| ITA (방산) | `ITA` | yahoo |

### 5. events.json — 타임라인 이벤트

```json
[
  {
    "id": 1,
    "date": "2026-03-01",
    "phase": "phase-1",           // meta.json phases의 id
    "tag": "military",            // military | crisis | diplomacy | economic | political 등
    "title": "이벤트 제목",
    "desc": "한 줄 요약",
    "details": [
      "상세 내용 1",
      "상세 내용 2"
    ],
    "sources": [
      { "name": "Al Jazeera", "url": "https://..." }
    ],
    "metrics": {                  // (선택) 이벤트 시점의 통계
      "casualties": 100,
      "strikes": 50
    }
  }
]
```

### 6. econ.json — 경제 지표 데이터

날짜별 경제 수치. metricDef의 `key`와 필드명이 일치해야 합니다.

```json
[
  {
    "date": "2026-02-27",
    "oil": 73,
    "sp500": 6850,
    "vix": 15.2,
    "smh": 252
  }
]
```

모든 날짜에 모든 지표가 있을 필요는 없습니다 (sparse data 허용).

### 7. index.json에 토픽 등록

```json
{
  "topics": [
    {
      "slug": "my-topic",
      "title": "토픽 제목",
      "status": "ongoing",
      "updatedAt": "2026-03-15"
    }
  ]
}
```

## Data Collection (CLI)

경제 지표를 자동으로 수집하는 CLI 도구가 포함되어 있습니다.

### 경제 지표 수집

```bash
# 오늘 날짜로 수집 (dry-run으로 미리 확인)
node cli/collect.mjs us-iran-war --econ --dry-run

# 실제 수집 (econ.json에 자동 추가)
node cli/collect.mjs us-iran-war --econ

# 특정 날짜로 수집
node cli/collect.mjs us-iran-war --econ --date 2026-03-16
```

`meta.json`의 `collectors`에 정의된 모든 심볼을 Yahoo Finance / CoinGecko에서 병렬로 가져와 `econ.json`에 추가합니다. 이미 같은 날짜가 있으면 덮어씁니다.

### 뉴스 기반 이벤트 제안

```bash
node cli/collect.mjs us-iran-war --suggest
```

`meta.json`의 `newsSources`에 정의된 RSS/웹 소스에서 뉴스를 크롤링하여 신규 이벤트를 제안합니다.

## License

MIT
