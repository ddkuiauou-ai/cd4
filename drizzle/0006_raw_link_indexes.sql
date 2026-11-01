DROP INDEX IF EXISTS "bppedd_security_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "bppedd_security_id_date_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "marketcap_security_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "marketcap_security_id_date_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "price_security_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "price_security_id_date_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "stockcodename_security_id_idx";--> statement-breakpoint
CREATE INDEX "bppedd_security_id_idx" ON "bppedd" USING btree ("security_id") WHERE "bppedd"."security_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "bppedd_security_id_date_idx" ON "bppedd" USING btree ("security_id","date") WHERE "bppedd"."security_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "marketcap_security_id_idx" ON "marketcap" USING btree ("security_id") WHERE "marketcap"."security_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "marketcap_security_id_date_idx" ON "marketcap" USING btree ("security_id","date") WHERE "marketcap"."security_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "price_security_id_idx" ON "price" USING btree ("security_id") WHERE "price"."security_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "price_security_id_date_idx" ON "price" USING btree ("security_id","date") WHERE "price"."security_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "stockcodename_security_id_idx" ON "stockcodename" USING btree ("security_id") WHERE "stockcodename"."security_id" IS NOT NULL;