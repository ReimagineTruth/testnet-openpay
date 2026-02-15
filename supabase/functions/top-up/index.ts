import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const jsonResponse = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  type PiPaymentStatus = {
    developer_completed?: boolean;
    transaction_verified?: boolean;
    cancelled?: boolean;
    user_cancelled?: boolean;
  };
  type PiPayment = {
    amount?: number | string;
    direction?: string;
    user_uid?: string;
    status?: PiPaymentStatus;
    transaction?: { txid?: string };
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Server configuration error");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing auth token");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    const body = await req.json().catch(() => ({}));
    const action = String((body as { action?: string }).action || "credit");
    const amount = (body as { amount?: number }).amount;
    const paymentId = (body as { paymentId?: string }).paymentId;
    const txid = (body as { txid?: string }).txid;
    const parsedAmount = Number(amount);
    if (!paymentId || typeof paymentId !== "string") throw new Error("Missing paymentId");

    const piApiKey = Deno.env.get("PI_API_KEY");
    if (!piApiKey) throw new Error("PI_API_KEY is not configured");

    const callPi = async (
      endpoint: string,
      method: "GET" | "POST",
      payload?: Record<string, unknown>,
    ): Promise<Record<string, unknown>> => {
      const response = await fetch(`https://api.minepi.com/v2${endpoint}`, {
        method,
        headers: {
          Authorization: `Key ${piApiKey}`,
          "Content-Type": "application/json",
        },
        body: payload ? JSON.stringify(payload) : undefined,
      });

      const raw = await response.text();
      let data: Record<string, unknown> = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { raw };
      }

      if (!response.ok) {
        throw new Error((data.error as string) || `Pi API failed with status ${response.status}`);
      }

      return data;
    };

    if (action === "approve") {
      await callPi(`/payments/${paymentId}/approve`, "POST");
      return jsonResponse({ success: true, action, paymentId });
    }

    if (action === "complete") {
      await callPi(`/payments/${paymentId}/complete`, "POST", txid ? { txid } : undefined);
      return jsonResponse({ success: true, action, paymentId, txid: txid || null });
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) throw new Error("Invalid amount");

    // credit action: ensure payment is definitely complete/verified before crediting balance.
    if (txid) {
      try {
        await callPi(`/payments/${paymentId}/complete`, "POST", { txid });
      } catch {
        // Ignore: endpoint is idempotent from product standpoint and may fail if already completed.
      }
    }

    let piPayment: PiPayment | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      piPayment = await callPi(`/payments/${paymentId}`, "GET") as PiPayment;
      const st = piPayment.status || {};
      if (st.developer_completed && st.transaction_verified) break;
      if (attempt < 2) await sleep(350);
    }

    if (!piPayment) throw new Error("Unable to verify Pi payment");

    const piAmount = Number(piPayment?.amount);
    const piDirection = String(piPayment?.direction || "");
    const status = piPayment.status || {};
    const piTxid = piPayment.transaction?.txid ? String(piPayment.transaction.txid) : null;

    if (piDirection !== "user_to_app") throw new Error("Invalid payment direction");
    if (status.cancelled || status.user_cancelled) throw new Error("Payment is cancelled");
    if (!status.developer_completed || !status.transaction_verified) {
      throw new Error("Payment is not completed/verified yet. Please retry.");
    }
    if (!Number.isFinite(piAmount) || Math.abs(piAmount - parsedAmount) > 0.000001) {
      throw new Error("Payment amount mismatch");
    }
    if (txid && piTxid && txid !== piTxid) throw new Error("Payment txid mismatch");

    // If Pi UID was previously linked, ensure payment belongs to same Pi identity.
    const { data: authUserData } = await supabase.auth.admin.getUserById(user.id);
    const linkedPiUid = authUserData?.user?.user_metadata?.pi_uid as string | undefined;
    const paymentPiUid = piPayment?.user_uid ? String(piPayment.user_uid) : "";
    if (linkedPiUid && paymentPiUid && linkedPiUid !== paymentPiUid) {
      throw new Error("Payment user does not match linked Pi account");
    }

    const { error: creditLogError } = await supabase
      .from("pi_payment_credits")
      .insert({
        payment_id: paymentId,
        user_id: user.id,
        amount: parsedAmount,
        txid: piTxid || txid || null,
        status: "completed",
      });
    if (creditLogError) {
      if (creditLogError.code === "23505" || creditLogError.message?.toLowerCase().includes("duplicate")) {
        return jsonResponse({ success: true, paymentId, alreadyCredited: true });
      }
      throw creditLogError;
    }

    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (walletError) throw walletError;

    const { error } = await supabase
      .from("wallets")
      .update({ balance: (wallet?.balance || 0) + parsedAmount, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    if (error) throw error;

    // Record top-up as a self transaction so activity, notifications,
    // realtime hooks, and admin ledger all include it consistently.
    const { error: transactionError } = await supabase
      .from("transactions")
      .insert({
        sender_id: user.id,
        receiver_id: user.id,
        amount: parsedAmount,
        note: "Wallet top up",
        status: "completed",
      });

    if (transactionError) {
      // Best-effort rollback of wallet update if transaction log fails.
      await supabase
        .from("wallets")
        .update({ balance: wallet.balance, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      await supabase.from("pi_payment_credits").delete().eq("payment_id", paymentId);
      throw transactionError;
    }

    return jsonResponse({ success: true, paymentId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 400);
  }
});
