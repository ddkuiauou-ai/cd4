CREATE TABLE `bppedd` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`security_id` text,
	`date` text NOT NULL,
	`ticker` text NOT NULL,
	`name` text,
	`kor_name` text,
	`exchange` text NOT NULL,
	`bps` real NOT NULL,
	`per` real NOT NULL,
	`pbr` real NOT NULL,
	`eps` real NOT NULL,
	`div` real NOT NULL,
	`dps` real NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIME),
	`updated_at` text DEFAULT (CURRENT_TIME),
	FOREIGN KEY (`security_id`) REFERENCES `security`(`security_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bppedd_security_id_idx` ON `bppedd` (`security_id`);--> statement-breakpoint
CREATE INDEX `bppedd_date_idx` ON `bppedd` (`date`);--> statement-breakpoint
CREATE INDEX `bppedd_ticker_idx` ON `bppedd` (`ticker`);--> statement-breakpoint
CREATE INDEX `bppedd_year_month_idx` ON `bppedd` (`year`,`month`);--> statement-breakpoint
CREATE INDEX `bppedd_created_at_idx` ON `bppedd` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_bppedd_sec_date` ON `bppedd` (`security_id`,`date`);--> statement-breakpoint
CREATE TABLE `company` (
	`company_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kor_name` text NOT NULL,
	`address` text,
	`kor_address` text,
	`country` text,
	`type` text,
	`tel` text,
	`fax` text,
	`postal_code` text,
	`homepage` text,
	`employees` integer,
	`industry` text,
	`established_date` text DEFAULT (CURRENT_TIME),
	`marketcap` blob,
	`marketcap_rank` integer,
	`marketcap_prior_rank` integer,
	`marketcap_date` text DEFAULT (CURRENT_TIME),
	`logo` text,
	`created_at` text DEFAULT (CURRENT_TIME),
	`updated_at` text DEFAULT (CURRENT_TIME)
);
--> statement-breakpoint
CREATE INDEX `company_name_idx` ON `company` (`name`);--> statement-breakpoint
CREATE INDEX `company_kor_name_idx` ON `company` (`kor_name`);--> statement-breakpoint
CREATE INDEX `company_country_idx` ON `company` (`country`);--> statement-breakpoint
CREATE INDEX `company_type_idx` ON `company` (`type`);--> statement-breakpoint
CREATE INDEX `company_created_at_idx` ON `company` (`created_at`);--> statement-breakpoint
CREATE TABLE `display_name` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`value` text NOT NULL,
	`order` integer DEFAULT 0,
	`company_id` text NOT NULL,
	`company_name` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIME),
	`updated_at` text DEFAULT (CURRENT_TIME),
	FOREIGN KEY (`company_id`) REFERENCES `company`(`company_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `display_name_company_id_idx` ON `display_name` (`company_id`);--> statement-breakpoint
CREATE INDEX `display_name_value_idx` ON `display_name` (`value`);--> statement-breakpoint
CREATE INDEX `display_name_created_at_idx` ON `display_name` (`created_at`);--> statement-breakpoint
CREATE TABLE `marketcap` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`security_id` text,
	`date` text NOT NULL,
	`ticker` text NOT NULL,
	`name` text,
	`kor_name` text,
	`exchange` text NOT NULL,
	`marketcap` blob NOT NULL,
	`volume` blob NOT NULL,
	`transaction` blob,
	`shares` blob NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIME),
	`updated_at` text DEFAULT (CURRENT_TIME),
	FOREIGN KEY (`security_id`) REFERENCES `security`(`security_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `marketcap_security_id_idx` ON `marketcap` (`security_id`);--> statement-breakpoint
CREATE INDEX `marketcap_date_idx` ON `marketcap` (`date`);--> statement-breakpoint
CREATE INDEX `marketcap_ticker_idx` ON `marketcap` (`ticker`);--> statement-breakpoint
CREATE INDEX `marketcap_year_month_idx` ON `marketcap` (`year`,`month`);--> statement-breakpoint
CREATE INDEX `marketcap_created_at_idx` ON `marketcap` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_marketcaps_sec_date` ON `marketcap` (`security_id`,`date`);--> statement-breakpoint
CREATE TABLE `pension` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`data_created_ym` text NOT NULL,
	`company_id` text,
	`company_name` text NOT NULL,
	`business_reg_num` text,
	`join_status` text,
	`zip_code` text,
	`lot_number_address` text,
	`road_name_address` text,
	`legal_dong_addr_code` text,
	`admin_dong_addr_code` text,
	`addr_sido_code` text,
	`addr_sigungu_code` text,
	`addr_emdong_code` text,
	`workplace_type` text,
	`industry_code` text,
	`industry_name` text,
	`applied_at` text,
	`re_registered_at` text,
	`withdrawn_at` text,
	`subscriber_count` integer,
	`monthly_notice_amount` blob,
	`new_subscribers` integer,
	`lost_subscribers` integer,
	`avg_fee` integer,
	`created_at` text DEFAULT (CURRENT_TIME),
	`updated_at` text DEFAULT (CURRENT_TIME),
	FOREIGN KEY (`company_id`) REFERENCES `company`(`company_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pension_company_id_idx` ON `pension` (`company_id`);--> statement-breakpoint
CREATE INDEX `pension_date_idx` ON `pension` (`data_created_ym`);--> statement-breakpoint
CREATE INDEX `pension_company_name_idx` ON `pension` (`company_name`);--> statement-breakpoint
CREATE INDEX `pension_created_at_idx` ON `pension` (`created_at`);--> statement-breakpoint
CREATE INDEX `pension_industry_code_idx` ON `pension` (`industry_code`);--> statement-breakpoint
CREATE INDEX `pension_zip_code_idx` ON `pension` (`zip_code`);--> statement-breakpoint
CREATE INDEX `pension_join_status_idx` ON `pension` (`join_status`);--> statement-breakpoint
CREATE INDEX `pension_withdrawn_at_idx` ON `pension` (`withdrawn_at`);--> statement-breakpoint
CREATE INDEX `pension_subscriber_count_idx` ON `pension` (`subscriber_count`);--> statement-breakpoint
CREATE INDEX `pension_company_date_idx` ON `pension` (`company_id`,`data_created_ym`);--> statement-breakpoint
CREATE INDEX `pension_region_industry_idx` ON `pension` (`addr_sido_code`,`addr_sigungu_code`,`industry_code`);--> statement-breakpoint
CREATE INDEX `pension_status_withdrawal_idx` ON `pension` (`join_status`,`withdrawn_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `pension_unique_business_month` ON `pension` (`data_created_ym`,`company_name`,`business_reg_num`);--> statement-breakpoint
CREATE TABLE `price` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`security_id` text,
	`date` text NOT NULL,
	`ticker` text NOT NULL,
	`name` text,
	`kor_name` text,
	`exchange` text,
	`open` real NOT NULL,
	`high` real NOT NULL,
	`low` real NOT NULL,
	`close` real NOT NULL,
	`volume` blob NOT NULL,
	`fvolume` real,
	`transaction` blob,
	`rate` real,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIME),
	`updated_at` text DEFAULT (CURRENT_TIME),
	FOREIGN KEY (`security_id`) REFERENCES `security`(`security_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `price_security_id_idx` ON `price` (`security_id`);--> statement-breakpoint
CREATE INDEX `price_date_idx` ON `price` (`date`);--> statement-breakpoint
CREATE INDEX `price_ticker_idx` ON `price` (`ticker`);--> statement-breakpoint
CREATE INDEX `price_year_month_idx` ON `price` (`year`,`month`);--> statement-breakpoint
CREATE INDEX `price_created_at_idx` ON `price` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_price_sec_date` ON `price` (`security_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_price_exchange_date` ON `price` (`exchange`,`date`);--> statement-breakpoint
CREATE INDEX `idx_price_ticker_exchange` ON `price` (`ticker`,`exchange`);--> statement-breakpoint
CREATE INDEX `idx_price_security_id_exchange` ON `price` (`security_id`,`exchange`);--> statement-breakpoint
CREATE INDEX `idx_price_exch_date_ticker_for_sync` ON `price` (`exchange`,`date`,`ticker`);--> statement-breakpoint
CREATE TABLE `search_name` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`value` text NOT NULL,
	`company_id` text NOT NULL,
	`company_name` text NOT NULL,
	`order` integer DEFAULT 0,
	`created_at` text DEFAULT (CURRENT_TIME),
	`updated_at` text DEFAULT (CURRENT_TIME),
	FOREIGN KEY (`company_id`) REFERENCES `company`(`company_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `search_name_company_id_idx` ON `search_name` (`company_id`);--> statement-breakpoint
CREATE INDEX `search_name_value_idx` ON `search_name` (`value`);--> statement-breakpoint
CREATE INDEX `search_name_created_at_idx` ON `search_name` (`created_at`);--> statement-breakpoint
CREATE TABLE `security` (
	`security_id` text PRIMARY KEY NOT NULL,
	`company_id` text,
	`ticker` text NOT NULL,
	`name` text NOT NULL,
	`kor_name` text NOT NULL,
	`listing_date` text,
	`delisting_date` text,
	`type` text,
	`exchange` text NOT NULL,
	`country` text,
	`created_at` text DEFAULT (CURRENT_TIME),
	`updated_at` text DEFAULT (CURRENT_TIME),
	`price` real,
	`price_date` text,
	`shares` blob,
	`shares_date` text,
	`marketcap` blob,
	`marketcap_rank` integer,
	`marketcap_prior_rank` integer,
	`marketcap_date` text,
	`bps` real,
	`bps_date` text,
	`per` real,
	`per_date` text,
	`pbr` real,
	`pbr_date` text,
	`eps` real,
	`eps_date` text,
	`div` real,
	`div_date` text,
	`dps` real,
	`dps_date` text,
	FOREIGN KEY (`company_id`) REFERENCES `company`(`company_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `security_company_id_idx` ON `security` (`company_id`);--> statement-breakpoint
CREATE INDEX `security_ticker_idx` ON `security` (`ticker`);--> statement-breakpoint
CREATE INDEX `security_name_idx` ON `security` (`name`);--> statement-breakpoint
CREATE INDEX `security_exchange_idx` ON `security` (`exchange`);--> statement-breakpoint
CREATE INDEX `security_created_at_idx` ON `security` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_security_exchange_id` ON `security` (`exchange`,`security_id`) WHERE "security"."delisting_date" IS NULL;--> statement-breakpoint
CREATE INDEX `idx_security_ticker_exchange` ON `security` (`ticker`,`exchange`);--> statement-breakpoint
CREATE INDEX `idx_security_exchange_delisting` ON `security` (`exchange`,`delisting_date`);--> statement-breakpoint
CREATE INDEX `idx_security_delisting_date` ON `security` (`delisting_date`);--> statement-breakpoint
CREATE INDEX `idx_security_type` ON `security` (`type`);--> statement-breakpoint
CREATE INDEX `idx_security_exchange_marketcap_date` ON `security` (`exchange`,`marketcap_date`);--> statement-breakpoint
CREATE INDEX `idx_security_company_id_exchange` ON `security` (`company_id`,`exchange`);--> statement-breakpoint
CREATE INDEX `idx_security_delisting_marketcap_desc` ON `security` (`delisting_date`,`marketcap`);--> statement-breakpoint
CREATE INDEX `idx_security_marketcap_rank` ON `security` (`marketcap_rank`);--> statement-breakpoint
CREATE TABLE `stockcodename` (
	`date` text NOT NULL,
	`ticker` text NOT NULL,
	`name` text,
	`exchange` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIME),
	`updated_at` text DEFAULT (CURRENT_TIME),
	PRIMARY KEY(`date`, `ticker`, `exchange`)
);
--> statement-breakpoint
CREATE INDEX `stockcodename_ticker_idx` ON `stockcodename` (`ticker`);--> statement-breakpoint
CREATE INDEX `stockcodename_name_idx` ON `stockcodename` (`name`);--> statement-breakpoint
CREATE INDEX `stockcodename_exchange_idx` ON `stockcodename` (`exchange`);--> statement-breakpoint
CREATE INDEX `stockcodename_date_exchange_idx` ON `stockcodename` (`date`,`exchange`);--> statement-breakpoint
CREATE INDEX `stockcodename_date_idx` ON `stockcodename` (`date`);--> statement-breakpoint
CREATE TABLE `tmp_bppedds` (
	`date` text NOT NULL,
	`ticker` text NOT NULL,
	`bps` real NOT NULL,
	`per` real NOT NULL,
	`pbr` real NOT NULL,
	`eps` real NOT NULL,
	`div` real NOT NULL,
	`dps` real NOT NULL,
	`exchange` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIME),
	`updated_at` text DEFAULT (CURRENT_TIME),
	PRIMARY KEY(`date`, `ticker`, `exchange`)
);
--> statement-breakpoint
CREATE INDEX `tmp_bppedds_ticker_idx` ON `tmp_bppedds` (`ticker`);--> statement-breakpoint
CREATE INDEX `tmp_bppedds_date_idx` ON `tmp_bppedds` (`date`);--> statement-breakpoint
CREATE INDEX `tmp_bppedds_exchange_idx` ON `tmp_bppedds` (`exchange`);--> statement-breakpoint
CREATE INDEX `tmp_bppedds_date_exchange_idx` ON `tmp_bppedds` (`date`,`exchange`);--> statement-breakpoint
CREATE TABLE `tmp_marketcaps` (
	`date` text NOT NULL,
	`ticker` text NOT NULL,
	`close` real NOT NULL,
	`marketcap` blob NOT NULL,
	`volume` blob NOT NULL,
	`transaction` blob,
	`shares` blob NOT NULL,
	`exchange` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIME),
	`updated_at` text DEFAULT (CURRENT_TIME),
	PRIMARY KEY(`date`, `ticker`, `exchange`)
);
--> statement-breakpoint
CREATE INDEX `tmp_marketcaps_ticker_idx` ON `tmp_marketcaps` (`ticker`);--> statement-breakpoint
CREATE INDEX `tmp_marketcaps_date_idx` ON `tmp_marketcaps` (`date`);--> statement-breakpoint
CREATE INDEX `tmp_marketcaps_exchange_idx` ON `tmp_marketcaps` (`exchange`);--> statement-breakpoint
CREATE INDEX `tmp_marketcaps_date_exchange_idx` ON `tmp_marketcaps` (`date`,`exchange`);--> statement-breakpoint
CREATE TABLE `tmp_prices` (
	`date` text NOT NULL,
	`ticker` text NOT NULL,
	`open` real NOT NULL,
	`high` real NOT NULL,
	`low` real NOT NULL,
	`close` real NOT NULL,
	`volume` blob NOT NULL,
	`transaction` blob,
	`rate` real,
	`exchange` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIME),
	`updated_at` text DEFAULT (CURRENT_TIME),
	PRIMARY KEY(`date`, `ticker`, `exchange`)
);
--> statement-breakpoint
CREATE INDEX `tmp_prices_ticker_idx` ON `tmp_prices` (`ticker`);--> statement-breakpoint
CREATE INDEX `tmp_prices_date_idx` ON `tmp_prices` (`date`);--> statement-breakpoint
CREATE INDEX `tmp_prices_exchange_idx` ON `tmp_prices` (`exchange`);--> statement-breakpoint
CREATE INDEX `tmp_prices_date_exchange_idx` ON `tmp_prices` (`date`,`exchange`);