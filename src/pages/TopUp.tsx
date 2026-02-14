import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const TopUp = () => {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleTopUp = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setLoading(true);

    const { data, error } = await supabase.functions.invoke("top-up", {
      body: { amount: parseFloat(amount) },
    });

    setLoading(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Top up failed");
    } else {
      toast.success(`$${parseFloat(amount).toFixed(2)} added to your balance!`);
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center gap-3 px-4 pt-4">
        <button onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">Top Up</h1>
      </div>

      <div className="px-4 mt-12">
        <div className="text-center mb-8">
          <p className="text-5xl font-bold text-foreground">${amount || "0.00"}</p>
          <p className="text-muted-foreground mt-2">Enter amount to add</p>
        </div>
        <Input
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-14 rounded-xl text-center text-2xl mb-6"
          min="0.01"
          step="0.01"
        />
        <Button
          onClick={handleTopUp}
          disabled={loading || !amount || parseFloat(amount) <= 0}
          className="w-full h-14 rounded-full bg-foreground text-background text-lg font-bold"
        >
          {loading ? "Processing..." : `Add $${amount || "0.00"}`}
        </Button>
      </div>
    </div>
  );
};

export default TopUp;
