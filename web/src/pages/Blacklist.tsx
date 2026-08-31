import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Upload, Hammer, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  listDomains,
  addDomain,
  deleteDomain,
  importDomains,
  buildBlacklist,
  getBlacklistStatus,
  formatBytes,
  type DomainRow,
  type DBInfo,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Blacklist() {
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [status, setStatus] = useState<DBInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [importText, setImportText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DomainRow | null>(null);
  const [buildOpen, setBuildOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([listDomains(), getBlacklistStatus()]);
      setDomains(d.domains);
      setStatus(s);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat blacklist");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const domain = newDomain.trim().toLowerCase();
    if (!domain) return;
    setBusy(true);
    try {
      await addDomain(domain);
      toast.success(`Domain ${domain} ditambahkan`);
      setNewDomain("");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteDomain(deleteTarget.domain);
      toast.success(`Domain ${deleteTarget.domain} dihapus`);
      setDeleteTarget(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    const lines = importText
      .split(/\r?\n/)
      .map((l) => l.trim().toLowerCase())
      .filter((l) => l.length > 0 && !l.startsWith("#"));
    if (lines.length === 0) {
      toast.error("Tidak ada domain untuk diimport");
      return;
    }
    setBusy(true);
    try {
      const res = await importDomains(lines);
      toast.success(`${res.imported} domain diimport`);
      setImportOpen(false);
      setImportText("");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleBuild = async () => {
    setBusy(true);
    try {
      const res = await buildBlacklist();
      if (res.ok) {
        toast.success("Blacklist database berhasil dibangun");
      } else {
        toast.error("Build gagal");
      }
      setBuildOpen(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Blacklist</h2>
          <p className="text-muted-foreground">
            Kelola daftar domain yang diblokir
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setBuildOpen(true)}
          >
            <Hammer className="mr-2 h-4 w-4" />
            Build DB
          </Button>
          <Button variant="outline" size="sm" onClick={fetchAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status strip */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          <Badge variant={status?.exists ? "success" : "destructive"}>
            {status?.exists ? "DB Ada" : "DB Tidak Ada"}
          </Badge>
          {status?.size !== undefined && (
            <span className="text-sm text-muted-foreground">
              Ukuran: {formatBytes(status.size)}
            </span>
          )}
          <span className="text-sm text-muted-foreground">
            Total: {domains.length} domain
          </span>
          {status?.mod_time && (
            <span className="text-sm text-muted-foreground">
              Terakhir update: {status.mod_time}
            </span>
          )}
        </CardContent>
      </Card>

      {/* Add domain */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tambah Domain</CardTitle>
          <CardDescription>
            Tambahkan domain ke daftar blacklist
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex gap-3">
            <Input
              placeholder="example.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              className="max-w-sm"
            />
            <Button type="submit" disabled={busy || !newDomain.trim()}>
              {busy ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />}
              Tambah
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Domain table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daftar Domain</CardTitle>
          <CardDescription>
            {loading ? "Memuat..." : `${domains.length} domain terblokir`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead className="w-40">Dibuat</TableHead>
                <TableHead className="w-24 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Belum ada domain
                  </TableCell>
                </TableRow>
              ) : (
                domains.map((d, i) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-mono">{d.domain}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {d.created_at ? d.created_at.slice(0, 10) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => setDeleteTarget(d)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Domain?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.domain} akan dihapus dari blacklist.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Domain</DialogTitle>
            <DialogDescription>
              Satu domain per baris. Baris diawali # akan diabaikan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="import">Domain list</Label>
            <Textarea
              id="import"
              rows={10}
              placeholder={"evil.com\nmalware.net\n# comment\nphishing.org"}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleImport} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Upload className="h-4 w-4" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Build dialog */}
      <Dialog open={buildOpen} onOpenChange={setBuildOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bangun Blacklist DB?</DialogTitle>
            <DialogDescription>
              Build database blacklist dari daftar domain saat ini.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuildOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleBuild} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Hammer className="h-4 w-4" />}
              Build
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
