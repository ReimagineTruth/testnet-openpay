import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Download,
  Printer,
  QrCode,
  Share2,
  ShieldCheck,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { loadUserPreferences, upsertUserPreferences } from "@/lib/userPreferences";

type ProductItem = {
  id: number;
  name: string;
  price: string;
  category: string;
  description: string;
  image: string;
  stock: string;
  serviceDuration: string;
};

const mainCategories = [
  "Food & Beverage",
  "Retail",
  "Digital Products",
  "Services",
  "Travel & Transport",
  "Education",
  "Health & Beauty",
  "Electronics",
  "Fashion",
  "Other",
];

const subCategoryMap: Record<string, string[]> = {
  "Food & Beverage": ["Restaurant", "Cafe", "Street Food"],
  Retail: ["Grocery", "Mini Mart", "Home Goods"],
  "Digital Products": ["Courses", "Templates", "Software"],
  Services: ["Repair", "Freelance", "Cleaning"],
  "Travel & Transport": ["Ride", "Ticketing", "Delivery"],
  Education: ["Tutoring", "School Supplies", "Training"],
  "Health & Beauty": ["Salon", "Wellness", "Cosmetics"],
  Electronics: ["Mobile Shop", "Accessories", "Repair"],
  Fashion: ["Clothing", "Shoes", "Accessories"],
  Other: ["General"],
};

const fieldClass =
  "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-paypal-blue focus:ring-2 focus:ring-paypal-blue/20";
const areaClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-paypal-blue focus:ring-2 focus:ring-paypal-blue/20";
const cardClass = "paypal-surface rounded-3xl p-4 md:p-5";

