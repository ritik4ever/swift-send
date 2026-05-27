import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  TrendingUp,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

interface SettlementAnalytics {
  averageSettlementTimeMs: number;
  failedTransferRate: number;
  totalTransfers: number;
  successfulTransfers: number;
  failedTransfers: number;
  averageTransferAmount: number;
  totalVolume: number;
  periodStart: string;
  periodEnd: string;
}

interface SettlementTimeBucket {
  date: string;
  averageTimeMs: number;
  count: number;
  failedCount: number;
}

interface FailedTransfer {
  transferId: string;
  userId: string;
  amount: number;
  currency: string;
  createdAt: string;
  error?: string;
}

export default function AdminSettlementAnalytics() {
  const [analytics, setAnalytics] = useState<SettlementAnalytics | null>(null);
  const [trend, setTrend] = useState<SettlementTimeBucket[]>([]);
  const [failedTransfers, setFailedTransfers] = useState<FailedTransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(30);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsRes, trendRes, failedRes] = await Promise.all([
        apiFetch(`/admin/settlements/analytics?days=${days}`),
        apiFetch(`/admin/settlements/trend?days=${days}`),
        apiFetch(`/admin/settlements/failed?days=${days}`),
      ]);
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (trendRes.ok) setTrend(await trendRes.json());
      if (failedRes.ok) setFailedTransfers(await failedRes.json());
    } catch (error) {
      console.error("Failed to fetch settlement analytics:", error);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8" />
            Settlement Performance Analytics
          </h1>
          <p className="text-muted-foreground mt-2">
            Track settlement efficiency, failure rates, and performance trends
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="px-3 py-1.5 rounded border bg-background text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {loading && !analytics ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading settlement analytics...
          </CardContent>
        </Card>
      ) : analytics ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Settlement Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatDuration(analytics.averageSettlementTimeMs)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {analytics.successfulTransfers} successful settlements
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Failed Rate</CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${analytics.failedTransferRate > 10 ? "text-red-500" : analytics.failedTransferRate > 5 ? "text-yellow-500" : "text-green-500"}`}>
                  {analytics.failedTransferRate}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {analytics.failedTransfers} of {analytics.totalTransfers} failed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${analytics.totalVolume.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Avg: ${analytics.averageTransferAmount.toFixed(2)} per transfer
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Transfers</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.totalTransfers}</div>
                <p className="text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 inline text-green-500" />{" "}
                  {analytics.successfulTransfers} successful
                  {" / "}
                  <XCircle className="h-3 w-3 inline text-red-500" />{" "}
                  {analytics.failedTransfers} failed
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="settlement-time" className="space-y-4">
            <TabsList>
              <TabsTrigger value="settlement-time">Settlement Time Trend</TabsTrigger>
              <TabsTrigger value="failed">Failed Transfers</TabsTrigger>
            </TabsList>

            <TabsContent value="settlement-time">
              <Card>
                <CardHeader>
                  <CardTitle>Settlement Time Trend</CardTitle>
                  <CardDescription>
                    Average settlement time per day
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {trend.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      No settlement data available
                    </div>
                  ) : (
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trend}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 12 }}
                            tickFormatter={(val) => {
                              const d = new Date(val);
                              return `${d.getMonth() + 1}/${d.getDate()}`;
                            }}
                          />
                          <YAxis
                            tick={{ fontSize: 12 }}
                            tickFormatter={(val) => `${(val / 1000).toFixed(1)}s`}
                          />
                          <Tooltip
                            formatter={(value: number) => [
                              `${(value / 1000).toFixed(1)}s`,
                              "Avg Time",
                            ]}
                          />
                          <Line
                            type="monotone"
                            dataKey="averageTimeMs"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="failed">
              <Card>
                <CardHeader>
                  <CardTitle>Failed Transfers</CardTitle>
                  <CardDescription>
                    Recent failed settlement attempts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {failedTransfers.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      No failed transfers in this period
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-3">
                        {failedTransfers.map((transfer) => (
                          <Card key={transfer.transferId} className="border-red-500/30">
                            <CardHeader className="pb-2">
                              <div className="flex items-start justify-between">
                                <div>
                                  <CardTitle className="text-sm">
                                    {transfer.transferId}
                                  </CardTitle>
                                  <CardDescription>
                                    User: {transfer.userId} &middot;{" "}
                                    {formatDistanceToNow(new Date(transfer.createdAt), {
                                      addSuffix: true,
                                    })}
                                  </CardDescription>
                                </div>
                                <Badge variant="destructive">
                                  ${transfer.amount} {transfer.currency}
                                </Badge>
                              </div>
                            </CardHeader>
                            {transfer.error && (
                              <CardContent>
                                <div className="text-sm text-destructive">
                                  {transfer.error}
                                </div>
                              </CardContent>
                            )}
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Failed to load analytics
          </CardContent>
        </Card>
      )}
    </div>
  );
}
