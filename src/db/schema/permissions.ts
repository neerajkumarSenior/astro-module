import { mysqlTable, varchar, timestamp } from 'drizzle-orm/mysql-core';

export const permissions = mysqlTable('permissions', {
  id: varchar('id', { length: 36 }).notNull().primaryKey(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  module: varchar('module', { length: 255 }).notNull(),
  action: varchar('action', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow().onUpdateNow(),
});