# syntax=docker/dockerfile:1

# ---- Go build -------------------------------------------------------------
FROM golang:1.24-alpine AS apibuild
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api \
 && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/migrate ./cmd/migrate

# ---- Web build ------------------------------------------------------------
FROM node:22-alpine AS webbuild
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /src/web

COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY web/ ./
RUN pnpm build

# ---- API runtime ----------------------------------------------------------
FROM alpine:3.21 AS api
RUN apk add --no-cache ca-certificates tzdata \
 && addgroup -S app \
 && adduser -S -G app -u 10001 app

WORKDIR /app
COPY --from=apibuild /out/api /app/api
COPY --from=apibuild /out/migrate /app/migrate

USER app
EXPOSE 8080
ENTRYPOINT ["/app/api"]

# ---- Static SPA runtime ---------------------------------------------------
# Caddy serves only static files here; the edge Caddy adds TLS, headers,
# body limits, and routes /api and /health to the API.
FROM caddy:2.9-alpine AS web
COPY --from=webbuild /src/web/dist /srv
COPY deploy/web.Caddyfile /etc/caddy/Caddyfile
EXPOSE 8080
