import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3, Bell, Boxes, Copy, CreditCard, KeyRound, LayoutDashboard, Link as LinkIcon, Menu, MessageCircle, Plus, Users, Wallet, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import BrandLogo from "@/components/BrandLogo";
import SplashScreen from "@/components/SplashScreen";
import { useCurrency } from "@/contexts/CurrencyContext";

type PortalView = "home" | "balances" | "transactions" | "customers" | "products" | "api_keys" | "checkout" | "analytics";
type Mode = "sandbox" | "live";

type MerchantProfile = { user_id: string; merchant_name: string; merchant_username: string; merchant_logo_url: string | null; default_currency: string };
type MerchantApiKey = { id: string; key_mode: Mode; key_name: string; publishable_key: string; secret_key_last4: string; is_active: boolean; created_at: string };
type MerchantProduct = { id: string; product_code: string; product_name: string; product_description: string; unit_amount: number; currency: string; is_active: boolean };
type MerchantPayment = {
  id: string;
  session_id: string;
  buyer_user_id: string;
  transaction_id: string;
  amount: number;
  currency: string;
  api_key_id: string | null;
  key_mode: Mode;
  payment_link_id: string | null;
  payment_link_token: string | null;
  status: string;
  created_at: string;
};
type MerchantSession = { id: string; session_token: string; status: string; key_mode: Mode; currency: string; total_amount: number; customer_name: string | null; customer_email: string | null; created_at: string };

type CustomerProfile = { id: string; full_name: string; username: string | null };

const navItems: { key: PortalView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "home", label: "Home", icon: LayoutDashboard },
  { key: "balances", label: "Balances", icon: Wallet },
  { key: "transactions", label: "Transactions", icon: CreditCard },
  { key: "customers", label: "Customers", icon: Users },
  { key: "products", label: "Product catalog", icon: Boxes },
  { key: "api_keys", label: "API keys", icon: KeyRound },
  { key: "checkout", label: "Checkout links", icon: LinkIcon },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
];

