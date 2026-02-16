import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, Info, ScanLine, QrCode, Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useCurrency } from "@/contexts/CurrencyContext";
import { getFunctionErrorMessage } from "@/lib/supabaseFunctionError";
import CurrencySelector from "@/components/CurrencySelector";
import TransactionReceipt, { type ReceiptData } from "@/components/TransactionReceipt";
import { Html5Qrcode } from "html5-qrcode";

interface UserProfile {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url?: string | null;
}

interface RecentRecipient extends UserProfile {
  last_sent_at: string;
}

const extractQrPayload = (rawValue: string) => {
  const value = rawValue.trim();
  if (!value) return { uid: null as string | null, amount: "", currency: "" };

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(value)) return { uid: value, amount: "", currency: "" };

  try {
    const parsed = new URL(value);
    const uid = parsed.searchParams.get("uid") || parsed.searchParams.get("to");
    const amount = parsed.searchParams.get("amount") || "";
    const currencyCode = (parsed.searchParams.get("currency") || "").toUpperCase();
    return { uid: uid && uuidRegex.test(uid) ? uid : null, amount, currency: currencyCode };
  } catch {
    // no-op
  }

  const maybeUid = value.split("uid=")[1]?.split("&")[0];
  const maybeAmount = value.split("amount=")[1]?.split("&")[0] || "";
  const maybeCurrency = (value.split("currency=")[1]?.split("&")[0] || "").toUpperCase();
  return { uid: maybeUid && uuidRegex.test(maybeUid) ? maybeUid : null, amount: maybeAmount, currency: maybeCurrency };
};

