import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { Bell, CircleDollarSign, Copy, CreditCard, Eye, EyeOff, FileText, HandCoins, PiggyBank, QrCode, RefreshCw, Settings, Users } from "lucide-react";
import { format } from "date-fns";
import CurrencySelector from "@/components/CurrencySelector";
import { useCurrency } from "@/contexts/CurrencyContext";
import BrandLogo from "@/components/BrandLogo";
import TransactionReceipt, { type ReceiptData } from "@/components/TransactionReceipt";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getAppCookie, loadUserPreferences, setAppCookie, upsertUserPreferences } from "@/lib/userPreferences";
import { isRemittanceUiEnabled } from "@/lib/remittanceAccess";

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

interface UserAccount {
  account_number: string;
  account_name: string;
  account_username: string;
}

type DashboardSection = "wallet" | "savings" | "credit" | "loans" | "cards";

interface SavingsDashboard {
  wallet_balance: number;
  savings_balance: number;
  apy: number;
}

interface LoanDashboard {
  id: string;
  principal_amount: number;
  outstanding_amount: number;
  monthly_payment_amount: number;
  monthly_fee_rate: number;
  term_months: number;
  paid_months: number;
  credit_score: number;
  status: string;
  next_due_date: string;
  created_at: string;
}

const getGreeting = () => "Good Day";

