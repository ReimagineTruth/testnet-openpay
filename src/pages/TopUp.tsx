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

  const handleTopUp = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setLoading(true);

    const { error } = await supabase.functions.invoke("top-up", {
      body: { amount: parseFloat(amount) },
    });

    setLoading(false);
    if (error) {
      toast.error(await getFunctionErrorMessage(error, "Top up failed"));
    } else {
      toast.success(`${currency.symbol}${parseFloat(amount).toFixed(2)} added to your balance!`);
      navigate("/dashboard");
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
          disabled={loading || !amount || parseFloat(amount) <= 0}
          className="h-14 w-full rounded-full bg-paypal-blue text-lg font-semibold text-white hover:bg-[#004dc5]"
        >
          {loading ? "Processing..." : `Add ${currency.symbol}${amount || "0.00"}`}
        </Button>
      </div>
    </div>
  );
};

export default TopUp;
