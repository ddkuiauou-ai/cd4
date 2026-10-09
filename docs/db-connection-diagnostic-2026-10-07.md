# CD DB 연결 진단 — 2026-10-07

실제 개발 앱과 같은 `@next/env` 개발 모드로 환경변수를 읽었다. 로드된 파일은 `.env` 하나이며, 상위 프로세스에서 주입된 `DATABASE_URL`/`POSTGRES_*`는 없었다. 앱의 `db/connection.ts`를 그대로 사용했다. 비밀번호와 전체 연결 문자열은 출력하거나 이 기록에 저장하지 않았다.

현재 대상은 `192.168.50.27:25433 / dcd / silla`, TLS 비활성이다. 비교 검사는 프로브에만 `5432` 포트를 지정했다. 앱 설정과 업무 DB는 변경하지 않았다. DB 쿼리는 `default_transaction_read_only=on`, `statement_timeout=5000`으로 실행했다.

## 실제 결과

| 검사 | 현재 설정 25433 | 비교 포트 5432 |
| --- | --- | --- |
| TCP 연결 | 5초 timeout, 반복 확인 | 성공, 약 4–5ms |
| PostgreSQL SSLRequest 응답 | 5초 timeout | `N` 응답: PostgreSQL 응답 확인, TLS 미지원 |
| 동일 계정·비밀번호·DB의 인증과 `SELECT 1` | `CONNECT_TIMEOUT`; 인증 성공 여부를 판단할 수 없음 | 성공: `dcd`, `silla`, PostgreSQL **17.6** |
| 업무 테이블 조회 | 연결 실패로 미검사 | 기존 13개 업무 테이블의 `SELECT` 권한 없음 |
| 실제 `company`/`security` 조회 (`LIMIT 0`) | 미검사 | 두 테이블 모두 `42501`: 접근 권한 없음 |
| `result_publication` | 미검사 | catalog에 없음, 실제 조회 `42P01` |

5432의 업무 테이블은 모두 `public`에 있고 검색 경로에서 보인다. `public` schema의 `USAGE` 권한은 있다. 확인한 업무 테이블은 `company`, `pension`, `display_name`, `search_name`, `security`, `price`, `marketcap`, `bppedd`, `stockcodename`, `tmp_bppedds`, `tmp_marketcaps`, `tmp_prices`, `security_rank`다.

로컬 주소는 `192.168.50.204/24`이며 대상 경로는 활성 `en0`다. ICMP ping은 2회 모두 응답이 없었지만 같은 호스트의 5432 TCP 연결은 성공했다. 따라서 ping 실패만으로 서버 전체가 접근 불가라고 판단하지 않는다. 첫 샌드박스 안의 TCP 검사는 `EPERM`으로 차단됐고, 위 네트워크 결과는 샌드박스 밖에서 재검사한 결과다.

## 판단과 후속 확인

현재 웹의 `CONNECT_TIMEOUT`은 25433 연결 수립 단계에서 재현된다. 인증·권한·테이블 조회에 도달한 오류가 아니다. 동일 계정과 비밀번호는 5432에서는 유효하지만, 25433의 별도 서버에서도 유효한지는 아직 확인되지 않았다.

5432에서는 인증 성공 뒤 실제 조회 권한 오류와 필수 테이블 부재가 확인됐다. 문서상 새 대상은 PostgreSQL 18의 25433이므로 앱 포트만 5432로 바꾸면 해결되지 않는다. 우선 의도한 PostgreSQL 18 서버의 25433 수신 주소·서버 방화벽·포트 매핑을 확인하고, 연결이 성공한 뒤 해당 대상의 버전·schema·권한을 검사해야 한다.

홈 조회는 `result_publication`의 `company_marketcap/krx-all` 헤더를 먼저 읽는다. 테이블이 있고 헤더 행만 없는 경우는 미공개 화면이며, 이번 연결 timeout과 다르다. 브라우저의 React script 경고도 이번 DB 연결 실패와 별개다.

이 진단에서는 migration, GRANT, 데이터 적재, `.env` 변경을 수행하지 않았다.
