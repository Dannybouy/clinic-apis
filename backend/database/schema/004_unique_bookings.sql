-- +goose Up
CREATE UNIQUE INDEX bookings_one_confirmed_per_slot
ON bookings (slot_id) WHERE status = 'confirmed';

-- +goose Down
DROP INDEX bookings_one_confirmed_per_slot;