package dnsdist

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Client struct {
	BaseURL string
	APIKey  string
	HTTP    *http.Client
}

func New(baseURL, apiKey string) *Client {
	return &Client{BaseURL: baseURL, APIKey: apiKey, HTTP: &http.Client{Timeout: 10 * time.Second}}
}

func (c *Client) Get(path string, out any) error {
	req, err := http.NewRequest(http.MethodGet, c.BaseURL+path, nil)
	if err != nil {
		return err
	}
	if c.APIKey != "" {
		req.Header.Set("X-API-Key", c.APIKey)
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("dnsdist unreachable: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("dnsdist http %d: %s", resp.StatusCode, string(body))
	}
	return json.Unmarshal(body, out)
}

func (c *Client) TopStats(n int) (map[string]any, error) {
	var out map[string]any
	err := c.Get(fmt.Sprintf("/api/v1/top-stats?n=%d", n), &out)
	return out, err
}

func (c *Client) TopQueries(n int) (map[string]any, error) {
	var out map[string]any
	err := c.Get(fmt.Sprintf("/api/v1/top-queries?n=%d", n), &out)
	return out, err
}

func (c *Client) TopBlocked(n int) (map[string]any, error) {
	var out map[string]any
	err := c.Get(fmt.Sprintf("/api/v1/top-blocked?n=%d", n), &out)
	return out, err
}

func (c *Client) TopASN(n int) (map[string]any, error) {
	var out map[string]any
	err := c.Get(fmt.Sprintf("/api/v1/top-asn?n=%d", n), &out)
	return out, err
}
