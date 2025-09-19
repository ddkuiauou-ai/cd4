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
  date,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
// add sql import for conditional index

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
    marketcap: bigint("marketcap", { mode: "number" }),
    marketcapRank: integer("marketcap_rank"),
    marketcapPriorRank: integer("marketcap_prior_rank"),
    marketcapDate: timestamp("marketcap_date", { mode: "date" }),
    logo: text("logo"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
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
  (table) => [
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
    listingDate: timestamp("listing_date", { mode: "date" }),
    delistingDate: timestamp("delisting_date", { mode: "date" }),
    type: text("type"),
    exchange: text("exchange").notNull(),
    country: text("country"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
    price: doublePrecision("price"),
    priceDate: timestamp("price_date", { mode: "date" }),
    shares: bigint("shares", { mode: "number" }),
    sharesDate: timestamp("shares_date", { mode: "date" }),
    marketcap: bigint("marketcap", { mode: "number" }),
    marketcapDate: timestamp("marketcap_date", { mode: "date" }),
    bps: doublePrecision("bps"),
    bpsDate: timestamp("bps_date", { mode: "date" }),
    per: doublePrecision("per"),
    perDate: timestamp("per_date", { mode: "date" }),
    pbr: doublePrecision("pbr"),
    pbrDate: timestamp("pbr_date", { mode: "date" }),
    eps: doublePrecision("eps"),
    epsDate: timestamp("eps_date", { mode: "date" }),
    div: doublePrecision("div"),
    divDate: timestamp("div_date", { mode: "date" }),
    dps: doublePrecision("dps"),
    dpsDate: timestamp("dps_date", { mode: "date" }),
  },
  (table) => [
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
    date: timestamp("date", { mode: "date" }).notNull(),
    ticker: text("ticker").notNull(),
    name: text("name"),
    korName: text("kor_name"),
    exchange: text("exchange"),
    open: doublePrecision("open").notNull(),
    high: doublePrecision("high").notNull(),
    low: doublePrecision("low").notNull(),
    close: doublePrecision("close").notNull(),
    volume: bigint("volume", { mode: "number" }).notNull(),
    fvolume: doublePrecision("fvolume"),
    transaction: bigint("transaction", { mode: "number" }),
    rate: doublePrecision("rate"),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
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
    date: timestamp("date", { mode: "date" }).notNull(),
    ticker: text("ticker").notNull(),
    name: text("name"),
    korName: text("kor_name"),
    exchange: text("exchange").notNull(),
    marketcap: bigint("marketcap", { mode: "number" }).notNull(),
    volume: bigint("volume", { mode: "number" }).notNull(),
    transaction: bigint("transaction", { mode: "number" }),
    shares: bigint("shares", { mode: "number" }).notNull(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
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
    date: timestamp("date", { mode: "date" }).notNull(),
    ticker: text("ticker").notNull(),
    name: text("name"),
    korName: text("kor_name"),
    exchange: text("exchange").notNull(),
    bps: doublePrecision("bps").notNull(),
    per: doublePrecision("per").notNull(),
    pbr: doublePrecision("pbr").notNull(),
    eps: doublePrecision("eps").notNull(),
    div: doublePrecision("div").notNull(),
    dps: doublePrecision("dps").notNull(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
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
    date: timestamp("date", { mode: "date" }).notNull(),
    ticker: text("ticker").notNull(),
    name: text("name"),
    exchange: text("exchange").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
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
    date: timestamp("date", { mode: "date" }).notNull(),
    ticker: text("ticker").notNull(),
    bps: doublePrecision("bps").notNull(),
    per: doublePrecision("per").notNull(),
    pbr: doublePrecision("pbr").notNull(),
    eps: doublePrecision("eps").notNull(),
    div: doublePrecision("div").notNull(),
    dps: doublePrecision("dps").notNull(),
    exchange: text("exchange").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
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
    date: timestamp("date", { mode: "date" }).notNull(),
    ticker: text("ticker").notNull(),
    close: doublePrecision("close").notNull(),
    marketcap: bigint("marketcap", { mode: "number" }).notNull(),
    volume: bigint("volume", { mode: "number" }).notNull(),
    transaction: bigint("transaction", { mode: "number" }),
    shares: bigint("shares", { mode: "number" }).notNull(),
    exchange: text("exchange").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
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
    date: timestamp("date", { mode: "date" }).notNull(),
    ticker: text("ticker").notNull(),
    open: doublePrecision("open").notNull(),
    high: doublePrecision("high").notNull(),
    low: doublePrecision("low").notNull(),
    close: doublePrecision("close").notNull(),
    volume: bigint("volume", { mode: "number" }).notNull(),
    transaction: bigint("transaction", { mode: "number" }),
    rate: doublePrecision("rate"),
    exchange: text("exchange").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.date, table.ticker, table.exchange] }),
    index("tmp_prices_ticker_idx").on(table.ticker),
    index("tmp_prices_date_idx").on(table.date),
    index("tmp_prices_exchange_idx").on(table.exchange),
    index("tmp_prices_date_exchange_idx").on(table.date, table.exchange),
  ]
);

export const securityRank = pgTable(
  "security_rank",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedByDefaultAsIdentity(),
    securityId: text("security_id")
      .notNull()
      .references(() => security.securityId),
    metricType: metricTypeEnum("metric_type").notNull(),
    rankDate: date("rank_date").notNull(),
    currentRank: integer("current_rank"),
    priorRank: integer("prior_rank"),
    value: doublePrecision("value"), // 순위 계산에 사용된 실제 지표 값
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    // 고유 제약조건: 같은 종목, 같은 지표, 같은 날짜에는 하나의 랭킹만
    uniqueIndex("uq_security_rank_unique_entry").on(
      table.securityId,
      table.metricType,
      table.rankDate
    ),
    // 지표별 날짜별 랭킹 조회용
    index("idx_security_rank_metric_date_rank").on(
      table.metricType,
      table.rankDate,
      table.currentRank
    ),
    // 특정 종목의 지표별 랭킹 이력 조회용
    index("idx_security_rank_security_metric_date").on(
      table.securityId,
      table.metricType,
      table.rankDate
    ),
    // 지표별 날짜별 값 정렬용
    index("idx_security_rank_metric_date_value").on(
      table.metricType,
      table.rankDate,
      table.value
    ),
  ]
);

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
