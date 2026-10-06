import fs from "node:fs/promises";
import path from "node:path";

import {
  getModuleMigrationsDir,
  listMigrationFilesForModule,
  readMigrationFile,
  resolveModule,
} from "./migration-files";
import {
  createModuleOperations,
  FULL_SCAFFOLD,
  type ModuleScaffoldSpec,
} from "./module-scaffold";

export type GenerateMigrationOptions = {
  moduleKey: string;
  migrationName?: string;
  scaffold?: ModuleScaffoldSpec;
};

function createTimestamp() {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}` +
    `${pad(now.getMilliseconds(), 3)}`
  );
}

function normalizeMigrationName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function findCreateMigrationFiles(
  migrationsDir: string,
  moduleKey: string
): Promise<string[]> {
  try {
    const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
    const results: string[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;

      const filePath = path.join(migrationsDir, entry.name);
      try {
        const migration = await readMigrationFile(filePath);
        if (
          migration.module.key === moduleKey &&
          migration.migration.name === "create"
        ) {
          results.push(filePath);
        }
      } catch {
        continue;
      }
    }

    return results;
  } catch {
    return [];
  }
}

function defaultAddMigrationName(spec: ModuleScaffoldSpec) {
  const parts: string[] = [];

  if (spec.pages.length) {
    parts.push(`pages_${spec.pages.join("_")}`);
  }

  if (spec.apis.length) {
    parts.push(`apis_${spec.apis.join("_")}`);
  }

  if (spec.sidebar) {
    parts.push("sidebar");
  }

  return parts.length ? `add_${parts.join("__")}` : "add_items";
}

function validateAddSpec(spec: ModuleScaffoldSpec) {
  if (spec.pages.length === 0 && spec.apis.length === 0 && !spec.sidebar) {
    throw new Error("Select at least one page, API route, or sidebar item to add.");
  }
}

async function writeMigrationFile(
  module: ReturnType<typeof resolveModule>,
  name: string,
  action: "CREATE" | "UPDATE",
  operations: { up: Record<string, unknown>; down: Record<string, unknown> }
) {
  const migrationsDir = getModuleMigrationsDir(module.key);
  const timestamp = createTimestamp();

  const migration = {
    migrationId: `mm_${timestamp}`,
    module: { key: module.key },
    migration: {
      name,
      action,
      status: "PENDING",
    },
    up: operations.up,
    down: operations.down,
  };

  await fs.mkdir(migrationsDir, { recursive: true });

  const filePath = path.join(
    migrationsDir,
    `${timestamp}_${name}_${module.fileName}.json`
  );

  await fs.writeFile(filePath, JSON.stringify(migration, null, 2), "utf8");

  console.log("\n✅ Migration generated");
  console.log(`📦 Module    : ${module.key}`);
  console.log(`🌐 Route     : ${module.route}`);
  console.log(`🔌 API       : ${module.apiRoute}`);
  console.log(`📝 Migration : ${name}`);
  console.log(`🆔 ID        : mm_${timestamp}`);
  console.log(`📄 File      : ${path.relative(process.cwd(), filePath)}\n`);

  return filePath;
}

export async function generateMigration({
  moduleKey,
  migrationName,
  scaffold,
}: GenerateMigrationOptions) {
  const module = resolveModule(moduleKey);
  const migrationsDir = getModuleMigrationsDir(module.key);

  const name = normalizeMigrationName(migrationName || "create");
  if (!name) {
    throw new Error("Migration name cannot be empty.");
  }

  if (name === "create") {
    const existing = await findCreateMigrationFiles(migrationsDir, module.key);
    if (existing.length > 0) {
      console.log("\n❌ Create migration already exists for this module.");
      for (const file of existing) {
        console.log(`   - ${path.relative(process.cwd(), file)}`);
      }
      console.log(`\n💡 Use: npm run module:add ${module.key}\n`);
      return;
    }
  }

  const operations =
    name === "create"
      ? createModuleOperations(module, scaffold ?? FULL_SCAFFOLD)
      : { up: {}, down: {} };

  await writeMigrationFile(
    module,
    name,
    name === "create" ? "CREATE" : "UPDATE",
    operations
  );

  if (name === "create" && scaffold) {
    const isFull =
      scaffold.pages.length === FULL_SCAFFOLD.pages.length &&
      scaffold.apis.length === FULL_SCAFFOLD.apis.length &&
      scaffold.sidebar === FULL_SCAFFOLD.sidebar;
    if (!isFull) {
      console.log("📋 Scaffold  : custom (selected pages/APIs only)\n");
    }
  }

  if (name !== "create") {
    console.log("⚠️ Custom migration: edit up/down in the JSON file.\n");
  }
}

/**
 * Writes migration JSON for a scaffold: initial `create` if none exist, else UPDATE add.
 */
export async function applyScaffoldToModule({
  moduleKey,
  migrationName,
  scaffold,
}: {
  moduleKey: string;
  migrationName?: string;
  scaffold: ModuleScaffoldSpec;
}) {
  validateAddSpec(scaffold);

  const module = resolveModule(moduleKey);
  const moduleFiles = await listMigrationFilesForModule(module.key);

  if (moduleFiles.length === 0) {
    console.log(
      `\nℹ️  No migration files for "${module.key}" yet. Creating initial create migration.\n`
    );

    if (migrationName && normalizeMigrationName(migrationName) !== "create") {
      console.log(
        `   Note: first migration is always named "create" (ignored "${migrationName}").\n`
      );
    }

    await generateMigration({ moduleKey, migrationName: "create", scaffold });
    return;
  }

  await generateAddItemsMigration({ moduleKey, migrationName, scaffold });
}

export async function generateAddItemsMigration({
  moduleKey,
  migrationName,
  scaffold,
}: {
  moduleKey: string;
  migrationName?: string;
  scaffold: ModuleScaffoldSpec;
}) {
  const module = resolveModule(moduleKey);
  validateAddSpec(scaffold);

  const name = normalizeMigrationName(migrationName || defaultAddMigrationName(scaffold));
  const operations = createModuleOperations(module, scaffold);

  await writeMigrationFile(module, name, "UPDATE", operations);
  console.log("📋 Adds to existing module (duplicate DB rows are skipped on migrate).\n");
}
