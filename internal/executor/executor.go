package executor

import (
	"bytes"
	"context"
	"os/exec"
	"strings"
	"time"
)

type Result struct {
	Output   string `json:"output"`
	Duration string `json:"duration"`
	OK       bool   `json:"ok"`
	Code     int    `json:"code"`
}

type Runner struct{ Timeout time.Duration }

func New() *Runner { return &Runner{Timeout: 5 * time.Minute} }

func (r *Runner) Run(ctx context.Context, name string, args ...string) (*Result, error) {
	cctx, cancel := context.WithTimeout(ctx, r.Timeout)
	defer cancel()
	cmd := exec.CommandContext(cctx, name, args...)
	var buf bytes.Buffer
	cmd.Stdout = &buf
	cmd.Stderr = &buf
	start := time.Now()
	err := cmd.Run()
	dur := time.Since(start).Round(time.Millisecond).String()
	res := &Result{Output: buf.String(), Duration: dur, OK: err == nil}
	if err != nil {
		res.Code = -1
		if ee, ok := err.(*exec.ExitError); ok {
			res.Code = ee.ExitCode()
		}
		res.Output = strings.TrimSpace(buf.String()) + "\n" + err.Error()
	} else {
		res.Code = 0
	}
	return res, err
}

func (r *Runner) RunScript(ctx context.Context, script string, args ...string) (*Result, error) {
	return r.Run(ctx, "bash", append([]string{script}, args...)...)
}
