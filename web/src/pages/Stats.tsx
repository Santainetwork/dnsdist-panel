import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { topQueries, topBlocked, topASN, type TopStats } from "@/lib/api";
import { Button } from "@/components/ui/button";
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

const N_OPTIONS = [10, 20, 50];

function TopTable({
  title,
  desc,
  data,
  accent,
}: {
  title: string;
  desc: string;
  data: TopStats | null;
  accent?: string;
}) {
  const top = data?.top || [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Tidak ada data
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Rank</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead className="text-right">Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top.map((t) => (
                <TableRow key={t.rank}>
                  <TableCell className="text-muted-foreground">{t.rank}</TableCell>
                  <TableCell className={`font-mono ${accent || ""}`}>
                    {t.name}
                  </TableCell>
                  <TableCell className="text-right">{t.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function Stats() {
  const [n, setN] = useState(20);
  const [queries, setQueries] = useState<TopStats | null>(null);
  const [blocked, setBlocked] = useState<TopStats | null>(null);
  const [asn, setAsn] = useState<TopStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [q, b, a] = await Promise.all([
        topQueries(n),
        topBlocked(n),
        topASN(n),
      ]);
      setQueries(q);
      setBlocked(b);
      setAsn(a);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat statistik");
    } finally {
      setLoading(false);
    }
  }, [n]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const chartData = (queries?.top || []).map((t) => ({
    name: t.name,
    count: t.count,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Statistik</h2>
          <p className="text-muted-foreground">Top queries, blocked, dan ASN</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border">
            {N_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setN(opt)}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  n === opt
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={fetchAll}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Queries</CardTitle>
          <CardDescription>Grafik query teratas</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Tidak ada data
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={-30}
                  textAnchor="end"
                  height={70}
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: "rgba(128,128,128,0.1)" }}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopTable
          title="Top Queries"
          desc="Query DNS teratas"
          data={queries}
        />
        <TopTable
          title="Top Blocked"
          desc="Domain paling sering diblokir"
          data={blocked}
          accent="text-destructive"
        />
        <TopTable
          title="Top ASN"
          desc="ASN paling banyak query"
          data={asn}
        />
      </div>
    </div>
  );
}
