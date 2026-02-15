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

    const { amount, paymentId, txid } = await req.json();
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) throw new Error("Invalid amount");
    if (!paymentId || typeof paymentId !== "string") throw new Error("Missing paymentId");

    const piApiKey = Deno.env.get("PI_API_KEY");
    if (!piApiKey) throw new Error("PI_API_KEY is not configured");

    const piPaymentResponse = await fetch(`https://api.minepi.com/v2/payments/${paymentId}`, {
      method: "GET",
      headers: {
        Authorization: `Key ${piApiKey}`,
      },
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

    const rawPiPayment = await piPaymentResponse.text();
    let piPayment: PiPayment = {};
    try {
      piPayment = rawPiPayment ? JSON.parse(rawPiPayment) : {};
    } catch {
      throw new Error("Unable to parse Pi payment verification response");
    }
    if (!piPaymentResponse.ok) throw new Error("Unable to verify Pi payment");

    const piAmount = Number(piPayment?.amount);
    const piDirection = String(piPayment?.direction || "");
    const status = piPayment.status || {};
    const piTxid = piPayment.transaction?.txid ? String(piPayment.transaction.txid) : null;

    if (piDirection !== "user_to_app") throw new Error("Invalid payment direction");
    if (status.cancelled || status.user_cancelled) throw new Error("Payment is cancelled");
    if (!status.developer_completed || !status.transaction_verified) {
      throw new Error("Payment is not completed/verified");
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
        throw new Error("This Pi payment was already credited");
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
