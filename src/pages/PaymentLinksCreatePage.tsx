import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Copy, ExternalLink, Link2, Menu, MessageCircle, MoreHorizontal, Plus, X } from "lucide-react";
import { toast } from "sonner";

import BrandLogo from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SplashScreen from "@/components/SplashScreen";
import { supabase } from "@/integrations/supabase/client";

type Mode = "sandbox" | "live";
type LinkType = "products" | "custom_amount";

type Product = {
  id: string;
  product_name: string;
  unit_amount: number;
  currency: string;
  is_active: boolean;
};

type PaymentLinkRow = {
  id: string;
  link_token: string;
  key_mode: Mode;
  link_type: LinkType;
  title: string;
  currency: string;
  custom_amount: number | null;
  is_active: boolean;
  created_at: string;
};

const PaymentLinksCreatePage = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [merchantUserId, setMerchantUserId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLinkRow[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);

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

  const [billingType, setBillingType] = useState<"one_time" | "subscription">("one_time");
  const [coverPlatformFee, setCoverPlatformFee] = useState(false);
  const [coverProcessingFee, setCoverProcessingFee] = useState(false);
  const [repeatEvery, setRepeatEvery] = useState("1");
  const [repeatUnit, setRepeatUnit] = useState<"day" | "week" | "month" | "year">("month");

  const [creating, setCreating] = useState(false);
  const [createdUrl, setCreatedUrl] = useState("");
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const loadPaymentLinks = async (userId: string) => {
    const { data } = await db
      .from("merchant_payment_links")
      .select("id, link_token, key_mode, link_type, title, currency, custom_amount, is_active, created_at")
      .eq("merchant_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    setPaymentLinks((data || []) as PaymentLinkRow[]);
  };

  useEffect(() => {
    const boot = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      setMerchantUserId(user.id);

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
      await loadPaymentLinks(user.id);
      setLoading(false);
    };

    void boot();
  }, [navigate]);

  const filteredProducts = useMemo(
    () => products.filter((p) => p.currency.toUpperCase() === currency.toUpperCase() && p.is_active),
    [products, currency],
  );

  const previewTotal = useMemo(() => {
    if (type === "custom_amount") return Number(customAmount || 0);
    return filteredProducts.reduce((sum, p) => sum + Number((selectedQty[p.id] || 0) * Number(p.unit_amount || 0)), 0);
  }, [type, customAmount, filteredProducts, selectedQty]);

  const displayAmount = Number(previewTotal || 0).toFixed(2);

  const handleCopy = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const formatLinkUrl = (token: string) =>
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/payment-link/${encodeURIComponent(token)}`;

  const formatCreatedDate = (raw: string) => {
    try {
      return new Date(raw).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return raw;
    }
  };

  const formatLinkAmountLabel = (link: PaymentLinkRow) => {
    if (link.link_type === "custom_amount" && Number(link.custom_amount || 0) > 0) {
      return `${link.currency} ${Number(link.custom_amount || 0).toFixed(2)} one-time`;
    }
    return `${link.currency} variable amount`;
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
    if (!token) {
      toast.error("Payment link token missing");
      return;
    }

    const url = formatLinkUrl(token);
    setCreatedUrl(url);
    setShowCreateForm(false);
    setShareModalOpen(true);
    toast.success("Payment link created");
    if (merchantUserId) {
      await loadPaymentLinks(merchantUserId);
    }
  };

  if (loading) {
    return <SplashScreen message="Loading payment links..." />;
  }

  if (showCreateForm) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-full p-2 text-foreground hover:bg-secondary"
                aria-label="Close create payment link"
              >
                <X className="h-5 w-5" />
              </button>
              <p className="text-lg font-semibold text-foreground">Create payment link</p>
            </div>
            <Button
              onClick={createLink}
              disabled={creating}
              className="h-10 rounded-full bg-paypal-blue px-5 text-white hover:bg-[#004dc5]"
            >
              {creating ? "Creating..." : "Create payment link"}
            </Button>
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-[1600px] gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="border-r border-border">
            <div className="h-[calc(100vh-69px)] overflow-y-auto px-6 py-6">
              <div className="max-w-2xl space-y-8">
                <section>
                  <h2 className="text-2xl font-semibold text-foreground">Details</h2>
                  <div className="mt-5 space-y-4">
                    <div>
                      <p className="mb-2 text-sm font-semibold text-foreground">Link to</p>
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value as LinkType)}
                        className="h-12 w-full rounded-xl border border-border bg-background px-3 text-sm"
                      >
                        <option value="products">Select product or service</option>
                        <option value="custom_amount">Custom amount</option>
                      </select>
                      <p className="mt-1 text-xs text-muted-foreground">Optional</p>
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-semibold text-foreground">Title</p>
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="h-12 rounded-xl"
                        placeholder="What are you charging for?"
                      />
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-semibold text-foreground">Description</p>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="min-h-[180px] w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-paypal-blue"
                        placeholder="Add details or notes"
                      />
                    </div>
                  </div>
                </section>

                <section className="border-t border-border pt-7">
                  <h3 className="text-2xl font-semibold text-foreground">Payment details</h3>
                  <div className="mt-5 space-y-5">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBillingType("one_time")}
                        className={`h-20 rounded-xl border text-center ${billingType === "one_time" ? "border-foreground text-foreground" : "border-border text-muted-foreground"}`}
                      >
                        <p className="text-lg font-semibold">One-time</p>
                        <p className="text-sm">Charge a one-time amount</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillingType("subscription")}
                        className={`h-20 rounded-xl border text-center ${billingType === "subscription" ? "border-foreground text-foreground" : "border-border text-muted-foreground"}`}
                      >
                        <p className="text-lg font-semibold">Subscription</p>
                        <p className="text-sm">Charge an ongoing amount</p>
                      </button>
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-semibold text-foreground">Amount</p>
                      <Input
                        value={customAmount}
                        onChange={(e) => {
                          setCustomAmount(e.target.value);
                          setType("custom_amount");
                        }}
                        className="h-12 rounded-xl"
                        placeholder="$ 0.00"
                      />
                    </div>

                    <div>
                      <p className="text-xl font-semibold text-foreground">Decide who pays the fee</p>
                      <p className="mt-1 text-sm text-muted-foreground">We updated our fee structure.</p>
                      <div className="mt-3 rounded-xl border border-border p-3">
                        <label className="flex items-start justify-between gap-3 py-2">
                          <div>
                            <p className="font-medium text-foreground">I&apos;ll cover platform fee</p>
                            <p className="text-sm text-muted-foreground">To be calculated</p>
                          </div>
                          <input type="checkbox" checked={coverPlatformFee} onChange={(e) => setCoverPlatformFee(e.target.checked)} />
                        </label>
                        <label className="flex items-start justify-between gap-3 border-t border-border py-2">
                          <div>
                            <p className="font-medium text-foreground">I&apos;ll cover processing fees</p>
                            <p className="text-sm text-muted-foreground">To be calculated</p>
                          </div>
                          <input type="checkbox" checked={coverProcessingFee} onChange={(e) => setCoverProcessingFee(e.target.checked)} />
                        </label>
                      </div>
                    </div>

                    {billingType === "subscription" && (
                      <div>
                        <p className="mb-2 text-xl font-semibold text-foreground">Repeat payment every</p>
                        <div className="grid grid-cols-2 gap-2">
                          <Input value={repeatEvery} onChange={(e) => setRepeatEvery(e.target.value)} type="number" min="1" className="h-12 rounded-xl" />
                          <select
                            value={repeatUnit}
                            onChange={(e) => setRepeatUnit(e.target.value as "day" | "week" | "month" | "year")}
                            className="h-12 rounded-xl border border-border bg-background px-3"
                          >
                            <option value="day">day</option>
                            <option value="week">week</option>
                            <option value="month">month</option>
                            <option value="year">year</option>
                          </select>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Customers will be charged {currency} {displayAmount} every {repeatUnit}, starting from the first payment.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className="h-12 rounded-xl border border-border bg-background px-3">
                        <option value="sandbox">sandbox</option>
                        <option value="live">live</option>
                      </select>
                      <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className="h-12 rounded-xl" placeholder="USD" />
                      <Input value={secretKey} onChange={(e) => setSecretKey(e.target.value)} className="h-12 rounded-xl col-span-2" placeholder={`osk_${mode}_...`} />
                    </div>

                    {type === "products" && (
                      <div>
                        <p className="mb-2 text-sm font-semibold text-foreground">Products</p>
                        <div className="space-y-2">
                          {filteredProducts.map((p) => (
                            <div key={p.id} className="grid grid-cols-1 items-center gap-2 rounded-xl border border-border p-2 sm:grid-cols-[1fr_120px]">
                              <p className="text-sm text-foreground">{p.product_name} ({p.currency} {Number(p.unit_amount).toFixed(2)})</p>
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
                    )}

                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="mb-2 text-sm font-semibold text-foreground">Customer fields</p>
                        <div className="grid gap-2 text-sm">
                          <label className="flex items-center gap-2"><input type="checkbox" checked={collectName} onChange={(e) => setCollectName(e.target.checked)} /> Collect customer name</label>
                          <label className="flex items-center gap-2"><input type="checkbox" checked={collectEmail} onChange={(e) => setCollectEmail(e.target.checked)} /> Collect customer email</label>
                          <label className="flex items-center gap-2"><input type="checkbox" checked={collectPhone} onChange={(e) => setCollectPhone(e.target.checked)} /> Collect phone</label>
                          <label className="flex items-center gap-2"><input type="checkbox" checked={collectAddress} onChange={(e) => setCollectAddress(e.target.checked)} /> Collect address</label>
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-sm font-semibold text-foreground">After payment</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setAfterPaymentType("confirmation")}
                            className={`h-10 rounded-xl border text-sm ${afterPaymentType === "confirmation" ? "border-paypal-blue text-paypal-blue" : "border-border text-foreground"}`}
                          >
                            Confirmation
                          </button>
                          <button
                            onClick={() => setAfterPaymentType("redirect")}
                            className={`h-10 rounded-xl border text-sm ${afterPaymentType === "redirect" ? "border-paypal-blue text-paypal-blue" : "border-border text-foreground"}`}
                          >
                            Redirect
                          </button>
                        </div>
                        {afterPaymentType === "confirmation" ? (
                          <Input value={confirmationMessage} onChange={(e) => setConfirmationMessage(e.target.value)} className="mt-2 h-11 rounded-xl" placeholder="Thanks for your payment." />
                        ) : (
                          <Input value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} className="mt-2 h-11 rounded-xl" placeholder="https://your-site.com/thank-you" />
                        )}
                      </div>
                    </div>

                    {createdUrl && (
                      <div className="rounded-xl border border-paypal-blue/30 bg-paypal-blue/5 p-3">
                        <p className="text-sm font-semibold text-foreground">Payment link ready</p>
                        <p className="mt-1 break-all text-xs text-muted-foreground">{createdUrl}</p>
                        <div className="mt-2 flex gap-2">
                          <Button variant="outline" className="h-8 rounded-lg" onClick={() => handleCopy(createdUrl, "Payment link")}>
                            <Copy className="mr-1 h-3.5 w-3.5" />
                            Copy
                          </Button>
                          <Button variant="outline" className="h-8 rounded-lg" onClick={() => window.open(createdUrl, "_blank")}>
                            Open
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>

          <div className="bg-secondary/30">
            <div className="sticky top-[69px] h-[calc(100vh-69px)] px-6 py-6">
              <h3 className="mb-4 text-xl font-semibold text-foreground">Checkout</h3>
              <div className="h-full rounded-2xl border border-border bg-background p-4">
                <div className="mx-auto max-w-sm rounded-xl border border-border bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <BrandLogo className="h-5 w-5" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">OpenPay</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{billingType === "subscription" ? "Subscribe to" : "Pay"}</p>
                  <p className="text-xl font-semibold text-foreground">{title || "OpenPay Payment"}</p>
                  <p className="mt-2 text-4xl font-bold text-foreground">
                    ${displayAmount}
                    {billingType === "subscription" && <span className="ml-1 text-sm font-medium text-muted-foreground">per {repeatUnit}</span>}
                  </p>
                  {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
                  <div className="mt-4 rounded-xl border border-border p-3">
                    <p className="text-sm text-muted-foreground">Subtotal</p>
                    <p className="text-lg font-semibold text-foreground">${displayAmount}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {coverPlatformFee || coverProcessingFee ? "You cover fees enabled." : "Customer pays standard fees."}
                    </p>
                  </div>
                  <button className="mt-4 h-10 w-full rounded-full bg-paypal-blue text-sm font-semibold text-white">
                    {callToAction || "Pay"}
                  </button>
                  <p className="mt-3 text-center text-xs text-muted-foreground">Secure payment checkout</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/menu")}
            className="paypal-surface rounded-full p-2 text-foreground"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex items-center gap-2">
            <BrandLogo className="h-7 w-7" />
            <p className="text-4xl font-black leading-none tracking-tight text-foreground">OpenPay</p>
          </div>

          <div className="flex items-center gap-2">
            <button className="paypal-surface rounded-full p-2 text-foreground" aria-label="Messages">
              <MessageCircle className="h-5 w-5" />
            </button>
            <button className="paypal-surface rounded-full p-2 text-foreground" aria-label="Notifications">
              <Bell className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-semibold text-foreground">Payment links</h1>
            <p className="mt-2 text-base text-muted-foreground">{paymentLinks.length} link{paymentLinks.length === 1 ? "" : "s"}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-paypal-blue px-5 text-lg font-semibold text-white hover:bg-[#004dc5]"
          >
            <Plus className="h-5 w-5" />
            Create
          </button>
        </div>

        <div className="paypal-surface mt-6 overflow-hidden rounded-2xl">
          {paymentLinks.length === 0 && (
            <p className="px-6 py-8 text-base text-muted-foreground">No payment links yet.</p>
          )}

          {paymentLinks.map((link) => {
            const checkoutUrl = formatLinkUrl(link.link_token);
            return (
              <div key={link.id} className="border-b border-border/70 px-6 py-5 last:border-b-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="rounded bg-paypal-success/15 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-paypal-success">
                      {link.is_active ? "Active" : "Inactive"}
                    </span>
                    <span className="text-muted-foreground">{formatCreatedDate(link.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(checkoutUrl, "Payment link")}
                      className="rounded p-1.5 text-muted-foreground hover:bg-secondary"
                      aria-label="Copy payment link"
                    >
                      <Link2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(checkoutUrl, "_blank")}
                      className="rounded p-1.5 text-muted-foreground hover:bg-secondary"
                      aria-label="Open payment link"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-1.5 text-muted-foreground hover:bg-secondary"
                      aria-label="More actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <p className="mt-3 text-2xl font-semibold text-foreground">{link.title || "OpenPay Payment"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatLinkAmountLabel(link)} · Total sales: $0.00 · Total revenue: $0.00 · 0 purchases
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-xl rounded-3xl bg-background p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-foreground">Created! Share payment link</h2>
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
                aria-label="Close share modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Share this link to collect payments with OpenPay virtual card checkout.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-2">
              <p className="flex-1 truncate text-sm text-foreground">{createdUrl}</p>
              <Button
                className="h-9 rounded-full bg-paypal-blue px-4 text-white hover:bg-[#004dc5]"
                onClick={() => void handleCopy(createdUrl, "Payment link")}
              >
                <Copy className="mr-1 h-4 w-4" />
                Copy link
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentLinksCreatePage;
