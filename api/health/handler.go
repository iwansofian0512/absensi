// Package health exposes liveness only. It intentionally does not touch the
// database: /health answers "is the process alive?", not "is every dependency
// healthy?" (readiness checks belong beside the API that needs them).
package health

import (
	"encoding/json"
	"net/http"
)

// Response is the JSON body returned by GET /health.
type Response struct {
	Status string `json:"status"`
}

// Handler serves GET /health.
type Handler struct{}

// NewHandler returns a health handler.
func NewHandler() *Handler {
	return &Handler{}
}

// ServeHTTP writes a small JSON response. Errors from Encode are ignored
// because the status line and headers have already been written.
func (h *Handler) ServeHTTP(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(Response{Status: "ok"})
}
