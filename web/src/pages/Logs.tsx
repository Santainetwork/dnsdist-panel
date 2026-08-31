import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import { getLogs } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Logs() {
  const [lines, setLines] = useState(200);
  const [logs, setLogs] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLogs(lines);
      setLogs(res.logs || "");
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat log");
    } finally {
      setLoading(false);
    }
  }, [lines]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const download = () => {
    const blob = new Blob([logs], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dnsdist.log";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Log DNSDist</h2>
          <p className="text-muted-foreground">Journal service dnsdist</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="lines">Baris</Label>
            <Input
              id="lines"
              type="number"
              min={10}
              max={500}
              value={lines}
              onChange={(e) => setLines(Number(e.target.value))}
              className="w-24"
            />
          </div>
          <Button variant="outline" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Muat
          </Button>
          <Button variant="outline" onClick={download} disabled={!logs}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Output</CardTitle>
          <CardDescription>{logs ? `${logs.split("\n").length} baris` : "Kosong"}</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-4 text-xs leading-relaxed">
            {logs || "Tidak ada log."}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
