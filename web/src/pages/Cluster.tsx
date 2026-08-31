import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, RefreshCw, Loader2, Server } from "lucide-react";
import { toast } from "sonner";
import {
  getCluster,
  listPeers,
  addPeer,
  deletePeer,
  probePeer,
  type Peer,
  type ProbeResult,
} from "@/lib/api";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ProbeTarget = { peer: Peer; result: ProbeResult };

export default function Cluster() {
  const [localData, setLocalData] = useState<{
    hostname: string;
    mode: string;
    manifest?: Record<string, unknown>;
  } | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPeerName, setNewPeerName] = useState("");
  const [newPeerUrl, setNewPeerUrl] = useState("");
  const [newPeerToken, setNewPeerToken] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Peer | null>(null);
  const [probeTarget, setProbeTarget] = useState<ProbeTarget | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cluster, peersRes] = await Promise.all([getCluster(), listPeers()]);
      if (cluster.local) {
        setLocalData({
          hostname: cluster.local.hostname || "unknown",
          mode: cluster.local.mode || "unknown",
          manifest: (cluster.local.manifest as Record<string, unknown>) || undefined,
        });
      }
      setPeers(peersRes.peers || []);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat cluster");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPeerName.trim();
    const url = newPeerUrl.trim();
    const token = newPeerToken.trim();
    if (!name || !url) {
      toast.error("Name dan URL harus diisi");
      return;
    }
    setBusy(true);
    try {
      await addPeer(name, url, token);
      toast.success(`Peer ${name} ditambahkan`);
      setNewPeerName("");
      setNewPeerUrl("");
      setNewPeerToken("");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Gagal menambahkan peer");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deletePeer(deleteTarget.name);
      toast.success(`Peer ${deleteTarget.name} dihapus`);
      setDeleteTarget(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus peer");
    } finally {
      setBusy(false);
    }
  };

  const handleProbe = async (peer: Peer) => {
    setBusy(true);
    try {
      const result = await probePeer(peer.url, peer.token || "");
      setProbeTarget({ peer, result });
      if (!result.ok) {
        toast.error("Probing gagal");
      }
    } catch (err: any) {
      toast.error(err.message || "Probing gagal");
    } finally {
      setBusy(false);
    }
  };

  const maskToken = (token: string) => {
    if (!token) return "(empty)";
    if (token.length <= 8) return "*".repeat(token.length);
    return `${token.slice(0, 4)}${"*".repeat(token.length - 8)}${token.slice(-4)}`;
  };

  const renderManifest = (manifest?: Record<string, unknown>) => {
    if (!manifest || Object.keys(manifest).length === 0) return null;
    return (
      <>
        <div className="h-px bg-border" />
        <div className="space-y-2">
          <div className="text-xs uppercase text-muted-foreground">Manifest</div>
          {Object.entries(manifest).map(([key, value]) => (
            <div key={key} className="flex justify-between gap-4">
              <span className="text-xs capitalize text-muted-foreground">{key}</span>
              <span className="font-mono text-xs truncate max-w-[260px]">
                {String(value)}
              </span>
            </div>
          ))}
        </div>
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cluster</h2>
          <p className="text-muted-foreground">
            Kelola node DNSDist dalam cluster
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Local Node */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="h-5 w-5" />
            Local Node
          </CardTitle>
          <CardDescription>Informasi node ini</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !localData ? (
            <div className="py-4 text-muted-foreground">Memuat...</div>
          ) : localData ? (
            <div className="space-y-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Hostname</span>
                <span className="font-mono">{localData.hostname}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Mode</span>
                <Badge variant={localData.mode === "central" ? "default" : "secondary"}>
                  {localData.mode}
                </Badge>
              </div>
              {renderManifest(localData.manifest)}
            </div>
          ) : (
            <div className="py-4 text-muted-foreground">Tidak ada data</div>
          )}
        </CardContent>
      </Card>

      {/* Add Peer Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tambah Peer</CardTitle>
          <CardDescription>Tambahkan node lain ke cluster</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="peerName">Name</Label>
                <Input
                  id="peerName"
                  placeholder="edge-01"
                  value={newPeerName}
                  onChange={(e) => setNewPeerName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="peerUrl">URL</Label>
                <Input
                  id="peerUrl"
                  placeholder="http://10.0.0.2:8084"
                  value={newPeerUrl}
                  onChange={(e) => setNewPeerUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="peerToken">Token</Label>
                <Input
                  id="peerToken"
                  type="password"
                  placeholder="cdb_secret"
                  value={newPeerToken}
                  onChange={(e) => setNewPeerToken(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={busy || !newPeerName.trim() || !newPeerUrl.trim()}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Tambah Peer
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Peers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daftar Peer</CardTitle>
          <CardDescription>
            {loading ? "Memuat..." : `${peers.length} node terhubung`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Dibuat</TableHead>
                <TableHead className="w-40">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {peers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Belum ada peer
                  </TableCell>
                </TableRow>
              ) : (
                peers.map((p, i) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-semibold">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs">{p.url}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {maskToken(p.token || "")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.created_at ? p.created_at.slice(0, 10) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleProbe(p)}
                          disabled={busy}
                          title="Probe health"
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${busy && probeTarget?.peer.id === p.id ? "animate-spin" : ""}`}
                          />
                          Probe
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(p)}
                          disabled={busy}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Peer?</DialogTitle>
            <DialogDescription>
              Peer {deleteTarget?.name} akan dihapus dari cluster.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Probe Result Dialog */}
      <Dialog open={!!probeTarget} onOpenChange={(o) => !o && setProbeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hasil Probe: {probeTarget?.peer.name}</DialogTitle>
            <DialogDescription>
              Status koneksi dan kesehatan peer
            </DialogDescription>
          </DialogHeader>
          {probeTarget ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Reachable:</span>
                <Badge variant={probeTarget.result.reachable ? "success" : "destructive"}>
                  {probeTarget.result.reachable ? "Yes" : "No"}
                </Badge>
                <span className="ml-3 text-sm text-muted-foreground">Health:</span>
                <Badge variant={probeTarget.result.health ? "success" : "destructive"}>
                  {probeTarget.result.health ? "OK" : "Fail"}
                </Badge>
              </div>
              {probeTarget.result.health_body &&
                probeTarget.result.health_body.trim() && (
                  <div className="rounded-md bg-muted px-3 py-2 font-mono text-xs">
                    Health Body: {probeTarget.result.health_body.trim()}
                  </div>
                )}
              {renderManifest(
                probeTarget.result.manifest &&
                  typeof probeTarget.result.manifest === "object"
                  ? (probeTarget.result.manifest as Record<string, unknown>)
                  : undefined
              )}
            </div>
          ) : (
            <div className="py-4 text-center text-muted-foreground">Loading...</div>
          )}
          <DialogFooter>
            <Button onClick={() => setProbeTarget(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
