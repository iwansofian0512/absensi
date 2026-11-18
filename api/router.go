// Package api wires HTTP routes. It stays thin: handlers delegate to domain
// services, which are introduced in later slices (S0+).
package api

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

// NewRouter builds the bootstrap router. Only /health is public today; every
// future endpoint must declare its own authorization (deny by default).
func NewRouter(health http.Handler) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	r.Get("/health", health.ServeHTTP)
	return r
}
