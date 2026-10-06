import { listMigrationFilesForModule } from "@/generator/migration-files";
import { getModuleEffectiveScaffold } from "@/generator/module-effective";

import { runAddToExistingModule } from "./commands";
import { ask, confirm } from "./prompt";
import { askAddItemsSpec, scaffoldSummary } from "./scaffold-prompts";

export async function runModuleAddFlow(moduleKey: string, migrationNameArg?: string) {
  const migrationFiles = await listMigrationFilesForModule(moduleKey);
  const noMigrationFilesYet = migrationFiles.length === 0;

  const existing = await getModuleEffectiveScaffold(moduleKey);
  const scaffold = await askAddItemsSpec(existing, { noMigrationFilesYet });

  console.log(`\nAdding: ${scaffoldSummary(scaffold)}`);

  let migrationName = migrationNameArg;

  if (!migrationName) {
    const customName = await confirm("Custom migration name?", false);
    if (customName) {
      migrationName = await ask("Migration name");
    }
  }

  const applyNow = await confirm(
    "Apply migration, update state, and generate new files now?",
    true
  );

  await runAddToExistingModule(moduleKey, scaffold, migrationName, {
    migrate: applyNow,
    generateFilter: applyNow
      ? { pages: scaffold.pages, apis: scaffold.apis }
      : undefined,
  });
}
