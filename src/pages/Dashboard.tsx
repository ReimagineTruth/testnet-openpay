import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { Bell, Settings } from "lucide-react";
import { format } from "date-fns";

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
}

const Dashboard = () => {
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/signin"); return; }
      setUserId(user.id);

      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .single();
      setBalance(wallet?.balance || 0);

      const { data: txs } = await supabase
        .from("transactions")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(10);

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
          };
        }));
        setTransactions(enriched);
      }
    };
    load();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="flex items-center justify-end px-4 pt-4 gap-3">
        <button className="w-10 h-10 rounded-full bg-card flex items-center justify-center shadow-sm border border-border">
          <Bell className="w-5 h-5 text-foreground" />
        </button>
        <button className="w-10 h-10 rounded-full bg-card flex items-center justify-center shadow-sm border border-border">
          <Settings className="w-5 h-5 text-foreground" />
        </button>
      </div>

      {/* Balance Card */}
      <div className="mx-4 mt-4 bg-card rounded-2xl p-5 shadow-sm border border-border">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 100 100" className="w-8 h-8">
            <path d="M35 20h20c12 0 20 8 20 20s-8 20-20 20H45v20H35V20z" fill="hsl(221 100% 27%)" opacity="0.5" />
            <path d="M40 25h20c10 0 17 7 17 17s-7 17-17 17H50v20H40V25z" fill="hsl(221 100% 27%)" />
          </svg>
          <div>
            <p className="text-3xl font-bold text-foreground">${balance.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">Balance</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground">Recent activity</h2>
          <button onClick={() => navigate("/activity")} className="text-sm text-muted-foreground flex items-center gap-1">
            See more →
          </button>
        </div>

        {transactions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No transactions yet</p>
        ) : (
          <div className="bg-card rounded-2xl shadow-sm border border-border divide-y divide-border">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center border-2 border-paypal-light-blue">
                    <span className="text-xs font-bold text-secondary-foreground">
                      {tx.other_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{tx.other_name}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(tx.created_at), "MMM d, yyyy")}</p>
                    <p className="text-xs text-muted-foreground">{tx.is_sent ? "Payment" : "Received"}</p>
                  </div>
                </div>
                <p className={`font-semibold ${tx.is_sent ? "text-foreground" : "text-paypal-success"}`}>
                  {tx.is_sent ? "-" : "+"}${tx.amount.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="fixed bottom-20 left-0 right-0 px-4 pb-2">
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/send")}
            className="flex-1 bg-foreground text-background font-bold py-4 rounded-full text-center"
          >
            Pay
          </button>
          <button
            onClick={() => navigate("/topup")}
            className="flex-1 bg-foreground text-background font-bold py-4 rounded-full text-center"
          >
            Top Up
          </button>
        </div>
      </div>

      <BottomNav active="home" />
    </div>
  );
};

export default Dashboard;
