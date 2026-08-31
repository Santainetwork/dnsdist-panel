package static

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed all:web/dist
var distFS embed.FS

// Handler serves the embedded frontend SPA.
func Handler() http.Handler {
	sub, err := fs.Sub(distFS, "web/dist")
	if err != nil {
		panic(err)
	}
	return http.FileServer(http.FS(sub))
}
