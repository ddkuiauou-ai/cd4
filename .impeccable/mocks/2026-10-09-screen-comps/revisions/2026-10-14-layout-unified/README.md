# 공통 레이아웃 이미지 수정안 · 2026-10-14

16개 화면 그룹을 이미지로 수정했습니다. 상태 화면은 두 장으로 나누어 총17장의 선정 이미지를 제공합니다. 사용자 검토 대기이며 제품 코드 구현·실제 동작 검증은 포함하지 않습니다.

## 확정한 기준

- 06 기업 합산 시총의 구성 종목 선택은08 해당 종목 시총으로 이어집니다.
- 모바일 기업 전체와 실제 구성 종목은 항상 보입니다.
- 상세는 헤더 → 대상 정보 → 대상 선택 → 페이지/지표 메뉴 → 현재값 → 본문 계층입니다.
- 기업 전체와 개별 종목, 현재값과 과거 관측, 시총과 주가의 단위를 구분합니다.
- B대회기록실의 흰 표면·빨강/금색·순위색과 궁서풍 제목 방향을 유지합니다. 실제 폰트 적용은 아닙니다.

## 확인할 자료

- [새 갤러리](/Users/craigchoi/silla/cd4/.impeccable/mocks/2026-10-09-screen-comps/review-layout-2026-10-14.html)
- [이전 갤러리](/Users/craigchoi/silla/cd4/.impeccable/mocks/2026-10-09-screen-comps/review-2026-10-13.html)
- [공통 레이아웃 규칙](/Users/craigchoi/silla/cd4/.impeccable/mocks/2026-10-09-screen-comps/revisions/2026-10-14-layout-unified/layout-contract.md)
- [선정 이미지와 원문 프롬프트](/Users/craigchoi/silla/cd4/.impeccable/mocks/2026-10-09-screen-comps/revisions/2026-10-14-layout-unified/jobs.json)
- [파일·링크 검증](/Users/craigchoi/silla/cd4/.impeccable/mocks/2026-10-09-screen-comps/revisions/2026-10-14-layout-unified/verification.json)

## 선정 이미지

- [01-main 메인 · 대회 기록실](/Users/craigchoi/silla/cd4/.impeccable/mocks/2026-10-09-screen-comps/revisions/2026-10-14-layout-unified/01-main-final.png)
- [02-ranking-company 기업 합산 시가총액 순위](/Users/craigchoi/silla/cd4/.impeccable/mocks/2026-10-09-screen-comps/revisions/2026-10-14-layout-unified/02-ranking-company-final.png)
- [03-ranking-security 종목별 시가총액 순위](/Users/craigchoi/silla/cd4/.impeccable/mocks/2026-10-09-screen-comps/revisions/2026-10-14-layout-unified/03-ranking-security-final.png)
- [04-ranking-metrics 지표별 랭킹 · 6개 변형](/Users/craigchoi/silla/cd4/.impeccable/mocks/2026-10-09-screen-comps/revisions/2026-10-14-layout-unified/04-ranking-metrics-final.png)
- [05-company-basic 기업 기본 정보](/Users/craigchoi/silla/cd4/.impeccable/mocks/2026-10-09-screen-comps/revisions/2026-10-14-layout-unified/05-company-basic-v2.png)
- [06-company-marketcap 기업 합산 시가총액 상세](/Users/craigchoi/silla/cd4/.impeccable/mocks/2026-10-09-screen-comps/revisions/2026-10-14-layout-unified/06-company-marketcap-v2.png)
- [07-security-basic 종목 기본 정보](/Users/craigchoi/silla/cd4/.impeccable/mocks/2026-10-09-screen-comps/revisions/2026-10-14-layout-unified/07-security-basic-layout.png)
- [08-security-marketcap 종목 시가총액 상세](/Users/craigchoi/silla/cd4/.impeccable/mocks/2026-10-09-screen-comps/revisions/2026-10-14-layout-unified/08-security-marketcap-final.png)
- [09-detail-per PER 상세](/Users/craigchoi/silla/cd4/.impeccable/mocks/2026-10-09-screen-comps/revisions/2026-10-14-layout-unified/09-detail-per-v2.png)
- [10-detail-pbr PBR 상세](/Users/craigchoi/silla/cd4/.impeccable/mocks/2026-10-09-screen-comps/revisions/2026-10-14-layout-unified/10-detail-pbr-final.png)
- [11-detail-eps EPS 상세](/Users/craigchoi/silla/cd4/.impeccable/mocks/2026-10-09-screen-comps/revisions/2026-10-14-layout-unified/11-detail-eps-v2.png)
- [12-detail-bps BPS 상세](/Users/craigchoi/silla/cd4/.impeccable/mocks/2026-10-09-screen-comps/revisions/2026-10-14-layout-unified/12-detail-bps-final.png)
- [13-detail-div 배당수익률 상세](/Users/craigchoi/silla/cd4/.impeccable/mocks/2026-10-09-screen-comps/revisions/2026-10-14-layout-unified/13-detail-div-v2.png)
- [14-detail-dps 주당배당금 상세](/Users/craigchoi/silla/cd4/.impeccable/mocks/2026-10-09-screen-comps/revisions/2026-10-14-layout-unified/14-detail-dps-v2.png)
- [15-search-recent 검색 · 최근 본 · 메뉴](/Users/craigchoi/silla/cd4/.impeccable/mocks/2026-10-09-screen-comps/revisions/2026-10-14-layout-unified/15-search-recent-final.png)
- [16-states 로딩 · 빈 화면 · 오류 상태](/Users/craigchoi/silla/cd4/.impeccable/mocks/2026-10-09-screen-comps/revisions/2026-10-14-layout-unified/16-states-primary.png)
  - [미제공·기준일 미공개 상태 · 전체 탐색 유지](/Users/craigchoi/silla/cd4/.impeccable/mocks/2026-10-09-screen-comps/revisions/2026-10-14-layout-unified/16-states-secondary.png)

