package api

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

// cdbAuth checks X-CDB-Token if a peer token is configured.
func (s *Server) cdbAuth(c *gin.Context) {
	if s.cfg.CDBToken == "" {
		c.Next() // no token configured — trust network
		return
	}
	if c.GetHeader("X-CDB-Token") != s.cfg.CDBToken {
		c.JSON(401, gin.H{"error": "invalid cdb token"})
		c.Abort()
		return
	}
	c.Next()
}

// setupCDBRoutes mounts the /cdb publisher endpoints (cluster Phase 3).
// Served WITHOUT panel auth so peer nodes can pull via HTTP.
func (s *Server) setupCDBRoutes(r *gin.Engine) {
	cdb := r.Group("/cdb")
	cdb.Use(s.cdbAuth)

	cdb.GET("/healthz", func(c *gin.Context) {
		if fi, err := os.Stat(s.cfg.DBFile); err == nil && fi.Size() > 0 {
			c.JSON(200, gin.H{"status": "ok", "size": fi.Size()})
			return
		}
		c.JSON(500, gin.H{"status": "unhealthy"})
	})

	cdb.GET("/manifest.json", s.cdbManifest)

	// /cdb/blacklist.db — current DB (resolves symlink)
	cdb.GET("/blacklist.db", func(c *gin.Context) {
		s.cdbServe(c, s.cfg.DBFile)
	})

	// /cdb/blacklist.<sha>.db — immutable versioned file
	cdb.GET("/blacklist.:sha.db", func(c *gin.Context) {
		sha := c.Param("sha")
		if !isHex(sha, 64) {
			c.JSON(400, gin.H{"error": "invalid sha"})
			return
		}
		s.cdbServe(c, filepath.Join(filepath.Dir(s.cfg.DBFile), "blacklist."+sha+".db"))
	})
}

func (s *Server) cdbManifest(c *gin.Context) {
	m := readManifest(s.cfg.DBFile)
	if m == nil {
		c.JSON(404, gin.H{"error": "no manifest"})
		return
	}
	c.JSON(200, m)
}

func (s *Server) cdbServe(c *gin.Context, path string) {
	if _, err := os.Stat(path); err != nil {
		c.JSON(404, gin.H{"error": "db not found"})
		return
	}
	c.File(path)
}

func isHex(s string, n int) bool {
	if len(s) != n {
		return false
	}
	for _, ch := range s {
		if !strings.ContainsRune("0123456789abcdef", ch) {
			return false
		}
	}
	return true
}
