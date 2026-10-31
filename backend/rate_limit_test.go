package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	queries "github.com/dannybouy/clinic-apis/backend/internal/database"
	"github.com/jackc/pgx/v5"
)

func TestRateLimiterSlidingWindow(t *testing.T) {
	rl := newRateLimiter()
	start := time.Now()

	for i := range bookingAttemptLimit {
		if got := rl.allow("a@example.com", start.Add(time.Duration(i)*time.Second)); got != 0 {
			t.Fatalf("attempt %d: retryAfter = %d; want 0", i+1, got)
		}
	}
	if got := rl.allow("a@example.com", start.Add(10*time.Second)); got != 50 {
		t.Fatalf("6th attempt: retryAfter = %d; want 50", got)
	}
	if got := rl.allow("b@example.com", start.Add(10*time.Second)); got != 0 {
		t.Fatalf("other email: retryAfter = %d; want 0", got)
	}
	if got := rl.allow("a@example.com", start.Add(time.Minute+time.Millisecond)); got != 0 {
		t.Fatalf("after oldest expired: retryAfter = %d; want 0", got)
	}

	rl.reset()
	for range bookingAttemptLimit {
		rl.allow("c@example.com", start)
	}
	rl.reset()
	if got := rl.allow("c@example.com", start); got != 0 {
		t.Fatalf("after reset: retryAfter = %d; want 0", got)
	}
}

type noSlotsStore struct{ queries.Querier }

func (noSlotsStore) GetSlotByID(context.Context, string) (queries.Slot, error) {
	return queries.Slot{}, pgx.ErrNoRows
}

func postBooking(cfg *apiConfig, email string) *httptest.ResponseRecorder {
	body := `{"slot_id":"missing","name":"Ada","email":"` + email + `"}`
	response := httptest.NewRecorder()
	cfg.handlerCreateBooking(response, httptest.NewRequest(http.MethodPost, "/bookings", strings.NewReader(body)))
	return response
}

func TestCreateBookingRateLimit(t *testing.T) {
	cfg := &apiConfig{db: noSlotsStore{}, limiter: newRateLimiter()}

	for i := range bookingAttemptLimit {
		// Case and whitespace differences still count against the same email.
		if res := postBooking(cfg, " Ada@Example.com "); res.Code != http.StatusNotFound {
			t.Fatalf("attempt %d: status = %d; want 404", i+1, res.Code)
		}
	}

	res := postBooking(cfg, "ada@example.com")
	if res.Code != http.StatusTooManyRequests {
		t.Fatalf("6th attempt: status = %d; want 429", res.Code)
	}
	retryAfter, err := strconv.Atoi(res.Header().Get("Retry-After"))
	if err != nil || retryAfter < 1 || retryAfter > 60 {
		t.Fatalf("Retry-After = %q; want 1 to 60", res.Header().Get("Retry-After"))
	}

	if res := postBooking(cfg, "other@example.com"); res.Code != http.StatusNotFound {
		t.Fatalf("other email: status = %d; want 404", res.Code)
	}
}

func TestCreateBookingEmptyEmailIsNotCounted(t *testing.T) {
	cfg := &apiConfig{db: noSlotsStore{}, limiter: newRateLimiter()}

	for range bookingAttemptLimit + 1 {
		if res := postBooking(cfg, "   "); res.Code != http.StatusBadRequest {
			t.Fatalf("status = %d; want 400", res.Code)
		}
	}
	if len(cfg.limiter.attempts) != 0 {
		t.Fatalf("empty email was counted: %v", cfg.limiter.attempts)
	}
}
