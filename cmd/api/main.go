package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/iwansofian0512/absensi/api"
	"github.com/iwansofian0512/absensi/api/health"
	"github.com/iwansofian0512/absensi/internal/platform/config"
	"github.com/iwansofian0512/absensi/internal/platform/db"
	"github.com/iwansofian0512/absensi/internal/platform/httpserver"
	"github.com/iwansofian0512/absensi/internal/platform/logger"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "fatal:", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	log := logger.New(cfg.LogLevel)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	defer pool.Close()

	router := api.NewRouter(health.NewHandler())
	srv := httpserver.New(cfg.HTTPAddr, router, log)

	log.Info("api starting", "env", cfg.AppEnv, "addr", cfg.HTTPAddr)
	return srv.Run(ctx)
}
