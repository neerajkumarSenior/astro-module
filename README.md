# astro-module

Migration-driven modules for **Astro** projects: permissions, access policies, sidebar, DB migrations, and scaffold for `src/pages` + `src/pages/api`.

## Install (in your Astro app)

```bash
npm install -D astro-module
```

Requires `DATABASE_URL` in `.env` and MySQL tables (see Drizzle schema exported from `astro-module/schema`).

## CLI

```bash
npx astro-module              # interactive menu
npx astro-module new products
npx astro-module migrate
```

Or add to `package.json`:

```json
"scripts": {
  "module": "astro-module"
}
```

## Local development (link)

```bash
cd astro-module && npm install && npm run build && npm link
cd ../super_web && npm link astro-module
```

After code changes in this repo: `npm run build` again.

## Commands

| Command | Description |
|---------|-------------|
| `new <module>` | Create migration + migrate + generate files |
| `add <module>` | Add pages/APIs to existing module |
| `update <module>` | Patch routes, permissions, sidebar |
| `migration <module> [name]` | Create migration JSON only |
| `migrate` | Apply pending migrations |
| `rollback` | Undo last applied migration |
| `generate <module>` | Generate Astro pages/APIs |
| `build [module]` | Write `generated/modules/*/module.json` |
| `setup <module>` | migrate + build + generate |
