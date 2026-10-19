import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { isAddress } from "npm:viem@^2.21.0";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { userId, destinationAddress, amount, txHash } = body;

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required user identification" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!destinationAddress || !isAddress(destinationAddress)) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid destination wallet address: ${destinationAddress}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid transfer amount: ${amount}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Proof of Work Check: Verify Curator Score >= 500
    const { data: curatorRow, error: curatorError } = await supabase
      .from("curator_leaderboard")
      .select("curator_score")
      .eq("id", userId)
      .maybeSingle();

    const score = Number(curatorRow?.curator_score || 0);
    if (score < 500) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "PROOF_OF_WORK_REQUIRED",
          message: "Reach 500 Curator Points to unlock external transfers.",
          curatorScore: score,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. 1-to-1 Mapping Check (Case-insensitive)
    const normalizedDest = destinationAddress.toLowerCase();
    const { data: existingWithdrawals, error: lookupError } = await supabase
      .from("external_withdrawals")
      .select("user_id")
      .ilike("destination_address", normalizedDest)
      .limit(1);

    if (existingWithdrawals && existingWithdrawals.length > 0) {
      const linkedUser = existingWithdrawals[0].user_id;
      if (linkedUser !== userId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "WALLET_ALREADY_LINKED",
            message: "Error: This external wallet is already linked to another Kami Curator. To prevent farming, you can only withdraw to your own dedicated wallet.",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Record Withdrawal & Deduct Local Balance
    const { data: withdrawalRecord, error: insertError } = await supabase
      .from("external_withdrawals")
      .insert({
        user_id: userId,
        destination_address: normalizedDest,
        amount: numericAmount,
        tx_hash: txHash || null,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to insert withdrawal record:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Atomically decrement user kami_balance if greater than zero
    const { data: userRow } = await supabase
      .from("users")
      .select("kami_balance")
      .eq("id", userId)
      .maybeSingle();

    if (userRow) {
      const newBalance = Math.max(0, Number((Number(userRow.kami_balance || 0) - numericAmount).toFixed(2)));
      await supabase
        .from("users")
        .update({ kami_balance: newBalance, updated_at: new Date().toISOString() })
        .eq("id", userId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        withdrawalId: withdrawalRecord?.id,
        destinationAddress: normalizedDest,
        amount: numericAmount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Edge function transfer-kami error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
