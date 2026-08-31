# AGENTS.md — DNSDist Panel

Panduan untuk AI agents yang bekerja di repositori ini.

## Apa ini

Web management panel (single binary) untuk DNSDist Edge Node.
Backend Go (gin) + frontend React/Vite/shadcn/ui, SQLite, frontend di-embed via `go:embed`.

## Perintah penting

```bash
# Build lengkap (frontend + backend → single binary)
make build

# Backend saja (pakai web/dist yang sudah ada)
make build-fast

# Verifikasi lokal (CI yang sama)
gofmt -l . | grep -v '^web/'        # harus kosong
go vet ./...
go build ./...

# Test manual
PANEL_DB=/tmp/panel.db PANEL_ADDR=127.0.0.1:18084 ./dnsdist-panel &
curl -X POST http://127.0.0.1:18084/api/login -H 'Content-Type: application/json' \
  -d '{"user":"admin","pass":"trust-ng-admin"}'
```

## Batasan Go / toolchain (PENTING)

- Mesin dev ini punya **Go 1.22.5**. `go.mod` PIN `go 1.22.0`.
- **Jangan** `go get ...@latest` — dependency terbaru butuh Go 1.25 dan merusak build.
- Selalu pakai `GOTOOLCHAIN=local go build ./...` untuk build lokal.
- Jika harus tambah versi dep, pilih versi kompatibel Go 1.22 (gin v1.10.0, sqlite v1.34.4).

## Struktur

```
cmd/server/          # entry point (env vars, config)
internal/api/        # gin handlers (auth, dashboard, sync, blacklist, config, stats, health, logs, manifest)
internal/dnsdist/    # client API dnsdist :8083 (top-stats proxy)
internal/executor/   # run update-blacklist.sh / trust-builder / systemctl (whitelisted only)
internal/store/      # SQLite (domain list, settings)
web/                 # React + Vite + Tailwind + shadcn/ui (src/ hanya source; dist/ di-embed)
static.go            # //go:embed all:web/dist + SPA fallback handler
Makefile             # build / build-fast / install / clean
dnsdist-panel.service
```

## Konvensi

- `static.go` ada di root (package `static`), diimpor sebagai `"dnsdist-panel"` (module root, BUKAN `dnsdist-panel/static`).
- `web/dist/` di-ignore git; harus `npm run build` sebelum `go build` untuk embed asli.
- Semua path file di `internal/api/` (DB, scripts) ada di `Config` — jangan hardcode di handler.
- Executor HANYA menjalankan daftar perintah tetap (trust-builder, update-blacklist.sh, systemctl, journalctl, dnsdist-health.sh) — jangan tambah input bebas ke shell.
- Perubahan backend wajib `go vet` + `go build` + smoke test login (CI menjalankan ini).

## API contract (single source of truth: web/src/lib/api.ts)

| Method | Path | Fungsi |
|--------|------|--------|
| POST | /api/login | login → token |
| GET | /api/dashboard | ringkasan |
| POST | /api/sync?force=true | sync Mode A (update-blacklist.sh) |
| GET/POST/DELETE | /api/blacklist/domains | Mode B list/add/delete |
| POST | /api/blacklist/import | import daftar |
| POST | /api/blacklist/build | build CDB (trust-builder) |
| GET/POST | /api/config | baca/simpan config |
| POST | /api/service/reload\|restart | kontrol service |
| GET | /api/stats/top-queries\|top-blocked\|top-asn | statistik |
| GET | /api/health, /api/logs, /api/manifest | health/log/manifest |

Auth: `Authorization: Bearer <token>` atau `X-API-Key` — 401 → frontend redirect /login.

## Env vars runtime

```bash
PANEL_ADDR=127.0.0.1:8084
PANEL_DB=/var/lib/dnsdist/panel.db
PANEL_USER=admin
PANEL_PASS=trust-ng-admin   # WAJIB diganti di production
DNSDIST_APIKEY=
```

## Roadmap (dari plan)

- Fase 1 MVP ✅ (dashboard + sync + stats)
- Fase 2 Mode B ✅ (local CDB via trust-builder)
- Fase 3 config & sistem ✅
- Fase 4 cluster (T1 central+mirror, hash-addressed CDB, token/OTP) — belum
