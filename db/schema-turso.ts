import {
  sqliteTable,
  integer,
  text,
  real,
  blob,
  index,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

// =========================================================
// Table Definitions
// =========================================================

export const company = sqliteTable(
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
    establishedDate: text("established_date").default(sql`(CURRENT_TIME)`),
    marketcap: blob("marketcap", { mode: "bigint" }),
    marketcapRank: integer("marketcap_rank"),
    marketcapPriorRank: integer("marketcap_prior_rank"),
    marketcapDate: text("marketcap_date").default(sql`(CURRENT_TIME)`),
    logo: text("logo"),
    createdAt: text("created_at").default(sql`(CURRENT_TIME)`),
    updatedAt: text("updated_at").default(sql`(CURRENT_TIME)`),
  },
  (table) => [
    index("company_name_idx").on(table.name),
    index("company_kor_name_idx").on(table.korName),
    index("company_country_idx").on(table.country),
    index("company_type_idx").on(table.type),
    index("company_created_at_idx").on(table.createdAt),
    index("idx_company_marketcap_listed")
      .on(sql`marketcap DESC`)
      .where(sql`type = '상장법인'`),
  ]
);

export const pension = sqliteTable(
  "pension",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    dataCreatedYm: text("data_created_ym").notNull(), // 자료생성년월
    companyId: text("company_id")
      .references(() => company.companyId),
    companyName: text("company_name").notNull(), // 사업장명
    businessRegNum: text("business_reg_num"), // 사업자등록번호
    joinStatus: text("join_status"), // 사업장가입상태코드
    zipCode: text("zip_code"), // 우편번호
    lotNumberAddress: text("lot_number_address"), // 사업장지번상세주소
    roadNameAddress: text("road_name_address"), // 사업장도로명상세주소
    legalDongAddrCode: text("legal_dong_addr_code"), // 고객법정동주소코드
    adminDongAddrCode: text("admin_dong_addr_code"), // 고객행정동주소코드
    addrSidoCode: text("addr_sido_code"), // 법정동주소광역시도코드
    addrSigunguCode: text("addr_sigungu_code"), // 법정동주소광역시시군구코다
    addrEmdongCode: text("addr_emdong_code"), // 법정동주소광역시시군구읍면동코드
    workplaceType: text("workplace_type"), // 사업장형태구분코드
    industryCode: text("industry_code"), // 사업장업종코드
    industryName: text("industry_name"), // 사업장업종코드명
    appliedAt: text("applied_at"), // 적용일자
    reRegisteredAt: text("re_registered_at"), // 재등록일자
    withdrawnAt: text("withdrawn_at"), // 탈퇴일자
    subscriberCount: integer("subscriber_count"), // 가입자수
    monthlyNoticeAmount: blob("monthly_notice_amount", { mode: "bigint" }), // 당월고지금액
    newSubscribers: integer("new_subscribers"), // 신규취득자수
    lostSubscribers: integer("lost_subscribers"), // 상실가입자수
    avgFee: integer("avg_fee"),
    createdAt: text("created_at").default(sql`(CURRENT_TIME)`),
    updatedAt: text("updated_at").default(sql`(CURRENT_TIME)`),
  },
  (table) => [
    index("pension_company_id_idx").on(table.companyId),
    index("pension_data_created_ym_idx").on(table.dataCreatedYm), // Renamed
    index("pension_company_name_idx").on(table.companyName),
    index("pension_created_at_idx").on(table.createdAt),
    index("pension_industry_code_idx").on(table.industryCode),
    index("pension_zip_code_idx").on(table.zipCode),
    index("pension_join_status_idx").on(table.joinStatus),
    index("pension_withdrawn_at_idx").on(table.withdrawnAt),
    index("pension_subscriber_count_idx").on(table.subscriberCount),
    // 복합 인덱스
    index("pension_company_id_data_created_ym_idx").on(table.companyId, table.dataCreatedYm), // Renamed
    index("pension_addr_sido_code_addr_sigungu_code_industry_code_idx").on(table.addrSidoCode, table.addrSigunguCode, table.industryCode), // Renamed
    index("pension_join_status_withdrawn_at_idx").on(table.joinStatus, table.withdrawnAt), // Renamed
    // 복합 유니크 키 추가
    uniqueIndex("pension_data_created_ym_company_name_business_reg_num_unq").on(table.dataCreatedYm, table.companyName, table.businessRegNum), // Renamed unique constraint
  ]
);

export const displayName = sqliteTable(
  "display_name",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    value: text("value").notNull(),
    order: integer("order").default(0),
    companyId: text("company_id")
      .notNull()
      .references(() => company.companyId),
    companyName: text("company_name").notNull(),
    createdAt: text("created_at").default(sql`(CURRENT_TIME)`),
    updatedAt: text("updated_at").default(sql`(CURRENT_TIME)`),
  },
  (table) => [
    index("display_name_company_id_idx").on(table.companyId),
    index("display_name_value_idx").on(table.value),
    index("display_name_created_at_idx").on(table.createdAt),
  ]
);

