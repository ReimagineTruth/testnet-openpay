import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, QrCode, ScanLine } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useCurrency } from "@/contexts/CurrencyContext";
import { getFunctionErrorMessage } from "@/lib/supabaseFunctionError";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";

interface Profile {
  id: string;
  full_name: string;
  username: string | null;
}

interface PaymentRequest {
  id: string;
  requester_id: string;
  payer_id: string;
  amount: number;
  note: string | null;
  status: string;
  created_at: string;
}

const RequestMoney = () => {
  const navigate = useNavigate();
  const { format: formatCurrency } = useCurrency();
  const [userId, setUserId] = useState<string | null>(null);
  const [selfProfile, setSelfProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [payerId, setPayerId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanError, setScanError] = useState("");

  const profileMap = useMemo(() => {
    const map = new Map<string, Profile>();
    profiles.forEach((p) => map.set(p.id, p));
    return map;
  }, [profiles]);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/signin");
      return;
    }
    setUserId(user.id);

    const { data: selfProfileRow } = await supabase
      .from("profiles")
      .select("id, full_name, username")
      .eq("id", user.id)
      .single();

    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, full_name, username")
      .neq("id", user.id);

    const { data: requestRows } = await supabase
      .from("payment_requests")
      .select("id, requester_id, payer_id, amount, note, status, created_at")
      .or(`requester_id.eq.${user.id},payer_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    setProfiles(profileRows || []);
    setSelfProfile(selfProfileRow || null);
    setRequests(requestRows || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredProfiles = search
    ? profiles.filter((p) =>
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.username && p.username.toLowerCase().includes(search.toLowerCase())))
    : profiles;

  const incoming = requests.filter((r) => r.payer_id === userId);
  const outgoing = requests.filter((r) => r.requester_id === userId);
  const receiveQrValue = useMemo(() => {
    if (!userId) return "";
    const params = new URLSearchParams({
      uid: userId,
      name: selfProfile?.full_name || "",
      username: selfProfile?.username || "",
    });
    return `openpay://pay?${params.toString()}`;
  }, [selfProfile?.full_name, selfProfile?.username, userId]);

  const extractUserIdFromQr = (rawValue: string): string | null => {
    const value = rawValue.trim();
    if (!value) return null;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(value)) return value;

    try {
      const parsed = new URL(value);
      const uid = parsed.searchParams.get("uid") || parsed.searchParams.get("to");
      if (uid && uuidRegex.test(uid)) return uid;
    } catch {
      // no-op
    }

    const maybeUid = value.split("uid=")[1]?.split("&")[0];
    if (maybeUid && uuidRegex.test(maybeUid)) return maybeUid;

    return null;
  };

  useEffect(() => {
    if (!showScanner) return;

    let scanner: Html5Qrcode | null = null;
    let isDone = false;
    setScanError("");

    const startScanner = async () => {
      scanner = new Html5Qrcode("openpay-receive-scanner");
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          async (decodedText) => {
            if (isDone) return;
            isDone = true;

            const scannedUserId = extractUserIdFromQr(decodedText);
            if (scanner) {
              await scanner.stop().catch(() => undefined);
              await scanner.clear().catch(() => undefined);
            }
            setShowScanner(false);

            if (!scannedUserId) {
              toast.error("Invalid QR code");
              return;
            }
            if (scannedUserId === userId) {
              toast.error("You scanned your own QR code");
              return;
            }
            navigate(`/send?to=${scannedUserId}`);
          },
          () => undefined,
        );
      } catch (error) {
        setScanError(error instanceof Error ? error.message : "Unable to start camera");
      }
    };

    startScanner();

    return () => {
      isDone = true;
      if (scanner) {
        const s = scanner;
        s.stop().catch(() => undefined);
        s.clear().catch(() => undefined);
      }
    };
  }, [navigate, showScanner, userId]);

  const handleCreate = async () => {
    if (!userId || !payerId) {
      toast.error("Select who you are requesting from");
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("payment_requests").insert({
      requester_id: userId,
      payer_id: payerId,
      amount: parsedAmount,
      note: note.trim() || "",
      status: "pending",
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Request sent");
    setAmount("");
    setNote("");
    setPayerId("");
    await loadData();
  };

  const handlePay = async (request: PaymentRequest) => {
    setLoading(true);
    const { error } = await supabase.functions.invoke("send-money", {
      body: {
        receiver_id: request.requester_id,
        receiver_email: "__by_id__",
        amount: request.amount,
        note: request.note || "Payment request",
      },
    });

    if (error) {
      setLoading(false);
      toast.error(await getFunctionErrorMessage(error, "Payment failed"));
      return;
    }

    const { error: updateError } = await supabase
      .from("payment_requests")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", request.id);

    setLoading(false);
    if (updateError) {
      toast.error(updateError.message);
      return;
    }

    toast.success("Request paid");
    await loadData();
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase
      .from("payment_requests")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Request rejected");
    await loadData();
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="flex items-center gap-3 px-4 pt-4 mb-4">
        <button onClick={() => navigate("/menu")}>
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Request Money</h1>
      </div>

      <div className="px-4 space-y-4">
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-foreground">Receive via QR</h2>
              <p className="text-sm text-muted-foreground">{selfProfile?.full_name || "Your account"}</p>
              {selfProfile?.username && <p className="text-sm text-muted-foreground">@{selfProfile.username}</p>}
            </div>
            <Button type="button" variant="outline" onClick={() => setShowScanner(true)}>
              <ScanLine className="mr-2 h-4 w-4" />
              Scan QR code
            </Button>
          </div>
          <div className="flex justify-center rounded-2xl border border-border bg-white p-4">
            {receiveQrValue ? (
              <QRCodeSVG value={receiveQrValue} size={180} level="M" includeMargin />
            ) : (
              <p className="text-sm text-muted-foreground">Loading QR code...</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Ask sender to scan this QR to open Express Send with your account.
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="font-semibold text-foreground">Create request</h2>
          <Input
            placeholder="Search person by name or username"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-40 overflow-auto rounded-xl border border-border">
            {filteredProfiles.map((p) => (
              <button
                key={p.id}
                onClick={() => setPayerId(p.id)}
                className={`w-full text-left px-3 py-2 hover:bg-muted ${payerId === p.id ? "bg-muted" : ""}`}
              >
                <p className="font-medium text-foreground">{p.full_name}</p>
                {p.username && <p className="text-sm text-muted-foreground">@{p.username}</p>}
              </button>
            ))}
            {filteredProfiles.length === 0 && (
              <p className="px-3 py-4 text-sm text-muted-foreground">No users found</p>
            )}
          </div>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Textarea
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button onClick={handleCreate} disabled={loading || !payerId} className="w-full">
            {loading ? "Sending..." : "Send Request"}
          </Button>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="font-semibold text-foreground">Incoming requests</h2>
          {incoming.length === 0 && <p className="text-sm text-muted-foreground">No incoming requests</p>}
          {incoming.map((request) => {
            const requester = profileMap.get(request.requester_id);
            return (
              <div key={request.id} className="border border-border rounded-xl p-3">
                <p className="font-medium text-foreground">{requester?.full_name || "Unknown user"}</p>
                {requester?.username && <p className="text-sm text-muted-foreground">@{requester.username}</p>}
                <p className="text-sm text-muted-foreground">{format(new Date(request.created_at), "MMM d, yyyy")}</p>
                <p className="font-semibold mt-1">{formatCurrency(request.amount)}</p>
                {request.note && <p className="text-sm text-muted-foreground mt-1">{request.note}</p>}
                <p className="text-sm mt-1 capitalize">Status: {request.status}</p>
                {request.status === "pending" && (
                  <div className="flex gap-2 mt-3">
                    <Button className="flex-1" disabled={loading} onClick={() => handlePay(request)}>
                      Pay
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      disabled={loading}
                      onClick={() => handleReject(request.id)}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="font-semibold text-foreground">Sent requests</h2>
          {outgoing.length === 0 && <p className="text-sm text-muted-foreground">No requests sent yet</p>}
          {outgoing.map((request) => {
            const payer = profileMap.get(request.payer_id);
            return (
              <div key={request.id} className="border border-border rounded-xl p-3">
                <p className="font-medium text-foreground">{payer?.full_name || "Unknown user"}</p>
                {payer?.username && <p className="text-sm text-muted-foreground">@{payer.username}</p>}
                <p className="text-sm text-muted-foreground">{format(new Date(request.created_at), "MMM d, yyyy")}</p>
                <p className="font-semibold mt-1">{formatCurrency(request.amount)}</p>
                {request.note && <p className="text-sm text-muted-foreground mt-1">{request.note}</p>}
                <p className="text-sm mt-1 capitalize">Status: {request.status}</p>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={showScanner} onOpenChange={setShowScanner}>
        <DialogContent className="max-w-md rounded-3xl">
          <div className="mb-2 flex items-center gap-2">
            <QrCode className="h-5 w-5 text-foreground" />
            <h3 className="text-lg font-semibold text-foreground">Scan QR Code</h3>
          </div>
          <div id="openpay-receive-scanner" className="min-h-[260px] overflow-hidden rounded-2xl border border-border" />
          {scanError && <p className="text-sm text-red-500">{scanError}</p>}
          <p className="text-xs text-muted-foreground">Point your camera at an OpenPay receive QR code.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RequestMoney;
