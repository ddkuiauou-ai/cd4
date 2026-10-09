import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  index,
  timestamp,
  bigint,
  primaryKey,
  uniqueIndex,
  varchar,
  pgEnum,
  check,
  numeric,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// =========================================================
// Enums
// =========================================================

export const metricTypeEnum = pgEnum("metric_type", [
  "marketcap",
  "bps",
  "per",
  "pbr",
  "eps",
  "div",
  "dps",
]);

export type MetricType = (typeof metricTypeEnum.enumValues)[number];

export const sourceFieldStateEnum = pgEnum("source_field_state", [
  "provided", "source_missing", "unsupported",
]);
export const resultFieldStateEnum = pgEnum("result_field_state", [
  "provided", "source_missing", "unsupported", "row_missing", "unexplained_missing", "no_observation",
]);
export const rankingStateEnum = pgEnum("ranking_state", ["included", "excluded"]);
export const marketcapCompletenessEnum = pgEnum("marketcap_completeness", [
  "complete", "missing_input", "insufficient_evidence",
]);
export const resultKindEnum = pgEnum("result_kind", [
  "security_latest", "company_marketcap", "security_rank",
]);

export type SourceFieldState = (typeof sourceFieldStateEnum.enumValues)[number];
export type ResultFieldState = (typeof resultFieldStateEnum.enumValues)[number];
export type RankingState = (typeof rankingStateEnum.enumValues)[number];
export type ResultKind = (typeof resultKindEnum.enumValues)[number];

const dailyCheck = (name: string, column: AnyPgColumn) => check(name,
  sql`${column} IS NULL OR (isfinite(${column}) AND (${column} AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00')`);
const nonemptyCheck = (name: string, column: AnyPgColumn) => check(name,
  sql`${column} IS NULL OR length(btrim(${column})) > 0`);
const finiteCheck = (name: string, column: AnyPgColumn) => check(name,
  sql`${column} IS NULL OR (${column} > '-Infinity'::double precision AND ${column} < 'Infinity'::double precision)`);
const nonnegativeCheck = (name: string, column: AnyPgColumn) => check(name,
  sql`${column} IS NULL OR ${column} >= 0`);
const metadataCheck = (name: string, key: AnyPgColumn, revision: AnyPgColumn, calculation: AnyPgColumn) => check(name,
  sql`(${key} IS NULL AND ${revision} IS NULL AND ${calculation} IS NULL) OR
    (${key} IS NOT NULL AND length(btrim(${key})) > 0 AND ${revision} IS NOT NULL AND ${revision} > 0 AND ${calculation} IS NOT NULL)`);
const rawStateCheck = (name: string, value: AnyPgColumn, state: AnyPgColumn) => check(name,
  sql`(${state} = 'provided') = (${value} IS NOT NULL)`);
const latestMetricCheck = (name: string, value: AnyPgColumn, observedAt: AnyPgColumn,
  state: AnyPgColumn, source: AnyPgColumn, last: AnyPgColumn, lastDate: AnyPgColumn, lastSource: AnyPgColumn) => check(name,
  sql`(
    (${state} = 'no_observation' AND ${value} IS NULL AND ${observedAt} IS NULL AND ${source} IS NULL
      AND ${last} IS NULL AND ${lastDate} IS NULL AND ${lastSource} IS NULL)
    OR (${state} = 'provided' AND ${value} IS NOT NULL AND ${observedAt} IS NOT NULL
      AND ${source} IS NOT NULL AND length(btrim(${source})) > 0
      AND ${last} IS NOT NULL AND ${lastDate} IS NOT NULL AND ${lastSource} IS NOT NULL
      AND ${value} = ${last} AND ${observedAt} = ${lastDate} AND ${source} = ${lastSource})
    OR (${state} IN ('source_missing','unsupported','row_missing','unexplained_missing')
      AND ${value} IS NULL AND ${observedAt} IS NOT NULL AND ${source} IS NOT NULL AND length(btrim(${source})) > 0
      AND ((${last} IS NULL AND ${lastDate} IS NULL AND ${lastSource} IS NULL)
        OR (${last} IS NOT NULL AND ${lastDate} IS NOT NULL AND ${lastSource} IS NOT NULL
          AND length(btrim(${lastSource})) > 0 AND ${lastDate} < ${observedAt})))
  )`);