export const searchName = sqliteTable(
  "search_name",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    value: text("value").notNull(),
    companyId: text("company_id")
      .notNull()
      .references(() => company.companyId),
    companyName: text("company_name").notNull(),
    order: integer("order").default(0),
    createdAt: text("created_at").default(sql`(CURRENT_TIME)`),
    updatedAt: text("updated_at").default(sql`(CURRENT_TIME)`),
  },
  (table) => [
    index("search_name_company_id_idx").on(table.companyId),
    index("search_name_value_idx").on(table.value),
    index("search_name_created_at_idx").on(table.createdAt),
  ]
);

export const security = sqliteTable(
  "security",
  {
    securityId: text("security_id").primaryKey(),
    companyId: text("company_id").references(() => company.companyId),
    ticker: text("ticker").notNull(),
    name: text("name").notNull(),
    korName: text("kor_name").notNull(),
    listingDate: text("listing_date"),
    delistingDate: text("delisting_date"),
    type: text("type"),
    exchange: text("exchange").notNull(),
    country: text("country"),
    createdAt: text("created_at").default(sql`(CURRENT_TIME)`),
    updatedAt: text("updated_at").default(sql`(CURRENT_TIME)`),
    price: real("price"),
    priceDate: text("price_date"),
    shares: blob("shares", { mode: "bigint" }),
    sharesDate: text("shares_date"),
    marketcap: blob("marketcap", { mode: "bigint" }),
    marketcapRank: integer("marketcap_rank"),
    marketcapPriorRank: integer("marketcap_prior_rank"),
    marketcapDate: text("marketcap_date"),
    bps: real("bps"),
    bpsDate: text("bps_date"),
    per: real("per"),
    perDate: text("per_date"),
    pbr: real("pbr"),
    pbrDate: text("pbr_date"),
    eps: real("eps"),
    epsDate: text("eps_date"),
    div: real("div"),
    divDate: text("div_date"),
    dps: real("dps"),
    dpsDate: text("dps_date"),
  },
  (table) => ({
    companyIdIdx: index("security_company_id_idx").on(table.companyId),
    tickerIdx: index("security_ticker_idx").on(table.ticker),
    nameIdx: index("security_name_idx").on(table.name),
    korNameIdx: index("security_kor_name_idx").on(table.korName), // Added new index
    exchangeIdx: index("security_exchange_idx").on(table.exchange),
    createdAtIdx: index("security_created_at_idx").on(table.createdAt),
    exchangeTickerIdx: index("security_exchange_ticker_idx").on(table.exchange, table.ticker),
    marketcapActiveIdx: index("idx_security_marketcap_active")
      .on(sql`marketcap DESC`)
      .where(sql`delisting_date IS NULL`),
  })
);

export const price = sqliteTable(
  "price",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    securityId: text("security_id").references(() => security.securityId),
    date: text("date").notNull(),
    ticker: text("ticker").notNull(),
    name: text("name"),
    korName: text("kor_name"),
    exchange: text("exchange"),
    open: real("open").notNull(),
    high: real("high").notNull(),
    low: real("low").notNull(),
    close: real("close").notNull(),
    volume: blob("volume", { mode: "bigint" }).notNull(),
    fvolume: real("fvolume"),
    transaction: blob("transaction", { mode: "bigint" }),
    rate: real("rate"),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    createdAt: text("created_at").default(sql`(CURRENT_TIME)`),
    updatedAt: text("updated_at").default(sql`(CURRENT_TIME)`),
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
    index("price_security_id_exchange_idx").on(table.securityId, table.exchange),
    index("price_exchange_date_ticker_idx").on(table.exchange, table.date, table.ticker),
    index("price_date_exchange_idx").on(table.date, table.exchange), // Renamed from idx_price_date_exchange
  ]
);

