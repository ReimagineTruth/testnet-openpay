import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { useCurrency } from "@/contexts/CurrencyContext";

interface Transaction {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  note: string;
  status: string;
  created_at: string;
  other_name?: string;
  is_sent?: boolean;
  is_topup?: boolean;
}

const ActivityPage = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const navigate = useNavigate();
  const { format: formatCurrency } = useCurrency();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/signin"); return; }

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
            .select("full_name")
            .eq("id", otherId)
            .single();
          return {
            ...tx,
            other_name: profile?.full_name || "Unknown",
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
              is_sent: false,
              is_topup: true,
            }]
          : [];
        setTransactions([...bonusTx, ...enriched]);
      }
    };
    load();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background px-4 pt-4">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-paypal-dark">Activity</h1>
      </div>

      {transactions.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No activity yet</p>
      ) : (
        <div className="paypal-surface divide-y divide-border/70 rounded-3xl">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-paypal-light-blue/50 bg-secondary">
                  <span className="text-xs font-bold text-secondary-foreground">
                    {tx.other_name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-foreground">{tx.other_name}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(tx.created_at), "MMM d, yyyy")}</p>
                  <p className="text-xs text-muted-foreground">
                    {tx.is_topup ? "Top up" : tx.is_sent ? "Payment" : "Received"}
                  </p>
                  {tx.note && <p className="text-xs text-muted-foreground">{tx.note}</p>}
                </div>
              </div>
              <p className={`font-semibold ${tx.is_sent && !tx.is_topup ? "text-red-500" : "text-paypal-success"}`}>
                {tx.is_topup ? "+" : tx.is_sent ? "-" : "+"}
                {formatCurrency(tx.amount)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivityPage;