// The single header represents the currently published result. Execution history belongs to tem.
export const resultPublication = pgTable("result_publication", {
  publicationKey: text("publication_key").primaryKey(),
  resultKind: resultKindEnum("result_kind").notNull(),
  scopeKey: text("scope_key").notNull(),
  metricType: metricTypeEnum("metric_type"),
  asOf: timestamp("as_of", { mode: "date", withTimezone: true }).notNull(),
  revision: bigint("revision", { mode: "bigint" }).notNull(),
  calculationId: uuid("calculation_id").notNull(),
  rowCount: integer("row_count").notNull(),
  includedCount: integer("included_count"),
  inputRef: text("input_ref").notNull(),
  ruleRef: text("rule_ref").notNull(),
  publishedAt: timestamp("published_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  dailyCheck("result_publication_daily_check", table.asOf),
  nonemptyCheck("result_publication_scope_check", table.scopeKey),
  nonemptyCheck("result_publication_input_ref_check", table.inputRef),
  nonemptyCheck("result_publication_rule_ref_check", table.ruleRef),
  check("result_publication_revision_check", sql`${table.revision} > 0`),
  check("result_publication_counts_check", sql`${table.rowCount} >= 0 AND
    ((${table.resultKind} = 'security_latest' AND ${table.includedCount} IS NULL)
    OR (${table.resultKind} IN ('company_marketcap','security_rank') AND ${table.includedCount} IS NOT NULL
      AND ${table.includedCount} >= 0 AND ${table.includedCount} <= ${table.rowCount}))`),
  check("result_publication_kind_metric_check", sql`(${table.resultKind} = 'security_rank') = (${table.metricType} IS NOT NULL)`),
  check("result_publication_key_check", sql`${table.publicationKey} = ${table.resultKind}::text || '/' || ${table.scopeKey} ||
    CASE WHEN ${table.metricType} IS NULL THEN '' ELSE '/' || ${table.metricType}::text END`),
  check("result_publication_published_at_check", sql`isfinite(${table.publishedAt})`),
]);

// =========================================================
// Table Definitions
// =========================================================

export const company = pgTable(
  "company",
  {
    companyId: text("company_id").primaryKey(),
    name: text("name").notNull(),
    korName: text("kor_name").notNull(),
    Address: text("address"),
    korAddress: text("kor_address"),
    country: text("country"),
    type: text("type"),
    tel: text("tel"),
    fax: text("fax"),
    postalCode: text("postal_code"),
    homepage: text("homepage"),
    employees: integer("employees"),
    industry: text("industry"),
    establishedDate: timestamp("established_date", { mode: "date" }),
    marketcap: numeric("marketcap"),
    marketcapRank: integer("marketcap_rank"),
    marketcapPriorRank: integer("marketcap_prior_rank"),
    marketcapDate: timestamp("marketcap_date", { mode: "date", withTimezone: true }),
    marketcapCompleteness: marketcapCompletenessEnum("marketcap_completeness"),
    rankingState: rankingStateEnum("ranking_state"),
    exclusionReason: text("exclusion_reason"),
    resultSourceRef: text("result_source_ref"),
    publicationKey: text("publication_key").references(() => resultPublication.publicationKey),
    resultRevision: bigint("result_revision", { mode: "bigint" }),
    calculationId: uuid("calculation_id"),
    logo: text("logo"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    metadataCheck("company_result_metadata_check", table.publicationKey, table.resultRevision, table.calculationId),
    check("company_publication_kind_check", sql`${table.publicationKey} IS NULL
      OR split_part(${table.publicationKey}, '/', 1) = 'company_marketcap'`),
    dailyCheck("company_marketcap_daily_check", table.marketcapDate),
    check("company_marketcap_numeric_check", sql`${table.marketcap} IS NULL OR
      (${table.marketcap} >= 0 AND ${table.marketcap} < 'Infinity'::numeric AND ${table.marketcap} = trunc(${table.marketcap}))`),
    check("company_result_state_check", sql`
      (${table.publicationKey} IS NULL AND ${table.marketcap} IS NULL AND ${table.marketcapDate} IS NULL
        AND ${table.marketcapCompleteness} IS NULL AND ${table.rankingState} IS NULL AND ${table.marketcapRank} IS NULL
        AND ${table.marketcapPriorRank} IS NULL AND ${table.exclusionReason} IS NULL AND ${table.resultSourceRef} IS NULL)
      OR (${table.publicationKey} IS NOT NULL AND ${table.marketcapCompleteness} IS NOT NULL AND ${table.marketcapDate} IS NOT NULL
        AND ${table.rankingState} IS NOT NULL AND ${table.resultSourceRef} IS NOT NULL AND length(btrim(${table.resultSourceRef})) > 0
        AND ((${table.marketcapCompleteness} = 'complete') = (${table.marketcap} IS NOT NULL))
        AND ((${table.rankingState} = 'included' AND ${table.marketcap} IS NOT NULL AND ${table.marketcapRank} IS NOT NULL AND ${table.marketcapRank} > 0 AND ${table.exclusionReason} IS NULL)
          OR (${table.rankingState} = 'excluded' AND ${table.marketcapRank} IS NULL AND ${table.exclusionReason} IS NOT NULL AND length(btrim(${table.exclusionReason})) > 0)))`),
    check("company_prior_rank_check", sql`${table.marketcapPriorRank} IS NULL OR ${table.marketcapPriorRank} > 0`),
    index("company_publication_idx").on(table.publicationKey),
    index("company_name_idx").on(table.name),
    index("company_kor_name_idx").on(table.korName),
    index("company_country_idx").on(table.country),
    index("company_type_idx").on(table.type),
    index("company_created_at_idx").on(table.createdAt),
    index("idx_company_marketcap_listed")
      .on(sql`${table.marketcap} DESC NULLS LAST`)
      .where(sql`${table.type} = '상장법인'`),
  ]
);

export const pension = pgTable(
  "pension",
  {
    id: serial("id").primaryKey(),
    dataCreatedYm: timestamp("data_created_ym", { mode: "date" }).notNull(), // 자료생성년월
    companyId: varchar("company_id", { length: 20 }).references(
      () => company.companyId
    ),
    companyName: varchar("company_name", { length: 100 }).notNull(), // 실제 최대: 93자 → 100자로 여유
    businessRegNum: varchar("business_reg_num", { length: 10 }), // 실제 최대: 6자 → 10자로 여유
    joinStatus: varchar("join_status", { length: 5 }), // 실제 최대: 1자 → 5자로 여유
    zipCode: varchar("zip_code", { length: 10 }), // 실제 최대: 7자 → 10자로 여유
    lotNumberAddress: varchar("lot_number_address", { length: 50 }), // 실제 최대: 22자 → 50자로 여유
    roadNameAddress: varchar("road_name_address", { length: 50 }), // 실제 최대: 29자 → 50자로 여유
    legalDongAddrCode: varchar("legal_dong_addr_code", { length: 15 }), // 추정 10자 → 15자
    adminDongAddrCode: varchar("admin_dong_addr_code", { length: 15 }), // 추정 10자 → 15자
    addrSidoCode: varchar("addr_sido_code", { length: 5 }), // 추정 2자 → 5자
    addrSigunguCode: varchar("addr_sigungu_code", { length: 5 }), // 추정 3자 → 5자
    addrEmdongCode: varchar("addr_emdong_code", { length: 5 }), // 추정 3자 → 5자
    workplaceType: varchar("workplace_type", { length: 5 }), // 실제 최대: 1자 → 5자로 여유
    industryCode: varchar("industry_code", { length: 10 }), // 실제 최대: 6자 → 10자로 여유
    industryName: varchar("industry_name", { length: 50 }), // 실제 최대: 33자 → 50자로 여유
    appliedAt: timestamp("applied_at", { mode: "date" }), // 적용일자
    reRegisteredAt: timestamp("re_registered_at", { mode: "date" }), // 재등록일자
    withdrawnAt: timestamp("withdrawn_at", { mode: "date" }), // 탈퇴일자
    subscriberCount: integer("subscriber_count"), // 가입자수
    monthlyNoticeAmount: bigint("monthly_notice_amount", { mode: "number" }), // 당월고지금액
    newSubscribers: integer("new_subscribers"), // 신규취득자수
    lostSubscribers: integer("lost_subscribers"), // 상실가입자수
    avgFee: integer("avg_fee"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  () => [
    // 🔥 최적화된 인덱스 구성 (기존보다 줄임)
    // index("pension_opt_date_idx").on(table.dataCreatedYm),
    // index("pension_opt_company_name_idx").on(table.companyName),
    // index("pension_opt_industry_code_idx").on(table.industryCode),
    // index("pension_opt_zip_code_idx").on(table.zipCode),
    // 🔥 핵심 복합 인덱스만 유지
    // index("pension_opt_region_industry_idx").on(table.addrSidoCode, table.addrSigunguCode, table.industryCode),
    // 🔥 중복 방지를 위한 유니크 인덱스
    // uniqueIndex("pension_opt_unique_business_month").on(
    //   table.dataCreatedYm,
    //   table.companyName,
    //   table.zipCode,
    //   table.subscriberCount,
    //   table.monthlyNoticeAmount
    // ),
  ]
);

export const displayName = pgTable(
  "display_name",
  {
    id: serial("id").primaryKey(),
    value: text("value").notNull(),
    order: integer("order").default(0),
    companyId: text("company_id")
      .notNull()
      .references(() => company.companyId),
    companyName: text("company_name").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("display_name_company_id_idx").on(table.companyId),
    index("display_name_value_idx").on(table.value),
    index("display_name_created_at_idx").on(table.createdAt),
  ]
);

export const searchName = pgTable(
  "search_name",
  {
    id: serial("id").primaryKey(),
    value: text("value").notNull(),
    companyId: text("company_id")
      .notNull()
      .references(() => company.companyId),
    companyName: text("company_name").notNull(),
    order: integer("order").default(0),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("search_name_company_id_idx").on(table.companyId),
    index("search_name_value_idx").on(table.value),
    index("search_name_created_at_idx").on(table.createdAt),
  ]
);

export const security = pgTable(
  "security",
  {
    securityId: text("security_id").primaryKey(),
    companyId: text("company_id").references(() => company.companyId),
    ticker: text("ticker").notNull(),
    name: text("name").notNull(),
    korName: text("kor_name").notNull(),
    listingDate: timestamp("listing_date", { mode: "date", withTimezone: true }),
    delistingDate: timestamp("delisting_date", { mode: "date", withTimezone: true }),
    type: text("type"),
    exchange: text("exchange").notNull(),
    country: text("country"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    price: doublePrecision("price"),
    priceDate: timestamp("price_date", { mode: "date", withTimezone: true }),
    shares: bigint("shares", { mode: "bigint" }),
    sharesDate: timestamp("shares_date", { mode: "date", withTimezone: true }),
    marketcap: bigint("marketcap", { mode: "bigint" }),
    marketcapDate: timestamp("marketcap_date", { mode: "date", withTimezone: true }),
    bps: doublePrecision("bps"),
    bpsDate: timestamp("bps_date", { mode: "date", withTimezone: true }),
    per: doublePrecision("per"),
    perDate: timestamp("per_date", { mode: "date", withTimezone: true }),
    pbr: doublePrecision("pbr"),
    pbrDate: timestamp("pbr_date", { mode: "date", withTimezone: true }),
    eps: doublePrecision("eps"),
    epsDate: timestamp("eps_date", { mode: "date", withTimezone: true }),
    div: doublePrecision("div"),
    divDate: timestamp("div_date", { mode: "date", withTimezone: true }),
    dps: doublePrecision("dps"),
    dpsDate: timestamp("dps_date", { mode: "date", withTimezone: true }),
    priceState: resultFieldStateEnum("price_state").default("no_observation").notNull(),
    priceSourceRef: text("price_source_ref"),
    priceLastProvided: doublePrecision("price_last_provided"),
    priceLastProvidedDate: timestamp("price_last_provided_date", { mode: "date", withTimezone: true }),
    priceLastProvidedSourceRef: text("price_last_provided_source_ref"),
    sharesState: resultFieldStateEnum("shares_state").default("no_observation").notNull(),
    sharesSourceRef: text("shares_source_ref"),
    sharesLastProvided: bigint("shares_last_provided", { mode: "bigint" }),
    sharesLastProvidedDate: timestamp("shares_last_provided_date", { mode: "date", withTimezone: true }),
    sharesLastProvidedSourceRef: text("shares_last_provided_source_ref"),
    marketcapState: resultFieldStateEnum("marketcap_state").default("no_observation").notNull(),
    marketcapSourceRef: text("marketcap_source_ref"),
    marketcapLastProvided: bigint("marketcap_last_provided", { mode: "bigint" }),
    marketcapLastProvidedDate: timestamp("marketcap_last_provided_date", { mode: "date", withTimezone: true }),
    marketcapLastProvidedSourceRef: text("marketcap_last_provided_source_ref"),
    bpsState: resultFieldStateEnum("bps_state").default("no_observation").notNull(),
    bpsSourceRef: text("bps_source_ref"),
    bpsLastProvided: doublePrecision("bps_last_provided"),
    bpsLastProvidedDate: timestamp("bps_last_provided_date", { mode: "date", withTimezone: true }),
    bpsLastProvidedSourceRef: text("bps_last_provided_source_ref"),
    perState: resultFieldStateEnum("per_state").default("no_observation").notNull(),
    perSourceRef: text("per_source_ref"),
    perLastProvided: doublePrecision("per_last_provided"),
    perLastProvidedDate: timestamp("per_last_provided_date", { mode: "date", withTimezone: true }),
    perLastProvidedSourceRef: text("per_last_provided_source_ref"),
    pbrState: resultFieldStateEnum("pbr_state").default("no_observation").notNull(),
    pbrSourceRef: text("pbr_source_ref"),
    pbrLastProvided: doublePrecision("pbr_last_provided"),
    pbrLastProvidedDate: timestamp("pbr_last_provided_date", { mode: "date", withTimezone: true }),
    pbrLastProvidedSourceRef: text("pbr_last_provided_source_ref"),
    epsState: resultFieldStateEnum("eps_state").default("no_observation").notNull(),
    epsSourceRef: text("eps_source_ref"),
    epsLastProvided: doublePrecision("eps_last_provided"),
    epsLastProvidedDate: timestamp("eps_last_provided_date", { mode: "date", withTimezone: true }),
    epsLastProvidedSourceRef: text("eps_last_provided_source_ref"),
    divState: resultFieldStateEnum("div_state").default("no_observation").notNull(),
    divSourceRef: text("div_source_ref"),
    divLastProvided: doublePrecision("div_last_provided"),
    divLastProvidedDate: timestamp("div_last_provided_date", { mode: "date", withTimezone: true }),
    divLastProvidedSourceRef: text("div_last_provided_source_ref"),
    dpsState: resultFieldStateEnum("dps_state").default("no_observation").notNull(),
    dpsSourceRef: text("dps_source_ref"),
    dpsLastProvided: doublePrecision("dps_last_provided"),
    dpsLastProvidedDate: timestamp("dps_last_provided_date", { mode: "date", withTimezone: true }),
    dpsLastProvidedSourceRef: text("dps_last_provided_source_ref"),
    publicationKey: text("publication_key").references(() => resultPublication.publicationKey),
    resultRevision: bigint("result_revision", { mode: "bigint" }),
    calculationId: uuid("calculation_id"),
  },
  (table) => [
    metadataCheck("security_result_metadata_check", table.publicationKey, table.resultRevision, table.calculationId),
    check("security_publication_kind_check", sql`${table.publicationKey} IS NULL
      OR split_part(${table.publicationKey}, '/', 1) = 'security_latest'`),
    check("security_unpublished_check", sql`${table.publicationKey} IS NOT NULL OR (${table.priceState} = 'no_observation' AND ${table.sharesState} = 'no_observation' AND ${table.marketcapState} = 'no_observation' AND ${table.bpsState} = 'no_observation' AND ${table.perState} = 'no_observation' AND ${table.pbrState} = 'no_observation' AND ${table.epsState} = 'no_observation' AND ${table.divState} = 'no_observation' AND ${table.dpsState} = 'no_observation')`),
    nonemptyCheck("security_exchange_check", table.exchange),
    nonemptyCheck("security_ticker_check", table.ticker),
    dailyCheck("security_listing_daily_check", table.listingDate),
    dailyCheck("security_delisting_daily_check", table.delistingDate),
    index("security_publication_idx").on(table.publicationKey),
    latestMetricCheck("security_price_result_check", table.price, table.priceDate, table.priceState,
      table.priceSourceRef, table.priceLastProvided, table.priceLastProvidedDate, table.priceLastProvidedSourceRef),
    dailyCheck("security_price_daily_check", table.priceDate),
    dailyCheck("security_price_last_daily_check", table.priceLastProvidedDate),
    finiteCheck("security_price_number_check", table.price),
    finiteCheck("security_price_last_number_check", table.priceLastProvided),
    nonnegativeCheck("security_price_nonnegative_check", table.price),
    nonnegativeCheck("security_price_last_nonnegative_check", table.priceLastProvided),
    latestMetricCheck("security_shares_result_check", table.shares, table.sharesDate, table.sharesState,
      table.sharesSourceRef, table.sharesLastProvided, table.sharesLastProvidedDate, table.sharesLastProvidedSourceRef),
    dailyCheck("security_shares_daily_check", table.sharesDate),
    dailyCheck("security_shares_last_daily_check", table.sharesLastProvidedDate),
    nonnegativeCheck("security_shares_number_check", table.shares),
    nonnegativeCheck("security_shares_last_number_check", table.sharesLastProvided),
    latestMetricCheck("security_marketcap_result_check", table.marketcap, table.marketcapDate, table.marketcapState,
      table.marketcapSourceRef, table.marketcapLastProvided, table.marketcapLastProvidedDate, table.marketcapLastProvidedSourceRef),
    dailyCheck("security_marketcap_daily_check", table.marketcapDate),
    dailyCheck("security_marketcap_last_daily_check", table.marketcapLastProvidedDate),
    nonnegativeCheck("security_marketcap_number_check", table.marketcap),
    nonnegativeCheck("security_marketcap_last_number_check", table.marketcapLastProvided),
    latestMetricCheck("security_bps_result_check", table.bps, table.bpsDate, table.bpsState,
      table.bpsSourceRef, table.bpsLastProvided, table.bpsLastProvidedDate, table.bpsLastProvidedSourceRef),
    dailyCheck("security_bps_daily_check", table.bpsDate),
    dailyCheck("security_bps_last_daily_check", table.bpsLastProvidedDate),
    finiteCheck("security_bps_number_check", table.bps),
    finiteCheck("security_bps_last_number_check", table.bpsLastProvided),
    latestMetricCheck("security_per_result_check", table.per, table.perDate, table.perState,
      table.perSourceRef, table.perLastProvided, table.perLastProvidedDate, table.perLastProvidedSourceRef),
    dailyCheck("security_per_daily_check", table.perDate),
    dailyCheck("security_per_last_daily_check", table.perLastProvidedDate),
    finiteCheck("security_per_number_check", table.per),
    finiteCheck("security_per_last_number_check", table.perLastProvided),
    latestMetricCheck("security_pbr_result_check", table.pbr, table.pbrDate, table.pbrState,
      table.pbrSourceRef, table.pbrLastProvided, table.pbrLastProvidedDate, table.pbrLastProvidedSourceRef),
    dailyCheck("security_pbr_daily_check", table.pbrDate),
    dailyCheck("security_pbr_last_daily_check", table.pbrLastProvidedDate),
    finiteCheck("security_pbr_number_check", table.pbr),
    finiteCheck("security_pbr_last_number_check", table.pbrLastProvided),
    latestMetricCheck("security_eps_result_check", table.eps, table.epsDate, table.epsState,
      table.epsSourceRef, table.epsLastProvided, table.epsLastProvidedDate, table.epsLastProvidedSourceRef),
    dailyCheck("security_eps_daily_check", table.epsDate),
    dailyCheck("security_eps_last_daily_check", table.epsLastProvidedDate),
    finiteCheck("security_eps_number_check", table.eps),
    finiteCheck("security_eps_last_number_check", table.epsLastProvided),
    latestMetricCheck("security_div_result_check", table.div, table.divDate, table.divState,
      table.divSourceRef, table.divLastProvided, table.divLastProvidedDate, table.divLastProvidedSourceRef),
    dailyCheck("security_div_daily_check", table.divDate),
    dailyCheck("security_div_last_daily_check", table.divLastProvidedDate),
    finiteCheck("security_div_number_check", table.div),
    finiteCheck("security_div_last_number_check", table.divLastProvided),
    latestMetricCheck("security_dps_result_check", table.dps, table.dpsDate, table.dpsState,
      table.dpsSourceRef, table.dpsLastProvided, table.dpsLastProvidedDate, table.dpsLastProvidedSourceRef),
    dailyCheck("security_dps_daily_check", table.dpsDate),
    dailyCheck("security_dps_last_daily_check", table.dpsLastProvidedDate),
    finiteCheck("security_dps_number_check", table.dps),
    finiteCheck("security_dps_last_number_check", table.dpsLastProvided),
    index("security_company_id_idx").on(table.companyId),
    index("security_ticker_idx").on(table.ticker),
    index("security_name_idx").on(table.name),
    index("security_kor_name_idx").on(table.korName), // Added new index
    index("security_exchange_idx").on(table.exchange),
    index("security_created_at_idx").on(table.createdAt),
    index("security_exchange_security_id_idx")
      .on(table.exchange, table.securityId)
      .where(sql`${table.delistingDate} IS NULL`),
    index("security_exchange_ticker_idx").on(table.exchange, table.ticker),
    index("idx_security_marketcap_active")
      .on(sql`${table.marketcap} DESC NULLS LAST`)
      .where(sql`${table.delistingDate} IS NULL`),
  ]
);

export const price = pgTable(
  "price",
  {
    id: serial("id").primaryKey(),
    securityId: text("security_id").references(() => security.securityId),
    date: timestamp("date", { mode: "date", withTimezone: true }).notNull(),
    ticker: text("ticker").notNull(),
    sourceRef: text("source_ref").notNull(),
    name: text("name"),
    korName: text("kor_name"),
    exchange: text("exchange").notNull(),
    open: doublePrecision("open").notNull(),
    high: doublePrecision("high").notNull(),
    low: doublePrecision("low").notNull(),
    close: doublePrecision("close").notNull(),
    volume: bigint("volume", { mode: "bigint" }).notNull(),
    fvolume: doublePrecision("fvolume"),
    transaction: bigint("transaction", { mode: "bigint" }),
    rate: doublePrecision("rate"),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    dailyCheck("price_daily_check", table.date),
    nonemptyCheck("price_exchange_check", table.exchange),
    nonemptyCheck("price_ticker_check", table.ticker),
    nonemptyCheck("price_source_ref_check", table.sourceRef),
    uniqueIndex("price_business_key").on(table.date, table.exchange, table.ticker),
    check("price_year_month_check", sql`${table.year} = extract(year FROM ${table.date} AT TIME ZONE 'Asia/Seoul')
      AND ${table.month} = extract(month FROM ${table.date} AT TIME ZONE 'Asia/Seoul')`),
    finiteCheck("price_open_finite_check", table.open),
    nonnegativeCheck("price_open_nonnegative_check", table.open),
    finiteCheck("price_high_finite_check", table.high),
    nonnegativeCheck("price_high_nonnegative_check", table.high),
    finiteCheck("price_low_finite_check", table.low),
    nonnegativeCheck("price_low_nonnegative_check", table.low),
    finiteCheck("price_close_finite_check", table.close),
    nonnegativeCheck("price_close_nonnegative_check", table.close),
    nonnegativeCheck("price_volume_nonnegative_check", table.volume),
    nonnegativeCheck("price_transaction_nonnegative_check", table.transaction),
    finiteCheck("price_rate_finite_check", table.rate),
    finiteCheck("price_fvolume_finite_check", table.fvolume),
    index("price_security_id_idx").on(table.securityId),
    index("price_date_idx").on(table.date),
    index("price_ticker_idx").on(table.ticker),
    index("price_year_month_idx").on(table.year, table.month),
    index("price_created_at_idx").on(table.createdAt),
    index("price_security_id_date_idx").on(table.securityId, table.date),
    index("price_exchange_date_idx").on(table.exchange, table.date),
    index("price_ticker_exchange_idx").on(table.ticker, table.exchange),
    index("price_date_exchange_idx").on(table.date, table.exchange), // Renamed from idx_price_date_exchange
  ]
);

export const marketcap = pgTable(
  "marketcap",
  {
    id: serial("id").primaryKey(),
    securityId: text("security_id").references(() => security.securityId),
    date: timestamp("date", { mode: "date", withTimezone: true }).notNull(),
    ticker: text("ticker").notNull(),
    sourceRef: text("source_ref").notNull(),
    name: text("name"),
    korName: text("kor_name"),
    exchange: text("exchange").notNull(),
    marketcap: bigint("marketcap", { mode: "bigint" }).notNull(),
    volume: bigint("volume", { mode: "bigint" }).notNull(),
    transaction: bigint("transaction", { mode: "bigint" }),
    shares: bigint("shares", { mode: "bigint" }).notNull(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    dailyCheck("marketcap_daily_check", table.date),
    nonemptyCheck("marketcap_exchange_check", table.exchange),
    nonemptyCheck("marketcap_ticker_check", table.ticker),
    nonemptyCheck("marketcap_source_ref_check", table.sourceRef),
    uniqueIndex("marketcap_business_key").on(table.date, table.exchange, table.ticker),
    check("marketcap_year_month_check", sql`${table.year} = extract(year FROM ${table.date} AT TIME ZONE 'Asia/Seoul')
      AND ${table.month} = extract(month FROM ${table.date} AT TIME ZONE 'Asia/Seoul')`),
    nonnegativeCheck("marketcap_volume_nonnegative_check", table.volume),
    nonnegativeCheck("marketcap_transaction_nonnegative_check", table.transaction),
    nonnegativeCheck("marketcap_marketcap_nonnegative_check", table.marketcap),
    nonnegativeCheck("marketcap_shares_nonnegative_check", table.shares),
    index("marketcap_security_id_idx").on(table.securityId),
    index("marketcap_date_idx").on(table.date),
    index("marketcap_ticker_idx").on(table.ticker),
    index("marketcap_year_month_idx").on(table.year, table.month),
    index("marketcap_created_at_idx").on(table.createdAt),
    index("marketcap_security_id_date_idx").on(table.securityId, table.date),
    index("marketcap_date_exchange_idx").on(table.date, table.exchange), // Renamed from idx_marketcap_date_exchange
  ]
);

export const bppedd = pgTable(
  "bppedd",
  {
    id: serial("id").primaryKey(),
    securityId: text("security_id").references(() => security.securityId),
    date: timestamp("date", { mode: "date", withTimezone: true }).notNull(),
    ticker: text("ticker").notNull(),
    sourceRef: text("source_ref").notNull(),
    name: text("name"),
    korName: text("kor_name"),
    exchange: text("exchange").notNull(),
    bps: doublePrecision("bps"),
    bpsState: sourceFieldStateEnum("bps_state").notNull(),
    per: doublePrecision("per"),
    perState: sourceFieldStateEnum("per_state").notNull(),
    pbr: doublePrecision("pbr"),
    pbrState: sourceFieldStateEnum("pbr_state").notNull(),
    eps: doublePrecision("eps"),
    epsState: sourceFieldStateEnum("eps_state").notNull(),
    div: doublePrecision("div"),
    divState: sourceFieldStateEnum("div_state").notNull(),
    dps: doublePrecision("dps"),
    dpsState: sourceFieldStateEnum("dps_state").notNull(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    dailyCheck("bppedd_daily_check", table.date),
    nonemptyCheck("bppedd_exchange_check", table.exchange),
    nonemptyCheck("bppedd_ticker_check", table.ticker),
    nonemptyCheck("bppedd_source_ref_check", table.sourceRef),
    uniqueIndex("bppedd_business_key").on(table.date, table.exchange, table.ticker),
    check("bppedd_year_month_check", sql`${table.year} = extract(year FROM ${table.date} AT TIME ZONE 'Asia/Seoul')
      AND ${table.month} = extract(month FROM ${table.date} AT TIME ZONE 'Asia/Seoul')`),
    rawStateCheck("bppedd_bps_state_check", table.bps, table.bpsState),
    finiteCheck("bppedd_bps_finite_check", table.bps),
    rawStateCheck("bppedd_per_state_check", table.per, table.perState),
    finiteCheck("bppedd_per_finite_check", table.per),
    rawStateCheck("bppedd_pbr_state_check", table.pbr, table.pbrState),
    finiteCheck("bppedd_pbr_finite_check", table.pbr),
    rawStateCheck("bppedd_eps_state_check", table.eps, table.epsState),
    finiteCheck("bppedd_eps_finite_check", table.eps),
    rawStateCheck("bppedd_div_state_check", table.div, table.divState),
    finiteCheck("bppedd_div_finite_check", table.div),
    rawStateCheck("bppedd_dps_state_check", table.dps, table.dpsState),
    finiteCheck("bppedd_dps_finite_check", table.dps),
    index("bppedd_security_id_idx").on(table.securityId),
    index("bppedd_date_idx").on(table.date),
    index("bppedd_ticker_idx").on(table.ticker),
    index("bppedd_year_month_idx").on(table.year, table.month),
    index("bppedd_created_at_idx").on(table.createdAt),
    index("bppedd_security_id_date_idx").on(table.securityId, table.date),
    index("bppedd_date_exchange_idx").on(table.date, table.exchange), // Renamed from idx_bppedd_date_exchange
  ]
);

export const stockcodename = pgTable(
  "stockcodename",
  {
    date: timestamp("date", { mode: "date", withTimezone: true }).notNull(),
    ticker: text("ticker").notNull(),
    sourceRef: text("source_ref").notNull(),
    securityId: text("security_id").references(() => security.securityId),
    name: text("name"),
    exchange: text("exchange").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    dailyCheck("stockcodename_daily_check", table.date),
    nonemptyCheck("stockcodename_exchange_check", table.exchange),
    nonemptyCheck("stockcodename_ticker_check", table.ticker),
    nonemptyCheck("stockcodename_source_ref_check", table.sourceRef),
    primaryKey({ columns: [table.date, table.ticker, table.exchange] }),
    index("stockcodename_ticker_idx").on(table.ticker),
    index("stockcodename_name_idx").on(table.name),
    index("stockcodename_exchange_idx").on(table.exchange),
    index("stockcodename_date_exchange_idx").on(table.date, table.exchange),
    index("stockcodename_exchange_ticker_idx").on(table.exchange, table.ticker), // Renamed
  ]
);

export const tmp_bppedds = pgTable(
  "tmp_bppedds",
  {
    date: timestamp("date", { mode: "date", withTimezone: true }).notNull(),
    ticker: text("ticker").notNull(),
    sourceRef: text("source_ref").notNull(),
    bps: doublePrecision("bps"),
    bpsState: sourceFieldStateEnum("bps_state").notNull(),
    per: doublePrecision("per"),
    perState: sourceFieldStateEnum("per_state").notNull(),
    pbr: doublePrecision("pbr"),
    pbrState: sourceFieldStateEnum("pbr_state").notNull(),
    eps: doublePrecision("eps"),
    epsState: sourceFieldStateEnum("eps_state").notNull(),
    div: doublePrecision("div"),
    divState: sourceFieldStateEnum("div_state").notNull(),
    dps: doublePrecision("dps"),
    dpsState: sourceFieldStateEnum("dps_state").notNull(),
    exchange: text("exchange").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    dailyCheck("tmp_bppedds_daily_check", table.date),
    nonemptyCheck("tmp_bppedds_exchange_check", table.exchange),
    nonemptyCheck("tmp_bppedds_ticker_check", table.ticker),
    nonemptyCheck("tmp_bppedds_source_ref_check", table.sourceRef),
    rawStateCheck("tmp_bppedds_bps_state_check", table.bps, table.bpsState),
    finiteCheck("tmp_bppedds_bps_finite_check", table.bps),
    rawStateCheck("tmp_bppedds_per_state_check", table.per, table.perState),
    finiteCheck("tmp_bppedds_per_finite_check", table.per),
    rawStateCheck("tmp_bppedds_pbr_state_check", table.pbr, table.pbrState),
    finiteCheck("tmp_bppedds_pbr_finite_check", table.pbr),
    rawStateCheck("tmp_bppedds_eps_state_check", table.eps, table.epsState),
    finiteCheck("tmp_bppedds_eps_finite_check", table.eps),
    rawStateCheck("tmp_bppedds_div_state_check", table.div, table.divState),
    finiteCheck("tmp_bppedds_div_finite_check", table.div),
    rawStateCheck("tmp_bppedds_dps_state_check", table.dps, table.dpsState),
    finiteCheck("tmp_bppedds_dps_finite_check", table.dps),
    primaryKey({ columns: [table.date, table.ticker, table.exchange] }),
    index("tmp_bppedds_ticker_idx").on(table.ticker),
    index("tmp_bppedds_date_idx").on(table.date),
    index("tmp_bppedds_exchange_idx").on(table.exchange),
    index("tmp_bppedds_date_exchange_idx").on(table.date, table.exchange),
  ]
);

export const tmp_marketcaps = pgTable(
  "tmp_marketcaps",
  {
    date: timestamp("date", { mode: "date", withTimezone: true }).notNull(),
    ticker: text("ticker").notNull(),
    sourceRef: text("source_ref").notNull(),
    close: doublePrecision("close").notNull(),
    marketcap: bigint("marketcap", { mode: "bigint" }).notNull(),
    volume: bigint("volume", { mode: "bigint" }).notNull(),
    transaction: bigint("transaction", { mode: "bigint" }),
    shares: bigint("shares", { mode: "bigint" }).notNull(),
    exchange: text("exchange").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    dailyCheck("tmp_marketcaps_daily_check", table.date),
    nonemptyCheck("tmp_marketcaps_exchange_check", table.exchange),
    nonemptyCheck("tmp_marketcaps_ticker_check", table.ticker),
    nonemptyCheck("tmp_marketcaps_source_ref_check", table.sourceRef),
    finiteCheck("tmp_marketcaps_close_finite_check", table.close),
    nonnegativeCheck("tmp_marketcaps_close_nonnegative_check", table.close),
    nonnegativeCheck("tmp_marketcaps_volume_nonnegative_check", table.volume),
    nonnegativeCheck("tmp_marketcaps_transaction_nonnegative_check", table.transaction),
    nonnegativeCheck("tmp_marketcaps_marketcap_nonnegative_check", table.marketcap),
    nonnegativeCheck("tmp_marketcaps_shares_nonnegative_check", table.shares),
    primaryKey({ columns: [table.date, table.ticker, table.exchange] }),
    index("tmp_marketcaps_ticker_idx").on(table.ticker),
    index("tmp_marketcaps_date_idx").on(table.date),
    index("tmp_marketcaps_exchange_idx").on(table.exchange),
    index("tmp_marketcaps_date_exchange_idx").on(table.date, table.exchange),
  ]
);

export const tmp_prices = pgTable(
  "tmp_prices",
  {
    date: timestamp("date", { mode: "date", withTimezone: true }).notNull(),
    ticker: text("ticker").notNull(),
    sourceRef: text("source_ref").notNull(),
    open: doublePrecision("open").notNull(),
    high: doublePrecision("high").notNull(),
    low: doublePrecision("low").notNull(),
    close: doublePrecision("close").notNull(),
    volume: bigint("volume", { mode: "bigint" }).notNull(),
    transaction: bigint("transaction", { mode: "bigint" }),
    rate: doublePrecision("rate"),
    exchange: text("exchange").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    dailyCheck("tmp_prices_daily_check", table.date),
    nonemptyCheck("tmp_prices_exchange_check", table.exchange),
    nonemptyCheck("tmp_prices_ticker_check", table.ticker),
    nonemptyCheck("tmp_prices_source_ref_check", table.sourceRef),
    finiteCheck("tmp_prices_open_finite_check", table.open),
    nonnegativeCheck("tmp_prices_open_nonnegative_check", table.open),
    finiteCheck("tmp_prices_high_finite_check", table.high),
    nonnegativeCheck("tmp_prices_high_nonnegative_check", table.high),
    finiteCheck("tmp_prices_low_finite_check", table.low),
    nonnegativeCheck("tmp_prices_low_nonnegative_check", table.low),
    finiteCheck("tmp_prices_close_finite_check", table.close),
    nonnegativeCheck("tmp_prices_close_nonnegative_check", table.close),
    nonnegativeCheck("tmp_prices_volume_nonnegative_check", table.volume),
    nonnegativeCheck("tmp_prices_transaction_nonnegative_check", table.transaction),
    finiteCheck("tmp_prices_rate_finite_check", table.rate),
    primaryKey({ columns: [table.date, table.ticker, table.exchange] }),
    index("tmp_prices_ticker_idx").on(table.ticker),
    index("tmp_prices_date_idx").on(table.date),
    index("tmp_prices_exchange_idx").on(table.exchange),
    index("tmp_prices_date_exchange_idx").on(table.date, table.exchange),
  ]
);

export const securityRank = pgTable("security_rank", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedByDefaultAsIdentity(),
  securityId: text("security_id").notNull().references(() => security.securityId),
  scopeKey: text("scope_key").notNull(),
  metricType: metricTypeEnum("metric_type").notNull(),
  rankDate: timestamp("rank_date", { mode: "date", withTimezone: true }).notNull(),
  currentRank: integer("current_rank"),
  priorRank: integer("prior_rank"),
  value: numeric("value"),
  valueObservedAt: timestamp("value_observed_at", { mode: "date", withTimezone: true }),
  rankingState: rankingStateEnum("ranking_state").notNull(),
  exclusionReason: text("exclusion_reason"),
  evidenceRef: text("evidence_ref").notNull(),
  publicationKey: text("publication_key").notNull().references(() => resultPublication.publicationKey),
  resultRevision: bigint("result_revision", { mode: "bigint" }).notNull(),
  calculationId: uuid("calculation_id").notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_security_rank_unique_entry").on(table.scopeKey, table.metricType, table.securityId),
  index("idx_security_rank_metric_date_rank").on(table.scopeKey, table.metricType, table.currentRank),
  index("idx_security_rank_security_metric_date").on(table.securityId, table.metricType, table.rankDate),
  index("idx_security_rank_metric_date_value").on(table.scopeKey, table.metricType, table.value),
  index("security_rank_publication_idx").on(table.publicationKey),
  dailyCheck("security_rank_daily_check", table.rankDate),
  dailyCheck("security_rank_observed_daily_check", table.valueObservedAt),
  nonemptyCheck("security_rank_scope_check", table.scopeKey),
  nonemptyCheck("security_rank_evidence_check", table.evidenceRef),
  // The FK checks header existence; tem validates versions, dates and coverage when publishing.
  check("security_rank_publication_key_check", sql`${table.publicationKey} =
    'security_rank/' || ${table.scopeKey} || '/' || ${table.metricType}::text`),
  check("security_rank_revision_check", sql`${table.resultRevision} > 0`),
  check("security_rank_value_check", sql`${table.value} IS NULL OR (${table.value} > '-Infinity'::numeric AND ${table.value} < 'Infinity'::numeric)`),
  check("security_rank_observation_check", sql`(${table.value} IS NULL) = (${table.valueObservedAt} IS NULL)
    AND (${table.valueObservedAt} IS NULL OR ${table.valueObservedAt} <= ${table.rankDate})`),
  check("security_rank_marketcap_integer_check", sql`${table.metricType} <> 'marketcap' OR ${table.value} IS NULL
    OR (${table.value} >= 0 AND ${table.value} = trunc(${table.value}))`),
  check("security_rank_state_check", sql`
    (${table.rankingState} = 'included' AND ${table.value} IS NOT NULL AND ${table.valueObservedAt} IS NOT NULL
      AND ${table.currentRank} IS NOT NULL AND ${table.currentRank} > 0 AND ${table.exclusionReason} IS NULL)
    OR (${table.rankingState} = 'excluded' AND ${table.currentRank} IS NULL AND ${table.exclusionReason} IS NOT NULL
      AND length(btrim(${table.exclusionReason})) > 0)`),
  check("security_rank_prior_check", sql`${table.priorRank} IS NULL OR ${table.priorRank} > 0`),
]);

// =========================================================
// Relations Definitions
// =========================================================

export const companyRelations = relations(company, ({ many }) => ({
  pensions: many(pension),
  displayNames: many(displayName),
  searchNames: many(searchName),
  securities: many(security),
}));

export const pensionRelations = relations(pension, ({ one }) => ({
  company: one(company, {
    fields: [pension.companyId],
    references: [company.companyId],
  }),
}));

export const displayNameRelations = relations(displayName, ({ one }) => ({
  company: one(company, {
    fields: [displayName.companyId],
    references: [company.companyId],
  }),
}));

export const searchNameRelations = relations(searchName, ({ one }) => ({
  company: one(company, {
    fields: [searchName.companyId],
    references: [company.companyId],
  }),
}));

export const securityRelations = relations(security, ({ one, many }) => ({
  company: one(company, {
    fields: [security.companyId],
    references: [company.companyId],
  }),
  prices: many(price),
  marketcaps: many(marketcap),
  bppedds: many(bppedd),
  securityRanks: many(securityRank),
}));

export const priceRelations = relations(price, ({ one }) => ({
  security: one(security, {
    fields: [price.securityId],
    references: [security.securityId],
  }),
}));

export const marketcapRelations = relations(marketcap, ({ one }) => ({
  security: one(security, {
    fields: [marketcap.securityId],
    references: [security.securityId],
  }),
}));

export const bppeddRelations = relations(bppedd, ({ one }) => ({
  security: one(security, {
    fields: [bppedd.securityId],
    references: [security.securityId],
  }),
}));

export const securityRankRelations = relations(securityRank, ({ one }) => ({
  security: one(security, {
    fields: [securityRank.securityId],
    references: [security.securityId],
  }),
}));

// =========================================================
// Type Inference
// =========================================================

// Company Types
export type InsertCompany = typeof company.$inferInsert;
export type SelectCompany = typeof company.$inferSelect;

// Pension Types
export type InsertPension = typeof pension.$inferInsert;
export type SelectPension = typeof pension.$inferSelect;

// DisplayName Types
export type InsertDisplayName = typeof displayName.$inferInsert;
export type SelectDisplayName = typeof displayName.$inferSelect;

// SearchName Types
export type InsertSearchName = typeof searchName.$inferInsert;
export type SelectSearchName = typeof searchName.$inferSelect;

// Security Types
export type InsertSecurity = typeof security.$inferInsert;
export type SelectSecurity = typeof security.$inferSelect;

// Price Types
export type InsertPrice = typeof price.$inferInsert;
export type SelectPrice = typeof price.$inferSelect;

// Marketcap Types
export type InsertMarketcap = typeof marketcap.$inferInsert;
export type SelectMarketcap = typeof marketcap.$inferSelect;

// BPEDD Types (assuming BPEDD is the correct name from bppedd table)
export type InsertBppedd = typeof bppedd.$inferInsert;
export type SelectBppedd = typeof bppedd.$inferSelect;

// Stockcodename Types
export type InsertStockcodename = typeof stockcodename.$inferInsert;
export type SelectStockcodename = typeof stockcodename.$inferSelect;

// Tmp_bppedds Types
export type InsertTmpBppedds = typeof tmp_bppedds.$inferInsert;
export type SelectTmpBppedds = typeof tmp_bppedds.$inferSelect;

// Tmp_marketcaps Types
export type InsertTmpMarketcaps = typeof tmp_marketcaps.$inferInsert;
export type SelectTmpMarketcaps = typeof tmp_marketcaps.$inferSelect;

// Tmp_prices Types
export type InsertTmpPrices = typeof tmp_prices.$inferInsert;
export type SelectTmpPrices = typeof tmp_prices.$inferSelect;

// SecurityRank Types
export type InsertSecurityRank = typeof securityRank.$inferInsert;
export type SelectSecurityRank = typeof securityRank.$inferSelect;

export type InsertResultPublication = typeof resultPublication.$inferInsert;
export type SelectResultPublication = typeof resultPublication.$inferSelect;
