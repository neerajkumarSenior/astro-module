import { mysqlTable, varchar, int, mysqlEnum, timestamp, foreignKey } from 'drizzle-orm/mysql-core';
import { permissions } from './permissions'; // Assuming your permissions table is in the same directory

export const accessPolicies = mysqlTable('access_policies', {
  id: varchar('id', { length: 36 }).notNull().primaryKey(),
  slug: varchar('slug', { length: 150 }).notNull().unique(),
  type: mysqlEnum('type', ['page', 'api']).notNull(),
  method: varchar('method', { length: 10 }).notNull().default('*'),
  matcher: varchar('matcher', { length: 500 }).notNull(),
  permissionId: varchar('permission_id', { length: 36 }),
  priority: int('priority').notNull().default(0),
  effect: mysqlEnum('effect', ['allow', 'deny']).notNull().default('allow'),
  description: varchar('description', { length: 255 }),
  isActive: int('is_active').notNull().default(1),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  permissionRef: foreignKey({
    columns: [table.permissionId],
    foreignColumns: [permissions.id],
  }).onDelete('set null'),
}));