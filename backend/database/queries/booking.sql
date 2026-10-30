-- name: CreateBooking :one
INSERT INTO bookings (id, slot_id, name, email) 
VALUES (gen_random_uuid()::text,$1, $2, $3)
ON CONFLICT (slot_id) WHERE status = 'confirmed' DO NOTHING
RETURNING *;

-- name: ListBookingsByEmail :many
SELECT * FROM bookings
WHERE lower(email) = lower(sqlc.arg(email)::text)
  AND (
    sqlc.narg(cursor_created_at)::timestamptz IS NULL
    OR (created_at, id) > (sqlc.narg(cursor_created_at)::timestamptz, sqlc.narg(cursor_id)::text)
  )
ORDER BY created_at ASC, id ASC
LIMIT sqlc.arg(row_limit);

-- name: GetBookingByID :one
SELECT * FROM bookings WHERE id = sqlc.arg(id) LIMIT 1;

-- name: DeleteBookingByID :one
UPDATE bookings SET status = 'cancelled' 
WHERE id = sqlc.arg(id) AND status = 'confirmed'
RETURNING *;

-- name: DeleteAllBookings :exec
DELETE FROM bookings;