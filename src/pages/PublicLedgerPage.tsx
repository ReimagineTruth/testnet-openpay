import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";

type LedgerTransaction = {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  note: string | null;
  status: string;
  created_at: string;
};

const PAGE_SIZE = 30;

const PublicLedgerPage = () => {
  const navigate = useNavigate();
  const { format: formatCurrency } = useCurrency();
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [piEnabled, setPiEnabled] = useState<boolean>(true);

  const loadPage = async (nextOffset = 0) => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/signin");
        return;
      }

      setUserId(user.id);
      const hasPiAuth = Boolean((user.user_metadata as Record<string, unknown> | undefined)?.pi_uid);
      setPiEnabled(hasPiAuth);
      if (!hasPiAuth) {
        setTransactions([]);
        setHasMore(false);
        setOffset(0);
        return;
      }

      const { data, error } = await supabase
        .from("transactions")
        .select("id, sender_id, receiver_id, amount, note, status, created_at")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .range(nextOffset, nextOffset + PAGE_SIZE - 1);

      if (error) throw new Error(error.message || "Failed to load ledger.");

      const rows = (data || []) as LedgerTransaction[];
      setTransactions(rows);
      setOffset(nextOffset);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load ledger.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage(0);
  }, [navigate]);

  const rows = useMemo(
    () =>
      transactions.map((tx) => ({
        ...tx,
        is_sent: tx.sender_id === userId,
        is_topup: tx.sender_id === tx.receiver_id,
      })),
    [transactions, userId],
  );

  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/menu")} aria-label="Back to menu">
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-paypal-dark">Public Ledger</h1>
            <p className="text-xs text-muted-foreground">
              Pi-auth account ledger. Transactions only, IDs hidden for safety.
            </p>
          </div>
        </div>
        <button
          onClick={() => loadPage(offset)}
          className="paypal-surface flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold text-foreground"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {!piEnabled && !loading ? (
        <p className="py-12 text-center text-muted-foreground">
          Public ledger is available only for Pi-auth accounts.
        </p>
      ) : rows.length === 0 && !loading ? (
        <p className="py-12 text-center text-muted-foreground">No ledger transactions yet.</p>
      ) : (
        <div className="paypal-surface divide-y divide-border/70 rounded-3xl">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-foreground">
                  {row.is_topup ? "Top up" : row.is_sent ? "Payment sent" : "Payment received"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(row.created_at), "MMM d, yyyy HH:mm")} • transactions
                </p>
                {row.note && <p className="text-xs text-muted-foreground">{row.note}</p>}
                <p className="text-xs text-muted-foreground">Status: {row.status || "unknown"}</p>
              </div>
              <div className="text-right">
                <p className={`font-semibold ${row.is_sent && !row.is_topup ? "text-red-500" : "text-paypal-success"}`}>
                  {row.is_sent && !row.is_topup ? "-" : "+"}
                  {formatCurrency(row.amount)}
                </p>
                <p className="text-xs text-muted-foreground">Record ID hidden</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          className="paypal-surface h-9 rounded-full px-4 text-sm font-semibold text-foreground disabled:opacity-50"
          onClick={() => loadPage(Math.max(0, offset - PAGE_SIZE))}
          disabled={loading || offset === 0 || !piEnabled}
        >
          Previous
        </button>
        <button
          className="paypal-surface h-9 rounded-full px-4 text-sm font-semibold text-foreground disabled:opacity-50"
          onClick={() => loadPage(offset + PAGE_SIZE)}
          disabled={loading || !hasMore || !piEnabled}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default PublicLedgerPage;
