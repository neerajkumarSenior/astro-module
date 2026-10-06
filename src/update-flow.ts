import { getModuleMergedState } from "@/generator/module-effective";

import { runUpdateExistingModule } from "./commands";
import { ask, confirm } from "./prompt";
import { askModuleUpdateSpec } from "./update-prompts";

export async function runModuleUpdateFlow(moduleKey: string, migrationNameArg?: string) {
  const state = await getModuleMergedState(moduleKey);

  if (!state) {
    throw new Error(
      `Module "${moduleKey}" has no migration files. Use module:new or module:add first.`
    );
  }

  const { spec, rollback } = await askModuleUpdateSpec(state);

  let migrationName = migrationNameArg;
  if (!migrationName) {
    const customName = await confirm("Custom migration name?", false);
    if (customName) {
      migrationName = await ask("Migration name (e.g. rename_list_route)");
    }
  }

  const applyNow = await confirm("Apply migration and rebuild module state now?", true);

  await runUpdateExistingModule(moduleKey, spec, rollback, migrationName, {
    migrate: applyNow,
  });
}