## 제작·검토의 범위

내장 image_gen.imagegen을 사용했습니다. 이전선정이미지와06기준이미지를참조하고각결과를프로젝트에복사했습니다. 원문프롬프트는 .prompt.txt, 메타데이터는 .png.json 및PNG내부에보존했습니다. 이전시안과이번첫생성·교정파일은삭제하지않았습니다.

06·07의공통계층/PC3형제버튼/모바일1+2배치/현재대상일치는별도검토로확인했습니다. 각담당이미지시각검토와파일검증을사용했습니다. 브라우저도구정책이file://접근을막아갤러리실제렌더링을검증했다고주장하지않습니다. HTTP우회·임시서버는사용하지않았습니다.

모든예시는합성수치이며공식시세가아닙니다. 삼성전자현재549조=495조+54조,common주가74000원/EPS4000/PER18.5/BPS40000/PBR1.85/DPS1480/DIV2%로화면간관계를맞췄습니다. 주가차이20000원은현재값비교의표현제안이며역사적괴리율서비스가존재한다는뜻이아닙니다.

## 남은 이미지 표현의 한계

본수정안은레이아웃검토용입니다. 제품구현·정확한폰트렌더링·픽셀단위폭일치·전체하단모듈순서의완전동일성을확인한산출물은아닙니다. 생성도구가그린작은숫자·코드·문구오차를확정데이터로사용하지않습니다.
- 01-main: 모바일 순위 숫자 겹침과 작은 문구 생성 오차가 남아 있습니다.
- 03-ranking-security: 순위 이동 화살표 일부의 색상은 중립색으로 정리할 후속 항목입니다.
- 04-ranking-metrics: 여섯 지표의 모바일 비교 보드입니다. 일부 보조 예시 숫자에 생성 오차가 있습니다.
- 07-security-basic: 모바일 보통주 버튼의 코드는 005930이 맞습니다. 이미지에 005935로 잘못 그려진 부분이 있습니다.
- 07-security-basic: PC 오른쪽의 지표 메뉴 중복은 후속 정리 항목입니다.
- 08-security-marketcap: PC 최근 본의 번호 표시와 보조 영역 폭에는 다른 상세와 차이가 남아 있습니다.
- 13-detail-div: 현재 2.00%와 산식 아래 관측 평균 표현이 상충합니다. 현재값과 기간 평균을 구분해야 합니다.
- 14-detail-dps: 최근 본 항목의 단위 표현에 차이가 남아 있습니다.
- 15-search-recent: 임시 검색 표면 뒤 종목 버튼의 일부 문구는 지표 유지 규칙에 맞춰 후속 정리가 필요합니다.
- 지표별하단기록·CSV·자료기준·보조통계의세부배치에는차이가남습니다. 분석의목적차이와공통행동의위치를후속화면검토에서구분해야합니다.

서비스실행코드는변경하지않았습니다. 변경한HTML은이미지검토용갤러리이며, PRODUCT.md에는사용자가확정한탐색기준만기록했습니다.
