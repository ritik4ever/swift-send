import { useState, useEffect, useCallback } from "react";
import { Activity, Globe, Clock, AlertTriangle, TrendingUp, ServerCrash } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiFetch } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

interface LatencySample {
  timestamp: string;
  latencyMs: number;
  status: "online" | "degraded" | "offline";
}

interface StellarMonitorState {
  currentStatus: "online" | "degraded" | "offline";
  currentLatencyMs: number | null;
  lastCheckedAt: string;
  uptimePercent: number;
  averageLatencyMs: number;
  samples: LatencySample[];
  outagesLogged: number;
  degradedSince?: string;
  lastOutageAt?: string;
}

export default function AdminStellarMonitor() {
  const [state, setState] = useState<StellarMonitorState | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchState = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/admin/stellar/monitor");
      if (response.ok) {
        setState(await response.json());
      }
    } catch (error) {
      console.error("Failed to fetch stellar monitor state:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 15_000);
    return () => clearInterval(interval);
  }, [fetchState]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "online":
        return <Badge className="bg-green-500">Online</Badge>;
      case "degraded":
        return <Badge className="bg-yellow-500">Degraded</Badge>;
      case "offline":
        return <Badge className="bg-red-500">Offline</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLatencyColor = (ms: number) => {
    if (ms >= 2000) return "text-red-500";
    if (ms >= 1000) return "text-yellow-500";
    return "text-green-500";
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8" />
            Stellar Network Monitor
          </h1>
          <p className="text-muted-foreground mt-2">
            Real-time Stellar network health and performance monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-sm">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Auto-refreshing</span>
          </div>
        </div>
      </div>

      {loading && !state ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading monitor data...
          </CardContent>
        </Card>
      ) : state ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Status</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-1">
                  {getStatusBadge(state.currentStatus)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {state.currentStatus === "online"
                    ? "All systems operational"
                    : state.currentStatus === "degraded"
                      ? "Performance degraded"
                      : "Service unavailable"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Latency</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getLatencyColor(state.currentLatencyMs || 0)}`}>
                  {state.currentLatencyMs !== null && state.currentLatencyMs > 0
                    ? `${state.currentLatencyMs}ms`
                    : "N/A"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Avg: {state.averageLatencyMs}ms
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${state.uptimePercent < 95 ? "text-red-500" : state.uptimePercent < 99 ? "text-yellow-500" : "text-green-500"}`}>
                  {state.uptimePercent}%
                </div>
                <p className="text-xs text-muted-foreground">Last 30 minutes</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Outages</CardTitle>
                <ServerCrash className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{state.outagesLogged}</div>
                <p className="text-xs text-muted-foreground">
                  {state.lastOutageAt
                    ? `Last: ${formatDistanceToNow(new Date(state.lastOutageAt), { addSuffix: true })}`
                    : "No recent outages"}
                </p>
              </CardContent>
            </Card>
          </div>

          {state.degradedSince && (
            <Card className="border-yellow-500/50 bg-yellow-500/5">
              <CardContent className="flex items-center gap-3 py-4">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="font-medium">Degraded Mode Warning</p>
                  <p className="text-sm text-muted-foreground">
                    Network has been degraded since{" "}
                    {formatDistanceToNow(new Date(state.degradedSince), { addSuffix: true })}
                    . Average latency is {state.averageLatencyMs}ms.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Checks</CardTitle>
              <CardDescription>
                Last {state.samples.length} latency samples
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {[...state.samples].reverse().map((sample, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded bg-muted/30"
                    >
                      <div className="flex items-center gap-2">
                        {getStatusBadge(sample.status)}
                        <span className="text-sm text-muted-foreground">
                          {new Date(sample.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <span className={`text-sm font-mono ${getLatencyColor(sample.latencyMs)}`}>
                        {sample.latencyMs > 0 ? `${sample.latencyMs}ms` : "N/A"}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Failed to load monitor data
          </CardContent>
        </Card>
      )}
    </div>
  );
}
