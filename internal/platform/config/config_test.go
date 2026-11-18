package config

import "testing"

func TestLoadDefaults(t *testing.T) {
	t.Setenv("APP_ENV", "")
	t.Setenv("HTTP_ADDR", "")
	t.Setenv("LOG_LEVEL", "")
	t.Setenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/absensi?sslmode=disable")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.AppEnv != "development" {
		t.Errorf("AppEnv = %q, want development", cfg.AppEnv)
	}
	if cfg.HTTPAddr != ":8080" {
		t.Errorf("HTTPAddr = %q, want :8080", cfg.HTTPAddr)
	}
	if cfg.LogLevel != "info" {
		t.Errorf("LogLevel = %q, want info", cfg.LogLevel)
	}
}

func TestLoadRequiresDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "")

	if _, err := Load(); err == nil {
		t.Fatal("Load() error = nil, want error for missing DATABASE_URL")
	}
}

func TestLoadRejectsInvalidValues(t *testing.T) {
	tests := []struct {
		name  string
		key   string
		value string
	}{
		{name: "app env", key: "APP_ENV", value: "staging"},
		{name: "log level", key: "LOG_LEVEL", value: "verbose"},
		{name: "http addr", key: "HTTP_ADDR", value: "8080"},
		{name: "database scheme", key: "DATABASE_URL", value: "mysql://localhost/absensi"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("APP_ENV", "development")
			t.Setenv("HTTP_ADDR", ":8080")
			t.Setenv("LOG_LEVEL", "info")
			t.Setenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/absensi?sslmode=disable")
			t.Setenv(tt.key, tt.value)

			if _, err := Load(); err == nil {
				t.Fatalf("Load() error = nil, want error for %s=%q", tt.key, tt.value)
			}
		})
	}
}
