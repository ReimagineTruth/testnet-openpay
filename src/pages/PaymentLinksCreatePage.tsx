import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import SplashScreen from "@/components/SplashScreen";

type Mode = "sandbox" | "live";
type LinkType = "products" | "custom_amount";

type Product = {
  id: string;
  product_name: string;
  unit_amount: number;
  currency: string;
  is_active: boolean;
};

const PaymentLinksCreatePage = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);

  const [mode, setMode] = useState<Mode>("sandbox");
  const [type, setType] = useState<LinkType>("products");
  const [secretKey, setSecretKey] = useState("");
  const [title, setTitle] = useState("OpenPay Payment");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [customAmount, setCustomAmount] = useState("");
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({});

  const [collectName, setCollectName] = useState(true);
  const [collectEmail, setCollectEmail] = useState(true);
  const [collectPhone, setCollectPhone] = useState(false);
  const [collectAddress, setCollectAddress] = useState(false);

  const [afterPaymentType, setAfterPaymentType] = useState<"confirmation" | "redirect">("confirmation");
  const [confirmationMessage, setConfirmationMessage] = useState("Thanks for your payment.");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [callToAction, setCallToAction] = useState("Pay");

  const [creating, setCreating] = useState(false);
  const [createdUrl, setCreatedUrl] = useState("");

  useEffect(() => {
    const boot = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const [{ data: profile }, { data: list }] = await Promise.all([
        db.from("merchant_profiles").select("default_currency").eq("user_id", user.id).maybeSingle(),
        db
          .from("merchant_products")
          .select("id, product_name, unit_amount, currency, is_active")
          .eq("merchant_user_id", user.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
      ]);

      if (profile?.default_currency) setCurrency(String(profile.default_currency).toUpperCase());
      setProducts((list || []) as Product[]);
      setLoading(false);
    };

    boot();
  }, [navigate]);

  const filteredProducts = useMemo(
    () => products.filter((p) => p.currency.toUpperCase() === currency.toUpperCase() && p.is_active),
    [products, currency],
  );

  const previewTotal = useMemo(() => {
    if (type === "custom_amount") return Number(customAmount || 0);
    return filteredProducts.reduce((sum, p) => sum + Number((selectedQty[p.id] || 0) * Number(p.unit_amount || 0)), 0);
  }, [type, customAmount, filteredProducts, selectedQty]);

  const handleCopy = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const createLink = async () => {
    const items = filteredProducts
      .map((p) => ({ product_id: p.id, quantity: Number(selectedQty[p.id] || 0) }))
      .filter((x) => x.quantity > 0);

    if (!secretKey.trim()) {
      toast.error("Secret key is required");
      return;
    }
    if (type === "products" && !items.length) {
      toast.error("Select at least one product");
      return;
    }
    if (type === "custom_amount" && Number(customAmount || 0) <= 0) {
      toast.error("Custom amount must be greater than 0");
      return;
    }

    setCreating(true);
    const { data, error } = await db.rpc("create_merchant_payment_link", {
      p_secret_key: secretKey.trim(),
      p_mode: mode,
      p_link_type: type,
      p_title: title,
      p_description: description,
      p_currency: currency.toUpperCase(),
      p_custom_amount: type === "custom_amount" ? Number(customAmount) : null,
      p_items: type === "products" ? items : [],
      p_collect_customer_name: collectName,
      p_collect_customer_email: collectEmail,
      p_collect_phone: collectPhone,
      p_collect_address: collectAddress,
      p_after_payment_type: afterPaymentType,
      p_confirmation_message: confirmationMessage,
      p_redirect_url: afterPaymentType === "redirect" ? redirectUrl : null,
      p_call_to_action: callToAction,
      p_expires_in_minutes: null,
    });
    setCreating(false);

    if (error) {
      toast.error(error.message || "Failed to create payment link");
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const token = row?.link_token || "";
    if (!token || typeof window === "undefined") {
      toast.error("Payment link token missing");
      return;
    }

    const url = `${window.location.origin}/merchant-checkout?payment_link=${encodeURIComponent(token)}`;
    setCreatedUrl(url);
    toast.success("Payment link created");
  };

  if (loading) {
    return <SplashScreen message="Loading payment link creator..." />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-[#0a2a66] px-4 py-2 text-center text-xs text-white">
        Create OpenPay payment links for sandbox or live mode.
      </div>

      <div className="grid min-h-[calc(100vh-32px)] grid-cols-1 xl:grid-cols-[1fr_420px]">
        <div className="p-4 md:p-6">
          <div className="mb-5 flex items-center gap-3">
            <button
              onClick={() => navigate("/merchant-onboarding")}
              className="flex h-10 w-10 items-center justify-center rounded-full border bg-white"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Create a payment link</h1>
              <p className="text-sm text-muted-foreground">OpenPay merchant payment links</p>
            </div>
          </div>

          <div className="space-y-5 rounded-2xl border bg-white p-5">
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-900">Select type</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setType("products")}
                  className={`h-10 rounded-lg border text-sm ${type === "products" ? "border-blue-600 text-blue-700" : "border-slate-300 text-slate-700"}`}
                >
                  Products
                </button>
                <button
                  onClick={() => setType("custom_amount")}
                  className={`h-10 rounded-lg border text-sm ${type === "custom_amount" ? "border-blue-600 text-blue-700" : "border-slate-300 text-slate-700"}`}
                >
                  Custom amount
                </button>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className="h-11 rounded-lg border bg-white px-3 text-sm">
                <option value="sandbox">sandbox</option>
                <option value="live">live</option>
              </select>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className="h-11 rounded-lg" placeholder="USD" />
              <Input value={secretKey} onChange={(e) => setSecretKey(e.target.value)} className="h-11 rounded-lg md:col-span-2" placeholder={`osk_${mode}_...`} />
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 rounded-lg" placeholder="Title" />
              <Input value={callToAction} onChange={(e) => setCallToAction(e.target.value)} className="h-11 rounded-lg" placeholder="Pay" />
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-11 rounded-lg md:col-span-2" placeholder="Description" />
            </div>

            {type === "products" ? (
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-900">Products</p>
                <div className="space-y-2">
                  {filteredProducts.map((p) => (
                    <div key={p.id} className="grid grid-cols-1 items-center gap-2 rounded-xl border p-2 sm:grid-cols-[1fr_120px]">
                      <p className="text-sm text-slate-900">{p.product_name} ({p.currency} {Number(p.unit_amount).toFixed(2)})</p>
                      <Input
                        value={String(selectedQty[p.id] || "")}
                        onChange={(e) => setSelectedQty((prev) => ({ ...prev, [p.id]: Number(e.target.value || 0) }))}
                        placeholder="Qty"
                        className="h-10 rounded-lg"
                      />
                    </div>
                  ))}
                  {!filteredProducts.length && <p className="text-sm text-muted-foreground">No active products for {currency}.</p>}
                </div>
              </div>
            ) : (
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-900">Custom amount</p>
                <Input value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} className="h-11 rounded-lg" placeholder={`Amount (${currency})`} />
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-900">Options</p>
              <div className="grid gap-2 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={collectName} onChange={(e) => setCollectName(e.target.checked)} /> Collect customer name</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={collectEmail} onChange={(e) => setCollectEmail(e.target.checked)} /> Collect customer email</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={collectPhone} onChange={(e) => setCollectPhone(e.target.checked)} /> Collect phone</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={collectAddress} onChange={(e) => setCollectAddress(e.target.checked)} /> Collect address</label>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-900">After payment</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setAfterPaymentType("confirmation")}
                  className={`h-10 rounded-lg border text-sm ${afterPaymentType === "confirmation" ? "border-blue-600 text-blue-700" : "border-slate-300 text-slate-700"}`}
                >
                  Confirmation page
                </button>
                <button
                  onClick={() => setAfterPaymentType("redirect")}
                  className={`h-10 rounded-lg border text-sm ${afterPaymentType === "redirect" ? "border-blue-600 text-blue-700" : "border-slate-300 text-slate-700"}`}
                >
                  Redirect
                </button>
              </div>
              {afterPaymentType === "confirmation" ? (
                <Input value={confirmationMessage} onChange={(e) => setConfirmationMessage(e.target.value)} className="mt-2 h-11 rounded-lg" placeholder="Thanks for your payment." />
              ) : (
                <Input value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} className="mt-2 h-11 rounded-lg" placeholder="https://your-site.com/thank-you" />
              )}
            </div>

            <Button onClick={createLink} disabled={creating} className="h-11 w-full rounded-lg">
              {creating ? "Creating link..." : "Create link"}
            </Button>

            {!!createdUrl && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                <p className="text-sm font-semibold text-blue-900">Payment link ready</p>
                <p className="mt-1 break-all text-xs text-blue-800">{createdUrl}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="outline" className="h-8 rounded-lg" onClick={() => handleCopy(createdUrl, "Payment link")}>Copy</Button>
                  <Button variant="outline" className="h-8 rounded-lg" onClick={() => window.open(createdUrl, "_blank")}>Open <ExternalLink className="ml-1 h-3.5 w-3.5" /></Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t bg-white p-4 sm:p-6 xl:border-l xl:border-t-0">
          <h2 className="text-2xl font-bold text-slate-900">Preview</h2>
          <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
            <p className="text-xs uppercase text-muted-foreground">{mode}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{title || "OpenPay Payment"}</p>
            {!!description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            <p className="mt-3 text-2xl font-bold text-slate-900">{currency} {Number(previewTotal || 0).toFixed(2)}</p>
            <p className="mt-2 text-xs text-muted-foreground">CTA: {callToAction || "Pay"}</p>
            <div className="mt-3 text-xs text-muted-foreground">
              <p>Collect name: {collectName ? "Yes" : "No"}</p>
              <p>Collect email: {collectEmail ? "Yes" : "No"}</p>
              <p>Collect phone: {collectPhone ? "Yes" : "No"}</p>
              <p>Collect address: {collectAddress ? "Yes" : "No"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentLinksCreatePage;
