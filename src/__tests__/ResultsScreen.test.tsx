import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { ResultsScreen } from '../screens/ResultsScreen';
import { supabase } from '../lib/supabase';

const mockNavigate = jest.fn();
let mockRouteParams: any = {
  tier: 'tier_01',
  category: 'Genre Clash',
  answersCount: 10,
  agreedCount: 8,
  baseReward: 0.5,
  consensusBonus: 1.2,
  tierMultiplier: 1.0,
  totalEarned: 0.6,
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
  useRoute: () => ({
    params: mockRouteParams,
  }),
}));

jest.mock('@privy-io/expo', () => ({
  usePrivy: () => ({
    user: { id: 'did:privy:user123', linked_accounts: [] },
    isReady: true,
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
    functions: {
      invoke: jest.fn().mockResolvedValue({
        data: { success: true, txHash: '0xmocktxhash123456' },
        error: null,
      }),
    },
    rpc: jest.fn().mockResolvedValue({ data: { success: true, new_balance: 1.2 }, error: null }),
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: { kami_balance: 0.6 } }),
        }),
      }),
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('ResultsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders Stack Cleared header, category, and dynamic 8/10 consensus bonus breakdown', () => {
    const { getByText } = render(<ResultsScreen />);

    expect(getByText('Stack Cleared!')).toBeTruthy();
    expect(getByText('Genre Clash')).toBeTruthy();
    expect(getByText('Base Reward')).toBeTruthy();
    expect(getByText('Consensus Bonus')).toBeTruthy();
    expect(getByText('(8/10)')).toBeTruthy();
    expect(getByText('1.2x')).toBeTruthy();
    expect(getByText('Tier Multiplier')).toBeTruthy();
    expect(getByText('TOTAL EARNED')).toBeTruthy();
    expect(getByText('CLAIM TO WALLET')).toBeTruthy();
  });

  it('handles claim to wallet, calls Edge Function & Supabase RPC, transitions through broadcasting state, and navigates back to Hub', async () => {
    const { getByText } = render(<ResultsScreen />);

    const claimButton = getByText('CLAIM TO WALLET');
    await act(async () => {
      fireEvent.press(claimButton);
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('claim-reward', {
      body: {
        amount: 0.6,
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      },
    });

    expect(supabase.rpc).toHaveBeenCalledWith('claim_kami_rewards', {
      p_user_id: 'did:privy:user123',
      p_reward_amount: 0.6,
    });

    expect(getByText('Claimed to Wallet!')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockNavigate).toHaveBeenCalledWith('Main');
  });

  it("renders celebratory Crucible UI when isCrucibleMode is true and does not invoke claim rewards", async () => {
    mockRouteParams = {
      tier: "tier_01",
      category: "The Crucible",
      answersCount: 10,
      agreedCount: 7,
      baseReward: 0.5,
      consensusBonus: 1.2,
      tierMultiplier: 1.0,
      totalEarned: 0.6,
      isCrucibleMode: true,
    };

    const { getByText, getByTestId, queryByText } = render(<ResultsScreen />);

    expect(getByText("The Canon Has Been Shaped!")).toBeTruthy();
    expect(getByText("THE CRUCIBLE • COMMUNITY ARENA")).toBeTruthy();
    expect(getByText("100% Free-Play")).toBeTruthy();
    expect(getByText("COMMUNITY TRUST EXPANDED")).toBeTruthy();
    expect(getByText("CONTINUE CURATION / BACK TO HUB")).toBeTruthy();

    // Verify claim button is NOT present
    expect(queryByText("CLAIM TO WALLET")).toBeNull();

    const continueButton = getByTestId("crucible-continue-button");
    fireEvent.press(continueButton);

    expect(mockNavigate).toHaveBeenCalledWith("Main");
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

});
