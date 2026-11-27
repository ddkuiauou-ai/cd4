import { checkServerIdentity, type ConnectionOptions } from "node:tls";

type PostgresEnvironment = Readonly<Record<string, string | undefined>>;

type PostgresConnection = { url: string } | {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: false | ConnectionOptions;
};

export function postgresTlsOptions(host: string, ca?: string): ConnectionOptions {
  return {
    rejectUnauthorized: true,
    ...(ca ? { ca } : {}),
    checkServerIdentity: (_, certificate) => checkServerIdentity(host, certificate),
  };
}

export function getPostgresConnection(env: PostgresEnvironment): PostgresConnection {
  const sslMode = env.STATIC_RELEASE_POSTGRES_TLS;
  if (sslMode && sslMode !== "verify-full") throw new Error("STATIC_RELEASE_POSTGRES_TLS must be verify-full.");
  if (env.DATABASE_URL) {
    if (sslMode) throw new Error("Hosted release TLS requires the PostgreSQL host and port fields.");
    // The PostgreSQL driver also supports multi-host URLs, which URL rejects.
    if (!/^postgres(?:ql)?:\/\//.test(env.DATABASE_URL)) {
      throw new Error("DATABASE_URL은 postgres:// 또는 postgresql:// 형식이어야 합니다.");
    }
    return { url: env.DATABASE_URL };
  }

  const required = ["POSTGRES_HOST", "POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB"] as const;
  const missing = required.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`DATABASE_URL 또는 PostgreSQL 환경변수를 설정해주세요. 누락: ${missing.join(", ")}`);
  }

  const port = env.POSTGRES_PORT || "5432";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error("POSTGRES_PORT는 1부터 65535 사이의 정수여야 합니다.");
  }

  // Keep names and credentials verbatim; postgres-js does not decode URL paths.
  return {
    host: env.POSTGRES_HOST!,
    port: Number(port),
    user: env.POSTGRES_USER!,
    password: env.POSTGRES_PASSWORD!,
    database: env.POSTGRES_DB!,
    ssl: sslMode ? postgresTlsOptions(env.POSTGRES_HOST!, env.POSTGRES_TLS_CA) : false,
  };
}
