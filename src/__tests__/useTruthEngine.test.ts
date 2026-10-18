import { renderHook, act } from '@testing-library/react-native';
import { useTruthEngine } from '../hooks/useTruthEngine';
import { supabase } from '../lib/supabase';

jest.mock('@privy-io/expo', () => ({
  usePrivy: () => ({
    user: { id: 'did:privy:user123', linked_accounts: [] },
    isReady: true,
  }),
  useEmbeddedEthereumWallet: () => ({
    wallets: [],
    create: jest.fn(),
  }),
}));

jest.mock('../hooks/useKamiWallet', () => ({
  useKamiWallet: () => ({
    address: '0x1234567890abcdef1234567890abcdef12345678',
    embeddedAddress: '0x1234567890abcdef1234567890abcdef12345678',
    smartWalletAddress: undefined,
    isCreating: false,
    error: null,
  }),
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

describe('useTruthEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls record_swipe_and_get_consensus RPC with correct parameters', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: {
        consensus_percentage: 82,
        agreed_with_majority: true,
        majority_direction: 'right',
        total_swipes: 45,
      },
      error: null,
    });

    const { result } = renderHook(() => useTruthEngine());

    let swipeResult;
    await act(async () => {
      swipeResult = await result.current.recordSwipe('gc_01', 'right');
    });

    expect(supabase.rpc).toHaveBeenCalledWith('record_swipe_and_get_consensus', {
      p_user_id: 'did:privy:user123',
      p_prompt_id: 'gc_01',
      p_swipe_direction: 'right',
    });

    expect(swipeResult).toEqual({
      consensusPercentage: 82,
      agreedWithMajority: true,
      majorityDirection: 'right',
      totalSwipes: 45,
    });
  });

  it('falls back to deterministic simulation when RPC fails', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: { message: 'Database connection offline' },
    });

    const { result } = renderHook(() => useTruthEngine());

    let swipeResult: any;
    await act(async () => {
      swipeResult = await result.current.recordSwipe('gc_02', 'left');
    });

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(swipeResult).toBeDefined();
    expect(swipeResult.consensusPercentage).toBeGreaterThanOrEqual(60);
    expect(swipeResult.consensusPercentage).toBeLessThanOrEqual(90);
    expect(typeof swipeResult.agreedWithMajority).toBe('boolean');
  });
});
