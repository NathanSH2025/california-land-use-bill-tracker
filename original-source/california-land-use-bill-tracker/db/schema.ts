import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const trackedBills = sqliteTable("tracked_bills", {
  id: text("id").primaryKey(),
  subject: text("subject").notNull(),
  status: text("status").notNull(),
  date: text("date").notNull(),
  chapter: text("chapter").notNull(),
  impact: text("impact").notNull(),
  action: text("action").notNull(),
  url: text("url").notNull(),
  billText: text("bill_text").notNull(),
  checkedAt: text("checked_at").notNull(),
});

export const scanState = sqliteTable("scan_state", {
  id: text("id").primaryKey(),
  checkedAt: text("checked_at").notNull(),
  result: text("result").notNull(),
});

export const billDecisions = sqliteTable("bill_decisions", {
  id: text("id").primaryKey(),
  decision: text("decision").notNull(),
  decidedAt: text("decided_at").notNull(),
});

export const pendingBills = sqliteTable("pending_bills", {
  id: text("id").primaryKey(),
  subject: text("subject").notNull(),
  status: text("status").notNull(),
  date: text("date").notNull(),
  chapter: text("chapter").notNull(),
  impact: text("impact").notNull(),
  action: text("action").notNull(),
  url: text("url").notNull(),
  billText: text("bill_text").notNull(),
  checkedAt: text("checked_at").notNull(),
});

export const billImpactCategories = sqliteTable("bill_impact_categories", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  updatedAt: text("updated_at").notNull(),
});
