import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { Bell, Eye, EyeOff, RefreshCw, Settings } from "lucide-react";
import { format } from "date-fns";
import CurrencySelector from "@/components/CurrencySelector";
import { useCurrency } from "@/contexts/CurrencyContext";
import BrandLogo from "@/components/BrandLogo";
import TransactionReceipt, { type ReceiptData } from "@/components/TransactionReceipt";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
  const [userId, setUserId] = useState<string>("");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const navigate = useNavigate();
  const { format: formatCurrency, currency } = useCurrency();
  const onboardingSteps = [
    {
      title: "Welcome to OpenPay",
      description: "Use OpenPay as a stable Pi payment experience for daily transfers and business payments.",
    },
    {
      title: "Send Fast and Safely",
      description: "Go to Pay to choose a contact, scan QR, review details, and confirm each transfer.",
    },
    {
      title: "Receive and Request",
      description: "Use Receive and Request Money to collect payments for goods, services, and personal transfers.",
    },
    {
      title: "Grow with Affiliate",
      description: "Invite users from the Affiliate page and claim rewards when your referrals sign up.",
    },
    {
      title: "Where OpenPay Works",
      description: "Open the new OpenPay Guide page to see use cases for restaurants, shops, clothing, and digital services.",
    },
  ];

  const loadDashboard = async () => {
    setRefreshing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { 
        setRefreshing(false);
        navigate("/signin"); 
        return; 
      }
      setUserId(user.id);

      const { data: claimResult } = await supabase.rpc("claim_welcome_bonus");
      if ((claimResult as { claimed?: boolean } | null)?.claimed) {
        toast.success("Welcome bonus claimed: +1 balance");
      }

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

      const agreementKey = `openpay_usage_agreement_v1_${user.id}`;
      const onboardingKey = `openpay_onboarding_done_v1_${user.id}`;
      const hasAcceptedAgreement = typeof window !== "undefined" && localStorage.getItem(agreementKey) === "1";
      const hasFinishedOnboarding = typeof window !== "undefined" && localStorage.getItem(onboardingKey) === "1";
      const hideBalanceKey = `openpay_hide_balance_v1_${user.id}`;
      const hideBalance = typeof window !== "undefined" && localStorage.getItem(hideBalanceKey) === "1";
      setBalanceHidden(hideBalance);

      if (!hasAcceptedAgreement) {
        setShowAgreement(true);
        setShowOnboarding(false);
      } else if (!hasFinishedOnboarding) {
        setShowOnboarding(true);
      }
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [navigate]);

  const handleAcceptAgreement = () => {
    if (!userId || !agreementChecked) return;
    localStorage.setItem(`openpay_usage_agreement_v1_${userId}`, "1");
    setShowAgreement(false);
    if (localStorage.getItem(`openpay_onboarding_done_v1_${userId}`) !== "1") {
      setOnboardingStep(0);
      setShowOnboarding(true);
    }
  };

  const completeOnboarding = () => {
    if (!userId) return;
    localStorage.setItem(`openpay_onboarding_done_v1_${userId}`, "1");
    setShowOnboarding(false);
    setOnboardingStep(0);
  };

  const toggleBalanceHidden = () => {
    if (!userId) return;
    const next = !balanceHidden;
    setBalanceHidden(next);
    localStorage.setItem(`openpay_hide_balance_v1_${userId}`, next ? "1" : "0");
  };

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
          <button
            onClick={loadDashboard}
            aria-label="Refresh dashboard"
            className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full"
            disabled={refreshing}
          >
            <RefreshCw className={`h-5 w-5 text-foreground ${refreshing ? "animate-spin" : ""}`} />
          </button>
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
            <p className="text-3xl font-bold">{balanceHidden ? "****" : formatCurrency(balance)}</p>
            <p className="text-sm text-white/85">Balance · {currency.code === "PI" ? "PI" : `PI ${currency.code}`}</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={toggleBalanceHidden}
            aria-label={balanceHidden ? "Show balance" : "Hide balance"}
            className="paypal-surface flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold text-foreground"
          >
            {balanceHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {balanceHidden ? "Show balance" : "Hide balance"}
          </button>
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
                  {balanceHidden ? "****" : `${tx.is_topup ? "+" : tx.is_sent ? "-" : "+"}${formatCurrency(tx.amount)}`}
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

      <Dialog open={showAgreement} onOpenChange={() => undefined}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogTitle className="text-xl font-bold text-foreground">OpenPay User Agreement</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            OpenPay is designed for stable Pi payments between users and businesses. By continuing, you agree to use OpenPay responsibly and lawfully.
          </DialogDescription>
          <div className="rounded-2xl border border-border/70 p-3 text-sm text-foreground">
            <p>1. Verify recipient details before sending.</p>
            <p>2. Do not use OpenPay for fraud, abuse, or illegal transactions.</p>
            <p>3. Keep your account and security settings protected.</p>
            <p>4. Respect merchant terms when paying for goods/services.</p>
          </div>
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={agreementChecked}
              onChange={(e) => setAgreementChecked(e.target.checked)}
              className="mt-1"
            />
            I agree to the OpenPay Terms, Privacy Policy, and Legal usage conditions.
          </label>
          <div className="flex items-center justify-between text-xs">
            <Link to="/terms" className="font-medium text-paypal-blue">Terms</Link>
            <Link to="/privacy" className="font-medium text-paypal-blue">Privacy</Link>
            <Link to="/legal" className="font-medium text-paypal-blue">Legal</Link>
          </div>
          <Button
            className="h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
            disabled={!agreementChecked}
            onClick={handleAcceptAgreement}
          >
            Accept and Continue
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showOnboarding} onOpenChange={setShowOnboarding}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-paypal-blue">
            Step {onboardingStep + 1} of {onboardingSteps.length}
          </div>
          <DialogTitle className="text-xl font-bold text-foreground">{onboardingSteps[onboardingStep].title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">{onboardingSteps[onboardingStep].description}</DialogDescription>

          <div className="mt-3 flex gap-1.5">
            {onboardingSteps.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 flex-1 rounded-full ${index <= onboardingStep ? "bg-paypal-blue" : "bg-border"}`}
              />
            ))}
          </div>

          <div className="mt-2 rounded-2xl border border-border/70 p-3 text-sm text-muted-foreground">
            Pro tip: you can revisit support and usage guidance anytime from Menu.
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="h-11 flex-1 rounded-2xl" onClick={completeOnboarding}>
              Skip
            </Button>
            {onboardingStep < onboardingSteps.length - 1 ? (
              <Button
                className="h-11 flex-1 rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
                onClick={() => setOnboardingStep((step) => step + 1)}
              >
                Next
              </Button>
            ) : (
              <Button
                className="h-11 flex-1 rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
                onClick={completeOnboarding}
              >
                Finish
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
