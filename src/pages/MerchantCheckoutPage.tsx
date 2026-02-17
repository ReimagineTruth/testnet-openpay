import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getFunctionErrorMessage } from "@/lib/supabaseFunctionError";

const MerchantCheckoutPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [viewerEmail, setViewerEmail] = useState("");
  const [merchantDisplayName, setMerchantDisplayName] = useState("");
  const [merchantDisplayUsername, setMerchantDisplayUsername] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [transactionId, setTransactionId] = useState("");

  const merchantId = searchParams.get("merchantId") || "";
  const productName = searchParams.get("productName") || "Merchant product";
  const productDescription = searchParams.get("description") || "";
  const productImage = searchParams.get("image") || "";
  const amount = Number(searchParams.get("amount") || "0");
  const currency = (searchParams.get("currency") || "USD").toUpperCase();
  const passedMerchantName = searchParams.get("merchantName") || "";
  const passedMerchantUsername = searchParams.get("merchantUsername") || "";

  const safeAmount = useMemo(() => (Number.isFinite(amount) && amount > 0 ? amount : 0), [amount]);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setViewerId(user.id);
        setViewerEmail(user.email || "");
        setCustomerEmail(user.email || "");
      }

      if (!merchantId) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", merchantId)
        .maybeSingle();

      setMerchantDisplayName(passedMerchantName || profile?.full_name || "OpenPay Merchant");
      setMerchantDisplayUsername(passedMerchantUsername || profile?.username || "");
    };

    load();
  }, [merchantId, passedMerchantName, passedMerchantUsername]);

  const handlePay = async () => {
    if (!merchantId) {
      toast.error("Invalid checkout link");
      return;
    }
    if (!safeAmount) {
      toast.error("Invalid amount");
      return;
    }
    if (!viewerId) {
      toast.message("Sign in first to complete payment");
      navigate("/auth");
      return;
    }
    if (viewerId === merchantId) {
      toast.error("Cannot pay your own checkout link");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }

    setPaying(true);
    try {
      const note = [
        `Merchant checkout: ${productName}`,
        productDescription ? `Description: ${productDescription}` : "",
        `Customer: ${customerName.trim()}`,
        customerEmail.trim() ? `Email: ${customerEmail.trim()}` : "",
        customerPhone.trim() ? `Phone: ${customerPhone.trim()}` : "",
        customerAddress.trim() ? `Address: ${customerAddress.trim()}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      const { data, error } = await supabase.functions.invoke("send-money", {
        body: {
          receiver_email: "__by_id__",
          receiver_id: merchantId,
          amount: safeAmount,
          note,
        },
      });
      if (error) {
        throw new Error(await getFunctionErrorMessage(error, "Payment failed"));
      }

      const txid = (data as { transaction_id?: string } | null)?.transaction_id || "";
      setTransactionId(txid);
      setPaid(true);

      const invoiceDescription = [
        `${productName}${productDescription ? ` · ${productDescription}` : ""}`,
        `Customer: ${customerName.trim()}`,
        customerEmail.trim() ? `Email: ${customerEmail.trim()}` : "",
        customerPhone.trim() ? `Phone: ${customerPhone.trim()}` : "",
        customerAddress.trim() ? `Address: ${customerAddress.trim()}` : "",
        txid ? `Checkout TX: ${txid}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      await supabase.from("invoices").insert({
        sender_id: viewerId,
        recipient_id: merchantId,
        amount: safeAmount,
        description: invoiceDescription,
        status: "paid",
      });

      toast.success("Payment successful");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-10">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full" aria-label="Back">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-paypal-dark">Merchant Checkout</h1>
      </div>

      <div className="rounded-3xl border border-white/30 bg-gradient-to-br from-paypal-blue to-[#0073e6] p-5 text-white shadow-xl shadow-[#004bba]/20">
        <p className="text-sm font-semibold uppercase tracking-wide">Pay with OpenPay</p>
        <p className="mt-1 text-lg font-bold">{merchantDisplayName || "OpenPay Merchant"}</p>
        {merchantDisplayUsername && <p className="text-sm text-white/90">@{merchantDisplayUsername}</p>}
      </div>

      <div className="paypal-surface mt-4 rounded-3xl p-5">
        <h2 className="font-semibold text-foreground">Product Details</h2>
        <div className="mt-3 flex gap-3">
          {productImage ? (
            <img src={productImage} alt={productName} className="h-20 w-20 rounded-2xl border border-border object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-secondary text-xs text-muted-foreground">No image</div>
          )}
          <div className="flex-1">
            <p className="text-base font-semibold text-foreground">{productName}</p>
            {productDescription && <p className="mt-1 text-sm text-muted-foreground">{productDescription}</p>}
            <p className="mt-2 text-lg font-bold text-paypal-dark">{currency} {safeAmount.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="paypal-surface mt-4 rounded-3xl p-5">
        <h2 className="font-semibold text-foreground">Customer Details</h2>
        <div className="mt-3 space-y-3">
          <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Full name" className="h-12 rounded-2xl bg-white" />
          <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="Email" className="h-12 rounded-2xl bg-white" />
          <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone number" className="h-12 rounded-2xl bg-white" />
          <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Address (optional)" className="h-12 rounded-2xl bg-white" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Payment deducts from your OpenPay balance and sends merchant payment instantly.
        </p>
        <Button
          onClick={handlePay}
          disabled={paying || !safeAmount || !customerName.trim()}
          className="mt-4 h-12 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
        >
          {paying ? "Processing payment..." : `Pay ${currency} ${safeAmount.toFixed(2)}`}
        </Button>
        {paid && (
          <div className="mt-3 rounded-2xl border border-paypal-blue/35 bg-paypal-blue/5 p-3 text-sm text-paypal-dark">
            Payment completed{transactionId ? ` · TX: ${transactionId}` : ""}.
            <button onClick={() => navigate("/dashboard")} className="ml-2 font-semibold text-paypal-blue">Go to dashboard</button>
          </div>
        )}
        {!viewerId && (
          <p className="mt-3 text-xs text-muted-foreground">
            You need to sign in to pay this checkout link.
          </p>
        )}
      </div>
    </div>
  );
};

export default MerchantCheckoutPage;
