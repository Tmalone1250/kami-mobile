import { useState, useCallback } from 'react';
import { usePrivy } from '@privy-io/expo';
import { supabase } from '../lib/supabase';
import { useKamiWallet } from './useKamiWallet';

export interface SwipeConsensusResult {
  consensusPercentage: number;
  agreedWithMajority: boolean;
  majorityDirection?: 'left' | 'right' | 'tie';
  totalSwipes?: number;
}

export const useTruthEngine = () => {
  const { user } = usePrivy();
  const { address } = useKamiWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SwipeConsensusResult | null>(null);

  const getFallbackConsensus = useCallback((promptId: string, direction: 'left' | 'right'): SwipeConsensusResult => {
    let hash = 0;
    for (let i = 0; i < promptId.length; i++) {
      hash = (hash << 5) - hash + promptId.charCodeAt(i);
      hash |= 0;
    }
    const absHash = Math.abs(hash);
    const pct = 62 + (absHash % 26); // 62% - 87%
    const majorityDirection = absHash % 2 === 0 ? 'right' : 'left';
    const agreed = direction === majorityDirection;
    return {
      consensusPercentage: pct,
      agreedWithMajority: agreed,
      majorityDirection,
      totalSwipes: 120 + (absHash % 450),
    };
  }, []);

  const recordSwipe = useCallback(
    async (promptId: string, direction: 'left' | 'right'): Promise<SwipeConsensusResult> => {
      setIsLoading(true);
      setError(null);

      const userId = user?.id || address || 'anon_user';

      try {
        const { data, error: rpcError } = await supabase.rpc('record_swipe_and_get_consensus', {
          p_user_id: userId,
          p_prompt_id: promptId,
          p_swipe_direction: direction,
        });

        if (rpcError || !data) {
          // Fallback to simulated consensus if Supabase tables/RPC are not ready yet
          const fallback = getFallbackConsensus(promptId, direction);
          setLastResult(fallback);
          return fallback;
        }

        const result: SwipeConsensusResult = {
          consensusPercentage: Number(data.consensus_percentage ?? 50),
          agreedWithMajority: Boolean(data.agreed_with_majority),
          majorityDirection: data.majority_direction,
          totalSwipes: Number(data.total_swipes ?? 1),
        };

        setLastResult(result);
        return result;
      } catch (err: any) {
        console.warn('Supabase truth engine RPC error, using fallback:', err?.message || err);
        setError(err?.message || 'Failed to record swipe');
        const fallback = getFallbackConsensus(promptId, direction);
        setLastResult(fallback);
        return fallback;
      } finally {
        setIsLoading(false);
      }
    },
    [user?.id, address, getFallbackConsensus]
  );

  return {
    recordSwipe,
    isLoading,
    lastResult,
    error,
  };
};
