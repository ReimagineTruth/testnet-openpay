import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type AdminHistoryRow = {
  id: string;
  source_table: string;
  source_id: string;
  event_type: string;
  actor_user_id: string | null;
  related_user_id: string | null;
  amount: number | null;
  note: string;
  status: string | null;
  payload: Record<string, unknown>;
  occurred_at: string;
  actor_profile: { full_name: string; username: string } | null;
  related_profile: { full_name: string; username: string } | null;
};

type AdminSummary = {
  total_history_events: number;
  total_users: number;
  page_amount_sum: number;
  page_limit: number;
  page_offset: number;
};

const PAGE_SIZE = 50;

const displayName = (profile: { full_name: string; username: string } | null, fallbackId: string) => {
  if (!profile) return fallbackId.slice(0, 8);
  if (profile.full_name) return profile.full_name;
  if (profile.username) return `@${profile.username}`;
  return fallbackId.slice(0, 8);
};

const displayNullableName = (
  profile: { full_name: string; username: string } | null,
  fallbackId: string | null,
) => {
  if (!fallbackId) return "-";
  return displayName(profile, fallbackId);
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [historyRows, setHistoryRows] = useState<AdminHistoryRow[]>([]);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [offset, setOffset] = useState(0);
  const [viewerEmail, setViewerEmail] = useState<string>("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const hasPrev = offset > 0;
  const hasNext = useMemo(() => {
    if (!summary) return false;
    return offset + PAGE_SIZE < summary.total_history_events;
  }, [offset, summary]);

  const loadPage = async (nextOffset = offset) => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sign in first to open admin dashboard");
        navigate("/admin-mrwain?mode=signin", { replace: true });
        return;
      }

      if (!user.email) {
        toast.error("Email sign-in required");
        navigate("/dashboard", { replace: true });
        return;
      }
      setViewerEmail(user.email);

      const { data, error } = await supabase.rpc("admin_dashboard_history" as any, {
        p_limit: PAGE_SIZE,
        p_offset: nextOffset,
      });
      if (error) {
        throw new Error(error.message || "Failed to load admin dashboard");
      }

      const payload = data as unknown as
        | {
            success?: boolean;
            error?: string;
            data?: { summary: AdminSummary; history: AdminHistoryRow[] };
          }
        | undefined;

      if (!payload?.success || !payload.data) {
        throw new Error(payload?.error || "Failed to load admin dashboard");
      }

      setHistoryRows(payload.data.history);
      setSummary(payload.data.summary);
      setOffset(nextOffset);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load admin dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSelfSendRow = (row: AdminHistoryRow) =>
    row.source_table === "transactions" &&
    row.event_type === "transaction_created" &&
    !!row.actor_user_id &&
    row.actor_user_id === row.related_user_id;

  const handleSelfSendReview = async (row: AdminHistoryRow, decision: "approve" | "reject") => {
    setReviewingId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-dashboard", {
        body: {
          action: "review_self_send",
          transaction_id: row.source_id,
          decision,
          reason: `Admin review from dashboard for ledger event ${row.id}`,
        },
      });
      if (error) throw new Error(error.message || "Review failed");

      const refundedId = (data as { data?: { refunded_transaction_id?: string } })?.data?.refunded_transaction_id;
      if (decision === "approve" && refundedId) {
        toast.success(`Refund approved. Refund TX: ${refundedId}`);
      } else {
        toast.success(`Self-send ${decision}d.`);
      }
      await loadPage(offset);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Review failed");
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-4 pb-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} aria-label="Back">
              <ArrowLeft className="h-6 w-6 text-foreground" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-paypal-dark">Admin Dashboard</h1>
              <p className="text-xs text-muted-foreground">Transparent OpenPay transaction ledger</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => loadPage(offset)} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="paypal-surface rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">Total History Events</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{summary?.total_history_events ?? 0}</p>
          </div>
          <div className="paypal-surface rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">Total Accounts</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{summary?.total_users ?? 0}</p>
          </div>
          <div className="paypal-surface rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">Current Page Amount Sum</p>
            <p className="mt-1 text-2xl font-bold text-foreground">${(summary?.page_amount_sum ?? 0).toFixed(2)}</p>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <p>Signed in as {viewerEmail || "-"}</p>
          <p>
            Showing {summary ? offset + 1 : 0}-
            {summary ? Math.min(offset + PAGE_SIZE, summary.total_history_events) : 0}
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Related</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">Record ID</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {historyRows.length === 0 && !loading && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                    No history events found.
                  </td>
                </tr>
              )}
              {historyRows.map((row) => (
                <tr key={row.id} className="border-t border-border/70 align-top">
                  <td className="px-4 py-3 whitespace-nowrap">{format(new Date(row.occurred_at), "MMM d, yyyy HH:mm")}</td>
                  <td className="px-4 py-3">{row.event_type}</td>
                  <td className="px-4 py-3">{row.source_table}</td>
                  <td className="px-4 py-3">{displayNullableName(row.actor_profile, row.actor_user_id)}</td>
                  <td className="px-4 py-3">{displayNullableName(row.related_profile, row.related_user_id)}</td>
                  <td className="px-4 py-3 font-semibold">{row.amount === null ? "-" : `$${Number(row.amount).toFixed(2)}`}</td>
                  <td className="px-4 py-3">{row.status || "-"}</td>
                  <td className="px-4 py-3">{row.note || "-"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.id}</td>
                  <td className="px-4 py-3">
                    {isSelfSendRow(row) ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSelfSendReview(row, "approve")}
                          disabled={reviewingId === row.id}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSelfSendReview(row, "reject")}
                          disabled={reviewingId === row.id}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            disabled={loading || !hasPrev}
            onClick={() => {
              const nextOffset = Math.max(0, offset - PAGE_SIZE);
              loadPage(nextOffset);
            }}
          >
            Previous
          </Button>
          <Button
            disabled={loading || !hasNext}
            onClick={() => {
              const nextOffset = offset + PAGE_SIZE;
              loadPage(nextOffset);
            }}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
