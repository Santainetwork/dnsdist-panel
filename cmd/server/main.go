package main

import (
	"log"
	"os"

	"dnsdist-panel/internal/api"
	"dnsdist-panel/internal/store"
)

func main() {
	dbPath := os.Getenv("PANEL_DB")
	if dbPath == "" {
		dbPath = "/var/lib/dnsdist/panel.db"
	}
	st, err := store.New(dbPath)
	if err != nil {
		log.Fatalf("store: %v", err)
	}
	defer st.Close()

	addr := os.Getenv("PANEL_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8084"
	}
	srv := api.New(st, api.Config{
		Addr:          addr,
		User:          getenv("PANEL_USER", "admin"),
		Pass:          getenv("PANEL_PASS", "trust-ng-admin"),
		DBFile:        getenv("DB_FILE", "/var/lib/dnsdist/blacklist.db"),
		TrustBuilder:  "/usr/local/bin/trust-builder",
		UpdateScript:  "/usr/local/bin/update-blacklist.sh",
		HealthScript:  "/usr/local/bin/dnsdist-health.sh",
		DNSDistAPI:    "http://127.0.0.1:8083",
		DNSDistAPIKey: os.Getenv("DNSDIST_APIKEY"),
		CDBToken:      os.Getenv("CDB_TOKEN"),
	})
	if err := srv.Run(); err != nil {
		log.Fatalf("server: %v", err)
	}
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
