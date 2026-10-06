import { runModuleAddFlow } from "./add-flow";
import { runModuleUpdateFlow } from "./update-flow";
import { runInteractiveCli } from "./interactive";
import {
  runBuild,
  runGenerate,
  runMigrate,
  runMigrationCreate,
  runNewModule,
  runRollback,
  runSetup,
} from "./commands";

const USAGE = `
Module CLI

Interactive (recommended):
  npm run module

Direct commands:
  npm run make:migration <module> [name]
  npm run module:migrate
  npm run module:rollback
  npm run module:generate <module>
  npm run module:build [module]
  npm run module:setup <module>
  npm run module:new <module>
  npm run module:add <module> [migration-name]
  npm run module:update <module> [migration-name]
`;

async function runCli(task: () => Promise<void>) {
  try {
    await task();
  } catch (error) {
    console.error("\n❌ Command failed.");
    console.error(error);
    process.exit(1);
  }
}

async function main() {
  const command = process.argv[2];

  if (!command || command === "interactive" || command === "ask") {
    await runInteractiveCli();
    return;
  }

  switch (command) {
    case "migration": {
      const moduleKey = process.argv[3];
      const migrationName = process.argv[4];

      if (!moduleKey) {
        console.error(`
❌ Module name is required.

Usage:
  npm run make:migration products
  npm run make:migration products add_export
`);
        process.exit(1);
      }

      await runMigrationCreate(moduleKey, migrationName || "create");
      return;
    }

    case "migrate":
      await runMigrate();
      return;

    case "rollback":
      await runRollback();
      return;

    case "generate": {
      const moduleKey = process.argv[3];

      if (!moduleKey) {
        console.error("\n❌ Usage: npm run module:generate <module>\n");
        process.exit(1);
      }

      await runGenerate(moduleKey);
      return;
    }

    case "build":
      await runBuild(process.argv[3]);
      return;

    case "setup": {
      const moduleKey = process.argv[3];
      if (!moduleKey) {
        console.error("\n❌ Usage: npm run module:setup <module>\n");
        process.exit(1);
      }

      await runSetup(moduleKey);
      return;
    }

    case "new": {
      const moduleKey = process.argv[3];
      if (!moduleKey) {
        console.error("\n❌ Usage: npm run module:new <module>\n");
        process.exit(1);
      }

      await runNewModule(moduleKey);
      return;
    }

    case "add": {
      const moduleKey = process.argv[3];
      if (!moduleKey) {
        console.error("\n❌ Usage: npm run module:add <module> [migration-name]\n");
        process.exit(1);
      }

      await runModuleAddFlow(moduleKey, process.argv[4]);
      return;
    }

    case "update": {
      const moduleKey = process.argv[3];
      if (!moduleKey) {
        console.error("\n❌ Usage: npm run module:update <module> [migration-name]\n");
        process.exit(1);
      }

      await runModuleUpdateFlow(moduleKey, process.argv[4]);
      return;
    }

    default:
      console.error(`❌ Unknown command: ${command}`);
      console.error(USAGE);
      process.exit(1);
  }
}

runCli(main);
