jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style }: any) => <View style={style}>{children}</View>,
    useSafeAreaInsets: () => ({ top: 0, bottom: 20, left: 0, right: 0 }),
  };
});

let mockCurrentUserId = 'did:privy:user1';

jest.mock('@privy-io/expo', () => ({
  usePrivy: () => ({
    user: { id: mockCurrentUserId },
    isReady: true,
  }),
}));

jest.mock('../hooks/useKamiWallet', () => ({
  useKamiWallet: () => ({
    address: '0x1234567890123456789012345678901234567890',
  }),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
    useFocusEffect: (callback: any) => {
      React.useEffect(() => {
        callback();
      }, [callback]);
    },
  };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

const mockLeaderboardRows = [
  {
    id: 'did:privy:user1',
    username: 'OtakuGod99',
    avatar_url: 'https://example.com/1.png',
    dominant_trait: 'Shonen Purist',
    equipped_border: 'golden_kami',
    equipped_banner: 'mango_gradient',
    equipped_stamp: 'standard',
    kami_balance: 100,
    lifetime_earned_kami: 1.3,
    total_swipes: 25,
    current_streak: 5,
    prompts_forged: 2,
    creator_swipes_received: 142,
    curator_score: 1420,
    architect_score: 1470,
    global_rank: 1,
    architect_rank: 2,
  },
  {
    id: 'did:privy:user2',
    username: 'ZeroRequiem',
    avatar_url: 'https://example.com/2.png',
    dominant_trait: 'Mecha Strategist',
    equipped_border: 'neon_glitch',
    equipped_banner: 'cyber_tokyo',
    equipped_stamp: 'based_cringe',
    kami_balance: 50,
    lifetime_earned_kami: 0.98,
    total_swipes: 20,
    current_streak: 3,
    prompts_forged: 4,
    creator_swipes_received: 200,
    curator_score: 980,
    architect_score: 2100,
    global_rank: 2,
    architect_rank: 1,
  },
  {
    id: 'did:privy:user3',
    username: 'SaitamaSolos',
    avatar_url: 'https://example.com/3.png',
    dominant_trait: 'Gag Power Scaler',
    equipped_border: 'bronze',
    equipped_banner: 'zen_forest',
    equipped_stamp: 'god_tier_mid',
    kami_balance: 30,
    lifetime_earned_kami: 0.84,
    total_swipes: 18,
    current_streak: 2,
    prompts_forged: 1,
    creator_swipes_received: 45,
    curator_score: 845,
    architect_score: 475,
    global_rank: 3,
    architect_rank: 3,
  },
  {
    id: 'did:privy:user4',
    username: 'yeagerist_99',
    avatar_url: 'https://example.com/4.png',
    dominant_trait: 'Rumble Connoisseur',
    equipped_border: 'default',
    equipped_banner: 'supernova_kami',
    equipped_stamp: 'standard',
    kami_balance: 10,
    lifetime_earned_kami: 0.62,
    total_swipes: 15,
    current_streak: 4,
    prompts_forged: 1,
    creator_swipes_received: 20,
    curator_score: 620,
    architect_score: 225,
    global_rank: 4,
    architect_rank: 4,
  },
  {
    id: 'did:privy:user5',
    username: 'makima_woof',
    avatar_url: 'https://example.com/5.png',
    dominant_trait: 'Control Devil Simp',
    equipped_border: 'default',
    equipped_banner: 'mango_gradient',
    equipped_stamp: 'sugoi_trash',
    kami_balance: 5,
    lifetime_earned_kami: 0.51,
    total_swipes: 10,
    current_streak: 2,
    prompts_forged: 1,
    creator_swipes_received: 10,
    curator_score: 510,
    architect_score: 125,
    global_rank: 5,
    architect_rank: 5,
  },
];

const mockUserOutsideTop50 = {
  id: 'did:privy:outside_user',
  username: 'ChainsawApprentice',
  avatar_url: 'https://example.com/outside.png',
  dominant_trait: 'Novice Curator',
  equipped_border: 'default',
  equipped_banner: 'mango_gradient',
  equipped_stamp: 'standard',
  kami_balance: 2,
  lifetime_earned_kami: 0.12,
  total_swipes: 4,
  current_streak: 1,
  prompts_forged: 0,
  creator_swipes_received: 0,
  curator_score: 120,
  architect_score: 0,
  global_rank: 78,
  architect_rank: 92,
};

let queryResultData: any = mockLeaderboardRows;

const createQueryBuilder = () => {
  const builder: any = {
    select: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    eq: jest.fn((field: string, val: string) => {
      if (val === 'did:privy:outside_user') {
        return {
          maybeSingle: jest.fn().mockResolvedValue({
            data: mockUserOutsideTop50,
            error: null,
          }),
        };
      }
      return builder;
    }),
    maybeSingle: jest.fn().mockImplementation(() =>
      Promise.resolve({
        data: Array.isArray(queryResultData) ? queryResultData[0] : queryResultData,
        error: null,
      })
    ),
    then: (resolve: any) =>
      Promise.resolve({
        data: queryResultData,
        error: null,
      }).then(resolve),
  };
  return builder;
};

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => createQueryBuilder()),
  },
}));

