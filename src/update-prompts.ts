import type { ModuleMergedState } from "@/generator/module-effective";
import {
  type ModuleUpdateRollback,
  type ModuleUpdateSpec,
  type PermissionPatch,
  type PolicyPatch,
  type SidebarPatch,
} from "@/generator/migration-update";

import { ask, chooseMenu, confirm, type MenuOption } from "./prompt";

const TARGET_MENU: MenuOption[] = [
  { value: "page", label: "Page access policy (route / matcher)" },
  { value: "api", label: "API access policy" },
  { value: "sidebar", label: "Sidebar menu item" },
  { value: "permission", label: "Permission (name / slug)" },
  { value: "done", label: "Done — write migration" },
];

function listKeys(record: Record<string, unknown>) {
  return Object.keys(record).sort((a, b) => a.localeCompare(b));
}

async function pickKey(label: string, keys: string[]) {
  if (keys.length === 0) {
    console.log(`\nNo ${label} entries in this module.\n`);
    return undefined;
  }

  console.log(`\n${label}:`);
  keys.forEach((k, i) => console.log(`  ${i + 1}) ${k}`));

  while (true) {
    const raw = await ask("Enter number");
    const num = Number.parseInt(raw, 10);
    if (Number.isFinite(num) && num >= 1 && num <= keys.length) {
      return keys[num - 1]!;
    }
    console.log("Invalid choice.");
  }
}

async function askOptional(current: string, label: string) {
  const value = await ask(`${label} [current: ${current}]`, current);
  return value === current ? undefined : value;
}

async function patchPagePolicy(slug: string, current: Record<string, unknown>) {
  const matcher = await askOptional(String(current.matcher ?? ""), "Matcher (page URL)");
  const permission = await askOptional(String(current.permission ?? ""), "Permission slug");
  const rename = await confirm("Rename policy slug?", false);
  let newSlug: string | undefined;
  if (rename) {
    newSlug = await ask("New policy slug", slug);
  }

  const patch: PolicyPatch = {};
  if (matcher !== undefined) patch.matcher = matcher;
  if (permission !== undefined) patch.permission = permission;
  if (newSlug && newSlug !== slug) patch.slug = newSlug;

  if (!Object.keys(patch).length) {
    console.log("No changes for this item.");
    return null;
  }

  const rollback: PolicyPatch = {};
  if (patch.matcher !== undefined) rollback.matcher = String(current.matcher ?? "");
  if (patch.permission !== undefined) rollback.permission = String(current.permission ?? "");
  if (patch.slug) rollback.slug = slug;

  return { upKey: slug, patch, rollback, downKey: patch.slug ?? slug };
}

async function patchApiPolicy(slug: string, current: Record<string, unknown>) {
  const matcher = await askOptional(String(current.matcher ?? ""), "Matcher (API path)");
  const method = await askOptional(String(current.method ?? "GET"), "HTTP method");
  const permission = await askOptional(String(current.permission ?? ""), "Permission slug");
  const rename = await confirm("Rename policy slug?", false);
  let newSlug: string | undefined;
  if (rename) {
    newSlug = await ask("New policy slug", slug);
  }

  const patch: PolicyPatch = {};
  if (matcher !== undefined) patch.matcher = matcher;
  if (method !== undefined) patch.method = method;
  if (permission !== undefined) patch.permission = permission;
  if (newSlug && newSlug !== slug) patch.slug = newSlug;

  if (!Object.keys(patch).length) {
    console.log("No changes for this item.");
    return null;
  }

  const rollback: PolicyPatch = {};
  if (patch.matcher !== undefined) rollback.matcher = String(current.matcher ?? "");
  if (patch.method !== undefined) rollback.method = String(current.method ?? "");
  if (patch.permission !== undefined) rollback.permission = String(current.permission ?? "");
  if (patch.slug) rollback.slug = slug;

  return { upKey: slug, patch, rollback, downKey: patch.slug ?? slug };
}

async function patchSidebar(slug: string, current: Record<string, unknown>) {
  const label = await askOptional(String(current.label ?? slug), "Label");
  const path = await askOptional(String(current.path ?? ""), "Path (href)");
  const icon = await askOptional(String(current.icon ?? ""), "Icon key");
  const permission = await askOptional(String(current.permission ?? ""), "Permission slug");
  const rename = await confirm("Rename sidebar slug?", false);
  let newSlug: string | undefined;
  if (rename) {
    newSlug = await ask("New sidebar slug", slug);
  }

  const patch: SidebarPatch = {};
  if (label !== undefined) patch.label = label;
  if (path !== undefined) patch.path = path;
  if (icon !== undefined) patch.icon = icon;
  if (permission !== undefined) patch.permission = permission;
  if (newSlug && newSlug !== slug) patch.slug = newSlug;

  if (!Object.keys(patch).length) {
    console.log("No changes for this item.");
    return null;
  }

  const rollback: SidebarPatch = {};
  if (patch.label !== undefined) rollback.label = String(current.label ?? slug);
  if (patch.path !== undefined) rollback.path = (current.path as string | null) ?? null;
  if (patch.icon !== undefined) rollback.icon = (current.icon as string | null) ?? null;
  if (patch.permission !== undefined) rollback.permission = String(current.permission ?? "");
  if (patch.slug) rollback.slug = slug;

  return { upKey: slug, patch, rollback, downKey: patch.slug ?? slug };
}

