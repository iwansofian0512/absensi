-- Bootstrap-only query. Keeps `sqlc generate` meaningful while the business
-- schema is still empty; replaced by real queries in S0/S1.
-- name: Ping :one
SELECT 1;
