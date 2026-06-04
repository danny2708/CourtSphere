CREATE TABLE "court_manager_assignments" (
  "court_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "assigned_by_user_id" UUID,
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "court_manager_assignments_pkey" PRIMARY KEY ("court_id", "user_id"),
  CONSTRAINT "court_manager_assignments_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("court_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "court_manager_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "court_manager_assignments_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "court_manager_assignments_user_id_idx" ON "court_manager_assignments"("user_id");
CREATE INDEX "court_manager_assignments_assigned_by_user_id_idx" ON "court_manager_assignments"("assigned_by_user_id");

INSERT INTO "court_manager_assignments" ("court_id", "user_id")
SELECT c."court_id", ur."user_id"
FROM "courts" c
CROSS JOIN "user_roles" ur
JOIN "roles" r ON r."role_id" = ur."role_id"
WHERE r."role_name" = 'FIELD_MANAGER'
ON CONFLICT DO NOTHING;
