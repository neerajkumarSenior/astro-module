import type { ModuleInfo } from "./migration-files";

export const PAGE_KINDS = ["list", "create", "edit", "delete"] as const;
export const API_KINDS = ["list", "create", "get", "update", "delete"] as const;

export type PageKind = (typeof PAGE_KINDS)[number];
export type ApiKind = (typeof API_KINDS)[number];
export type PermissionAction = "create" | "read" | "update" | "delete";

export type ModuleScaffoldSpec = {
  pages: PageKind[];
  apis: ApiKind[];
  sidebar: boolean;
};

export type GenerateFileFilter = {
  pages?: PageKind[];
  apis?: ApiKind[];
};

export const FULL_SCAFFOLD: ModuleScaffoldSpec = {
  pages: [...PAGE_KINDS],
  apis: [...API_KINDS],
  sidebar: true,
};

export type ModuleEffectiveScaffold = {
  pages: PageKind[];
  apis: ApiKind[];
  hasSidebar: boolean;
};

export function effectiveScaffoldFromPolicyKeys(
  pagePolicyKeys: string[],
  apiPolicyKeys: string[],
  sidebarKeys: string[]
): ModuleEffectiveScaffold {
  const pages = new Set<PageKind>();
  const apis = new Set<ApiKind>();

  for (const key of pagePolicyKeys) {
    const kind = pageKindFromPolicyKey(key);
    if (kind) pages.add(kind);
  }

  for (const key of apiPolicyKeys) {
    const kind = apiKindFromPolicyKey(key);
    if (kind) apis.add(kind);
  }

  return {
    pages: PAGE_KINDS.filter((k) => pages.has(k)),
    apis: API_KINDS.filter((k) => apis.has(k)),
    hasSidebar: sidebarKeys.length > 0,
  };
}

export function pageKindFromPolicyKey(policyKey: string): PageKind | null {
  if (policyKey.endsWith("_list")) return "list";
  if (policyKey.endsWith("_create")) return "create";
  if (policyKey.endsWith("_edit")) return "edit";
  if (policyKey.endsWith("_delete")) return "delete";
  return null;
}

export function apiKindFromPolicyKey(policyKey: string): ApiKind | null {
  if (policyKey.endsWith("_list")) return "list";
  if (policyKey.endsWith("_create")) return "create";
  if (policyKey.endsWith("_get")) return "get";
  if (policyKey.endsWith("_update")) return "update";
  if (policyKey.endsWith("_delete")) return "delete";
  return null;
}

export function permissionsForSpec(spec: ModuleScaffoldSpec): PermissionAction[] {
  const set = new Set<PermissionAction>();

  for (const page of spec.pages) {
    if (page === "list") set.add("read");
    if (page === "create") set.add("create");
    if (page === "edit") set.add("update");
    if (page === "delete") set.add("delete");
  }

  for (const api of spec.apis) {
    if (api === "list" || api === "get") set.add("read");
    if (api === "create") set.add("create");
    if (api === "update") set.add("update");
    if (api === "delete") set.add("delete");
  }

  if (spec.sidebar) {
    set.add("read");
  }

  const order: PermissionAction[] = ["create", "read", "update", "delete"];
  return order.filter((p) => set.has(p));
}

