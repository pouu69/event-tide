# 데이터 소스 가이드

이 프로젝트의 모든 데이터는 `data.js`에 하드코딩되어 있다. 주기적으로 데이터를 업데이트하려면 아래 가이드를 따른다.

---

## 1. 경제 지표 (ECON_TIMELINE)

### 데이터 스키마

```js
{
  date: "YYYY-MM-DD",   // 날짜
  oil: number,           // 브렌트유 $/배럴
  sp500: number,         // S&P 500 포인트
  kospi: number,         // KOSPI 포인트
  usdkrw: number,        // 원/달러 환율
  gold: number,          // 금 $/트로이온스
  bitcoin: number,       // 비트코인 USD
  gas: number,           // 미국 휘발유 $/갤런
  lng_eu: number,        // 유럽 LNG $/MMBtu
  defense: number        // 방산지수 (전쟁 전 = 100 기준)
}
```

### 지표별 데이터 출처

| 지표 | 단위 | 주요 출처 | 보조 출처 | 비고 |
|------|------|-----------|-----------|------|
| `oil` | $/bbl | [Investing.com Brent](https://www.investing.com/commodities/brent-oil) | [EIA](https://www.eia.gov/petroleum/gasdiesel/) | 브렌트유 기준, 종가 |
| `sp500` | pt | [Yahoo Finance ^GSPC](https://finance.yahoo.com/quote/%5EGSPC/) | [Google Finance](https://www.google.com/finance/quote/.INX:INDEXSP) | 종가 기준 |
| `kospi` | pt | [네이버 금융](https://finance.naver.com/sise/sise_index.naver?code=KOSPI) | [KRX](https://data.krx.co.kr/) | 종가 기준 |
| `usdkrw` | KRW | [Investing.com USD/KRW](https://www.investing.com/currencies/usd-krw) | [한국은행 ECOS](https://ecos.bok.or.kr/) | 매매기준율 |
| `gold` | $/oz | [Kitco Gold](https://www.kitco.com/charts/livegold.html) | [Investing.com](https://www.investing.com/commodities/gold) | 트로이온스 기준 |
| `bitcoin` | USD | [CoinMarketCap](https://coinmarketcap.com/currencies/bitcoin/) | [CoinGecko](https://www.coingecko.com/en/coins/bitcoin) | 24h 평균 또는 종가 |
| `gas` | $/gal | [AAA Gas Prices](https://gasprices.aaa.com/) | [EIA Weekly](https://www.eia.gov/petroleum/gasdiesel/) | 미국 전국 평균 |
| `lng_eu` | $/MMBtu | [Trading Economics](https://tradingeconomics.com/commodity/eu-natural-gas) | [ICE TTF](https://www.theice.com/products/27996665/Dutch-TTF-Gas-Futures) | TTF 기준 |
| `defense` | index | 직접 계산 | - | 아래 산출 방법 참조 |

### 방산지수(defense) 산출 방법

전쟁 전 기준일(2026-02-27)을 100으로 놓고 아래 ETF의 평균 변동률로 계산:

```
defense = 100 * (1 + avg(ITA변동률, DFEN변동률, 한화에어로변동률))
```

- **미국**: [iShares U.S. Aerospace & Defense ETF (ITA)](https://finance.yahoo.com/quote/ITA/)
- **미국 레버리지**: [Direxion Daily Aerospace & Defense Bull 3X (DFEN)](https://finance.yahoo.com/quote/DFEN/)
- **한국**: [한화에어로스페이스(012450)](https://finance.naver.com/item/main.naver?code=012450) 또는 [TIGER 방산 ETF](https://finance.naver.com/item/main.naver?code=464520)

### 업데이트 절차

`data.js`의 `ECON_TIMELINE` 배열 끝에 새 행을 추가한다:

```js
// 마지막 행 뒤에 추가
{ date: "2026-03-15", oil: 108, sp500: 6480, kospi: 5050, usdkrw: 1510, gold: 5280, bitcoin: 72000, gas: 3.62, lng_eu: 65, defense: 130 },
```

**주의사항**:
- 날짜는 반드시 직전 행보다 이후여야 한다 (오름차순)
- 모든 필드를 빠짐없이 채운다
- 주말/공휴일은 직전 거래일 종가를 사용한다
- oil, gold, gas, lng_eu, bitcoin은 소수점 불필요 (정수로 반올림, gas만 소수 2자리)

---

## 2. 전쟁 이벤트 (WAR_EVENTS)

### 데이터 스키마

```js
{
  id: number,             // 순번 (직전 이벤트 + 1)
  date: "YYYY-MM-DD",     // 이벤트 날짜
  phase: string,          // "prelude" | "diplomacy" | "war-start" | "escalation" | "ongoing"
  tag: string,            // "military" | "diplomacy" | "political" | "civilian" | "protest" | "nuclear" | "crisis" | "analysis" | "current"
  title: string,          // 한글 제목 (이모지 포함 가능)
  desc: string,           // 1~2문장 요약
  details: string[],      // 세부 사항 (2~8개 bullet)
  sources: [              // 출처 링크 (1개 이상)
    { name: string, url: string }
  ],
  stats: {                // 해당 시점의 누적 통계
    strikes: number,      // 총 공습 횟수
    casualties: number,   // 총 사상자 수
    missiles: number,     // 이란이 발사한 미사일/드론 총 수
    oil: number,          // 해당 시점 유가 ($/배럴)
    usDead: number,       // 미군 사망자 수
    cost: number          // 작전 비용 (십억 달러, $B)
  }
}
```

### 뉴스 소스 목록

이벤트 수집 시 아래 매체들을 확인한다:

| 분류 | 매체 | 특징 |
|------|------|------|
| **속보** | [Reuters](https://www.reuters.com/world/middle-east/) | 실시간 뉴스, 영문 |
| **속보** | [AP News](https://apnews.com/hub/middle-east) | 팩트 중심 |
| **중동 전문** | [Al Jazeera](https://www.aljazeera.com/middle-east/) | 중동 시각, 영문 |
| **분석** | [CSIS](https://www.csis.org/regions/middle-east) | 미국 싱크탱크 분석 |
| **분석** | [FDD](https://www.fdd.org/) | 미국 국방/안보 분석 |
| **한국 영향** | [연합뉴스](https://www.yna.co.kr/) | 한국어, 국내 영향 |
| **한국 영향** | [한국일보](https://www.hankookilbo.com/) | 한국어 |
| **군사** | [CNN](https://www.cnn.com/world/middleeast) | 군사 작전 보도 |
| **군사** | [BBC](https://www.bbc.com/news/world/middle_east) | 영국 시각 |
| **유엔** | [UN News](https://news.un.org/) | 공식 유엔 발표 |

### stats 필드 수집 기준

| 필드 | 수집 방법 |
|------|-----------|
| `strikes` | 미국/이스라엘 공습 횟수 누적. 출처: 미 국방부 브리핑, CENTCOM 발표 |
| `casualties` | 양측 합산 사망자. 출처: 이란 적십자, 미 국방부, OCHA |
| `missiles` | 이란이 발사한 탄도미사일 + 순항미사일 + 드론 누적. 출처: CENTCOM, 이란 국영매체 |
| `oil` | 해당 날짜의 브렌트유 종가 (ECON_TIMELINE의 oil과 일치시킬 것) |
| `usDead` | 미군 전사자 누적. 출처: 미 국방부 공식 발표 |
| `cost` | 미국 작전 비용 추정치 (십억 달러). 출처: CBO, 국방부 예산 보고 |

### 업데이트 절차

`data.js`의 `WAR_EVENTS` 배열 끝에 새 이벤트를 추가한다:

```js
{
  id: 30, date: "2026-03-15", phase: "ongoing", tag: "military",
  title: "제목을 여기에",
  desc: "요약을 여기에",
  details: [
    "세부 사항 1",
    "세부 사항 2"
  ],
  sources: [
    { name: "Reuters", url: "https://..." }
  ],
  stats: { strikes: 2800, casualties: 5600, missiles: 2400, oil: 108, usDead: 13, cost: 3.8 }
},
```

**주의사항**:
- `id`는 직전 이벤트의 id + 1
- `stats`는 **누적값**이다 (해당 시점까지의 총합)
- `phase`는 현재 "ongoing" 단계
- `sources`는 최소 1개 이상의 출처를 포함한다
- 같은 날짜에 여러 이벤트가 있으면 가장 중요한 것만 선택한다

---

## 3. 단계 정보 (PHASE_INFO)

새로운 전쟁 단계가 필요하면 `data.js`의 `PHASE_INFO` 객체에 추가한다. 일반적으로는 수정할 일이 없다.

```js
const PHASE_INFO = {
  "new-phase": {
    title: "단계 이름",
    period: "시작일 — 종료일"
  }
};
```

추가 시 `style.css`에 해당 phase의 색상도 정의해야 한다:
```css
.strip-phase-seg.seg-new-phase { background: #색상코드; }
```

---

## 4. 업데이트 체크리스트

매일 또는 주요 이벤트 발생 시:

- [ ] 경제 지표 수집 → `ECON_TIMELINE`에 새 행 추가
- [ ] 주요 이벤트 확인 → `WAR_EVENTS`에 새 이벤트 추가
- [ ] 새 이벤트의 `stats.oil`과 `ECON_TIMELINE`의 `oil` 값 일치 확인
- [ ] 브라우저에서 `index.html` 열어 타임라인 정상 표시 확인
- [ ] 차트에 새 데이터 포인트 표시 확인
