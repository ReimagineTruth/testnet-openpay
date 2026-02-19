import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { useCurrency } from "@/contexts/CurrencyContext";
import TransactionReceipt, { type ReceiptData } from "@/components/TransactionReceipt";

interface Transaction {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  note: string;
  status: string;
  created_at: string;
  other_name?: string;
  other_username?: string | null;
  other_avatar_url?: string | null;
  is_sent?: boolean;
  is_topup?: boolean;
}

const toPreviewText = (value: string, max = 68) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const shortenToken = (token: string, keepStart = 10, keepEnd = 6) => {
    if (token.length <= keepStart + keepEnd + 3) return token;
    return `${token.slice(0, keepStart)}...${token.slice(-keepEnd)}`;
  };

  const tokenShortened = raw
    .replace(/\bopsess_[a-zA-Z0-9_-]+\b/g, (m) => shortenToken(m))
    .replace(/\boplink_[a-zA-Z0-9_-]+\b/g, (m) => shortenToken(m))
    .replace(/\bhttps?:\/\/[^\s]+/gi, (m) => shortenToken(m, 22, 10));

  if (tokenShortened.length <= max) return tokenShortened;
  return `${tokenShortened.slice(0, max - 3)}...`;
};

const ActivityPage = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const navigate = useNavigate();
  const { format: formatCurrency } = useCurrency();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/signin");
        return;
      }

      const { data: txs } = await supabase
        .from("transactions")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      const { data: wallet } = await supabase
        .from("wallets")
        .select("welcome_bonus_claimed_at")
        .eq("user_id", user.id)
        .single();

      if (txs) {
        const enriched = await Promise.all(txs.map(async (tx) => {
          const otherId = tx.sender_id === user.id ? tx.receiver_id : tx.sender_id;
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, username, avatar_url")
            .eq("id", otherId)
            .single();
          return {
            ...tx,
            other_name: profile?.full_name || "Unknown",
            other_username: profile?.username || null,
            other_avatar_url: profile?.avatar_url || null,
            is_sent: tx.sender_id === user.id,
            is_topup: tx.sender_id === user.id && tx.receiver_id === user.id,
          };
        }));
        const bonusTx = wallet?.welcome_bonus_claimed_at
          ? [{
              id: `welcome-${user.id}`,
              sender_id: user.id,
              receiver_id: user.id,
              amount: 1,
              note: "Welcome bonus",
              status: "completed",
              created_at: wallet.welcome_bonus_claimed_at,
              other_name: "OpenPay",
              other_username: "openpay",
              other_avatar_url: null,
              is_sent: false,
              is_topup: true,
            }]
          : [];
        setTransactions([...bonusTx, ...enriched]);
      }
      setLoading(false);
    };
    load();
  }, [navigate]);

  const showReceipt = (tx: Transaction) => {
    setReceiptData({
      transactionId: tx.id,
      type: tx.is_topup ? "topup" : tx.is_sent ? "send" : "receive",
      amount: tx.amount,
      otherPartyName: tx.other_name,
      otherPartyUsername: tx.other_username || undefined,
      note: tx.note || undefined,
      date: new Date(tx.created_at),
    });
    setReceiptOpen(true);
  };

  return (
    <div className="min-h-screen bg-background px-4 pt-4">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-paypal-dark">Activity</h1>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-paypal-dark">Recent activity</h2>
      </div>

      {loading ? (
        <div className="paypal-surface divide-y divide-border/70 rounded-3xl">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-secondary" />
                <div className="space-y-2">
                  <div className="h-4 w-40 animate-pulse rounded bg-secondary" />
                  <div className="h-3 w-28 animate-pulse rounded bg-secondary" />
                  <div className="h-3 w-24 animate-pulse rounded bg-secondary" />
                </div>
              </div>
              <div className="h-4 w-16 animate-pulse rounded bg-secondary" />
            </div>
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No activity yet</p>
      ) : (
        <div className="paypal-surface divide-y divide-border/70 rounded-3xl">
          {transactions.map((tx) => (
            <button key={tx.id} onClick={() => showReceipt(tx)} className="flex w-full items-center justify-between p-4 text-left transition hover:bg-secondary/40">
              <div className="flex items-center gap-3">
                {tx.other_avatar_url ? (
                  <img
                    src={tx.other_avatar_url}
                    alt={tx.other_name || "Profile"}
                    className="h-10 w-10 rounded-full border border-paypal-light-blue/50 object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-paypal-light-blue/50 bg-secondary">
                    <span className="text-xs font-bold text-secondary-foreground">
                      {tx.other_name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-foreground">{tx.other_name}</p>
                  {tx.other_username && <p className="text-xs text-muted-foreground">@{tx.other_username}</p>}
                  <p className="text-xs text-muted-foreground">{format(new Date(tx.created_at), "MMM d, yyyy")}</p>
                  <p className="text-xs text-muted-foreground">
                    {tx.is_topup ? "Top up" : tx.is_sent ? "Payment" : "Received"}
                  </p>
                  {tx.note && <p className="text-xs text-muted-foreground">{toPreviewText(tx.note)}</p>}
                </div>
              </div>
              <p className={`font-semibold ${tx.is_sent && !tx.is_topup ? "text-red-500" : "text-paypal-success"}`}>
                {tx.is_topup ? "+" : tx.is_sent ? "-" : "+"}
                {formatCurrency(tx.amount)}
              </p>
            </button>
          ))}
        </div>
      )}
      <TransactionReceipt open={receiptOpen} onOpenChange={setReceiptOpen} receipt={receiptData} />
    </div>
  );
};

export default ActivityPage;
