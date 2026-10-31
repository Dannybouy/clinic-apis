package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	queries "github.com/dannybouy/clinic-apis/backend/internal/database"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

type Slot struct {
	ID        string    `json:"id"`
	Provider  string    `json:"provider"`
	Start     time.Time `json:"start"`
	End       time.Time `json:"end"`
	Available bool      `json:"available"`
}

func (cfg *apiConfig) handlerListSlots(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	// Omitted means all providers. A supplied value uses an exact match.
	provider := pgtype.Text{String: query.Get("provider"), Valid: query.Has("provider")}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	rows, err := cfg.db.ListSlots(ctx, provider)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "could not list slots", err)
		return
	}

	// Keep database column names and types separate from the HTTP contract.
	result := make([]Slot, 0, len(rows))
	for _, row := range rows {
		result = append(result, Slot{
			ID:        row.ID,
			Provider:  row.Provider,
			Start:     row.StartTime.Time.UTC(),
			End:       row.EndTime.Time.UTC(),
			Available: row.Available,
		})
	}
	respondWithJSON(w, http.StatusOK, struct {
		Slots []Slot `json:"slots"`
	}{Slots: result})
}

// handlerCreateSlot is for local testing only; main registers it when PLATFORM=dev.
func (cfg *apiConfig) handlerCreateSlot(w http.ResponseWriter, r *http.Request) {
	type parameters struct {
		ID       string    `json:"id"`
		Provider string    `json:"provider"`
		Start    time.Time `json:"start"`
		End      time.Time `json:"end"`
	}

	var params parameters
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		respondWithError(w, http.StatusBadRequest, "invalid request body; start and end must be RFC3339 times", err)
		return
	}
	params.ID = strings.TrimSpace(params.ID)
	params.Provider = strings.TrimSpace(params.Provider)

	if params.Provider == "" || params.Start.IsZero() || params.End.IsZero() {
		respondWithError(w, http.StatusBadRequest, "provider, start and end are required", nil)
		return
	}
	if !params.End.After(params.Start) {
		respondWithError(w, http.StatusBadRequest, "end must be after start", nil)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	slot, err := cfg.db.CreateSlot(ctx, queries.CreateSlotParams{
		ID:        params.ID,
		Provider:  params.Provider,
		StartTime: pgtype.Timestamptz{Time: params.Start, Valid: true},
		EndTime:   pgtype.Timestamptz{Time: params.End, Valid: true},
	})
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		respondWithError(w, http.StatusConflict, "a slot with this id already exists", nil)
		return
	}
	if errors.As(err, &pgErr) && pgErr.Code == "23P01" {
		respondWithError(w, http.StatusConflict, "provider already has a slot overlapping this time", nil)
		return
	}
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "could not create slot", err)
		return
	}

	respondWithJSON(w, http.StatusCreated, Slot{
		ID:        slot.ID,
		Provider:  slot.Provider,
		Start:     slot.StartTime.Time.UTC(),
		End:       slot.EndTime.Time.UTC(),
		Available: true,
	})
}

func (cfg *apiConfig) handlerResetSlots(w http.ResponseWriter, r *http.Request) {
	type parameters struct {
		Slots []struct {
			ID       string    `json:"id"`
			Provider string    `json:"provider"`
			Start    time.Time `json:"start"`
			End      time.Time `json:"end"`
		} `json:"slots"`
	}

	var params parameters
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil || params.Slots == nil {
		respondWithError(w, http.StatusBadRequest, "invalid request body", err)
		return
	}

	// Validate the payload
	for i, slot := range params.Slots {
		slot.ID, slot.Provider = strings.TrimSpace(slot.ID), strings.TrimSpace(slot.Provider)
		if slot.ID == "" || slot.Provider == "" || slot.Start.IsZero() || slot.End.IsZero() {
			respondWithError(w, http.StatusBadRequest, "invalid slot provided", nil)
			return
		}
		if !slot.End.After(slot.Start) {
			respondWithError(w, http.StatusBadRequest, "end must be after start", nil)
			return
		}
		params.Slots[i] = slot
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Start the transaction
	tx, err := cfg.pool.Begin(ctx)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "could not start reset transaction", err)
		return
	}
	defer tx.Rollback(ctx)
	q := queries.New(tx)

	//Delete all slots: orderly
	for _, step := range []func(context.Context) error{
		q.DeleteAllIdempotencyKeys, q.DeleteAllBookings, q.DeleteAllSlots,
	} {
		if err := step(ctx); err != nil {
			respondWithError(w, http.StatusInternalServerError, "could not reset", err)
			return
		}
	}

	// One insert for the whole schedule. A sample week is about 120 slots, and
	// one round trip per slot exceeds the request deadline on a remote database.
	if len(params.Slots) > 0 {
		ids := make([]string, len(params.Slots))
		providers := make([]string, len(params.Slots))
		starts := make([]pgtype.Timestamptz, len(params.Slots))
		ends := make([]pgtype.Timestamptz, len(params.Slots))
		for i, slot := range params.Slots {
			ids[i] = slot.ID
			providers[i] = slot.Provider
			starts[i] = pgtype.Timestamptz{Time: slot.Start, Valid: true}
			ends[i] = pgtype.Timestamptz{Time: slot.End, Valid: true}
		}
		err = q.CreateSlots(ctx, queries.CreateSlotsParams{
			Ids:        ids,
			Providers:  providers,
			StartTimes: starts,
			EndTimes:   ends,
		})
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			respondWithError(w, http.StatusConflict, slotConflictMessage("a slot with this id already exists", pgErr), nil)
			return
		}
		if errors.As(err, &pgErr) && pgErr.Code == "23P01" {
			respondWithError(w, http.StatusConflict, slotConflictMessage("provider already has a slot overlapping this time", pgErr), nil)
			return
		}
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "could not create slot", err)
			return
		}
	}
	if err := tx.Commit(ctx); err != nil {
		respondWithError(w, http.StatusInternalServerError, "could not commit reset transaction", err)
		return
	}
	cfg.limiter.reset()

	respondWithJSON(w, http.StatusOK, map[string]string{"status": "ok"})

}

func slotConflictMessage(base string, pgErr *pgconn.PgError) string {
	if pgErr.Detail == "" {
		return base
	}
	return base + ": " + pgErr.Detail
}
