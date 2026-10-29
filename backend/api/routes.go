// Package api contains the app's HTTP endpoints.
package api

import (
	"context"
	"encoding/json"
	"net/http"
)

type Database interface {
	Ping(context.Context) error
}

func NewHandler(db Database, frontendDir string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /api/health", databaseHealth(db))
	mux.HandleFunc("/api/", notFound)
	// Keep assessment endpoints available at their specified paths in future levels.
	for _, path := range []string{"/slots", "/slots/", "/bookings", "/bookings/", "/reset"} {
		mux.HandleFunc(path, notFound)
	}
	mux.Handle("/", frontend(frontendDir))
	return mux
}

func notFound(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotFound, map[string]string{"error": "Endpoint not found"})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
