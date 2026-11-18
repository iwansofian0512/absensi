// Package logger builds the structured logger used by every process.
package logger

import (
	"log/slog"
	"os"
	"strings"
)

// New returns a JSON logger at the requested level. JSON is intentional: the
// VPS ships logs to a file and structured lines are cheap to grep and forward.
func New(level string) *slog.Logger {
	var l slog.Level
	switch strings.ToLower(level) {
	case "debug":
		l = slog.LevelDebug
	case "warn":
		l = slog.LevelWarn
	case "error":
		l = slog.LevelError
	default:
		l = slog.LevelInfo
	}

	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: l})
	return slog.New(handler)
}
