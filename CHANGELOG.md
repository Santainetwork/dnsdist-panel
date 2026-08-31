# Changelog

Semua perubahan penting pada project ini akan didokumentasikan di file ini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
dan project ini mengikuti [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-08-31

### Added
- Backend Go (Gin): auth token, dashboard, sync (Mode A), blacklist domain (Mode B), config, stats proxy, health, logs, manifest
- Storage SQLite (modernc.org/sqlite): daftar domain + settings
- Executor: integrasi `update-blacklist.sh`, `trust-builder`, `systemctl`
- Client API dnsdist :8083 (top-stats proxy)
- Frontend React + Vite + Tailwind + shadcn/ui (login, dashboard, blacklist, config, stats, system)
- Single binary via `go:embed` (`static.go` + Makefile)
- Systemd unit `dnsdist-panel.service`
