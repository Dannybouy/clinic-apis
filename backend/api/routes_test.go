package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type testDatabase struct{ err error }

func (db testDatabase) Ping(context.Context) error { return db.err }

func TestHealthReportsDatabaseState(t *testing.T) {
	for _, tc := range []struct {
		name   string
		err    error
		status int
		state  string
	}{
		{"connected", nil, http.StatusOK, "connected"},
		{"unavailable", errors.New("postgresql://secret-password@private-host"), http.StatusServiceUnavailable, "disconnected"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rr := httptest.NewRecorder()
			NewHandler(testDatabase{tc.err}, t.TempDir()).ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/health", nil))
			if rr.Code != tc.status {
				t.Fatalf("status = %d; want %d", rr.Code, tc.status)
			}
			var body map[string]string
			if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if body["database"] != tc.state || strings.Contains(rr.Body.String(), "secret-password") {
				t.Fatalf("unexpected health response: %s", rr.Body)
			}
		})
	}
}

func TestFrontendAndAPIRoutesStaySeparate(t *testing.T) {
	directory := t.TempDir()
	if err := os.WriteFile(filepath.Join(directory, "index.html"), []byte("<h1>Clinic</h1>"), 0600); err != nil {
		t.Fatal(err)
	}
	handler := NewHandler(testDatabase{}, directory)
	for _, tc := range []struct {
		method string
		path   string
		status int
	}{
		{http.MethodGet, "/", http.StatusOK},
		{http.MethodGet, "/api/missing", http.StatusNotFound},
		{http.MethodGet, "/bookings/missing", http.StatusNotFound},
		{http.MethodGet, "/slots", http.StatusNotFound},
		{http.MethodGet, "/missing.js", http.StatusNotFound},
		{http.MethodPost, "/healthz", http.StatusMethodNotAllowed},
		{http.MethodGet, "/healthz", http.StatusOK},
	} {
		t.Run(tc.method+tc.path, func(t *testing.T) {
			rr := httptest.NewRecorder()
			handler.ServeHTTP(rr, httptest.NewRequest(tc.method, tc.path, nil))
			if rr.Code != tc.status {
				t.Fatalf("status = %d; want %d; body = %s", rr.Code, tc.status, rr.Body)
			}
		})
	}
}
