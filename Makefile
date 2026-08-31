.PHONY: all web build test clean install

all: build

# Build frontend (Vite + React)
web:
	cd web && npm install && npm run build

# Build single binary (embed frontend)
build: web
	go build -ldflags="-s -w" -o dnsdist-panel cmd/server/main.go

# Build without rebuilding frontend (reuse existing web/dist)
build-fast:
	go build -ldflags="-s -w" -o dnsdist-panel cmd/server/main.go

test:
	go vet ./...
	go test ./...

# Install binary + systemd unit
install: build
	install -m 0755 dnsdist-panel /usr/local/bin/dnsdist-panel
	install -m 0644 dnsdist-panel.service /etc/systemd/system/
	systemctl daemon-reload
	@echo "Panel terinstall. Jalankan: systemctl enable --now dnsdist-panel"

clean:
	rm -f dnsdist-panel
	rm -rf web/dist web/node_modules
