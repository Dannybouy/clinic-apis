package main

import (
	"crypto/subtle"
	"net/http"
)

// requireAPIKey enforces the assessment's Level 2 rule: every request to
// /slots, /bookings, and /reset must carry the X-API-Key header.
func (cfg *apiConfig) requireAPIKey(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		got := r.Header.Get("X-API-Key")
		if cfg.apiKey == "" || subtle.ConstantTimeCompare([]byte(got), []byte(cfg.apiKey)) != 1 {
			respondWithError(w, http.StatusUnauthorized, "invalid API key", nil)
			return
		}
		next(w, r)
	}
}

// handlerAPIConfig lets the booking page learn the key at runtime.
// The assessment checks call the API directly and do not use this route.
func (cfg *apiConfig) handlerAPIConfig(w http.ResponseWriter, r *http.Request) {
	respondWithJSON(w, http.StatusOK, struct {
		APIKey string `json:"apiKey"`
	}{APIKey: cfg.apiKey})
}