export function createModuleOperations(
  module: ModuleInfo,
  spec: ModuleScaffoldSpec = FULL_SCAFFOLD
) {
  const { key, route, apiRoute, fileName } = module;

  const permSlug = (action: PermissionAction) => `${key}.${action}`;

  const pageDefs: Record<PageKind, { key: string; matcher: string; permission: string }> = {
    list: { key: `page_${fileName}_list`, matcher: route, permission: permSlug("read") },
    create: {
      key: `page_${fileName}_create`,
      matcher: `${route}/create`,
      permission: permSlug("create"),
    },
    edit: {
      key: `page_${fileName}_edit`,
      matcher: `${route}/edit`,
      permission: permSlug("update"),
    },
    delete: {
      key: `page_${fileName}_delete`,
      matcher: `${route}/delete`,
      permission: permSlug("delete"),
    },
  };

  const apiDefs: Record<
    ApiKind,
    { key: string; matcher: string; method: string; permission: string }
  > = {
    list: { key: `api_${fileName}_list`, matcher: apiRoute, method: "GET", permission: permSlug("read") },
    create: {
      key: `api_${fileName}_create`,
      matcher: apiRoute,
      method: "POST",
      permission: permSlug("create"),
    },
    get: {
      key: `api_${fileName}_get`,
      matcher: `${apiRoute}/:id`,
      method: "GET",
      permission: permSlug("read"),
    },
    update: {
      key: `api_${fileName}_update`,
      matcher: `${apiRoute}/:id`,
      method: "PUT",
      permission: permSlug("update"),
    },
    delete: {
      key: `api_${fileName}_delete`,
      matcher: `${apiRoute}/:id`,
      method: "DELETE",
      permission: permSlug("delete"),
    },
  };

  const permissionsCreate: Record<string, { key: string; description: string }> = {};
  const pagePolicies: Record<string, { matcher: string; method: string; permission: string }> =
    {};
  const apiPolicies: Record<
    string,
    { matcher: string; method: string; permission: string }
  > = {};

  for (const action of permissionsForSpec(spec)) {
    const slug = permSlug(action);
    permissionsCreate[slug] = {
      key: slug,
      description: `${action.charAt(0).toUpperCase()}${action.slice(1)} ${key}`,
    };
  }

  for (const kind of spec.pages) {
    const def = pageDefs[kind];
    pagePolicies[def.key] = {
      matcher: def.matcher,
      method: "*",
      permission: def.permission,
    };
  }

  for (const kind of spec.apis) {
    const def = apiDefs[kind];
    apiPolicies[def.key] = {
      matcher: def.matcher,
      method: def.method,
      permission: def.permission,
    };
  }

  const up: Record<string, unknown> = {
    permissions: { create: permissionsCreate },
    accessPolicies: {
      pages: { create: pagePolicies },
      apis: { create: apiPolicies },
    },
  };

  if (spec.sidebar) {
    up.sidebar = {
      create: {
        [key]: {
          label: module.label,
          path: route,
          icon: key.split("/").pop() ?? key,
          permission: permSlug("read"),
        },
      },
    };
  }

  const permissionDeletes = permissionsForSpec(spec).map((a) => permSlug(a));
  const pageDeletes = spec.pages.map((k) => pageDefs[k].key);
  const apiDeletes = spec.apis.map((k) => apiDefs[k].key);

  const down: Record<string, unknown> = {
    permissions: { delete: permissionDeletes },
    accessPolicies: {
      pages: { delete: pageDeletes },
      apis: { delete: apiDeletes },
    },
  };

  if (spec.sidebar) {
    down.sidebar = { delete: [key] };
  }

  return { up, down };
}

export function filterPagePolicies<T extends Record<string, unknown>>(
  policies: T,
  allowed?: PageKind[]
): Partial<T> {
  if (!allowed) return policies;
  if (allowed.length === 0) return {} as Partial<T>;

  return Object.fromEntries(
    Object.entries(policies).filter(([key]) => {
      const kind = pageKindFromPolicyKey(key);
      return kind !== null && allowed.includes(kind);
    })
  ) as Partial<T>;
}

export function filterApiPolicies<T extends Record<string, unknown>>(
  policies: T,
  allowed?: ApiKind[]
): Partial<T> {
  if (!allowed) return policies;
  if (allowed.length === 0) return {} as Partial<T>;

  return Object.fromEntries(
    Object.entries(policies).filter(([key]) => {
      const kind = apiKindFromPolicyKey(key);
      return kind !== null && allowed.includes(kind);
    })
  ) as Partial<T>;
}