export const marketcap = sqliteTable(
  "marketcap",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    securityId: text("security_id").references(() => security.securityId),
    date: text("date").notNull(),
    ticker: text("ticker").notNull(),
    name: text("name"),
    korName: text("kor_name"),
    exchange: text("exchange").notNull(),
    marketcap: blob("marketcap", { mode: "bigint" }).notNull(),
    volume: blob("volume", { mode: "bigint" }).notNull(),
    transaction: blob("transaction", { mode: "bigint" }),
    shares: blob("shares", { mode: "bigint" }).notNull(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    createdAt: text("created_at").default(sql`(CURRENT_TIME)`),
    updatedAt: text("updated_at").default(sql`(CURRENT_TIME)`),
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

export const bppedd = sqliteTable(
  "bppedd",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    securityId: text("security_id").references(() => security.securityId),
    date: text("date").notNull(),
    ticker: text("ticker").notNull(),
    name: text("name"),
    korName: text("kor_name"),
    exchange: text("exchange").notNull(),
    bps: real("bps").notNull(),
    per: real("per").notNull(),
    pbr: real("pbr").notNull(),
    eps: real("eps").notNull(),
    div: real("div").notNull(),
    dps: real("dps").notNull(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    createdAt: text("created_at").default(sql`(CURRENT_TIME)`),
    updatedAt: text("updated_at").default(sql`(CURRENT_TIME)`),
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

export const stockcodename = sqliteTable(
  "stockcodename",
  {
    date: text("date").notNull(),
    ticker: text("ticker").notNull(),
    name: text("name"),
    exchange: text("exchange").notNull(),
    createdAt: text("created_at").default(sql`(CURRENT_TIME)`),
    updatedAt: text("updated_at").default(sql`(CURRENT_TIME)`),
  },
  (table) => ({
    tickerIdx: index("stockcodename_ticker_idx").on(table.ticker),
    nameIdx: index("stockcodename_name_idx").on(table.name),
    exchangeIdx: index("stockcodename_exchange_idx").on(table.exchange),
    dateExchangeIdx: index("stockcodename_date_exchange_idx").on(table.date, table.exchange),
    dateIdx: index("stockcodename_date_idx").on(table.date),
    exchangeTickerIdx: index("stockcodename_exchange_ticker_idx").on(table.exchange, table.ticker), // Renamed
  })
);

export const tmp_bppedds = sqliteTable(
  "tmp_bppedds",
  {
    date: text("date").notNull(),
    ticker: text("ticker").notNull(),
    bps: real("bps").notNull(),
    per: real("per").notNull(),
    pbr: real("pbr").notNull(),
    eps: real("eps").notNull(),
    div: real("div").notNull(),
    dps: real("dps").notNull(),
    exchange: text("exchange").notNull(),
    createdAt: text("created_at").default(sql`(CURRENT_TIME)`),
    updatedAt: text("updated_at").default(sql`(CURRENT_TIME)`),
  },
  (table) => [
    primaryKey({ columns: [table.date, table.ticker, table.exchange] }),
    index("tmp_bppedds_ticker_idx").on(table.ticker),
    index("tmp_bppedds_date_idx").on(table.date),
    index("tmp_bppedds_exchange_idx").on(table.exchange),
    index("tmp_bppedds_date_exchange_idx").on(table.date, table.exchange),
  ]
);

export const tmp_marketcaps = sqliteTable(
  "tmp_marketcaps",
  {
    date: text("date").notNull(),
    ticker: text("ticker").notNull(),
    close: real("close").notNull(),
    marketcap: blob("marketcap", { mode: "bigint" }).notNull(),
    volume: blob("volume", { mode: "bigint" }).notNull(),
    transaction: blob("transaction", { mode: "bigint" }),
    shares: blob("shares", { mode: "bigint" }).notNull(),
    exchange: text("exchange").notNull(),
    createdAt: text("created_at").default(sql`(CURRENT_TIME)`),
    updatedAt: text("updated_at").default(sql`(CURRENT_TIME)`),
  },
  (table) => [
    primaryKey({ columns: [table.date, table.ticker, table.exchange] }),
    index("tmp_marketcaps_ticker_idx").on(table.ticker),
    index("tmp_marketcaps_date_idx").on(table.date),
    index("tmp_marketcaps_exchange_idx").on(table.exchange),
    index("tmp_marketcaps_date_exchange_idx").on(table.date, table.exchange),
  ]
);

export const tmp_prices = sqliteTable(
  "tmp_prices",
  {
    date: text("date").notNull(),
    ticker: text("ticker").notNull(),
    open: real("open").notNull(),
    high: real("high").notNull(),
    low: real("low").notNull(),
    close: real("close").notNull(),
    volume: blob("volume", { mode: "bigint" }).notNull(),
    transaction: blob("transaction", { mode: "bigint" }),
    rate: real("rate"),
    exchange: text("exchange").notNull(),
    createdAt: text("created_at").default(sql`(CURRENT_TIME)`),
    updatedAt: text("updated_at").default(sql`(CURRENT_TIME)`),
  },
  (table) => [
    primaryKey({ columns: [table.date, table.ticker, table.exchange] }),
    index("tmp_prices_ticker_idx").on(table.ticker),
    index("tmp_prices_date_idx").on(table.date),
    index("tmp_prices_exchange_idx").on(table.exchange),
    index("tmp_prices_date_exchange_idx").on(table.date, table.exchange),
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

// BPEDD Types
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
