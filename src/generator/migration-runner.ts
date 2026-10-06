import path from "node:path";
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { moduleMigrations } from "@/db/schema/module_migrations";

import { applyUp } from "./migration-engine";
import {
  collectMigrationFiles,
  directoryExists,
  getMigrationsRoot,
  readMigrationFile,
  validateModuleMigration,
} from "./migration-files";

export async function runMigrations() {
  const migrationsRoot = getMigrationsRoot();

  if (!(await directoryExists(migrationsRoot))) {
    console.log("\nℹ️ No migrations directory found.");
    return;
  }

  const migrationFiles = await collectMigrationFiles(migrationsRoot);

  if (migrationFiles.length === 0) {
    console.log("\nℹ️ No migration files found.");
    return;
  }

  console.log("\n=================================");
  console.log("🚀 Module Migration Runner");
  console.log("=================================");
  console.log(`📦 Found: ${migrationFiles.length} migration(s)`);

  let appliedCount = 0;
  let skippedCount = 0;

  for (const migrationFile of migrationFiles) {
    const result = await runMigration(migrationFile);
    if (result === "APPLIED") appliedCount++;
    if (result === "SKIPPED") skippedCount++;
  }

  console.log("\n=================================");
  console.log("✅ Migration process completed");
  console.log("=================================");
  console.log(`🚀 Applied : ${appliedCount}`);
  console.log(`⏭️ Skipped : ${skippedCount}\n`);
}

async function runMigration(migrationFile: string): Promise<"APPLIED" | "SKIPPED"> {
  const migration = await readMigrationFile(migrationFile);
  validateModuleMigration(migration, migrationFile);

  console.log("\n---------------------------------");
  console.log("🔍 Migration");
  console.log("---------------------------------");
  console.log(`File   : ${path.relative(process.cwd(), migrationFile)}`);
  console.log(`ID     : ${migration.migrationId}`);
  console.log(`Module : ${migration.module.key}`);
  console.log(`Name   : ${migration.migration.name}`);
  console.log(`Action : ${migration.migration.action}`);

  const existing = await getMigrationStatus(migration.migrationId);

  if (existing === "APPLIED") {
    console.log(`\n⏭️ Already applied, skipping: ${migration.migrationId}`);
    return "SKIPPED";
  }

  if (existing === "ROLLED_BACK") {
    console.log(`\n🔄 Re-applying previously rolled back: ${migration.migrationId}`);
  } else {
    console.log("\n🆕 Applying migration...");
  }

  try {
    await db.transaction(async (tx) => {
      const createdRecords = await applyUp(tx, migration.up as Record<string, unknown>);

      const historyRow = {
        status: "APPLIED" as const,
        appliedAt: new Date(),
        createdRecords: JSON.stringify(createdRecords),
      };

      if (existing) {
        await tx
          .update(moduleMigrations)
          .set(historyRow)
          .where(eq(moduleMigrations.migrationId, migration.migrationId));
        console.log("   ✓ migration history updated");
        return;
      }

      await tx.insert(moduleMigrations).values({
        id: randomUUID(),
        migrationId: migration.migrationId,
        moduleKey: migration.module.key,
        migrationName: migration.migration.name,
        migrationFile: path.relative(process.cwd(), migrationFile),
        ...historyRow,
      });

      console.log("   ✓ migration history recorded");
    });

    console.log(`\n✅ Migration applied: ${migration.migrationId}`);
    return "APPLIED";
  } catch (error) {
    console.error(`\n❌ Migration failed: ${migration.migrationId}`);
    console.error(error);
    throw error;
  }
}

async function getMigrationStatus(migrationId: string) {
  const result = await db
    .select({ status: moduleMigrations.status })
    .from(moduleMigrations)
    .where(eq(moduleMigrations.migrationId, migrationId))
    .limit(1);

  return result[0]?.status ?? null;
}
