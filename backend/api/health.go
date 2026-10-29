package api

import (
	"context"
	"net/http"
	"time"
)

func databaseHealth(db Database) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()
		if err := db.Ping(ctx); err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{
				"status": "unavailable", "database": "disconnected",
			})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{
			"status": "ok", "database": "connected",
		})
	}
}
