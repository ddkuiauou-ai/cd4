# Windows PostgreSQL에 TLS 켜기

실행 중인 Windows PostgreSQL 서비스에서 기존 TCP 포트를 그대로 사용한다. 관리자 권한으로 **Windows PowerShell 5.1 이상**을 열고 저장소 루트에서 실행한다. PostgreSQL 운영 계정의 비밀번호는 `psql`이 요청할 때만 입력한다. [PostgreSQL TLS 안내](https://www.postgresql.org/docs/17/ssl-tcp.html)

## 1. 실제 서비스 확인

```powershell
.\scripts\windows-postgres-tls.ps1 -Mode Inspect
```

서비스 이름과 계정, 실행 중인 PostgreSQL 버전·포트, `postgresql.conf`·`pg_hba.conf`·데이터 경로 및 `TLS`가 출력된다. 서비스가 여럿이면 `-ServiceName`을, 포트가 여럿이면 Windows 서버에서 실제로 사용하는 `-Port`를 지정한다. 기본 DB 관리자는 `postgres`이고 기본 접속 DB도 `postgres`다. 환경이 다르면 `-DbUser`·`-Database`를 지정하고, IPv6 루프백만 수신하는 환경이면 `-AdminAddress ::1`을 지정한다. `TLS`가 이미 `on`이면 기존 인증서와 CA를 확인한다. [Windows 서비스 조회](https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-service)

## 2. 인증서 만들고 서버 설정 적용

`$service`를 1단계에 나온 실제 서비스 이름으로, `$tlsHost`를 GitHub Actions가 접속할 실제 호스트명 또는 IP로 바꾼다. Actions에 별도 `POSTGRES_TLS_HOST`가 있으면 그 값을 쓰고, 없으면 `POSTGRES_HOST` 값을 쓴다. 포트와 URL 접두사를 호스트 값에 붙이지 않는다.

```powershell
$service = 'postgresql-x64-17'
$tlsHost = 'postgres.example.com'
.\scripts\windows-postgres-tls.ps1 -Mode Enable -ServiceName $service -TlsHost $tlsHost
```

스크립트가 출력한 서비스 이름을 확인 창에 다시 입력한다. 설치된 PostgreSQL·PATH·Git for Windows에서 OpenSSL 3을 찾는다. 별도 설치를 쓰면 `-OpenSsl 'C:\실제\경로\openssl.exe'`를 추가한다. OpenSSL이 CA 키 암호문을 요청하면 새 암호문을 입력하고 따로 보관한다.

스크립트는 `%ProgramData%`의 새 작업 폴더에서 키를 만들기 전에 Windows ACL을 설정한다. CA 키는 관리자 전용 폴더에 암호화해 저장한다. PostgreSQL 서비스 계정에는 서버 인증서와 서버 키가 있는 폴더만 읽을 수 있도록 한다. 기존 `postgresql.auto.conf`를 같은 관리자 전용 폴더에 백업한다. 적용은 세 가지 TLS 설정을 `ALTER SYSTEM`으로 추가하고 `pg_reload_conf()`로 다시 읽는다. 같은 서비스의 새 연결에서 `verify-full`과 `pg_stat_ssl`이 통과하면 프로토콜·암호군과 `root.crt` 경로를 출력한다. [PostgreSQL 구성 다시 읽기](https://www.postgresql.org/docs/17/functions-admin.html) · [연결별 TLS 통계](https://www.postgresql.org/docs/17/monitoring-stats.html#MONITORING-PG-STAT-SSL-VIEW)

서버 인증서는 발급 후 365일, CA 인증서는 3,650일 동안 유효하다. 서버 인증서 만료 전에 갱신일을 잡는다.

## 3. GitHub 러너에서 확인

출력한 경로의 공개 CA 인증서 `root.crt` 전문을 저장소 **Settings → Secrets and variables → Actions → Variables**의 `POSTGRES_TLS_CA`에 붙여넣는다. 기존 직접 접속 주소와 포트를 쓰면 호스트·포트 Secret은 그대로 사용한다. 검증된 TLS용 주소나 포트가 별도로 있을 때만 `POSTGRES_TLS_HOST`·`POSTGRES_TLS_PORT` Secrets를 사용한다. `root.key`, `server.key`, DB 비밀번호와 구성 백업은 Windows 서버에 보관한다.

```powershell
Get-Content -LiteralPath 'C:\출력된\경로\root.crt' -Raw | Set-Clipboard
```

`Publish CD to R2`에서 수동 `status`를 한 번 실행한다. `verified-tls` 및 `databaseRead: verified`가 출력되면 GitHub 러너에서 CA와 접속 이름을 확인하고 업무 DB의 공개 헤더를 읽은 것이다. Windows의 로컬 TLS 확인과 GitHub 러너에서의 접근 확인은 모두 수행한다. [운영 워크플로](../.github/workflows/deploy-r2.yml) · [서버 이름·CA 확인](https://www.postgresql.org/docs/17/libpq-ssl.html)

TLS 확인만 성공하고 DB 조회가 실패하면 기존 업무 DB 계정과 `pg_hba.conf`의 접속 규칙을 먼저 확인한다. `host`나 `hostssl` 규칙이 해당 주소·계정·DB의 TLS 연결과 일치해야 한다. [PostgreSQL 접속 규칙](https://www.postgresql.org/docs/17/auth-pg-hba-conf.html)

## 되돌리기

설정 중에 오류가 나면 스크립트가 이번에 추가한 설정만 제거하고 reload를 시도한다. 수동으로 되돌릴 때는 2단계에서 출력한 **Change directory**를 지정하고 서비스 이름을 다시 입력한다.

```powershell
.\scripts\windows-postgres-tls.ps1 -Mode Rollback -ServiceName $service -ChangeDirectory 'C:\ProgramData\cd-postgres-tls-실제폴더명'
```

스크립트는 이 실행에서 넣은 값만 확인해 제거하고 `SHOW ssl`이 `off`인지 검사한다. 다른 관리자가 해당 값을 변경했다면 기존 백업과 실제 설정을 대조한 뒤 조정한다. 인증서와 백업은 작업 폴더에 보존된다.
