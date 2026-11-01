DROP TABLE IF EXISTS "display_name";--> statement-breakpoint
DROP TABLE IF EXISTS "search_name";--> statement-breakpoint
DROP TABLE IF EXISTS "tmp_bppedds";--> statement-breakpoint
DROP TABLE IF EXISTS "tmp_marketcaps";--> statement-breakpoint
DROP TABLE IF EXISTS "tmp_prices";--> statement-breakpoint
ALTER TABLE "security_event" DROP CONSTRAINT IF EXISTS "security_event_review_ref_check";--> statement-breakpoint
ALTER TABLE "security_event" DROP CONSTRAINT IF EXISTS "security_event_mapping_ref_check";--> statement-breakpoint
ALTER TABLE "security_event" DROP CONSTRAINT IF EXISTS "security_event_kind_check";--> statement-breakpoint
ALTER TABLE "security_event" DROP CONSTRAINT IF EXISTS "security_event_basis_check";--> statement-breakpoint
ALTER TABLE "security_listing_period" DROP CONSTRAINT IF EXISTS "security_listing_period_review_ref_check";--> statement-breakpoint
ALTER TABLE "security_listing_period" DROP CONSTRAINT IF EXISTS "security_listing_period_mapping_ref_check";--> statement-breakpoint
ALTER TABLE "security_event" DROP COLUMN IF EXISTS "review_ref";--> statement-breakpoint
ALTER TABLE "security_event" DROP COLUMN IF EXISTS "mapping_ref";--> statement-breakpoint
ALTER TABLE "security_listing_period" DROP COLUMN IF EXISTS "relisting_review_ref";--> statement-breakpoint
ALTER TABLE "security_listing_period" DROP COLUMN IF EXISTS "mapping_ref";--> statement-breakpoint
ALTER TABLE "security_event" ADD CONSTRAINT "security_event_kind_check" CHECK ("security_event"."event_type" IN ('security_name_change','company_name_change','market_transfer')
    AND ("security_event"."event_type" <> 'company_name_change' OR "security_event"."company_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "security_event" ADD CONSTRAINT "security_event_basis_check" CHECK ("security_event"."basis" IN ('roster_observed','disclosure','reviewed'));