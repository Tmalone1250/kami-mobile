import { useState, useEffect, useCallback, useRef } from 'react';
import { createPublicClient, http, formatUnits, isAddress } from 'viem';
import { baseSepolia } from 'viem/chains';
import { KAMI_TOKEN_ADDRESS, BASE_SEPOLIA_RPC, KAMI_TOKEN_ABI } from '../constants/contracts';

// Singleton public client instance for Base Sepolia
export const baseSepoliaClient = createPublicClient({
  chain: baseSepolia,
  transport: http(BASE_SEPOLIA_RPC),
});

export interface UseKamiBalanceReturn {
  balance: number;
  rawBalance: bigint;
  formatted: string;
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useKamiBalance = (walletAddress?: string | null): UseKamiBalanceReturn => {
  const [rawBalance, setRawBalance] = useState<bigint>(0n);
  const [balance, setBalance] = useState<number>(0);
  const [formatted, setFormatted] = useState<string>('0.00');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchBalance = useCallback(async () => {
    if (!walletAddress || !isAddress(walletAddress)) {
      if (isMountedRef.current) {
        setRawBalance(0n);
        setBalance(0);
        setFormatted('0.00');
        setIsLoading(false);
        setIsError(false);
        setError(null);
      }
      return;
    }

    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const data = await baseSepoliaClient.readContract({
        address: KAMI_TOKEN_ADDRESS,
        abi: KAMI_TOKEN_ABI,
        functionName: 'balanceOf',
        args: [walletAddress as `0x${string}`],
      });

      if (!isMountedRef.current) return;

      const raw = typeof data === 'bigint' ? data : 0n;
      const formattedStr = formatUnits(raw, 18);
      const parsedNum = parseFloat(formattedStr) || 0;

      setRawBalance(raw);
      setBalance(parsedNum);
      setFormatted(Number(formattedStr).toFixed(2));
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.warn('Failed to fetch on-chain $KAMI balance:', err);
      setIsError(true);
      setError(err?.message || 'Failed to read $KAMI balance');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return {
    balance,
    rawBalance,
    formatted,
    isLoading,
    isError,
    error,
    refetch: fetchBalance,
  };
};
