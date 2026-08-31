package api

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"strings"
)

func readManifest(dbFile string) map[string]any {
	data, err := os.ReadFile(dbFile + ".manifest.json")
	if err != nil {
		return nil
	}
	var m map[string]any
	if json.Unmarshal(data, &m) != nil {
		return nil
	}
	return m
}

func writeManifest(dbFile, source string) {
	fi, err := os.Stat(dbFile)
	if err != nil {
		return
	}
	m := map[string]any{
		"size":     fi.Size(),
		"built_at": fi.ModTime().UTC().Format("2006-01-02T15:04:05Z"),
		"source":   source,
	}
	if h, err := hashFile(dbFile); err == nil {
		m["sha256"] = h
		m["version"] = 1
		if old := readManifest(dbFile); old != nil {
			if v, ok := old["version"].(float64); ok {
				m["version"] = int(v) + 1
			}
		}
	}
	data, _ := json.MarshalIndent(m, "", "  ")
	os.WriteFile(dbFile+".manifest.json", data, 0644)
}

func hashFile(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:]), nil
}

func readFirstLine(path, prefix string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, prefix) {
			v := strings.TrimPrefix(line, prefix)
			v = strings.Trim(v, "'\" ")
			return v
		}
	}
	return ""
}

func readUpstreams(path string) []string {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var out []string
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "newServer(") {
			continue
		}
		if i := strings.Index(line, "address = '"); i >= 0 {
			rest := line[i+len("address = '"):]
			if j := strings.Index(rest, "'"); j >= 0 {
				out = append(out, rest[:j])
			}
		}
	}
	return out
}

func updateNodeConf(key, value string) error {
	path := "/etc/dnsdist/node.conf"
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	lines := strings.Split(string(data), "\n")
	found := false
	for i, line := range lines {
		if strings.HasPrefix(strings.TrimSpace(line), key+"=") {
			lines[i] = key + "=\"" + value + "\""
			found = true
			break
		}
	}
	if !found {
		lines = append(lines, key+"=\""+value+"\"")
	}
	return os.WriteFile(path, []byte(strings.Join(lines, "\n")), 0644)
}
