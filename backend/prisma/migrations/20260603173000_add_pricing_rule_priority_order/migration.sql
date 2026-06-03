ALTER TABLE "pricing_rules" ADD COLUMN "priority_order" INTEGER;

WITH ranked_rules AS (
  SELECT
    "pricing_rule_id",
    ROW_NUMBER() OVER (
      PARTITION BY "court_id"
      ORDER BY
        "applicable_day" ASC NULLS FIRST,
        "start_time" ASC,
        "end_time" ASC,
        "created_at" ASC,
        "pricing_rule_id" ASC
    ) AS "next_priority_order"
  FROM "pricing_rules"
)
UPDATE "pricing_rules"
SET "priority_order" = ranked_rules."next_priority_order"
FROM ranked_rules
WHERE "pricing_rules"."pricing_rule_id" = ranked_rules."pricing_rule_id";

ALTER TABLE "pricing_rules" ALTER COLUMN "priority_order" SET NOT NULL;
ALTER TABLE "pricing_rules" ALTER COLUMN "priority_order" SET DEFAULT 1000;

CREATE INDEX "pricing_rules_court_id_priority_order_idx" ON "pricing_rules"("court_id", "priority_order");
