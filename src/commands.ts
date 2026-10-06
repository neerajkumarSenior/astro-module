import {
  applyScaffoldToModule,
  generateMigration,
} from "@/generator/migration-generator";
import {
  generateModuleUpdateMigration,
  type ModuleUpdateRollback,
  type ModuleUpdateSpec,
} from "@/generator/migration-update";
import { runMigrations } from "@/generator/migration-runner";
import { rollbackMigration } from "@/generator/migration-rollback";
import { generateModuleFiles } from "@/generator/module-file-generator";
import { buildModuleStates } from "@/generator/module-state-builder";
import type { GenerateFileFilter, ModuleScaffoldSpec } from "@/generator/module-scaffold";

export async function runMigrationCreate(
  moduleKey: string,
  migrationName = "create",
  scaffold?: ModuleScaffoldSpec
) {
  await generateMigration({ moduleKey, migrationName, scaffold });
}

export async function runMigrate() {
  await runMigrations();
}

export async function runRollback() {
  await rollbackMigration();
}

export async function runGenerate(moduleKey: string, filter?: GenerateFileFilter) {
  await generateModuleFiles(moduleKey, filter);
}

export async function runBuild(moduleKey?: string) {
  await buildModuleStates(moduleKey);
}

export async function runSetup(
  moduleKey: string,
  generateFilter?: GenerateFileFilter
) {
  await runMigrations();
  await buildModuleStates(moduleKey);
  await generateModuleFiles(moduleKey, generateFilter);
}

export async function runNewModule(
  moduleKey: string,
  scaffold?: ModuleScaffoldSpec,
  generateFilter?: GenerateFileFilter
) {
  await runMigrationCreate(moduleKey, "create", scaffold);
  await runSetup(moduleKey, generateFilter);
}

export async function runAddToExistingModule(
  moduleKey: string,
  scaffold: ModuleScaffoldSpec,
  migrationName?: string,
  options?: { migrate?: boolean; generateFilter?: GenerateFileFilter }
) {
  await applyScaffoldToModule({
    moduleKey,
    migrationName,
    scaffold,
  });

  if (options?.migrate === false) {
    return;
  }

  await runMigrations();
  await buildModuleStates(moduleKey);

  const filter =
    options?.generateFilter ??
    (scaffold.pages.length || scaffold.apis.length
      ? { pages: scaffold.pages, apis: scaffold.apis }
      : undefined);

  await generateModuleFiles(moduleKey, filter);
}

export async function runUpdateExistingModule(
  moduleKey: string,
  spec: ModuleUpdateSpec,
  rollback: ModuleUpdateRollback,
  migrationName?: string,
  options?: { migrate?: boolean }
) {
  await generateModuleUpdateMigration({
    moduleKey,
    migrationName,
    spec,
    rollback,
  });

  if (options?.migrate === false) {
    return;
  }

  await runMigrations();
  await buildModuleStates(moduleKey);
}
