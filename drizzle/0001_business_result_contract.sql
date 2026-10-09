CREATE TYPE "public"."marketcap_completeness" AS ENUM('complete', 'missing_input', 'insufficient_evidence');--> statement-breakpoint
CREATE TYPE "public"."ranking_state" AS ENUM('included', 'excluded');--> statement-breakpoint
CREATE TYPE "public"."result_field_state" AS ENUM('provided', 'source_missing', 'unsupported', 'row_missing', 'unexplained_missing', 'no_observation');--> statement-breakpoint
CREATE TYPE "public"."result_kind" AS ENUM('security_latest', 'company_marketcap', 'security_rank');--> statement-breakpoint
CREATE TYPE "public"."source_field_state" AS ENUM('provided', 'source_missing', 'unsupported');--> statement-breakpoint
CREATE TABLE "result_publication" (
	"publication_key" text PRIMARY KEY NOT NULL,
	"result_kind" "result_kind" NOT NULL,
	"scope_key" text NOT NULL,
	"metric_type" "metric_type",
	"as_of" timestamp with time zone NOT NULL,
	"revision" bigint NOT NULL,
	"calculation_id" uuid NOT NULL,
	"row_count" integer NOT NULL,
	"included_count" integer,
	"input_ref" text NOT NULL,
	"rule_ref" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "result_publication_daily_check" CHECK ("result_publication"."as_of" IS NULL OR (isfinite("result_publication"."as_of") AND ("result_publication"."as_of" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00')),
	CONSTRAINT "result_publication_scope_check" CHECK ("result_publication"."scope_key" IS NULL OR length(btrim("result_publication"."scope_key")) > 0),
	CONSTRAINT "result_publication_input_ref_check" CHECK ("result_publication"."input_ref" IS NULL OR length(btrim("result_publication"."input_ref")) > 0),
	CONSTRAINT "result_publication_rule_ref_check" CHECK ("result_publication"."rule_ref" IS NULL OR length(btrim("result_publication"."rule_ref")) > 0),
	CONSTRAINT "result_publication_revision_check" CHECK ("result_publication"."revision" > 0),
	CONSTRAINT "result_publication_counts_check" CHECK ("result_publication"."row_count" >= 0 AND
    (("result_publication"."result_kind" = 'security_latest' AND "result_publication"."included_count" IS NULL)
    OR ("result_publication"."result_kind" IN ('company_marketcap','security_rank') AND "result_publication"."included_count" IS NOT NULL
      AND "result_publication"."included_count" >= 0 AND "result_publication"."included_count" <= "result_publication"."row_count"))),
	CONSTRAINT "result_publication_kind_metric_check" CHECK (("result_publication"."result_kind" = 'security_rank') = ("result_publication"."metric_type" IS NOT NULL)),
	CONSTRAINT "result_publication_key_check" CHECK ("result_publication"."publication_key" = "result_publication"."result_kind"::text || '/' || "result_publication"."scope_key" ||
    CASE WHEN "result_publication"."metric_type" IS NULL THEN '' ELSE '/' || "result_publication"."metric_type"::text END),
	CONSTRAINT "result_publication_published_at_check" CHECK (isfinite("result_publication"."published_at"))
);
--> statement-breakpoint
DROP INDEX "uq_security_rank_unique_entry";--> statement-breakpoint
DROP INDEX "idx_security_rank_metric_date_rank";--> statement-breakpoint
DROP INDEX "idx_security_rank_metric_date_value";--> statement-breakpoint
ALTER TABLE "bppedd" ALTER COLUMN "date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bppedd" ALTER COLUMN "bps" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bppedd" ALTER COLUMN "per" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bppedd" ALTER COLUMN "pbr" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bppedd" ALTER COLUMN "eps" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bppedd" ALTER COLUMN "div" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bppedd" ALTER COLUMN "dps" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bppedd" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bppedd" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "bppedd" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bppedd" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "company" ALTER COLUMN "marketcap" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "company" ALTER COLUMN "marketcap_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "company" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "marketcap" ALTER COLUMN "date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "marketcap" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "marketcap" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "marketcap" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "marketcap" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "price" ALTER COLUMN "date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "price" ALTER COLUMN "exchange" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "price" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "price" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "price" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "price" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "security" ALTER COLUMN "listing_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security" ALTER COLUMN "delisting_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "security" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "security" ALTER COLUMN "price_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security" ALTER COLUMN "shares_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security" ALTER COLUMN "marketcap_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security" ALTER COLUMN "bps_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security" ALTER COLUMN "per_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security" ALTER COLUMN "pbr_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security" ALTER COLUMN "eps_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security" ALTER COLUMN "div_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security" ALTER COLUMN "dps_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security_rank" ALTER COLUMN "rank_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security_rank" ALTER COLUMN "value" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "security_rank" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security_rank" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "security_rank" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security_rank" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "stockcodename" ALTER COLUMN "date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stockcodename" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stockcodename" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "stockcodename" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stockcodename" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ALTER COLUMN "date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ALTER COLUMN "bps" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ALTER COLUMN "per" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ALTER COLUMN "pbr" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ALTER COLUMN "eps" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ALTER COLUMN "div" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ALTER COLUMN "dps" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "tmp_marketcaps" ALTER COLUMN "date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tmp_marketcaps" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tmp_marketcaps" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "tmp_marketcaps" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tmp_marketcaps" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "tmp_prices" ALTER COLUMN "date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tmp_prices" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tmp_prices" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "tmp_prices" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tmp_prices" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "bppedd" ADD COLUMN "source_ref" text NOT NULL;--> statement-breakpoint
ALTER TABLE "bppedd" ADD COLUMN "bps_state" "source_field_state" NOT NULL;--> statement-breakpoint
ALTER TABLE "bppedd" ADD COLUMN "per_state" "source_field_state" NOT NULL;--> statement-breakpoint
ALTER TABLE "bppedd" ADD COLUMN "pbr_state" "source_field_state" NOT NULL;--> statement-breakpoint
ALTER TABLE "bppedd" ADD COLUMN "eps_state" "source_field_state" NOT NULL;--> statement-breakpoint
ALTER TABLE "bppedd" ADD COLUMN "div_state" "source_field_state" NOT NULL;--> statement-breakpoint
ALTER TABLE "bppedd" ADD COLUMN "dps_state" "source_field_state" NOT NULL;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "marketcap_completeness" "marketcap_completeness";--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "ranking_state" "ranking_state";--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "exclusion_reason" text;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "result_source_ref" text;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "publication_key" text;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "result_revision" bigint;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "calculation_id" uuid;--> statement-breakpoint
ALTER TABLE "marketcap" ADD COLUMN "source_ref" text NOT NULL;--> statement-breakpoint
ALTER TABLE "price" ADD COLUMN "source_ref" text NOT NULL;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "price_state" "result_field_state" DEFAULT 'no_observation' NOT NULL;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "price_source_ref" text;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "price_last_provided" double precision;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "price_last_provided_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "price_last_provided_source_ref" text;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "shares_state" "result_field_state" DEFAULT 'no_observation' NOT NULL;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "shares_source_ref" text;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "shares_last_provided" bigint;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "shares_last_provided_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "shares_last_provided_source_ref" text;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "marketcap_state" "result_field_state" DEFAULT 'no_observation' NOT NULL;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "marketcap_source_ref" text;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "marketcap_last_provided" bigint;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "marketcap_last_provided_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "marketcap_last_provided_source_ref" text;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "bps_state" "result_field_state" DEFAULT 'no_observation' NOT NULL;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "bps_source_ref" text;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "bps_last_provided" double precision;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "bps_last_provided_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "bps_last_provided_source_ref" text;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "per_state" "result_field_state" DEFAULT 'no_observation' NOT NULL;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "per_source_ref" text;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "per_last_provided" double precision;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "per_last_provided_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "per_last_provided_source_ref" text;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "pbr_state" "result_field_state" DEFAULT 'no_observation' NOT NULL;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "pbr_source_ref" text;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "pbr_last_provided" double precision;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "pbr_last_provided_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "pbr_last_provided_source_ref" text;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "eps_state" "result_field_state" DEFAULT 'no_observation' NOT NULL;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "eps_source_ref" text;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "eps_last_provided" double precision;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "eps_last_provided_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "eps_last_provided_source_ref" text;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "div_state" "result_field_state" DEFAULT 'no_observation' NOT NULL;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "div_source_ref" text;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "div_last_provided" double precision;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "div_last_provided_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "div_last_provided_source_ref" text;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "dps_state" "result_field_state" DEFAULT 'no_observation' NOT NULL;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "dps_source_ref" text;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "dps_last_provided" double precision;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "dps_last_provided_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "dps_last_provided_source_ref" text;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "publication_key" text;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "result_revision" bigint;--> statement-breakpoint
ALTER TABLE "security" ADD COLUMN "calculation_id" uuid;--> statement-breakpoint
ALTER TABLE "security_rank" ADD COLUMN "scope_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "security_rank" ADD COLUMN "value_observed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security_rank" ADD COLUMN "ranking_state" "ranking_state" NOT NULL;--> statement-breakpoint
ALTER TABLE "security_rank" ADD COLUMN "exclusion_reason" text;--> statement-breakpoint
ALTER TABLE "security_rank" ADD COLUMN "evidence_ref" text NOT NULL;--> statement-breakpoint
ALTER TABLE "security_rank" ADD COLUMN "publication_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "security_rank" ADD COLUMN "result_revision" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "security_rank" ADD COLUMN "calculation_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "stockcodename" ADD COLUMN "source_ref" text NOT NULL;--> statement-breakpoint
ALTER TABLE "stockcodename" ADD COLUMN "security_id" text;--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ADD COLUMN "source_ref" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ADD COLUMN "bps_state" "source_field_state" NOT NULL;--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ADD COLUMN "per_state" "source_field_state" NOT NULL;--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ADD COLUMN "pbr_state" "source_field_state" NOT NULL;--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ADD COLUMN "eps_state" "source_field_state" NOT NULL;--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ADD COLUMN "div_state" "source_field_state" NOT NULL;--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ADD COLUMN "dps_state" "source_field_state" NOT NULL;--> statement-breakpoint
ALTER TABLE "tmp_marketcaps" ADD COLUMN "source_ref" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tmp_prices" ADD COLUMN "source_ref" text NOT NULL;--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_publication_key_result_publication_publication_key_fk" FOREIGN KEY ("publication_key") REFERENCES "public"."result_publication"("publication_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_publication_key_result_publication_publication_key_fk" FOREIGN KEY ("publication_key") REFERENCES "public"."result_publication"("publication_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_rank" ADD CONSTRAINT "security_rank_publication_key_result_publication_publication_key_fk" FOREIGN KEY ("publication_key") REFERENCES "public"."result_publication"("publication_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockcodename" ADD CONSTRAINT "stockcodename_security_id_security_security_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."security"("security_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bppedd_business_key" ON "bppedd" USING btree ("date","exchange","ticker");--> statement-breakpoint
CREATE INDEX "company_publication_idx" ON "company" USING btree ("publication_key");--> statement-breakpoint
CREATE UNIQUE INDEX "marketcap_business_key" ON "marketcap" USING btree ("date","exchange","ticker");--> statement-breakpoint
CREATE UNIQUE INDEX "price_business_key" ON "price" USING btree ("date","exchange","ticker");--> statement-breakpoint
CREATE INDEX "security_publication_idx" ON "security" USING btree ("publication_key");--> statement-breakpoint
CREATE INDEX "security_rank_publication_idx" ON "security_rank" USING btree ("publication_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_security_rank_unique_entry" ON "security_rank" USING btree ("scope_key","metric_type","security_id");--> statement-breakpoint
CREATE INDEX "idx_security_rank_metric_date_rank" ON "security_rank" USING btree ("scope_key","metric_type","current_rank");--> statement-breakpoint
CREATE INDEX "idx_security_rank_metric_date_value" ON "security_rank" USING btree ("scope_key","metric_type","value");--> statement-breakpoint
ALTER TABLE "bppedd" ADD CONSTRAINT "bppedd_daily_check" CHECK ("bppedd"."date" IS NULL OR (isfinite("bppedd"."date") AND ("bppedd"."date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "bppedd" ADD CONSTRAINT "bppedd_exchange_check" CHECK ("bppedd"."exchange" IS NULL OR length(btrim("bppedd"."exchange")) > 0);--> statement-breakpoint
ALTER TABLE "bppedd" ADD CONSTRAINT "bppedd_ticker_check" CHECK ("bppedd"."ticker" IS NULL OR length(btrim("bppedd"."ticker")) > 0);--> statement-breakpoint
ALTER TABLE "bppedd" ADD CONSTRAINT "bppedd_source_ref_check" CHECK ("bppedd"."source_ref" IS NULL OR length(btrim("bppedd"."source_ref")) > 0);--> statement-breakpoint
ALTER TABLE "bppedd" ADD CONSTRAINT "bppedd_year_month_check" CHECK ("bppedd"."year" = extract(year FROM "bppedd"."date" AT TIME ZONE 'Asia/Seoul')
      AND "bppedd"."month" = extract(month FROM "bppedd"."date" AT TIME ZONE 'Asia/Seoul'));--> statement-breakpoint
ALTER TABLE "bppedd" ADD CONSTRAINT "bppedd_bps_state_check" CHECK (("bppedd"."bps_state" = 'provided') = ("bppedd"."bps" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "bppedd" ADD CONSTRAINT "bppedd_bps_finite_check" CHECK ("bppedd"."bps" IS NULL OR ("bppedd"."bps" > '-Infinity'::double precision AND "bppedd"."bps" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "bppedd" ADD CONSTRAINT "bppedd_per_state_check" CHECK (("bppedd"."per_state" = 'provided') = ("bppedd"."per" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "bppedd" ADD CONSTRAINT "bppedd_per_finite_check" CHECK ("bppedd"."per" IS NULL OR ("bppedd"."per" > '-Infinity'::double precision AND "bppedd"."per" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "bppedd" ADD CONSTRAINT "bppedd_pbr_state_check" CHECK (("bppedd"."pbr_state" = 'provided') = ("bppedd"."pbr" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "bppedd" ADD CONSTRAINT "bppedd_pbr_finite_check" CHECK ("bppedd"."pbr" IS NULL OR ("bppedd"."pbr" > '-Infinity'::double precision AND "bppedd"."pbr" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "bppedd" ADD CONSTRAINT "bppedd_eps_state_check" CHECK (("bppedd"."eps_state" = 'provided') = ("bppedd"."eps" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "bppedd" ADD CONSTRAINT "bppedd_eps_finite_check" CHECK ("bppedd"."eps" IS NULL OR ("bppedd"."eps" > '-Infinity'::double precision AND "bppedd"."eps" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "bppedd" ADD CONSTRAINT "bppedd_div_state_check" CHECK (("bppedd"."div_state" = 'provided') = ("bppedd"."div" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "bppedd" ADD CONSTRAINT "bppedd_div_finite_check" CHECK ("bppedd"."div" IS NULL OR ("bppedd"."div" > '-Infinity'::double precision AND "bppedd"."div" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "bppedd" ADD CONSTRAINT "bppedd_dps_state_check" CHECK (("bppedd"."dps_state" = 'provided') = ("bppedd"."dps" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "bppedd" ADD CONSTRAINT "bppedd_dps_finite_check" CHECK ("bppedd"."dps" IS NULL OR ("bppedd"."dps" > '-Infinity'::double precision AND "bppedd"."dps" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_result_metadata_check" CHECK (("company"."publication_key" IS NULL AND "company"."result_revision" IS NULL AND "company"."calculation_id" IS NULL) OR
    ("company"."publication_key" IS NOT NULL AND length(btrim("company"."publication_key")) > 0 AND "company"."result_revision" IS NOT NULL AND "company"."result_revision" > 0 AND "company"."calculation_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_marketcap_daily_check" CHECK ("company"."marketcap_date" IS NULL OR (isfinite("company"."marketcap_date") AND ("company"."marketcap_date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_marketcap_numeric_check" CHECK ("company"."marketcap" IS NULL OR
      ("company"."marketcap" >= 0 AND "company"."marketcap" < 'Infinity'::numeric AND "company"."marketcap" = trunc("company"."marketcap")));--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_result_state_check" CHECK (
      ("company"."publication_key" IS NULL AND "company"."marketcap" IS NULL AND "company"."marketcap_date" IS NULL
        AND "company"."marketcap_completeness" IS NULL AND "company"."ranking_state" IS NULL AND "company"."marketcap_rank" IS NULL
        AND "company"."marketcap_prior_rank" IS NULL AND "company"."exclusion_reason" IS NULL AND "company"."result_source_ref" IS NULL)
      OR ("company"."publication_key" IS NOT NULL AND "company"."marketcap_completeness" IS NOT NULL AND "company"."marketcap_date" IS NOT NULL
        AND "company"."ranking_state" IS NOT NULL AND "company"."result_source_ref" IS NOT NULL AND length(btrim("company"."result_source_ref")) > 0
        AND (("company"."marketcap_completeness" = 'complete') = ("company"."marketcap" IS NOT NULL))
        AND (("company"."ranking_state" = 'included' AND "company"."marketcap" IS NOT NULL AND "company"."marketcap_rank" IS NOT NULL AND "company"."marketcap_rank" > 0 AND "company"."exclusion_reason" IS NULL)
          OR ("company"."ranking_state" = 'excluded' AND "company"."marketcap_rank" IS NULL AND "company"."exclusion_reason" IS NOT NULL AND length(btrim("company"."exclusion_reason")) > 0))));--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_prior_rank_check" CHECK ("company"."marketcap_prior_rank" IS NULL OR "company"."marketcap_prior_rank" > 0);--> statement-breakpoint
ALTER TABLE "marketcap" ADD CONSTRAINT "marketcap_daily_check" CHECK ("marketcap"."date" IS NULL OR (isfinite("marketcap"."date") AND ("marketcap"."date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "marketcap" ADD CONSTRAINT "marketcap_exchange_check" CHECK ("marketcap"."exchange" IS NULL OR length(btrim("marketcap"."exchange")) > 0);--> statement-breakpoint
ALTER TABLE "marketcap" ADD CONSTRAINT "marketcap_ticker_check" CHECK ("marketcap"."ticker" IS NULL OR length(btrim("marketcap"."ticker")) > 0);--> statement-breakpoint
ALTER TABLE "marketcap" ADD CONSTRAINT "marketcap_source_ref_check" CHECK ("marketcap"."source_ref" IS NULL OR length(btrim("marketcap"."source_ref")) > 0);--> statement-breakpoint
ALTER TABLE "marketcap" ADD CONSTRAINT "marketcap_year_month_check" CHECK ("marketcap"."year" = extract(year FROM "marketcap"."date" AT TIME ZONE 'Asia/Seoul')
      AND "marketcap"."month" = extract(month FROM "marketcap"."date" AT TIME ZONE 'Asia/Seoul'));--> statement-breakpoint
ALTER TABLE "marketcap" ADD CONSTRAINT "marketcap_volume_nonnegative_check" CHECK ("marketcap"."volume" IS NULL OR "marketcap"."volume" >= 0);--> statement-breakpoint
ALTER TABLE "marketcap" ADD CONSTRAINT "marketcap_transaction_nonnegative_check" CHECK ("marketcap"."transaction" IS NULL OR "marketcap"."transaction" >= 0);--> statement-breakpoint
ALTER TABLE "marketcap" ADD CONSTRAINT "marketcap_marketcap_nonnegative_check" CHECK ("marketcap"."marketcap" IS NULL OR "marketcap"."marketcap" >= 0);--> statement-breakpoint
ALTER TABLE "marketcap" ADD CONSTRAINT "marketcap_shares_nonnegative_check" CHECK ("marketcap"."shares" IS NULL OR "marketcap"."shares" >= 0);--> statement-breakpoint
ALTER TABLE "price" ADD CONSTRAINT "price_daily_check" CHECK ("price"."date" IS NULL OR (isfinite("price"."date") AND ("price"."date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "price" ADD CONSTRAINT "price_exchange_check" CHECK ("price"."exchange" IS NULL OR length(btrim("price"."exchange")) > 0);--> statement-breakpoint
ALTER TABLE "price" ADD CONSTRAINT "price_ticker_check" CHECK ("price"."ticker" IS NULL OR length(btrim("price"."ticker")) > 0);--> statement-breakpoint
ALTER TABLE "price" ADD CONSTRAINT "price_source_ref_check" CHECK ("price"."source_ref" IS NULL OR length(btrim("price"."source_ref")) > 0);--> statement-breakpoint
ALTER TABLE "price" ADD CONSTRAINT "price_year_month_check" CHECK ("price"."year" = extract(year FROM "price"."date" AT TIME ZONE 'Asia/Seoul')
      AND "price"."month" = extract(month FROM "price"."date" AT TIME ZONE 'Asia/Seoul'));--> statement-breakpoint
ALTER TABLE "price" ADD CONSTRAINT "price_open_finite_check" CHECK ("price"."open" IS NULL OR ("price"."open" > '-Infinity'::double precision AND "price"."open" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "price" ADD CONSTRAINT "price_open_nonnegative_check" CHECK ("price"."open" IS NULL OR "price"."open" >= 0);--> statement-breakpoint
ALTER TABLE "price" ADD CONSTRAINT "price_high_finite_check" CHECK ("price"."high" IS NULL OR ("price"."high" > '-Infinity'::double precision AND "price"."high" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "price" ADD CONSTRAINT "price_high_nonnegative_check" CHECK ("price"."high" IS NULL OR "price"."high" >= 0);--> statement-breakpoint
ALTER TABLE "price" ADD CONSTRAINT "price_low_finite_check" CHECK ("price"."low" IS NULL OR ("price"."low" > '-Infinity'::double precision AND "price"."low" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "price" ADD CONSTRAINT "price_low_nonnegative_check" CHECK ("price"."low" IS NULL OR "price"."low" >= 0);--> statement-breakpoint
ALTER TABLE "price" ADD CONSTRAINT "price_close_finite_check" CHECK ("price"."close" IS NULL OR ("price"."close" > '-Infinity'::double precision AND "price"."close" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "price" ADD CONSTRAINT "price_close_nonnegative_check" CHECK ("price"."close" IS NULL OR "price"."close" >= 0);--> statement-breakpoint
ALTER TABLE "price" ADD CONSTRAINT "price_volume_nonnegative_check" CHECK ("price"."volume" IS NULL OR "price"."volume" >= 0);--> statement-breakpoint
ALTER TABLE "price" ADD CONSTRAINT "price_transaction_nonnegative_check" CHECK ("price"."transaction" IS NULL OR "price"."transaction" >= 0);--> statement-breakpoint
ALTER TABLE "price" ADD CONSTRAINT "price_rate_finite_check" CHECK ("price"."rate" IS NULL OR ("price"."rate" > '-Infinity'::double precision AND "price"."rate" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "price" ADD CONSTRAINT "price_fvolume_finite_check" CHECK ("price"."fvolume" IS NULL OR ("price"."fvolume" > '-Infinity'::double precision AND "price"."fvolume" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_result_metadata_check" CHECK (("security"."publication_key" IS NULL AND "security"."result_revision" IS NULL AND "security"."calculation_id" IS NULL) OR
    ("security"."publication_key" IS NOT NULL AND length(btrim("security"."publication_key")) > 0 AND "security"."result_revision" IS NOT NULL AND "security"."result_revision" > 0 AND "security"."calculation_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_unpublished_check" CHECK ("security"."publication_key" IS NOT NULL OR ("security"."price_state" = 'no_observation' AND "security"."shares_state" = 'no_observation' AND "security"."marketcap_state" = 'no_observation' AND "security"."bps_state" = 'no_observation' AND "security"."per_state" = 'no_observation' AND "security"."pbr_state" = 'no_observation' AND "security"."eps_state" = 'no_observation' AND "security"."div_state" = 'no_observation' AND "security"."dps_state" = 'no_observation'));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_exchange_check" CHECK ("security"."exchange" IS NULL OR length(btrim("security"."exchange")) > 0);--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_ticker_check" CHECK ("security"."ticker" IS NULL OR length(btrim("security"."ticker")) > 0);--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_listing_daily_check" CHECK ("security"."listing_date" IS NULL OR (isfinite("security"."listing_date") AND ("security"."listing_date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_delisting_daily_check" CHECK ("security"."delisting_date" IS NULL OR (isfinite("security"."delisting_date") AND ("security"."delisting_date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_price_result_check" CHECK ((
    ("security"."price_state" = 'no_observation' AND "security"."price" IS NULL AND "security"."price_date" IS NULL AND "security"."price_source_ref" IS NULL
      AND "security"."price_last_provided" IS NULL AND "security"."price_last_provided_date" IS NULL AND "security"."price_last_provided_source_ref" IS NULL)
    OR ("security"."price_state" = 'provided' AND "security"."price" IS NOT NULL AND "security"."price_date" IS NOT NULL
      AND "security"."price_source_ref" IS NOT NULL AND length(btrim("security"."price_source_ref")) > 0
      AND "security"."price_last_provided" IS NOT NULL AND "security"."price_last_provided_date" IS NOT NULL AND "security"."price_last_provided_source_ref" IS NOT NULL
      AND "security"."price" = "security"."price_last_provided" AND "security"."price_date" = "security"."price_last_provided_date" AND "security"."price_source_ref" = "security"."price_last_provided_source_ref")
    OR ("security"."price_state" IN ('source_missing','unsupported','row_missing','unexplained_missing')
      AND "security"."price" IS NULL AND "security"."price_date" IS NOT NULL AND "security"."price_source_ref" IS NOT NULL AND length(btrim("security"."price_source_ref")) > 0
      AND (("security"."price_last_provided" IS NULL AND "security"."price_last_provided_date" IS NULL AND "security"."price_last_provided_source_ref" IS NULL)
        OR ("security"."price_last_provided" IS NOT NULL AND "security"."price_last_provided_date" IS NOT NULL AND "security"."price_last_provided_source_ref" IS NOT NULL
          AND length(btrim("security"."price_last_provided_source_ref")) > 0 AND "security"."price_last_provided_date" < "security"."price_date")))
  ));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_price_daily_check" CHECK ("security"."price_date" IS NULL OR (isfinite("security"."price_date") AND ("security"."price_date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_price_last_daily_check" CHECK ("security"."price_last_provided_date" IS NULL OR (isfinite("security"."price_last_provided_date") AND ("security"."price_last_provided_date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_price_number_check" CHECK ("security"."price" IS NULL OR ("security"."price" > '-Infinity'::double precision AND "security"."price" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_price_last_number_check" CHECK ("security"."price_last_provided" IS NULL OR ("security"."price_last_provided" > '-Infinity'::double precision AND "security"."price_last_provided" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_price_nonnegative_check" CHECK ("security"."price" IS NULL OR "security"."price" >= 0);--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_price_last_nonnegative_check" CHECK ("security"."price_last_provided" IS NULL OR "security"."price_last_provided" >= 0);--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_shares_result_check" CHECK ((
    ("security"."shares_state" = 'no_observation' AND "security"."shares" IS NULL AND "security"."shares_date" IS NULL AND "security"."shares_source_ref" IS NULL
      AND "security"."shares_last_provided" IS NULL AND "security"."shares_last_provided_date" IS NULL AND "security"."shares_last_provided_source_ref" IS NULL)
    OR ("security"."shares_state" = 'provided' AND "security"."shares" IS NOT NULL AND "security"."shares_date" IS NOT NULL
      AND "security"."shares_source_ref" IS NOT NULL AND length(btrim("security"."shares_source_ref")) > 0
      AND "security"."shares_last_provided" IS NOT NULL AND "security"."shares_last_provided_date" IS NOT NULL AND "security"."shares_last_provided_source_ref" IS NOT NULL
      AND "security"."shares" = "security"."shares_last_provided" AND "security"."shares_date" = "security"."shares_last_provided_date" AND "security"."shares_source_ref" = "security"."shares_last_provided_source_ref")
    OR ("security"."shares_state" IN ('source_missing','unsupported','row_missing','unexplained_missing')
      AND "security"."shares" IS NULL AND "security"."shares_date" IS NOT NULL AND "security"."shares_source_ref" IS NOT NULL AND length(btrim("security"."shares_source_ref")) > 0
      AND (("security"."shares_last_provided" IS NULL AND "security"."shares_last_provided_date" IS NULL AND "security"."shares_last_provided_source_ref" IS NULL)
        OR ("security"."shares_last_provided" IS NOT NULL AND "security"."shares_last_provided_date" IS NOT NULL AND "security"."shares_last_provided_source_ref" IS NOT NULL
          AND length(btrim("security"."shares_last_provided_source_ref")) > 0 AND "security"."shares_last_provided_date" < "security"."shares_date")))
  ));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_shares_daily_check" CHECK ("security"."shares_date" IS NULL OR (isfinite("security"."shares_date") AND ("security"."shares_date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_shares_last_daily_check" CHECK ("security"."shares_last_provided_date" IS NULL OR (isfinite("security"."shares_last_provided_date") AND ("security"."shares_last_provided_date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_shares_number_check" CHECK ("security"."shares" IS NULL OR "security"."shares" >= 0);--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_shares_last_number_check" CHECK ("security"."shares_last_provided" IS NULL OR "security"."shares_last_provided" >= 0);--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_marketcap_result_check" CHECK ((
    ("security"."marketcap_state" = 'no_observation' AND "security"."marketcap" IS NULL AND "security"."marketcap_date" IS NULL AND "security"."marketcap_source_ref" IS NULL
      AND "security"."marketcap_last_provided" IS NULL AND "security"."marketcap_last_provided_date" IS NULL AND "security"."marketcap_last_provided_source_ref" IS NULL)
    OR ("security"."marketcap_state" = 'provided' AND "security"."marketcap" IS NOT NULL AND "security"."marketcap_date" IS NOT NULL
      AND "security"."marketcap_source_ref" IS NOT NULL AND length(btrim("security"."marketcap_source_ref")) > 0
      AND "security"."marketcap_last_provided" IS NOT NULL AND "security"."marketcap_last_provided_date" IS NOT NULL AND "security"."marketcap_last_provided_source_ref" IS NOT NULL
      AND "security"."marketcap" = "security"."marketcap_last_provided" AND "security"."marketcap_date" = "security"."marketcap_last_provided_date" AND "security"."marketcap_source_ref" = "security"."marketcap_last_provided_source_ref")
    OR ("security"."marketcap_state" IN ('source_missing','unsupported','row_missing','unexplained_missing')
      AND "security"."marketcap" IS NULL AND "security"."marketcap_date" IS NOT NULL AND "security"."marketcap_source_ref" IS NOT NULL AND length(btrim("security"."marketcap_source_ref")) > 0
      AND (("security"."marketcap_last_provided" IS NULL AND "security"."marketcap_last_provided_date" IS NULL AND "security"."marketcap_last_provided_source_ref" IS NULL)
        OR ("security"."marketcap_last_provided" IS NOT NULL AND "security"."marketcap_last_provided_date" IS NOT NULL AND "security"."marketcap_last_provided_source_ref" IS NOT NULL
          AND length(btrim("security"."marketcap_last_provided_source_ref")) > 0 AND "security"."marketcap_last_provided_date" < "security"."marketcap_date")))
  ));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_marketcap_daily_check" CHECK ("security"."marketcap_date" IS NULL OR (isfinite("security"."marketcap_date") AND ("security"."marketcap_date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_marketcap_last_daily_check" CHECK ("security"."marketcap_last_provided_date" IS NULL OR (isfinite("security"."marketcap_last_provided_date") AND ("security"."marketcap_last_provided_date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_marketcap_number_check" CHECK ("security"."marketcap" IS NULL OR "security"."marketcap" >= 0);--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_marketcap_last_number_check" CHECK ("security"."marketcap_last_provided" IS NULL OR "security"."marketcap_last_provided" >= 0);--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_bps_result_check" CHECK ((
    ("security"."bps_state" = 'no_observation' AND "security"."bps" IS NULL AND "security"."bps_date" IS NULL AND "security"."bps_source_ref" IS NULL
      AND "security"."bps_last_provided" IS NULL AND "security"."bps_last_provided_date" IS NULL AND "security"."bps_last_provided_source_ref" IS NULL)
    OR ("security"."bps_state" = 'provided' AND "security"."bps" IS NOT NULL AND "security"."bps_date" IS NOT NULL
      AND "security"."bps_source_ref" IS NOT NULL AND length(btrim("security"."bps_source_ref")) > 0
      AND "security"."bps_last_provided" IS NOT NULL AND "security"."bps_last_provided_date" IS NOT NULL AND "security"."bps_last_provided_source_ref" IS NOT NULL
      AND "security"."bps" = "security"."bps_last_provided" AND "security"."bps_date" = "security"."bps_last_provided_date" AND "security"."bps_source_ref" = "security"."bps_last_provided_source_ref")
    OR ("security"."bps_state" IN ('source_missing','unsupported','row_missing','unexplained_missing')
      AND "security"."bps" IS NULL AND "security"."bps_date" IS NOT NULL AND "security"."bps_source_ref" IS NOT NULL AND length(btrim("security"."bps_source_ref")) > 0
      AND (("security"."bps_last_provided" IS NULL AND "security"."bps_last_provided_date" IS NULL AND "security"."bps_last_provided_source_ref" IS NULL)
        OR ("security"."bps_last_provided" IS NOT NULL AND "security"."bps_last_provided_date" IS NOT NULL AND "security"."bps_last_provided_source_ref" IS NOT NULL
          AND length(btrim("security"."bps_last_provided_source_ref")) > 0 AND "security"."bps_last_provided_date" < "security"."bps_date")))
  ));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_bps_daily_check" CHECK ("security"."bps_date" IS NULL OR (isfinite("security"."bps_date") AND ("security"."bps_date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_bps_last_daily_check" CHECK ("security"."bps_last_provided_date" IS NULL OR (isfinite("security"."bps_last_provided_date") AND ("security"."bps_last_provided_date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_bps_number_check" CHECK ("security"."bps" IS NULL OR ("security"."bps" > '-Infinity'::double precision AND "security"."bps" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_bps_last_number_check" CHECK ("security"."bps_last_provided" IS NULL OR ("security"."bps_last_provided" > '-Infinity'::double precision AND "security"."bps_last_provided" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_per_result_check" CHECK ((
    ("security"."per_state" = 'no_observation' AND "security"."per" IS NULL AND "security"."per_date" IS NULL AND "security"."per_source_ref" IS NULL
      AND "security"."per_last_provided" IS NULL AND "security"."per_last_provided_date" IS NULL AND "security"."per_last_provided_source_ref" IS NULL)
    OR ("security"."per_state" = 'provided' AND "security"."per" IS NOT NULL AND "security"."per_date" IS NOT NULL
      AND "security"."per_source_ref" IS NOT NULL AND length(btrim("security"."per_source_ref")) > 0
      AND "security"."per_last_provided" IS NOT NULL AND "security"."per_last_provided_date" IS NOT NULL AND "security"."per_last_provided_source_ref" IS NOT NULL
      AND "security"."per" = "security"."per_last_provided" AND "security"."per_date" = "security"."per_last_provided_date" AND "security"."per_source_ref" = "security"."per_last_provided_source_ref")
    OR ("security"."per_state" IN ('source_missing','unsupported','row_missing','unexplained_missing')
      AND "security"."per" IS NULL AND "security"."per_date" IS NOT NULL AND "security"."per_source_ref" IS NOT NULL AND length(btrim("security"."per_source_ref")) > 0
      AND (("security"."per_last_provided" IS NULL AND "security"."per_last_provided_date" IS NULL AND "security"."per_last_provided_source_ref" IS NULL)
        OR ("security"."per_last_provided" IS NOT NULL AND "security"."per_last_provided_date" IS NOT NULL AND "security"."per_last_provided_source_ref" IS NOT NULL
          AND length(btrim("security"."per_last_provided_source_ref")) > 0 AND "security"."per_last_provided_date" < "security"."per_date")))
  ));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_per_daily_check" CHECK ("security"."per_date" IS NULL OR (isfinite("security"."per_date") AND ("security"."per_date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_per_last_daily_check" CHECK ("security"."per_last_provided_date" IS NULL OR (isfinite("security"."per_last_provided_date") AND ("security"."per_last_provided_date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_per_number_check" CHECK ("security"."per" IS NULL OR ("security"."per" > '-Infinity'::double precision AND "security"."per" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_per_last_number_check" CHECK ("security"."per_last_provided" IS NULL OR ("security"."per_last_provided" > '-Infinity'::double precision AND "security"."per_last_provided" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_pbr_result_check" CHECK ((
    ("security"."pbr_state" = 'no_observation' AND "security"."pbr" IS NULL AND "security"."pbr_date" IS NULL AND "security"."pbr_source_ref" IS NULL
      AND "security"."pbr_last_provided" IS NULL AND "security"."pbr_last_provided_date" IS NULL AND "security"."pbr_last_provided_source_ref" IS NULL)
    OR ("security"."pbr_state" = 'provided' AND "security"."pbr" IS NOT NULL AND "security"."pbr_date" IS NOT NULL
      AND "security"."pbr_source_ref" IS NOT NULL AND length(btrim("security"."pbr_source_ref")) > 0
      AND "security"."pbr_last_provided" IS NOT NULL AND "security"."pbr_last_provided_date" IS NOT NULL AND "security"."pbr_last_provided_source_ref" IS NOT NULL
      AND "security"."pbr" = "security"."pbr_last_provided" AND "security"."pbr_date" = "security"."pbr_last_provided_date" AND "security"."pbr_source_ref" = "security"."pbr_last_provided_source_ref")
    OR ("security"."pbr_state" IN ('source_missing','unsupported','row_missing','unexplained_missing')
      AND "security"."pbr" IS NULL AND "security"."pbr_date" IS NOT NULL AND "security"."pbr_source_ref" IS NOT NULL AND length(btrim("security"."pbr_source_ref")) > 0
      AND (("security"."pbr_last_provided" IS NULL AND "security"."pbr_last_provided_date" IS NULL AND "security"."pbr_last_provided_source_ref" IS NULL)
        OR ("security"."pbr_last_provided" IS NOT NULL AND "security"."pbr_last_provided_date" IS NOT NULL AND "security"."pbr_last_provided_source_ref" IS NOT NULL
          AND length(btrim("security"."pbr_last_provided_source_ref")) > 0 AND "security"."pbr_last_provided_date" < "security"."pbr_date")))
  ));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_pbr_daily_check" CHECK ("security"."pbr_date" IS NULL OR (isfinite("security"."pbr_date") AND ("security"."pbr_date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_pbr_last_daily_check" CHECK ("security"."pbr_last_provided_date" IS NULL OR (isfinite("security"."pbr_last_provided_date") AND ("security"."pbr_last_provided_date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_pbr_number_check" CHECK ("security"."pbr" IS NULL OR ("security"."pbr" > '-Infinity'::double precision AND "security"."pbr" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_pbr_last_number_check" CHECK ("security"."pbr_last_provided" IS NULL OR ("security"."pbr_last_provided" > '-Infinity'::double precision AND "security"."pbr_last_provided" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_eps_result_check" CHECK ((
    ("security"."eps_state" = 'no_observation' AND "security"."eps" IS NULL AND "security"."eps_date" IS NULL AND "security"."eps_source_ref" IS NULL
      AND "security"."eps_last_provided" IS NULL AND "security"."eps_last_provided_date" IS NULL AND "security"."eps_last_provided_source_ref" IS NULL)
    OR ("security"."eps_state" = 'provided' AND "security"."eps" IS NOT NULL AND "security"."eps_date" IS NOT NULL
      AND "security"."eps_source_ref" IS NOT NULL AND length(btrim("security"."eps_source_ref")) > 0
      AND "security"."eps_last_provided" IS NOT NULL AND "security"."eps_last_provided_date" IS NOT NULL AND "security"."eps_last_provided_source_ref" IS NOT NULL
      AND "security"."eps" = "security"."eps_last_provided" AND "security"."eps_date" = "security"."eps_last_provided_date" AND "security"."eps_source_ref" = "security"."eps_last_provided_source_ref")
    OR ("security"."eps_state" IN ('source_missing','unsupported','row_missing','unexplained_missing')
      AND "security"."eps" IS NULL AND "security"."eps_date" IS NOT NULL AND "security"."eps_source_ref" IS NOT NULL AND length(btrim("security"."eps_source_ref")) > 0
      AND (("security"."eps_last_provided" IS NULL AND "security"."eps_last_provided_date" IS NULL AND "security"."eps_last_provided_source_ref" IS NULL)
        OR ("security"."eps_last_provided" IS NOT NULL AND "security"."eps_last_provided_date" IS NOT NULL AND "security"."eps_last_provided_source_ref" IS NOT NULL
          AND length(btrim("security"."eps_last_provided_source_ref")) > 0 AND "security"."eps_last_provided_date" < "security"."eps_date")))
  ));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_eps_daily_check" CHECK ("security"."eps_date" IS NULL OR (isfinite("security"."eps_date") AND ("security"."eps_date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_eps_last_daily_check" CHECK ("security"."eps_last_provided_date" IS NULL OR (isfinite("security"."eps_last_provided_date") AND ("security"."eps_last_provided_date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_eps_number_check" CHECK ("security"."eps" IS NULL OR ("security"."eps" > '-Infinity'::double precision AND "security"."eps" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_eps_last_number_check" CHECK ("security"."eps_last_provided" IS NULL OR ("security"."eps_last_provided" > '-Infinity'::double precision AND "security"."eps_last_provided" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_div_result_check" CHECK ((
    ("security"."div_state" = 'no_observation' AND "security"."div" IS NULL AND "security"."div_date" IS NULL AND "security"."div_source_ref" IS NULL
      AND "security"."div_last_provided" IS NULL AND "security"."div_last_provided_date" IS NULL AND "security"."div_last_provided_source_ref" IS NULL)
    OR ("security"."div_state" = 'provided' AND "security"."div" IS NOT NULL AND "security"."div_date" IS NOT NULL
      AND "security"."div_source_ref" IS NOT NULL AND length(btrim("security"."div_source_ref")) > 0
      AND "security"."div_last_provided" IS NOT NULL AND "security"."div_last_provided_date" IS NOT NULL AND "security"."div_last_provided_source_ref" IS NOT NULL
      AND "security"."div" = "security"."div_last_provided" AND "security"."div_date" = "security"."div_last_provided_date" AND "security"."div_source_ref" = "security"."div_last_provided_source_ref")
    OR ("security"."div_state" IN ('source_missing','unsupported','row_missing','unexplained_missing')
      AND "security"."div" IS NULL AND "security"."div_date" IS NOT NULL AND "security"."div_source_ref" IS NOT NULL AND length(btrim("security"."div_source_ref")) > 0
      AND (("security"."div_last_provided" IS NULL AND "security"."div_last_provided_date" IS NULL AND "security"."div_last_provided_source_ref" IS NULL)
        OR ("security"."div_last_provided" IS NOT NULL AND "security"."div_last_provided_date" IS NOT NULL AND "security"."div_last_provided_source_ref" IS NOT NULL
          AND length(btrim("security"."div_last_provided_source_ref")) > 0 AND "security"."div_last_provided_date" < "security"."div_date")))
  ));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_div_daily_check" CHECK ("security"."div_date" IS NULL OR (isfinite("security"."div_date") AND ("security"."div_date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_div_last_daily_check" CHECK ("security"."div_last_provided_date" IS NULL OR (isfinite("security"."div_last_provided_date") AND ("security"."div_last_provided_date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_div_number_check" CHECK ("security"."div" IS NULL OR ("security"."div" > '-Infinity'::double precision AND "security"."div" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_div_last_number_check" CHECK ("security"."div_last_provided" IS NULL OR ("security"."div_last_provided" > '-Infinity'::double precision AND "security"."div_last_provided" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_dps_result_check" CHECK ((
    ("security"."dps_state" = 'no_observation' AND "security"."dps" IS NULL AND "security"."dps_date" IS NULL AND "security"."dps_source_ref" IS NULL
      AND "security"."dps_last_provided" IS NULL AND "security"."dps_last_provided_date" IS NULL AND "security"."dps_last_provided_source_ref" IS NULL)
    OR ("security"."dps_state" = 'provided' AND "security"."dps" IS NOT NULL AND "security"."dps_date" IS NOT NULL
      AND "security"."dps_source_ref" IS NOT NULL AND length(btrim("security"."dps_source_ref")) > 0
      AND "security"."dps_last_provided" IS NOT NULL AND "security"."dps_last_provided_date" IS NOT NULL AND "security"."dps_last_provided_source_ref" IS NOT NULL
      AND "security"."dps" = "security"."dps_last_provided" AND "security"."dps_date" = "security"."dps_last_provided_date" AND "security"."dps_source_ref" = "security"."dps_last_provided_source_ref")
    OR ("security"."dps_state" IN ('source_missing','unsupported','row_missing','unexplained_missing')
      AND "security"."dps" IS NULL AND "security"."dps_date" IS NOT NULL AND "security"."dps_source_ref" IS NOT NULL AND length(btrim("security"."dps_source_ref")) > 0
      AND (("security"."dps_last_provided" IS NULL AND "security"."dps_last_provided_date" IS NULL AND "security"."dps_last_provided_source_ref" IS NULL)
        OR ("security"."dps_last_provided" IS NOT NULL AND "security"."dps_last_provided_date" IS NOT NULL AND "security"."dps_last_provided_source_ref" IS NOT NULL
          AND length(btrim("security"."dps_last_provided_source_ref")) > 0 AND "security"."dps_last_provided_date" < "security"."dps_date")))
  ));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_dps_daily_check" CHECK ("security"."dps_date" IS NULL OR (isfinite("security"."dps_date") AND ("security"."dps_date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_dps_last_daily_check" CHECK ("security"."dps_last_provided_date" IS NULL OR (isfinite("security"."dps_last_provided_date") AND ("security"."dps_last_provided_date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_dps_number_check" CHECK ("security"."dps" IS NULL OR ("security"."dps" > '-Infinity'::double precision AND "security"."dps" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_dps_last_number_check" CHECK ("security"."dps_last_provided" IS NULL OR ("security"."dps_last_provided" > '-Infinity'::double precision AND "security"."dps_last_provided" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "security_rank" ADD CONSTRAINT "security_rank_daily_check" CHECK ("security_rank"."rank_date" IS NULL OR (isfinite("security_rank"."rank_date") AND ("security_rank"."rank_date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "security_rank" ADD CONSTRAINT "security_rank_observed_daily_check" CHECK ("security_rank"."value_observed_at" IS NULL OR (isfinite("security_rank"."value_observed_at") AND ("security_rank"."value_observed_at" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "security_rank" ADD CONSTRAINT "security_rank_scope_check" CHECK ("security_rank"."scope_key" IS NULL OR length(btrim("security_rank"."scope_key")) > 0);--> statement-breakpoint
ALTER TABLE "security_rank" ADD CONSTRAINT "security_rank_evidence_check" CHECK ("security_rank"."evidence_ref" IS NULL OR length(btrim("security_rank"."evidence_ref")) > 0);--> statement-breakpoint
ALTER TABLE "security_rank" ADD CONSTRAINT "security_rank_revision_check" CHECK ("security_rank"."result_revision" > 0);--> statement-breakpoint
ALTER TABLE "security_rank" ADD CONSTRAINT "security_rank_value_check" CHECK ("security_rank"."value" IS NULL OR ("security_rank"."value" > '-Infinity'::numeric AND "security_rank"."value" < 'Infinity'::numeric));--> statement-breakpoint
ALTER TABLE "security_rank" ADD CONSTRAINT "security_rank_observation_check" CHECK (("security_rank"."value" IS NULL) = ("security_rank"."value_observed_at" IS NULL)
    AND ("security_rank"."value_observed_at" IS NULL OR "security_rank"."value_observed_at" <= "security_rank"."rank_date"));--> statement-breakpoint
ALTER TABLE "security_rank" ADD CONSTRAINT "security_rank_marketcap_integer_check" CHECK ("security_rank"."metric_type" <> 'marketcap' OR "security_rank"."value" IS NULL
    OR ("security_rank"."value" >= 0 AND "security_rank"."value" = trunc("security_rank"."value")));--> statement-breakpoint
ALTER TABLE "security_rank" ADD CONSTRAINT "security_rank_state_check" CHECK (
    ("security_rank"."ranking_state" = 'included' AND "security_rank"."value" IS NOT NULL AND "security_rank"."value_observed_at" IS NOT NULL
      AND "security_rank"."current_rank" IS NOT NULL AND "security_rank"."current_rank" > 0 AND "security_rank"."exclusion_reason" IS NULL)
    OR ("security_rank"."ranking_state" = 'excluded' AND "security_rank"."current_rank" IS NULL AND "security_rank"."exclusion_reason" IS NOT NULL
      AND length(btrim("security_rank"."exclusion_reason")) > 0));--> statement-breakpoint
ALTER TABLE "security_rank" ADD CONSTRAINT "security_rank_prior_check" CHECK ("security_rank"."prior_rank" IS NULL OR "security_rank"."prior_rank" > 0);--> statement-breakpoint
ALTER TABLE "stockcodename" ADD CONSTRAINT "stockcodename_daily_check" CHECK ("stockcodename"."date" IS NULL OR (isfinite("stockcodename"."date") AND ("stockcodename"."date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "stockcodename" ADD CONSTRAINT "stockcodename_exchange_check" CHECK ("stockcodename"."exchange" IS NULL OR length(btrim("stockcodename"."exchange")) > 0);--> statement-breakpoint
ALTER TABLE "stockcodename" ADD CONSTRAINT "stockcodename_ticker_check" CHECK ("stockcodename"."ticker" IS NULL OR length(btrim("stockcodename"."ticker")) > 0);--> statement-breakpoint
ALTER TABLE "stockcodename" ADD CONSTRAINT "stockcodename_source_ref_check" CHECK ("stockcodename"."source_ref" IS NULL OR length(btrim("stockcodename"."source_ref")) > 0);--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ADD CONSTRAINT "tmp_bppedds_daily_check" CHECK ("tmp_bppedds"."date" IS NULL OR (isfinite("tmp_bppedds"."date") AND ("tmp_bppedds"."date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ADD CONSTRAINT "tmp_bppedds_exchange_check" CHECK ("tmp_bppedds"."exchange" IS NULL OR length(btrim("tmp_bppedds"."exchange")) > 0);--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ADD CONSTRAINT "tmp_bppedds_ticker_check" CHECK ("tmp_bppedds"."ticker" IS NULL OR length(btrim("tmp_bppedds"."ticker")) > 0);--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ADD CONSTRAINT "tmp_bppedds_source_ref_check" CHECK ("tmp_bppedds"."source_ref" IS NULL OR length(btrim("tmp_bppedds"."source_ref")) > 0);--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ADD CONSTRAINT "tmp_bppedds_bps_state_check" CHECK (("tmp_bppedds"."bps_state" = 'provided') = ("tmp_bppedds"."bps" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ADD CONSTRAINT "tmp_bppedds_bps_finite_check" CHECK ("tmp_bppedds"."bps" IS NULL OR ("tmp_bppedds"."bps" > '-Infinity'::double precision AND "tmp_bppedds"."bps" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ADD CONSTRAINT "tmp_bppedds_per_state_check" CHECK (("tmp_bppedds"."per_state" = 'provided') = ("tmp_bppedds"."per" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ADD CONSTRAINT "tmp_bppedds_per_finite_check" CHECK ("tmp_bppedds"."per" IS NULL OR ("tmp_bppedds"."per" > '-Infinity'::double precision AND "tmp_bppedds"."per" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ADD CONSTRAINT "tmp_bppedds_pbr_state_check" CHECK (("tmp_bppedds"."pbr_state" = 'provided') = ("tmp_bppedds"."pbr" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ADD CONSTRAINT "tmp_bppedds_pbr_finite_check" CHECK ("tmp_bppedds"."pbr" IS NULL OR ("tmp_bppedds"."pbr" > '-Infinity'::double precision AND "tmp_bppedds"."pbr" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ADD CONSTRAINT "tmp_bppedds_eps_state_check" CHECK (("tmp_bppedds"."eps_state" = 'provided') = ("tmp_bppedds"."eps" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ADD CONSTRAINT "tmp_bppedds_eps_finite_check" CHECK ("tmp_bppedds"."eps" IS NULL OR ("tmp_bppedds"."eps" > '-Infinity'::double precision AND "tmp_bppedds"."eps" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ADD CONSTRAINT "tmp_bppedds_div_state_check" CHECK (("tmp_bppedds"."div_state" = 'provided') = ("tmp_bppedds"."div" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ADD CONSTRAINT "tmp_bppedds_div_finite_check" CHECK ("tmp_bppedds"."div" IS NULL OR ("tmp_bppedds"."div" > '-Infinity'::double precision AND "tmp_bppedds"."div" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ADD CONSTRAINT "tmp_bppedds_dps_state_check" CHECK (("tmp_bppedds"."dps_state" = 'provided') = ("tmp_bppedds"."dps" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "tmp_bppedds" ADD CONSTRAINT "tmp_bppedds_dps_finite_check" CHECK ("tmp_bppedds"."dps" IS NULL OR ("tmp_bppedds"."dps" > '-Infinity'::double precision AND "tmp_bppedds"."dps" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "tmp_marketcaps" ADD CONSTRAINT "tmp_marketcaps_daily_check" CHECK ("tmp_marketcaps"."date" IS NULL OR (isfinite("tmp_marketcaps"."date") AND ("tmp_marketcaps"."date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "tmp_marketcaps" ADD CONSTRAINT "tmp_marketcaps_exchange_check" CHECK ("tmp_marketcaps"."exchange" IS NULL OR length(btrim("tmp_marketcaps"."exchange")) > 0);--> statement-breakpoint
ALTER TABLE "tmp_marketcaps" ADD CONSTRAINT "tmp_marketcaps_ticker_check" CHECK ("tmp_marketcaps"."ticker" IS NULL OR length(btrim("tmp_marketcaps"."ticker")) > 0);--> statement-breakpoint
ALTER TABLE "tmp_marketcaps" ADD CONSTRAINT "tmp_marketcaps_source_ref_check" CHECK ("tmp_marketcaps"."source_ref" IS NULL OR length(btrim("tmp_marketcaps"."source_ref")) > 0);--> statement-breakpoint
ALTER TABLE "tmp_marketcaps" ADD CONSTRAINT "tmp_marketcaps_close_finite_check" CHECK ("tmp_marketcaps"."close" IS NULL OR ("tmp_marketcaps"."close" > '-Infinity'::double precision AND "tmp_marketcaps"."close" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "tmp_marketcaps" ADD CONSTRAINT "tmp_marketcaps_close_nonnegative_check" CHECK ("tmp_marketcaps"."close" IS NULL OR "tmp_marketcaps"."close" >= 0);--> statement-breakpoint
ALTER TABLE "tmp_marketcaps" ADD CONSTRAINT "tmp_marketcaps_volume_nonnegative_check" CHECK ("tmp_marketcaps"."volume" IS NULL OR "tmp_marketcaps"."volume" >= 0);--> statement-breakpoint
ALTER TABLE "tmp_marketcaps" ADD CONSTRAINT "tmp_marketcaps_transaction_nonnegative_check" CHECK ("tmp_marketcaps"."transaction" IS NULL OR "tmp_marketcaps"."transaction" >= 0);--> statement-breakpoint
ALTER TABLE "tmp_marketcaps" ADD CONSTRAINT "tmp_marketcaps_marketcap_nonnegative_check" CHECK ("tmp_marketcaps"."marketcap" IS NULL OR "tmp_marketcaps"."marketcap" >= 0);--> statement-breakpoint
ALTER TABLE "tmp_marketcaps" ADD CONSTRAINT "tmp_marketcaps_shares_nonnegative_check" CHECK ("tmp_marketcaps"."shares" IS NULL OR "tmp_marketcaps"."shares" >= 0);--> statement-breakpoint
ALTER TABLE "tmp_prices" ADD CONSTRAINT "tmp_prices_daily_check" CHECK ("tmp_prices"."date" IS NULL OR (isfinite("tmp_prices"."date") AND ("tmp_prices"."date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00'));--> statement-breakpoint
ALTER TABLE "tmp_prices" ADD CONSTRAINT "tmp_prices_exchange_check" CHECK ("tmp_prices"."exchange" IS NULL OR length(btrim("tmp_prices"."exchange")) > 0);--> statement-breakpoint
ALTER TABLE "tmp_prices" ADD CONSTRAINT "tmp_prices_ticker_check" CHECK ("tmp_prices"."ticker" IS NULL OR length(btrim("tmp_prices"."ticker")) > 0);--> statement-breakpoint
ALTER TABLE "tmp_prices" ADD CONSTRAINT "tmp_prices_source_ref_check" CHECK ("tmp_prices"."source_ref" IS NULL OR length(btrim("tmp_prices"."source_ref")) > 0);--> statement-breakpoint
ALTER TABLE "tmp_prices" ADD CONSTRAINT "tmp_prices_open_finite_check" CHECK ("tmp_prices"."open" IS NULL OR ("tmp_prices"."open" > '-Infinity'::double precision AND "tmp_prices"."open" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "tmp_prices" ADD CONSTRAINT "tmp_prices_open_nonnegative_check" CHECK ("tmp_prices"."open" IS NULL OR "tmp_prices"."open" >= 0);--> statement-breakpoint
ALTER TABLE "tmp_prices" ADD CONSTRAINT "tmp_prices_high_finite_check" CHECK ("tmp_prices"."high" IS NULL OR ("tmp_prices"."high" > '-Infinity'::double precision AND "tmp_prices"."high" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "tmp_prices" ADD CONSTRAINT "tmp_prices_high_nonnegative_check" CHECK ("tmp_prices"."high" IS NULL OR "tmp_prices"."high" >= 0);--> statement-breakpoint
ALTER TABLE "tmp_prices" ADD CONSTRAINT "tmp_prices_low_finite_check" CHECK ("tmp_prices"."low" IS NULL OR ("tmp_prices"."low" > '-Infinity'::double precision AND "tmp_prices"."low" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "tmp_prices" ADD CONSTRAINT "tmp_prices_low_nonnegative_check" CHECK ("tmp_prices"."low" IS NULL OR "tmp_prices"."low" >= 0);--> statement-breakpoint
ALTER TABLE "tmp_prices" ADD CONSTRAINT "tmp_prices_close_finite_check" CHECK ("tmp_prices"."close" IS NULL OR ("tmp_prices"."close" > '-Infinity'::double precision AND "tmp_prices"."close" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "tmp_prices" ADD CONSTRAINT "tmp_prices_close_nonnegative_check" CHECK ("tmp_prices"."close" IS NULL OR "tmp_prices"."close" >= 0);--> statement-breakpoint
ALTER TABLE "tmp_prices" ADD CONSTRAINT "tmp_prices_volume_nonnegative_check" CHECK ("tmp_prices"."volume" IS NULL OR "tmp_prices"."volume" >= 0);--> statement-breakpoint
ALTER TABLE "tmp_prices" ADD CONSTRAINT "tmp_prices_transaction_nonnegative_check" CHECK ("tmp_prices"."transaction" IS NULL OR "tmp_prices"."transaction" >= 0);--> statement-breakpoint
ALTER TABLE "tmp_prices" ADD CONSTRAINT "tmp_prices_rate_finite_check" CHECK ("tmp_prices"."rate" IS NULL OR ("tmp_prices"."rate" > '-Infinity'::double precision AND "tmp_prices"."rate" < 'Infinity'::double precision));
--> statement-breakpoint
-- The publication is replaced together with its current rows. Drizzle does not
-- model deferred FKs or constraint triggers; this hand-written section is part
-- of the new-database installation contract, not a historical-data migration.
ALTER TABLE "company" ALTER CONSTRAINT "company_publication_key_result_publication_publication_key_fk" DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "security" ALTER CONSTRAINT "security_publication_key_result_publication_publication_key_fk" DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "security_rank" ALTER CONSTRAINT "security_rank_publication_key_result_publication_publication_key_fk" DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
CREATE FUNCTION cd_guard_publication_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.publication_key IS DISTINCT FROM OLD.publication_key
     OR NEW.result_kind IS DISTINCT FROM OLD.result_kind
     OR NEW.scope_key IS DISTINCT FROM OLD.scope_key
     OR NEW.metric_type IS DISTINCT FROM OLD.metric_type THEN
    RAISE EXCEPTION 'publication identity cannot change' USING ERRCODE = '23514';
  END IF;
  IF NEW.revision < OLD.revision OR NEW.as_of < OLD.as_of THEN
    RAISE EXCEPTION 'publication revision or business date cannot retreat' USING ERRCODE = '23514';
  END IF;
  IF NEW.revision = OLD.revision AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'same revision must retain identical publication metadata' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER result_publication_revision_guard BEFORE UPDATE ON result_publication
FOR EACH ROW EXECUTE FUNCTION cd_guard_publication_revision();
--> statement-breakpoint
CREATE FUNCTION cd_guard_result_row() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  current_row jsonb;
  publication result_publication%ROWTYPE;
  column_name text;
  actual_rows bigint;
  actual_included bigint;
BEGIN
  -- Inspect the final persisted row; a transaction can update one row more than once.
  IF TG_TABLE_NAME = 'security' THEN
    SELECT to_jsonb(s) INTO current_row FROM security s
      WHERE s.security_id = COALESCE(NEW.security_id, OLD.security_id);
  ELSIF TG_TABLE_NAME = 'company' THEN
    SELECT to_jsonb(c) INTO current_row FROM company c
      WHERE c.company_id = COALESCE(NEW.company_id, OLD.company_id);
  ELSE
    SELECT to_jsonb(r) INTO current_row FROM security_rank r
      WHERE r.id = COALESCE(NEW.id, OLD.id);
  END IF;
  IF TG_OP <> 'INSERT' AND OLD.publication_key IS NOT NULL
      AND (current_row IS NULL OR current_row->>'publication_key' IS DISTINCT FROM OLD.publication_key) THEN
    SELECT * INTO publication FROM result_publication WHERE publication_key = OLD.publication_key;
    IF FOUND AND publication.revision <= OLD.result_revision THEN
      RAISE EXCEPTION 'removing a published result requires a new publication revision' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF current_row IS NULL OR current_row->>'publication_key' IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO publication FROM result_publication
    WHERE publication_key = current_row->>'publication_key';
  IF NOT FOUND OR (current_row->>'result_revision')::bigint IS DISTINCT FROM publication.revision
      OR (current_row->>'calculation_id')::uuid IS DISTINCT FROM publication.calculation_id THEN
    RAISE EXCEPTION 'result row does not match current publication' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'security' THEN
    IF publication.result_kind <> 'security_latest' THEN
      RAISE EXCEPTION 'security requires a security_latest publication' USING ERRCODE = '23514';
    END IF;
    FOREACH column_name IN ARRAY ARRAY['price_date','shares_date','marketcap_date','bps_date','per_date','pbr_date','eps_date','div_date','dps_date'] LOOP
      IF (current_row->>column_name)::timestamptz > publication.as_of THEN
        RAISE EXCEPTION 'security observation exceeds publication business date' USING ERRCODE = '23514';
      END IF;
    END LOOP;
    SELECT count(*) INTO actual_rows FROM security WHERE publication_key = publication.publication_key;
  ELSIF TG_TABLE_NAME = 'company' THEN
    IF publication.result_kind <> 'company_marketcap'
        OR (current_row->>'marketcap_date')::timestamptz IS DISTINCT FROM publication.as_of THEN
      RAISE EXCEPTION 'company kind or business date differs from publication' USING ERRCODE = '23514';
    END IF;
    SELECT count(*), count(*) FILTER(WHERE ranking_state = 'included') INTO actual_rows, actual_included
      FROM company WHERE publication_key = publication.publication_key;
  ELSE
    IF publication.result_kind <> 'security_rank'
        OR current_row->>'scope_key' IS DISTINCT FROM publication.scope_key
        OR current_row->>'metric_type' IS DISTINCT FROM publication.metric_type::text
        OR (current_row->>'rank_date')::timestamptz IS DISTINCT FROM publication.as_of THEN
      RAISE EXCEPTION 'rank kind, scope, metric or business date differs from publication' USING ERRCODE = '23514';
    END IF;
    SELECT count(*), count(*) FILTER(WHERE ranking_state = 'included') INTO actual_rows, actual_included
      FROM security_rank WHERE publication_key = publication.publication_key;
  END IF;
  IF actual_rows <> publication.row_count
      OR (publication.result_kind <> 'security_latest' AND actual_included IS DISTINCT FROM publication.included_count) THEN
    RAISE EXCEPTION 'result coverage differs from current publication' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER security_publication_row_guard AFTER INSERT OR UPDATE OR DELETE ON security
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cd_guard_result_row();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER company_publication_row_guard AFTER INSERT OR UPDATE OR DELETE ON company
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cd_guard_result_row();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER security_rank_publication_row_guard AFTER INSERT OR UPDATE OR DELETE ON security_rank
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cd_guard_result_row();
--> statement-breakpoint
CREATE FUNCTION cd_guard_result_publication() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  publication result_publication%ROWTYPE;
  actual_rows bigint;
  actual_included bigint;
  wrong_rows boolean;
BEGIN
  SELECT * INTO publication FROM result_publication WHERE publication_key = NEW.publication_key;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF publication.result_kind = 'security_latest' THEN
    SELECT count(*), bool_or(s.result_revision IS DISTINCT FROM publication.revision
      OR s.calculation_id IS DISTINCT FROM publication.calculation_id
      OR s.price_date > publication.as_of OR s.shares_date > publication.as_of OR s.marketcap_date > publication.as_of
      OR s.bps_date > publication.as_of OR s.per_date > publication.as_of OR s.pbr_date > publication.as_of
      OR s.eps_date > publication.as_of OR s.div_date > publication.as_of OR s.dps_date > publication.as_of)
    INTO actual_rows, wrong_rows FROM security s WHERE s.publication_key = publication.publication_key;
    IF EXISTS(SELECT 1 FROM company c WHERE c.publication_key = publication.publication_key)
        OR EXISTS(SELECT 1 FROM security_rank r WHERE r.publication_key = publication.publication_key) THEN
      RAISE EXCEPTION 'publication used by incorrect result table' USING ERRCODE = '23514';
    END IF;
  ELSIF publication.result_kind = 'company_marketcap' THEN
    SELECT count(*), count(*) FILTER(WHERE c.ranking_state = 'included'),
      bool_or(c.result_revision IS DISTINCT FROM publication.revision OR c.calculation_id IS DISTINCT FROM publication.calculation_id
        OR c.marketcap_date IS DISTINCT FROM publication.as_of)
    INTO actual_rows, actual_included, wrong_rows FROM company c WHERE c.publication_key = publication.publication_key;
    IF EXISTS(SELECT 1 FROM security s WHERE s.publication_key = publication.publication_key)
        OR EXISTS(SELECT 1 FROM security_rank r WHERE r.publication_key = publication.publication_key) THEN
      RAISE EXCEPTION 'publication used by incorrect result table' USING ERRCODE = '23514';
    END IF;
  ELSE
    SELECT count(*), count(*) FILTER(WHERE r.ranking_state = 'included'),
      bool_or(r.result_revision IS DISTINCT FROM publication.revision OR r.calculation_id IS DISTINCT FROM publication.calculation_id
        OR r.scope_key IS DISTINCT FROM publication.scope_key OR r.metric_type IS DISTINCT FROM publication.metric_type
        OR r.rank_date IS DISTINCT FROM publication.as_of)
    INTO actual_rows, actual_included, wrong_rows FROM security_rank r WHERE r.publication_key = publication.publication_key;
    IF EXISTS(SELECT 1 FROM security s WHERE s.publication_key = publication.publication_key)
        OR EXISTS(SELECT 1 FROM company c WHERE c.publication_key = publication.publication_key) THEN
      RAISE EXCEPTION 'publication used by incorrect result table' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF actual_rows <> publication.row_count OR wrong_rows IS TRUE
      OR (publication.result_kind <> 'security_latest' AND actual_included IS DISTINCT FROM publication.included_count) THEN
    RAISE EXCEPTION 'publication coverage or current result metadata mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER result_publication_result_guard AFTER INSERT OR UPDATE ON result_publication
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cd_guard_result_publication();
--> statement-breakpoint
CREATE FUNCTION cd_guard_same_revision_result() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  previous_result jsonb;
  next_result jsonb;
  ignored_columns text[];
BEGIN
  IF NEW.publication_key IS NULL OR OLD.publication_key IS DISTINCT FROM NEW.publication_key
      OR OLD.result_revision IS DISTINCT FROM NEW.result_revision THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'security' THEN
    ignored_columns := ARRAY['security_id','company_id','ticker','name','kor_name','listing_date','delisting_date','type','exchange','country','created_at','updated_at'];
  ELSIF TG_TABLE_NAME = 'company' THEN
    ignored_columns := ARRAY['company_id','name','kor_name','address','kor_address','country','type','tel','fax','postal_code','homepage','employees','industry','established_date','logo','created_at','updated_at'];
  ELSE
    ignored_columns := ARRAY['created_at','updated_at'];
  END IF;
  previous_result := to_jsonb(OLD) - ignored_columns;
  next_result := to_jsonb(NEW) - ignored_columns;
  IF previous_result IS DISTINCT FROM next_result THEN
    RAISE EXCEPTION 'changed official result requires a new revision' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER security_same_revision_guard BEFORE UPDATE ON security
FOR EACH ROW EXECUTE FUNCTION cd_guard_same_revision_result();
--> statement-breakpoint
CREATE TRIGGER company_same_revision_guard BEFORE UPDATE ON company
FOR EACH ROW EXECUTE FUNCTION cd_guard_same_revision_result();
--> statement-breakpoint
CREATE TRIGGER security_rank_same_revision_guard BEFORE UPDATE ON security_rank
FOR EACH ROW EXECUTE FUNCTION cd_guard_same_revision_result();
