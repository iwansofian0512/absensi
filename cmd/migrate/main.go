// Command migrate runs embedded SQL migrations. It is a separate process from
// the API: app start never changes the schema (see docs/plan/07-db-migration.md).
//
// Usage:
//
//	migrate up
//	migrate down N
//	migrate version
//	migrate force N
package main

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"

	"github.com/iwansofian0512/absensi/db"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "migrate:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return errors.New("DATABASE_URL is required")
	}
	if len(args) == 0 {
		return usageError("missing command")
	}

	m, err := newMigrator(databaseURL)
	if err != nil {
		return err
	}
	defer func() { _, _ = m.Close() }()

	switch args[0] {
	case "up":
		err = m.Up()
		if errors.Is(err, migrate.ErrNoChange) {
			fmt.Println("no change: already at latest version")
			return nil
		}
	case "down":
		n, parseErr := countArg(args, 1)
		if parseErr != nil {
			return parseErr
		}
		err = m.Steps(-n)
		if errors.Is(err, migrate.ErrNoChange) {
			fmt.Println("no change: already at version 0")
			return nil
		}
	case "version":
		return printVersion(m)
	case "force":
		n, parseErr := countArg(args, 1)
		if parseErr != nil {
			return parseErr
		}
		fmt.Printf("forcing version %d (use only after manual repair of a dirty state)\n", n)
		err = m.Force(n)
	default:
		return usageError(fmt.Sprintf("unknown command %q", args[0]))
	}

	if err != nil {
		return fmt.Errorf("%s: %w", args[0], err)
	}
	return printVersion(m)
}

func newMigrator(databaseURL string) (*migrate.Migrate, error) {
	source, err := iofs.New(db.Migrations, "migrations")
	if err != nil {
		return nil, fmt.Errorf("open embedded migrations: %w", err)
	}

	// The rest of the repo speaks postgres://; golang-migrate's pgx/v5 driver
	// registers itself as pgx5://. Translate only the scheme, keep credentials.
	u, err := url.Parse(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
	}
	switch u.Scheme {
	case "postgres", "postgresql":
		u.Scheme = "pgx5"
	}

	m, err := migrate.NewWithSourceInstance("iofs", source, u.String())
	if err != nil {
		return nil, fmt.Errorf("create migrator: %w", err)
	}
	return m, nil
}

func printVersion(m *migrate.Migrate) error {
	version, dirty, err := m.Version()
	if errors.Is(err, migrate.ErrNilVersion) {
		fmt.Println("version: none")
		fmt.Println("dirty: false")
		return nil
	}
	if err != nil {
		return fmt.Errorf("read version: %w", err)
	}
	fmt.Printf("version: %d\n", version)
	fmt.Printf("dirty: %t\n", dirty)
	return nil
}

func countArg(args []string, index int) (int, error) {
	if len(args) <= index {
		return 0, usageError("missing numeric argument")
	}
	n, err := strconv.Atoi(args[index])
	if err != nil || n < 0 {
		return 0, usageError(fmt.Sprintf("expected a non-negative integer, got %q", args[index]))
	}
	return n, nil
}

func usageError(msg string) error {
	return fmt.Errorf("%s\nusage: migrate up | down N | version | force N", msg)
}
