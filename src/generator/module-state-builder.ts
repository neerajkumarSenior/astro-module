import fs from "node:fs/promises";
import path from "node:path";

import {
  collectMigrationFiles,
  directoryExists,
  getModuleKeyFromFile,
  getMigrationsRoot,
  normalizeModuleKey,
  readMigrationFile,
} from "./migration-files";

type EntityOps = {
  create?: Record<string, Record<string, unknown>>;
  update?: Record<string, Record<string, unknown>>;
  delete?: string[];
};

type MigrationOperations = {
  permissions?: EntityOps;
  accessPolicies?: { pages?: EntityOps; apis?: EntityOps };
  sidebar?: EntityOps;
};

type FinalState = {
  permissions: Record<string, Record<string, unknown>>;
  accessPolicies: {
    pages: Record<string, Record<string, unknown>>;
    apis: Record<string, Record<string, unknown>>;
  };
  sidebar: Record<string, Record<string, unknown>>;
};

export async function computeModuleState(moduleKey: string) {
  const migrationsRoot = getMigrationsRoot();
  const normalized = normalizeModuleKey(moduleKey);

  const migrationFiles = (await collectMigrationFiles(migrationsRoot)).filter(
    (file) => getModuleKeyFromFile(migrationsRoot, file) === normalized
  );

  if (migrationFiles.length === 0) {
    return null;
  }

  const state: FinalState = {
    permissions: {},
    accessPolicies: { pages: {}, apis: {} },
    sidebar: {},
  };

  for (const file of migrationFiles) {
    const migration = await readMigrationFile(file);
    applyOperations(state, (migration.up ?? {}) as MigrationOperations);
  }

  return state;
}

export async function buildModuleStates(moduleKey?: string) {
  const migrationsRoot = getMigrationsRoot();

  if (!(await directoryExists(migrationsRoot))) {
    console.log("ℹ️ No migrations directory found.");
    return;
  }

  let migrationFiles = await collectMigrationFiles(migrationsRoot);

  if (moduleKey) {
    const normalized = normalizeModuleKey(moduleKey);
    migrationFiles = migrationFiles.filter(
      (file) => getModuleKeyFromFile(migrationsRoot, file) === normalized
    );
  }

  if (migrationFiles.length === 0) {
    console.log("ℹ️ No migration files found.");
    return;
  }

  const grouped = new Map<string, string[]>();

  for (const file of migrationFiles) {
    const key = getModuleKeyFromFile(migrationsRoot, file);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(file);
  }

  for (const [key, files] of grouped) {
    await buildModuleState(key, files);
  }
}

async function buildModuleState(moduleKey: string, migrationFiles: string[]) {
  console.log("\n=================================");
  console.log("🏗️ Building Module State");
  console.log(`📦 Module: ${moduleKey}`);

  const state: FinalState = {
    permissions: {},
    accessPolicies: { pages: {}, apis: {} },
    sidebar: {},
  };

  const appliedMigrations: string[] = [];

  for (const file of migrationFiles) {
    const migration = await readMigrationFile(file);
    console.log(`   → ${migration.migrationId}`);
    applyOperations(state, (migration.up ?? {}) as MigrationOperations);
    appliedMigrations.push(migration.migrationId);
  }

  const outputPath = path.join(
    process.cwd(),
    "generated",
    "modules",
    ...moduleKey.split("/"),
    "module.json"
  );

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(
    outputPath,
    JSON.stringify(
      {
        module: { key: moduleKey },
        version: appliedMigrations.length,
        latestMigrationId: appliedMigrations.at(-1) ?? null,
        migrations: appliedMigrations,
        data: state,
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`✅ Output: ${path.relative(process.cwd(), outputPath)}`);
}

function applyOperations(state: FinalState, operations: MigrationOperations) {
  mergeOps(state.permissions, operations.permissions);
  mergeOps(state.accessPolicies.pages, operations.accessPolicies?.pages);
  mergeOps(state.accessPolicies.apis, operations.accessPolicies?.apis);
  mergeOps(state.sidebar, operations.sidebar);
}

function mergeOps(
  state: Record<string, Record<string, unknown>>,
  operations?: EntityOps
) {
  if (!operations) return;

  if (operations.create) {
    for (const [key, value] of Object.entries(operations.create)) {
      state[key] = { ...value };
    }
  }

  if (operations.update) {
    for (const [key, value] of Object.entries(operations.update)) {
      state[key] = state[key] ? { ...state[key], ...value } : { ...value };
    }
  }

  if (operations.delete) {
    for (const key of operations.delete) {
      delete state[key];
    }
  }
}
