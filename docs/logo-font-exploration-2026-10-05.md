# 천하제일 단타대회 헤더 로고 폰트 비교

2026-10-05 · 사용자 요청 범위: 기존 A·B·C 시안의 헤더 로고만 수정. 최종 폰트는 선택 전이다.

## 조합과 보존 범위

실제 텍스트 ‘천하제일’ + 기존 public/icon.svg + 실제 텍스트 ‘단타대회’를 한 줄로 조합했다. SVG는 파일 내용까지 원본과 동일하다. A·B·C의 본문도 기존 v2 PNG와 SHA-256 값이 동일하다. 글자를 이미지로 재생성하지 않고 브라우저 DOM에 실제 폰트로 올려 재현 가능한 형태로 비교한다.

A와 B는 붉은 첫 단어, 금색 둘째 단어, 검정의 얇은 외곽선을 사용한다. C는 금색 배경과 둘째 단어가 겹치므로 둘째 단어를 먹색으로 바꿨다. 가운데 별은 세 안 모두 붉은 별·금색 원판·검정 윤곽을 유지한다.

## 공식 폰트와 측정 용량

| 폰트 | 사용 굵기 | 로고 8글자 WOFF2 | 시각적 판단 |
| --- | --- | --- | --- |
| [나눔명조](https://github.com/google/fonts/tree/main/ofl/nanummyeongjo) | ExtraBold 800 | 18,040 B | 전통적인 획의 손맛과 읽기 편한 형태. 이번 비교의 추천 기본값. |
| [Noto Serif KR](https://github.com/google/fonts/tree/main/ofl/notoserifkr) | 700 | 30,120 B | 기존 명조 인상을 자연스럽게 잇는 대안. |
| [Black Han Sans](https://github.com/google/fonts/tree/main/ofl/blackhansans) | 400 | 5,812 B | 자체적으로 굵은 폰트. 방송 제목·간판 같은 레트로 표현이 강함. |

모두 Google Fonts 공식 배포 파일을 사용했다. 실제 요청 문자열은 ‘천하제일단타대회’ 8글자로 제한했고, 본문 폰트 전체 파일의 용량을 의미하지 않는다. 각 SIL OFL 라이선스 원문과 Google Fonts CSS 응답, 다운로드 URL은 `.impeccable/logo-review/fonts/`와 `font-sources.json`에 보존했다. `font-synthesis: none`으로 가짜 굵기를 만들지 않는다.

원본 별 SVG는 767 B이다. 원본 전체 벡터 로고 public/logo_long.svg는 10,863 B이므로 별도 폰트를 추가하는 방식이 항상 더 작다는 뜻은 아니다. 기존에 로드하는 같은 폰트를 재사용할 수 있는지와 캐시 비용까지 후속 구현에서 판단한다. 이번 조합의 직접적인 이점은 문구·배치·화면 크기를 실제 텍스트로 조정할 수 있다는 점이다.

서브셋 방식은 [Google Fonts 공식 API 문서](https://developers.google.com/fonts/docs/getting_started#optimizing_your_font_requests)의 `text=` 요청을 따른다. 문구가 바뀌면 필요한 글자를 포함한 파일을 다시 만들어야 한다.

## 시안과 검증

- 비교 화면: `.impeccable/logo-review/index.html`, `styles.css`, `review.js`
- 로컬 URL: http://127.0.0.1:49673/?font=nanum
- 저장 화면: `.impeccable/logo-review/review/logo-comparison-nanum.jpg`
- 재실행: 프로젝트 루트에서 `python3 -m http.server 49673 --bind 127.0.0.1 --directory .impeccable/logo-review`
- 다운로드 재현 스크립트: `.impeccable/logo-review/download-fonts.py`

브라우저에서 1280px 데스크톱·320px 모바일의 실제 폰트 로딩, 완전한 이름의 한 줄 배치, 가로 넘침을 확인했다. 라디오 선택으로 세 헤더의 폰트와 현재 적용 표시·URL이 함께 바뀐다. 로고 외 화면은 방향 검토용 이미지로, 검색·순위·다운로드가 동작하는 제품 구현은 아니다.

한 번의 묶음 검사에서 C의 금색 글자 대비를 발견해 먹색으로 바꾸고 배경색을 원래 시안에 가깝게 보정한 뒤 확인했다. Impeccable 디자인 훅의 결정적 검사에서 HTML·CSS 발견 사항은 없었다. 이번 단계에서 제품 소스는 수정하지 않았다.

후속 훅의 `cream-palette` 지적은 비교 도구 바깥 배경에 적용했다. 바깥 표면과 보조 글자·구분선을 중립 회색 계열로 바꿨다. 기존 B 시안 내부의 따뜻한 기록지 표면은 로고만 수정하는 사용자 범위에 맞춰 보존했다.
