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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { receiver_id, receiver_email, amount, note } = body;
    if (!amount || amount <= 0) throw new Error("Invalid amount");

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
    const { data: senderWallet } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!senderWallet || senderWallet.balance < amount) {
      throw new Error("Insufficient balance");
    }

    // Debit sender
    await supabase
      .from("wallets")
      .update({ balance: senderWallet.balance - amount, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    // Credit receiver
    const { data: receiverWallet } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", receiverId)
      .single();

    await supabase
      .from("wallets")
      .update({ balance: (receiverWallet?.balance || 0) + amount, updated_at: new Date().toISOString() })
      .eq("user_id", receiverId);

    // Create transaction
    await supabase
      .from("transactions")
      .insert({
        sender_id: user.id,
        receiver_id: receiverId,
        amount,
        note: note || "",
        status: "completed",
      });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
