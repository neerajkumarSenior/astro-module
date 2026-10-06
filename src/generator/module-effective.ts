import { computeModuleState } from "./module-state-builder";
import {
  effectiveScaffoldFromPolicyKeys,
  type ModuleEffectiveScaffold,
} from "./module-scaffold";
import { listMigrationFilesForModule, normalizeModuleKey } from "./migration-files";

export type ModuleMergedState = NonNullable<Awaited<ReturnType<typeof computeModuleState>>>;

export async function getModuleEffectiveScaffold(
  moduleKey: string
): Promise<ModuleEffectiveScaffold> {
  const normalized = normalizeModuleKey(moduleKey);
  const files = await listMigrationFilesForModule(normalized);

  if (files.length === 0) {
    return { pages: [], apis: [], hasSidebar: false };
  }

  const state = await computeModuleState(normalized);
  if (!state) {
    return { pages: [], apis: [], hasSidebar: false };
  }

  return effectiveScaffoldFromPolicyKeys(
    Object.keys(state.accessPolicies.pages),
    Object.keys(state.accessPolicies.apis),
    Object.keys(state.sidebar)
  );
}

export async function getModuleMergedState(
  moduleKey: string
): Promise<ModuleMergedState | null> {
  return computeModuleState(normalizeModuleKey(moduleKey));
}
