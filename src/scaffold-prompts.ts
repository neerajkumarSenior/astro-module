import {
  API_KINDS,
  FULL_SCAFFOLD,
  PAGE_KINDS,
  type ApiKind,
  type GenerateFileFilter,
  type ModuleEffectiveScaffold,
  type ModuleScaffoldSpec,
  type PageKind,
} from "@/generator/module-scaffold";

import { ask, chooseMany, confirm, type MenuOption } from "./prompt";

const PAGE_OPTIONS: MenuOption[] = [
  { value: "list", label: "List page (index)" },
  { value: "create", label: "Create page" },
  { value: "edit", label: "Edit page" },
  { value: "delete", label: "Delete page" },
];

const API_OPTIONS: MenuOption[] = [
  { value: "list", label: "GET list — collection" },
  { value: "create", label: "POST create" },
  { value: "get", label: "GET by id" },
  { value: "update", label: "PUT update" },
  { value: "delete", label: "DELETE" },
];

export async function askModuleScaffoldSpec(): Promise<ModuleScaffoldSpec> {
  const fullCrud = await confirm("Use full CRUD (all pages, APIs, and sidebar)?", true);

  if (fullCrud) {
    return FULL_SCAFFOLD;
  }

  console.log("\nPick only what you need (migration + DB will match your selection).");

  const pages = (await chooseMany("Pages to include:", PAGE_OPTIONS, false)) as PageKind[];
  const apis = (await chooseMany("API routes to include:", API_OPTIONS, false)) as ApiKind[];

  if (pages.length === 0 && apis.length === 0) {
    console.log("\nYou must select at least one page or API route.");
    return askModuleScaffoldSpec();
  }

  const sidebarDefault = pages.includes("list");
  const sidebar = await confirm("Add sidebar menu item for this module?", sidebarDefault);

  return { pages, apis, sidebar };
}

export function printExistingScaffold(existing: ModuleEffectiveScaffold) {
  console.log("\nAlready in this module:");
  console.log(`  Pages:   ${existing.pages.join(", ") || "none"}`);
  console.log(`  APIs:    ${existing.apis.join(", ") || "none"}`);
  console.log(`  Sidebar: ${existing.hasSidebar ? "yes" : "no"}`);
}

export async function askAddItemsSpec(
  existing: ModuleEffectiveScaffold,
  options?: { noMigrationFilesYet?: boolean }
): Promise<ModuleScaffoldSpec> {
  if (options?.noMigrationFilesYet) {
    console.log(
      "\nNo migration files for this module yet. Your selection becomes the initial create migration."
    );
  } else {
    printExistingScaffold(existing);
    console.log(
      "\nSelect items to ADD (already-present items are skipped when migrating)."
    );
  }

  const pages = (await chooseMany("Pages to add:", PAGE_OPTIONS, false)) as PageKind[];
  const apis = (await chooseMany("API routes to add:", API_OPTIONS, false)) as ApiKind[];

  let sidebar = false;
  if (!existing.hasSidebar) {
    sidebar = await confirm("Add sidebar menu item?", pages.includes("list"));
  } else if (await confirm("Re-apply sidebar entry in this migration?", false)) {
    sidebar = true;
  }

  const spec: ModuleScaffoldSpec = { pages, apis, sidebar };

  if (spec.pages.length === 0 && spec.apis.length === 0 && !spec.sidebar) {
    console.log("\nSelect at least one page, API, or sidebar.");
    return askAddItemsSpec(existing);
  }

  return spec;
}

export async function askGenerateFileFilter(): Promise<GenerateFileFilter | undefined> {
  const subset = await confirm(
    "Generate only selected pages/APIs (instead of everything in the migration)?",
    false
  );

  if (!subset) {
    return undefined;
  }

  const pages = (await chooseMany("Pages to generate:", PAGE_OPTIONS, false)) as PageKind[];
  const apis = (await chooseMany("API files to generate:", API_OPTIONS, false)) as ApiKind[];

  if (pages.length === 0 && apis.length === 0) {
    console.log("\nNothing selected — generating all files from migration.");
    return undefined;
  }

  return { pages, apis };
}

export function scaffoldSummary(spec: ModuleScaffoldSpec): string {
  const parts = [
    `pages=[${spec.pages.join(", ") || "none"}]`,
    `apis=[${spec.apis.join(", ") || "none"}]`,
    `sidebar=${spec.sidebar ? "yes" : "no"}`,
  ];
  return parts.join(", ");
}

export { PAGE_KINDS, API_KINDS };
