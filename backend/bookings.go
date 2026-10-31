package main

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/mail"
	"strconv"
	"strings"
	"time"

	queries "github.com/dannybouy/clinic-apis/backend/internal/database"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type bookingResponse struct {
	ID        string    `json:"id"`
	SlotID    string    `json:"slot_id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type bookingRequest struct {
	SlotID string `json:"slot_id"`
	Name   string `json:"name"`
	Email  string `json:"email"`
}

func (cfg *apiConfig) handlerCreateBooking(w http.ResponseWriter, r *http.Request) {
	var params bookingRequest
	decoder := json.NewDecoder(r.Body)
	err := decoder.Decode(&params)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "invalid request body", err)
		return
	}

	params.SlotID = strings.TrimSpace(params.SlotID)
	params.Name = strings.TrimSpace(params.Name)
	params.Email = strings.ToLower(strings.TrimSpace(params.Email))

	if params.Email == "" {
		respondWithError(w, http.StatusBadRequest, "missing required fields", nil)
		return
	}
	// Runs before validation and idempotency so failed attempts and replays count.
	if retryAfter := cfg.limiter.allow(params.Email, time.Now()); retryAfter > 0 {
		w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
		respondWithError(w, http.StatusTooManyRequests, "too many attempts for this email", nil)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	key := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	if key == "" {
		status, body := createBooking(ctx, cfg.db, params)
		respondWithJSON(w, status, body)
		return
	}

	tx, err := cfg.pool.Begin(ctx)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "could not start transaction", err)
		return
	}

	defer tx.Rollback(ctx)

	query := queries.New(tx)
	hash := hashBookingRequest(params)

	claimed, err := query.ClaimIdempotencyKey(ctx, queries.ClaimIdempotencyKeyParams{
		Key:         key,
		RequestHash: hash,
	})

	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "could not claim idempotency key", err)
		return
	}
	if claimed == 0 {
		stored, err := query.GetIdempotencyKey(ctx, key)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "could not get idempotency key", err)
			return
		}
		if stored.RequestHash != hash {
			respondWithError(w, http.StatusUnprocessableEntity, "Idempotency-Key reused with a different body", nil)
			return
		}
		respondWithJSON(w, int(stored.StatusCode.Int32), json.RawMessage(stored.ResponseBody))
		return
	}

	status, body := createBooking(ctx, query, params)
	if status >= 500 {
		respondWithJSON(w, status, body)
		return
	}
	data, err := json.Marshal(body)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "could not save response", err)
		return
	}
	if err := query.SaveIdempotencyResponse(ctx, queries.SaveIdempotencyResponseParams{
		Key:          key,
		StatusCode:   pgtype.Int4{Int32: int32(status), Valid: true},
		ResponseBody: data,
	}); err != nil {
		respondWithError(w, http.StatusInternalServerError, "could not save response", err)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		respondWithError(w, http.StatusInternalServerError, "could not commit transaction", err)
		return
	}
	respondWithJSON(w, status, body)
}

func createBooking(ctx context.Context, q queries.Querier, params bookingRequest) (int, any) {
	if params.SlotID == "" || params.Name == "" || params.Email == "" {
		return http.StatusBadRequest, map[string]string{"error": "missing required fields"}
	}

	if _, err := mail.ParseAddress(params.Email); err != nil {
		return http.StatusBadRequest, map[string]string{"error": "invalid email address"}
	}

	slot, err := q.GetSlotByID(ctx, params.SlotID)
	if errors.Is(err, pgx.ErrNoRows) {
		return http.StatusNotFound, map[string]string{"error": "slot not found"}
	}
	if err != nil {
		log.Println("error loading slot:", err)
		return http.StatusInternalServerError, map[string]string{"error": "could not load slot"}
	}
	if !slot.StartTime.Time.After(time.Now()) {
		return http.StatusBadRequest, map[string]string{"error": "slot has already started"}
	}

	booking, err := q.CreateBooking(ctx, queries.CreateBookingParams{
		SlotID: params.SlotID,
		Name:   params.Name,
		Email:  params.Email,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return http.StatusConflict, map[string]string{"error": "slot already booked"}
	}
	if err != nil {
		log.Println("error creating booking:", err)
		return http.StatusInternalServerError, map[string]string{"error": "could not create booking"}
	}

	return http.StatusCreated, bookingResponse{
		ID:        booking.ID,
		SlotID:    booking.SlotID,
		Name:      booking.Name,
		Email:     booking.Email,
		Status:    booking.Status,
		CreatedAt: booking.CreatedAt.Time.UTC(),
	}
}

func hashBookingRequest(params bookingRequest) string {
	sum := sha256.Sum256([]byte(params.SlotID + "\x00" + params.Name + "\x00" + params.Email))
	return hex.EncodeToString(sum[:])
}

type bookingListResponse struct {
	Bookings   []bookingResponse `json:"bookings"`
	NextCursor *string           `json:"next_cursor"`
}

func (cfg *apiConfig) handlerListBookings(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()

	email := strings.ToLower(strings.TrimSpace(query.Get("email")))
	if email == "" {
		respondWithError(w, http.StatusBadRequest, "email is required", nil)
		return
	}

	limit := 10
	if query.Has("limit") {
		n, err := strconv.Atoi(query.Get("limit"))
		if err != nil || n < 1 || n > 50 {
			respondWithError(w, http.StatusBadRequest, "limit must be an integer from 1 to 50", nil)
			return
		}
		limit = n
	}

	params := queries.ListBookingsByEmailParams{
		Email:    email,
		RowLimit: int32(limit + 1),
	}
	if cursor := query.Get("cursor"); cursor != "" {
		createdAt, id, err := decodeCursor(cursor)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "invalid cursor", nil)
			return
		}
		params.CursorCreatedAt = pgtype.Timestamptz{Time: createdAt, Valid: true}
		params.CursorID = pgtype.Text{String: id, Valid: true}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	rows, err := cfg.db.ListBookingsByEmail(ctx, params)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "could not list bookings", err)
		return
	}

	// One extra row was requested to find out whether another page exists.
	var nextCursor *string
	if len(rows) > limit {
		rows = rows[:limit]
		last := rows[len(rows)-1]
		c := encodeCursor(last.CreatedAt.Time, last.ID)
		nextCursor = &c
	}

	bookings := make([]bookingResponse, 0, len(rows))
	for _, b := range rows {
		bookings = append(bookings, bookingResponse{
			ID:        b.ID,
			SlotID:    b.SlotID,
			Name:      b.Name,
			Email:     b.Email,
			Status:    b.Status,
			CreatedAt: b.CreatedAt.Time.UTC(),
		})
	}

	respondWithJSON(w, http.StatusOK, bookingListResponse{
		Bookings:   bookings,
		NextCursor: nextCursor,
	})
}

// The cursor keeps full microsecond precision; rounding would repeat or skip rows.
func encodeCursor(createdAt time.Time, id string) string {
	raw := createdAt.UTC().Format(time.RFC3339Nano) + "|" + id
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

func decodeCursor(cursor string) (time.Time, string, error) {
	raw, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return time.Time{}, "", err
	}
	ts, id, ok := strings.Cut(string(raw), "|")
	if !ok || id == "" {
		return time.Time{}, "", errors.New("malformed cursor")
	}
	createdAt, err := time.Parse(time.RFC3339Nano, ts)
	if err != nil {
		return time.Time{}, "", err
	}
	return createdAt, id, nil
}

func (cfg *apiConfig) handlerGetBookingByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	if id == "" {
		respondWithError(w, http.StatusBadRequest, "id is required", nil)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	booking, err := cfg.db.GetBookingByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		respondWithError(w, http.StatusNotFound, "slot not found", nil)
		return
	}
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "could not get booking", err)
		return
	}

	respondWithJSON(w, http.StatusOK, bookingResponse{
		ID:        booking.ID,
		SlotID:    booking.SlotID,
		Name:      booking.Name,
		Email:     booking.Email,
		Status:    booking.Status,
		CreatedAt: booking.CreatedAt.Time.UTC(),
	})
}

func (cfg *apiConfig) handlerDeleteBookingByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	if id == "" {
		respondWithError(w, http.StatusBadRequest, "id is required", nil)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	booking, err := cfg.db.DeleteBookingByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		if _, err := cfg.db.GetBookingByID(ctx, id); errors.Is(err, pgx.ErrNoRows) {
			respondWithError(w, http.StatusNotFound, "slot not found", nil)
			return
		} else if err != nil {
			respondWithError(w, http.StatusInternalServerError, "could not cancel booking", err)
			return
		}
		respondWithError(w, http.StatusConflict, "slot already cancelled", nil)
		return
	}
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "could not cancel booking", err)
		return
	}

	respondWithJSON(w, http.StatusOK, bookingResponse{
		ID:        booking.ID,
		SlotID:    booking.SlotID,
		Name:      booking.Name,
		Email:     booking.Email,
		Status:    booking.Status,
		CreatedAt: booking.CreatedAt.Time.UTC(),
	})
}
