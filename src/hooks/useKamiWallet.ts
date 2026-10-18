import { useEffect, useRef, useState } from 'react';
import { usePrivy, useEmbeddedEthereumWallet } from '@privy-io/expo';

/**
 * Resolves the user's wallet address from Privy and guarantees an embedded
 * Ethereum wallet exists.
 *
 * Why this exists:
 * - The Expo SDK's `User` object has NO `wallet` property (that is a web
 *   react-auth convenience). Wallets live in `user.linked_accounts`.
 * - `createOnLogin` is configured in App.tsx, but as a safety net we create the
 *   wallet manually if an authenticated user still has none (e.g. accounts
 *   created before the config was fixed).
 */
export const useKamiWallet = () => {
  const { user, isReady } = usePrivy();
  const { create } = useEmbeddedEthereumWallet();
  const attemptedRef = useRef(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accounts: any[] = user?.linked_accounts ?? [];

  const embeddedAddress: string | undefined = accounts.find(
    (a) =>
      a.type === 'wallet' &&
      a.chain_type === 'ethereum' &&
      (a.connector_type === 'embedded' || a.wallet_client_type === 'privy')
  )?.address;

  const smartWalletAddress: string | undefined = accounts.find(
    (a) => a.type === 'smart_wallet'
  )?.address;

  useEffect(() => {
    if (!isReady || !user || embeddedAddress || attemptedRef.current) return;
    attemptedRef.current = true;
    setIsCreating(true);
    setError(null);
    create()
      .catch((e: any) => {
        console.error('Embedded wallet creation failed:', e);
        setError(e?.message ?? String(e));
      })
      .finally(() => setIsCreating(false));
  }, [isReady, user, embeddedAddress, create]);

  // Reset the guard on logout so the next user gets a fresh attempt.
  useEffect(() => {
    if (!user) attemptedRef.current = false;
  }, [user]);

  return {
    /** Smart wallet if Privy has provisioned one, otherwise the embedded EOA. */
    address: smartWalletAddress ?? embeddedAddress,
    embeddedAddress,
    smartWalletAddress,
    isCreating: isCreating || (isReady && !!user && !embeddedAddress && !error),
    error,
  };
};