import React from 'react';
import { render, fireEvent, waitFor, within } from '@testing-library/react-native';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import * as Haptics from 'expo-haptics';

describe('LeaderboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUserId = 'did:privy:user1';
    queryResultData = mockLeaderboardRows;
  });

  it('renders Hall of Kami header with season badge and dual-mode tabs', async () => {
    const { getByText, getByTestId } = render(<LeaderboardScreen />);

    await waitFor(() => {
      expect(getByText('🏆 Hall of Kami')).toBeTruthy();
      expect(getByText('Top 50 • S1')).toBeTruthy();
      expect(getByTestId('curators-tab')).toBeTruthy();
      expect(getByTestId('architects-tab')).toBeTruthy();
    });
  });

  it('renders Top 3 Olympic Podium (#1, #2, #3) with usernames and curator scores', async () => {
    const { getByTestId, getAllByText, getByText } = render(<LeaderboardScreen />);

    await waitFor(() => {
      const podium1 = getByTestId('podium-card-1');
      const podium2 = getByTestId('podium-card-2');
      const podium3 = getByTestId('podium-card-3');
      expect(podium1).toBeTruthy();
      expect(podium2).toBeTruthy();
      expect(podium3).toBeTruthy();

      expect(within(podium1).getByText('@OtakuGod99')).toBeTruthy();
      expect(within(podium1).getByText('1,420 PTS')).toBeTruthy();

      expect(within(podium2).getByText('@ZeroRequiem')).toBeTruthy();
      expect(within(podium2).getByText('980 PTS')).toBeTruthy();

      expect(within(podium3).getByText('@SaitamaSolos')).toBeTruthy();
      expect(within(podium3).getByText('845 PTS')).toBeTruthy();
    });
  });

  it('renders ranked rows #4 and #5 with streak and trait', async () => {
    const { getByTestId, getByText } = render(<LeaderboardScreen />);

    await waitFor(() => {
      expect(getByTestId('leaderboard-row-did:privy:user4')).toBeTruthy();
      expect(getByText('@yeagerist_99')).toBeTruthy();
      expect(getByText('"Rumble Connoisseur"')).toBeTruthy();
      expect(getByText('620 PTS')).toBeTruthy();
      expect(getByText('🔥 4d')).toBeTruthy();

      expect(getByTestId('leaderboard-row-did:privy:user5')).toBeTruthy();
      expect(getByText('@makima_woof')).toBeTruthy();
      expect(getByText('"Control Devil Simp"')).toBeTruthy();
      expect(getByText('510 PTS')).toBeTruthy();
      expect(getByText('🔥 2d')).toBeTruthy();
    });
  });

  it('toggles to Master Architects mode and switches metric pills to Swipes & Takes Forged', async () => {
    const { getByTestId, getAllByText, getByText } = render(<LeaderboardScreen />);

    await waitFor(() => {
      expect(getByTestId('architects-tab')).toBeTruthy();
    });

    fireEvent.press(getByTestId('architects-tab'));

    expect(Haptics.selectionAsync).toHaveBeenCalled();

    await waitFor(() => {
      expect(getAllByText('142 Swipes').length).toBeGreaterThanOrEqual(1);
      expect(getAllByText(/Takes Forged/).length).toBeGreaterThanOrEqual(1);
      expect(getByText('200 Swipes')).toBeTruthy();
      expect(getByText('45 Swipes')).toBeTruthy();
    });
  });

  it('taps a user row and navigates to Profile with userId and haptic feedback', async () => {
    const { getByTestId } = render(<LeaderboardScreen />);

    await waitFor(() => {
      expect(getByTestId('podium-card-1')).toBeTruthy();
    });

    fireEvent.press(getByTestId('podium-card-1'));

    expect(Haptics.selectionAsync).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('Profile', {
      userId: 'did:privy:user1',
    });
  });

  it('renders Sticky "Your Standing" bar with active user rank and score (in top 50)', async () => {
    const { getByTestId, getByText } = render(<LeaderboardScreen />);

    await waitFor(() => {
      expect(getByTestId('sticky-your-standing')).toBeTruthy();
      expect(getByTestId('user-standing-rank')).toBeTruthy();
      expect(getByText('#1')).toBeTruthy();
      expect(getByText('@OtakuGod99 (You)')).toBeTruthy();
      expect(getByTestId('user-standing-score')).toBeTruthy();
    });
  });

  it('executes fallback lookup and renders Sticky "Your Standing" bar when user is outside Top 50', async () => {
    mockCurrentUserId = 'did:privy:outside_user';
    const { getByTestId, getByText } = render(<LeaderboardScreen />);

    await waitFor(() => {
      expect(getByTestId('sticky-your-standing')).toBeTruthy();
      expect(getByTestId('user-standing-rank')).toBeTruthy();
      expect(getByText('#78')).toBeTruthy();
      expect(getByText('@ChainsawApprentice (You)')).toBeTruthy();
      expect(getByText('120 PTS')).toBeTruthy();
    });
  });
});
