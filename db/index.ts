import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema-postgres"; // Adjust the import path as needed

// 환경 변수 검증
if (
  !process.env.DATABASE_URL &&
  (!process.env.POSTGRES_HOST ||
    !process.env.POSTGRES_PORT ||
    !process.env.POSTGRES_USER ||
    !process.env.POSTGRES_PASSWORD ||
    !process.env.POSTGRES_DB)
) {
  throw new Error(
    "DATABASE_URL 또는 POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB를 모두 설정해주세요."
  );
}

// Postgres 클라이언트 초기화
const connectionString =
  process.env.DATABASE_URL ??
  `postgres://${process.env.POSTGRES_USER}:${encodeURIComponent(
    process.env.POSTGRES_PASSWORD!
  )}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB
  }`;

// Postgres 클라이언트 초기화 (병렬 빌드 최적화)
const sql = postgres(connectionString, {
  max: process.env.NODE_ENV === 'production' ? 5 : 10, // 병렬 빌드를 위한 연결 풀 증가
  idle_timeout: 60, // 더 긴 idle timeout
  connect_timeout: 60, // 더 긴 connection timeout
  prepare: false, // prepared statements 비활성화
  onnotice: () => { }, // notice 무시
  ssl: false, // SSL 완전 비활성화 (로컬 DB)
});

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
