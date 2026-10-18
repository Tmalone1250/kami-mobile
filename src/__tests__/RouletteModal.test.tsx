import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { RouletteModal } from '../components/RouletteModal';

let mockTimingCallback: ((finished: boolean) => void) | null = null;

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
    withTiming: (toValue: any, _config?: any, cb?: any) => {
      mockTimingCallback = cb;
      if (cb) cb(true);
      return toValue;
    },
    withRepeat: (anim: any) => anim,
    withSequence: (...anims: any[]) => anims[0],
    cancelAnimation: jest.fn(),
    Easing: {
      bezier: () => () => 0,
      inOut: () => () => 0,
      ease: () => 0,
    },
    runOnJS: (fn: any) => fn,
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('RouletteModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSelectCategory = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockTimingCallback = null;
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders modal with repeated tape items for drum reel', () => {
    const { getByText, getAllByText } = render(
      <RouletteModal
        visible={true}
        tier="tier_01"
        onClose={mockOnClose}
        onSelectCategory={mockOnSelectCategory}
      />
    );

    expect(getByText('ROULETTE DROP')).toBeTruthy();
    expect(getByText('Tier 1: Shonen Jump')).toBeTruthy();

    // With 10 repeat cycles across 8 categories, each category appears 10 times in the tape
    const genreClashItems = getAllByText('Genre Clash');
    expect(genreClashItems.length).toBe(10);

    const plotArmorItems = getAllByText('Plot Armor');
    expect(plotArmorItems.length).toBe(10);
  });

  it('transitions state to landed and displays locked badge with pulsing CTA', () => {
    const { getByText } = render(
      <RouletteModal
        visible={true}
        tier="tier_01"
        onClose={mockOnClose}
        onSelectCategory={mockOnSelectCategory}
      />
    );

    // After animation withTiming finishes, button displays ENTER THE FORGE
    const ctaButton = getByText('ENTER THE FORGE');
    expect(ctaButton).toBeTruthy();

    // Respin button is also visible when landed
    expect(getByText('Respin Category')).toBeTruthy();
  });

  it('calls onSelectCategory with the active category slug when ENTER THE FORGE is pressed', () => {
    const { getByText } = render(
      <RouletteModal
        visible={true}
        tier="tier_01"
        onClose={mockOnClose}
        onSelectCategory={mockOnSelectCategory}
      />
    );

    const ctaButton = getByText('ENTER THE FORGE');
    fireEvent.press(ctaButton);

    expect(mockOnSelectCategory).toHaveBeenCalledTimes(1);
    expect(typeof mockOnSelectCategory.mock.calls[0][0]).toBe('string');
    expect(mockOnSelectCategory.mock.calls[0][0].length).toBeGreaterThan(0);
  });

  it('triggers spin on Respin Category press', () => {
    const { getByText } = render(
      <RouletteModal
        visible={true}
        tier="tier_01"
        onClose={mockOnClose}
        onSelectCategory={mockOnSelectCategory}
      />
    );

    const respinButton = getByText('Respin Category');
    fireEvent.press(respinButton);

    // After re-spin completes, CTA is ready again
    expect(getByText('ENTER THE FORGE')).toBeTruthy();
  });

  it('calls onClose when close icon is tapped', () => {
    const { UNSAFE_getAllByType } = render(
      <RouletteModal
        visible={true}
        tier="tier_01"
        onClose={mockOnClose}
        onSelectCategory={mockOnSelectCategory}
      />
    );

    const { TouchableOpacity } = require('react-native');
    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    // First touchable is close button in top right
    fireEvent.press(touchables[0]);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
