# DNSDist Panel

Web management panel untuk DNSDist Edge Node — single binary (Go + React + shadcn/ui + SQLite).

## Fitur

- 📊 **Dashboard**: status service, statistik query, DB info, tombol sync
- 🚫 **Blacklist**: kelola domain (Mode B, gen CDB via trust-builder) + sync central (Mode A)
- ⚙️ **Config**: block mode, sinkhole, upstreams, central URL, reload/restart service
- 📈 **Stats**: top queries, top blocked, top ASN (proxy dari dnsdist :8083)
- 🛡️ **System**: health check, log viewer

## Stack

| Komponen | Teknologi |
|----------|-----------|
| Backend | Go + Gin |
| Frontend | React + Vite + Tailwind + shadcn/ui |
| Storage | SQLite (modernc.org/sqlite, pure-Go) |
| Deploy | Single binary (go:embed frontend) |

## Build

```bash
# Build lengkap (frontend + backend → single binary)
make build

# Build backend saja (pakai web/dist yang sudah ada)
make build-fast

# Install ke /usr/local/bin + systemd
make install
```

## Run

```bash
# Env vars (default dalam kurung)
PANEL_ADDR=127.0.0.1:8084            # listen address
PANEL_DB=/var/lib/dnsdist/panel.db   # SQLite path
PANEL_USER=admin                     # login user
PANEL_PASS=trust-ng-admin            # login password — WAJIB ganti
DNSDIST_APIKEY=                      # API key dnsdist :8083 (opsional)

./dnsdist-panel
```

## API

Semua endpoint di bawah `/api`, auth via `Authorization: Bearer <token>` (dapat dari `POST /api/login`).

| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/api/login` | Login, dapat token |
| GET | `/api/dashboard` | Ringkasan status |
| GET | `/api/sync/status` | Mode + URL central + manifest |
| POST | `/api/sync?force=true` | Sync blacklist (Mode A) |
| GET/POST/DELETE | `/api/blacklist/domains` | Kelola domain (Mode B) |
| POST | `/api/blacklist/import` | Import daftar domain |
| POST | `/api/blacklist/build` | Build CDB via trust-builder |
| GET | `/api/config` | Baca konfigurasi dnsdist |
| POST | `/api/config` | Simpan central URL |
| POST | `/api/service/reload` `/api/service/restart` | Kontrol service |
| GET | `/api/stats/top-queries` `/top-blocked` `/top-asn` | Statistik |
| GET | `/api/health` | Health check |
| GET | `/api/logs?lines=100` | Log dnsdist |
| GET | `/api/manifest` | Manifest DB saat ini |

## Struktur

```
public/
├── cmd/server/          # entry point
├── internal/
│   ├── api/             # gin handlers
│   ├── dnsdist/         # client API dnsdist :8083
│   ├── executor/        # run update-blacklist.sh / trust-builder / systemctl
│   └── store/           # SQLite (domain list, settings)
├── web/                 # React + Vite + shadcn/ui
├── static.go            # go:embed frontend
├── Makefile
└── dnsdist-panel.service
```

## Roadmap

Lihat `docs/PANEL-PLAN.md` & `docs/CLUSTER-PLAN.md` di repo `dnsdist-edge`:
- Fase 1 ✅ MVP (dashboard + sync + top-stats)
- Fase 2 ⏳ Mode B (local CDB gen via trust-builder)
- Fase 3 ⏳ Config & sistem
- Fase 4 ⏳ Cluster (T1 central+mirror, hash-addressed CDB, token/OTP auth)
