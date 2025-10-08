import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./schema";

export const userActivities = pgTable("user_activities", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  activityType: text("activity_type").notNull(),
  status: text("status").notNull(),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  geolocation: jsonb("geolocation"),
  deviceInfo: jsonb("device_info"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});