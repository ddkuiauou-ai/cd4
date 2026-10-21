CREATE TABLE "security_event" (
	"event_id" text PRIMARY KEY NOT NULL,
	"security_id" text NOT NULL,
	"company_id" text,
	"event_type" text NOT NULL,
	"effective_on" date,
	"date_precision" text NOT NULL,
	"event_year" integer,
	"old_name" text NOT NULL,
	"new_name" text NOT NULL,
	"source_ref" text NOT NULL,
	"basis" text NOT NULL,
	"review_ref" text,
	"mapping_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "security_event_kind_check" CHECK ("security_event"."event_type" IN ('security_name_change','company_name_change')
    AND ("security_event"."event_type" <> 'company_name_change' OR "security_event"."company_id" IS NOT NULL)),
	CONSTRAINT "security_event_precision_check" CHECK (("security_event"."date_precision" = 'day' AND "security_event"."effective_on" IS NOT NULL
      AND isfinite("security_event"."effective_on") AND ("security_event"."event_year" IS NULL OR "security_event"."event_year" = extract(year from "security_event"."effective_on")))
    OR ("security_event"."date_precision" = 'year' AND "security_event"."effective_on" IS NULL AND "security_event"."event_year" IS NOT NULL AND "security_event"."event_year" BETWEEN 1 AND 9999)
    OR ("security_event"."date_precision" = 'unknown' AND "security_event"."effective_on" IS NULL AND "security_event"."event_year" IS NULL)),
	CONSTRAINT "security_event_basis_check" CHECK ("security_event"."basis" IN ('roster_observed','disclosure','reviewed')
    AND ("security_event"."basis" NOT IN ('reviewed','disclosure') OR "security_event"."review_ref" IS NOT NULL)),
	CONSTRAINT "security_event_changed_name_check" CHECK ("security_event"."old_name" <> "security_event"."new_name"),
	CONSTRAINT "security_event_old_name_check" CHECK ("security_event"."old_name" IS NULL OR length(btrim("security_event"."old_name")) > 0),
	CONSTRAINT "security_event_new_name_check" CHECK ("security_event"."new_name" IS NULL OR length(btrim("security_event"."new_name")) > 0),
	CONSTRAINT "security_event_source_ref_check" CHECK ("security_event"."source_ref" IS NULL OR length(btrim("security_event"."source_ref")) > 0),
	CONSTRAINT "security_event_review_ref_check" CHECK ("security_event"."review_ref" IS NULL OR length(btrim("security_event"."review_ref")) > 0),
	CONSTRAINT "security_event_mapping_ref_check" CHECK ("security_event"."mapping_ref" IS NULL OR length(btrim("security_event"."mapping_ref")) > 0)
);
--> statement-breakpoint
CREATE TABLE "security_listing_period" (
	"period_id" text PRIMARY KEY NOT NULL,
	"security_id" text NOT NULL,
	"listing_date" date NOT NULL,
	"delisting_date" date,
	"last_present_on" date NOT NULL,
	"listing_source_ref" text NOT NULL,
	"delisting_source_ref" text,
	"relisting_review_ref" text,
	"mapping_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "security_listing_period_dates_check" CHECK (isfinite("security_listing_period"."listing_date") AND isfinite("security_listing_period"."last_present_on")
    AND "security_listing_period"."last_present_on" >= "security_listing_period"."listing_date" AND ("security_listing_period"."delisting_date" IS NULL
      OR (isfinite("security_listing_period"."delisting_date") AND "security_listing_period"."delisting_date" > "security_listing_period"."last_present_on"))),
	CONSTRAINT "security_listing_period_end_proof_check" CHECK (("security_listing_period"."delisting_date" IS NULL) = ("security_listing_period"."delisting_source_ref" IS NULL)),
	CONSTRAINT "security_listing_period_listing_ref_check" CHECK ("security_listing_period"."listing_source_ref" IS NULL OR length(btrim("security_listing_period"."listing_source_ref")) > 0),
	CONSTRAINT "security_listing_period_delisting_ref_check" CHECK ("security_listing_period"."delisting_source_ref" IS NULL OR length(btrim("security_listing_period"."delisting_source_ref")) > 0),
	CONSTRAINT "security_listing_period_review_ref_check" CHECK ("security_listing_period"."relisting_review_ref" IS NULL OR length(btrim("security_listing_period"."relisting_review_ref")) > 0),
	CONSTRAINT "security_listing_period_mapping_ref_check" CHECK ("security_listing_period"."mapping_ref" IS NULL OR length(btrim("security_listing_period"."mapping_ref")) > 0)
);
--> statement-breakpoint
ALTER TABLE "security_event" ADD CONSTRAINT "security_event_security_id_security_security_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."security"("security_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_event" ADD CONSTRAINT "security_event_company_id_company_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_listing_period" ADD CONSTRAINT "security_listing_period_security_id_security_security_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."security"("security_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "security_event_security_date_idx" ON "security_event" USING btree ("security_id","effective_on");--> statement-breakpoint
CREATE UNIQUE INDEX "security_listing_period_security_start_unique" ON "security_listing_period" USING btree ("security_id","listing_date");--> statement-breakpoint
CREATE INDEX "security_listing_period_security_idx" ON "security_listing_period" USING btree ("security_id");--> statement-breakpoint
-- Cross-row intervals are serialized through the identity row. The no-op UPDATE
-- also creates a write conflict at REPEATABLE READ, preventing stale concurrent overlap checks.
CREATE FUNCTION cd_check_listing_period_overlap() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE security SET updated_at = updated_at WHERE security_id = NEW.security_id;
  IF EXISTS (SELECT 1 FROM security_listing_period p
    WHERE p.security_id = NEW.security_id AND p.period_id <> NEW.period_id
      AND daterange(p.listing_date,p.delisting_date,'[)') && daterange(NEW.listing_date,NEW.delisting_date,'[)')) THEN
    RAISE EXCEPTION 'overlapping listing periods for security %',NEW.security_id USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER security_listing_period_no_overlap BEFORE INSERT OR UPDATE ON security_listing_period
FOR EACH ROW EXECUTE FUNCTION cd_check_listing_period_overlap();
--> statement-breakpoint
CREATE UNIQUE INDEX "security_ticker_unique" ON "security" USING btree ("ticker");