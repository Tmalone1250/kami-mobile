#!/usr/bin/env bash
# Credit $KAMI rewards directly to a Smart Wallet address on Base Sepolia
set -euo pipefail

TARGET_ADDRESS="${1:-}"
AMOUNT="${2:-0.65}"

if [ -z "$TARGET_ADDRESS" ]; then
  echo "Usage: ./scripts/credit-smart-wallet.sh <TARGET_EVM_ADDRESS> [AMOUNT]"
  echo "Example: ./scripts/credit-smart-wallet.sh 0x1234567890123456789012345678901234567890 0.65"
  exit 1
fi

echo "Distributing $AMOUNT \$KAMI to $TARGET_ADDRESS on Base Sepolia..."

SUPABASE_URL="https://ahojxsvxmbsemhpvxeav.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFob2p4c3Z4bWJzZW1ocHZ4ZWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNDE2MjEsImV4cCI6MjEwNjgxNzYyMX0.Dbq_qlWEQqzVccO1nyTHuvF9SF1tZRLI_KZVBp99iYU"

RESPONSE=$(curl -s -X POST "$SUPABASE_URL/functions/v1/claim-reward" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_KEY" \
  -d "{\"walletAddress\":\"$TARGET_ADDRESS\",\"amount\":$AMOUNT}")

echo "Response: $RESPONSE"
