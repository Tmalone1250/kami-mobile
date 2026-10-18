import React, { createRef } from 'react';
import { render } from '@testing-library/react-native';
import { SwipeCard, SwipeCardRef } from '../components/SwipeCard';
import { Prompt } from '../types/forge';

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
  };
});

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GestureDetector: ({ children }: any) => <View testID="gesture-detector">{children}</View>,
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
  NotificationFeedbackType: { Error: 'error', Success: 'success' },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

const mockPrompt: Prompt = {
  id: 'test-p1',
  anime_a: 'Hunter x Hunter',
  anime_b: 'Jujutsu Kaisen',
  question: 'Could the Phantom Troupe survive the Shibuya Incident?',
  image_a_url: 'https://picsum.photos/seed/test-a/600/500',
  image_b_url: 'https://picsum.photos/seed/test-b/600/500',
};

describe('SwipeCard', () => {
  it('renders anime titles, question, and stamps', () => {
    const { getByText } = render(<SwipeCard prompt={mockPrompt} />);

    expect(getByText(/Hunter x Hunter/)).toBeTruthy();
    expect(getByText(/Jujutsu Kaisen/)).toBeTruthy();
    expect(getByText('Could the Phantom Troupe survive the Shibuya Incident?')).toBeTruthy();
    expect(getByText('YES / RIGHT')).toBeTruthy();
    expect(getByText('NO / LEFT')).toBeTruthy();
  });

  it('exposes a swipe method via ref', () => {
    const ref = createRef<SwipeCardRef>();
    const onSwipe = jest.fn();
    render(<SwipeCard ref={ref} prompt={mockPrompt} onSwipe={onSwipe} />);

    expect(ref.current).toBeDefined();
    expect(typeof ref.current?.swipe).toBe('function');
  });

  it('exposes triggerTimeout via ref and executes onTimeout callback', () => {
    const ref = createRef<SwipeCardRef>();
    const onTimeout = jest.fn();
    const { getByTestId } = render(
      <SwipeCard ref={ref} prompt={mockPrompt} onTimeout={onTimeout} />
    );

    expect(ref.current).toBeDefined();
    expect(typeof ref.current?.triggerTimeout).toBe('function');

    expect(getByTestId('burnt-orange-overlay')).toBeTruthy();

    ref.current?.triggerTimeout();
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('renders shot clock timer pill in bottom-right corner when shotClockText and threshold are provided', () => {
    const { getByTestId } = render(
      <SwipeCard
        prompt={mockPrompt}
        isTopCard={true}
        shotClockText="45s"
        shotClockThreshold={{
          ratio: 1.0,
          textColor: '#10B981',
          bgColor: '#ECFDF5',
          borderColor: '#A7F3D0',
          iconColor: '#10B981',
          zone: 'safe',
        }}
      />
    );

    const timerPill = getByTestId('shot-clock-timer');
    const timerText = getByTestId('shot-clock-text');
    expect(timerPill).toBeTruthy();
    expect(timerText.props.children).toBe('45s');
    expect(timerText.props.style.color).toBe('#10B981');
  });
});