const Dashboard = () => {
  const remittanceUiEnabled = isRemittanceUiEnabled();
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userName, setUserName] = useState("");
  const [username, setUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingAlerts, setPendingAlerts] = useState(0);
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showReceiveOptions, setShowReceiveOptions] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [remittanceFeeIncome, setRemittanceFeeIncome] = useState(0);
  const [remittanceTxCount, setRemittanceTxCount] = useState(0);
  const [remittanceMonthIncome, setRemittanceMonthIncome] = useState(0);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [lastAdRunAt, setLastAdRunAt] = useState<number>(0);
  const [activeSection, setActiveSection] = useState<DashboardSection>("wallet");
  const [savings, setSavings] = useState<SavingsDashboard | null>(null);
  const [loan, setLoan] = useState<LoanDashboard | null>(null);
  const [movingToSavings, setMovingToSavings] = useState(false);
  const [movingToWallet, setMovingToWallet] = useState(false);
  const [requestingLoan, setRequestingLoan] = useState(false);
  const [payingLoan, setPayingLoan] = useState(false);
  const [savingsAmount, setSavingsAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [loanTermMonths, setLoanTermMonths] = useState("6");
  const [loanPaymentAmount, setLoanPaymentAmount] = useState("");
  const navigate = useNavigate();
  const { format: formatCurrency, currency } = useCurrency();
  const currencyTag = currency.code === "PI" ? "PI" : `${currency.code} (Pi rate)`;
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

  const loadSavingsAndLoan = async () => {
    const [{ data: savingsData }, { data: loanData }] = await Promise.all([
      supabase.rpc("get_my_savings_dashboard"),
      supabase.rpc("get_my_latest_loan"),
    ]);

    const savingsRow = Array.isArray(savingsData) ? savingsData[0] : null;
    const loanRow = Array.isArray(loanData) ? loanData[0] : null;

    setSavings(
      savingsRow
        ? {
            wallet_balance: Number(savingsRow.wallet_balance || 0),
            savings_balance: Number(savingsRow.savings_balance || 0),
            apy: Number(savingsRow.apy || 0),
          }
        : null,
    );

    setLoan(
      loanRow
        ? {
            id: String(loanRow.id),
            principal_amount: Number(loanRow.principal_amount || 0),
            outstanding_amount: Number(loanRow.outstanding_amount || 0),
            monthly_payment_amount: Number(loanRow.monthly_payment_amount || 0),
            monthly_fee_rate: Number(loanRow.monthly_fee_rate || 0),
            term_months: Number(loanRow.term_months || 0),
            paid_months: Number(loanRow.paid_months || 0),
            credit_score: Number(loanRow.credit_score || 620),
            status: String(loanRow.status || "none"),
            next_due_date: String(loanRow.next_due_date || ""),
            created_at: String(loanRow.created_at || ""),
          }
        : null,
    );
  };

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
        .select("full_name, username, referral_code")
        .eq("id", user.id)
        .single();
      setUserName(profile?.full_name || "");
      setUsername(profile?.username || null);
      if (profile?.referral_code) {
        setAppCookie(`openpay_ref_code_${user.id}`, profile.referral_code);
      }

      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .single();
      setBalance(wallet?.balance || 0);

      const { data: accountData } = await supabase.rpc("upsert_my_user_account");
      setUserAccount(accountData as unknown as UserAccount);

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

      const [requestsRes, invoicesRes] = await Promise.all([
        supabase
          .from("payment_requests")
          .select("id")
          .eq("payer_id", user.id)
          .eq("status", "pending"),
        supabase
          .from("invoices")
          .select("id")
          .eq("recipient_id", user.id)
          .eq("status", "pending"),
      ]);
      const pendingCount = (requestsRes.data?.length || 0) + (invoicesRes.data?.length || 0);
      setPendingAlerts(pendingCount);

      const agreementKey = `openpay_usage_agreement_v1_${user.id}`;
      const onboardingKey = `openpay_onboarding_done_v1_${user.id}`;
      const hideBalanceKey = `openpay_hide_balance_v1_${user.id}`;
      const refCookie = getAppCookie(`openpay_ref_code_${user.id}`) || getAppCookie("openpay_last_ref");
      let prefs = {
        hide_balance: false,
        usage_agreement_accepted: false,
        onboarding_completed: false,
        onboarding_step: 0,
      };
      try {
        const loadedPrefs = await loadUserPreferences(user.id);
        prefs = {
          hide_balance: loadedPrefs.hide_balance,
          usage_agreement_accepted: loadedPrefs.usage_agreement_accepted,
          onboarding_completed: loadedPrefs.onboarding_completed,
          onboarding_step: loadedPrefs.onboarding_step,
        };
        const remittanceRaw = loadedPrefs.merchant_onboarding_data?.remittance_center;
        const remittance =
          remittanceRaw && typeof remittanceRaw === "object" && !Array.isArray(remittanceRaw)
            ? (remittanceRaw as Record<string, unknown>)
            : {};
        setRemittanceFeeIncome(typeof remittance.totalFeeIncome === "number" ? remittance.totalFeeIncome : 0);
        setRemittanceMonthIncome(typeof remittance.thisMonthFeeIncome === "number" ? remittance.thisMonthFeeIncome : 0);
        setRemittanceTxCount(typeof remittance.totalRemittanceTxCount === "number" ? remittance.totalRemittanceTxCount : 0);
      } catch {
        // Fallback to local state if SQL preferences are not available yet.
        setRemittanceFeeIncome(0);
        setRemittanceMonthIncome(0);
        setRemittanceTxCount(0);
      }

      const hasAcceptedAgreement =
        prefs.usage_agreement_accepted ||
        (typeof window !== "undefined" && localStorage.getItem(agreementKey) === "1");
      const hasFinishedOnboarding =
        prefs.onboarding_completed ||
        (typeof window !== "undefined" && localStorage.getItem(onboardingKey) === "1");
      const hideBalance =
        prefs.hide_balance ||
        (typeof window !== "undefined" && localStorage.getItem(hideBalanceKey) === "1");

      if (refCookie && !profile?.referral_code) {
        await upsertUserPreferences(user.id, { reference_code: refCookie }).catch(() => undefined);
      }

      setBalanceHidden(hideBalance);
      setOnboardingStep(prefs.onboarding_step || 0);
      await loadSavingsAndLoan();

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

  useEffect(() => {
    const sandbox = String(import.meta.env.VITE_PI_SANDBOX || "false").toLowerCase() === "true";
    const inPiBrowser =
      typeof navigator !== "undefined" &&
      /pi\s?browser/i.test(navigator.userAgent || "");

    const runPiAdAuto = async () => {
      if (typeof window === "undefined" || document.visibilityState !== "visible") return;
      if (!inPiBrowser) return;
      if (!window.Pi?.Ads?.showAd) return;
      if (Date.now() - lastAdRunAt < 5 * 60 * 1000) return;

      try {
        window.Pi.init({ version: "2.0", sandbox });

        if (window.Pi.nativeFeaturesList) {
          const features = await window.Pi.nativeFeaturesList();
          if (!features.includes("ad_network")) return;
        }

        const adResult = await window.Pi.Ads.showAd("rewarded");
        if (adResult.result !== "AD_REWARDED" || !adResult.adId) {
          setLastAdRunAt(Date.now());
          return;
        }

        await supabase.functions.invoke("pi-platform", {
          body: { action: "ad_verify", adId: adResult.adId },
        });
        setLastAdRunAt(Date.now());
      } catch {
        // Silent by design: auto ad trigger should not interrupt dashboard usage.
      }
    };

    const initialTimer = window.setTimeout(() => {
      void runPiAdAuto();
    }, 2500);
    const intervalTimer = window.setInterval(() => {
      void runPiAdAuto();
    }, 5 * 60 * 1000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalTimer);
    };
  }, [lastAdRunAt]);

  const handleAcceptAgreement = () => {
    if (!userId || !agreementChecked) return;
    localStorage.setItem(`openpay_usage_agreement_v1_${userId}`, "1");
    setAppCookie(`openpay_usage_agreement_v1_${userId}`, "1");
    upsertUserPreferences(userId, { usage_agreement_accepted: true }).catch(() => undefined);
    setShowAgreement(false);
    if (localStorage.getItem(`openpay_onboarding_done_v1_${userId}`) !== "1") {
      setOnboardingStep(0);
      setShowOnboarding(true);
    }
  };

  const completeOnboarding = () => {
    if (!userId) return;
    localStorage.setItem(`openpay_onboarding_done_v1_${userId}`, "1");
    setAppCookie(`openpay_onboarding_done_v1_${userId}`, "1");
    upsertUserPreferences(userId, { onboarding_completed: true, onboarding_step: onboardingSteps.length - 1 }).catch(() => undefined);
    setShowOnboarding(false);
    setOnboardingStep(0);
  };

  const toggleBalanceHidden = () => {
    if (!userId) return;
    const next = !balanceHidden;
    setBalanceHidden(next);
    localStorage.setItem(`openpay_hide_balance_v1_${userId}`, next ? "1" : "0");
    setAppCookie(`openpay_hide_balance_v1_${userId}`, next ? "1" : "0");
    upsertUserPreferences(userId, { hide_balance: next }).catch(() => undefined);
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

  const copyAccountNumber = async () => {
    if (!userAccount?.account_number) return;
    try {
      await navigator.clipboard.writeText(userAccount.account_number);
      toast.success("Account number copied");
    } catch {
      toast.error("Unable to copy account number");
    }
  };

  const handleMoveWalletToSavings = async () => {
    const amount = Number(savingsAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setMovingToSavings(true);
    const { error } = await supabase.rpc("transfer_my_wallet_to_savings", {
      p_amount: amount,
      p_note: "Dashboard savings transfer",
    });
    setMovingToSavings(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSavingsAmount("");
    toast.success("Moved to savings");
    await loadDashboard();
  };

  const handleMoveSavingsToWallet = async () => {
    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setMovingToWallet(true);
    const { error } = await supabase.rpc("transfer_my_savings_to_wallet", {
      p_amount: amount,
      p_note: "Dashboard savings withdrawal",
    });
    setMovingToWallet(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setWithdrawAmount("");
    toast.success("Moved to wallet");
    await loadDashboard();
  };

  const handleRequestLoan = async () => {
    const principal = Number(loanAmount);
    const term = Number(loanTermMonths);
    if (!Number.isFinite(principal) || principal <= 0) {
      toast.error("Enter a valid loan amount");
      return;
    }
    if (!Number.isFinite(term) || term < 1) {
      toast.error("Enter valid term months");
      return;
    }
    setRequestingLoan(true);
    const { error } = await supabase.rpc("request_my_openpay_loan", {
      p_principal_amount: principal,
      p_term_months: term,
      p_credit_score: null,
    });
    setRequestingLoan(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setLoanAmount("");
    toast.success("Loan approved and credited to wallet");
    await loadDashboard();
  };

  const handlePayLoan = async () => {
    if (!loan?.id || loan.status !== "active") {
      toast.error("No active loan");
      return;
    }
    const payment = loanPaymentAmount ? Number(loanPaymentAmount) : null;
    if (loanPaymentAmount && (!Number.isFinite(payment) || Number(payment) <= 0)) {
      toast.error("Enter a valid payment amount");
      return;
    }
    setPayingLoan(true);
    const { error } = await supabase.rpc("pay_my_loan_monthly", {
      p_loan_id: loan.id,
      p_amount: payment,
      p_note: "Dashboard monthly loan payment",
    });
    setPayingLoan(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setLoanPaymentAmount("");
    toast.success("Loan payment completed");
    await loadDashboard();
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
          <button onClick={() => navigate("/notifications")} aria-label="Open notifications" className="paypal-surface relative flex h-10 w-10 items-center justify-center rounded-full">
            <Bell className="h-5 w-5 text-foreground" />
            {pendingAlerts > 0 && (
              <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />
            )}
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

      <div className="mt-4 px-4">
        <div className="paypal-surface overflow-x-auto rounded-2xl p-1">
          <div className="flex min-w-max gap-1">
            {([
              { key: "wallet", label: "Wallet" },
              { key: "savings", label: "Savings" },
              { key: "credit", label: "Credit" },
              { key: "loans", label: "Loans" },
              { key: "cards", label: "Cards" },
            ] as Array<{ key: DashboardSection; label: string }>).map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  activeSection === item.key
                    ? "bg-paypal-blue text-white"
                    : "text-foreground hover:bg-secondary/70"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Display currency: {currencyTag}</p>
      </div>

      {activeSection === "savings" && (
        <div className="mx-4 mt-4 paypal-surface rounded-3xl p-4">
          <div className="mb-3 flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-paypal-blue" />
            <h2 className="text-lg font-bold text-paypal-dark">Savings Dashboard</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/70 p-3">
              <p className="text-xs text-muted-foreground">Wallet balance</p>
              <p className="text-lg font-bold">{balanceHidden ? "****" : formatCurrency(savings?.wallet_balance ?? balance)}</p>
            </div>
            <div className="rounded-2xl border border-border/70 p-3">
              <p className="text-xs text-muted-foreground">Savings balance</p>
              <p className="text-lg font-bold">{balanceHidden ? "****" : formatCurrency(savings?.savings_balance ?? 0)}</p>
            </div>
            <div className="rounded-2xl border border-border/70 p-3">
              <p className="text-xs text-muted-foreground">Estimated APY</p>
              <p className="text-lg font-bold text-paypal-success">{(savings?.apy ?? 0).toFixed(2)}%</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/70 p-3">
              <p className="mb-2 text-sm font-semibold">Move wallet to savings</p>
              <input value={savingsAmount} onChange={(e) => setSavingsAmount(e.target.value)} type="number" min="0" step="0.01" placeholder={`Amount (${currency.code})`} className="mb-2 h-10 w-full rounded-xl border border-border px-3" />
              <button disabled={movingToSavings} onClick={handleMoveWalletToSavings} className="h-10 w-full rounded-xl bg-paypal-blue text-sm font-semibold text-white">
                {movingToSavings ? "Moving..." : "Move to Savings"}
              </button>
            </div>
            <div className="rounded-2xl border border-border/70 p-3">
              <p className="mb-2 text-sm font-semibold">Move savings to wallet</p>
              <input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} type="number" min="0" step="0.01" placeholder={`Amount (${currency.code})`} className="mb-2 h-10 w-full rounded-xl border border-border px-3" />
              <button disabled={movingToWallet} onClick={handleMoveSavingsToWallet} className="h-10 w-full rounded-xl border border-paypal-blue/40 bg-white text-sm font-semibold text-paypal-blue">
                {movingToWallet ? "Moving..." : "Move to Wallet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSection === "credit" && (
        <div className="mx-4 mt-4 paypal-surface rounded-3xl p-4">
          <div className="mb-3 flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-paypal-blue" />
            <h2 className="text-lg font-bold text-paypal-dark">Credit Overview</h2>
          </div>
          <div className="rounded-2xl border border-border/70 p-4">
            <p className="text-sm text-muted-foreground">Credit score</p>
            <p className="text-2xl font-bold text-foreground">{loan?.credit_score ?? 620}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Higher score can reduce monthly fee rate on OpenPay loans. Values shown in {currencyTag}.
            </p>
          </div>
          <div className="mt-3 rounded-2xl border border-border/70 p-4 text-sm text-muted-foreground">
            Credit uses your OpenPay account history, repayment behavior, and account security status.
          </div>
        </div>
      )}

      {activeSection === "loans" && (
        <div className="mx-4 mt-4 paypal-surface rounded-3xl p-4">
          <div className="mb-3 flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-paypal-blue" />
            <h2 className="text-lg font-bold text-paypal-dark">Loans</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/70 p-3">
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="text-lg font-bold">{balanceHidden ? "****" : formatCurrency(loan?.outstanding_amount ?? 0)}</p>
            </div>
            <div className="rounded-2xl border border-border/70 p-3">
              <p className="text-xs text-muted-foreground">Monthly payment</p>
              <p className="text-lg font-bold">{balanceHidden ? "****" : formatCurrency(loan?.monthly_payment_amount ?? 0)}</p>
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-border/70 p-3">
            <p className="mb-2 text-sm font-semibold">Request a new OpenPay loan</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} type="number" min="0" step="0.01" placeholder={`Loan amount (${currency.code})`} className="h-10 rounded-xl border border-border px-3" />
              <input value={loanTermMonths} onChange={(e) => setLoanTermMonths(e.target.value)} type="number" min="1" max="60" placeholder="Term months" className="h-10 rounded-xl border border-border px-3" />
            </div>
            <button disabled={requestingLoan} onClick={handleRequestLoan} className="mt-2 h-10 w-full rounded-xl bg-paypal-blue text-sm font-semibold text-white">
              {requestingLoan ? "Processing..." : "Request Loan"}
            </button>
          </div>
          <div className="mt-3 rounded-2xl border border-border/70 p-3">
            <p className="mb-2 text-sm font-semibold">Pay monthly installment</p>
            <input value={loanPaymentAmount} onChange={(e) => setLoanPaymentAmount(e.target.value)} type="number" min="0" step="0.01" placeholder={`Default: ${loan ? formatCurrency(loan.monthly_payment_amount) : `monthly due (${currency.code})`}`} className="h-10 w-full rounded-xl border border-border px-3" />
            <button disabled={payingLoan || !loan || loan.status !== "active"} onClick={handlePayLoan} className="mt-2 h-10 w-full rounded-xl border border-paypal-blue/40 bg-white text-sm font-semibold text-paypal-blue">
              {payingLoan ? "Paying..." : "Pay Loan"}
            </button>
          </div>
        </div>
      )}

      {activeSection === "cards" && (
        <div className="mx-4 mt-4 paypal-surface rounded-3xl p-4">
          <div className="mb-3 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-paypal-blue" />
            <h2 className="text-lg font-bold text-paypal-dark">Cards</h2>
          </div>
          <div className="rounded-2xl border border-border/70 p-4">
            <p className="text-sm font-semibold text-foreground">OpenPay Virtual Card</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage card controls, card signature, checkout permissions, and merchant payments.
            </p>
            <button onClick={() => navigate("/virtual-card")} className="mt-3 h-10 rounded-xl bg-paypal-blue px-4 text-sm font-semibold text-white">
              Open Virtual Card
            </button>
          </div>
        </div>
      )}

      {activeSection === "wallet" && (
      <>
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

      {userAccount && (
        <div className="mx-4 mt-4 paypal-surface rounded-3xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">OpenPay Account</p>
              <p className="mt-1 text-base font-bold text-foreground">{userAccount.account_name}</p>
              <p className="text-sm text-muted-foreground">@{userAccount.account_username}</p>
              <p className="mt-2 text-sm font-mono text-foreground">{userAccount.account_number}</p>
            </div>
            <button
              type="button"
              onClick={copyAccountNumber}
              className="rounded-xl border border-border/70 bg-white px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary"
            >
              <Copy className="mr-1 inline h-4 w-4" />
              Copy
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => navigate("/virtual-card")}
              className="rounded-xl bg-paypal-blue px-3 py-2 text-sm font-semibold text-white hover:bg-[#004dc5]"
            >
              Open Virtual Card
            </button>
          </div>
        </div>
      )}

      {remittanceUiEnabled && (
        <div className="mx-4 mt-4 grid gap-3 sm:grid-cols-3">
          <div className="paypal-surface rounded-2xl p-3">
            <p className="text-xs text-muted-foreground">Remittance fee income</p>
            <p className="mt-1 text-xl font-bold text-foreground">{balanceHidden ? "****" : formatCurrency(remittanceFeeIncome)}</p>
          </div>
          <div className="paypal-surface rounded-2xl p-3">
            <p className="text-xs text-muted-foreground">This month</p>
            <p className="mt-1 text-xl font-bold text-foreground">{balanceHidden ? "****" : formatCurrency(remittanceMonthIncome)}</p>
          </div>
          <button
            onClick={() => navigate("/remittance-merchant")}
            className="paypal-surface rounded-2xl p-3 text-left transition hover:bg-secondary/50"
          >
            <p className="text-xs text-muted-foreground">Remittance records</p>
            <p className="mt-1 text-xl font-bold text-foreground">{remittanceTxCount}</p>
            <p className="text-xs font-medium text-paypal-blue">Manage center</p>
          </button>
        </div>
      )}

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
          <button
            onClick={() => navigate("/contacts")}
            className="flex h-[54px] w-[54px] items-center justify-center rounded-full border border-paypal-blue/25 bg-white text-paypal-blue"
            aria-label="Open contacts"
          >
            <Users className="h-6 w-6" />
          </button>
          <button onClick={() => navigate("/send")} className="flex-1 rounded-full bg-paypal-blue py-3.5 text-center font-semibold text-white shadow-lg shadow-[#0057d8]/30">Pay</button>
          <button onClick={() => setShowReceiveOptions(true)} className="flex-1 rounded-full border border-paypal-blue/25 bg-white py-3.5 text-center font-semibold text-paypal-blue">Receive</button>
          <button onClick={() => navigate("/topup")} className="flex-1 rounded-full border border-paypal-blue/25 bg-white py-3.5 text-center font-semibold text-paypal-blue">Top Up</button>
        </div>
      </div>
      </>
      )}

      <BottomNav active="home" />
      <TransactionReceipt open={receiptOpen} onOpenChange={setReceiptOpen} receipt={receiptData} />

      <Dialog open={showReceiveOptions} onOpenChange={setShowReceiveOptions}>
        <DialogContent className="top-auto bottom-0 translate-y-0 rounded-b-none rounded-t-3xl px-5 pb-7 pt-5 sm:max-w-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom-8 data-[state=closed]:slide-out-to-bottom-8 data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0">
          <DialogTitle className="text-center text-2xl font-bold text-foreground">Ways to get paid</DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            Choose how you want to receive payment.
          </DialogDescription>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <button
              onClick={() => {
                setShowReceiveOptions(false);
                navigate("/receive");
              }}
              className="rounded-2xl border border-border/70 bg-secondary/50 p-3 text-center transition hover:bg-secondary"
            >
              <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-white">
                <QrCode className="h-5 w-5 text-paypal-blue" />
              </div>
              <p className="text-sm font-semibold text-foreground">Receive</p>
            </button>
            <button
              onClick={() => {
                setShowReceiveOptions(false);
                navigate("/request-payment");
              }}
              className="rounded-2xl border border-border/70 bg-secondary/50 p-3 text-center transition hover:bg-secondary"
            >
              <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-white">
                <CircleDollarSign className="h-5 w-5 text-paypal-blue" />
              </div>
              <p className="text-sm font-semibold text-foreground">Request</p>
            </button>
            <button
              onClick={() => {
                setShowReceiveOptions(false);
                navigate("/send-invoice");
              }}
              className="rounded-2xl border border-border/70 bg-secondary/50 p-3 text-center transition hover:bg-secondary"
            >
              <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-white">
                <FileText className="h-5 w-5 text-paypal-blue" />
              </div>
              <p className="text-sm font-semibold text-foreground">Invoice</p>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAgreement} onOpenChange={() => undefined}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogTitle className="text-xl font-bold text-foreground">Platform, User, and Merchant Protection Agreement</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            OpenPay is designed for Pi-powered internal balance transfers. By continuing, you agree to use OpenPay only under the protection rules below.
          </DialogDescription>
          <div className="rounded-2xl border border-border/70 p-3 text-sm text-foreground">
            <p>1. Use OpenPay only to transfer OpenPay balance backed by Pi.</p>
            <p>2. Do not use OpenPay for external wallet transfers or non-Pi crypto assets.</p>
            <p>3. Verify recipient and merchant details before every payment.</p>
            <p>4. Merchants must disclose any deposit/payout exchange fee before transaction confirmation.</p>
            <p>5. Users and merchants must not use OpenPay for fraud, abuse, or illegal transactions.</p>
            <p>6. Keep your account and security settings protected at all times.</p>
          </div>
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={agreementChecked}
              onChange={(e) => setAgreementChecked(e.target.checked)}
              className="mt-1"
            />
            I agree to the OpenPay Platform, User, and Merchant Protection Agreement, including Pi-only internal OpenPay transfer rules.
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
                onClick={() => {
                  const nextStep = onboardingStep + 1;
                  setOnboardingStep(nextStep);
                  if (userId) upsertUserPreferences(userId, { onboarding_step: nextStep }).catch(() => undefined);
                }}
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
