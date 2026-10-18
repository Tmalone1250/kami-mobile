jest.mock('@privy-io/expo', () => ({
  usePrivy: () => ({
    user: { id: 'did:privy:testuser123' },
    isReady: true,
  }),
}));

jest.mock('../hooks/useKamiWallet', () => ({
  useKamiWallet: () => ({
    address: '0x1234567890123456789012345678901234567890',
  }),
}));

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { ForgeScreen, formatShotClock, getShotClockThreshold } from '../screens/ForgeScreen';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockRecordSwipe = jest.fn();
const mockRecordCommunitySwipeAndQuality = jest.fn();

let mockRouteParams: any = { tier: 'tier_01', category: 'genre_clash' };

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: mockNavigate,
  }),
  useRoute: () => ({
    params: mockRouteParams,
  }),
}));

jest.mock('../hooks/useTruthEngine', () => ({
  useTruthEngine: () => ({
    recordSwipe: mockRecordSwipe,
    isLoading: false,
    lastResult: null,
    error: null,
  }),
}));

const mockCommunityCard = {
  id: 'comm-1',
  anime_a: 'Steins;Gate',
  anime_b: 'Your Lie in April',
  question: 'Does Okarin watching Mayuri die infinitely hit way harder than Kaori letter?',
  image_a_url: 'https://example.com/a.jpg',
  image_b_url: 'https://example.com/b.jpg',
  category: 'genre_clash',
  tier: 'tier_01',
  author_id: 'user-123',
  author_username: 'TimeLeaper',
  status: 'crucible',
  quality_upvotes: 5,
  trash_flags: 1,
};

