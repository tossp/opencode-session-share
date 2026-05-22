package main

import (
	"log/slog"
	"os"
	"path/filepath"

	"github.com/tossp/opencode-session-share/assets"
	"github.com/tossp/opencode-session-share/internal/share"
	"github.com/tossp/opencode-session-share/internal/web"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	dataPath := getenv("DATA_PATH", "data/opencode-share.db")
	if err := os.MkdirAll(filepath.Dir(dataPath), 0o750); err != nil {
		logger.Error("create data directory", slog.Any("error", err), slog.String("path", filepath.Dir(dataPath)))
		os.Exit(1)
	}

	store, err := share.OpenStore(dataPath)
	if err != nil {
		logger.Error("open store", slog.Any("error", err), slog.String("path", dataPath))
		os.Exit(1)
	}
	defer func() {
		if closeErr := store.Close(); closeErr != nil {
			logger.Error("close store", slog.Any("error", closeErr))
		}
	}()

	server, err := web.NewServer(share.NewService(store), assets.FS, logger, web.Config{
		AdminPassword:        getenv("ADMIN_PASSWORD", ""),
		DefaultSharePassword: getenv("DEFAULT_SHARE_PASSWORD", ""),
	})
	if err != nil {
		logger.Error("create server", slog.Any("error", err))
		os.Exit(1)
	}

	addr := getenv("ADDR", ":3006")
	logger.Info("server listening", slog.String("addr", addr))
	if err := server.Echo().Start(addr); err != nil {
		logger.Error("serve", slog.Any("error", err), slog.String("addr", addr))
		os.Exit(1)
	}
}

func getenv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
