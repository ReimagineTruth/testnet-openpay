import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/contexts/CurrencyContext";

interface SelfProfile {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
}

const ReceivePage = () => {
  const navigate = useNavigate();
  const { currencies, currency } = useCurrency();
  const [profile, setProfile] = useState<SelfProfile | null>(null);
  const [amount, setAmount] = useState("");
  const [currencyCode, setCurrencyCode] = useState(currency.code);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/signin");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .eq("id", user.id)
        .single();

      setProfile(data || null);
    };

    load();
  }, [navigate]);

  useEffect(() => {
    if (!currencies.find((c) => c.code === currencyCode)) {
      setCurrencyCode(currency.code);
    }
  }, [currencies, currency.code, currencyCode]);

  const parsedAmount = Number(amount);
  const normalizedAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount.toFixed(2) : "";

  const receiveQrValue = useMemo(() => {
    if (!profile?.id) return "";
    const params = new URLSearchParams({
      uid: profile.id,
      name: profile.full_name || "",
      username: profile.username || "",
      currency: currencyCode,
    });
    if (normalizedAmount) params.set("amount", normalizedAmount);
    return `openpay://pay?${params.toString()}`;
  }, [currencyCode, normalizedAmount, profile?.full_name, profile?.id, profile?.username]);

  const initials = profile?.full_name
    ? profile.full_name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
    : "OP";
  const getPiCodeLabel = (code: string) => (code === "PI" ? "PI" : `PI ${code}`);

  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-10">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate("/dashboard")}><ArrowLeft className="h-6 w-6 text-foreground" /></button>
        <h1 className="text-xl font-bold text-paypal-dark">Receive</h1>
      </div>

      <div className="paypal-surface rounded-3xl p-5">
        <div className="mb-5 flex items-center gap-3">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Profile avatar" className="h-14 w-14 rounded-full border border-border object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-paypal-blue text-lg font-bold text-white">{initials}</div>
          )}
          <div>
            <p className="font-semibold text-foreground">{profile?.full_name || "OpenPay User"}</p>
            {profile?.username && <p className="text-sm text-muted-foreground">@{profile.username}</p>}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Custom Amount (optional)</p>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 25.00"
              className="h-12 rounded-2xl bg-white"
            />
          </div>

          <div>
            <p className="mb-1 text-sm text-muted-foreground">Currency</p>
            <select
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value)}
              className="h-12 w-full rounded-2xl border border-input bg-white px-3 text-sm text-foreground"
            >
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {getPiCodeLabel(c.code)} - {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-border bg-white p-4">
          <div className="flex justify-center">
            {receiveQrValue ? (
              <QRCodeSVG
                value={receiveQrValue}
                size={210}
                level="H"
                includeMargin
                imageSettings={{
                  src: "/openpay-o.svg",
                  height: 34,
                  width: 34,
                  excavate: true,
                }}
              />
            ) : null}
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Sender can scan this QR in Express Send to auto-fill your details.
          </p>
        </div>

        <Button className="mt-4 h-12 w-full rounded-2xl" onClick={() => navigate("/send")}>
          Open Express Send
        </Button>
      </div>
    </div>
  );
};

export default ReceivePage;
