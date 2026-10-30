-- +goose Up
CREATE TABLE bookings (
    id TEXT PRIMARY KEY,
    slot_id TEXT NOT NULL REFERENCES slots(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed'
        CHECK (status IN ('confirmed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX bookings_slot_status_idx ON bookings (slot_id, status);

-- +goose Down
DROP TABLE bookings;
