package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"dnsdist-panel"
	"dnsdist-panel/internal/dnsdist"
	"dnsdist-panel/internal/executor"
	"dnsdist-panel/internal/store"
)

type Config struct {
	Addr          string
	User          string
	Pass          string
	DBFile        string
	TrustBuilder  string
	UpdateScript  string
	HealthScript  string
	DNSDistAPI    string
	DNSDistAPIKey string
	CDBToken      string
}

type Server struct {
	cfg    Config
	store  *store.Store
	exec   *executor.Runner
	dd     *dnsdist.Client
	tokens map[string]time.Time
}

func New(st *store.Store, cfg Config) *Server {
	return &Server{
		cfg:    cfg,
		store:  st,
		exec:   executor.New(),
		dd:     dnsdist.New(cfg.DNSDistAPI, cfg.DNSDistAPIKey),
		tokens: make(map[string]time.Time),
	}
}

func (s *Server) Run() error {
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	api := r.Group("/api")
	api.POST("/login", s.handleLogin)

	auth := api.Group("")
	auth.Use(s.authMiddleware())
	auth.GET("/dashboard", s.handleDashboard)
	auth.GET("/sync/status", s.handleSyncStatus)
	auth.POST("/sync", s.handleSync)
	auth.GET("/blacklist/domains", s.handleDomainsList)
	auth.POST("/blacklist/domains", s.handleDomainAdd)
	auth.DELETE("/blacklist/domains/:domain", s.handleDomainDelete)
	auth.POST("/blacklist/import", s.handleDomainImport)
	auth.POST("/blacklist/build", s.handleBlacklistBuild)
	auth.GET("/blacklist/status", s.handleBlacklistStatus)
	auth.GET("/config", s.handleGetConfig)
	auth.POST("/config", s.handleSetConfig)
	auth.POST("/service/reload", s.handleServiceReload)
	auth.POST("/service/restart", s.handleServiceRestart)
	auth.GET("/stats/top-queries", s.handleTopQueries)
	auth.GET("/stats/top-blocked", s.handleTopBlocked)
	auth.GET("/stats/top-asn", s.handleTopASN)
	auth.GET("/health", s.handleHealth)
	auth.GET("/logs", s.handleLogs)
	auth.GET("/manifest", s.handleManifest)

	// Serve embedded frontend SPA; fallback to index.html for client routes.
	r.NoRoute(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.JSON(404, gin.H{"error": "not found"})
			return
		}
		static.Handler().ServeHTTP(c.Writer, c.Request)
	})

	s.setupCDBRoutes(r)

	return r.Run(s.cfg.Addr)
}

// --- Auth ---

