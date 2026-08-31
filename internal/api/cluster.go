package api

import (
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
)

// ClusterView returns node stats: peers, local manifest, sync mode.
func (s *Server) handleClusterView(c *gin.Context) {
	peers, _ := s.store.PeersList()
	c.JSON(200, gin.H{
		"local": gin.H{
			"hostname": hostname(),
			"manifest": readManifest(s.cfg.DBFile),
			"mode":     s.sourceMode(),
			"sync":     s.syncStatus(),
		},
		"peers": peers,
	})
}

func (s *Server) handlePeersList(c *gin.Context) {
	peers, err := s.store.PeersList()
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"peers": peers})
}

func (s *Server) handlePeerAdd(c *gin.Context) {
	var req struct {
		Name  string `json:"name"`
		URL   string `json:"url"`
		Token string `json:"token"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Name == "" || req.URL == "" {
		c.JSON(400, gin.H{"error": "name and url required"})
		return
	}
	if err := s.store.PeerAdd(req.Name, req.URL, req.Token); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

func (s *Server) handlePeerDelete(c *gin.Context) {
	if err := s.store.PeerDelete(c.Param("name")); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

// handlePeerProbe checks a peer's /cdb/healthz + manifest.
func (s *Server) handlePeerProbe(c *gin.Context) {
	var req struct {
		URL   string `json:"url"`
		Token string `json:"token"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.URL == "" {
		c.JSON(400, gin.H{"error": "url required"})
		return
	}
	client := &http.Client{Timeout: 5 * time.Second}

	// healthz
	reqH, _ := http.NewRequest("GET", req.URL+"/cdb/healthz", nil)
	reqH.Header.Set("X-CDB-Token", req.Token)
	resp, err := client.Do(reqH)
	health := false
	var healthBody string
	if err == nil {
		health = resp.StatusCode == 200
		body := make([]byte, 256)
		n, _ := resp.Body.Read(body)
		healthBody = string(body[:n])
		resp.Body.Close()
	}

	// manifest
	reqM, _ := http.NewRequest("GET", req.URL+"/cdb/manifest.json", nil)
	reqM.Header.Set("X-CDB-Token", req.Token)
	respM, errM := client.Do(reqM)
	var manifest any
	if errM == nil && respM.StatusCode == 200 {
		json.NewDecoder(respM.Body).Decode(&manifest)
		respM.Body.Close()
	}

	c.JSON(200, gin.H{"ok": true, "reachable": err == nil, "health": health, "health_body": healthBody, "manifest": manifest})
}

func hostname() string {
	h, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return h
}
