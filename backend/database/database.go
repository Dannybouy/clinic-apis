// Package database owns the PostgreSQL connection used by the Go backend.
package database

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Open(ctx context.Context, connectionString string) (*pgxpool.Pool, error) {
	if connectionString == "" {
		return nil, errors.New("DATABASE_URL is missing; run neon deploy or configure .env.local")
	}
	config, err := pgxpool.ParseConfig(connectionString)
	if err != nil {
		return nil, errors.New("DATABASE_URL is invalid; copy the connection string from Neon")
	}
	// Keep a small pool and allow idle connections to close when Neon sleeps.
	config.MaxConns = 4
	config.MinConns = 0
	config.MaxConnIdleTime = time.Minute
	config.MaxConnLifetime = 30 * time.Minute
	config.ConnConfig.ConnectTimeout = 10 * time.Second
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, errors.New("database pool could not start")
	}
	checkCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	if err := pool.Ping(checkCtx); err != nil {
		pool.Close()
		// Driver errors can contain credentials, so do not print them.
		return nil, errors.New("database connection failed; check DATABASE_URL and network access")
	}
	return pool, nil
}
