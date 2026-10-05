# 라이트 표면 통일과 모바일 순위 정렬

2026-10-05. 사용자는 데스크톱 순위 변동의 표현·위치를 긍정적으로 평가했다. 라이트 데스크톱 본문의 청회색이 모바일 화이트와 다르다고 지적하고, 본문과 헤더를 화이트로 통일하며 우측 패널은 더 옅게 표현하도록 요청했다. 모바일의 순위 아래 변동 표시가 어긋나고 분리돼 보이는 점도 개선한다. 기존 브랜드, 탐색 메뉴, 우측 구성과 데이터 의미를 유지하는 좁은 후속 수정이다. 제품 앱 소스는 변경하지 않는다.

## 표현

본문·헤더의 목표색은 순백색 `#FFFFFF`이다. 레일은 아주 옅은 중립 회색 `#F7F7F7`과 얇은 `#E6E6E6` 구분선으로 나눈다. 본문에 레일의 색을 확장하지 않는다. 랭킹과 삼성전자 상세에 같은 규칙을 적용한다. 이미지 검토 갤러리의 회색 배경은 제품 화면 밖의 검토용 바탕으로 유지한다. 브랜드의 금색·빨강, 주가 등락의 빨강·파랑과 차트 정보는 이어간다.

데스크톱 변화량은 사용자가 확인한 순위 옆 위치를 그대로 둔다. 모바일은 이미지 속 숫자와 별도 좌표의 변화량을 겹치는 방식 대신 하나의 실제 HTML 버튼 안에 숫자와 변화량을 묶는다. 같은 중심축을 공유하는 세로 flex 구성이다. 변화량 내부의 수직 SVG 화살표와 숫자도 하나의 inline-flex다. 행 전체의 수직 중앙에 묶음을 놓고 기업명·코드 그룹과 높이를 맞춘다.

390px에서 묶음의 중심은 x27.29px로 기존 ‘순위’ 머리말과 같은 축이다. 순위와 변화량 중심 차이는 0.008px 이하, 내부 두 줄 간격은0.375px이며 타깃 높이는44px다. 현재 순위는26.13px, 변화량은11.54px로 표시한다. 세 자리·네 자리 순위는 같은 폭 안에서 글자 크기를 줄이는 표현을 준비했다. 예시의 여섯 순위는 한 자리이며 실제 전체 목록 구현은 아직 하지 않는다. 순위 숫자의 중립색은 작은 크기에서도 읽도록 `#66717D`로 조정한다.

이전 순위와 같으면 ‘유지’, 다르면 화살표와 이동량이다. 이전4위 → 현재2위는 두 계단 상승이다. hover·focus·탭으로 이전·현재 설명을 확인하고 Escape로 닫는다. 비교 기준은 ‘이전 순위 대비’이며 전일로 단정하지 않는다. 가격의 %와 독립적인 정보다.

## 시안과 출처

- 비교: `http://127.0.0.1:49673/white-shell.html?theme=light`.
- 개별: `white-shell-preview.html?device=desktop|mobile|detail&theme=light|dark`.
- 이전 비교: `rank-movement.html?theme=light`.

네 native 편집 결과와 정확한 프롬프트는 `.impeccable/mocks/white-shell/`에 보관한다. 각각 한 번만 생성했다. 데스크톱은 라이트 색상만 변경했고 다크 배경 두 화면은 앞선 이미지를 그대로 사용한다. 모바일은 큰 순위 숫자 여섯 개만 지워 실제 숫자·변동 그룹을 합성할 공간을 만든다. PNG 자체에 새 UI를 그리지 않는다. 실제 나눔명조800과 원본 별 SVG도 이어간다.

| 이미지 | 정확한 프롬프트 | 원본 크기 |
|---|---|---|
| 데스크톱 랭킹 라이트 | [ranking-light.prompt.txt](../.impeccable/mocks/white-shell/ranking-light.prompt.txt) |1491×1055|
| 상세 라이트 | [detail-light.prompt.txt](../.impeccable/mocks/white-shell/detail-light.prompt.txt) |1447×1087|
| 모바일 라이트 숫자 영역 | [mobile-light-rank-base.prompt.txt](../.impeccable/mocks/white-shell/mobile-light-rank-base.prompt.txt) |853×1844|
| 모바일 다크 숫자 영역 | [mobile-dark-rank-base.prompt.txt](../.impeccable/mocks/white-shell/mobile-dark-rank-base.prompt.txt) |853×1844|

native 색상 편집은 청회색을 제거했으나 빈 면이 정확한 flat 픽셀색은 아니다. 메인·헤더 샘플은 `#FEFEFE`~`#FFFFFF`, 레일은 `#F5F5F5`~`#F6F6F6`이며 미세 텍스처가 남아 있다. 상세 출력은 참조1448×1086에서 너비−1px·높이+1px가 됐다. 리사이즈로 숨기지 않고 실제 크기로 표시하며 sidecar에 기록했다. 제품 구현에서는 위의 명시적 표면 토큰을 사용할 수 있다. 모든 새 PNG는 `approved:false`다.

## 확인

데스크톱·상세1440×1080과 모바일390×844의 라이트·다크 여섯 화면을 일괄 검토했다. 실제 폰트와 이미지 로딩, 순위 정렬, 회사명 간격, 예시 변화량, 가로 넘침 없음을 확인했다. 모바일 숫자·변화량의 동일 중심축을 DOM 좌표로 확인했다. 비교 뷰어의 한 열 재배치, 세 화면의 테마 전환, 개별 링크의 테마 전달, 모바일 보조 설명 탭·Escape 동작도 확인했다.

초기 검토 뒤 작은 순위 숫자에도 충분한 대비를 주는 색상 한 건을 조정하고 한 번 더 확인했다. JavaScript 구문 검사를 통과했다. 네 생성본과 네 뷰어 복사본 총8개 PNG의 embedded prompt 누락은0개다. 캡처와 확인 값은 `.impeccable/logo-review/review/white-shell/`에 저장했다. 제품 라우트·컴포넌트·다운로드 동작은 변경하지 않았다.

후속 Stop hook의 `flat-type-hierarchy` 진단은 이 HTML의 body·h1·h2를 모두16px로 보고했다. 같은 파일의 브라우저 computed style은 데스크톱 h1=32px·h2=21px·본문15px, 모바일 h1=24px·h2=21px·본문15px다. 외부 CSS import가 적용된 실제 화면에 위계가 있으므로 탐지 오류로 판단했다. `impeccable hooks ignore-value`로 이 규칙만 `.impeccable/logo-review/white-shell.html`에 한정해 예외를 기록했다. 다른 파일과 다른 규칙은 그대로 검사한다. 시안은 변경하지 않았으며 측정 근거는 `review/white-shell/type-hierarchy-validation.json`에 있다.
