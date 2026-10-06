import path from "node:path";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { moduleMigrations } from "@/db/schema/module_migrations";

import { applyDown } from "./migration-engine";
import { readMigrationFile } from "./migration-files";

export async function rollbackMigration() {
  console.log("\n=================================");
  console.log("↩️ Module Migration Rollback");
  console.log("=================================");

  const rows = await db
    .select({
      migrationId: moduleMigrations.migrationId,
      moduleKey: moduleMigrations.moduleKey,
      migrationName: moduleMigrations.migrationName,
      migrationFile: moduleMigrations.migrationFile,
      status: moduleMigrations.status,
    })
    .from(moduleMigrations)
    .where(eq(moduleMigrations.status, "APPLIED"))
    .orderBy(desc(moduleMigrations.appliedAt))
    .limit(1);

  if (rows.length === 0) {
    console.log("\nℹ️ No applied migration found.");
    return;
  }

  const latest = rows[0]!;

  console.log("\n---------------------------------");
  console.log("🔍 Migration");
  console.log("---------------------------------");
  console.log(`File   : ${latest.migrationFile}`);
  console.log(`ID     : ${latest.migrationId}`);
  console.log(`Module : ${latest.moduleKey}`);
  console.log(`Name   : ${latest.migrationName}`);

  const migration = await readMigrationFile(
    path.join(process.cwd(), latest.migrationFile)
  );

  if (migration.migrationId !== latest.migrationId) {
    throw new Error(
      `Migration ID mismatch (DB: ${latest.migrationId}, file: ${migration.migrationId})`
    );
  }

  if (!migration.down) {
    throw new Error(
      `Migration "${migration.migrationId}" does not contain down operations.`
    );
  }

  console.log("\n↩️ Applying rollback...");

  try {
    await db.transaction(async (tx) => {
      await applyDown(tx, migration.down as Record<string, unknown>);
      console.log("   ✓ migration operations rolled back");

      await tx
        .update(moduleMigrations)
        .set({ status: "ROLLED_BACK" })
        .where(eq(moduleMigrations.migrationId, latest.migrationId));

      console.log("   ✓ migration history updated");
    });

    console.log(`\n✅ Migration rolled back: ${latest.migrationId}`);
  } catch (error) {
    console.error(`\n❌ Rollback failed: ${latest.migrationId}`);
    console.error(error);
    throw error;
  }
}
