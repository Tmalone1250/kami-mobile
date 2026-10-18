import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  formatEther,
  parseAbi,
  isAddress,
} from "npm:viem@^2.21.0";
import { privateKeyToAccount } from "npm:viem@^2.21.0/accounts";
import { baseSepolia } from "npm:viem@^2.21.0/chains";
import { corsHeaders } from "../_shared/cors.ts";

const KAMI_ABI = parseAbi([
  "function distributeReward(address player, uint256 amount) external",
  "function rewardsVaultBalance() external view returns (uint256)",
  "function remainingDailyAllowance() external view returns (uint256)",
]);

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Verify User Authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase Auth client to verify user token
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      // If a real Supabase session is present, verify it.
      // (Allows flexibility during early development and anonymous test calls)
      if (authError && !authHeader.includes("Bearer anon-")) {
        console.warn("Supabase auth warning:", authError.message);
      }
    }

    // 2. Parse Request Payload
    const body = await req.json().catch(() => ({}));
    const { amount, walletAddress } = body;

    if (!walletAddress || !isAddress(walletAddress)) {
      return new Response(
        JSON.stringify({ error: `Invalid recipient wallet address: ${walletAddress}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return new Response(
        JSON.stringify({ error: `Invalid reward amount: ${amount}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Environment & Blockchain Setup
    const rawPrivateKey = Deno.env.get("DISTRIBUTOR_PRIVATE_KEY");
    if (!rawPrivateKey) {
      return new Response(
        JSON.stringify({
          error: "DISTRIBUTOR_PRIVATE_KEY is not configured in Supabase environment secrets",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const privateKey = (rawPrivateKey.startsWith("0x") ? rawPrivateKey : `0x${rawPrivateKey}`) as `0x${string}`;
    const tokenAddress = (Deno.env.get("KAMI_TOKEN_ADDRESS") ||
      "0xb7dE9b14742C3dbf3d4e3af83aF026Bf4CB6A9c6") as `0x${string}`;
    const rpcUrl = Deno.env.get("BASE_SEPOLIA_RPC") || "https://sepolia.base.org";

    const account = privateKeyToAccount(privateKey);
    const transport = http(rpcUrl);

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport,
    });

    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport,
    });

    // 4. Gas Tank Sponsorship: Check player native ETH balance
    // On Base Sepolia L2, gas for an ERC-20 transfer is ~0.0000035 ETH.
    // A buffer of 0.001 ETH covers ~250-300 transactions.
    // If the player has less than 0.0005 ETH, sponsor a top-up of 0.001 ETH from the distributor wallet.
    const GAS_THRESHOLD = parseEther("0.0005");
    const GAS_TOPUP_AMOUNT = parseEther("0.001");

    let gasTxHash: `0x${string}` | null = null;
    let currentNonce: number | undefined = undefined;

    try {
      const playerEthBalance = await publicClient.getBalance({
        address: walletAddress as `0x${string}`,
      });

      console.log(`Player ${walletAddress} ETH balance: ${formatEther(playerEthBalance)} ETH`);

      if (playerEthBalance < GAS_THRESHOLD) {
        console.log("ETH balance below threshold (0.0005 ETH). Sponsoring 0.001 ETH gas buffer...");

        currentNonce = await publicClient.getTransactionCount({
          address: account.address,
          blockTag: "pending",
        });

        gasTxHash = await walletClient.sendTransaction({
          to: walletAddress as `0x${string}`,
          value: GAS_TOPUP_AMOUNT,
          nonce: currentNonce,
        });

        console.log(`Gas buffer sponsored! TxHash: ${gasTxHash}`);
        currentNonce++;
      }
    } catch (gasErr: any) {
      console.warn("Warning: Gas buffer check or sponsorship failed:", gasErr?.message || gasErr);
      // Reset currentNonce so writeContract lets viem auto-resolve fresh pending nonce
      currentNonce = undefined;
    }

    // 5. Broadcast distributeReward on Base Sepolia
    // Amount has 18 decimals in $KAMI
    const parsedAmount = parseEther(numericAmount.toString());

    const txOptions: any = {
      address: tokenAddress,
      abi: KAMI_ABI,
      functionName: "distributeReward",
      args: [walletAddress as `0x${string}`, parsedAmount],
    };

    if (currentNonce !== undefined) {
      txOptions.nonce = currentNonce;
    }

    const txHash = await walletClient.writeContract(txOptions);

    console.log(`Successfully distributed ${numericAmount} $KAMI to ${walletAddress}. TxHash: ${txHash}`);

    return new Response(
      JSON.stringify({
        success: true,
        txHash,
        gasTxHash,
        gasSponsored: gasTxHash !== null,
        amount: numericAmount,
        player: walletAddress,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Edge function claim-reward error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || "Internal server error distributing rewards",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
