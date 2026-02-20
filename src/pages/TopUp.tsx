import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/contexts/CurrencyContext";
import { getFunctionErrorMessage } from "@/lib/supabaseFunctionError";
import TransactionReceipt, { type ReceiptData } from "@/components/TransactionReceipt";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const TopUp = () => {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const navigate = useNavigate();
  const { currencies } = useCurrency();
  const usdCurrency = currencies.find((c) => c.code === "USD") ?? currencies[0];
  const sandbox = String(import.meta.env.VITE_PI_SANDBOX || "false").toLowerCase() === "true";
  const isPiBrowser = typeof navigator !== "undefined" && /pi\s?browser/i.test(navigator.userAgent || "");
  const parsedAmount = Number(amount);
  const safeAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;

  const initPi = () => {
    if (!window.Pi) {
      toast.error("Pi SDK not loaded. Open this app in Pi Browser.");
      return false;
    }
    window.Pi.init({ version: "2.0", sandbox });
    return true;
  };

  const invokeTopUpAction = async (body: Record<string, unknown>, fallbackError: string) => {
    const { data, error } = await supabase.functions.invoke("top-up", { body });
    if (error) throw new Error(await getFunctionErrorMessage(error, fallbackError));
    const payload = data as { success?: boolean; error?: string } | null;
    if (payload && payload.success === false) throw new Error(payload.error || fallbackError);
  };

  const verifyPiAccessToken = async (accessToken: string) => {
    const { data, error } = await supabase.functions.invoke("pi-platform", {
      body: { action: "auth_verify", accessToken },
    });
    if (error) throw new Error(await getFunctionErrorMessage(error, "Pi auth verification failed"));
    const payload = data as { success?: boolean; data?: { uid?: string; username?: string }; error?: string } | null;
    if (!payload?.success || !payload.data?.uid) throw new Error(payload?.error || "Pi auth verification failed");
    return { uid: String(payload.data.uid), username: String(payload.data.username || "") };
  };

  const handleTopUp = async () => {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!initPi() || !window.Pi) return;

    setLoading(true);
    try {
      const auth = await window.Pi.authenticate(["username", "payments"], async (payment) => {
        const incompleteTxid = payment.transaction?.txid;
        if (!incompleteTxid) return;
        try {
          await invokeTopUpAction(
            { action: "complete", paymentId: payment.identifier, txid: incompleteTxid },
            "Failed to recover previous payment",
          );
        } catch {
          // no-op
        }
      });

      const verified = await verifyPiAccessToken(auth.accessToken);
      await supabase.auth.updateUser({
        data: {
          pi_uid: verified.uid,
          pi_username: verified.username || auth.user.username,
          pi_connected_at: new Date().toISOString(),
        },
      });

      let completedPaymentId = "";
      let completedTxid = "";

      await new Promise<void>((resolve, reject) => {
        let completed = false;
        window.Pi!.createPayment(
          {
            amount: parsedAmount,
            memo: "OpenPay wallet top up (PI to USD)",
            metadata: {
              feature: "top_up",
              amount_pi: parsedAmount,
              amount_usd: parsedAmount,
              requestedAt: new Date().toISOString(),
            },
          },
          {
            onReadyForServerApproval: async (paymentId: string) => {
              await invokeTopUpAction({ action: "approve", paymentId }, "Pi server approval failed");
            },
            onReadyForServerCompletion: async (paymentId: string, txid: string) => {
              if (completed) return;
              completed = true;
              completedPaymentId = paymentId;
              completedTxid = txid;
              await invokeTopUpAction({ action: "complete", paymentId, txid }, "Pi server completion failed");
              await invokeTopUpAction(
                { action: "credit", amount: parsedAmount, amountUsd: parsedAmount, paymentId, txid },
                "Top up failed",
              );
              resolve();
            },
            onCancel: () => reject(new Error("Payment cancelled")),
            onError: (error) => reject(new Error(error instanceof Error ? error.message : error.message || "Payment failed")),
          },
        );
      });

      setReceiptData({
        transactionId: completedPaymentId || completedTxid || crypto.randomUUID(),
        type: "topup",
        amount: parsedAmount,
        note: "Pi Network top up (PI -> USD)",
        date: new Date(),
      });
      setReceiptOpen(true);
      toast.success(`${usdCurrency.symbol}${parsedAmount.toFixed(2)} added to your balance!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Top up failed");
    } finally {
      setLoading(false);
    }
  };

  const topUpButtonLabel = loading
    ? "Processing Pi payment..."
    : !isPiBrowser
      ? "Open in Pi Browser to top up"
      : safeAmount > 0
        ? `Pay with Pi: ${safeAmount.toFixed(2)} PI`
        : "Enter amount to Pay with Pi";

  return (
    <div className="min-h-screen bg-background px-4 pt-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/dashboard")}><ArrowLeft className="h-6 w-6 text-foreground" /></button>
        <h1 className="text-lg font-semibold text-paypal-dark">Top Up</h1>
        <button
          onClick={() => setShowInstructions(true)}
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground"
        >
          <HelpCircle className="h-4 w-4" />
          How it works
        </button>
      </div>

      <div className="paypal-surface mt-10 rounded-3xl p-6">
        <div className="mb-8 text-center">
          <p className="text-5xl font-bold text-foreground">{usdCurrency.symbol}{safeAmount.toFixed(2)}</p>
          <p className="mt-2 text-muted-foreground">Enter amount to add - {usdCurrency.flag} {usdCurrency.code}</p>
        </div>
        <Input
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mb-6 h-14 rounded-2xl border-white/70 bg-white text-center text-2xl"
          min="0.01"
          step="0.01"
        />
        <div className="mb-4 grid grid-cols-2 gap-3 text-center text-xs text-muted-foreground">
          <p className="rounded-xl border border-border px-3 py-2">Pay: {safeAmount.toFixed(2)} PI</p>
          <p className="rounded-xl border border-border px-3 py-2">Add: {usdCurrency.symbol}{safeAmount.toFixed(2)} USD</p>
        </div>
        <p className="mb-4 text-center text-xs text-muted-foreground">OpenPay uses a stable in-app value: 1 Pi = 1 USD.</p>
        <Button
          onClick={handleTopUp}
          disabled={loading || safeAmount <= 0 || !isPiBrowser}
          className="h-14 w-full rounded-full bg-paypal-blue text-lg font-semibold text-white hover:bg-[#004dc5]"
        >
          {topUpButtonLabel}
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Top up with Pi works only in Pi Browser. If you use OpenPay with email, sign in with the same email in Pi Browser first, then top up.
        </p>
      </div>

      <TransactionReceipt
        open={receiptOpen}
        onOpenChange={(open) => {
          setReceiptOpen(open);
          if (!open) navigate("/dashboard");
        }}
        receipt={receiptData}
      />

      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <DialogTitle className="text-xl font-bold text-foreground">Top Up Instructions</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            OpenPay top up works only with Pi payments.
          </DialogDescription>

          <div className="rounded-2xl border border-border p-3 text-sm text-foreground">
            <p>1. You can top up your OpenPay balance only with Pi.</p>
            <p>2. Top up payment works only in Pi Browser.</p>
            <p>3. If you use OpenPay app with email login, sign in with the same email in Pi Browser first, then top up.</p>
            <p>4. If you do not have Pi in your wallet, buy Pi in your Pi Wallet onramp first, then top up in OpenPay.</p>
            <p>5. You can also exchange with another OpenPay user or merchant who accepts real-currency exchange.</p>
            <p>6. OpenPay top up has no fee from OpenPay. A merchant may add exchange fee terms.</p>
          </div>

          <div className="rounded-2xl border border-paypal-light-blue/40 bg-paypal-light-blue/10 p-3 text-xs text-muted-foreground">
            OpenPay is an independent platform built for the Pi Network ecosystem and is not affiliated with any
            government authority or central bank. OpenPay is powered by the Pi digital currency. For more information,
            visit{" "}
            <a href="https://minepi.com" target="_blank" rel="noreferrer" className="font-semibold text-paypal-blue">
              minepi.com
            </a>
            .
          </div>

          <Button
            className="h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
            onClick={() => setShowInstructions(false)}
          >
            I Understand
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TopUp;
