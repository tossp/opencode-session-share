# AGENTS.md

## Overview

Self-hosted OpenCode session sharing service.

- Stack: Go + Echo + bbolt, no external DB
- Module: `github.com/tossp/opencode-session-share`
- Entrypoint: `cmd/server/main.go`

## High-value structure

- `cmd/server/main.go`: env vars → create data dir → open bbolt store → build Echo server
- `internal/share/`: domain logic and bbolt persistence
- `internal/web/`: HTTP routes, middleware, admin auth, HTTP/domain error mapping
- `assets/`: embedded templates and static files via `assets/assets.go`

## Commands

```bash
go run ./cmd/server
go test ./...
go test -race ./...
go build ./cmd/server
golangci-lint run
test -z "$(gofmt -l .)"
go vet ./...
go mod tidy && git diff --exit-code -- go.mod go.sum
```

## CI truth

CI in `.github/workflows/ci.yml` enforces this effective verification set:

1. `golangci-lint`
2. `gofmt -l .`
3. `go mod tidy` + diff check
4. `go vet ./...`
5. `go test ./...`
6. `go test -race ./...`
7. `go build ./cmd/server`
8. `govulncheck`

If you change Go code, at minimum match the relevant subset above.

## Repo conventions worth preserving

- User-facing error messages are Chinese.
- Domain errors are package sentinels in `internal/share/service.go`; HTTP mapping lives in `internal/web/server.go` via `serviceError()`.
- Share ID equals session ID; allowed chars are restricted in `validateSessionID()`.
- View password is read from `X-Share-Password` header, not query params.
- Admin auth is HTTP Basic Auth; username is ignored, only password is checked.
- Templates are plain string replacement, not `html/template`; share ID is escaped manually before injection.

## Testing patterns

- `internal/share/service_test.go` and `internal/web/server_test.go` create bbolt DBs under `t.TempDir()`.
- HTTP tests mock embedded assets with `testing/fstest.MapFS`; keep that pattern when adding server tests.
- HTTP tests set `request.Host = "example.com"` to assert generated share URLs.
- Existing tests specifically cover: duplicate share creation, sync replacement by `_key`, unsupported session ID chars, admin auth, default share password, header-only password access, and rejection of query-param passwords.

## Limits and middleware that affect changes

- Echo body limit is `2M` in `internal/web/server.go`.
- Share service limits in `internal/share/service.go`:
  - `MaxSessionIDLength = 512`
  - `MaxSyncItems = 10_000`
  - `MaxItemBytes = 1 << 20`
  - `MaxShareDataBytes = 32 << 20`

## Lint / safety gotchas

- `.golangci.yml` uses v2 config and enforces `gci`, `gofumpt`, `goimports`.
- `nolintlint` requires a specific linter name plus explanation.
- `govet` shadow checking is enabled.
- `_test.go` files are exempt from `errcheck`, `gosec`, and `noctx`.
- `internal/share/store.go` intentionally keeps `//nolint:gosec` on `json.Marshal(share)` because `Share.Secret` is required persisted app data.

## Operational gotchas

- `assets/assets.go` embeds `static` and `templates`; asset path changes must keep embed paths valid.
- `OpenStore()` uses bbolt with `Timeout: time.Second`; concurrent opens can fail quickly.
- `publicURL()` prefers `X-Forwarded-Proto` / `X-Forwarded-Host`; proxy-related changes should preserve that behavior.

## Environment

- `ADDR` default: `:3006`
- `DATA_PATH` default: `data/opencode-share.db`
- `ADMIN_PASSWORD`: enables `/admin` and `/api/admin/*`
- `DEFAULT_SHARE_PASSWORD`: fallback view password for shares without per-share password
