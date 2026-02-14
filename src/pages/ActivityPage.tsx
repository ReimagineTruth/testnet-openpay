import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
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

const ActivityPage = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/signin"); return; }

      const { data: txs } = await supabase
        .from("transactions")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (txs) {
        const enriched = await Promise.all(txs.map(async (tx) => {
          const otherId = tx.sender_id === user.id ? tx.receiver_id : tx.sender_id;
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", otherId)
            .single();
          return { ...tx, other_name: profile?.full_name || "Unknown", is_sent: tx.sender_id === user.id };
        }));
        setTransactions(enriched);
      }
    };
    load();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center gap-3 px-4 pt-4 mb-4">
        <button onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Activity</h1>
      </div>

      <div className="px-4">
        {transactions.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No activity yet</p>
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
    </div>
  );
};

export default ActivityPage;
