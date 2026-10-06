import fs from "node:fs/promises";
import path from "node:path";

export type ModuleMigrationJson = {
  migrationId: string;

  module: {
    key: string;
  };

  migration: {
    name: string;
    action: "CREATE" | "UPDATE" | "DELETE";
    status: "PENDING" | "APPLIED" | "ROLLED_BACK";
  };

  up?: Record<string, unknown>;
  down?: Record<string, unknown>;
};

export function getMigrationsRoot(cwd = process.cwd()) {
  return path.join(cwd, "migrations");
}

export type ModuleInfo = {
  key: string;
  route: string;
  apiRoute: string;
  label: string;
  fileName: string;
};

export function normalizeModuleKey(value: string) {
  return value
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\\/g, "/")
    .toLowerCase();
}

export function resolveModule(value: string): ModuleInfo {
  const key = normalizeModuleKey(value);

  if (!key) {
    throw new Error("Module name cannot be empty.");
  }

  const route = `/${key}`;
  const apiRoute = `/api/${key}`;

  const label = key
    .split("/")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("/");

  const fileName = key.replace(/\//g, "_").replace(/[^a-z0-9_-]/g, "_");

  return { key, route, apiRoute, label, fileName };
}

export function getModuleMigrationsDir(moduleKey: string, cwd = process.cwd()) {
  return path.join(getMigrationsRoot(cwd), ...normalizeModuleKey(moduleKey).split("/"));
}

export async function readLatestMigrationForModule(moduleKey: string) {
  const migrationsDir = getModuleMigrationsDir(moduleKey);

  if (!(await directoryExists(migrationsDir))) {
    throw new Error(`No migration found for module: ${moduleKey}`);
  }

  const files = await collectMigrationFiles(migrationsDir);

  if (files.length === 0) {
    throw new Error(`No migration found for module: ${moduleKey}`);
  }

  return readMigrationFile(files[files.length - 1]!);
}

export async function directoryExists(directory: string): Promise<boolean> {
  try {
    const stat = await fs.stat(directory);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function collectMigrationFiles(
  directory: string
): Promise<string[]> {
  const entries = await fs.readdir(directory, {
    withFileTypes: true,
  });

  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectMigrationFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

export async function listMigrationFilesForModule(
  moduleKey: string,
  cwd = process.cwd()
): Promise<string[]> {
  const migrationsRoot = getMigrationsRoot(cwd);
  const normalized = normalizeModuleKey(moduleKey);

  if (!(await directoryExists(migrationsRoot))) {
    return [];
  }

  const files = await collectMigrationFiles(migrationsRoot);
  return files.filter(
    (file) => getModuleKeyFromFile(migrationsRoot, file) === normalized
  );
}

export async function listModuleKeys(cwd = process.cwd()): Promise<string[]> {
  const migrationsRoot = getMigrationsRoot(cwd);

  if (!(await directoryExists(migrationsRoot))) {
    return [];
  }

  const files = await collectMigrationFiles(migrationsRoot);
  const keys = new Set<string>();

  for (const file of files) {
    keys.add(getModuleKeyFromFile(migrationsRoot, file));
  }

  return [...keys].sort((a, b) => a.localeCompare(b));
}

export function getModuleKeyFromFile(
  migrationsRoot: string,
  file: string
) {
  const relative = path.relative(migrationsRoot, file);
  const parts = relative.split(path.sep);
  parts.pop();
  return parts.join("/");
}

export async function readMigrationFile(
  file: string
): Promise<ModuleMigrationJson> {
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw) as ModuleMigrationJson;
}

export function validateModuleMigration(
  migration: ModuleMigrationJson,
  migrationFile: string
) {
  const rel = path.relative(process.cwd(), migrationFile);

  if (!migration.migrationId || typeof migration.migrationId !== "string") {
    throw new Error(`Invalid migrationId in ${rel}`);
  }

  if (!migration.module?.key) {
    throw new Error(`Invalid module.key in ${rel}`);
  }

  if (!migration.migration?.name) {
    throw new Error(`Invalid migration.name in ${rel}`);
  }

  if (!migration.migration?.action) {
    throw new Error(`Invalid migration.action in ${rel}`);
  }

  if (!migration.up || typeof migration.up !== "object") {
    throw new Error(`Invalid migration.up in ${rel}`);
  }

  if (!migration.down || typeof migration.down !== "object") {
    throw new Error(`Invalid migration.down in ${rel}`);
  }
}
