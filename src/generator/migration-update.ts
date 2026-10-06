import fs from "node:fs/promises";
import path from "node:path";

import { getModuleMigrationsDir, listMigrationFilesForModule, resolveModule } from "./migration-files";

export type PermissionPatch = {
  key?: string;
  description?: string;
  slug?: string;
};

export type PolicyPatch = {
  matcher?: string;
  method?: string;
  permission?: string | null;
  description?: string;
  slug?: string;
};

export type SidebarPatch = {
  label?: string;
  path?: string | null;
  icon?: string | null;
  permission?: string | null;
  slug?: string;
};

export type ModuleUpdateSpec = {
  permissions?: Record<string, PermissionPatch>;
  pagePolicies?: Record<string, PolicyPatch>;
  apiPolicies?: Record<string, PolicyPatch>;
  sidebar?: Record<string, SidebarPatch>;
};

export type ModuleUpdateRollback = ModuleUpdateSpec;

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

function buildUpDown(spec: ModuleUpdateSpec, rollback: ModuleUpdateRollback) {
  const up: Record<string, unknown> = {};
  const down: Record<string, unknown> = {};

  if (spec.permissions && Object.keys(spec.permissions).length) {
    up.permissions = { update: spec.permissions };
    down.permissions = { update: rollback.permissions ?? {} };
  }

  const pagesUp = spec.pagePolicies;
  const apisUp = spec.apiPolicies;

  const upPolicies: Record<string, unknown> = {};
  const downPolicies: Record<string, unknown> = {};

  if (pagesUp && Object.keys(pagesUp).length) {
    upPolicies.pages = { update: pagesUp };
    downPolicies.pages = { update: rollback.pagePolicies ?? {} };
  }

  if (apisUp && Object.keys(apisUp).length) {
    upPolicies.apis = { update: apisUp };
    downPolicies.apis = { update: rollback.apiPolicies ?? {} };
  }

  if (Object.keys(upPolicies).length) {
    up.accessPolicies = upPolicies;
    down.accessPolicies = downPolicies;
  }

  if (spec.sidebar && Object.keys(spec.sidebar).length) {
    up.sidebar = { update: spec.sidebar };
    down.sidebar = { update: rollback.sidebar ?? {} };
  }

  return { up, down };
}

export function isEmptyUpdate(spec: ModuleUpdateSpec) {
  return (
    !Object.keys(spec.permissions ?? {}).length &&
    !Object.keys(spec.pagePolicies ?? {}).length &&
    !Object.keys(spec.apiPolicies ?? {}).length &&
    !Object.keys(spec.sidebar ?? {}).length
  );
}

export async function generateModuleUpdateMigration({
  moduleKey,
  migrationName,
  spec,
  rollback,
}: {
  moduleKey: string;
  migrationName?: string;
  spec: ModuleUpdateSpec;
  rollback: ModuleUpdateRollback;
}) {
  if (isEmptyUpdate(spec)) {
    throw new Error("No changes selected for update migration.");
  }

  const module = resolveModule(moduleKey);
  const files = await listMigrationFilesForModule(module.key);

  if (files.length === 0) {
    throw new Error(
      `Module "${module.key}" has no migrations. Use module:new or module:add first.`
    );
  }

  const name = normalizeMigrationName(migrationName || "update_items");
  const { up, down } = buildUpDown(spec, rollback);
  const timestamp = createTimestamp();
  const migrationsDir = getModuleMigrationsDir(module.key);

  const migration = {
    migrationId: `mm_${timestamp}`,
    module: { key: module.key },
    migration: {
      name,
      action: "UPDATE",
      status: "PENDING",
    },
    up,
    down,
  };

  await fs.mkdir(migrationsDir, { recursive: true });

  const filePath = path.join(
    migrationsDir,
    `${timestamp}_${name}_${module.fileName}.json`
  );

  await fs.writeFile(filePath, JSON.stringify(migration, null, 2), "utf8");

  console.log("\n✅ Update migration generated");
  console.log(`📦 Module    : ${module.key}`);
  console.log(`📝 Migration : ${name}`);
  console.log(`📄 File      : ${path.relative(process.cwd(), filePath)}\n`);
}
