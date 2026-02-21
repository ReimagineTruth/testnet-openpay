import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, HandCoins, HelpCircle, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getFunctionErrorMessage } from "@/lib/supabaseFunctionError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import BottomNav from "@/components/BottomNav";

type PiPlatformPayload = {
  success?: boolean;
  error?: string;
  data?: unknown;
  payment?: unknown;
  payments?: unknown[];
};

const A2UPaymentsPage = () => {
  const navigate = useNavigate();
  const [uid, setUid] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("OpenPay App-to-User payment");
  const [metadataJson, setMetadataJson] = useState("{\"feature\":\"a2u\",\"source\":\"openpay\"}");
  const [paymentId, setPaymentId] = useState("");
  const [txid, setTxid] = useState("");
  const [loading, setLoading] = useState(false);
  const [responseDump, setResponseDump] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [configStatus, setConfigStatus] = useState<{
    hasApiKey: boolean;
    hasValidationKey: boolean;
    hasWalletPrivateSeed: boolean;
    hasWalletPublicAddress: boolean;
  } | null>(null);

  const callPiPlatform = async (body: Record<string, unknown>, fallbackError: string) => {
    const { data, error } = await supabase.functions.invoke("pi-platform", { body });
    if (error) throw new Error(await getFunctionErrorMessage(error, fallbackError));
    return (data || {}) as PiPlatformPayload;
  };

  const handleCreateA2U = async () => {
    const parsedAmount = Number(amount);
    if (!uid.trim()) {
      toast.error("Enter Pi user UID");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    let metadata: Record<string, unknown> = {};
    if (metadataJson.trim()) {
      try {
        metadata = JSON.parse(metadataJson) as Record<string, unknown>;
      } catch {
        toast.error("Metadata must be valid JSON");
        return;
      }
    }

    setLoading(true);
    try {
      const payload = await callPiPlatform(
        {
          action: "a2u_create",
          payment: {
            amount: parsedAmount,
            uid: uid.trim(),
            memo: memo.trim() || "OpenPay App-to-User payment",
            metadata,
          },
        },
        "Failed to create A2U payment",
      );
      const createdPayment = payload.data as { identifier?: string } | undefined;
      const createdPaymentId = String(createdPayment?.identifier || "");
      if (createdPaymentId) setPaymentId(createdPaymentId);
      setResponseDump(JSON.stringify(payload, null, 2));
      toast.success(createdPaymentId ? `A2U payment created: ${createdPaymentId}` : "A2U payment created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "A2U create failed");
    } finally {
      setLoading(false);
    }
  };

  const runPaymentAction = async (
    action: "a2u_get" | "a2u_approve" | "a2u_complete" | "a2u_cancel",
    fallbackError: string,
  ) => {
    if (!paymentId.trim()) {
      toast.error("Enter payment ID");
      return;
    }

    setLoading(true);
    try {
      const payload = await callPiPlatform(
        {
          action,
          paymentId: paymentId.trim(),
          txid: txid.trim() || undefined,
        },
        fallbackError,
      );
      setResponseDump(JSON.stringify(payload, null, 2));
      toast.success("Action completed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : fallbackError);
    } finally {
      setLoading(false);
    }
  };

  const handleGetIncomplete = async () => {
    setLoading(true);
    try {
      const payload = await callPiPlatform(
        {
          action: "a2u_incomplete",
        },
        "Failed to fetch incomplete server payments",
      );
      setResponseDump(JSON.stringify(payload, null, 2));
      toast.success("Fetched incomplete payments");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch incomplete server payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadConfigStatus = async () => {
      try {
        const payload = await callPiPlatform(
          { action: "a2u_config_status" },
          "Failed to load A2U config status",
        );
        const data = (payload.data || {}) as {
          hasApiKey?: boolean;
          hasValidationKey?: boolean;
          hasWalletPrivateSeed?: boolean;
          hasWalletPublicAddress?: boolean;
        };
        setConfigStatus({
          hasApiKey: Boolean(data.hasApiKey),
          hasValidationKey: Boolean(data.hasValidationKey),
          hasWalletPrivateSeed: Boolean(data.hasWalletPrivateSeed),
          hasWalletPublicAddress: Boolean(data.hasWalletPublicAddress),
        });
      } catch {
        setConfigStatus(null);
      }
    };
    void loadConfigStatus();
  }, []);

  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-4">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => navigate("/menu")} className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full" aria-label="Back">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-paypal-dark">A2U App-to-User Payments</h1>
          <p className="text-xs text-muted-foreground">Pi A2U flow: create, approve, blockchain transfer, complete</p>
        </div>
        <button
          onClick={() => setShowInstructions(true)}
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground"
        >
          <HelpCircle className="h-4 w-4" />
          Instructions
        </button>
      </div>

      <div className="rounded-3xl border border-white/30 bg-gradient-to-br from-paypal-blue to-[#0073e6] p-5 text-white shadow-xl shadow-[#004bba]/20">
        <div className="flex items-center gap-2">
          <HandCoins className="h-4 w-4" />
          <p className="text-sm font-semibold uppercase tracking-wide">A2U Flow</p>
        </div>
        <p className="mt-2 text-sm text-white/90">
          1) Create payment on Pi backend. 2) Approve payment. 3) Submit blockchain transaction from your app wallet.
          4) Complete payment with txid.
        </p>
      </div>

      <div className="paypal-surface mt-4 rounded-3xl p-5">
        <p className="text-sm font-semibold text-foreground">Create A2U payment</p>
        <div className="mt-3 grid gap-3">
          <Input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="Pi user UID (receiver)" className="h-11 rounded-xl" />
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount in Pi" type="number" min="0.000001" step="0.000001" className="h-11 rounded-xl" />
          <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Memo" className="h-11 rounded-xl" />
          <Textarea value={metadataJson} onChange={(e) => setMetadataJson(e.target.value)} placeholder='Metadata JSON, e.g. {"order_id":"123"}' className="min-h-[96px] rounded-xl" />
          <Button onClick={handleCreateA2U} disabled={loading} className="h-11 rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]">
            {loading ? "Processing..." : "Create A2U Payment"}
          </Button>
        </div>
      </div>

      <div className="paypal-surface mt-4 rounded-3xl p-5">
        <p className="text-sm font-semibold text-foreground">Manage payment state</p>
        <div className="mt-3 grid gap-3">
          <Input value={paymentId} onChange={(e) => setPaymentId(e.target.value)} placeholder="Payment ID (identifier)" className="h-11 rounded-xl" />
          <Input value={txid} onChange={(e) => setTxid(e.target.value)} placeholder="Blockchain txid (required for complete)" className="h-11 rounded-xl" />
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-10 rounded-xl" disabled={loading} onClick={() => runPaymentAction("a2u_get", "Failed to fetch payment")}>Get</Button>
            <Button type="button" variant="outline" className="h-10 rounded-xl" disabled={loading} onClick={() => runPaymentAction("a2u_approve", "Failed to approve payment")}>Approve</Button>
            <Button type="button" variant="outline" className="h-10 rounded-xl" disabled={loading} onClick={() => runPaymentAction("a2u_complete", "Failed to complete payment")}>Complete</Button>
            <Button type="button" variant="outline" className="h-10 rounded-xl" disabled={loading} onClick={() => runPaymentAction("a2u_cancel", "Failed to cancel payment")}>Cancel</Button>
          </div>
          <Button type="button" variant="outline" className="h-10 rounded-xl" disabled={loading} onClick={handleGetIncomplete}>
            Get Incomplete Server Payments
          </Button>
        </div>
      </div>

      <div className="paypal-surface mt-4 rounded-3xl p-5">
        <div className="mb-2 flex items-center gap-2">
          <Info className="h-4 w-4 text-paypal-blue" />
          <p className="text-sm font-semibold text-foreground">What I still need from you</p>
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="flex items-start gap-2"><CheckCircle2 className={`mt-0.5 h-4 w-4 ${configStatus?.hasApiKey ? "text-emerald-600" : "text-slate-400"}`} />`PI_API_KEY`: {configStatus?.hasApiKey ? "Configured" : "Missing"}</p>
          <p className="flex items-start gap-2"><CheckCircle2 className={`mt-0.5 h-4 w-4 ${configStatus?.hasValidationKey ? "text-emerald-600" : "text-slate-400"}`} />`PI_VALIDATION_KEY`: {configStatus?.hasValidationKey ? "Configured" : "Missing"}</p>
          <p className="flex items-start gap-2"><CheckCircle2 className={`mt-0.5 h-4 w-4 ${configStatus?.hasWalletPrivateSeed ? "text-emerald-600" : "text-slate-400"}`} />`PI_WALLET_PRIVATE_SEED`: {configStatus?.hasWalletPrivateSeed ? "Configured" : "Missing"}</p>
          <p className="flex items-start gap-2"><CheckCircle2 className={`mt-0.5 h-4 w-4 ${configStatus?.hasWalletPublicAddress ? "text-emerald-600" : "text-slate-400"}`} />`PI_WALLET_PUBLIC_ADDRESS`: {configStatus?.hasWalletPublicAddress ? "Configured" : "Missing"}</p>
          <p>1. Set `PI_WALLET_PUBLIC_ADDRESS` in env (your app wallet address).</p>
          <p>2. Confirm target network for payouts (`testnet` or `mainnet`).</p>
          <p>3. Confirm if blockchain submit should be automated in backend.</p>
        </div>
      </div>

      <div className="paypal-surface mt-4 rounded-3xl p-5">
        <p className="mb-2 text-sm font-semibold text-foreground">Latest response</p>
        <pre className="max-h-[360px] overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">
          <code>{responseDump || "No response yet."}</code>
        </pre>
      </div>

      <BottomNav active="menu" />

      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <DialogTitle className="text-xl font-bold text-foreground">A2U Instructions</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Follow this sequence to avoid payment errors and duplicates.
          </DialogDescription>

          <div className="rounded-2xl border border-border p-3 text-sm text-foreground">
            <p>1. Create payment using recipient Pi UID, amount, memo, and metadata.</p>
            <p>2. Approve payment from server before submitting blockchain transaction.</p>
            <p>3. Broadcast blockchain payment from your app wallet to recipient wallet.</p>
            <p>4. Complete payment with the blockchain `txid`.</p>
            <p>5. If your app crashes, use "Get Incomplete Server Payments" and recover state.</p>
            <p>6. Never expose API key or wallet private seed to frontend or public repos.</p>
          </div>

          <div className="rounded-2xl border border-paypal-light-blue/40 bg-paypal-light-blue/10 p-3 text-xs text-muted-foreground">
            Required server env: <code>PI_API_KEY</code>, <code>PI_VALIDATION_KEY</code>, <code>PI_WALLET_PRIVATE_SEED</code>, <code>PI_WALLET_PUBLIC_ADDRESS</code>.
            Use Supabase secrets for deployed functions.
          </div>

          <Button
            className="h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
            onClick={() => setShowInstructions(false)}
          >
            I Understand
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default A2UPaymentsPage;
