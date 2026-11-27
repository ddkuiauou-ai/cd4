#Requires -Version 5.1
#Requires -RunAsAdministrator
[CmdletBinding()]
param(
    [ValidateSet('Inspect', 'Enable', 'Rollback')][string]$Mode = 'Inspect',
    [string]$ServiceName,
    [string]$DbUser = 'postgres',
    [string]$Database = 'postgres',
    [string]$AdminAddress = '127.0.0.1',
    [ValidateRange(1, 65535)][int]$Port,
    [string]$TlsHost,
    [string]$OpenSsl,
    [string]$ChangeDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$adminIp = $null
if (-not [Net.IPAddress]::TryParse($AdminAddress, [ref]$adminIp) -or -not [Net.IPAddress]::IsLoopback($adminIp)) {
    throw '-AdminAddress must be a loopback IP address.'
}
$AdminAddress = $adminIp.ToString()
$listenAddresses = @($AdminAddress, $(if ($adminIp.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork) { '0.0.0.0' } else { '::' }))
$services = @(Get-CimInstance -ClassName Win32_Service | Where-Object {
    $_.State -eq 'Running' -and $_.PathName -match '(?i)(pg_ctl|postgres)\.exe(?:"|\s|$)' -and
        (-not $ServiceName -or $_.Name -eq $ServiceName)
})
if ($services.Count -ne 1) {
    $services | Select-Object Name, State, StartName | Format-Table | Out-Host
    throw 'Select one running native PostgreSQL Windows service with -ServiceName.'
}
$service = $services[0]
$serviceCommand = [regex]::Match($service.PathName, '^\s*(?:"(?<exe>[^"]+)"|(?<exe>\S+))')
$bin = Split-Path -Parent ([Environment]::ExpandEnvironmentVariables($serviceCommand.Groups['exe'].Value))
$psql = Join-Path $bin 'psql.exe'
if (-not (Test-Path -LiteralPath $psql -PathType Leaf)) { throw 'psql.exe was not found beside the PostgreSQL service executable.' }

$serverPids = @($service.ProcessId) + @(Get-CimInstance -ClassName Win32_Process `
    -Filter "ParentProcessId = $($service.ProcessId) AND Name = 'postgres.exe'" | Select-Object -ExpandProperty ProcessId)
$ports = @(Get-NetTCPConnection -State Listen | Where-Object { $_.OwningProcess -in $serverPids -and $_.LocalAddress -in $listenAddresses } |
    Select-Object -ExpandProperty LocalPort -Unique)
if (-not $PSBoundParameters.ContainsKey('Port') -and $ports.Count -eq 1) { $Port = $ports[0] }
if ($Port -notin $ports) {
    $found = if ($ports.Count) { $ports -join ', ' } else { 'none' }
    throw "Listening ports for $($service.Name) at ${AdminAddress}: $found. Select the correct -Port or -AdminAddress."
}

function ConnField([string]$Value) { "'" + $Value.Replace('\', '\\').Replace("'", "\'") + "'" }
function SqlField([string]$Value) { "'" + $Value.Replace('\', '/').Replace("'", "''") + "'" }

function Invoke-Psql([string[]]$Commands, [string]$VerifyHost, [string]$RootCert) {
    $connection = "hostaddr=$(ConnField $AdminAddress) port=$Port user=$(ConnField $DbUser) dbname=$(ConnField $Database) connect_timeout=5 gssencmode=disable"
    if ($VerifyHost) {
        $connection += " host=$(ConnField $VerifyHost) sslmode=verify-full sslrootcert=$(ConnField $RootCert)"
    } else { $connection += " host=$(ConnField $AdminAddress) sslmode=prefer" }
    $commandArgs = @('-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-d', $connection)
    foreach ($command in $Commands) { $commandArgs += @('-c', $command) }
    $output = & $psql @commandArgs
    if ($LASTEXITCODE -ne 0) { throw 'Local psql command failed.' }
    $output
}

$inspectSql = @'
SELECT json_build_object('Version', current_setting('server_version'), 'Port', inet_server_port(),
  'ConfigFile', current_setting('config_file'), 'HbaFile', current_setting('hba_file'),
  'DataDirectory', current_setting('data_directory'), 'SSL', current_setting('ssl'),
  'Certificate', current_setting('ssl_cert_file'), 'PrivateKey', current_setting('ssl_key_file'),
  'Superuser', (SELECT rolsuper FROM pg_roles WHERE rolname = current_user));
'@
$server = Invoke-Psql @($inspectSql) | ConvertFrom-Json
if ($server.Port -ne $Port) { throw 'The SQL connection returned a different PostgreSQL port.' }
[PSCustomObject]@{ Service = $service.Name; Account = $service.StartName; Version = $server.Version; Port = $server.Port;
    ConfigFile = $server.ConfigFile; HbaFile = $server.HbaFile; DataDirectory = $server.DataDirectory;
    TLS = $server.SSL; Certificate = $server.Certificate; PrivateKey = $server.PrivateKey } | Format-List | Out-Host
if ($Mode -eq 'Inspect') { return }
if (-not $server.Superuser) { throw 'Use a PostgreSQL superuser for ALTER SYSTEM.' }

$sslNames = "'ssl_cert_file','ssl_key_file','ssl'"
$autoSql = "SELECT coalesce(json_object_agg(name, setting), '{}'::json) FROM pg_file_settings " +
    "WHERE name IN ($sslNames) AND replace(sourcefile, chr(92), '/') LIKE '%/postgresql.auto.conf';"

function Confirm-Reload() {
    if ((Invoke-Psql @('SELECT pg_reload_conf();')) -ne 't') { throw 'PostgreSQL did not accept the reload.' }
}

function Remove-ManagedSettings($Record) {
    if ($Record.Service -ne $service.Name -or $Record.DataDirectory -ne $server.DataDirectory) {
        throw 'The rollback record belongs to a different PostgreSQL cluster.'
    }
    $actual = Invoke-Psql @($autoSql) | ConvertFrom-Json
    $commands = @()
    foreach ($property in $actual.PSObject.Properties) {
        if ($property.Value -ne $Record.Settings.($property.Name)) { throw 'A TLS setting changed after setup. Inspect it before rolling back.' }
        $commands += "ALTER SYSTEM RESET $($property.Name);"
    }
    if ($commands.Count) { Invoke-Psql $commands | Out-Null }
    Confirm-Reload
}

if ($Mode -eq 'Rollback') {
    if (-not $ChangeDirectory) { throw 'Provide the change directory printed during setup with -ChangeDirectory.' }
    $recordFile = Join-Path $ChangeDirectory 'authority\change.json'
    $record = Get-Content -LiteralPath $recordFile -Raw | ConvertFrom-Json
    if ((Read-Host "Type $($service.Name) to remove the TLS settings created by this script") -cne $service.Name) {
        throw 'Service-name confirmation did not match.'
    }
    Remove-ManagedSettings $record
    Start-Sleep -Seconds 1
    if ((Invoke-Psql @('SHOW ssl;')) -ne 'off') { throw 'TLS is still active. Inspect the PostgreSQL configuration and logs.' }
    Write-Host 'TLS settings removed and PostgreSQL reloaded.'
    return
}

if ($server.SSL -ne 'off') { throw 'TLS is already enabled. Inspect the existing certificate and reuse its trust chain.' }
$existing = Invoke-Psql @($autoSql) | ConvertFrom-Json
if ($existing.PSObject.Properties | Select-Object -First 1) {
    throw 'postgresql.auto.conf already contains TLS settings. Review them before using this setup.'
}
$preflightSql = 'SELECT count(*) FROM pg_file_settings WHERE error IS NOT NULL;'
if ((Invoke-Psql @($preflightSql)) -ne '0') { throw 'PostgreSQL reports configuration errors in pg_file_settings.' }
if ((Invoke-Psql @("SELECT count(*) FROM pg_settings WHERE name IN ($sslNames) AND source = 'command line';")) -ne '0') {
    throw 'The service command line overrides a TLS setting.'
}

$hostIp = $null
if ($TlsHost -match '^[0-9A-Fa-f.:]+$' -and $TlsHost -match '[.:]' -and [Net.IPAddress]::TryParse($TlsHost, [ref]$hostIp)) {
    if ($hostIp.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork -and $hostIp.ToString() -cne $TlsHost) {
        throw 'Use the IPv4 address in canonical dotted decimal form.'
    }
    $san = "IP:${TlsHost}"
} else {
    if ($TlsHost.Length -gt 253 -or $TlsHost -notmatch '^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$') {
        throw 'Set -TlsHost to the exact DNS hostname or bare IP address in Actions POSTGRES_HOST.'
    }
    $san = "DNS:${TlsHost}"
}
if (-not $OpenSsl) {
    $installed = Get-Command openssl.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    $candidates = @(Join-Path $bin 'openssl.exe')
    if ($installed) { $candidates += $installed.Source }
    $candidates += @((Join-Path $env:ProgramFiles 'Git\mingw64\bin\openssl.exe'), (Join-Path $env:ProgramFiles 'Git\usr\bin\openssl.exe'))
    $OpenSsl = $candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
}
if (-not $OpenSsl -or -not (Test-Path -LiteralPath $OpenSsl -PathType Leaf)) { throw 'Provide the path to OpenSSL 3 with -OpenSsl.' }
$opensslVersion = & $OpenSsl version
if ($LASTEXITCODE -ne 0 -or $opensslVersion -notmatch '^OpenSSL [3-9]\.') { throw 'This script requires OpenSSL 3 or later.' }
Write-Host $opensslVersion
if ((Read-Host "Type $($service.Name) to enable TLS for $TlsHost on port $Port") -cne $service.Name) {
    throw 'Service-name confirmation did not match.'
}

function Invoke-OpenSsl([string[]]$CommandArgs) {
    & $OpenSsl @CommandArgs
    if ($LASTEXITCODE -ne 0) { throw 'OpenSSL command failed.' }
}

$sidType = [Security.Principal.SecurityIdentifier]
$admins = [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544')
$account = $service.StartName -replace '^\.\\', "${env:COMPUTERNAME}\"
$serviceSid = switch -Regex ($account) {
    '^(LocalSystem|NT AUTHORITY\\SYSTEM)$' { [Security.Principal.SecurityIdentifier]::new('S-1-5-18'); break }
    '^(NT AUTHORITY\\)?Local ?Service$' { [Security.Principal.SecurityIdentifier]::new('S-1-5-19'); break }
    '^(NT AUTHORITY\\)?Network ?Service$' { [Security.Principal.SecurityIdentifier]::new('S-1-5-20'); break }
    default { [Security.Principal.NTAccount]::new($account).Translate($sidType) }
}

function Set-PrivateDirectory([string]$Directory, [string]$ServiceInheritance) {
    $acl = [Security.AccessControl.DirectorySecurity]::new()
    $acl.SetAccessRuleProtection($true, $false)
    $acl.SetOwner($admins)
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($admins, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
    if ($ServiceInheritance) {
        $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($serviceSid, 'ReadAndExecute', $ServiceInheritance, 'None', 'Allow'))
    }
    Set-Acl -LiteralPath $Directory -AclObject $acl
    $applied = Get-Acl -LiteralPath $Directory
    $expected = @($admins.Value)
    if ($ServiceInheritance) { $expected += $serviceSid.Value }
    $allowed = @($applied.GetAccessRules($true, $true, $sidType) | ForEach-Object { $_.IdentityReference.Value })
    if (-not $applied.AreAccessRulesProtected -or (Compare-Object $expected $allowed)) {
        throw "The intended key-directory ACL could not be verified at $Directory."
    }
}

$ChangeDirectory = Join-Path $env:ProgramData ('cd-postgres-tls-' + [Guid]::NewGuid().ToString('N'))
$authority = Join-Path $ChangeDirectory 'authority'
$leaf = Join-Path $ChangeDirectory 'server'
[IO.Directory]::CreateDirectory($ChangeDirectory) | Out-Null
Set-PrivateDirectory $ChangeDirectory 'None'
[IO.Directory]::CreateDirectory($authority) | Out-Null
Set-PrivateDirectory $authority ''
[IO.Directory]::CreateDirectory($leaf) | Out-Null
Set-PrivateDirectory $leaf 'ContainerInherit,ObjectInherit'

$rootKey = Join-Path $authority 'root.key'
$rootCert = Join-Path $authority 'root.crt'
$serverKey = Join-Path $leaf 'server.key'
$serverCert = Join-Path $leaf 'server.crt'
$request = Join-Path $authority 'server.csr'
$extensions = Join-Path $authority 'server-ext.cnf'
$serial = Join-Path $authority 'root.srl'
Write-Host "Change directory $ChangeDirectory"
$autoConfig = Join-Path $server.DataDirectory 'postgresql.auto.conf'
if (Test-Path -LiteralPath $autoConfig -PathType Leaf) {
    [IO.File]::WriteAllBytes((Join-Path $authority 'postgresql.auto.conf.before'), [IO.File]::ReadAllBytes($autoConfig))
}
Write-Host 'OpenSSL prompts for a CA key passphrase. Retain it for certificate renewal.'
Invoke-OpenSsl @('genpkey', '-algorithm', 'RSA', '-aes-256-cbc', '-pkeyopt', 'rsa_keygen_bits:3072', '-out', $rootKey)
Invoke-OpenSsl @('req', '-x509', '-new', '-key', $rootKey, '-sha256', '-days', '3650', '-subj', '/CN=CD PostgreSQL CA',
    '-addext', 'basicConstraints=critical,CA:TRUE,pathlen:0', '-addext', 'keyUsage=critical,keyCertSign,cRLSign',
    '-addext', 'subjectKeyIdentifier=hash', '-out', $rootCert)
Invoke-OpenSsl @('genpkey', '-algorithm', 'RSA', '-pkeyopt', 'rsa_keygen_bits:2048', '-out', $serverKey)
Invoke-OpenSsl @('req', '-new', '-key', $serverKey, '-subj', '/CN=CD PostgreSQL', '-out', $request)
[IO.File]::WriteAllLines($extensions, @('basicConstraints=critical,CA:FALSE', 'keyUsage=critical,digitalSignature,keyEncipherment',
    'extendedKeyUsage=serverAuth', "subjectAltName=$san"))
Invoke-OpenSsl @('x509', '-req', '-in', $request, '-CA', $rootCert, '-CAkey', $rootKey, '-CAserial', $serial, '-CAcreateserial',
    '-extfile', $extensions, '-days', '365', '-sha256', '-out', $serverCert)
$checkName = if ($san.StartsWith('IP:')) { '-verify_ip' } else { '-verify_hostname' }
Invoke-OpenSsl @('verify', '-CAfile', $rootCert, '-purpose', 'sslserver', $checkName, $TlsHost, $serverCert)

$settings = @{ ssl_cert_file = $serverCert.Replace('\', '/'); ssl_key_file = $serverKey.Replace('\', '/'); ssl = 'on' }
$record = [PSCustomObject]@{ Service = $service.Name; DataDirectory = $server.DataDirectory; Settings = [PSCustomObject]$settings }
$record | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $authority 'change.json') -Encoding UTF8
try {
    Invoke-Psql @("ALTER SYSTEM SET ssl_cert_file = $(SqlField $serverCert);", "ALTER SYSTEM SET ssl_key_file = $(SqlField $serverKey);",
        "ALTER SYSTEM SET ssl = 'on';") | Out-Null
    Confirm-Reload
    Start-Sleep -Seconds 1
    $tls = Invoke-Psql @("SELECT ssl, version, cipher FROM pg_stat_ssl WHERE pid = pg_backend_pid();") $TlsHost $rootCert
    if ($tls -notmatch '^t\|TLSv[0-9.]+\|.+$') { throw 'The new verify-full session did not confirm PostgreSQL TLS.' }
    Write-Host "Verified TLS $tls"
    Write-Host "Actions POSTGRES_TLS_CA certificate $rootCert"
} catch {
    try { Remove-ManagedSettings $record }
    catch { Write-Warning "Automatic rollback did not finish. Use -Mode Rollback -ChangeDirectory '$ChangeDirectory'." }
    throw
}
