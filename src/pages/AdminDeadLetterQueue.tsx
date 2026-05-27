import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, RefreshCw, Trash2, RotateCcw, Archive, Activity } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

interface DeadLetterEntry {
  jobId: string;
  originalJob: {
    id: string;
    command: {
      idempotencyKey: string;
      userId: string;
      amount: number;
      currency: string;
    };
  };
  failedAt: string;
  failureReason: string;
  retryCount: number;
  lastRetryAt: string;
  status: "pending_review" | "retrying" | "recovered" | "discarded";
  recoveredAt?: string;
  notes?: string;
}

interface DlqStats {
  totalEntries: number;
  pendingReview: number;
  retrying: number;
  recovered: number;
  discarded: number;
}

export default function AdminDeadLetterQueue() {
  const [entries, setEntries] = useState<DeadLetterEntry[]>([]);
  const [stats, setStats] = useState<DlqStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<DeadLetterEntry | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [entriesRes, statsRes] = await Promise.all([
        apiFetch("/admin/dlq"),
        apiFetch("/admin/dlq/stats"),
      ]);
      if (entriesRes.ok) setEntries(await entriesRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (error) {
      console.error("Failed to fetch DLQ data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const retryJob = async (jobId: string) => {
    await apiFetch("/admin/dlq/retry", {
      method: "POST",
      body: JSON.stringify({ jobId }),
    });
    await fetchData();
  };

  const retryAll = async () => {
    await apiFetch("/admin/dlq/retry-all", { method: "POST" });
    await fetchData();
  };

  const discardJob = async (jobId: string) => {
    await apiFetch(`/admin/dlq/${jobId}/discard`, { method: "POST" });
    await fetchData();
  };

  const purgeDiscarded = async () => {
    await apiFetch("/admin/dlq/purge", { method: "POST" });
    await fetchData();
  };

  const getStatusBadge = (status: DeadLetterEntry["status"]) => {
    switch (status) {
      case "pending_review":
        return <Badge className="bg-red-500">Pending Review</Badge>;
      case "retrying":
        return <Badge className="bg-yellow-500">Retrying</Badge>;
      case "recovered":
        return <Badge className="bg-green-500">Recovered</Badge>;
      case "discarded":
        return <Badge variant="outline">Discarded</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-8 w-8" />
            Dead Letter Queue
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage failed transaction jobs that require manual intervention
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={retryAll}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Retry All
          </Button>
          <Button variant="outline" size="sm" onClick={purgeDiscarded}>
            <Archive className="h-4 w-4 mr-1" />
            Purge Discarded
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEntries}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{stats.pendingReview}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Retrying</CardTitle>
              <RotateCcw className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{stats.retrying}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recovered</CardTitle>
              <RefreshCw className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats.recovered}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Discarded</CardTitle>
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.discarded}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">Pending Review</TabsTrigger>
          <TabsTrigger value="all">All Entries</TabsTrigger>
          <TabsTrigger value="recovered">Recovered</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading...
              </CardContent>
            </Card>
          ) : entries.filter((e) => e.status === "pending_review").length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No pending DLQ entries
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {entries
                  .filter((e) => e.status === "pending_review")
                  .map((entry) => (
                    <EntryCard
                      key={entry.jobId}
                      entry={entry}
                      onRetry={retryJob}
                      onDiscard={discardJob}
                      onSelect={setSelectedEntry}
                    />
                  ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <ScrollArea className="h-[600px]">
            <div className="space-y-3">
              {entries.map((entry) => (
                <EntryCard
                  key={entry.jobId}
                  entry={entry}
                  onRetry={retryJob}
                  onDiscard={discardJob}
                  onSelect={setSelectedEntry}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="recovered" className="space-y-4">
          <ScrollArea className="h-[600px]">
            <div className="space-y-3">
              {entries
                .filter((e) => e.status === "recovered")
                .map((entry) => (
                  <EntryCard
                    key={entry.jobId}
                    entry={entry}
                    onRetry={retryJob}
                    onDiscard={discardJob}
                    onSelect={setSelectedEntry}
                  />
                ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EntryCard({
  entry,
  onRetry,
  onDiscard,
  onSelect,
}: {
  entry: DeadLetterEntry;
  onRetry: (jobId: string) => Promise<void>;
  onDiscard: (jobId: string) => Promise<void>;
  onSelect: (entry: DeadLetterEntry) => void;
}) {
  const getStatusBadge = (status: DeadLetterEntry["status"]) => {
    switch (status) {
      case "pending_review":
        return <Badge className="bg-red-500">Pending Review</Badge>;
      case "retrying":
        return <Badge className="bg-yellow-500">Retrying</Badge>;
      case "recovered":
        return <Badge className="bg-green-500">Recovered</Badge>;
      case "discarded":
        return <Badge variant="outline">Discarded</Badge>;
    }
  };

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={() => onSelect(entry)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              {getStatusBadge(entry.status)}
              <Badge variant="outline">
                Retries: {entry.retryCount}
              </Badge>
            </div>
            <CardTitle className="text-base">
              {entry.originalJob.command.idempotencyKey}
            </CardTitle>
            <CardDescription>
              User: {entry.originalJob.command.userId} &middot; Amount: {entry.originalJob.command.amount} {entry.originalJob.command.currency}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {(entry.status === "pending_review" || entry.status === "retrying") && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onRetry(entry.jobId); }}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onDiscard(entry.jobId); }}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Discard
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 text-sm">
          <div className="text-destructive font-medium">
            Error: {entry.failureReason}
          </div>
          <div className="text-muted-foreground">
            Failed {formatDistanceToNow(new Date(entry.failedAt), { addSuffix: true })}
          </div>
          {entry.notes && (
            <div className="text-muted-foreground italic">
              {entry.notes}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
