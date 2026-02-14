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

    const body = await req.json();
    const { receiver_id, receiver_email, amount, note } = body;
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) throw new Error("Invalid amount");

    let receiverId = receiver_id;

    // If receiver_email provided (and not the bypass marker), find by email
    if (receiver_email && receiver_email !== "__by_id__") {
      const { data: receiverAuth } = await supabase.auth.admin.listUsers();
      const receiver = receiverAuth?.users?.find(u => u.email === receiver_email);
      if (!receiver) throw new Error("Recipient not found");
      receiverId = receiver.id;
    }

    if (!receiverId) throw new Error("No recipient specified");
    if (receiverId === user.id) throw new Error("Cannot send to yourself");

    // Check sender balance
    const { data: senderWallet, error: senderWalletError } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (senderWalletError) throw senderWalletError;

    if (!senderWallet || senderWallet.balance < parsedAmount) {
      throw new Error("Insufficient balance");
    }

    // Debit sender
    const { error: debitError } = await supabase
      .from("wallets")
      .update({ balance: senderWallet.balance - parsedAmount, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    if (debitError) throw debitError;

    // Credit receiver
    const { data: receiverWallet, error: receiverWalletError } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", receiverId)
      .single();
    if (receiverWalletError) throw receiverWalletError;

    const { error: creditError } = await supabase
      .from("wallets")
      .update({ balance: (receiverWallet?.balance || 0) + parsedAmount, updated_at: new Date().toISOString() })
      .eq("user_id", receiverId);
    if (creditError) throw creditError;

    // Create transaction
    const { error: transactionError } = await supabase
      .from("transactions")
      .insert({
        sender_id: user.id,
        receiver_id: receiverId,
        amount: parsedAmount,
        note: note || "",
        status: "completed",
      });
    if (transactionError) throw transactionError;

    return jsonResponse({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 400);
  }
});
