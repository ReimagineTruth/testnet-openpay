import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Missing auth token" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { action, paymentId, txid, accessToken } = await req.json();
    if (!action || !paymentId || !accessToken) {
      return jsonResponse({ error: "Missing required fields" }, 400);
    }

    const apiKey = Deno.env.get("PI_API_KEY");
    if (!apiKey) return jsonResponse({ error: "PI_API_KEY is not configured" }, 500);

    const endpointBase = `https://api.minepi.com/v2/payments/${paymentId}`;
    let endpoint = endpointBase;
    let method = "POST";
    let body: Record<string, unknown> | undefined;

    if (action === "approve") endpoint = `${endpointBase}/approve`;
    else if (action === "complete") {
      endpoint = `${endpointBase}/complete`;
      body = txid ? { txid } : undefined;
    } else if (action === "cancel") endpoint = `${endpointBase}/cancel`;
    else return jsonResponse({ error: "Invalid action" }, 400);

    const piResponse = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
        "Pi-User-Token": accessToken,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const raw = await piResponse.text();
    let data: unknown = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { raw };
    }

    if (!piResponse.ok) {
      return jsonResponse({ error: "Pi API call failed", status: piResponse.status, data }, 400);
    }

    return jsonResponse({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 500);
  }
});
