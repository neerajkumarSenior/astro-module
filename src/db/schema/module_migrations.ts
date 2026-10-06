import {
  mysqlTable,
  varchar,
  timestamp,
 
  index,
  text,
  
} from "drizzle-orm/mysql-core";

export const moduleMigrations = mysqlTable(
  "module_migrations",
  {
    id: varchar("id", {
      length: 36,
    }).primaryKey(),

    migrationId: varchar("migration_id", {
      length: 150,
    })
      .notNull()
      .unique(),

    moduleKey: varchar("module_key", {
      length: 150,
    }).notNull(),

    migrationName: varchar("migration_name", {
      length: 200,
    }).notNull(),

    migrationFile: varchar("migration_file", {
      length: 500,
    }).notNull(),

      createdRecords: text("created_records"),

    status: varchar("status", {
      length: 30,
    }).notNull(),

    appliedAt: timestamp("applied_at"),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    moduleKeyIdx: index(
      "module_migrations_module_key_idx"
    ).on(table.moduleKey),

    statusIdx: index(
      "module_migrations_status_idx"
    ).on(table.status),
  })
);