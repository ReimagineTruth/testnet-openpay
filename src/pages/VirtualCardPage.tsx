import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, CreditCard, Eye, EyeOff, Lock, RefreshCw, RotateCcw, Settings, ShieldCheck, Unlock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import BrandLogo from "@/components/BrandLogo";
import BottomNav from "@/components/BottomNav";
import { useCurrency } from "@/contexts/CurrencyContext";

interface VirtualCardRecord {
  id: string;
  user_id: string;
  cardholder_name: string;
  card_username: string;
  card_number: string;
  expiry_month: number;
  expiry_year: number;
  cvc: string;
  is_active: boolean;
  hide_details: boolean;
  is_locked: boolean;
  locked_at: string | null;
  card_settings: { allow_checkout?: boolean } | null;
}

const formatCardNumber = (value: string) => value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim();

const VirtualCardPage = () => {
  const navigate = useNavigate();
  const { format: formatCurrency } = useCurrency();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<VirtualCardRecord | null>(null);
  const [flipTurns, setFlipTurns] = useState(0);
  const [userId, setUserId] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [updatingControls, setUpdatingControls] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showSafetyAgreement, setShowSafetyAgreement] = useState(false);
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [cardSignature, setCardSignature] = useState("");
  const [signatureLoaded, setSignatureLoaded] = useState(false);

  const maskedCardNumber = useMemo(() => {
    if (!card?.card_number) return "0000 0000 0000 0000";
    const clean = card.card_number.replace(/\D/g, "");
    const masked = clean.slice(0, 4) + " **** **** " + clean.slice(-4);
    return masked;
  }, [card?.card_number]);

  const signatureStorageKey = useMemo(
    () => (userId ? `openpay_virtual_card_signature_${userId}` : ""),
    [userId],
  );

  const loadVirtualCard = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);

      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .single();
      setBalance(wallet?.balance || 0);

      const { data, error } = await supabase.rpc("upsert_my_virtual_card", {
        p_cardholder_name: null,
        p_card_username: null,
      });

      if (error) throw error;
      const cardData = data as unknown as VirtualCardRecord;
      setCard(cardData);
      const accepted = localStorage.getItem(`openpay_virtual_card_safety_v1_${user.id}`) === "1";
      if (!accepted) {
        setShowSafetyAgreement(true);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load virtual card");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVirtualCard();
  }, [navigate]);

  useEffect(() => {
    if (!signatureStorageKey || typeof window === "undefined") return;
    const saved = localStorage.getItem(signatureStorageKey) || "";
    setCardSignature(saved);
    setSignatureLoaded(true);
  }, [signatureStorageKey]);

  useEffect(() => {
    if (!signatureStorageKey || !signatureLoaded || typeof window === "undefined") return;
    localStorage.setItem(signatureStorageKey, cardSignature);
  }, [signatureStorageKey, signatureLoaded, cardSignature]);

  const isBackVisible = flipTurns % 2 !== 0;
  const hideDetails = card?.hide_details ?? false;
  const isLocked = card?.is_locked ?? false;
  const allowCheckout = card?.card_settings?.allow_checkout ?? true;

  const handleFlip = () => {
    setFlipTurns((value) => value + 1);
  };

  const updateControls = async (params: {
    hideDetails?: boolean;
    lockCard?: boolean;
    allowCheckout?: boolean;
  }) => {
    setUpdatingControls(true);
    try {
      const patchSettings =
        params.allowCheckout === undefined ? null : { allow_checkout: params.allowCheckout };
      const { data, error } = await supabase.rpc("update_my_virtual_card_controls", {
        p_hide_details: params.hideDetails === undefined ? null : params.hideDetails,
        p_lock_card: params.lockCard === undefined ? null : params.lockCard,
        p_card_settings: patchSettings,
      });
      if (error) throw error;
      const updated = data as unknown as VirtualCardRecord;
      setCard(updated);
      toast.success("Card controls updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update card controls");
    } finally {
      setUpdatingControls(false);
    }
  };

  const acceptSafetyAgreement = () => {
    if (!userId || !agreementChecked) return;
    localStorage.setItem(`openpay_virtual_card_safety_v1_${userId}`, "1");
    setShowSafetyAgreement(false);
    toast.success("Safety agreement accepted");
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="px-4 pt-4">
        <div className="mb-5 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full" aria-label="Back">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="paypal-heading">OpenPay Virtual Card</h1>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/95 p-3 text-sm text-muted-foreground">
          Your virtual card is linked to your OpenPay balance: <span className="font-semibold text-foreground">{formatCurrency(balance)}</span>
        </div>

        <div className="mx-auto mt-4 w-full max-w-[420px] [perspective:1200px]">
          <button
            type="button"
            onClick={handleFlip}
            className="relative w-full aspect-[1.586] rounded-3xl text-left [transform-style:preserve-3d] transition-transform duration-700"
            style={{ transform: `rotateY(${flipTurns * 180}deg)` }}
            aria-label="Flip virtual card"
          >
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-paypal-blue to-[#0073e6] p-[6%] text-white shadow-xl shadow-[#004bba]/30 [backface-visibility:hidden]">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <BrandLogo className="h-8 w-8" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-white/80">OpenPay</p>
                    <p className="text-sm font-semibold">Virtual Credit Card</p>
                  </div>
                </div>
                <CreditCard className="h-6 w-6 text-white/90" />
              </div>
              <div className="mt-[8%] h-[17%] w-[22%] rounded-lg bg-white/20" />
              <p className="mt-[6%] text-[clamp(1rem,4.3vw,1.5rem)] font-semibold tracking-[0.14em]">
                {hideDetails ? "**** **** **** ****" : (formatCardNumber(card?.card_number || "") || "0000 0000 0000 0000")}
              </p>
              <div className="mt-[7%] flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-white/75">Cardholder</p>
                  <p className="text-sm font-semibold">{hideDetails ? "OPENPAY USER" : (card?.cardholder_name || "OPENPAY USER")}</p>
                  <p className="text-xs text-white/80">@{hideDetails ? "hidden" : (card?.card_username || "openpay")}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wide text-white/75">Valid Thru</p>
                  <p className="text-sm font-semibold">
                    {String(card?.expiry_month || 1).padStart(2, "0")}/{String((card?.expiry_year || 2026) % 100).padStart(2, "0")}
                  </p>
                </div>
              </div>
            </div>

            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#1b1f31] to-[#2a3150] p-[6%] text-white shadow-xl shadow-black/30 [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BrandLogo className="h-6 w-6" />
                  <p className="text-sm font-semibold tracking-wide text-white/90">OpenPay</p>
                </div>
                <p className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[9px] font-medium uppercase tracking-wide text-white/80">
                  Powered by Pi Network
                </p>
              </div>
              <div className="relative mt-[6%] h-[16%] rounded-md bg-black/70">
                <p className="absolute inset-0 flex items-center justify-center px-3 text-sm italic text-white/85">
                  {cardSignature.trim() || "Signature"}
                </p>
              </div>
              <div className="mt-[10%] flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-white/70">Security Code</p>
                <p className="rounded-md bg-white/20 px-2 py-1 text-sm font-semibold">{hideDetails ? "***" : (card?.cvc || "***")}</p>
              </div>
              <p className="mt-[8%] text-sm text-white/80">
                {hideDetails ? "**** **** **** ****" : maskedCardNumber}
              </p>
              <p className="mt-[8%] text-xs text-white/70">
                Tap card to flip {isBackVisible ? "to front" : "to back"}
              </p>
            </div>
          </button>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleFlip}
          className="mt-3 h-11 w-full rounded-2xl"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          {isBackVisible ? "Show Front of Card" : "Show Back of Card"}
        </Button>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="h-11 rounded-2xl" onClick={() => setShowGuide(true)}>
            <BookOpen className="mr-2 h-4 w-4" />
            Guide
          </Button>
          <Button type="button" variant="outline" className="h-11 rounded-2xl" onClick={() => setShowSafetyAgreement(true)}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Safety Agreement
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-16 rounded-2xl"
            disabled={updatingControls}
            onClick={() => updateControls({ hideDetails: !hideDetails })}
          >
            {hideDetails ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
            {hideDetails ? "Show Details" : "Hide Details"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-16 rounded-2xl"
            disabled={updatingControls}
            onClick={() => updateControls({ lockCard: !isLocked })}
          >
            {isLocked ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
            {isLocked ? "Unlock Card" : "Lock Card"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-16 rounded-2xl"
            onClick={() => setShowSettings((prev) => !prev)}
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>

        {showSettings && (
          <div className="paypal-surface mt-3 rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-foreground">Virtual Card Settings</h3>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Allow checkout payments</p>
                <p className="text-xs text-muted-foreground">Disable to block merchant checkout using this card.</p>
              </div>
              <Button
                type="button"
                variant={allowCheckout ? "default" : "outline"}
                className={`h-9 rounded-xl ${allowCheckout ? "bg-paypal-blue text-white hover:bg-[#004dc5]" : ""}`}
                disabled={updatingControls}
                onClick={() => updateControls({ allowCheckout: !allowCheckout })}
              >
                {allowCheckout ? "Enabled" : "Disabled"}
              </Button>
            </div>
            <div className="mt-3">
              <p className="text-sm font-medium text-foreground">Back-card signature</p>
              <Input
                value={cardSignature}
                onChange={(e) => setCardSignature(e.target.value.slice(0, 32))}
                placeholder="Type your signature"
                className="mt-2 h-10 rounded-xl"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                This signature is shown on the back of your virtual card.
              </p>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Card status: {isLocked ? "Locked" : "Active"} {card?.locked_at ? `| Locked at: ${new Date(card.locked_at).toLocaleString()}` : ""}
            </p>
          </div>
        )}

        <div className="paypal-surface mt-4 rounded-3xl p-4">
          <h2 className="text-base font-semibold text-foreground">Card Details</h2>
          <div className="mt-3 space-y-3">
            <Input
              value={card?.cardholder_name || ""}
              readOnly
              placeholder="Cardholder full name"
              className="h-12 rounded-2xl bg-secondary/50"
            />
            <Input
              value={card?.card_username || ""}
              readOnly
              placeholder="Card username"
              className="h-12 rounded-2xl bg-secondary/50"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                value={hideDetails ? "**** **** **** ****" : formatCardNumber(card?.card_number || "")}
                readOnly
                placeholder="Card number"
                className="h-12 rounded-2xl bg-secondary/50 font-mono"
              />
              <Input
                value={`${String(card?.expiry_month || 1).padStart(2, "0")}/${card?.expiry_year || 2026}`}
                readOnly
                placeholder="MM/YYYY"
                className="h-12 rounded-2xl bg-secondary/50 font-mono"
              />
            </div>
            <Input
              value={hideDetails ? "***" : (card?.cvc || "")}
              readOnly
              placeholder="CVC"
              className="h-12 rounded-2xl bg-secondary/50 font-mono"
            />
            <Button
              type="button"
              variant="outline"
              onClick={loadVirtualCard}
              disabled={loading}
              className="h-11 w-full rounded-2xl"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh Card
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Card name and username are synced from your profile and cannot be edited here.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Update your profile details to change cardholder name or card username.
          </p>
        </div>
      </div>

      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogTitle className="text-xl font-bold text-foreground">How to Use OpenPay Virtual Card</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Quick steps to use your OpenPay virtual card safely.
          </DialogDescription>
          <div className="rounded-2xl border border-border/70 p-3 text-sm text-foreground">
            <p>1. Open Menu and tap Virtual Card.</p>
            <p>2. Set cardholder name and username, then save.</p>
            <p>3. Use Hide Details in public places.</p>
            <p>4. Lock Card when not in use.</p>
            <p>5. In Merchant Checkout, choose Virtual Card and enter card number, expiry, and CVC.</p>
            <p>6. Payment is deducted from your OpenPay wallet balance.</p>
            <p>7. OpenPay virtual card works only for OpenPay Merchant Checkout transactions.</p>
            <p>8. It cannot be used in ATM, banks, external card networks, or non-OpenPay payments.</p>
          </div>
          <Button className="h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]" onClick={() => setShowGuide(false)}>
            Close Guide
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showSafetyAgreement} onOpenChange={setShowSafetyAgreement}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogTitle className="text-xl font-bold text-foreground">Virtual Card Safety Agreement</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            You must follow these rules to protect your account and payments.
          </DialogDescription>
          <div className="rounded-2xl border border-border/70 p-3 text-sm text-foreground">
            <p>1. Keep your virtual card details private.</p>
            <p>2. Do not share card number, expiry, or CVC in chat or social posts.</p>
            <p>3. Lock your card when not using checkout.</p>
            <p>4. Only pay trusted OpenPay merchants.</p>
            <p>5. Review amount and merchant details before confirming payment.</p>
            <p>6. Use OpenPay virtual card only in OpenPay Merchant Checkout.</p>
            <p>7. No ATM cash-out, no bank card swipe, and no non-OpenPay transaction usage.</p>
          </div>
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={agreementChecked}
              onChange={(event) => setAgreementChecked(event.target.checked)}
              className="mt-1"
            />
            I agree to use OpenPay virtual card only for OpenPay Merchant Checkout and follow all safety rules above.
          </label>
          <Button
            className="h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
            onClick={acceptSafetyAgreement}
            disabled={!agreementChecked}
          >
            Accept Agreement
          </Button>
        </DialogContent>
      </Dialog>

      <BottomNav active="menu" />
    </div>
  );
};

export default VirtualCardPage;