const MerchantOnboardingPage = () => {
  const navigate = useNavigate();
  const [merchantName, setMerchantName] = useState("");
  const [storeDisplayName, setStoreDisplayName] = useState("");
  const [merchantUsername, setMerchantUsername] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [businessType, setBusinessType] = useState("Individual");
  const [mainCategory, setMainCategory] = useState(mainCategories[0]);
  const [subCategory, setSubCategory] = useState(subCategoryMap[mainCategories[0]][0]);
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("United States");
  const [city, setCity] = useState("");
  const [mapPin, setMapPin] = useState("");
  const [settlementMethod, setSettlementMethod] = useState("wallet");
  const [supportsLocal, setSupportsLocal] = useState(true);
  const [supportsCrypto, setSupportsCrypto] = useState(true);
  const [supportsStablecoin, setSupportsStablecoin] = useState(true);
  const [themeColor, setThemeColor] = useState("#0070ba");
  const [buttonStyle, setButtonStyle] = useState("Rounded");
  const [storeEnabled, setStoreEnabled] = useState(true);
  const [paymentsPaused, setPaymentsPaused] = useState(false);
  const [idVerification, setIdVerification] = useState(false);
  const [permitUploaded, setPermitUploaded] = useState(false);
  const [taxId, setTaxId] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [products, setProducts] = useState<ProductItem[]>([
    {
      id: 1,
      name: "",
      price: "",
      category: "",
      description: "",
      image: "",
      stock: "",
      serviceDuration: "",
    },
  ]);
  const [userId, setUserId] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const normalizedUsername = useMemo(() => {
    const source = merchantUsername || storeDisplayName || merchantName;
    return source.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  }, [merchantUsername, storeDisplayName, merchantName]);

  const walletAddress = useMemo(
    () => (normalizedUsername ? `openpay_wallet_${normalizedUsername}` : "openpay_wallet_preview"),
    [normalizedUsername],
  );

  const payQr = useMemo(
    () => (normalizedUsername ? `openpay://pay/${normalizedUsername}` : "openpay://pay/merchantusername"),
    [normalizedUsername],
  );

  const storeUrl = useMemo(
    () => (normalizedUsername ? `openpay.app/store/${normalizedUsername}` : "openpay.app/store/merchantusername"),
    [normalizedUsername],
  );

  const subCategories = subCategoryMap[mainCategory];

  const completedCore = useMemo(() => {
    return [merchantName, storeDisplayName, merchantUsername, ownerName, email, phone, address, city].filter(Boolean)
      .length;
  }, [merchantName, storeDisplayName, merchantUsername, ownerName, email, phone, address, city]);
  const completionPercent = Math.min(100, Math.round((completedCore / 8) * 100));

  const onMainCategoryChange = (value: string) => {
    setMainCategory(value);
    setSubCategory(subCategoryMap[value][0]);
  };

  const updateProduct = (id: number, key: keyof ProductItem, value: string) => {
    setProducts((prev) => prev.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  };

  const addProduct = () => {
    setProducts((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        name: "",
        price: "",
        category: "",
        description: "",
        image: "",
        stock: "",
        serviceDuration: "",
      },
    ]);
  };

  useEffect(() => {
    const loadDraft = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/auth");
        return;
      }

      setUserId(user.id);
      try {
        const prefs = await loadUserPreferences(user.id);
        const draft = prefs.merchant_onboarding_data;

        if (typeof draft.merchantName === "string") setMerchantName(draft.merchantName);
        if (typeof draft.storeDisplayName === "string") setStoreDisplayName(draft.storeDisplayName);
        if (typeof draft.merchantUsername === "string") setMerchantUsername(draft.merchantUsername);
        if (typeof draft.businessDescription === "string") setBusinessDescription(draft.businessDescription);
        if (typeof draft.businessType === "string") setBusinessType(draft.businessType);

        if (typeof draft.mainCategory === "string" && mainCategories.includes(draft.mainCategory)) {
          setMainCategory(draft.mainCategory);
          if (typeof draft.subCategory === "string" && subCategoryMap[draft.mainCategory].includes(draft.subCategory)) {
            setSubCategory(draft.subCategory);
          } else {
            setSubCategory(subCategoryMap[draft.mainCategory][0]);
          }
        }

        if (typeof draft.ownerName === "string") setOwnerName(draft.ownerName);
        if (typeof draft.email === "string") setEmail(draft.email);
        if (typeof draft.phone === "string") setPhone(draft.phone);
        if (typeof draft.address === "string") setAddress(draft.address);
        if (typeof draft.country === "string") setCountry(draft.country);
        if (typeof draft.city === "string") setCity(draft.city);
        if (typeof draft.mapPin === "string") setMapPin(draft.mapPin);
        if (typeof draft.settlementMethod === "string") setSettlementMethod(draft.settlementMethod);

        if (typeof draft.supportsLocal === "boolean") setSupportsLocal(draft.supportsLocal);
        if (typeof draft.supportsCrypto === "boolean") setSupportsCrypto(draft.supportsCrypto);
        if (typeof draft.supportsStablecoin === "boolean") setSupportsStablecoin(draft.supportsStablecoin);
        if (typeof draft.themeColor === "string") setThemeColor(draft.themeColor);
        if (typeof draft.buttonStyle === "string") setButtonStyle(draft.buttonStyle);
        if (typeof draft.storeEnabled === "boolean") setStoreEnabled(draft.storeEnabled);
        if (typeof draft.paymentsPaused === "boolean") setPaymentsPaused(draft.paymentsPaused);
        if (typeof draft.idVerification === "boolean") setIdVerification(draft.idVerification);
        if (typeof draft.permitUploaded === "boolean") setPermitUploaded(draft.permitUploaded);
        if (typeof draft.taxId === "string") setTaxId(draft.taxId);
        if (typeof draft.termsAccepted === "boolean") setTermsAccepted(draft.termsAccepted);

        if (Array.isArray(draft.products)) {
          const safeProducts = draft.products
            .map((item, index) => {
              if (!item || typeof item !== "object") return null;
              const row = item as Record<string, unknown>;
              return {
                id: typeof row.id === "number" ? row.id : index + 1,
                name: typeof row.name === "string" ? row.name : "",
                price: typeof row.price === "string" ? row.price : "",
                category: typeof row.category === "string" ? row.category : "",
                description: typeof row.description === "string" ? row.description : "",
                image: typeof row.image === "string" ? row.image : "",
                stock: typeof row.stock === "string" ? row.stock : "",
                serviceDuration: typeof row.serviceDuration === "string" ? row.serviceDuration : "",
              };
            })
            .filter(Boolean) as ProductItem[];
          if (safeProducts.length) setProducts(safeProducts);
        }
      } catch {
        // Keep default state if SQL preferences are not available yet.
      } finally {
        setDraftLoaded(true);
      }
    };

    loadDraft();
  }, [navigate]);

  const draftPayload = useMemo(
    () => ({
      merchantName,
      storeDisplayName,
      merchantUsername,
      businessDescription,
      businessType,
      mainCategory,
      subCategory,
      ownerName,
      email,
      phone,
      address,
      country,
      city,
      mapPin,
      settlementMethod,
      supportsLocal,
      supportsCrypto,
      supportsStablecoin,
      themeColor,
      buttonStyle,
      storeEnabled,
      paymentsPaused,
      idVerification,
      permitUploaded,
      taxId,
      termsAccepted,
      products,
      updatedAt: new Date().toISOString(),
    }),
    [
      merchantName,
      storeDisplayName,
      merchantUsername,
      businessDescription,
      businessType,
      mainCategory,
      subCategory,
      ownerName,
      email,
      phone,
      address,
      country,
      city,
      mapPin,
      settlementMethod,
      supportsLocal,
      supportsCrypto,
      supportsStablecoin,
      themeColor,
      buttonStyle,
      storeEnabled,
      paymentsPaused,
      idVerification,
      permitUploaded,
      taxId,
      termsAccepted,
      products,
    ],
  );

  useEffect(() => {
    if (!userId || !draftLoaded) return;

    const timer = window.setTimeout(async () => {
      setSavingDraft(true);
      try {
        await upsertUserPreferences(userId, {
          merchant_onboarding_data: draftPayload,
          profile_full_name: ownerName || null,
          profile_username: normalizedUsername || null,
        });
      } catch {
        // Keep local form state even if remote save fails.
      } finally {
        setSavingDraft(false);
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [userId, draftLoaded, draftPayload, ownerName, normalizedUsername]);

  const handleSaveDraftNow = async () => {
    if (!userId) return;
    setSavingDraft(true);
    try {
      await upsertUserPreferences(userId, {
        merchant_onboarding_data: draftPayload,
        profile_full_name: ownerName || null,
        profile_username: normalizedUsername || null,
      });
      toast.success("Merchant onboarding data saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save merchant data");
    } finally {
      setSavingDraft(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-10">
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => navigate("/menu")}
          className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-secondary/80"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-paypal-dark">Merchant Onboarding</h1>
          <p className="text-xs text-muted-foreground">
            OpenPay business setup for goods and services {savingDraft ? "· Saving..." : "· Auto-saved to SQL"}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-white/30 bg-gradient-to-br from-paypal-blue to-[#0073e6] p-5 text-white shadow-xl shadow-[#004bba]/20 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              <p className="text-sm font-semibold uppercase tracking-wide">Professional Merchant Setup</p>
            </div>
            <p className="mt-2 text-sm text-white/90">
              Complete your profile, activate wallet collection, and launch your public store.
            </p>
          </div>
          <div className="min-w-20 rounded-2xl bg-white/15 px-3 py-2 text-center backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-wide text-white/80">Progress</p>
            <p className="text-lg font-semibold text-white">{completionPercent}%</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section className={cardClass}>
            <h2 className="font-semibold text-foreground">1. Merchant Basic Info</h2>
            <p className="mt-1 text-xs text-muted-foreground">Set your public identity and business details.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Merchant Name</label>
                <input className={fieldClass} placeholder="Burger Town LLC" value={merchantName} onChange={(e) => setMerchantName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Store Display Name</label>
                <input className={fieldClass} placeholder="Burger Town" value={storeDisplayName} onChange={(e) => setStoreDisplayName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Merchant Username</label>
                <input className={fieldClass} placeholder="burgertown" value={merchantUsername} onChange={(e) => setMerchantUsername(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Merchant Logo</label>
                <input className={`${fieldClass} pt-2`} type="file" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Store Cover Image (optional)</label>
                <input className={`${fieldClass} pt-2`} type="file" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Business Description</label>
                <textarea className={areaClass} placeholder="Describe your goods and services." value={businessDescription} onChange={(e) => setBusinessDescription(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-medium text-muted-foreground">Business Type</label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {["Individual", "Small Business", "Company"].map((type) => (
                    <label key={type} className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm">
                      <input type="radio" name="businessType" checked={businessType === type} onChange={() => setBusinessType(type)} />
                      {type}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="font-semibold text-foreground">2. Store Category</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Main Category</label>
                <select className={fieldClass} value={mainCategory} onChange={(e) => onMainCategoryChange(e.target.value)}>
                  {mainCategories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Sub-category</label>
                <select className={fieldClass} value={subCategory} onChange={(e) => setSubCategory(e.target.value)}>
                  {subCategories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="font-semibold text-foreground">3. Contact and Location</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Owner Name</label>
                <input className={fieldClass} placeholder="John Smith" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Email Address</label>
                <input className={fieldClass} placeholder="owner@store.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Phone Number</label>
                <input className={fieldClass} placeholder="+1 555 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Business Address</label>
                <input className={fieldClass} placeholder="123 Main Street" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Country</label>
                <input className={fieldClass} placeholder="United States" value={country} onChange={(e) => setCountry(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">City</label>
                <input className={fieldClass} placeholder="Los Angeles" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Map Pin Location (optional)</label>
                <input className={fieldClass} placeholder="34.0522,-118.2437" value={mapPin} onChange={(e) => setMapPin(e.target.value)} />
              </div>
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="font-semibold text-foreground">4. Payment and Wallet Setup</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">OpenPay Wallet Address</label>
                <input className={`${fieldClass} bg-secondary/60`} value={walletAddress} readOnly />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">Settlement Method</label>
                <div className="grid gap-2 text-sm">
                  <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3">
                    <input type="radio" name="settlement" checked={settlementMethod === "wallet"} onChange={() => setSettlementMethod("wallet")} />
                    Wallet only
                  </label>
                  <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3">
                    <input type="radio" name="settlement" checked={settlementMethod === "bank"} onChange={() => setSettlementMethod("bank")} />
                    Bank (future)
                  </label>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">Currency Supported</label>
                <div className="grid gap-2 text-sm">
                  <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3">
                    <input type="checkbox" checked={supportsLocal} onChange={(e) => setSupportsLocal(e.target.checked)} />
                    Local
                  </label>
                  <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3">
                    <input type="checkbox" checked={supportsCrypto} onChange={(e) => setSupportsCrypto(e.target.checked)} />
                    Crypto
                  </label>
                  <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3">
                    <input type="checkbox" checked={supportsStablecoin} onChange={(e) => setSupportsStablecoin(e.target.checked)} />
                    Stablecoin
                  </label>
                </div>
              </div>
            </div>
          </section>

          <section className={cardClass}>
            <div className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-paypal-blue" />
              <h2 className="font-semibold text-foreground">5. Merchant QR Code</h2>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {[
                { label: "Merchant Payment QR", link: payQr },
                { label: "Store Page QR", link: storeUrl },
                { label: "Tip QR", link: `${payQr}?type=tip` },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-border bg-background p-3">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="mt-1 min-h-10 break-all text-xs text-muted-foreground">{item.link}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="rounded-lg border border-border px-2 py-1.5 text-xs transition hover:bg-secondary/60">Download</button>
                    <button className="rounded-lg border border-border px-2 py-1.5 text-xs transition hover:bg-secondary/60">Print</button>
                    <button className="rounded-lg border border-border px-2 py-1.5 text-xs transition hover:bg-secondary/60">Share</button>
                    <button className="rounded-lg border border-border px-2 py-1.5 text-xs transition hover:bg-secondary/60">Embed</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="font-semibold text-foreground">6. Product and Service Setup</h2>
            <div className="mt-3 space-y-3">
              {products.map((product) => (
                <div key={product.id} className="rounded-2xl border border-border bg-background p-3">
                  <p className="mb-2 text-sm font-medium text-foreground">Item #{product.id}</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    <input className={fieldClass} placeholder="Item Name" value={product.name} onChange={(e) => updateProduct(product.id, "name", e.target.value)} />
                    <input className={fieldClass} placeholder="Price" value={product.price} onChange={(e) => updateProduct(product.id, "price", e.target.value)} />
                    <input className={fieldClass} placeholder="Category" value={product.category} onChange={(e) => updateProduct(product.id, "category", e.target.value)} />
                    <input className={fieldClass} placeholder="Image URL" value={product.image} onChange={(e) => updateProduct(product.id, "image", e.target.value)} />
                    <input className={fieldClass} placeholder="Stock (optional)" value={product.stock} onChange={(e) => updateProduct(product.id, "stock", e.target.value)} />
                    <input className={fieldClass} placeholder="Service Duration (optional)" value={product.serviceDuration} onChange={(e) => updateProduct(product.id, "serviceDuration", e.target.value)} />
                    <div className="md:col-span-2">
                      <textarea className={areaClass} placeholder="Description" value={product.description} onChange={(e) => updateProduct(product.id, "description", e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addProduct} className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary/60">
                Add Product or Service
              </button>
            </div>
          </section>
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section className={cardClass}>
            <h2 className="font-semibold text-foreground">7. Store Branding</h2>
            <div className="mt-3 grid gap-3">
              <label className="text-xs font-medium text-muted-foreground">
                Theme Color
                <input className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-2" type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} />
              </label>
              <select className={fieldClass} value={buttonStyle} onChange={(e) => setButtonStyle(e.target.value)}>
                {["Rounded", "Square", "Soft"].map((style) => (
                  <option key={style} value={style}>{style}</option>
                ))}
              </select>
              <input className={`${fieldClass} bg-secondary/60`} value={storeUrl} readOnly />
              <div className="rounded-2xl border border-border p-3">
                <p className="text-xs text-muted-foreground">Logo Preview</p>
                <div className="mt-2 h-16 w-16 rounded-full border border-border bg-secondary/40" />
              </div>
              <div className="rounded-2xl border border-border p-3">
                <p className="text-xs text-muted-foreground">QR Preview</p>
                <div className="mt-2 flex h-24 w-24 items-center justify-center rounded-xl border border-border bg-secondary/40">
                  <QrCode className="h-10 w-10 text-muted-foreground" />
                </div>
              </div>
            </div>
          </section>

          <section className={cardClass}>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-paypal-blue" />
              <h2 className="font-semibold text-foreground">8. Analytics</h2>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {["Total Sales", "Revenue D/W/M", "Transactions", "Avg Order", "Top Products", "Top Customers", "QR Scans"].map((metric) => (
                <div key={metric} className="rounded-xl border border-border bg-background p-2 text-muted-foreground">{metric}</div>
              ))}
            </div>
          </section>

          <section className={cardClass}>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-paypal-blue" />
              <h2 className="font-semibold text-foreground">9. Compliance</h2>
            </div>
            <div className="mt-3 grid gap-2 text-sm">
              <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3">
                <input type="checkbox" checked={idVerification} onChange={(e) => setIdVerification(e.target.checked)} />
                ID Verification
              </label>
              <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3">
                <input type="checkbox" checked={permitUploaded} onChange={(e) => setPermitUploaded(e.target.checked)} />
                Business Permit Upload
              </label>
              <input className={fieldClass} placeholder="Tax ID" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
              <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3">
                <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
                Terms Acceptance
              </label>
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="font-semibold text-foreground">Merchant Controls</h2>
            <div className="mt-3 grid gap-2">
              <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm">
                <input type="checkbox" checked={storeEnabled} onChange={(e) => setStoreEnabled(e.target.checked)} />
                Enable Store
              </label>
              <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm">
                <input type="checkbox" checked={paymentsPaused} onChange={(e) => setPaymentsPaused(e.target.checked)} />
                Pause Payments
              </label>
              {["Refund", "Transaction History", "Export CSV", "Change Category", "Update Logo", "Update QR", "Reset Username"].map((action) => (
                <button key={action} className="h-10 rounded-xl border border-border bg-background px-3 text-left text-sm transition hover:bg-secondary/60">
                  {action}
                </button>
              ))}
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="font-semibold text-foreground">Example Profile</h2>
            <pre className="mt-2 overflow-x-auto rounded-2xl bg-secondary/40 p-3 text-xs text-muted-foreground">
{`Merchant Name: Burger Town
Username: burgertown
Category: Food > Restaurant
QR: openpay://pay/burgertown
Store URL: openpay.app/store/burgertown`}
            </pre>
          </section>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={handleSaveDraftNow}
          disabled={savingDraft}
          className="paypal-surface inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm transition hover:bg-secondary/70 disabled:opacity-60"
        >
          Save Draft
        </button>
        <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-paypal-blue px-4 text-sm font-medium text-white transition hover:bg-[#005aa3]">
          <Download className="h-4 w-4" />
          Download QR
        </button>
        <button className="paypal-surface inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm transition hover:bg-secondary/70">
          <Printer className="h-4 w-4" />
          Print QR
        </button>
        <button className="paypal-surface inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm transition hover:bg-secondary/70">
          <Share2 className="h-4 w-4" />
          Share Store
        </button>
      </div>
    </div>
  );
};

export default MerchantOnboardingPage;
