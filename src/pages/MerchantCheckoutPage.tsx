import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getFunctionErrorMessage } from "@/lib/supabaseFunctionError";
import SplashScreen from "@/components/SplashScreen";

type CheckoutSessionPublic = {
  session_id: string;
  status: "open" | "paid" | "expired" | "canceled";
  mode: "sandbox" | "live";
  currency: string;
  amount: number;
  expires_at: string;
  merchant_user_id: string;
  merchant_name: string;
  merchant_username: string;
  merchant_logo_url: string | null;
  items: Array<{ item_name: string; quantity: number; unit_amount: number; line_total: number }>;
};

type PaymentLinkSessionCreate = {
  session_id: string;
  session_token: string;
  total_amount: number;
  currency: string;
  expires_at: string;
  after_payment_type: "confirmation" | "redirect";
  confirmation_message: string;
  redirect_url: string | null;
  call_to_action: string;
};

const MerchantCheckoutPage = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const rawSessionToken = searchParams.get("session") || searchParams.get("session_token") || "";
  const paymentLinkToken = searchParams.get("payment_link") || searchParams.get("link") || "";

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [viewerEmail, setViewerEmail] = useState("");

  const [sessionData, setSessionData] = useState<CheckoutSessionPublic | null>(null);
  const [linkSessionMeta, setLinkSessionMeta] = useState<PaymentLinkSessionCreate | null>(null);
  const [resolvedSessionToken, setResolvedSessionToken] = useState(rawSessionToken);
  const [loadingSession, setLoadingSession] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [transactionId, setTransactionId] = useState("");

  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiryMonth, setCardExpiryMonth] = useState("");
  const [cardExpiryYear, setCardExpiryYear] = useState("");
  const [cardCvc, setCardCvc] = useState("");

  const legacyMerchantId = searchParams.get("merchantId") || "";
  const legacyProductName = searchParams.get("productName") || "Merchant product";
  const legacyProductDescription = searchParams.get("description") || "";
  const legacyProductImage = searchParams.get("image") || "";
  const legacyAmount = Number(searchParams.get("amount") || "0");
  const legacyCurrency = (searchParams.get("currency") || "USD").toUpperCase();
  const legacyMerchantName = searchParams.get("merchantName") || "";
  const legacyMerchantUsername = searchParams.get("merchantUsername") || "";

  const isSessionCheckout = !!resolvedSessionToken;

  const safeLegacyAmount = useMemo(() => (Number.isFinite(legacyAmount) && legacyAmount > 0 ? legacyAmount : 0), [legacyAmount]);

  useEffect(() => {
    const boot = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setViewerId(user.id);
        setViewerEmail(user.email || "");
        setCustomerEmail(user.email || "");
      }

      let nextSessionToken = rawSessionToken;

      if (!nextSessionToken && paymentLinkToken) {
        setLoadingSession(true);
        const { data: sessionFromLink, error: linkError } = await db.rpc("create_checkout_session_from_payment_link", {
          p_link_token: paymentLinkToken,
          p_customer_email: user?.email || null,
          p_customer_name: null,
        });
        setLoadingSession(false);

        if (linkError) {
          toast.error(linkError.message || "Failed to create checkout from payment link");
          return;
        }

        const row = Array.isArray(sessionFromLink) ? sessionFromLink[0] : sessionFromLink;
        if (!row?.session_token) {
          toast.error("Payment link session token missing");
          return;
        }

        setLinkSessionMeta(row as PaymentLinkSessionCreate);
        nextSessionToken = row.session_token;
        setResolvedSessionToken(nextSessionToken);
      }

      setLoadingSession(true);
      const { data, error } = await db.rpc("get_public_merchant_checkout_session", { p_session_token: nextSessionToken });
      setLoadingSession(false);

      if (error) {
        toast.error(error.message || "Failed to load checkout session");
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        toast.error("Checkout session not found");
        return;
      }

      setSessionData(row as CheckoutSessionPublic);
    };

    boot();
  }, [rawSessionToken, paymentLinkToken]);

  const handlePaySession = async () => {
    if (!sessionData) {
      toast.error("Session data missing");
      return;
    }
    if (!viewerId) {
      toast.message("Sign in first to complete payment");
      navigate("/auth");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (!cardNumber.trim() || !cardExpiryMonth.trim() || !cardExpiryYear.trim() || !cardCvc.trim()) {
      toast.error("Card number, expiry month, expiry year, and CVC are required");
      return;
    }

    setPaying(true);
    try {
      const note = [
        `Merchant checkout session: ${resolvedSessionToken}`,
        `Customer: ${customerName.trim()}`,
        customerEmail.trim() ? `Email: ${customerEmail.trim()}` : "",
        customerPhone.trim() ? `Phone: ${customerPhone.trim()}` : "",
        customerAddress.trim() ? `Address: ${customerAddress.trim()}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      const { data: rpcTxId, error: rpcError } = await db.rpc("pay_merchant_checkout_with_virtual_card", {
        p_session_token: resolvedSessionToken,
        p_card_number: cardNumber,
        p_expiry_month: Number(cardExpiryMonth),
        p_expiry_year: Number(cardExpiryYear),
        p_cvc: cardCvc,
        p_note: note,
      });

      if (rpcError) throw rpcError;

      const txid = rpcTxId || "";
      setTransactionId(txid);
      setPaid(true);
      toast.success("Payment successful");

      if (linkSessionMeta?.after_payment_type === "redirect" && linkSessionMeta.redirect_url) {
        const target = new URL(linkSessionMeta.redirect_url);
        target.searchParams.set("tx", txid);
        target.searchParams.set("status", "paid");
        window.location.href = target.toString();
        return;
      }

      const { data: refreshed } = await db.rpc("get_public_merchant_checkout_session", { p_session_token: resolvedSessionToken });
      const next = Array.isArray(refreshed) ? refreshed[0] : refreshed;
      if (next) setSessionData(next as CheckoutSessionPublic);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const handlePayLegacy = async () => {
    if (!legacyMerchantId) {
      toast.error("Invalid checkout link");
      return;
    }
    if (!safeLegacyAmount) {
      toast.error("Invalid amount");
      return;
    }
    if (!viewerId) {
      toast.message("Sign in first to complete payment");
      navigate("/auth");
      return;
    }

    setPaying(true);
    try {
      const note = [
        `Merchant checkout: ${legacyProductName}`,
        legacyProductDescription ? `Description: ${legacyProductDescription}` : "",
        `Customer: ${customerName.trim()}`,
        customerEmail.trim() ? `Email: ${customerEmail.trim()}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      const { data, error } = await supabase.functions.invoke("send-money", {
        body: {
          receiver_email: "__by_id__",
          receiver_id: legacyMerchantId,
          amount: safeLegacyAmount,
          note,
        },
      });

      if (error) throw new Error(await getFunctionErrorMessage(error, "Payment failed"));

      const txid = (data as { transaction_id?: string } | null)?.transaction_id || "";
      setTransactionId(txid);
      setPaid(true);
      toast.success("Payment successful");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const merchantName = isSessionCheckout ? (sessionData?.merchant_name || "OpenPay Merchant") : legacyMerchantName || "OpenPay Merchant";
  const merchantUsername = isSessionCheckout ? (sessionData?.merchant_username || "") : legacyMerchantUsername;
  const currency = isSessionCheckout ? (sessionData?.currency || "USD") : legacyCurrency;
  const amount = isSessionCheckout ? Number(sessionData?.amount || 0) : safeLegacyAmount;

  if (isSessionCheckout && loadingSession && !sessionData) {
    return <SplashScreen message="Loading checkout..." />;
  }

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
        <p className="mt-1 text-lg font-bold">{merchantName}</p>
        {!!merchantUsername && <p className="text-sm text-white/90">@{merchantUsername}</p>}
        {isSessionCheckout && sessionData && <p className="mt-2 text-xs text-white/80">Mode: {sessionData.mode} | Status: {sessionData.status}</p>}
      </div>

      <div className="paypal-surface mt-4 rounded-3xl p-5">
        <h2 className="font-semibold text-foreground">Order</h2>

        {loadingSession && <p className="mt-2 text-sm text-muted-foreground">Loading checkout session...</p>}

        {isSessionCheckout && sessionData ? (
          <div className="mt-3 space-y-2">
            {sessionData.items?.map((item, idx) => (
              <div key={`${item.item_name}-${idx}`} className="flex items-center justify-between rounded-xl border border-border p-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.item_name}</p>
                  <p className="text-xs text-muted-foreground">Qty {item.quantity} x {currency} {Number(item.unit_amount).toFixed(2)}</p>
                </div>
                <p className="text-sm font-bold text-foreground">{currency} {Number(item.line_total).toFixed(2)}</p>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-xl bg-secondary/60 p-3">
              <p className="text-sm font-semibold text-foreground">Total</p>
              <p className="text-lg font-bold text-paypal-dark">{currency} {amount.toFixed(2)}</p>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex gap-3">
            {legacyProductImage ? (
              <img src={legacyProductImage} alt={legacyProductName} className="h-20 w-20 rounded-2xl border border-border object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-secondary text-xs text-muted-foreground">No image</div>
            )}
            <div className="flex-1">
              <p className="text-base font-semibold text-foreground">{legacyProductName}</p>
              {legacyProductDescription && <p className="mt-1 text-sm text-muted-foreground">{legacyProductDescription}</p>}
              <p className="mt-2 text-lg font-bold text-paypal-dark">{currency} {amount.toFixed(2)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="paypal-surface mt-4 rounded-3xl p-5">
        <h2 className="font-semibold text-foreground">Customer Details</h2>
        <div className="mt-3 space-y-3">
          <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Full name" className="h-12 rounded-2xl bg-white" />
          <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="Email" className="h-12 rounded-2xl bg-white" />
          <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone number" className="h-12 rounded-2xl bg-white" />
          <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Address (optional)" className="h-12 rounded-2xl bg-white" />
        </div>

        {isSessionCheckout && (
          <div className="mt-4 rounded-2xl border border-border/70 p-3">
            <p className="text-sm font-semibold text-foreground">Virtual Card Payment</p>
            <div className="mt-3 space-y-2">
              <Input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="Card number" className="h-11 rounded-2xl bg-white font-mono" />
              <div className="grid grid-cols-3 gap-2">
                <Input value={cardExpiryMonth} onChange={(e) => setCardExpiryMonth(e.target.value)} placeholder="MM" className="h-11 rounded-2xl bg-white font-mono" />
                <Input value={cardExpiryYear} onChange={(e) => setCardExpiryYear(e.target.value)} placeholder="YYYY" className="h-11 rounded-2xl bg-white font-mono" />
                <Input value={cardCvc} onChange={(e) => setCardCvc(e.target.value)} placeholder="CVC" className="h-11 rounded-2xl bg-white font-mono" />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">This checkout session supports OpenPay virtual card payment.</p>
          </div>
        )}

        <Button
          onClick={isSessionCheckout ? handlePaySession : handlePayLegacy}
          disabled={
            paying ||
            !amount ||
            !customerName.trim() ||
            (isSessionCheckout && (!cardNumber.trim() || !cardExpiryMonth.trim() || !cardExpiryYear.trim() || !cardCvc.trim()))
          }
          className="mt-4 h-12 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
        >
          {paying ? "Processing payment..." : `Pay ${currency} ${amount.toFixed(2)}`}
        </Button>

        {paid && (
          <div className="mt-3 rounded-2xl border border-paypal-blue/35 bg-paypal-blue/5 p-3 text-sm text-paypal-dark">
            {linkSessionMeta?.confirmation_message || "Payment completed"}{transactionId ? ` | TX: ${transactionId}` : ""}.
            <button onClick={() => navigate("/dashboard")} className="ml-2 font-semibold text-paypal-blue">Go to dashboard</button>
          </div>
        )}

        {!viewerId && <p className="mt-3 text-xs text-muted-foreground">You need to sign in to pay this checkout link.</p>}
        {!!viewerEmail && <p className="mt-2 text-xs text-muted-foreground">Signed in as {viewerEmail}</p>}
      </div>
    </div>
  );
};

export default MerchantCheckoutPage;
