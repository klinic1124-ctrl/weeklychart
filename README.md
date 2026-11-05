# 주봉 차트 (Weekly Chart)

주식(국내·해외)과 암호화폐의 **주봉 전용** 모바일 웹앱(PWA)입니다.

- 캔들 + 이동평균 **50 / 120 / 200주**
- 하단: **거래량**, **RSI(14)**
- 암호화폐는 추가로 **업비트 프리미엄(김프)**, **코인베이스 프리미엄** (한 페인에 함께 표시)
- 종목 검색 → ★ 즐겨찾기 → 탭 한 번으로 차트
- 아이폰 Safari에서 **공유 → 홈 화면에 추가** 하면 앱처럼 전체화면으로 실행 (앱스토어 불필요)

상승 빨강 / 하락 파랑 (국내 관례).

## 데이터 소스

| 구분 | 소스 |
|---|---|
| 주식 주봉 | Yahoo Finance (`AAPL`, `005930.KS`, `035720.KQ`) — 한국 주식은 실패 시 네이버 금융으로 재시도 |
| 주식 검색 | 네이버 자동완성(한글/국내) + Yahoo 검색(해외) |
| 암호화폐 주봉 | 바이낸스 USDT 마켓 — **브라우저(휴대폰)에서 직접 호출** (바이낸스가 Cloudflare 서버 IP를 403으로 차단하기 때문). 실패 시 서버 경유로 재시도 |
| 업비트 프리미엄 | 업비트 KRW 주봉 종가 ÷ (바이낸스 종가 × USD/KRW 환율(Yahoo `KRW=X`)) − 1 |
| 코인베이스 프리미엄 | 코인베이스 USD 종가(일봉→주봉 집계) ÷ 바이낸스 종가 − 1 |

모든 주봉은 **월요일 00:00 UTC** 기준으로 맞춘 뒤 계산합니다. USDT = 1 USD 로 간주합니다.
코인베이스 프리미엄은 값의 범위가 작아(보통 ±0.5%) 업비트 프리미엄과 같은 페인에 **별도 눈금**으로 그립니다.

## 구조

```
src/          React 프론트엔드 (차트: TradingView Lightweight Charts v5)
shared/       프론트/서버 공용 타입·지표(SMA, RSI)·주 계산
server/       외부 API 어댑터 + 프리미엄 계산 (Cloudflare Functions 에서 사용)
functions/    Cloudflare Pages Functions 라우트 (/api/...)
tests/        단위 테스트 (vitest)
scripts/      개발용 목업 API, 아이콘 생성
```

API (`/api`, 엣지 캐시 적용):

| 경로 | 설명 |
|---|---|
| `GET /api/stock/candles?symbol=005930.KS` | 주식 주봉 |
| `GET /api/stock/search?q=삼성` | 주식 검색 |
| `GET /api/crypto/candles?base=BTC` | 바이낸스 주봉 (서버 경유 대체 경로, 차단될 수 있음) |
| `GET /api/crypto/premium?base=BTC&since=<초>` | 프리미엄 계산용 원천 데이터: 업비트 KRW 종가, 코인베이스 USD 종가, USD/KRW 환율 (주별). 바이낸스 종가와의 결합·% 계산은 앱에서 수행 |
| `GET /api/crypto/exchanges` | 업비트 한글명, 코인베이스 상장 목록 |

## 개발

```bash
npm install
npm run dev:mock   # 가짜 데이터로 화면 확인 (외부 API 불필요)
npm run pages:dev  # 빌드 후 wrangler 로 실제 API 프록시까지 로컬 실행
npm test           # 단위 테스트
```

## Cloudflare Pages 배포

### 방법 A: GitHub 연동 (권장, 푸시하면 자동 배포)
1. Cloudflare 대시보드 → **Workers & Pages → Create → Pages → Connect to Git**
2. 이 저장소 선택
3. 빌드 설정
   - Framework preset: `None`
   - Build command: `npm run build`
   - Build output directory: `dist`
4. **Save and Deploy** → `https://<프로젝트명>.pages.dev` 로 접속

`functions/` 폴더는 자동으로 API 로 배포됩니다. API 키나 환경변수는 필요 없습니다.

### 방법 B: CLI
```bash
npx wrangler login
npm run deploy
```

### 아이폰에 설치
Safari 로 배포 주소 접속 → 공유 버튼 → **홈 화면에 추가**.

## 참고 / 한계
- Yahoo Finance 는 비공식 API 라 차단·변경될 수 있습니다 (한국 주식은 네이버로 자동 대체).
- 200주 이동평균은 약 4년치 데이터가 있어야 그려집니다. 신규 상장 종목은 일부 이평선이 없을 수 있습니다.
- 업비트/코인베이스에 상장되지 않은 코인은 해당 프리미엄이 표시되지 않습니다.
- 개인 용도로 사용하세요. 각 거래소·데이터 제공자의 이용약관을 따릅니다.
