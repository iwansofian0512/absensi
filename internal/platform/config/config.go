// Package config loads and validates process configuration once at startup.
// No .env file is loaded here: environment is supplied by the runtime (make,
// docker compose, systemd). This keeps production and CI behaviour identical.
package config

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"os"
)

// Config is the complete runtime configuration. Adding a field means adding it
// to .env.example and docs/generated/env.md (enforced by make env-check).
type Config struct {
	AppEnv      string
	HTTPAddr    string
	DatabaseURL string
	LogLevel    string
}

// Load reads environment variables and validates them. It returns the first
// error instead of silently falling back to unsafe defaults.
func Load() (Config, error) {
	appEnv := os.Getenv("APP_ENV")
	if appEnv == "" {
		appEnv = "development"
	}

	httpAddr := os.Getenv("HTTP_ADDR")
	if httpAddr == "" {
		httpAddr = ":8080"
	}

	databaseURL := os.Getenv("DATABASE_URL")

	logLevel := os.Getenv("LOG_LEVEL")
	if logLevel == "" {
		logLevel = "info"
	}

	cfg := Config{
		AppEnv:      appEnv,
		HTTPAddr:    httpAddr,
		DatabaseURL: databaseURL,
		LogLevel:    logLevel,
	}

	if err := cfg.validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func (c Config) validate() error {
	switch c.AppEnv {
	case "development", "test", "production":
	default:
		return fmt.Errorf("APP_ENV must be development, test, or production (got %q)", c.AppEnv)
	}

	switch c.LogLevel {
	case "debug", "info", "warn", "error":
	default:
		return fmt.Errorf("LOG_LEVEL must be debug, info, warn, or error (got %q)", c.LogLevel)
	}

	if _, _, err := net.SplitHostPort(c.HTTPAddr); err != nil {
		return fmt.Errorf("HTTP_ADDR must be host:port (got %q): %w", c.HTTPAddr, err)
	}

	if c.DatabaseURL == "" {
		return errors.New("DATABASE_URL is required")
	}
	u, err := url.Parse(c.DatabaseURL)
	if err != nil {
		return fmt.Errorf("DATABASE_URL is not a valid URL: %w", err)
	}
	if u.Scheme != "postgres" && u.Scheme != "postgresql" && u.Scheme != "pgx5" {
		return fmt.Errorf("DATABASE_URL must use postgres:// or postgresql:// (got scheme %q)", u.Scheme)
	}

	return nil
}
