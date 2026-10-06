import { mysqlTable, varchar, text, mysqlEnum, char, int, tinyint, timestamp, foreignKey } from 'drizzle-orm/mysql-core';
import { permissions } from './permissions'; // Assuming your permissions table is in the same directory
export const sidebarItems = mysqlTable('sidebar_items', {
  id: varchar('id', { length: 36 }).notNull().primaryKey(),
     slug: varchar('slug', { length: 150 })
      .notNull()
      .unique(),
  parentId: varchar('parent_id', { length: 36 }),
  label: varchar('label', { length: 100 }).notNull(),
  href: varchar('href', { length: 255 }),
  iconSvg: text('icon_svg'),
  type: mysqlEnum('type', ['menu', 'group']).notNull().default('menu'),
  permissionId: char('permission_id', { length: 36 }),
  sortOrder: int('sort_order', { unsigned: true }).notNull().default(0),
  isActive: tinyint('is_active').notNull().default(1),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow().onUpdateNow(),
  deletedAt: timestamp('deleted_at', { mode: 'date' }),
}, (table) => ({
  parentRef: foreignKey({
    columns: [table.parentId],
    foreignColumns: [table.id],
  }).onDelete('cascade'),
  permissionRef: foreignKey({
    columns: [table.permissionId],
    foreignColumns: [permissions.id],
  }).onDelete('set null'),
}));