// Package httpserver owns the HTTP listener lifecycle and graceful shutdown.
package httpserver

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"
)

// Server wraps http.Server with explicit timeouts and a blocking Run method.
type Server struct {
	http   *http.Server
	logger *slog.Logger
}

// New builds a server. Timeouts are deliberately set: an API without
// ReadHeaderTimeout is a slowloris target.
func New(addr string, handler http.Handler, logger *slog.Logger) *Server {
	return &Server{
		http: &http.Server{
			Addr:              addr,
			Handler:           handler,
			ReadHeaderTimeout: 5 * time.Second,
			ReadTimeout:       15 * time.Second,
			WriteTimeout:      30 * time.Second,
			IdleTimeout:       60 * time.Second,
		},
		logger: logger,
	}
}

// Run listens until ctx is cancelled, then shuts down with a 10s deadline.
// It returns nil when shutdown completed, or the first server error.
func (s *Server) Run(ctx context.Context) error {
	errCh := make(chan error, 1)

	go func() {
		s.logger.Info("http server listening", "addr", s.http.Addr)
		if err := s.http.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		return fmt.Errorf("http server: %w", err)
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := s.http.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("graceful shutdown: %w", err)
		}
		s.logger.Info("http server stopped")
		return nil
	}
}
