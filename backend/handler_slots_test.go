package main

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/dannybouy/clinic-apis/backend/internal/database"
	queries "github.com/dannybouy/clinic-apis/backend/internal/database"
	"github.com/jackc/pgx/v5/pgtype"
)

type failingStore struct{ queries.Querier }

func (failingStore) ListSlots(context.Context, pgtype.Text) ([]database.ListSlotsRow, error) {
	return nil, errors.New("private database details")
}

func TestListSlotsHidesDatabaseErrors(t *testing.T) {
	cfg := &apiConfig{db: failingStore{}}
	response := httptest.NewRecorder()
	cfg.handlerListSlots(response, httptest.NewRequest(http.MethodGet, "/slots", nil))
	if response.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d; want 500", response.Code)
	}
	if response.Header().Get("Content-Type") != "application/json; charset=utf-8" {
		t.Fatal("error response must be JSON")
	}
	if strings.TrimSpace(response.Body.String()) != `{"error":"could not list slots"}` {
		t.Fatalf("unexpected error response: %s", response.Body)
	}
}
