import { renderHook, waitFor } from '@testing-library/react-native';
import { useKamiBalance, baseSepoliaClient } from '../hooks/useKamiBalance';

describe('useKamiBalance', () => {
  const validAddress = '0x1234567890123456789012345678901234567890';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 0 balance when no wallet address is provided', async () => {
    const { result } = renderHook(() => useKamiBalance(null));

    expect(result.current.balance).toBe(0);
    expect(result.current.formatted).toBe('0.00');
    expect(result.current.rawBalance).toBe(0n);
  });

  it('returns 0 balance when address is invalid', async () => {
    const { result } = renderHook(() => useKamiBalance('not-an-evm-address'));

    expect(result.current.balance).toBe(0);
    expect(result.current.formatted).toBe('0.00');
  });

  it('fetches and formats on-chain balance correctly', async () => {
    const spy = jest
      .spyOn(baseSepoliaClient, 'readContract')
      .mockResolvedValueOnce(500000000000000000000n as any); // 500 KAMI

    const { result } = renderHook(() => useKamiBalance(validAddress));

    await waitFor(() => {
      expect(result.current.balance).toBe(500);
      expect(result.current.formatted).toBe('500.00');
      expect(result.current.rawBalance).toBe(500000000000000000000n);
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'balanceOf',
        args: [validAddress],
      })
    );
  });

  it('handles readContract errors gracefully without throwing', async () => {
    jest
      .spyOn(baseSepoliaClient, 'readContract')
      .mockRejectedValueOnce(new Error('RPC rate limit reached'));

    const { result } = renderHook(() => useKamiBalance(validAddress));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe('RPC rate limit reached');
      expect(result.current.balance).toBe(0);
    });
  });
});
