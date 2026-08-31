package store

import (
	"database/sql"
	"time"

	_ "modernc.org/sqlite"
)

type Store struct{ db *sql.DB }

type Domain struct {
	ID        int64  `json:"id"`
	Domain    string `json:"domain"`
	CreatedAt string `json:"created_at"`
}

func New(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)")
	if err != nil {
		return nil, err
	}
	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) migrate() error {
	_, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS domains (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			domain TEXT NOT NULL UNIQUE,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
		CREATE TABLE IF NOT EXISTS peers (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			url TEXT NOT NULL,
			token TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
		CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);
	`)
	return err
}

func (s *Store) DomainsList() ([]Domain, error) {
	rows, err := s.db.Query("SELECT id, domain, created_at FROM domains ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Domain
	for rows.Next() {
		var d Domain
		if err := rows.Scan(&d.ID, &d.Domain, &d.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, nil
}

func (s *Store) DomainsAdd(domain string) error {
	_, err := s.db.Exec("INSERT OR IGNORE INTO domains (domain) VALUES (?)", domain)
	return err
}

func (s *Store) DomainsDelete(domain string) error {
	_, err := s.db.Exec("DELETE FROM domains WHERE domain = ?", domain)
	return err
}

func (s *Store) DomainsImport(domains []string) (int, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return 0, err
	}
	stmt, err := tx.Prepare("INSERT OR IGNORE INTO domains (domain) VALUES (?)")
	if err != nil {
		tx.Rollback()
		return 0, err
	}
	defer stmt.Close()
	var n int
	for _, d := range domains {
		if r, e := stmt.Exec(d); e == nil {
			if a, _ := r.RowsAffected(); a > 0 {
				n++
			}
		}
	}
	return n, tx.Commit()
}

func (s *Store) DomainsCount() (int, error) {
	var n int
	err := s.db.QueryRow("SELECT COUNT(*) FROM domains").Scan(&n)
	return n, err
}

func (s *Store) Setting(key string) (string, error) {
	var v string
	err := s.db.QueryRow("SELECT value FROM settings WHERE key=?", key).Scan(&v)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return v, err
}

func (s *Store) SetSetting(key, value string) error {
	_, err := s.db.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)", key, value)
	return err
}

func SaveNow() string { return time.Now().UTC().Format(time.RFC3339) }

type Peer struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	URL       string `json:"url"`
	Token     string `json:"token,omitempty"`
	CreatedAt string `json:"created_at"`
}

func (s *Store) PeersList() ([]Peer, error) {
	rows, err := s.db.Query("SELECT id, name, url, token, created_at FROM peers ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Peer
	for rows.Next() {
		var p Peer
		if err := rows.Scan(&p.ID, &p.Name, &p.URL, &p.Token, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, nil
}

func (s *Store) PeerAdd(name, url, token string) error {
	_, err := s.db.Exec("INSERT OR IGNORE INTO peers (name, url, token) VALUES (?,?,?)", name, url, token)
	return err
}

func (s *Store) PeerDelete(name string) error {
	_, err := s.db.Exec("DELETE FROM peers WHERE name = ?", name)
	return err
}
