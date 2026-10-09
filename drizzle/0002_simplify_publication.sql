ALTER TABLE "company" ADD CONSTRAINT "company_publication_kind_check" CHECK ("company"."publication_key" IS NULL
      OR split_part("company"."publication_key", '/', 1) = 'company_marketcap');--> statement-breakpoint
ALTER TABLE "security" ADD CONSTRAINT "security_publication_kind_check" CHECK ("security"."publication_key" IS NULL
      OR split_part("security"."publication_key", '/', 1) = 'security_latest');--> statement-breakpoint
ALTER TABLE "security_rank" ADD CONSTRAINT "security_rank_publication_key_check" CHECK ("security_rank"."publication_key" =
    'security_rank/' || "security_rank"."scope_key" || '/' || "security_rank"."metric_type"::text);
--> statement-breakpoint
-- tem owns publication validation and retry policy. Keep simple row CHECKs/FKs,
-- and remove cross-row scans and mutation restrictions from the business DB.
DROP TRIGGER "result_publication_revision_guard" ON "public"."result_publication";
--> statement-breakpoint
DROP TRIGGER "result_publication_result_guard" ON "public"."result_publication";
--> statement-breakpoint
DROP TRIGGER "security_publication_row_guard" ON "public"."security";
--> statement-breakpoint
DROP TRIGGER "security_same_revision_guard" ON "public"."security";
--> statement-breakpoint
DROP TRIGGER "company_publication_row_guard" ON "public"."company";
--> statement-breakpoint
DROP TRIGGER "company_same_revision_guard" ON "public"."company";
--> statement-breakpoint
DROP TRIGGER "security_rank_publication_row_guard" ON "public"."security_rank";
--> statement-breakpoint
DROP TRIGGER "security_rank_same_revision_guard" ON "public"."security_rank";
--> statement-breakpoint
DROP FUNCTION "public"."cd_guard_publication_revision"();
--> statement-breakpoint
DROP FUNCTION "public"."cd_guard_result_row"();
--> statement-breakpoint
DROP FUNCTION "public"."cd_guard_result_publication"();
--> statement-breakpoint
DROP FUNCTION "public"."cd_guard_same_revision_result"();
