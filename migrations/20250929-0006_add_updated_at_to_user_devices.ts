// TypeScript-flavored migration for Drizzle/Drizzle-Kit
// Exports `up` and `down` functions. The migration runner typically calls these with a DB client
// that exposes a `query` method (e.g., node-postgres client). We keep types as `any` to avoid
// coupling to a specific client type in this repo.

export async function up(db: any) {
  // Add column if missing
  await db.query(`ALTER TABLE user_devices
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();`);

  // Backfill existing rows
  await db.query(`UPDATE user_devices SET updated_at = created_at WHERE updated_at IS NULL;`);

  // Create index for faster lookups (optional but consistent with other migrations)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_user_devices_updated_at ON user_devices(updated_at);`);
}

export async function down(db: any) {
  // Rollback: remove column and index
  await db.query(`ALTER TABLE user_devices DROP COLUMN IF EXISTS updated_at;`);
  await db.query(`DROP INDEX IF EXISTS idx_user_devices_updated_at;`);
}
