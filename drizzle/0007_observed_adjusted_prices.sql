CREATE TABLE "price_adjustment_history" (
	"date" timestamp with time zone NOT NULL,
	"exchange" text NOT NULL,
	"ticker" text NOT NULL,
	"security_id" text,
	"observed_at" timestamp with time zone NOT NULL,
	"adv_open" double precision NOT NULL,
	"adv_high" double precision NOT NULL,
	"adv_low" double precision NOT NULL,
	"adv_close" double precision NOT NULL,
	"adv_source" text NOT NULL,
	CONSTRAINT "price_adjustment_history_date_exchange_ticker_observed_at_pk" PRIMARY KEY("date","exchange","ticker","observed_at"),
	CONSTRAINT "price_adjustment_history_date_check" CHECK ("price_adjustment_history"."date" IS NULL OR (isfinite("price_adjustment_history"."date") AND ("price_adjustment_history"."date" AT TIME ZONE 'Asia/Seoul')::time = time '00:00:00')),
	CONSTRAINT "price_adjustment_history_exchange_check" CHECK ("price_adjustment_history"."exchange" IS NULL OR length(btrim("price_adjustment_history"."exchange")) > 0),
	CONSTRAINT "price_adjustment_history_ticker_check" CHECK ("price_adjustment_history"."ticker" IS NULL OR length(btrim("price_adjustment_history"."ticker")) > 0),
	CONSTRAINT "price_adjustment_history_source_check" CHECK ("price_adjustment_history"."adv_source" IS NULL OR length(btrim("price_adjustment_history"."adv_source")) > 0),
	CONSTRAINT "price_adjustment_history_observed_at_check" CHECK (isfinite("price_adjustment_history"."observed_at")),
	CONSTRAINT "price_adjustment_history_ohlc_check" CHECK (("price_adjustment_history"."adv_open" >= 0 AND "price_adjustment_history"."adv_open" < 'Infinity'::double precision) AND ("price_adjustment_history"."adv_high" >= 0 AND "price_adjustment_history"."adv_high" < 'Infinity'::double precision) AND ("price_adjustment_history"."adv_low" >= 0 AND "price_adjustment_history"."adv_low" < 'Infinity'::double precision) AND ("price_adjustment_history"."adv_close" >= 0 AND "price_adjustment_history"."adv_close" < 'Infinity'::double precision))
);
--> statement-breakpoint
ALTER TABLE "price" ADD COLUMN "adv_open" double precision;--> statement-breakpoint
ALTER TABLE "price" ADD COLUMN "adv_high" double precision;--> statement-breakpoint
ALTER TABLE "price" ADD COLUMN "adv_low" double precision;--> statement-breakpoint
ALTER TABLE "price" ADD COLUMN "adv_close" double precision;--> statement-breakpoint
ALTER TABLE "price" ADD COLUMN "adv_source" text;--> statement-breakpoint
ALTER TABLE "price" ADD COLUMN "adv_observed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "price_adjustment_history" ADD CONSTRAINT "price_adjustment_history_security_id_security_security_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."security"("security_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "price_adjustment_history_ticker_date_idx" ON "price_adjustment_history" USING btree ("exchange","ticker","date","observed_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "price" ADD CONSTRAINT "price_adv_ohlc_check" CHECK (("price"."adv_open" >= 0 AND "price"."adv_open" < 'Infinity'::double precision) AND ("price"."adv_high" >= 0 AND "price"."adv_high" < 'Infinity'::double precision) AND ("price"."adv_low" >= 0 AND "price"."adv_low" < 'Infinity'::double precision) AND ("price"."adv_close" >= 0 AND "price"."adv_close" < 'Infinity'::double precision));--> statement-breakpoint
ALTER TABLE "price" ADD CONSTRAINT "price_adv_observation_check" CHECK (num_nonnulls("price"."adv_open", "price"."adv_high", "price"."adv_low",
      "price"."adv_close", "price"."adv_source", "price"."adv_observed_at") IN (0, 6)
      AND ("price"."adv_source" IS NULL OR length(btrim("price"."adv_source")) > 0)
      AND ("price"."adv_observed_at" IS NULL OR isfinite("price"."adv_observed_at")));