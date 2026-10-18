import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { View, Text, Image, useWindowDimensions, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
  runOnJS,
  Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Prompt, SwipeDirection } from '../types/forge';
import animeMediaCache from '../data/anime_media_cache.json';

export interface SwipeCardRef {
  swipe: (direction: SwipeDirection) => void;
  triggerTimeout: () => void;
}

export interface ShotClockThresholdProp {
  ratio: number;
  textColor: string;
  bgColor: string;
  borderColor: string;
  iconColor: string;
  zone: 'safe' | 'warning' | 'critical';
}

export interface SwipeCardProps {
  prompt: Prompt;
  onSwipe?: (direction: SwipeDirection) => void;
  onTimeout?: () => void;
  isTopCard?: boolean;
  shotClockText?: string;
  shotClockThreshold?: ShotClockThresholdProp;
}

const SWIPE_THRESHOLD = 120;

export const SwipeCard = forwardRef<SwipeCardRef, SwipeCardProps>(
  ({ prompt, onSwipe, onTimeout, isTopCard = true, shotClockText, shotClockThreshold }, ref) => {
    const onSwipeRef = useRef(onSwipe);
    const onTimeoutRef = useRef(onTimeout);
    useEffect(() => {
      onSwipeRef.current = onSwipe;
      onTimeoutRef.current = onTimeout;
    }, [onSwipe, onTimeout]);

    const handleSwipeCallback = (dir: SwipeDirection) => {
      onSwipeRef.current?.(dir);
    };

    const handleTimeoutCallback = () => {
      onTimeoutRef.current?.();
    };

    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const cardWidth = Math.round(screenWidth * 0.9);
    // 70% of screen height to allow comfortable spacing for header and bottom controls
    const cardHeight = Math.round(screenHeight * 0.68);

    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const timeoutBlinkOpacity = useSharedValue(0);
    const timeoutRotateZ = useSharedValue(0);
    const isLocked = useSharedValue(false);

    // Imperative Handle Cleanup: Reset all animation values & lock state when prompt changes
    useEffect(() => {
      translateX.value = 0;
      translateY.value = 0;
      timeoutBlinkOpacity.value = 0;
      timeoutRotateZ.value = 0;
      isLocked.value = false;
    }, [prompt.id]);

    const triggerHaptic = (style: Haptics.ImpactFeedbackStyle) => {
      Haptics.impactAsync(style).catch(() => { });
    };

    const triggerHapticNotification = (type: Haptics.NotificationFeedbackType) => {
      Haptics.notificationAsync(type).catch(() => { });
    };

    const handleSwipeOut = (direction: SwipeDirection) => {
      'worklet';
      if (isLocked.value) return;
      const targetX = direction === 'right' ? screenWidth * 1.5 : -screenWidth * 1.5;
      translateX.value = withTiming(
        targetX,
        { duration: 250 },
        (finished) => {
          if (finished) {
            runOnJS(handleSwipeCallback)(direction);
          }
        }
      );
    };

    const handleTimeoutSequence = () => {
      'worklet';
      isLocked.value = true;
      runOnJS(triggerHapticNotification)(Haptics.NotificationFeedbackType.Error);

      // Stage A: Horizontal violent shake & Burnt Orange blink (0 - 350ms)
      translateX.value = withSequence(
        withTiming(-14, { duration: 55 }),
        withTiming(14, { duration: 55 }),
        withTiming(-10, { duration: 55 }),
        withTiming(10, { duration: 55 }),
        withTiming(0, { duration: 50 })
      );

      timeoutBlinkOpacity.value = withSequence(
        withTiming(0.75, { duration: 90 }),
        withTiming(0.15, { duration: 90 }),
        withTiming(0.85, { duration: 90 }),
        withTiming(0.6, { duration: 80 })
      );

      // Stage B: Gravity Drop (350ms - 650ms)
      timeoutRotateZ.value = withDelay(350, withTiming(6, { duration: 300 }));
      translateY.value = withDelay(
        350,
        withTiming(screenHeight * 1.5, { duration: 300 }, (finished) => {
          if (finished) {
            runOnJS(handleTimeoutCallback)();
          }
        })
      );
    };

    useImperativeHandle(ref, () => ({
      swipe: (direction: SwipeDirection) => {
        if (isLocked.value) return;
        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
        handleSwipeOut(direction);
      },
      triggerTimeout: () => {
        handleTimeoutSequence();
      },
    }));

    const panGesture = Gesture.Pan()
      .enabled(isTopCard && !isLocked.value)
      .onUpdate((event) => {
        if (isLocked.value) return;
        translateX.value = event.translationX;
        translateY.value = event.translationY;
      })
      .onEnd(() => {
        if (isLocked.value) return;
        if (Math.abs(translateX.value) >= SWIPE_THRESHOLD) {
          const direction: SwipeDirection = translateX.value > 0 ? 'right' : 'left';
          runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Medium);
          handleSwipeOut(direction);
        } else {
          runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Light);
          translateX.value = withSpring(0, { damping: 15, stiffness: 120 });
          translateY.value = withSpring(0, { damping: 15, stiffness: 120 });
        }
      });

    const animatedCardStyle = useAnimatedStyle(() => {
      const rotationDegree = interpolate(
        translateX.value,
        [-screenWidth, 0, screenWidth],
        [-15, 0, 15],
        Extrapolation.CLAMP
      );

      const totalRotation = rotationDegree + timeoutRotateZ.value;

      return {
        transform: [
          { translateX: translateX.value },
          { translateY: translateY.value },
          { rotate: `${totalRotation}deg` },
        ],
      };
    });

    const timeoutOverlayStyle = useAnimatedStyle(() => ({
      opacity: timeoutBlinkOpacity.value,
    }));

    const rightChoiceBadgeStyle = useAnimatedStyle(() => {
      const opacity = interpolate(
        translateX.value,
        [0, SWIPE_THRESHOLD / 2, SWIPE_THRESHOLD],
        [0, 0.4, 1],
        Extrapolation.CLAMP
      );
      return { opacity };
    });

    const leftChoiceBadgeStyle = useAnimatedStyle(() => {
      const opacity = interpolate(
        translateX.value,
        [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD / 2, 0],
        [1, 0.4, 0],
        Extrapolation.CLAMP
      );
      return { opacity };
    });

    const imageA =
      prompt.image_a_url?.includes("/banner/") &&
      (animeMediaCache as Record<string, any>)[prompt.anime_a]?.coverImage
        ? (animeMediaCache as Record<string, any>)[prompt.anime_a].coverImage
        : prompt.image_a_url;

    const imageB =
      prompt.image_b_url?.includes("/banner/") &&
      (animeMediaCache as Record<string, any>)[prompt.anime_b]?.coverImage
        ? (animeMediaCache as Record<string, any>)[prompt.anime_b].coverImage
        : prompt.image_b_url;

    return (
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            {
              width: cardWidth,
              height: cardHeight,
            },
            isTopCard ? animatedCardStyle : undefined,
          ]}
          className="bg-white rounded-[32px] shadow-xl overflow-hidden border border-slate-100"
        >
          {/* Top Half: Anime A */}
          <View className="flex-1 w-full relative bg-slate-950 overflow-hidden items-center justify-center">
            {/* Ambient Blurred Backdrop */}
            <Image
              source={{ uri: imageA }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              blurRadius={12}
            />
            {/* Contrast Scrim (Softened backdrop so foreground is the primary focal point) */}
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: "rgba(15, 23, 42, 0.55)" },
              ]}
            />
            {/* Crisp Foreground Image (Primary Focal Point) */}
            <Image
              source={{ uri: imageA }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
            />
            {/* Anime A Tag */}
            <View
              style={{
                position: "absolute",
                top: 16,
                left: 16,
                maxWidth: prompt.author_username ? "52%" : "80%",
                backgroundColor: "rgba(0,0,0,0.65)",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 9999,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.2)",
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: "#FFFFFF",
                  fontSize: 12,
                  fontWeight: "800",
                  letterSpacing: 0.5,
                  includeFontPadding: false,
                  textTransform: "uppercase",
                }}
              >
                {prompt.anime_a}{" "}
              </Text>
            </View>

            {/* Architect Attribution Badge if Community Prompt */}
            {prompt.author_username && (
              <View
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  maxWidth: "44%",
                  backgroundColor: "rgba(59, 7, 100, 0.88)",
                  borderColor: "rgba(192, 132, 252, 0.5)",
                  borderWidth: 1,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 9999,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: "#F3E8FF",
                    fontSize: 11,
                    fontWeight: "900",
                    includeFontPadding: false,
                  }}
                >
                  {`🔨 @${prompt.author_username} `}
                </Text>
              </View>
            )}
          </View>

          {/* Frosted Glass Question Pill Dead Center */}
          <View
            pointerEvents="none"
            className="absolute top-1/2 left-0 right-0 -translate-y-1/2 z-20 items-center justify-center px-4"
          >
            <View className="bg-slate-900/85 px-5 py-3.5 rounded-2xl shadow-2xl border border-white/25 max-w-[92%]">
              <Text className="text-white font-extrabold text-center text-sm leading-tight tracking-tight">
                {prompt.question}
              </Text>
            </View>
          </View>

          {/* Bottom Half: Anime B */}
          <View className="flex-1 w-full relative bg-slate-950 overflow-hidden items-center justify-center">
            {/* Ambient Blurred Backdrop */}
            <Image
              source={{ uri: imageB }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              blurRadius={12}
            />
            {/* Contrast Scrim (Softened backdrop so foreground is the primary focal point) */}
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: "rgba(15, 23, 42, 0.55)" },
              ]}
            />
            {/* Crisp Foreground Image (Primary Focal Point) */}
            <Image
              source={{ uri: imageB }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
            />
            {/* Anime B Tag */}
            <View
              style={{
                position: "absolute",
                bottom: 16,
                left: 16,
                maxWidth: shotClockText ? "58%" : "85%",
                backgroundColor: "rgba(0,0,0,0.65)",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 9999,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.2)",
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: "#FFFFFF",
                  fontSize: 12,
                  fontWeight: "800",
                  letterSpacing: 0.5,
                  includeFontPadding: false,
                  textTransform: "uppercase",
                }}
              >
                {prompt.anime_b}{" "}
              </Text>
            </View>

            {/* Shot Clock Timer Pill (Bottom-Right of Card) */}
            {isTopCard && Boolean(shotClockText) && Boolean(shotClockThreshold) && (
              <View
                testID="shot-clock-timer"
                style={{
                  position: "absolute",
                  bottom: 16,
                  right: 16,
                  backgroundColor: "rgba(0, 0, 0, 0.72)",
                  borderColor: shotClockThreshold!.borderColor,
                  borderWidth: 1.5,
                  borderRadius: 9999,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  flexDirection: "row",
                  alignItems: "center",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 4,
                  elevation: 4,
                }}
              >
                <Ionicons
                  name="time-outline"
                  size={13}
                  color={shotClockThreshold!.iconColor}
                  style={{ marginRight: 4 }}
                />
                <Text
                  testID="shot-clock-text"
                  style={{
                    color: shotClockThreshold!.textColor,
                    fontSize: 12,
                    fontWeight: "800",
                    fontVariant: ["tabular-nums"],
                    includeFontPadding: false,
                  }}
                >
                  {shotClockText}
                </Text>
              </View>
            )}
          </View>

          {/* Visual Swipe Stamp: Right (Green Check / Choice A) */}
          <Animated.View
            pointerEvents="none"
            style={rightChoiceBadgeStyle}
            className="absolute top-6 right-6 z-30 bg-emerald-500/90 border-2 border-white px-4 py-1.5 rounded-full flex-row items-center shadow-lg"
          >
            <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
            <Text className="text-white font-black text-xs ml-1.5 uppercase tracking-wider">
              YES / RIGHT
            </Text>
          </Animated.View>

          {/* Visual Swipe Stamp: Left (Red X / Choice B) */}
          <Animated.View
            pointerEvents="none"
            style={leftChoiceBadgeStyle}
            className="absolute top-6 left-6 z-30 bg-rose-500/90 border-2 border-white px-4 py-1.5 rounded-full flex-row items-center shadow-lg"
          >
            <Ionicons name="close-circle" size={18} color="#FFFFFF" />
            <Text className="text-white font-black text-xs ml-1.5 uppercase tracking-wider">
              NO / LEFT
            </Text>
          </Animated.View>

          {/* Burnt Orange Timeout Flash Overlay */}
          <Animated.View
            testID="burnt-orange-overlay"
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              timeoutOverlayStyle,
              {
                backgroundColor: "#EA580C",
                zIndex: 40,
                alignItems: "center",
                justifyContent: "center",
              },
            ]}
          >
            <View className="bg-black/80 px-6 py-3 rounded-2xl border-2 border-white/60 flex-row items-center shadow-2xl">
              <Ionicons name="hourglass-outline" size={24} color="#FFAA00" />
              <Text className="text-white font-black text-lg ml-2 uppercase tracking-widest">
                TIME UP!
              </Text>
            </View>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    );
  }
);

SwipeCard.displayName = 'SwipeCard';
