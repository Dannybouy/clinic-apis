package main

import (
	"math"
	"sync"
	"time"
)

const (
	bookingAttemptLimit  = 5
	bookingAttemptWindow = time.Minute
)

// rateLimiter keeps a sliding window of attempt times per email.
type rateLimiter struct {
	mu        sync.Mutex
	attempts  map[string][]time.Time
	lastSweep time.Time
}

func newRateLimiter() *rateLimiter {
	return &rateLimiter{attempts: make(map[string][]time.Time)}
}

// allow records the attempt and returns 0, or returns the whole seconds to wait.
func (rl *rateLimiter) allow(email string, now time.Time) (retryAfter int) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	cutoff := now.Add(-bookingAttemptWindow)

	// Emails that stop sending attempts would otherwise stay in the map forever.
	if now.Sub(rl.lastSweep) >= bookingAttemptWindow {
		for key, times := range rl.attempts {
			if !times[len(times)-1].After(cutoff) {
				delete(rl.attempts, key)
			}
		}
		rl.lastSweep = now
	}

	recent := rl.attempts[email]
	i := 0
	for i < len(recent) && !recent[i].After(cutoff) {
		i++
	}
	recent = recent[i:]

	if len(recent) >= bookingAttemptLimit {
		rl.attempts[email] = recent
		wait := recent[0].Add(bookingAttemptWindow).Sub(now)
		return max(1, int(math.Ceil(wait.Seconds())))
	}

	rl.attempts[email] = append(recent, now)
	return 0
}

func (rl *rateLimiter) reset() {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	rl.attempts = make(map[string][]time.Time)
}
