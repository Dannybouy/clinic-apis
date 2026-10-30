-- +goose Up
-- The assessment accepts string IDs such as "s1" and RFC3339 timestamps.
-- Existing timestamp values are interpreted as UTC.
ALTER TABLE slots
    ALTER COLUMN id TYPE TEXT USING id::text,
    ALTER COLUMN start_time TYPE TIMESTAMPTZ USING start_time AT TIME ZONE 'UTC',
    ALTER COLUMN end_time TYPE TIMESTAMPTZ USING end_time AT TIME ZONE 'UTC',
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

-- +goose Down
-- This rollback intentionally fails if non-UUID IDs have been stored.
-- Goose rolls back the migration transaction rather than removing those slots.
ALTER TABLE slots
    ALTER COLUMN id TYPE UUID USING id::uuid,
    ALTER COLUMN created_at DROP DEFAULT,
    ALTER COLUMN updated_at DROP DEFAULT,
    ALTER COLUMN start_time TYPE TIMESTAMP USING start_time AT TIME ZONE 'UTC',
    ALTER COLUMN end_time TYPE TIMESTAMP USING end_time AT TIME ZONE 'UTC',
    ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at AT TIME ZONE 'UTC';
