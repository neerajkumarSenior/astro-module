import fs from "node:fs/promises";
import path from "node:path";

import { readLatestMigrationForModule, type ModuleMigrationJson } from "./migration-files";
import {
  filterApiPolicies,
  filterPagePolicies,
  type GenerateFileFilter,
} from "./module-scaffold";

type Policy = {
  matcher: string;
  method: string;
  permission: string;
};

type Migration = ModuleMigrationJson & {
  up?: {
    accessPolicies?: {
      pages?: { create?: Record<string, Policy> };
      apis?: { create?: Record<string, Policy> };
    };
  };
};

function getPageFileName(policyKey: string) {
  if (policyKey.endsWith("_list")) return "index.astro";
  if (policyKey.endsWith("_create")) return "create.astro";
  if (policyKey.endsWith("_edit")) return "edit.astro";
  if (policyKey.endsWith("_delete")) return "delete.astro";
  return `${policyKey}.astro`;
}

function getApiFileName(policyKey: string) {
  if (policyKey.endsWith("_list") || policyKey.endsWith("_create")) {
    return "index.ts";
  }
  return "[id].ts";
}

function createPageContent(moduleKey: string, policyKey: string, policy: Policy) {
  return `---
const moduleKey = "${moduleKey}";
const permission = "${policy.permission}";
---

<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <title>${moduleKey}</title>
  </head>
  <body>
    <h1>${moduleKey}</h1>
    <p>Page: ${policyKey}</p>
    <p>Permission: {permission}</p>
  </body>
</html>
`;
}

function apiHandler(
  httpMethod: string,
  moduleKey: string,
  permission: string,
  action: string,
  status = 200,
  extra = ""
) {
  return `export async function ${httpMethod}() {
  // Permission: ${permission}
  return new Response(
    JSON.stringify({
      success: true,
      module: "${moduleKey}",
      action: "${action}"${extra}
    }),
    {
      status: ${status},
      headers: { "Content-Type": "application/json" },
    }
  );
}`;
}

function createApiHandler(
  moduleKey: string,
  policyKey: string,
  policy: Policy
): { method: string; body: string } {
  const httpMethod = policy.method.toUpperCase();
  let action = policyKey.split("_").pop() ?? "unknown";

  if (httpMethod === "GET" && policyKey.endsWith("_list")) {
    action = "list";
    return {
      method: httpMethod,
      body: apiHandler(httpMethod, moduleKey, policy.permission, action, 200, ',\n      data: []'),
    };
  }

  if (httpMethod === "POST" && policyKey.endsWith("_create")) {
    return { method: httpMethod, body: apiHandler(httpMethod, moduleKey, policy.permission, "create", 201) };
  }

  if (httpMethod === "GET") {
    return { method: httpMethod, body: apiHandler(httpMethod, moduleKey, policy.permission, "get") };
  }

  if (httpMethod === "PUT") {
    return { method: httpMethod, body: apiHandler(httpMethod, moduleKey, policy.permission, "update") };
  }

  if (httpMethod === "DELETE") {
    return { method: httpMethod, body: apiHandler(httpMethod, moduleKey, policy.permission, "delete") };
  }

  return {
    method: httpMethod,
    body: apiHandler(httpMethod, moduleKey, policy.permission, action),
  };
}

async function writeNewFile(filePath: string, content: string) {
  try {
    await fs.access(filePath);
    console.log(`⚠️  Exists → ${path.relative(process.cwd(), filePath)}`);
    return;
  } catch {
    // create
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
  console.log(`✅ Created → ${path.relative(process.cwd(), filePath)}`);
}

async function generatePages(
  moduleKey: string,
  migration: Migration,
  filter?: GenerateFileFilter
) {
  let policies = migration.up?.accessPolicies?.pages?.create;
  if (!policies) return;

  if (filter?.pages?.length) {
    policies = filterPagePolicies(policies, filter.pages) as Record<string, Policy>;
  }

  for (const [policyKey, policy] of Object.entries(policies)) {
    const filePath = path.join(
      process.cwd(),
      "src",
      "pages",
      ...moduleKey.split("/"),
      getPageFileName(policyKey)
    );
    await writeNewFile(filePath, createPageContent(moduleKey, policyKey, policy));
  }
}

async function generateApis(
  moduleKey: string,
  migration: Migration,
  filter?: GenerateFileFilter
) {
  let policies = migration.up?.accessPolicies?.apis?.create;
  if (!policies) return;

  if (filter?.apis?.length) {
    policies = filterApiPolicies(policies, filter.apis) as Record<string, Policy>;
  }

  const byFile = new Map<string, Map<string, string>>();

  for (const [policyKey, policy] of Object.entries(policies)) {
    const filePath = path.join(
      process.cwd(),
      "src",
      "pages",
      "api",
      ...moduleKey.split("/"),
      getApiFileName(policyKey)
    );

    const { method, body } = createApiHandler(moduleKey, policyKey, policy);
    const handlers = byFile.get(filePath) ?? new Map<string, string>();
    handlers.set(method, body);
    byFile.set(filePath, handlers);
  }

  for (const [filePath, handlers] of byFile) {
    const content = [...handlers.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, body]) => body)
      .join("\n\n");
    await writeNewFile(filePath, content);
  }
}

export async function generateModuleFiles(
  moduleKey: string,
  filter?: GenerateFileFilter
) {
  console.log(`\n🔍 Module: ${moduleKey}`);

  const migration = (await readLatestMigrationForModule(moduleKey)) as Migration;
  console.log(`📝 Migration: ${migration.migrationId}`);

  if (filter?.pages?.length || filter?.apis?.length) {
    console.log("📋 File filter: custom subset");
  }

  console.log("\n📄 Pages...");
  await generatePages(moduleKey, migration, filter);

  console.log("\n🔌 APIs...");
  await generateApis(moduleKey, migration, filter);
  console.log("");
}