func (s *Server) handleLogin(c *gin.Context) {
	var req struct {
		User string `json:"user"`
		Pass string `json:"pass"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "bad request"})
		return
	}
	if req.User != s.cfg.User || req.Pass != s.cfg.Pass {
		c.JSON(401, gin.H{"error": "invalid credentials"})
		return
	}
	tok := make([]byte, 32)
	rand.Read(tok)
	token := hex.EncodeToString(tok)
	s.tokens[token] = time.Now().Add(24 * time.Hour)
	c.JSON(200, gin.H{"token": token, "expires_in": 86400})
}

func (s *Server) authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer ")
		if token == "" {
			token = c.GetHeader("X-API-Key")
		}
		exp, ok := s.tokens[token]
		if !ok || time.Now().After(exp) {
			c.JSON(401, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// --- Dashboard ---

func (s *Server) handleDashboard(c *gin.Context) {
	stats, _ := s.dd.TopStats(10)
	domCount, _ := s.store.DomainsCount()
	c.JSON(200, gin.H{
		"service_active": s.serviceActive(),
		"dnsdist_api":    stats != nil,
		"stats":          stats,
		"domains_count":  domCount,
		"db":             s.dbInfo(),
		"sync":           s.syncStatus(),
		"config":         s.readConfig(),
		"build_version":  "0.1.0",
		"trust_builder":  fileExists(s.cfg.TrustBuilder),
		"update_script":  fileExists(s.cfg.UpdateScript),
		"health_script":  fileExists(s.cfg.HealthScript),
	})
}

// --- Sync (Mode A) ---

func (s *Server) handleSyncStatus(c *gin.Context) { c.JSON(200, s.syncStatus()) }

func (s *Server) syncStatus() gin.H {
	status := gin.H{
		"mode":        s.sourceMode(),
		"central_url": readFirstLine("/etc/dnsdist/node.conf", "SAVED_CENTRAL_DB_URL="),
	}
	if m := readManifest(s.cfg.DBFile); m != nil {
		status["manifest"] = m
	}
	return status
}

func (s *Server) handleSync(c *gin.Context) {
	if !fileExists(s.cfg.UpdateScript) {
		c.JSON(400, gin.H{"error": "update-blacklist.sh not found"})
		return
	}
	args := []string{}
	if c.Query("force") == "true" {
		args = append(args, "--force-update")
	}
	res, err := s.exec.RunScript(c.Request.Context(), s.cfg.UpdateScript, args...)
	if err != nil {
		c.JSON(500, gin.H{"error": "sync failed", "result": res})
		return
	}
	c.JSON(200, gin.H{"ok": true, "result": res})
}

// --- Blacklist (Mode B) ---

func (s *Server) handleDomainsList(c *gin.Context) {
	domains, err := s.store.DomainsList()
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"domains": domains, "count": len(domains)})
}

func (s *Server) handleDomainAdd(c *gin.Context) {
	var req struct {
		Domain string `json:"domain"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Domain == "" {
		c.JSON(400, gin.H{"error": "domain required"})
		return
	}
	if err := s.store.DomainsAdd(strings.ToLower(strings.TrimSpace(req.Domain))); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

func (s *Server) handleDomainDelete(c *gin.Context) {
	d := strings.TrimSuffix(c.Param("domain"), ".")
	if err := s.store.DomainsDelete(strings.ToLower(d)); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

func (s *Server) handleDomainImport(c *gin.Context) {
	var req struct {
		Domains []string `json:"domains"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "domains list required"})
		return
	}
	var clean []string
	for _, d := range req.Domains {
		d = strings.ToLower(strings.TrimSpace(strings.TrimSuffix(d, ".")))
		if d != "" {
			clean = append(clean, d)
		}
	}
	n, err := s.store.DomainsImport(clean)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"ok": true, "imported": n})
}

func (s *Server) handleBlacklistBuild(c *gin.Context) {
	if !fileExists(s.cfg.TrustBuilder) {
		c.JSON(400, gin.H{"error": "trust-builder binary not found"})
		return
	}
	domains, err := s.store.DomainsList()
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	if len(domains) == 0 {
		c.JSON(400, gin.H{"error": "no domains in list"})
		return
	}
	tmp := s.cfg.DBFile + ".src"
	var sb strings.Builder
	for _, d := range domains {
		sb.WriteString(d.Domain)
		sb.WriteByte('\n')
	}
	if err := os.WriteFile(tmp, []byte(sb.String()), 0644); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	defer os.Remove(tmp)

	res, err := s.exec.Run(c.Request.Context(), s.cfg.TrustBuilder, "-o", s.cfg.DBFile, tmp)
	if err != nil {
		c.JSON(500, gin.H{"error": "build failed", "result": res})
		return
	}
	writeManifest(s.cfg.DBFile, "local")
	c.JSON(200, gin.H{"ok": true, "result": res})
}

func (s *Server) handleBlacklistStatus(c *gin.Context) { c.JSON(200, s.dbInfo()) }

// --- Config ---

func (s *Server) readConfig() gin.H {
	return gin.H{
		"block_mode": readFirstLine("/etc/dnsdist/dnsdist.conf", "BLOCK_MODE = '"),
		"sinkhole":   readFirstLine("/etc/dnsdist/dnsdist.conf", "SINKHOLE_IPS = {"),
		"upstreams":  readUpstreams("/etc/dnsdist/upstreams.conf"),
		"node_conf":  readFirstLine("/etc/dnsdist/node.conf", "SAVED_CENTRAL_DB_URL="),
	}
}

func (s *Server) handleGetConfig(c *gin.Context) { c.JSON(200, s.readConfig()) }

func (s *Server) handleSetConfig(c *gin.Context) {
	var req struct {
		CentralURL string `json:"central_url"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "bad request"})
		return
	}
	if req.CentralURL != "" {
		if err := updateNodeConf("SAVED_CENTRAL_DB_URL", req.CentralURL); err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
	}
	c.JSON(200, gin.H{"ok": true})
}

// --- Service control ---

func (s *Server) handleServiceReload(c *gin.Context) {
	res, err := s.exec.Run(c.Request.Context(), "systemctl", "reload", "dnsdist")
	if err != nil {
		c.JSON(500, gin.H{"error": "reload failed", "result": res})
		return
	}
	c.JSON(200, gin.H{"ok": true, "result": res})
}

func (s *Server) handleServiceRestart(c *gin.Context) {
	res, err := s.exec.Run(c.Request.Context(), "systemctl", "restart", "dnsdist")
	if err != nil {
		c.JSON(500, gin.H{"error": "restart failed", "result": res})
		return
	}
	c.JSON(200, gin.H{"ok": true, "result": res})
}

// --- Stats proxy ---

func (s *Server) handleTopQueries(c *gin.Context) {
	out, err := s.dd.TopQueries(atoiDefault(c.Query("n"), 20))
	if err != nil {
		c.JSON(502, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, out)
}

func (s *Server) handleTopBlocked(c *gin.Context) {
	out, err := s.dd.TopBlocked(atoiDefault(c.Query("n"), 20))
	if err != nil {
		c.JSON(502, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, out)
}

func (s *Server) handleTopASN(c *gin.Context) {
	out, err := s.dd.TopASN(atoiDefault(c.Query("n"), 20))
	if err != nil {
		c.JSON(502, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, out)
}

// --- Health & Logs ---

func (s *Server) handleHealth(c *gin.Context) {
	if !fileExists(s.cfg.HealthScript) {
		c.JSON(400, gin.H{"error": "dnsdist-health.sh not found"})
		return
	}
	res, err := s.exec.RunScript(c.Request.Context(), s.cfg.HealthScript)
	c.JSON(200, gin.H{"result": res, "script_error": err != nil})
}

func (s *Server) handleLogs(c *gin.Context) {
	lines := atoiDefault(c.Query("lines"), 100)
	if lines > 500 {
		lines = 500
	}
	res, err := s.exec.Run(c.Request.Context(), "journalctl", "-u", "dnsdist", "-n", strconv.Itoa(lines), "--no-pager")
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error(), "result": res})
		return
	}
	c.JSON(200, gin.H{"logs": res.Output})
}

// --- Manifest ---

func (s *Server) handleManifest(c *gin.Context) {
	m := readManifest(s.cfg.DBFile)
	if m == nil {
		c.JSON(404, gin.H{"error": "no manifest"})
		return
	}
	c.JSON(200, m)
}

// --- Helpers ---

func (s *Server) serviceActive() bool {
	res, err := s.exec.Run(context.Background(), "systemctl", "is-active", "dnsdist")
	return err == nil && strings.TrimSpace(res.Output) == "active"
}

func (s *Server) sourceMode() string {
	if m := readManifest(s.cfg.DBFile); m != nil {
		if src, _ := m["source"].(string); src != "" {
			return src
		}
	}
	return "central"
}

func (s *Server) dbInfo() gin.H {
	fi, err := os.Stat(s.cfg.DBFile)
	if err != nil {
		return gin.H{"exists": false, "error": err.Error()}
	}
	return gin.H{
		"exists":   true,
		"size":     fi.Size(),
		"mod_time": fi.ModTime().UTC().Format(time.RFC3339),
	}
}

func atoiDefault(s string, def int) int {
	if v, err := strconv.Atoi(s); err == nil && v > 0 {
		return v
	}
	return def
}

func fileExists(p string) bool {
	_, err := os.Stat(p)
	return err == nil
}
