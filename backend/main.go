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

	"github.com/dannybouy/clinic-apis/backend/api"
	"github.com/dannybouy/clinic-apis/backend/database"
	"github.com/joho/godotenv"
)

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

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	pool, err := database.Open(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		return err
	}
	defer pool.Close()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	frontendDir := os.Getenv("FRONTEND_DIST")
	if frontendDir == "" {
		frontendDir = "frontend/dist"
	}
	server := &http.Server{
		Addr:              net.JoinHostPort("", port),
		Handler:           api.NewHandler(pool, frontendDir),
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
