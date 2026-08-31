import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Power,
  RotateCcw,
  Database,
  Globe,
  Activity,
  HardDrive,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  getDashboard,
  serviceReload,
  serviceRestart,
  syncNow,
  formatBytes,
  type DashboardData,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  variant,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | React.ReactNode;
  sub?: string;
  variant?: "success" | "warning" | "destructive" | "default";
}) {
  const badgeVariant = variant || "default";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {typeof value === "string" ? (
            <Badge variant={badgeVariant as any}>{value}</Badge>
          ) : (
            value
          )}
        </div>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"reload" | "restart" | "sync" | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const d = await getDashboard();
      setData(d);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAction = async (action: "reload" | "restart") => {
    try {
      const res = action === "reload" ? await serviceReload() : await serviceRestart();
      if (res.ok) {
        toast.success(
          `Service ${action === "reload" ? "reload" : "restart"} berhasil`
        );
      } else {
        toast.error(`Gagal: ${res.result?.output || "unknown"}`);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setConfirmAction(null);
    }
  };

  const handleSync = async () => {
    setSyncLoading(true);
    try {
      const res = await syncNow(false);
      if (res.ok) {
        toast.success("Sinkronisasi berhasil");
      } else {
        toast.error("Sinkronisasi gagal");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncLoading(false);
      setConfirmAction(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Status dan kontrol server DNSDist
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={syncLoading}
            onClick={() => setConfirmAction("sync")}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${syncLoading ? "animate-spin" : ""}`}
            />
            Sync Now
          </Button>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Power}
          label="Service"
          value={data?.service_active ? "Active" : "Inactive"}
          variant={data?.service_active ? "success" : "destructive"}
        />
        <StatCard
          icon={Activity}
          label="DNSDist API"
          value={data?.dnsdist_api ? "Reachable" : "Unreachable"}
          variant={data?.dnsdist_api ? "success" : "warning"}
        />
        <StatCard
          icon={Globe}
          label="Domains"
          value={String(data?.domains_count ?? 0)}
          sub="domain dalam blacklist"
        />
        <StatCard
          icon={Database}
          label="Database"
          value={data?.db?.exists ? "Ada" : "Tidak ada"}
          sub={
            data?.db?.size
              ? formatBytes(data.db.size)
              : undefined
          }
          variant={data?.db?.exists ? "success" : "destructive"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Sync Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sinkronisasi</CardTitle>
            <CardDescription>Mode & status sync</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mode</span>
              <Badge variant="secondary">{data?.sync?.mode || "—"}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Central URL</span>
              <span className="font-mono text-xs truncate max-w-[200px]">
                {data?.sync?.central_url || "—"}
              </span>
            </div>
            {data?.sync?.manifest && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Manifest</span>
                <span className="font-mono text-xs">
                  {JSON.stringify(data.sync.manifest).slice(0, 60)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Config Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Konfigurasi</CardTitle>
            <CardDescription>Mode & upstream</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Block Mode</span>
              <Badge variant="secondary">
                {data?.config?.block_mode || "—"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sinkhole</span>
              <span className="font-mono text-xs truncate max-w-[200px]">
                {data?.config?.sinkhole || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Upstreams</span>
              <span className="text-xs">
                {data?.config?.upstreams?.length || 0} server
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Service Control</CardTitle>
          <CardDescription>
            Reload atau restart service DNSDist
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Dialog
            open={confirmAction === "reload"}
            onOpenChange={(o) => !o && setConfirmAction(null)}
          >
            <DialogTrigger asChild>
              <Button variant="secondary" onClick={() => setConfirmAction("reload")}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reload Service
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reload Service?</DialogTitle>
                <DialogDescription>
                  DNSDist akan reload konfigurasi tanpa menghentikan service.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmAction(null)}>
                  Batal
                </Button>
                <Button
                  onClick={() => handleAction("reload")}
                >
                  Reload
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={confirmAction === "restart"}
            onOpenChange={(o) => !o && setConfirmAction(null)}
          >
            <DialogTrigger asChild>
              <Button variant="destructive" onClick={() => setConfirmAction("restart")}>
                <Power className="mr-2 h-4 w-4" />
                Restart Service
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Restart Service?</DialogTitle>
                <DialogDescription>
                  DNSDist akan di-restart. DNS queries akan terganggu sesaat.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmAction(null)}>
                  Batal
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleAction("restart")}
                >
                  Restart
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Build info */}
      {data?.build_version && (
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>v{data.build_version}</span>
          {data.trust_builder && (
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> trust-builder
            </span>
          )}
          {data.update_script && (
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> update script
            </span>
          )}
          {data.health_script && (
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> health script
            </span>
          )}
        </div>
      )}

      {/* Sync confirm dialog */}
      <Dialog
        open={confirmAction === "sync"}
        onOpenChange={(o) => !o && setConfirmAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sinkronisasi Blacklist?</DialogTitle>
            <DialogDescription>
              Update blacklist dari repository central
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Batal
            </Button>
            <Button onClick={handleSync} disabled={syncLoading}>
              {syncLoading ? "Sync..." : "Sync Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}