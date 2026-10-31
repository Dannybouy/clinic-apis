package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/dannybouy/clinic-apis/backend/database"
	queries "github.com/dannybouy/clinic-apis/backend/internal/database"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

type apiConfig struct {
	pool    *pgxpool.Pool
	db      queries.Querier
	limiter *rateLimiter
	apiKey  string
}

func main() {
	if err := run(); err != nil {
		slog.Error(err.Error())
		os.Exit(1)
	}
}

func run() error {
	// Existing environment variables win, then .env.local, then .env.
	for _, file := range []string{".env.local", ".env"} {
		if err := godotenv.Load(file); err != nil && !errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("cannot load %s; check its format and permissions", file)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	frontendDir := os.Getenv("FRONTEND_DIST")
	if frontendDir == "" {
		frontendDir = "frontend/dist"
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	pool, err := database.Open(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		return err
	}
	defer pool.Close()

	apiKey := os.Getenv("API_KEY")
	if apiKey == "" {
		return errors.New("API_KEY is missing; choose a key and set it in the environment")
	}

	cfg := &apiConfig{
		pool:    pool,
		db:      queries.New(pool),
		limiter: newRateLimiter(),
		apiKey:  apiKey,
	}

	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", handlerReadiness)
	mux.HandleFunc("GET /api/health", cfg.handlerDatabaseHealth)
	mux.HandleFunc("GET /api/config", cfg.handlerAPIConfig)

	mux.HandleFunc("GET /slots", cfg.requireAPIKey(cfg.handlerListSlots))
	if os.Getenv("PLATFORM") == "dev" {
		mux.HandleFunc("POST /slots", cfg.requireAPIKey(cfg.handlerCreateSlot))
	}
	mux.HandleFunc("/slots", cfg.requireAPIKey(handlerSlotsMethodNotAllowed))
	mux.HandleFunc("POST /reset", cfg.requireAPIKey(cfg.handlerResetSlots))

	mux.HandleFunc("POST /bookings", cfg.requireAPIKey(cfg.handlerCreateBooking))
	mux.HandleFunc("GET /bookings", cfg.requireAPIKey(cfg.handlerListBookings))
	mux.HandleFunc("GET /bookings/{id}", cfg.requireAPIKey(cfg.handlerGetBookingByID))
	mux.HandleFunc("DELETE /bookings/{id}", cfg.requireAPIKey(cfg.handlerDeleteBookingByID))

	mux.HandleFunc("/api/", handlerNotFound)
	mux.HandleFunc("/slots/", cfg.requireAPIKey(handlerNotFound))
	mux.HandleFunc("/bookings", cfg.requireAPIKey(handlerNotFound))
	mux.HandleFunc("/bookings/", cfg.requireAPIKey(handlerNotFound))
	mux.HandleFunc("/reset", cfg.requireAPIKey(handlerNotFound))

	mux.Handle("/", handlerFrontend(frontendDir))

	server := &http.Server{
		Addr:              net.JoinHostPort("", port),
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      20 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	serverErrors := make(chan error, 1)
	go func() { serverErrors <- server.ListenAndServe() }()
	slog.Info("Clinic API starting", "port", port)

	select {
	case err := <-serverErrors:
		if !errors.Is(err, http.ErrServerClosed) {
			return errors.New("server could not start; check PORT and whether it is already in use")
		}
		return nil
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return server.Shutdown(shutdownCtx)
	}
}
