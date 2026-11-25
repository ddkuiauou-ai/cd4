# PER 정적 시범

동결된 공개 자료로 전체 PER 랭킹과 삼성전자·삼성전자우·SK하이닉스의 종목 상세 및 기업 화면을 다시 만든다. 시범 검색은 이 세 종목을 대상으로 한다. 프로젝트의 Node와 pnpm 버전을 선택하고 다음 명령을 실행한다.

```sh
bun run build:per-pilot
bun run preview:per-pilot
```

기본 미리보기는 [PER 랭킹](http://127.0.0.1:4186/per/)에서 시작한다. 2026년 10월 8일 자료에서 삼성전자는 [14페이지](http://127.0.0.1:4186/per/14/)에 있다. [삼성전자 PER](http://127.0.0.1:4186/security/KOSPI.005930/per/)에서 기간·집계 단위·전체 이력 CSV를 확인할 수 있다.

랭킹 CSV는 공개 순위 전체를 담는다. 종목 CSV는 선택한 상장기의 전체 PER·EPS·제공 상태를 담는다. 기본 5년 월간 차트와 핵심 수치는 첫 HTML에 들어간다. 추가 PER 이력과 주가 이력은 각각 과거 연도와 공개 기준일이 속한 연도로 나눈다. 각 JSON의 내용이 바뀌면 그 파일의 주소가 바뀐다.

기본 빌드 입력은 `.static-build/`, 출력은 `.static-build/per-pilot/workspace/out/`이다. 별도 출력은 `.static-build/` 아래 디렉터리를 `PER_PILOT_DIR`로 지정한다. `PER_PILOT_SOURCE`로 동결 입력 디렉터리를 지정할 수 있다. 검색은 동결 상장 대상 목록을 사용한다. 목록 파일이 없는 동결 자료에서는 같은 스냅숏의 공개 기준일과 종목별 상장기로 검색 자격을 판정한다. 시범 범위 밖 주소는 404로 응답한다.

### 전체 랭킹과 대회장 시범

동일한 공개 기준일의 시장 CSV와 기업 시가총액 기준일에 일치하는 대회장의 과거 관측을 함께 지정하면 여덟 순위와 대회장까지 빌드한다. 순위표와 CSV는 공개 범위 전체를 포함한다. 상세와 검색은 시범 종목, 지표별 상위 종목, 대회장 과거 대표 종목 및 현재 종합 상위 종목, 기업 시가총액 첫 페이지의 대표 보통주를 포함한다.

```sh
export PER_PILOT_DIR="$(mktemp -d "$PWD/.static-build/rankings-pilot.XXXXXX")"
PER_PILOT_MARKET_DIR=/path/to/frozen-market-dir \
PER_PILOT_ARENA_FILE=/path/to/dashboard-arena-history.json \
bun run build:per-pilot
bun run preview:per-pilot
```

### 글꼴과 로딩 시안

로고·종목명·대표값의 글꼴은 조선궁서 400으로 확정했다. 표와 단위는 기기의 기본 고딕으로 읽는다. 이전 글꼴 비교 주소로 들어와도 같은 조선궁서를 쓴다.

조선궁서 TTF는 배포 원본을 유지한다. 로컬 정적 서버는 브라우저의 요청에 따라 이 파일에 Brotli 또는 gzip 전송 압축을 적용한다. 내용 해시가 붙은 글꼴 URL은 1년간 브라우저에 캐시한다. 운영에서 확인할 항목은 사용자 도메인 응답의 `Content-Type: font/ttf`, `Content-Encoding`과 `Cache-Control`이다. [조선궁서 배포 조건](../../app/fonts/ChosunGs-LICENSE.md) · [Cloudflare 전송 압축](https://developers.cloudflare.com/speed/optimization/content/compression/)

미리보기에서는 실제 대기 표시를 확대하거나 일시정지할 수 있다. 헤더와 같은 로고 일곱 개가 아래에서부터 4·2·1개 순서로 튀어나온다. 첫 로고부터 꼭대기 로고까지 약 0.6초가 걸리며, 등장한 로고는 제자리에서 천천히 시계 방향으로 돈다. 일곱째 로고가 자리를 잡으면 구름이 갈라지고 뒤로 감긴 꼬리와 목이 먼저 올라온다. 얼굴이 앞으로 다가오는 동안 앞쪽 또아리가 목 앞을 지난다. 구슬부터 용까지 한 장면은 약 3.7초 동안 재생된다. 조회 결과가 도착하면 그 즉시 대기를 끝낸다. 동작 줄이기에서는 용의 정지 그림과 대기 문구를 쓴다. [삼성전자 PER 로딩 미리보기](http://127.0.0.1:4186/security/KOSPI.005930/per/?review=1#loading-preview) · [로고 원본](../../public/icon.svg) · [일곱 구슬의 원작 설정](https://en.dragon-ball-official.com/news/01_4584.html)

첫 원화의 올려다보는 정면 구도, 눈동자 없는 눈, 먹빛 갈기를 기준으로 뿔과 팔이 보이지 않는 초록 용을 그렸다. 목 뒤로 감긴 몸통 한 굽이와 화면 앞쪽의 큰 비늘로 크기를 표현한다. 용 SVG 하나에 원화의 색면과 먹선을 보관한다. 기본 그림은 전체 정지 모습이며, 움직이는 장면은 같은 파일의 꼬리·몸통·머리·앞쪽 또아리를 겹쳐 조립한다. [원화 PNG](art/record-dragon.png) · [화면용 SVG](../../components/record-dragon.svg)
