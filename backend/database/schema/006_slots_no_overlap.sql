-- +goose Up
-- A provider cannot have two slots whose times overlap. Touching ends (09:30) are allowed.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE slots ADD CONSTRAINT slots_no_overlap
    EXCLUDE USING gist (provider WITH =, tstzrange(start_time, end_time) WITH &&);

-- +goose Down
ALTER TABLE slots DROP CONSTRAINT slots_no_overlap;
