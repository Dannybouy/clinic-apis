-- name: ListSlots :many
SELECT
    s.id,
    s.provider,
    s.start_time,
    s.end_time,
    NOT EXISTS (
        SELECT 1
        FROM bookings AS b
        WHERE b.slot_id = s.id AND b.status = 'confirmed'
    ) AS available
FROM slots AS s
WHERE sqlc.narg(provider)::text IS NULL
   OR s.provider = sqlc.narg(provider)::text
ORDER BY s.start_time ASC, s.id ASC;

-- name: GetSlotByID :one
SELECT * FROM slots WHERE id = $1;

-- name: CreateSlot :one
INSERT INTO slots (id, provider, start_time, end_time)
VALUES (
    COALESCE(NULLIF(sqlc.arg(id)::text, ''), gen_random_uuid()::text),
    sqlc.arg(provider),
    sqlc.arg(start_time),
    sqlc.arg(end_time)
)
RETURNING *;

-- name: DeleteAllSlots :exec
DELETE FROM slots;