package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAPIKeyRejectsMissingAndWrongKeys(t *testing.T) {
	cfg := &apiConfig{apiKey: "clinic-key"}
	var reached bool
	handler := cfg.requireAPIKey(func(http.ResponseWriter, *http.Request) {
		reached = true
	})

	for _, key := range []string{"", "wrong"} {
		reached = false
		request := httptest.NewRequest(http.MethodGet, "/slots", nil)
		if key != "" {
			request.Header.Set("X-API-Key", key)
		}
		response := httptest.NewRecorder()
		handler(response, request)
		if response.Code != http.StatusUnauthorized {
			t.Fatalf("key %q: status = %d; want 401", key, response.Code)
		}
		if strings.TrimSpace(response.Body.String()) != `{"error":"invalid API key"}` {
			t.Fatalf("key %q: body = %s", key, response.Body.String())
		}
		if reached {
			t.Fatalf("key %q: handler ran", key)
		}
	}
}

func TestAPIKeyAcceptsTheConfiguredKey(t *testing.T) {
	cfg := &apiConfig{apiKey: "clinic-key"}
	handler := cfg.requireAPIKey(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodGet, "/slots", nil)
	request.Header.Set("X-API-Key", "clinic-key")
	response := httptest.NewRecorder()
	handler(response, request)
	if response.Code != http.StatusNoContent {
		t.Fatalf("status = %d; want 204", response.Code)
	}
}

func TestAPIConfigReturnsTheKey(t *testing.T) {
	cfg := &apiConfig{apiKey: "clinic-key"}
	response := httptest.NewRecorder()
	cfg.handlerAPIConfig(response, httptest.NewRequest(http.MethodGet, "/api/config", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d; want 200", response.Code)
	}
	if strings.TrimSpace(response.Body.String()) != `{"apiKey":"clinic-key"}` {
		t.Fatalf("body = %s", response.Body.String())
	}
}
