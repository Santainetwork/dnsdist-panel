import { useState, useEffect, useCallback } from "react";
import { Save, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getConfig, setConfig, type PanelConfig } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ConfigPage() {
  const [config, setConfigState] = useState<PanelConfig | null>(null);
  const [centralUrl, setCentralUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const c = await getConfig();
      setConfigState(c);
      setCentralUrl(c.node_conf || "");
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat konfigurasi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setConfig(centralUrl.trim());
      toast.success("Konfigurasi disimpan");
      fetchConfig();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !config) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Konfigurasi</h2>
          <p className="text-muted-foreground">
            Pengaturan node DNSDist dan koneksi central
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchConfig}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Current config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Konfigurasi Saat Ini</CardTitle>
          <CardDescription>Nilai dari file konfigurasi dnsdist</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Block Mode</span>
            <Badge variant="secondary">{config?.block_mode || "—"}</Badge>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Sinkhole</span>
            <span className="font-mono text-xs text-right">{config?.sinkhole || "—"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Node Config</span>
            <span className="font-mono text-xs text-right truncate max-w-[300px]">
              {config?.node_conf || "—"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Upstreams</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {config?.upstreams?.length ? (
                config.upstreams.map((u) => (
                  <Badge key={u} variant="secondary" className="font-mono">
                    {u}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Tidak ada upstream</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit central URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Central URL</CardTitle>
          <CardDescription>
            URL database central untuk sinkronisasi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="centralUrl">Central Database URL</Label>
              <Input
                id="centralUrl"
                placeholder="https://example.com/blacklist.db"
                value={centralUrl}
                onChange={(e) => setCentralUrl(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
