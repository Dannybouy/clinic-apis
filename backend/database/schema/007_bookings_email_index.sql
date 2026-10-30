-- +goose Up
CREATE INDEX bookings_email_created_idx ON bookings (lower(email), created_at, id);

-- +goose Down
DROP INDEX bookings_email_created_idx;
