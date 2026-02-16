import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { Bell, Settings } from "lucide-react";
import { format } from "date-fns";
import CurrencySelector from "@/components/CurrencySelector";
import { useCurrency } from "@/contexts/CurrencyContext";
import BrandLogo from "@/components/BrandLogo";
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
  other_username?: string;
  other_avatar_url?: string | null;
  is_sent?: boolean;
  is_topup?: boolean;
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const Dashboard = () => {
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userName, setUserName] = useState("");
  const [username, setUsername] = useState<string | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const navigate = useNavigate();
  const { format: formatCurrency, currency } = useCurrency();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/signin"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", user.id)
        .single();
      setUserName(profile?.full_name || "");
      setUsername(profile?.username || null);

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
        const enriched = await Promise.all(
          txs.map(async (tx) => {
            const otherId = tx.sender_id === user.id ? tx.receiver_id : tx.sender_id;
            const { data: p } = await supabase
              .from("profiles")
              .select("full_name, username, avatar_url")
              .eq("id", otherId)
              .single();
            return {
              ...tx,
              other_name: p?.full_name || "Unknown",
              other_username: p?.username || null,
              other_avatar_url: p?.avatar_url || null,
              is_sent: tx.sender_id === user.id,
              is_topup: tx.sender_id === user.id && tx.receiver_id === user.id,
            };
          }),
        );
        setTransactions(enriched);
      }
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
    <div className="min-h-screen bg-background pb-28">
      <div className="flex items-center justify-between px-4 pt-5">
        <CurrencySelector />
        <div className="flex gap-3">
          <button onClick={() => navigate("/notifications")} aria-label="Open notifications" className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full">
            <Bell className="h-5 w-5 text-foreground" />
          </button>
          <button onClick={() => navigate("/settings")} aria-label="Open settings" className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full">
            <Settings className="h-5 w-5 text-foreground" />
          </button>
        </div>
      </div>

      {/* Greeting */}
      <div className="px-4 mt-3">
        <h1 className="text-2xl font-bold text-foreground">{getGreeting()}, {userName.split(" ")[0] || "there"}!</h1>
        {username && <p className="text-sm text-muted-foreground">@{username}</p>}
      </div>

      <div className="mx-4 mt-4 rounded-3xl border border-white/30 bg-gradient-to-br from-paypal-blue to-[#0073e6] p-6 shadow-xl shadow-[#004bba]/25">
        <div className="flex items-center gap-3 text-white">
          <BrandLogo className="h-8 w-8" />
          <div>
            <p className="text-3xl font-bold">{formatCurrency(balance)}</p>
            <p className="text-sm text-white/85">Balance · {currency.code === "PI" ? "PI" : `PI ${currency.code}`}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 px-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-paypal-dark">Recent activity</h2>
          <button onClick={() => navigate("/activity")} className="text-sm font-semibold text-paypal-blue">See more →</button>
        </div>

        {transactions.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">No transactions yet</p>
        ) : (
          <div className="paypal-surface divide-y divide-border/70 rounded-3xl">
            {transactions.map((tx) => (
              <button key={tx.id} onClick={() => showReceipt(tx)} className="flex w-full items-center justify-between p-4 text-left hover:bg-secondary/40 transition">
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
                    {tx.note && <p className="text-xs text-muted-foreground">{tx.note}</p>}
                  </div>
                </div>
                <p className={`font-semibold ${tx.is_sent && !tx.is_topup ? "text-red-500" : "text-paypal-success"}`}>
                  {tx.is_topup ? "+" : tx.is_sent ? "-" : "+"}{formatCurrency(tx.amount)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-24 left-0 right-0 px-4 pb-1">
        <div className="flex gap-3">
          <button onClick={() => navigate("/send")} className="flex-1 rounded-full bg-paypal-blue py-3.5 text-center font-semibold text-white shadow-lg shadow-[#0057d8]/30">Pay</button>
          <button onClick={() => navigate("/receive")} className="flex-1 rounded-full border border-paypal-blue/25 bg-white py-3.5 text-center font-semibold text-paypal-blue">Receive</button>
          <button onClick={() => navigate("/topup")} className="flex-1 rounded-full border border-paypal-blue/25 bg-white py-3.5 text-center font-semibold text-paypal-blue">Top Up</button>
        </div>
      </div>

      <BottomNav active="home" />
      <TransactionReceipt open={receiptOpen} onOpenChange={setReceiptOpen} receipt={receiptData} />
    </div>
  );
};

export default Dashboard;
