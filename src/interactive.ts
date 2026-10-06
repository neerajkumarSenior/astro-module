import { listMigrationFilesForModule, listModuleKeys } from "@/generator/migration-files";
import { getModuleEffectiveScaffold } from "@/generator/module-effective";

import {
  runAddToExistingModule,
  runBuild,
  runGenerate,
  runMigrate,
  runMigrationCreate,
  runNewModule,
  runRollback,
  runSetup,
} from "./commands";
import { runModuleUpdateFlow } from "./update-flow";
import { ask, askModuleKey, chooseMenu, confirm, type MenuOption } from "./prompt";
import {
  askAddItemsSpec,
  askGenerateFileFilter,
  askModuleScaffoldSpec,
  scaffoldSummary,
} from "./scaffold-prompts";

const MAIN_MENU: MenuOption[] = [
  { value: "new", label: "New module — migration + DB + files (module:new)" },
  { value: "add", label: "Add pages/APIs to existing module (module:add)" },
  { value: "update", label: "Update or rename existing items (module:update)" },
  { value: "migration", label: "Create migration JSON only (make:migration)" },
  { value: "migrate", label: "Apply migrations to database (module:migrate)" },
  { value: "rollback", label: "Rollback last applied migration (module:rollback)" },
  { value: "generate", label: "Generate page + API files (module:generate)" },
  { value: "build", label: "Build module state JSON (module:build)" },
  { value: "setup", label: "Setup — migrate + build + generate (module:setup)" },
  { value: "exit", label: "Exit" },
];

async function pickModule(optional: boolean): Promise<string | undefined> {
  const known = await listModuleKeys();

  if (optional && known.length > 0) {
    const all = await confirm("Run for all modules?", true);
    if (all) return undefined;
  }

  return askModuleKey(known);
}

async function pickExistingModule(): Promise<string | undefined> {
  const known = await listModuleKeys();

  if (known.length === 0) {
    console.log("\nNo modules yet. Use “New module” first.\n");
    return undefined;
  }

  return askModuleKey(known, "Existing module name");
}

export async function runInteractiveCli() {
  console.log("");
  console.log("astro-module — Module CLI (interactive)");
  console.log("Step-by-step prompts for migrations, pages, and APIs.");

  while (true) {
    const action = await chooseMenu("What would you like to do?", MAIN_MENU);

    if (action === "exit") {
      console.log("\nBye!\n");
      return;
    }

    try {
      switch (action) {
        case "new": {
          const moduleKey = await pickModule(false);
          if (!moduleKey) break;

          const scaffold = await askModuleScaffoldSpec();
          console.log(`\nScaffold: ${scaffoldSummary(scaffold)}`);

          const fileFilter = await askGenerateFileFilter();
          await runNewModule(moduleKey, scaffold, fileFilter);
          break;
        }

        case "add": {
          const moduleKey = await pickExistingModule();
          if (!moduleKey) break;

          const existing = await getModuleEffectiveScaffold(moduleKey);
          const scaffold = await askAddItemsSpec(existing);
          console.log(`\nAdding: ${scaffoldSummary(scaffold)}`);

          const customName = await confirm("Custom migration name?", false);
          const migrationName = customName
            ? await ask("Migration name (e.g. add_edit_page)")
            : undefined;

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
          break;
        }

        case "update": {
          const moduleKey = await pickExistingModule();
          if (!moduleKey) break;
          await runModuleUpdateFlow(moduleKey);
          break;
        }

        case "migration": {
          const moduleKey = await pickModule(false);
          if (!moduleKey) break;

          const custom = await confirm("Custom migration name? (default: create)", false);
          const migrationName = custom
            ? await ask("Migration name (e.g. add_export)")
            : "create";

          let scaffold;
          if ((migrationName || "create") === "create") {
            scaffold = await askModuleScaffoldSpec();
            console.log(`\nScaffold: ${scaffoldSummary(scaffold)}`);
          }

          await runMigrationCreate(moduleKey, migrationName || "create", scaffold);
          break;
        }

        case "migrate":
          await runMigrate();
          break;

        case "rollback": {
          const ok = await confirm(
            "This will rollback the most recently applied migration. Continue?",
            false
          );
          if (ok) await runRollback();
          break;
        }

        case "generate": {
          const moduleKey = await pickModule(false);
          if (!moduleKey) break;
          const fileFilter = await askGenerateFileFilter();
          await runGenerate(moduleKey, fileFilter);
          break;
        }

        case "build": {
          const moduleKey = await pickModule(true);
          await runBuild(moduleKey);
          break;
        }

        case "setup": {
          const moduleKey = await pickModule(false);
          if (!moduleKey) break;
          const fileFilter = await askGenerateFileFilter();
          await runSetup(moduleKey, fileFilter);
          break;
        }
      }
    } catch (error) {
      console.error("\nAction failed.");
      console.error(error);
    }

    const again = await confirm("\nDo something else?", true);
    if (!again) {
      console.log("\nBye!\n");
      return;
    }
  }
}
