ALTER TABLE "priority_groups" ADD COLUMN "group_code" TEXT;

UPDATE "priority_groups"
SET "group_code" = "group_name"
WHERE "group_code" IS NULL;

ALTER TABLE "priority_groups" ALTER COLUMN "group_code" SET NOT NULL;

CREATE UNIQUE INDEX "priority_groups_group_code_key" ON "priority_groups"("group_code");

ALTER TABLE "priority_policies" ADD COLUMN "can_join_waitlist" BOOLEAN NOT NULL DEFAULT true;
