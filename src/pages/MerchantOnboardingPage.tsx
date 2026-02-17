import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Download, Printer } from "lucide-react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loadUserPreferences, upsertUserPreferences } from "@/lib/userPreferences";

type PrintSize = "small" | "medium" | "large";
type QrDesign = "clean" | "gradient" | "badge";

const MerchantOnboardingPage = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState("OpenPay Merchant");
  const [merchantUsername, setMerchantUsername] = useState("");
  const [qrTagline, setQrTagline] = useState("SCAN TO PAY");
  const [qrAccent, setQrAccent] = useState("#2148ff");
  const [qrBackground, setQrBackground] = useState("#ffffff");
  const [qrDesign, setQrDesign] = useState<QrDesign>("clean");
  const [printSize, setPrintSize] = useState<PrintSize>("large");
  const [saving, setSaving] = useState(false);

  const normalizedUsername = useMemo(
    () => merchantUsername.trim().replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9_]+/g, ""),
    [merchantUsername],
  );

  const qrValue = useMemo(() => {
    if (!userId) return "";
    const params = new URLSearchParams({
      uid: userId,
      username: normalizedUsername || "",
      merchant: "true",
    });
    return `openpay://pay?${params.toString()}`;
  }, [userId, normalizedUsername]);

  const webPayLink = useMemo(() => {
    if (!userId || typeof window === "undefined") return "";
    return `${window.location.origin}/send?to=${userId}`;
  }, [userId]);

  const printSizeConfig = useMemo(() => {
    if (printSize === "small") return { qr: 170, canvas: 900 };
    if (printSize === "medium") return { qr: 210, canvas: 1024 };
    return { qr: 250, canvas: 1200 };
  }, [printSize]);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.full_name?.trim()) setMerchantName(profile.full_name);
      if (profile?.username?.trim()) setMerchantUsername(profile.username);

      try {
        const prefs = await loadUserPreferences(user.id);
        const draft = prefs.merchant_onboarding_data?.merchant_store;
        if (draft && typeof draft === "object") {
          const store = draft as Record<string, unknown>;
          if (typeof store.merchantName === "string" && store.merchantName.trim()) setMerchantName(store.merchantName);
          if (typeof store.merchantUsername === "string") setMerchantUsername(store.merchantUsername);
          if (typeof store.qrTagline === "string" && store.qrTagline.trim()) setQrTagline(store.qrTagline);
          if (typeof store.qrAccent === "string" && store.qrAccent.trim()) setQrAccent(store.qrAccent);
          if (typeof store.qrBackground === "string" && store.qrBackground.trim()) setQrBackground(store.qrBackground);
          if (store.qrDesign === "clean" || store.qrDesign === "gradient" || store.qrDesign === "badge") {
            setQrDesign(store.qrDesign);
          }
          if (store.printSize === "small" || store.printSize === "medium" || store.printSize === "large") {
            setPrintSize(store.printSize);
          }
        }
      } catch {
        // Keep defaults when preferences are unavailable.
      }
    };

    load();
  }, [navigate]);

  useEffect(() => {
    if (!userId) return;
    const timer = window.setTimeout(async () => {
      setSaving(true);
      try {
        await upsertUserPreferences(userId, {
          profile_full_name: merchantName.trim() || null,
          profile_username: normalizedUsername || null,
          merchant_onboarding_data: {
            merchant_store: {
              merchantName: merchantName.trim(),
              merchantUsername: normalizedUsername,
              qrTagline: qrTagline.trim(),
              qrAccent,
              qrBackground,
              qrDesign,
              printSize,
              updatedAt: new Date().toISOString(),
            },
          },
          qr_print_settings: {
            name: merchantName.trim(),
            merchantUsername: normalizedUsername,
            tagline: qrTagline.trim(),
            accent: qrAccent,
            background: qrBackground,
            design: qrDesign,
            size: printSize,
          },
        });
      } catch {
        // Keep local form state.
      } finally {
        setSaving(false);
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [userId, merchantName, normalizedUsername, qrTagline, qrAccent, qrBackground, qrDesign, printSize]);

  const handleCopy = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const handleDownloadQr = () => {
    const canvas = document.getElementById("merchant-qr-download-source") as HTMLCanvasElement | null;
    if (!canvas) {
      toast.error("QR not ready");
      return;
    }
    const link = document.createElement("a");
    const safeName = (merchantName || "openpay-merchant")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    link.href = canvas.toDataURL("image/png");
    link.download = `${safeName || "openpay-merchant"}-qr.png`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-10">
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => navigate("/menu")}
          className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-paypal-dark">Merchant Onboarding</h1>
          <p className="text-xs text-muted-foreground">Simple merchant store setup {saving ? "· Saving..." : "· Auto-saved"}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-white/30 bg-gradient-to-br from-paypal-blue to-[#0073e6] p-5 text-white shadow-xl shadow-[#004bba]/20">
        <p className="text-sm font-semibold uppercase tracking-wide">Merchant Store Setup</p>
        <p className="mt-2 text-sm text-white/90">
          Set merchant name, username, and a customizable merchant QR code. That is all you need to start.
        </p>
      </div>

      <div className="paypal-surface mt-4 rounded-3xl p-5">
        <h2 className="font-semibold text-foreground">Merchant Profile</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <p className="mb-1 text-sm text-muted-foreground">Merchant Name</p>
            <Input
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              placeholder="OpenPay Merchant"
              className="h-12 rounded-2xl bg-white"
            />
          </div>
          <div className="md:col-span-2">
            <p className="mb-1 text-sm text-muted-foreground">Merchant Username</p>
            <Input
              value={merchantUsername}
              onChange={(e) => setMerchantUsername(e.target.value)}
              placeholder="merchant_username"
              className="h-12 rounded-2xl bg-white"
            />
            <p className="mt-1 text-xs text-muted-foreground">Public username: @{normalizedUsername || "merchant_username"}</p>
          </div>
        </div>
      </div>

      <div className="paypal-surface mt-4 rounded-3xl p-5">
        <h2 className="font-semibold text-foreground">Merchant QR Customization</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Input
            value={qrTagline}
            onChange={(e) => setQrTagline(e.target.value)}
            placeholder="Tagline"
            className="h-11 rounded-xl bg-white"
          />
          <select
            value={qrDesign}
            onChange={(e) => setQrDesign(e.target.value as QrDesign)}
            className="h-11 rounded-xl border border-input bg-white px-3 text-sm text-foreground"
          >
            <option value="clean">Clean</option>
            <option value="gradient">Gradient</option>
            <option value="badge">Badge</option>
          </select>
          <label className="text-xs text-muted-foreground">
            Accent Color
            <input
              type="color"
              value={qrAccent}
              onChange={(e) => setQrAccent(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-border bg-white p-1"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Background
            <input
              type="color"
              value={qrBackground}
              onChange={(e) => setQrBackground(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-border bg-white p-1"
            />
          </label>
          <select
            value={printSize}
            onChange={(e) => setPrintSize(e.target.value as PrintSize)}
            className="h-11 rounded-xl border border-input bg-white px-3 text-sm text-foreground md:col-span-2"
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-white p-4">
          <div className="mb-3 text-center">
            <p className="text-lg font-bold text-paypal-dark">{merchantName || "OpenPay Merchant"}</p>
            <p className="text-xs text-muted-foreground">@{normalizedUsername || "merchant_username"}</p>
          </div>
          <div className="flex justify-center">
            {qrValue ? (
              <QRCodeSVG
                value={qrValue}
                size={printSizeConfig.qr}
                level="H"
                includeMargin
                bgColor={qrBackground}
                fgColor={qrAccent}
              />
            ) : null}
          </div>
          <p className="mt-3 text-center text-xs font-semibold tracking-wide text-muted-foreground">{qrTagline || "SCAN TO PAY"}</p>
          <p className="mt-1 break-all text-center text-xs text-muted-foreground">{webPayLink || "Loading link..."}</p>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button onClick={() => handleCopy(qrValue, "Merchant QR link")} className="h-11 rounded-2xl">
            <Copy className="mr-2 h-4 w-4" />
            Copy QR Link
          </Button>
          <Button onClick={() => handleCopy(webPayLink, "Merchant web link")} variant="outline" className="h-11 rounded-2xl">
            <Copy className="mr-2 h-4 w-4" />
            Copy Web Link
          </Button>
          <Button onClick={handleDownloadQr} variant="outline" className="h-11 rounded-2xl">
            <Download className="mr-2 h-4 w-4" />
            Download QR
          </Button>
          <Button onClick={() => window.print()} variant="outline" className="h-11 rounded-2xl">
            <Printer className="mr-2 h-4 w-4" />
            Print QR
          </Button>
        </div>
      </div>

      <div className="hidden">
        {qrValue ? (
          <QRCodeCanvas
            id="merchant-qr-download-source"
            value={qrValue}
            size={printSizeConfig.canvas}
            level="H"
            includeMargin
            bgColor={qrBackground}
            fgColor={qrAccent}
          />
        ) : null}
      </div>
    </div>
  );
};

export default MerchantOnboardingPage;
