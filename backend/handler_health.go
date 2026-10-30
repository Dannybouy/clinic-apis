package main

import (
	"context"
	"net/http"
	"time"
)

func handlerReadiness(w http.ResponseWriter, r *http.Request) {
	respondWithJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (cfg *apiConfig) handlerDatabaseHealth(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	if err := cfg.pool.Ping(ctx); err != nil {
		respondWithJSON(w, http.StatusServiceUnavailable, map[string]string{
			"status": "unavailable", "database": "disconnected",
		})
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]string{
		"status": "ok", "database": "connected",
	})
}