async function patchPermission(slug: string, current: Record<string, unknown>) {
  const description = await askOptional(
    String(current.description ?? current.key ?? slug),
    "Display name (description)"
  );
  const rename = await confirm("Rename permission slug?", false);
  let newSlug: string | undefined;
  if (rename) {
    newSlug = await ask("New permission slug", slug);
  }

  const patch: PermissionPatch = {};
  if (description !== undefined) patch.description = description;
  if (newSlug && newSlug !== slug) patch.slug = newSlug;

  if (!Object.keys(patch).length) {
    console.log("No changes for this item.");
    return null;
  }

  const rollback: PermissionPatch = {};
  if (patch.description !== undefined) {
    rollback.description = String(current.description ?? current.key ?? slug);
  }
  if (patch.slug) rollback.slug = slug;

  return { upKey: slug, patch, rollback, downKey: patch.slug ?? slug };
}

function storePatch(
  spec: ModuleUpdateSpec,
  rollback: ModuleUpdateRollback,
  bucket: "pagePolicies" | "apiPolicies" | "permissions" | "sidebar",
  result: {
    upKey: string;
    downKey: string;
    patch: PolicyPatch | SidebarPatch | PermissionPatch;
    rollback: PolicyPatch | SidebarPatch | PermissionPatch;
  }
) {
  if (bucket === "pagePolicies") {
    spec.pagePolicies ??= {};
    rollback.pagePolicies ??= {};
    spec.pagePolicies[result.upKey] = result.patch as PolicyPatch;
    rollback.pagePolicies[result.downKey] = result.rollback as PolicyPatch;
    return;
  }

  if (bucket === "apiPolicies") {
    spec.apiPolicies ??= {};
    rollback.apiPolicies ??= {};
    spec.apiPolicies[result.upKey] = result.patch as PolicyPatch;
    rollback.apiPolicies[result.downKey] = result.rollback as PolicyPatch;
    return;
  }

  if (bucket === "sidebar") {
    spec.sidebar ??= {};
    rollback.sidebar ??= {};
    spec.sidebar[result.upKey] = result.patch as SidebarPatch;
    rollback.sidebar[result.downKey] = result.rollback as SidebarPatch;
    return;
  }

  spec.permissions ??= {};
  rollback.permissions ??= {};
  spec.permissions[result.upKey] = result.patch as PermissionPatch;
  rollback.permissions[result.downKey] = result.rollback as PermissionPatch;
}

export async function askModuleUpdateSpec(
  state: ModuleMergedState
): Promise<{ spec: ModuleUpdateSpec; rollback: ModuleUpdateRollback }> {
  const spec: ModuleUpdateSpec = {};
  const rollback: ModuleUpdateRollback = {};

  console.log("\nUpdate or rename existing items. Press Enter to keep current values.");

  while (true) {
    const target = await chooseMenu("What do you want to update?", TARGET_MENU);

    if (target === "done") {
      break;
    }

    if (target === "page") {
      const slug = await pickKey("Page policies", listKeys(state.accessPolicies.pages));
      if (!slug) continue;
      const result = await patchPagePolicy(slug, state.accessPolicies.pages[slug]!);
      if (!result) continue;
      storePatch(spec, rollback, "pagePolicies", result);
      continue;
    }

    if (target === "api") {
      const slug = await pickKey("API policies", listKeys(state.accessPolicies.apis));
      if (!slug) continue;
      const result = await patchApiPolicy(slug, state.accessPolicies.apis[slug]!);
      if (!result) continue;
      storePatch(spec, rollback, "apiPolicies", result);
      continue;
    }

    if (target === "sidebar") {
      const slug = await pickKey("Sidebar items", listKeys(state.sidebar));
      if (!slug) continue;
      const result = await patchSidebar(slug, state.sidebar[slug]!);
      if (!result) continue;
      storePatch(spec, rollback, "sidebar", result);
      continue;
    }

    if (target === "permission") {
      const slug = await pickKey("Permissions", listKeys(state.permissions));
      if (!slug) continue;
      const result = await patchPermission(slug, state.permissions[slug]!);
      if (!result) continue;
      storePatch(spec, rollback, "permissions", result);
    }
  }

  return { spec, rollback };
}
