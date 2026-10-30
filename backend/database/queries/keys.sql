-- name: ClaimIdempotencyKey :execrows
INSERT INTO idempotency_keys (key, request_hash)
VALUES ($1, $2) ON CONFLICT (key) DO NOTHING;

-- name: GetIdempotencyKey :one
SELECT * FROM idempotency_keys WHERE key = $1;

-- name: SaveIdempotencyResponse :exec
UPDATE idempotency_keys
SET status_code = $2, response_body = $3,
updated_at = CURRENT_TIMESTAMP
WHERE key = $1;

-- name: DeleteIdempotencyKey :exec
DELETE FROM idempotency_keys WHERE key = $1;

-- name: DeleteAllIdempotencyKeys :exec
DELETE FROM idempotency_keys;