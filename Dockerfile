FROM node:22-alpine AS frontend-builder

WORKDIR /src

RUN corepack enable

COPY pnpm-lock.yaml ./
COPY frontend ./frontend

RUN pnpm --dir frontend install --frozen-lockfile
RUN pnpm --dir frontend build

FROM golang:1.26-alpine AS builder

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

COPY --from=frontend-builder /src/assets/static ./assets/static

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/opencode-share ./cmd/server

FROM alpine:3.22

WORKDIR /app

COPY --from=builder /out/opencode-share /app/opencode-share

ENV ADDR=:3006
ENV DATA_PATH=/data/opencode-share.db

RUN mkdir -p /data

EXPOSE 3006
VOLUME ["/data"]

CMD ["/app/opencode-share"]