const SendMoney = () => {
  const [step, setStep] = useState<"select" | "amount" | "confirm">("select");
  const [searchQuery, setSearchQuery] = useState("");
  const [contacts, setContacts] = useState<UserProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [recentRecipients, setRecentRecipients] = useState<RecentRecipient[]>([]);
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [balance, setBalance] = useState(0);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanError, setScanError] = useState("");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currencies, currency, setCurrency, format: formatCurrency } = useCurrency();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/signin"); return; }

      const { data: wallet } = await supabase
        .from("wallets").select("balance").eq("user_id", user.id).single();
      setBalance(wallet?.balance || 0);

      const { data: contactRows } = await supabase
        .from("contacts").select("contact_id").eq("user_id", user.id);
      const contactIds = contactRows?.map(c => c.contact_id) || [];
      setContactIds(contactIds);

      const { data: profiles } = await supabase
        .from("profiles").select("id, full_name, username, avatar_url").neq("id", user.id);

      if (profiles) {
        setAllUsers(profiles);
        setContacts(profiles.filter(p => contactIds.includes(p.id)));
      }

      const { data: txs } = await supabase
        .from("transactions")
        .select("sender_id, receiver_id, created_at")
        .eq("sender_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (txs && profiles) {
        const seen = new Set<string>();
        const recent: RecentRecipient[] = [];
        for (const tx of txs) {
          const recipientId = tx.receiver_id;
          if (!recipientId || seen.has(recipientId) || recipientId === user.id) continue;
          const profile = profiles.find((p) => p.id === recipientId);
          if (!profile) continue;
          seen.add(recipientId);
          recent.push({
            ...profile,
            last_sent_at: tx.created_at,
          });
          if (recent.length >= 8) break;
        }
        setRecentRecipients(recent);
      }

      const toId = searchParams.get("to");
      const qrAmount = searchParams.get("amount");
      const qrCurrency = (searchParams.get("currency") || "").toUpperCase();
      if (toId && profiles) {
        const found = profiles.find(p => p.id === toId);
        if (found) {
          setSelectedUser(found);
          if (qrAmount && Number.isFinite(Number(qrAmount)) && Number(qrAmount) > 0) {
            setAmount(Number(qrAmount).toFixed(2));
          }
          if (qrCurrency) {
            const foundCurrency = currencies.find((c) => c.code === qrCurrency);
            if (foundCurrency) setCurrency(foundCurrency);
          }
          setStep("amount");
        }
      }
    };
    load();
  }, [currencies, navigate, searchParams, setCurrency]);

  useEffect(() => {
    if (!showScanner) return;

    let scanner: Html5Qrcode | null = null;
    let isDone = false;
    setScanError("");

    const stopScanner = async () => {
      if (!scanner) return;
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
      } catch {
        // no-op
      }
      try {
        scanner.clear();
      } catch {
        // no-op
      }
    };

    const startScanner = async () => {
      if (typeof window !== "undefined" && !window.isSecureContext) {
        setScanError("Camera needs HTTPS (or localhost) to work.");
        return;
      }
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setScanError("Camera API is not available on this device/browser.");
        return;
      }

      scanner = new Html5Qrcode("openpay-send-scanner");
      const onDecoded = async (decodedText: string) => {
        if (isDone) return;
        isDone = true;

        const payload = extractQrPayload(decodedText);
        await stopScanner();
        setShowScanner(false);

        if (!payload.uid) {
          toast.error("Invalid QR code");
          return;
        }

        const foundUser = allUsers.find((u) => u.id === payload.uid) || contacts.find((u) => u.id === payload.uid);
        if (!foundUser) {
          toast.error("User not found");
          return;
        }

        if (payload.amount && Number.isFinite(Number(payload.amount)) && Number(payload.amount) > 0) {
          setAmount(Number(payload.amount).toFixed(2));
        }
        if (payload.currency) {
          const foundCurrency = currencies.find((c) => c.code === payload.currency);
          if (foundCurrency) setCurrency(foundCurrency);
        }

        setSelectedUser(foundUser);
        setStep("amount");
      };

      const scanConfig = { fps: 10, qrbox: { width: 220, height: 220 } };
      try {
        const cameras = await Html5Qrcode.getCameras();
        const preferredBack = cameras.find((cam) =>
          /(back|rear|environment)/i.test(cam.label || ""),
        );

        const sources: Array<string | MediaTrackConstraints> = [];
        if (preferredBack?.id) sources.push(preferredBack.id);
        if (cameras[0]?.id) sources.push(cameras[0].id);
        sources.push({ facingMode: { exact: "environment" } });
        sources.push({ facingMode: "environment" });
        sources.push({ facingMode: "user" });

        let started = false;
        let startError = "";

        for (const source of sources) {
          try {
            await scanner.start(source, scanConfig, onDecoded, () => undefined);
            started = true;
            break;
          } catch (error) {
            startError = error instanceof Error ? error.message : "Unable to start camera";
          }
        }

        if (!started) {
          setScanError(startError || "Unable to start camera");
        }
      } catch (error) {
        setScanError(error instanceof Error ? error.message : "Unable to start camera");
      }
    };

    startScanner();

    return () => {
      isDone = true;
      stopScanner();
    };
  }, [allUsers, contacts, currencies, setCurrency, showScanner]);

  const filtered = searchQuery
    ? allUsers.filter(u =>
        u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase())))
    : contacts;

  const toggleBookmark = async (profile: UserProfile) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id;
    if (!userId) return;

    const isSaved = contactIds.includes(profile.id);
    if (isSaved) {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("user_id", userId)
        .eq("contact_id", profile.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      setContactIds((prev) => prev.filter((id) => id !== profile.id));
      setContacts((prev) => prev.filter((p) => p.id !== profile.id));
      toast.success("Removed from bookmarks");
      return;
    }

    const { error } = await supabase
      .from("contacts")
      .insert({ user_id: userId, contact_id: profile.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    setContactIds((prev) => [...prev, profile.id]);
    setContacts((prev) => [profile, ...prev.filter((p) => p.id !== profile.id)]);
    toast.success("Saved to bookmarks");
  };

  const handleSelectUser = (user: UserProfile) => { setSelectedUser(user); setShowConfirm(true); };
  const handleConfirmUser = () => { setShowConfirm(false); setStep("amount"); };

  const handleSend = async () => {
    const parsedAmount = parseFloat(amount);
    if (!selectedUser || !amount || parsedAmount <= 0) { toast.error("Enter a valid amount"); return; }
    const usdAmount = parsedAmount / currency.rate;
    if (usdAmount > balance) { toast.error("Amount exceeds your available balance"); return; }
    setLoading(true);

    const { data, error } = await supabase.functions.invoke("send-money", {
      body: { receiver_email: "__by_id__", receiver_id: selectedUser.id, amount: usdAmount, note },
    });

    setLoading(false);
    if (error) {
      toast.error(await getFunctionErrorMessage(error, "Transfer failed"));
    } else {
      const txId = (data as { transaction_id?: string } | null)?.transaction_id || "";
      setReceiptData({
        transactionId: txId,
        type: "send",
        amount: usdAmount,
        otherPartyName: selectedUser.full_name,
        otherPartyUsername: selectedUser.username || undefined,
        note: note || undefined,
        date: new Date(),
      });
      setReceiptOpen(true);
      toast.success(`${currency.symbol}${parseFloat(amount).toFixed(2)} sent to ${selectedUser.full_name}!`);
    }
  };

  const handleOpenSendConfirm = () => {
    const parsedAmount = parseFloat(amount);
    if (!selectedUser || !amount || parsedAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const usdAmount = parsedAmount / currency.rate;
    if (usdAmount > balance) {
      toast.error("Amount exceeds your available balance");
      return;
    }
    setShowSendConfirm(true);
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["bg-paypal-dark", "bg-paypal-light-blue", "bg-primary", "bg-muted-foreground"];
  const renderAvatar = (user: UserProfile, colorIndex: number) => (
    user.avatar_url ? (
      <img src={user.avatar_url} alt={user.full_name} className="h-12 w-12 rounded-full object-cover border border-border" />
    ) : (
      <div className={`w-12 h-12 rounded-full ${colors[colorIndex % colors.length]} flex items-center justify-center`}>
        <span className="text-sm font-bold text-primary-foreground">{getInitials(user.full_name)}</span>
      </div>
    )
  );

  if (step === "amount") {
    return (
      <div className="min-h-screen bg-background px-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep("select")}><ArrowLeft className="w-6 h-6 text-foreground" /></button>
            <h1 className="text-lg font-semibold text-paypal-dark">Express Send</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowScanner(true)}
              className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full"
              aria-label="Scan QR code"
            >
              <ScanLine className="h-4 w-4 text-foreground" />
            </button>
            <CurrencySelector />
          </div>
        </div>

        {selectedUser && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl bg-secondary/80 px-3 py-2.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-paypal-dark">
              <span className="text-sm font-bold text-primary-foreground">{getInitials(selectedUser.full_name)}</span>
            </div>
            <div>
              <p className="font-semibold text-foreground">{selectedUser.full_name}</p>
              {selectedUser.username && <p className="text-sm text-muted-foreground">@{selectedUser.username}</p>}
            </div>
          </div>
        )}

        <div className="paypal-surface mt-8 rounded-3xl p-6">
          <div className="mb-8 text-center">
            <p className="text-5xl font-bold text-foreground">{currency.symbol}{amount || "0.00"}</p>
            <p className="text-sm text-muted-foreground mt-1">{currency.flag} {currency.code}</p>
            <p className="mt-2 text-sm font-medium text-paypal-blue">Available: {formatCurrency(balance)}</p>
          </div>
          <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="mb-4 h-14 rounded-2xl border-white/70 bg-white text-center text-2xl" min="0.01" step="0.01" />
          <Input placeholder="Add a note (optional)" value={note} onChange={(e) => setNote(e.target.value)}
            className="mb-6 h-12 rounded-2xl border-white/70 bg-white" />
          <Button onClick={handleOpenSendConfirm} disabled={loading || !amount || parseFloat(amount) <= 0}
            className="h-14 w-full rounded-full bg-paypal-blue text-lg font-semibold text-white hover:bg-[#004dc5]">
            {loading ? "Sending..." : `Send ${currency.symbol}${amount || "0.00"}`}
          </Button>
        </div>

        <TransactionReceipt open={receiptOpen} onOpenChange={(open) => {
          setReceiptOpen(open);
          if (!open) navigate("/dashboard");
        }} receipt={receiptData} />

        <Dialog open={showSendConfirm} onOpenChange={setShowSendConfirm}>
          <DialogContent className="rounded-3xl">
            <h3 className="text-xl font-bold text-foreground">Confirm payment</h3>
            {selectedUser && (
              <div className="mt-3 flex items-center gap-3 rounded-2xl bg-secondary/70 px-3 py-2.5">
                {selectedUser.avatar_url ? (
                  <img src={selectedUser.avatar_url} alt={selectedUser.full_name} className="h-12 w-12 rounded-full border border-border object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-paypal-dark">
                    <span className="text-sm font-bold text-primary-foreground">{getInitials(selectedUser.full_name)}</span>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-foreground">{selectedUser.full_name}</p>
                  {selectedUser.username && <p className="text-sm text-muted-foreground">@{selectedUser.username}</p>}
                </div>
              </div>
            )}

            <div className="mt-4 space-y-2 rounded-2xl border border-border p-3 text-sm">
              <p className="flex items-center justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold text-foreground">{currency.symbol}{Number(amount || 0).toFixed(2)} ({currency.code})</span>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-muted-foreground">Converted (USD)</span>
                <span className="font-semibold text-foreground">${(Number(amount || 0) / (currency.rate || 1)).toFixed(2)}</span>
              </p>
              {note.trim() && (
                <p className="flex items-start justify-between gap-2">
                  <span className="text-muted-foreground">Note</span>
                  <span className="max-w-[70%] text-right text-foreground">{note.trim()}</span>
                </p>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="h-11 flex-1 rounded-2xl" onClick={() => setShowSendConfirm(false)}>
                Cancel
              </Button>
              <Button
                className="h-11 flex-1 rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
                disabled={loading}
                onClick={async () => {
                  setShowSendConfirm(false);
                  await handleSend();
                }}
              >
                {loading ? "Sending..." : "Confirm & Send"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 pt-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/dashboard")}><ArrowLeft className="w-6 h-6 text-foreground" /></button>
        <div className="flex-1">
          <Input placeholder="Name, username or email" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="h-12 rounded-full border border-white/70 bg-white pl-4" autoFocus />
        </div>
        <button
          onClick={() => setShowScanner(true)}
          className="paypal-surface flex h-12 items-center gap-2 rounded-full px-3"
          aria-label="Scan QR code"
        >
          <ScanLine className="h-5 w-5 text-foreground" />
          <span className="text-sm font-medium text-foreground">Scan QR</span>
        </button>
      </div>

      <div className="mt-6">
        {!searchQuery && recentRecipients.length > 0 && (
          <>
            <h2 className="mb-3 font-bold text-foreground">Recent</h2>
            <div className="paypal-surface overflow-hidden rounded-2xl mb-5">
              {recentRecipients.map((user, i) => (
                <div
                  key={`${user.id}-${user.last_sent_at}`}
                  onClick={() => handleSelectUser(user)}
                  className="flex w-full items-center gap-3 border-b border-border/70 px-3 py-3 text-left last:border-b-0 hover:bg-secondary/50 transition cursor-pointer"
                >
                  {renderAvatar(user, i)}
                  <div className="text-left flex-1">
                    <p className="font-semibold text-foreground">{user.full_name}</p>
                    {user.username && <p className="text-sm text-muted-foreground">@{user.username}</p>}
                    <p className="text-xs text-muted-foreground">Recent transaction</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggleBookmark(user);
                    }}
                    className="rounded-full p-2 hover:bg-secondary"
                    aria-label={contactIds.includes(user.id) ? "Remove bookmark" : "Save bookmark"}
                  >
                    {contactIds.includes(user.id) ? <BookmarkCheck className="h-5 w-5 text-paypal-blue" /> : <Bookmark className="h-5 w-5 text-muted-foreground" />}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <h2 className="mb-4 font-bold text-foreground">{searchQuery ? "Search results" : "Your contacts"}</h2>
        <div className="paypal-surface overflow-hidden rounded-2xl">
          {filtered.map((user, i) => (
            <div
              key={user.id}
              onClick={() => handleSelectUser(user)}
              className="flex w-full items-center gap-3 border-b border-border/70 px-3 py-3 text-left last:border-b-0 hover:bg-secondary/50 transition cursor-pointer"
            >
              {renderAvatar(user, i)}
              <div className="text-left flex-1">
                <p className="font-semibold text-foreground">{user.full_name}</p>
                {user.username && <p className="text-sm text-muted-foreground">@{user.username}</p>}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void toggleBookmark(user);
                }}
                className="rounded-full p-2 hover:bg-secondary"
                aria-label={contactIds.includes(user.id) ? "Remove bookmark" : "Save bookmark"}
              >
                {contactIds.includes(user.id) ? <BookmarkCheck className="h-5 w-5 text-paypal-blue" /> : <Bookmark className="h-5 w-5 text-muted-foreground" />}
              </button>
              <Info className="w-5 h-5 text-muted-foreground" />
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No users found</p>}
        </div>
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="rounded-3xl">
          {selectedUser && (
            <div>
              {selectedUser.avatar_url ? (
                <img
                  src={selectedUser.avatar_url}
                  alt={selectedUser.full_name}
                  className="mb-3 h-16 w-16 rounded-full border border-border object-cover"
                />
              ) : (
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-paypal-dark">
                  <span className="text-lg font-bold text-primary-foreground">{getInitials(selectedUser.full_name)}</span>
                </div>
              )}
              <h3 className="text-xl font-bold">{selectedUser.full_name}</h3>
              {selectedUser.username && <p className="text-muted-foreground">@{selectedUser.username}</p>}
              <p className="text-2xl font-bold mt-4 mb-2">Is this the right person?</p>
              <Button onClick={handleConfirmUser} className="mt-4 h-14 w-full rounded-full bg-paypal-blue text-lg font-semibold text-white hover:bg-[#004dc5]">Continue</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showScanner} onOpenChange={setShowScanner}>
        <DialogContent className="max-w-md rounded-3xl">
          <div className="mb-2 flex items-center gap-2">
            <QrCode className="h-5 w-5 text-foreground" />
            <h3 className="text-lg font-semibold text-foreground">Scan QR Code</h3>
          </div>
          <div id="openpay-send-scanner" className="min-h-[260px] overflow-hidden rounded-2xl border border-border" />
          {scanError && <p className="text-sm text-red-500">{scanError}</p>}
          <p className="text-xs text-muted-foreground">Scan an OpenPay receive QR to fill recipient details.</p>
          <p className="text-xs text-muted-foreground">If camera does not open in Pi Browser, enable camera permission for this app and retry.</p>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default SendMoney;
