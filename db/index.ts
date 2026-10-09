import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema-postgres";
import { getPostgresConnection } from "./connection";

const staticRendering = process.env.NEXT_OUTPUT_MODE === "export" && process.env.STATIC_PREPARING !== "1";
const connection = staticRendering
  ? { host: "127.0.0.1", port: 1, user: "static-render-no-db", password: "", database: "unused", ssl: false as const }
  : getPostgresConnection(process.env);

// Postgres 클라이언트 초기화 (병렬 빌드 최적화)
const connectionOptions = {
  max: 4, // 병렬 빌드 시 적은 연결 수 (chunk당 2개만 사용)
  idle_timeout: 20, // 더 짧은 idle timeout (빠른 연결 반환)
  connect_timeout: 30, // connection timeout
  max_lifetime: 60 * 30, // 30분 후 연결 재사용
  prepare: false, // prepared statements 비활성화 (병렬 빌드 최적화)
  onnotice: () => { }, // notice 무시
};
const sql = "url" in connection
  ? postgres(connection.url, connectionOptions)
  : postgres({ ...connectionOptions, ...connection });

// Drizzle ORM 초기화
export const db = drizzle(sql, {
  schema,
  logger: process.env.NODE_ENV !== "production",
});

// 데이터베이스 상태 확인 함수
export async function checkDatabaseConnection() {
  try {
    await sql`SELECT 1`;
    return { connected: true };
  } catch (error) {
    console.error("Database connection error:", error);
    return { connected: false, error };
  }
}

// 빌드 완료 시 DB 연결 정리 함수
export async function closeDatabase() {
  try {
    await sql.end({ timeout: 5 }); // 5초 타임아웃으로 모든 연결 종료
    console.log("Database connections closed successfully");
  } catch (error) {
    console.error("Error closing database connections:", error);
  }
}

// Node.js 프로세스 종료 시 자동으로 연결 정리
if (typeof process !== 'undefined') {
  // SIGTERM 시그널 처리 (일반 종료)
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing database connections...');
    await closeDatabase();
    process.exit(0);
  });

  // SIGINT 시그널 처리 (Ctrl+C)
  process.on('SIGINT', async () => {
    console.log('SIGINT received, closing database connections...');
    await closeDatabase();
    process.exit(0);
  });

  // 빌드 완료 시 연결 정리 (Next.js static export)
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build') {
    process.on('beforeExit', async () => {
      console.log('Build phase ending, closing database connections...');
      await closeDatabase();
    });
  }
}
