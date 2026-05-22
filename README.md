# opencode-session-share

[![CI](https://github.com/tossp/opencode-session-share/actions/workflows/ci.yml/badge.svg)](https://github.com/tossp/opencode-session-share/actions/workflows/ci.yml)

Self-hosted OpenCode session sharing service rewritten in Go.

## Features

- Echo HTTP API compatible with the reference implementation.
- Local pure-Go bbolt database; no PostgreSQL or external database service required.
- Embedded share page template and static frontend assets.
- Secret-based sync/delete authorization.
- Admin page for listing sessions and setting per-session view passwords.

## Run

```bash
go run ./cmd/server
```

## Docker

```bash
docker compose up -d
```

The container pulls `ghcr.io/tossp/opencode-session-share:latest`, listens on `http://localhost:3006`, and stores the bbolt database in the `opencode_share_data` volume at `/data/opencode-share.db`.

If you want to run the container as a non-root user, override it in Compose, for example with `user: "1000:1000"`, and ensure the mounted data directory is writable.

Optional environment variables for Compose:

```bash
ADMIN_PASSWORD=change-me DEFAULT_SHARE_PASSWORD=optional docker compose up -d
```

Environment variables:

- `ADDR`: listen address, defaults to `:3006`
- `DATA_PATH`: bbolt database path, defaults to `data/opencode-share.db`
- `ADMIN_PASSWORD`: Basic Auth password for `/admin` and `/api/admin/*`; admin is disabled when empty
- `DEFAULT_SHARE_PASSWORD`: optional default view password for shares without a custom password

## API

- `POST /api/share` with `{"sessionID":"..."}`
- `POST /api/share/:share_id/sync` with `{"secret":"...","data":[...]}`
- `GET /api/share/:share_id/data`
- `DELETE /api/share/:share_id` with `{"secret":"..."}`
- `GET /share/:share_id`

## Admin

Set `ADMIN_PASSWORD`, then open `/admin` to list sessions and set or clear each session's view password.

- If a session has a custom password, viewers must enter it before data loads.
- If a session has no custom password and `DEFAULT_SHARE_PASSWORD` is set, viewers must enter the default password.
- If both are empty, the session is public.

## Verify

```bash
go test ./...
go build ./cmd/server
```

## CI

GitHub Actions runs on pushes and pull requests:

- `golangci-lint`
- `gofumpt` / `goimports` formatting checks
- Go tests, race tests, and build
- `govulncheck` vulnerability scan
- Docker image build validation
- GHCR image publish on non-PR pushes
- CodeQL analysis
- Dependency review for pull requests
