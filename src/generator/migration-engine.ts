import crypto from "node:crypto";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { permissions } from "@/db/schema/permissions";
import { accessPolicies } from "@/db/schema/access_policies";
import { sidebarItems } from "@/db/schema/sidebar_items";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type PermissionDef = { key: string; description?: string };
type PolicyDef = {
  matcher: string;
  method?: string;
  permission?: string | null;
  description?: string;
  priority?: number;
  effect?: "allow" | "deny";
  isActive?: number;
};
type SidebarDef = {
  label?: string;
  path?: string | null;
  icon?: string | null;
  permission?: string | null;
};

export type CreatedRecords = {
  permissions: string[];
  pagePolicies: string[];
  apiPolicies: string[];
  sidebar: string[];
};

async function findPermissionId(tx: Tx, permissionSlug?: string | null) {
  if (!permissionSlug) return null;

  const result = await tx
    .select({ id: permissions.id })
    .from(permissions)
    .where(eq(permissions.slug, permissionSlug))
    .limit(1);

  if (result.length === 0) {
    throw new Error(`Permission "${permissionSlug}" does not exist`);
  }

  return result[0]!.id;
}

async function createPermissions(
  tx: Tx,
  definitions: Record<string, PermissionDef>,
  created: CreatedRecords
) {
  for (const [slug, value] of Object.entries(definitions)) {
    const existing = await tx
      .select({ id: permissions.id })
      .from(permissions)
      .where(eq(permissions.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      console.log(`   ⏭ permission already exists: ${slug}`);
      continue;
    }

    const [module, action] = slug.includes(".") ? slug.split(".", 2) : [slug, ""];

    await tx.insert(permissions).values({
      id: crypto.randomUUID(),
      slug,
      name: value.description ?? `${action} ${module}`,
      module,
      action,
    });

    created.permissions.push(slug);
    console.log(`   ✓ permission created: ${slug}`);
  }
}

async function deleteBySlugs(
  tx: Tx,
  table: typeof permissions | typeof accessPolicies | typeof sidebarItems,
  slugs: string[],
  label: string
) {
  for (const slug of slugs) {
    await tx.delete(table).where(eq(table.slug, slug));
    console.log(`   ✓ ${label} deleted: ${slug}`);
  }
}

async function createAccessPolicies(
  tx: Tx,
  type: "page" | "api",
  definitions: Record<string, PolicyDef>,
  created: CreatedRecords
) {
  for (const [slug, value] of Object.entries(definitions)) {
    const permissionId = await findPermissionId(tx, value.permission);

    const existing = await tx
      .select({ id: accessPolicies.id })
      .from(accessPolicies)
      .where(eq(accessPolicies.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      console.log(`   ⏭ policy already exists: ${type}:${slug}`);
      continue;
    }

    await tx.insert(accessPolicies).values({
      id: crypto.randomUUID(),
      slug,
      type,
      method: value.method ?? "*",
      matcher: value.matcher,
      permissionId,
      priority: value.priority ?? 0,
      effect: value.effect ?? "allow",
      description: value.description ?? `${type}:${slug}`,
      isActive: value.isActive ?? 1,
    });

    if (type === "page") created.pagePolicies.push(slug);
    else created.apiPolicies.push(slug);

    console.log(`   ✓ policy created: ${type}:${slug}`);
  }
}

async function createSidebarItems(
  tx: Tx,
  definitions: Record<string, SidebarDef>,
  created: CreatedRecords
) {
  for (const [slug, value] of Object.entries(definitions)) {
    const permissionId = await findPermissionId(tx, value.permission);

    const existing = await tx
      .select({ id: sidebarItems.id })
      .from(sidebarItems)
      .where(eq(sidebarItems.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      console.log(`   ⏭ sidebar already exists: ${slug}`);
      continue;
    }

    await tx.insert(sidebarItems).values({
      id: crypto.randomUUID(),
      slug,
      parentId: null,
      label: value.label ?? slug,
      href: value.path ?? null,
      iconSvg: value.icon ?? null,
      type: "menu",
      permissionId,
      sortOrder: 0,
      isActive: 1,
    });

    created.sidebar.push(slug);
    console.log(`   ✓ sidebar created: ${slug}`);
  }
}

async function updatePermissions(
  tx: Tx,
  updates: Record<string, PermissionDef & { slug?: string }>
) {
  for (const [slug, value] of Object.entries(updates)) {
    const row = await tx
      .select()
      .from(permissions)
      .where(eq(permissions.slug, slug))
      .limit(1);

    if (row.length === 0) {
      throw new Error(`Permission "${slug}" does not exist (update)`);
    }

    const current = row[0]!;
    const nextSlug = value.slug?.trim() || slug;

    await tx
      .update(permissions)
      .set({
        slug: nextSlug,
        name: value.description ?? current.name,
      })
      .where(eq(permissions.slug, slug));

    console.log(`   ✓ permission updated: ${slug}${nextSlug !== slug ? ` → ${nextSlug}` : ""}`);
  }
}

async function updateAccessPolicies(
  tx: Tx,
  type: "page" | "api",
  updates: Record<string, PolicyDef & { slug?: string }>
) {
  for (const [slug, value] of Object.entries(updates)) {
    const row = await tx
      .select()
      .from(accessPolicies)
      .where(eq(accessPolicies.slug, slug))
      .limit(1);

    if (row.length === 0) {
      throw new Error(`Policy "${slug}" does not exist (update)`);
    }

    const current = row[0]!;
    const permissionId =
      value.permission !== undefined
        ? await findPermissionId(tx, value.permission)
        : current.permissionId;

    const nextSlug = value.slug?.trim() || slug;

    await tx
      .update(accessPolicies)
      .set({
        slug: nextSlug,
        method: value.method ?? current.method,
        matcher: value.matcher ?? current.matcher,
        permissionId,
        priority: value.priority ?? current.priority,
        effect: value.effect ?? current.effect,
        description: value.description ?? current.description,
        isActive: value.isActive ?? current.isActive,
      })
      .where(eq(accessPolicies.slug, slug));

    console.log(`   ✓ policy updated: ${type}:${slug}${nextSlug !== slug ? ` → ${nextSlug}` : ""}`);
  }
}

async function updateSidebarItems(
  tx: Tx,
  updates: Record<string, SidebarDef & { slug?: string }>
) {
  for (const [slug, value] of Object.entries(updates)) {
    const row = await tx
      .select()
      .from(sidebarItems)
      .where(eq(sidebarItems.slug, slug))
      .limit(1);

    if (row.length === 0) {
      throw new Error(`Sidebar item "${slug}" does not exist (update)`);
    }

    const current = row[0]!;
    const permissionId =
      value.permission !== undefined
        ? await findPermissionId(tx, value.permission)
        : current.permissionId;

    const nextSlug = value.slug?.trim() || slug;

    await tx
      .update(sidebarItems)
      .set({
        slug: nextSlug,
        label: value.label ?? current.label,
        href: value.path !== undefined ? value.path : current.href,
        iconSvg: value.icon !== undefined ? value.icon : current.iconSvg,
        permissionId,
      })
      .where(eq(sidebarItems.slug, slug));

    console.log(`   ✓ sidebar updated: ${slug}${nextSlug !== slug ? ` → ${nextSlug}` : ""}`);
  }
}

export async function applyUp(tx: Tx, up: Record<string, any>): Promise<CreatedRecords> {
  const created: CreatedRecords = {
    permissions: [],
    pagePolicies: [],
    apiPolicies: [],
    sidebar: [],
  };

  if (up.permissions?.create) {
    await createPermissions(tx, up.permissions.create, created);
  }

  if (up.permissions?.update) {
    await updatePermissions(tx, up.permissions.update);
  }

  if (up.accessPolicies?.pages?.create) {
    await createAccessPolicies(tx, "page", up.accessPolicies.pages.create, created);
  }

  if (up.accessPolicies?.pages?.update) {
    await updateAccessPolicies(tx, "page", up.accessPolicies.pages.update);
  }

  if (up.accessPolicies?.apis?.create) {
    await createAccessPolicies(tx, "api", up.accessPolicies.apis.create, created);
  }

  if (up.accessPolicies?.apis?.update) {
    await updateAccessPolicies(tx, "api", up.accessPolicies.apis.update);
  }

  if (up.sidebar?.create) {
    await createSidebarItems(tx, up.sidebar.create, created);
  }

  if (up.sidebar?.update) {
    await updateSidebarItems(tx, up.sidebar.update);
  }

  return created;
}

export async function applyDown(tx: Tx, down: Record<string, any>) {
  if (down.sidebar?.update) {
    await updateSidebarItems(tx, down.sidebar.update);
  }

  if (down.sidebar?.delete) {
    await deleteBySlugs(tx, sidebarItems, down.sidebar.delete, "sidebar");
  }

  if (down.accessPolicies?.pages?.update) {
    await updateAccessPolicies(tx, "page", down.accessPolicies.pages.update);
  }

  if (down.accessPolicies?.pages?.delete) {
    await deleteBySlugs(tx, accessPolicies, down.accessPolicies.pages.delete, "policy");
  }

  if (down.accessPolicies?.apis?.update) {
    await updateAccessPolicies(tx, "api", down.accessPolicies.apis.update);
  }

  if (down.accessPolicies?.apis?.delete) {
    await deleteBySlugs(tx, accessPolicies, down.accessPolicies.apis.delete, "policy");
  }

  if (down.permissions?.update) {
    await updatePermissions(tx, down.permissions.update);
  }

  if (down.permissions?.delete) {
    await deleteBySlugs(tx, permissions, down.permissions.delete, "permission");
  }
}
