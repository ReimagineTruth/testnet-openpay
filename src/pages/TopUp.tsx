import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/contexts/CurrencyContext";
import { getFunctionErrorMessage } from "@/lib/supabaseFunctionError";

const TopUp = () => {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { currency } = useCurrency();
  const sandbox = String(import.meta.env.VITE_PI_SANDBOX || "false").toLowerCase() === "true";

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
    if (payload && payload.success === false) {
      throw new Error(payload.error || fallbackError);
    }
  };

  const handleTopUp = async () => {
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!initPi() || !window.Pi) return;

    setLoading(true);
    try {
      const auth = await window.Pi.authenticate(["username", "payments"], async (payment) => {
        if (!payment.txid) return;
        try {
          await invokeTopUpAction(
            { action: "complete", paymentId: payment.identifier, txid: payment.txid },
            "Failed to recover previous payment",
          );
        } catch {
          // Do not block auth flow; SDK retries callback automatically.
        }
      });

      await supabase.auth.updateUser({
        data: {
          pi_uid: auth.user.uid,
          pi_username: auth.user.username,
          pi_connected_at: new Date().toISOString(),
        },
      });

      await new Promise<void>((resolve, reject) => {
        let completed = false;

        window.Pi!.createPayment(
          {
            amount: parsedAmount,
            memo: "OpenPay wallet top up",
            metadata: {
              feature: "top_up",
              amount: parsedAmount,
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

              await invokeTopUpAction(
                { action: "complete", paymentId, txid },
                "Pi server completion failed",
              );
              await invokeTopUpAction(
                { action: "credit", amount: parsedAmount, paymentId, txid },
                "Top up failed",
              );

              resolve();
            },
            onCancel: () => {
              reject(new Error("Payment cancelled"));
            },
            onError: (error) => {
              const message = error instanceof Error ? error.message : error.message || "Payment failed";
              reject(new Error(message));
            },
          },
        );
      });

      toast.success(`${currency.symbol}${parsedAmount.toFixed(2)} added to your balance!`);
      navigate("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Top up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 pt-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-6 w-6 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-paypal-dark">Top Up</h1>
      </div>

      <div className="paypal-surface mt-10 rounded-3xl p-6">
        <div className="mb-8 text-center">
          <p className="text-5xl font-bold text-foreground">
            {currency.symbol}
            {amount || "0.00"}
          </p>
          <p className="mt-2 text-muted-foreground">
            Enter amount to add · {currency.flag} {currency.code}
          </p>
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
        <Button
          onClick={handleTopUp}
          disabled={loading || !amount || Number(amount) <= 0}
          className="h-14 w-full rounded-full bg-paypal-blue text-lg font-semibold text-white hover:bg-[#004dc5]"
        >
          {loading ? "Processing Pi payment..." : `Pay with Pi and add ${currency.symbol}${amount || "0.00"}`}
        </Button>
      </div>
    </div>
  );
};

export default TopUp;