const createQueryBuilder = (resultData: any) => {
  const builder: any = {
    select: jest.fn(() => builder),
    in: jest.fn(() => builder),
    neq: jest.fn(() => builder),
    not: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    maybeSingle: jest.fn().mockResolvedValue({ data: Array.isArray(resultData) ? resultData[0] : resultData, error: null }),
    then: (resolve: any) => Promise.resolve({ data: resultData, error: null }).then(resolve),
  };
  return builder;
};

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn((table: string) => {
      if (table === 'community_prompt_votes') {
        return createQueryBuilder([]);
      }
      return createQueryBuilder([mockCommunityCard]);
    }),
    rpc: (...args: any[]) => mockRecordCommunitySwipeAndQuality(...args),
  },
}));

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: {
      View: ({ children, style, ...props }: any) => <View style={style} {...props}>{children}</View>,
    },
    useSharedValue: (initial: any) => ({ value: initial }),
    useAnimatedStyle: (fn: any) => fn(),
    withSpring: (toValue: any) => toValue,
    withTiming: (toValue: any, _config?: any, cb?: any) => {
      if (cb) cb(true);
      return toValue;
    },
    withSequence: (...anims: any[]) => anims[anims.length - 1],
    withDelay: (_delay: number, anim: any) => anim,
    interpolate: (_val: any, _in: any, out: any) => out[0] || 0,
    runOnJS: (fn: any) => fn,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: {
      out: (fn: any) => fn,
      ease: jest.fn(),
      back: (s: number) => s,
    },
  };
});

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GestureDetector: ({ children }: any) => <View>{children}</View>,
    Gesture: {
      Pan: () => ({
        enabled: jest.fn().mockReturnThis(),
        onUpdate: jest.fn().mockReturnThis(),
        onEnd: jest.fn().mockReturnThis(),
      }),
    },
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('ForgeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = { tier: 'tier_01', category: 'genre_clash' };
    mockRecordSwipe.mockResolvedValue({
      consensusPercentage: 82,
      agreedWithMajority: true,
      totalSwipes: 50,
    });
    mockRecordCommunitySwipeAndQuality.mockResolvedValue({
      data: {
        consensus_percentage: 75,
        total_swipes: 15,
        status: 'crucible',
      },
      error: null,
    });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('renders Forge header with category title, tier name, and 10-card progress counter', async () => {
    const { getByText } = render(<ForgeScreen />);
    await act(async () => {
      jest.advanceTimersByTime(50);
    });

    expect(getByText('Genre Clash')).toBeTruthy();
    expect(getByText('Shonen Jump')).toBeTruthy();
    expect(getByText('1.0x')).toBeTruthy();
    expect(getByText('1/10')).toBeTruthy();
  });

  it('handles back button press to navigate back to Hub', async () => {
    const { UNSAFE_getAllByType } = render(<ForgeScreen />);
    await act(async () => {
      jest.advanceTimersByTime(50);
    });

    const { TouchableOpacity } = require('react-native');
    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    // First touchable is back button
    fireEvent.press(touchables[0]);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('renders The Crucible Arena with 1.2x multiplier and backfills to 10 cards', async () => {
    mockRouteParams = {
      tier: 'tier_01',
      category: 'The Crucible',
      isCrucibleMode: true,
    };

    const { getByText, findByText } = render(<ForgeScreen />);
    await act(async () => {
      jest.advanceTimersByTime(50);
    });

    expect(getByText('The Crucible')).toBeTruthy();
    expect(getByText('Community Arena')).toBeTruthy();
    expect(getByText('1.2x')).toBeTruthy();

    const fireButton = await findByText(/Fire/);
    expect(fireButton).toBeTruthy();
    const trashButton = await findByText(/Trash/);
    expect(trashButton).toBeTruthy();
  });

  it('allows selecting quality vote and resets vote state immediately upon swipe', async () => {
    mockRouteParams = {
      tier: 'tier_01',
      category: 'The Crucible',
      isCrucibleMode: true,
    };

    const { findByTestId, getByTestId } = render(<ForgeScreen />);
    await act(async () => {
      jest.advanceTimersByTime(50);
    });

    const fireButton = await findByTestId('quality-vote-fire');
    expect(fireButton).toBeTruthy();

    // Tap Fire Prompt
    fireEvent.press(fireButton);

    const rightSwipeBtn = getByTestId('swipe-right-button');

    await act(async () => {
      fireEvent.press(rightSwipeBtn);
    });

    // Verify community RPC was called with quality vote 'up'
    expect(mockRecordCommunitySwipeAndQuality).toHaveBeenCalledWith(
      'record_community_swipe_and_quality',
      expect.objectContaining({
        p_user_id: 'did:privy:testuser123',
        p_prompt_id: 'comm-1',
        p_swipe_direction: 'right',
        p_quality_vote: 'up',
      })
    );
  });

  describe('Directive 13 - Shot Clock & Drop Physics', () => {
    it('initializes Shot Clock to 45s on Tier 1 (Shonen Jump)', async () => {
      mockRouteParams = { tier: 'tier_01', category: 'genre_clash' };
      const { getByTestId } = render(<ForgeScreen />);
      await act(async () => {
        jest.advanceTimersByTime(50);
      });

      const timerPill = getByTestId('shot-clock-timer');
      const timerText = getByTestId('shot-clock-text');
      expect(timerPill).toBeTruthy();
      expect(timerText.props.children).toBe('45s');

      // Safe threshold (>50%): Green #10B981
      expect(timerText.props.style.color).toBe('#10B981');
    });

    it('initializes Shot Clock to 1:30 on Tier 2 and 2:00 on Tier 3', async () => {
      mockRouteParams = { tier: 'tier_02', category: 'cult_classics' };
      const { getByTestId: getByTestIdT2, unmount: unmountT2 } = render(<ForgeScreen />);
      await act(async () => {
        jest.advanceTimersByTime(50);
      });
      expect(getByTestIdT2('shot-clock-text').props.children).toBe('1:30');
      unmountT2();

      mockRouteParams = { tier: 'tier_03', category: 'mecha_lore' };
      const { getByTestId: getByTestIdT3, unmount: unmountT3 } = render(<ForgeScreen />);
      await act(async () => {
        jest.advanceTimersByTime(50);
      });
      expect(getByTestIdT3('shot-clock-text').props.children).toBe('2:00');
      unmountT3();
    });

    it('transitions through Safe (Green), Warning (Mango), and Critical (Crimson Red) thresholds', async () => {
      mockRouteParams = { tier: 'tier_01', category: 'genre_clash' };
      const { getByTestId } = render(<ForgeScreen />);
      await act(async () => {
        jest.advanceTimersByTime(50);
      });

      const timerText = getByTestId('shot-clock-text');
      // At start (45s / 45s = 1.0): Safe (Green #10B981)
      expect(timerText.props.children).toBe('45s');
      expect(timerText.props.style.color).toBe('#10B981');

      // Advance by 23s -> 22s remaining (22/45 = 0.488 <= 0.50): Warning (Mango #FF9A44)
      await act(async () => {
        jest.advanceTimersByTime(23000);
      });
      expect(timerText.props.children).toBe('22s');
      expect(timerText.props.style.color).toBe('#FF9A44');

      // Advance by another 16s -> 6s remaining (6/45 = 0.133 <= 0.15): Critical (Crimson Red #EF4444)
      await act(async () => {
        jest.advanceTimersByTime(16000);
      });
      expect(timerText.props.children).toBe('6s');
      expect(timerText.props.style.color).toBe('#EF4444');
    });

    it('triggers timeout at 0s, advances to next card, logs missed match without Supabase RPC, and resets timer to 45s', async () => {
      mockRouteParams = { tier: 'tier_01', category: 'genre_clash' };
      const { getByTestId, getByText } = render(<ForgeScreen />);
      await act(async () => {
        jest.advanceTimersByTime(50);
      });

      expect(getByText('1/10')).toBeTruthy();
      expect(getByTestId('shot-clock-text').props.children).toBe('45s');

      // Advance timers by 46 seconds to expire the shot clock
      await act(async () => {
        jest.advanceTimersByTime(46000);
      });

      // Verification: Card advances to 2/10
      expect(getByText('2/10')).toBeTruthy();

      // Verification: Neither standard nor community swipe RPC was called for timeout drop
      expect(mockRecordSwipe).not.toHaveBeenCalled();
      expect(mockRecordCommunitySwipeAndQuality).not.toHaveBeenCalled();

      // Verification: Next card timer cleanly resets back to 45s and Safe Green
      const nextTimerText = getByTestId('shot-clock-text');
      expect(nextTimerText.props.children).toBe('45s');
      expect(nextTimerText.props.style.color).toBe('#10B981');
    });
  });

  describe('formatShotClock & getShotClockThreshold helper unit tests', () => {
    it('formats seconds < 60 with suffix s and >= 60 with mm:ss format', () => {
      expect(formatShotClock(45, 45)).toBe('45s');
      expect(formatShotClock(9, 45)).toBe('9s');
      expect(formatShotClock(0, 45)).toBe('0s');
      expect(formatShotClock(90, 90)).toBe('1:30');
      expect(formatShotClock(65, 90)).toBe('1:05');
      expect(formatShotClock(120, 120)).toBe('2:00');
    });

    it('calculates threshold zones accurately', () => {
      expect(getShotClockThreshold(45, 45).zone).toBe('safe');
      expect(getShotClockThreshold(22, 45).zone).toBe('warning');
      expect(getShotClockThreshold(6, 45).zone).toBe('critical');
      expect(getShotClockThreshold(0, 45).zone).toBe('critical');
    });
  });
});
