package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Production reset sends the sample week (121 slots) from Render to Neon.
// Each insert used to be its own round trip, so a remote database blew the
// handler's 10s deadline and returned "could not create slot".
func TestResetLargeScheduleWithinDeadline(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}

	const gap = 100 * time.Millisecond
	var writes atomic.Int64
	config, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatal(err)
	}
	config.MaxConns = 1
	config.MinConns = 1
	config.ConnConfig.DialFunc = func(ctx context.Context, network, addr string) (net.Conn, error) {
		var dialer net.Dialer
		conn, err := dialer.DialContext(ctx, network, addr)
		if err != nil {
			return nil, err
		}
		return &latencyConn{Conn: conn, gap: gap, writes: &writes}, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if err := pool.Ping(ctx); err != nil {
		t.Fatal(err)
	}
	writes.Store(0)

	cfg := &apiConfig{pool: pool, limiter: newRateLimiter()}
	request := httptest.NewRequest(http.MethodPost, "/reset", bytes.NewReader(scheduleBody(t, 121)))
	response := httptest.NewRecorder()
	started := time.Now()
	cfg.handlerResetSlots(response, request)
	elapsed := time.Since(started)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d after %s (%d writes); body = %s", response.Code, elapsed.Round(time.Millisecond), writes.Load(), response.Body.String())
	}

	var count int
	var first time.Time
	if err := pool.QueryRow(context.Background(), `SELECT count(*), min(start_time) FROM slots`).Scan(&count, &first); err != nil {
		t.Fatal(err)
	}
	if count != 121 {
		t.Fatalf("stored slots = %d; want 121", count)
	}
	wantStart := time.Date(2026, 11, 2, 8, 0, 0, 0, time.UTC)
	if !first.Equal(wantStart) {
		t.Fatalf("first start = %s; want %s", first, wantStart)
	}
}

type latencyConn struct {
	net.Conn
	gap    time.Duration
	writes *atomic.Int64
}

func (c *latencyConn) Write(p []byte) (int, error) {
	c.writes.Add(1)
	time.Sleep(c.gap)
	return c.Conn.Write(p)
}

func TestResetRejectsConflictingSlots(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	cfg := &apiConfig{pool: pool, limiter: newRateLimiter()}

	start := time.Date(2026, 11, 2, 8, 0, 0, 0, time.UTC)
	cases := []struct {
		name string
		body string
		want string
	}{
		{
			name: "duplicate id",
			body: slotsJSON(t, []slotInput{
				{ID: "same", Provider: "Dr Ade Okafor", Start: start, End: start.Add(30 * time.Minute)},
				{ID: "same", Provider: "Dr Bisi Adeyemi", Start: start, End: start.Add(30 * time.Minute)},
			}),
			want: "a slot with this id already exists",
		},
		{
			name: "overlap",
			body: slotsJSON(t, []slotInput{
				{ID: "a", Provider: "Dr Ade Okafor", Start: start, End: start.Add(30 * time.Minute)},
				{ID: "b", Provider: "Dr Ade Okafor", Start: start.Add(15 * time.Minute), End: start.Add(45 * time.Minute)},
			}),
			want: "provider already has a slot overlapping this time",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			response := httptest.NewRecorder()
			cfg.handlerResetSlots(response, httptest.NewRequest(http.MethodPost, "/reset", strings.NewReader(tc.body)))
			if response.Code != http.StatusConflict {
				t.Fatalf("status = %d; body = %s", response.Code, response.Body.String())
			}
			if !strings.Contains(response.Body.String(), tc.want) {
				t.Fatalf("body = %s; want %q", response.Body.String(), tc.want)
			}
		})
	}
}

type slotInput struct {
	ID       string    `json:"id"`
	Provider string    `json:"provider"`
	Start    time.Time `json:"start"`
	End      time.Time `json:"end"`
}

func slotsJSON(t *testing.T, slots []slotInput) string {
	t.Helper()
	body, err := json.Marshal(map[string]any{"slots": slots})
	if err != nil {
		t.Fatal(err)
	}
	return string(body)
}

func scheduleBody(t *testing.T, n int) []byte {
	t.Helper()
	slots := make([]slotInput, n)
	start := time.Date(2026, 11, 2, 8, 0, 0, 0, time.UTC)
	for i := range slots {
		at := start.Add(time.Duration(i) * 30 * time.Minute)
		slots[i] = slotInput{
			ID:       fmt.Sprintf("ade-%03d", i),
			Provider: "Dr Ade Okafor",
			Start:    at,
			End:      at.Add(30 * time.Minute),
		}
	}
	return []byte(slotsJSON(t, slots))
}
