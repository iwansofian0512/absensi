// Package db owns the embedded SQL migration files.
//
// The embed directive must live next to the migrations directory: Go does not
// allow //go:embed to reference a parent directory (../../db is illegal).
package db

import "embed"

// Migrations is the migration filesystem consumed by cmd/migrate via iofs.
//
//go:embed migrations/*.sql
var Migrations embed.FS