const MerchantOnboardingPage = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const navigate = useNavigate();
  const { currencies } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<PortalView>("home");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("sandbox");
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const [merchantName, setMerchantName] = useState("OpenPay Merchant");
  const [merchantUsername, setMerchantUsername] = useState("");
  const [merchantLogoUrl, setMerchantLogoUrl] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [savingProfile, setSavingProfile] = useState(false);

  const [apiKeys, setApiKeys] = useState<MerchantApiKey[]>([]);
  const [keyName, setKeyName] = useState("Default key");
  const [creatingKey, setCreatingKey] = useState(false);
  const [lastSecretKey, setLastSecretKey] = useState("");

  const [products, setProducts] = useState<MerchantProduct[]>([]);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [productCode, setProductCode] = useState("");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productCurrency, setProductCurrency] = useState("USD");

  const [payments, setPayments] = useState<MerchantPayment[]>([]);
  const [sessions, setSessions] = useState<MerchantSession[]>([]);
  const [customersById, setCustomersById] = useState<Record<string, CustomerProfile>>({});
  const [walletBalance, setWalletBalance] = useState(0);

  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({});
  const [checkoutCurrency, setCheckoutCurrency] = useState("USD");
  const [checkoutSecretKey, setCheckoutSecretKey] = useState("");
  const [creatingSession, setCreatingSession] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState("");

  const modeProducts = useMemo(() => products.filter((p) => p.currency.toUpperCase() === checkoutCurrency.toUpperCase() && p.is_active), [products, checkoutCurrency]);
  const sessionsById = useMemo(() => {
    const map: Record<string, MerchantSession> = {};
    sessions.forEach((session) => {
      map[session.id] = session;
    });
    return map;
  }, [sessions]);
  const currencyOptions = useMemo(() => {
    const seen = new Set<string>();
    const list = currencies
      .map((item) => (item.code || "").toUpperCase())
      .filter((code) => code.length === 3 && !seen.has(code) && seen.add(code));
    if (!list.includes("USD")) list.unshift("USD");
    return list;
  }, [currencies]);
  const apiKeysById = useMemo(() => {
    const map: Record<string, MerchantApiKey> = {};
    apiKeys.forEach((key) => {
      map[key.id] = key;
    });
    return map;
  }, [apiKeys]);
  const modePayments = useMemo(() => payments.filter((p) => p.key_mode === mode).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)), [payments, mode]);
  const modeSessions = useMemo(() => sessions.filter((s) => s.key_mode === mode).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)), [sessions, mode]);
  const uniqueCustomers = useMemo(() => Array.from(new Set(modePayments.map((p) => p.buyer_user_id).filter(Boolean))), [modePayments]);

  const kpis = useMemo(() => {
    const succeeded = modePayments.filter((p) => p.status === "succeeded");
    const refunded = modePayments.filter((p) => p.status === "refunded");
    const failed = modePayments.filter((p) => p.status === "failed");
    const gross = succeeded.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const refunds = refunded.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return { gross, refunds, available: Math.max(0, gross - refunds), succeeded: succeeded.length, failed: failed.length, total: modePayments.length };
  }, [modePayments]);

  const selectedCart = useMemo(() => {
    const items = modeProducts
      .map((p) => {
        const qty = Number(selectedQty[p.id] || 0);
        if (!qty) return null;
        return { product_id: p.id, name: p.product_name, quantity: qty, line_total: Number((Number(p.unit_amount) * qty).toFixed(2)) };
      })
      .filter(Boolean) as Array<{ product_id: string; name: string; quantity: number; line_total: number }>;
    return { items, total: items.reduce((sum, i) => sum + i.line_total, 0) };
  }, [modeProducts, selectedQty]);

  const loadPortal = async (uid: string) => {
    const [{ data: profile }, { data: keyRows }, { data: productRows }, { data: paymentRows }, { data: sessionRows }, { data: walletRow }, { count: unreadCount }] = await Promise.all([
      db.from("merchant_profiles").select("user_id, merchant_name, merchant_username, merchant_logo_url, default_currency").eq("user_id", uid).maybeSingle(),
      db.from("merchant_api_keys").select("id, key_mode, key_name, publishable_key, secret_key_last4, is_active, created_at").eq("merchant_user_id", uid).order("created_at", { ascending: false }),
      db.from("merchant_products").select("id, product_code, product_name, product_description, unit_amount, currency, is_active").eq("merchant_user_id", uid).order("created_at", { ascending: false }),
      db.from("merchant_payments").select("id, session_id, buyer_user_id, transaction_id, amount, currency, api_key_id, key_mode, payment_link_id, payment_link_token, status, created_at").eq("merchant_user_id", uid),
      db.from("merchant_checkout_sessions").select("id, session_token, status, key_mode, currency, total_amount, customer_name, customer_email, created_at").eq("merchant_user_id", uid),
      db.from("wallets").select("balance").eq("user_id", uid).maybeSingle(),
      db.from("app_notifications").select("id", { count: "exact", head: true }).eq("user_id", uid).is("read_at", null),
    ]);

    if (profile) {
      const p = profile as MerchantProfile;
      setMerchantName(p.merchant_name || "OpenPay Merchant");
      setMerchantUsername(p.merchant_username || "");
      setMerchantLogoUrl(p.merchant_logo_url || "");
      setDefaultCurrency((p.default_currency || "USD").toUpperCase());
      setProductCurrency((p.default_currency || "USD").toUpperCase());
      setCheckoutCurrency((p.default_currency || "USD").toUpperCase());
    }

    setApiKeys((keyRows || []) as MerchantApiKey[]);
    setProducts((productRows || []) as MerchantProduct[]);
    setPayments((paymentRows || []) as MerchantPayment[]);
    setSessions((sessionRows || []) as MerchantSession[]);
    setWalletBalance(Number(walletRow?.balance || 0));
    setUnreadNotifications(Number(unreadCount || 0));
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

      setUserId(user.id);

      const { data: baseProfile } = await supabase.from("profiles").select("full_name, username, avatar_url").eq("id", user.id).maybeSingle();

      await db.rpc("upsert_my_merchant_profile", {
        p_merchant_name: baseProfile?.full_name || null,
        p_merchant_username: baseProfile?.username || null,
        p_merchant_logo_url: baseProfile?.avatar_url || null,
        p_default_currency: "USD",
      });

      await loadPortal(user.id);
      setLoading(false);
    };

    boot();
  }, [navigate]);

  useEffect(() => {
    const loadCustomers = async () => {
      if (!uniqueCustomers.length) {
        setCustomersById({});
        return;
      }

      const { data } = await supabase.from("profiles").select("id, full_name, username").in("id", uniqueCustomers);
      const map: Record<string, CustomerProfile> = {};
      (data || []).forEach((row) => {
        map[row.id] = row as CustomerProfile;
      });
      setCustomersById(map);
    };

    loadCustomers();
  }, [uniqueCustomers.join("|")]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [activeView]);

  const modeLabel = mode === "sandbox" ? "Sandbox" : "Live";

  const handleCopy = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    const { error } = await db.rpc("upsert_my_merchant_profile", {
      p_merchant_name: merchantName,
      p_merchant_username: merchantUsername,
      p_merchant_logo_url: merchantLogoUrl || null,
      p_default_currency: defaultCurrency,
    });
    setSavingProfile(false);

    if (error) {
      toast.error(error.message || "Failed to save merchant profile");
      return;
    }

    if (userId) await loadPortal(userId);
    toast.success("Merchant profile saved");
  };

  const createKey = async () => {
    setCreatingKey(true);
    const { data, error } = await db.rpc("create_my_merchant_api_key", { p_mode: mode, p_key_name: keyName });
    setCreatingKey(false);

    if (error) {
      toast.error(error.message || "Failed to create API key");
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const secret = row?.secret_key || "";
    setLastSecretKey(secret);
    if (secret) setCheckoutSecretKey(secret);

    if (userId) await loadPortal(userId);
    toast.success(`${modeLabel} key created`);
  };

  const revokeKey = async (id: string) => {
    const { data, error } = await db.rpc("revoke_my_merchant_api_key", { p_key_id: id });
    if (error || !data) {
      toast.error(error?.message || "Failed to revoke API key");
      return;
    }

    if (userId) await loadPortal(userId);
    toast.success("API key revoked");
  };

  const createProduct = async () => {
    if (!userId) return;
    const amount = Number(productPrice);
    if (!productCode.trim() || !productName.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter product code, name, and valid price");
      return;
    }

    setCreatingProduct(true);
    const { error } = await db.from("merchant_products").insert({
      merchant_user_id: userId,
      product_code: productCode.trim().toUpperCase(),
      product_name: productName.trim(),
      product_description: productDescription.trim(),
      unit_amount: amount,
      currency: productCurrency.trim().toUpperCase() || "USD",
      is_active: true,
      metadata: {},
    });
    setCreatingProduct(false);

    if (error) {
      toast.error(error.message || "Failed to add product");
      return;
    }

    setProductCode("");
    setProductName("");
    setProductDescription("");
    setProductPrice("");

    await loadPortal(userId);
    toast.success("Product added");
  };

  const toggleProductActive = async (product: MerchantProduct) => {
    const { error } = await db.from("merchant_products").update({ is_active: !product.is_active }).eq("id", product.id);
    if (error) {
      toast.error(error.message || "Failed to update product");
      return;
    }
    if (userId) await loadPortal(userId);
  };

  const createCheckoutSession = async () => {
    if (!checkoutSecretKey.trim()) {
      toast.error("Paste secret key for checkout");
      return;
    }
    if (!selectedCart.items.length) {
      toast.error("Choose at least one product quantity");
      return;
    }

    setCreatingSession(true);
    const { data, error } = await db.rpc("create_merchant_checkout_session", {
      p_secret_key: checkoutSecretKey.trim(),
      p_mode: mode,
      p_currency: checkoutCurrency.trim().toUpperCase(),
      p_items: selectedCart.items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
      p_customer_email: null,
      p_customer_name: null,
      p_success_url: null,
      p_cancel_url: null,
      p_metadata: {},
      p_expires_in_minutes: 60,
    });
    setCreatingSession(false);

    if (error) {
      toast.error(error.message || "Failed to create checkout link");
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const token = row?.session_token || "";
    if (!token || typeof window === "undefined") {
      toast.error("Checkout link created but token missing");
      return;
    }

    const url = `${window.location.origin}/merchant-checkout?session=${encodeURIComponent(token)}`;
    setCheckoutUrl(url);

    if (userId) await loadPortal(userId);
    toast.success(`${modeLabel} checkout link ready`);
  };

  if (loading) return <SplashScreen message="Loading merchant portal..." />;

  const renderContent = () => {
    if (activeView === "home") {
      return (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-white p-5">
              <p className="text-sm text-muted-foreground">Today</p>
              <h2 className="mt-1 text-3xl font-bold text-slate-900">{modeLabel} overview</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border bg-slate-50 p-4"><p className="text-xs text-muted-foreground">Gross volume</p><p className="mt-1 text-xl font-bold">{defaultCurrency} {kpis.gross.toFixed(2)}</p></div>
                <div className="rounded-xl border border-border bg-slate-50 p-4"><p className="text-xs text-muted-foreground">Available</p><p className="mt-1 text-xl font-bold">{defaultCurrency} {kpis.available.toFixed(2)}</p></div>
                <div className="rounded-xl border border-border bg-slate-50 p-4"><p className="text-xs text-muted-foreground">Payments</p><p className="mt-1 text-xl font-bold">{kpis.total}</p></div>
                <div className="rounded-xl border border-border bg-slate-50 p-4"><p className="text-xs text-muted-foreground">Wallet balance</p><p className="mt-1 text-xl font-bold">{defaultCurrency} {walletBalance.toFixed(2)}</p></div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-white p-5">
              <h3 className="font-semibold text-slate-900">Quick setup</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Button className="h-10 rounded-lg" onClick={() => setActiveView("api_keys")}>1. Create {modeLabel} API key</Button>
                <Button className="h-10 rounded-lg" variant="outline" onClick={() => setActiveView("products")}>2. Add products</Button>
                <Button className="h-10 rounded-lg" variant="outline" onClick={() => setActiveView("checkout")}>3. Create checkout link</Button>
                <Button className="h-10 rounded-lg" variant="outline" onClick={() => navigate("/payment-links/create")}>4. Payment link builder</Button>
                <Button className="h-10 rounded-lg" variant="outline" onClick={() => setActiveView("transactions")}>4. Track payments</Button>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-white p-5">
              <h3 className="font-semibold text-slate-900">Merchant profile</h3>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-bold text-slate-700">{merchantLogoUrl ? <img src={merchantLogoUrl} alt="Logo" className="h-full w-full object-cover" /> : (merchantName || "M").slice(0, 1)}</div>
                <div><p className="font-semibold text-slate-900">{merchantName}</p><p className="text-xs text-muted-foreground">@{merchantUsername || "merchant"}</p></div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-white p-5"><h3 className="font-semibold text-slate-900">Recommendations</h3><p className="mt-2 text-sm text-muted-foreground">Use sandbox first. When ready, switch to live and create a live key.</p></div>
          </div>
        </div>
      );
    }

    if (activeView === "api_keys") {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-white p-5">
            <h3 className="text-2xl font-bold text-slate-900">API keys</h3>
            <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]"><Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="Key name" className="h-11 rounded-lg" /><Button onClick={createKey} disabled={creatingKey} className="h-11 rounded-lg">{creatingKey ? "Creating..." : `Create ${modeLabel} key`}</Button></div>
            {!!lastSecretKey && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-sm font-semibold text-amber-900">Secret key (showing once)</p><p className="mt-1 break-all font-mono text-xs text-amber-800">{lastSecretKey}</p><Button onClick={() => handleCopy(lastSecretKey, "Secret key")} className="mt-2 h-8 rounded-lg" variant="outline">Copy secret key</Button></div>}
          </div>
          <div className="rounded-2xl border border-border bg-white p-5 space-y-2">{apiKeys.map((k) => <div key={k.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"><div><p className="text-sm font-semibold text-slate-900">{k.key_name} <span className="text-xs text-muted-foreground">({k.key_mode})</span></p><p className="font-mono text-xs text-muted-foreground">{k.publishable_key}</p><p className="text-xs text-muted-foreground">Secret ending: ****{k.secret_key_last4}</p></div><div className="flex gap-2"><Button className="h-8 rounded-lg" variant="outline" onClick={() => handleCopy(k.publishable_key, "Publishable key")}>Copy</Button>{k.is_active && <Button className="h-8 rounded-lg" variant="outline" onClick={() => revokeKey(k.id)}>Revoke</Button>}</div></div>)}{!apiKeys.length && <p className="text-sm text-muted-foreground">No API keys created.</p>}</div>
        </div>
      );
    }

    if (activeView === "products") {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-white p-5">
            <h3 className="text-2xl font-bold text-slate-900">Add a product</h3>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              <Input value={productCode} onChange={(e) => setProductCode(e.target.value)} placeholder="Code" className="h-11 rounded-lg" />
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Name" className="h-11 rounded-lg" />
              <Input value={productDescription} onChange={(e) => setProductDescription(e.target.value)} placeholder="Description" className="h-11 rounded-lg md:col-span-2" />
              <Input value={productPrice} onChange={(e) => setProductPrice(e.target.value)} placeholder="Amount" className="h-11 rounded-lg" />
              <select
                value={productCurrency}
                onChange={(e) => setProductCurrency(e.target.value.toUpperCase())}
                className="h-11 rounded-lg border border-border bg-white px-3 text-sm"
              >
                {currencyOptions.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
              <Button onClick={createProduct} disabled={creatingProduct} className="h-11 rounded-lg md:col-span-2"><Plus className="mr-2 h-4 w-4" />{creatingProduct ? "Adding..." : "Add product"}</Button>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-white p-5 space-y-2">{products.map((p) => <div key={p.id} className="rounded-xl border border-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold text-slate-900">{p.product_name}</p><p className="text-xs text-muted-foreground">{p.product_code} | {p.currency} {Number(p.unit_amount).toFixed(2)}</p></div><Button variant="outline" className="h-8 rounded-lg" onClick={() => toggleProductActive(p)}>{p.is_active ? "Set inactive" : "Set active"}</Button></div>{!!p.product_description && <p className="mt-1 text-sm text-muted-foreground">{p.product_description}</p>}</div>)}{!products.length && <p className="text-sm text-muted-foreground">No products yet.</p>}</div>
        </div>
      );
    }

    if (activeView === "checkout") {
      return (
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-border bg-white p-5">
            <h3 className="text-2xl font-bold text-slate-900">Create checkout link</h3>
            <Button variant="outline" className="mt-2 h-9 rounded-lg" onClick={() => navigate("/payment-links/create")}>Open advanced /payment-links/create</Button>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              <select
                value={checkoutCurrency}
                onChange={(e) => setCheckoutCurrency(e.target.value.toUpperCase())}
                className="h-11 rounded-lg border border-border bg-white px-3 text-sm"
              >
                {currencyOptions.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
              <Input value={checkoutSecretKey} onChange={(e) => setCheckoutSecretKey(e.target.value)} placeholder={`Paste osk_${mode}_...`} className="h-11 rounded-lg" />
            </div>
            <div className="mt-4 space-y-2">{modeProducts.map((p) => <div key={p.id} className="grid grid-cols-1 items-center gap-2 rounded-xl border border-border p-2 sm:grid-cols-[1fr_120px]"><p className="text-sm text-slate-900">{p.product_name} ({p.currency} {Number(p.unit_amount).toFixed(2)})</p><Input value={String(selectedQty[p.id] || "")} onChange={(e) => setSelectedQty((prev) => ({ ...prev, [p.id]: Number(e.target.value || 0) }))} placeholder="Qty" className="h-10 rounded-lg" /></div>)}{!modeProducts.length && <p className="text-sm text-muted-foreground">No active products in {checkoutCurrency}.</p>}</div>
            <Button onClick={createCheckoutSession} disabled={creatingSession || !modeProducts.length} className="mt-4 h-11 rounded-lg">{creatingSession ? "Creating link..." : `Create ${modeLabel} checkout link`}</Button>
            {!!checkoutUrl && <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3"><p className="text-sm font-semibold text-blue-900">Checkout link ready</p><p className="mt-1 break-all text-xs text-blue-800">{checkoutUrl}</p><div className="mt-2 flex gap-2"><Button variant="outline" className="h-8 rounded-lg" onClick={() => handleCopy(checkoutUrl, "Checkout link")}>Copy</Button><Button variant="outline" className="h-8 rounded-lg" onClick={() => window.open(checkoutUrl, "_blank")}>Open</Button></div></div>}
          </div>
          <div className="space-y-4"><div className="rounded-2xl border border-border bg-white p-5"><h4 className="font-semibold text-slate-900">Preview</h4><div className="mt-3 space-y-2 text-sm">{selectedCart.items.map((item) => <div key={item.product_id} className="flex justify-between"><span>{item.name} x{item.quantity}</span><span>{checkoutCurrency} {item.line_total.toFixed(2)}</span></div>)}{!selectedCart.items.length && <p className="text-muted-foreground">Select products to preview total.</p>}<div className="mt-2 border-t pt-2 font-semibold">Total: {checkoutCurrency} {selectedCart.total.toFixed(2)}</div></div></div><div className="rounded-2xl border border-border bg-white p-5"><h4 className="font-semibold text-slate-900">Recent links ({modeLabel})</h4><div className="mt-3 space-y-2">{modeSessions.slice(0, 8).map((s) => { const link = typeof window === "undefined" ? "" : `${window.location.origin}/merchant-checkout?session=${encodeURIComponent(s.session_token)}`; return <div key={s.id} className="rounded-lg border border-border p-2"><p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</p><p className="text-sm font-medium">{s.currency} {Number(s.total_amount).toFixed(2)} · {s.status}</p><div className="mt-1 flex gap-2"><Button variant="outline" className="h-7 rounded-md px-2 text-xs" onClick={() => handleCopy(link, "Checkout link")}>Copy</Button><Button variant="outline" className="h-7 rounded-md px-2 text-xs" onClick={() => window.open(link, "_blank")}>Open</Button></div></div>; })}{!modeSessions.length && <p className="text-sm text-muted-foreground">No checkout links yet.</p>}</div></div></div>
        </div>
      );
    }

    if (activeView === "transactions") {
      return (
        <div className="rounded-2xl border border-border bg-white p-5">
          <h3 className="text-2xl font-bold text-slate-900">Transactions</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3">Customer</th>
                  <th className="pb-2 pr-3">Source link</th>
                  <th className="pb-2 pr-3">API key</th>
                  <th className="pb-2 pr-3">Amount</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2">TX</th>
                </tr>
              </thead>
              <tbody>
                {modePayments.map((p) => {
                  const customer = customersById[p.buyer_user_id];
                  const session = sessionsById[p.session_id];
                  const customerDisplayName = session?.customer_name || customer?.full_name || customer?.username || p.buyer_user_id.slice(0, 8);
                  const customerEmail = session?.customer_email || "";
                  const key = p.api_key_id ? apiKeysById[p.api_key_id] : null;
                  const keyDisplay = key ? `${key.key_name} (****${key.secret_key_last4})` : `${p.key_mode} key`;
                  const linkDisplay = p.payment_link_token ? p.payment_link_token : "Direct checkout";

                  return (
                    <tr key={p.id} className="border-b align-top">
                      <td className="py-2 pr-3">{new Date(p.created_at).toLocaleString()}</td>
                      <td className="py-2 pr-3">
                        <p className="font-medium text-slate-900">{customerDisplayName}</p>
                        {!!customerEmail && <p className="text-xs text-muted-foreground">{customerEmail}</p>}
                        {!customerEmail && customer?.username && <p className="text-xs text-muted-foreground">@{customer.username}</p>}
                      </td>
                      <td className="py-2 pr-3">
                        <p className="font-mono text-xs text-slate-700">{linkDisplay}</p>
                      </td>
                      <td className="py-2 pr-3">
                        <p className="text-xs text-slate-700">{keyDisplay}</p>
                      </td>
                      <td className="py-2 pr-3">{p.currency} {Number(p.amount).toFixed(2)}</td>
                      <td className="py-2 pr-3">{p.status}</td>
                      <td className="py-2 font-mono text-xs">{p.transaction_id}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!modePayments.length && <p className="py-6 text-sm text-muted-foreground">No transactions yet.</p>}
          </div>
        </div>
      );
    }

    if (activeView === "customers") {
      return (
        <div className="rounded-2xl border border-border bg-white p-5">
          <h3 className="text-2xl font-bold text-slate-900">Customers</h3>
          <div className="mt-4 grid gap-2">
            {uniqueCustomers.map((id) => {
              const c = customersById[id];
              const latestPayment = modePayments.find((payment) => payment.buyer_user_id === id);
              const latestSession = latestPayment ? sessionsById[latestPayment.session_id] : undefined;
              const customerDisplayName = latestSession?.customer_name || c?.full_name || "OpenPay Customer";
              const customerEmail = latestSession?.customer_email || "";

              return (
                <div key={id} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div>
                    <p className="font-medium text-slate-900">{customerDisplayName}</p>
                    {!!customerEmail && <p className="text-xs text-muted-foreground">{customerEmail}</p>}
                    {!customerEmail && <p className="text-xs text-muted-foreground">@{c?.username || id.slice(0, 8)}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground">{modePayments.filter((p) => p.buyer_user_id === id).length} payments</p>
                </div>
              );
            })}
            {!uniqueCustomers.length && <p className="py-6 text-sm text-muted-foreground">No customers yet.</p>}
          </div>
        </div>
      );
    }

    if (activeView === "balances") {
      return (
        <div className="rounded-2xl border border-border bg-white p-5">
          <h3 className="text-2xl font-bold text-slate-900">Balances</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">Incoming</p>
              <p className="mt-1 text-xl font-bold">{defaultCurrency} {kpis.gross.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">Refunded</p>
              <p className="mt-1 text-xl font-bold">{defaultCurrency} {kpis.refunds.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">Available</p>
              <p className="mt-1 text-xl font-bold">{defaultCurrency} {kpis.available.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">Wallet balance</p>
              <p className="mt-1 text-xl font-bold">{defaultCurrency} {walletBalance.toFixed(2)}</p>
            </div>
          </div>
        </div>
      );
    }
    return <div className="rounded-2xl border border-border bg-white p-5"><h3 className="text-2xl font-bold text-slate-900">Payments analytics</h3><div className="mt-4 space-y-4"><div><div className="mb-1 flex items-center justify-between text-sm"><span>Success rate</span><span className="font-semibold">{kpis.total ? ((kpis.succeeded / kpis.total) * 100).toFixed(1) : "0.0"}%</span></div><div className="h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-emerald-500" style={{ width: `${kpis.total ? (kpis.succeeded / kpis.total) * 100 : 0}%` }} /></div></div><div><div className="mb-1 flex items-center justify-between text-sm"><span>Failure rate</span><span className="font-semibold">{kpis.total ? ((kpis.failed / kpis.total) * 100).toFixed(1) : "0.0"}%</span></div><div className="h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-rose-500" style={{ width: `${kpis.total ? (kpis.failed / kpis.total) * 100 : 0}%` }} /></div></div></div></div>;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-[#0a2a66] px-4 py-2 text-center text-xs text-white">You are testing in {mode}. Switch to live when ready.</div>
      <div className="flex min-h-[calc(100vh-32px)]">
        <aside className="hidden w-64 border-r border-slate-200 bg-white p-4 md:block">
          <div className="mb-6 flex items-center gap-2"><BrandLogo className="h-8 w-8" /><div><p className="text-xs uppercase tracking-wide text-slate-500">OpenPay</p><p className="text-lg font-bold text-slate-900">Merchant Portal</p></div></div>
          <nav className="space-y-1">{navItems.map((item) => { const Icon = item.icon; const active = activeView === item.key; return <button key={item.key} onClick={() => setActiveView(item.key)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${active ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"}`}><Icon className="h-4 w-4" />{item.label}</button>; })}</nav>
          <Button variant="outline" className="mt-6 h-9 w-full rounded-lg" onClick={() => navigate("/menu")}><ArrowLeft className="mr-2 h-4 w-4" /> Back to menu</Button>
        </aside>

        <main className="flex-1 p-4 md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button onClick={() => setMobileNavOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white md:hidden" aria-label="Open navigation">
                <Menu className="h-4 w-4 text-slate-700" />
              </button>
              <div><h1 className="text-2xl font-bold text-slate-900">{navItems.find((x) => x.key === activeView)?.label}</h1><p className="text-sm text-slate-500">{merchantName} @{merchantUsername || "merchant"}</p></div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate("/contacts")} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white" aria-label="Open messages">
                <MessageCircle className="h-4 w-4 text-slate-700" />
              </button>
              <button onClick={() => navigate("/notifications")} className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white" aria-label="Open notifications">
                <Bell className="h-4 w-4 text-slate-700" />
                {unreadNotifications > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />}
              </button>
              <button onClick={() => setMode("sandbox")} className={`h-9 rounded-lg px-3 text-sm ${mode === "sandbox" ? "bg-blue-600 text-white" : "bg-white text-slate-700 border border-slate-300"}`}>Sandbox</button>
              <button onClick={() => setMode("live")} className={`h-9 rounded-lg px-3 text-sm ${mode === "live" ? "bg-blue-600 text-white" : "bg-white text-slate-700 border border-slate-300"}`}>Live</button>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 md:hidden">
            <p className="text-sm text-slate-600">Section: <span className="font-semibold text-slate-900">{navItems.find((x) => x.key === activeView)?.label}</span></p>
            <Button variant="outline" className="h-8 rounded-lg px-3 text-xs" onClick={() => navigate("/menu")}><ArrowLeft className="mr-1 h-3.5 w-3.5" />Menu</Button>
          </div>

          {renderContent()}

          <div className="mt-6 rounded-2xl border border-border bg-white p-5">
            <h3 className="font-semibold text-slate-900">Easy setup settings</h3>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <Input value={merchantName} onChange={(e) => setMerchantName(e.target.value)} placeholder="Merchant name" className="h-10 rounded-lg" />
              <Input value={merchantUsername} onChange={(e) => setMerchantUsername(e.target.value)} placeholder="Merchant username" className="h-10 rounded-lg" />
              <Input value={merchantLogoUrl} onChange={(e) => setMerchantLogoUrl(e.target.value)} placeholder="Merchant logo URL" className="h-10 rounded-lg" />
              <select
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value.toUpperCase())}
                className="h-10 rounded-lg border border-border bg-white px-3 text-sm"
              >
                {currencyOptions.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>
            <Button onClick={saveProfile} disabled={savingProfile} className="mt-3 h-10 rounded-lg">{savingProfile ? "Saving..." : "Save profile"}</Button>
          </div>
        </main>
      </div>

      <div
        className={`fixed inset-0 z-50 transition-colors duration-300 md:hidden ${mobileNavOpen ? "bg-black/40" : "pointer-events-none bg-black/0"}`}
        onClick={() => setMobileNavOpen(false)}
      >
        <div
          className={`ml-auto flex h-full w-80 max-w-[85%] flex-col bg-white p-4 shadow-2xl transition-transform duration-300 ease-out ${mobileNavOpen ? "translate-x-0" : "translate-x-full"}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <p className="text-lg font-bold text-slate-900">Merchant Menu</p>
            <button onClick={() => setMobileNavOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200" aria-label="Close navigation">
              <X className="h-4 w-4 text-slate-700" />
            </button>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.key;
              return (
                <button key={item.key} onClick={() => setActiveView(item.key)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${active ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"}`}>
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <Button variant="outline" className="mt-6 h-9 w-full rounded-lg" onClick={() => navigate("/menu")}><ArrowLeft className="mr-2 h-4 w-4" /> Back to menu</Button>
        </div>
      </div>
    </div>
  );
};

export default MerchantOnboardingPage;

