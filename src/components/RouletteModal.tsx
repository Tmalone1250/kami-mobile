import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  cancelAnimation,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { TierKey, CategoryMeta } from '../types/forge';
import { getCategoriesForTier } from '../data/PromptRegistry';

export interface RouletteModalProps {
  visible: boolean;
  tier: TierKey;
  onClose: () => void;
  onSelectCategory: (categorySlug: string) => void;
}

const CARD_HEIGHT = 80;
const CARD_GAP = 16;
const ITEM_STEP = CARD_HEIGHT + CARD_GAP; // 96px per slot
const VIEWPORT_HEIGHT = 272; // 3 cards (80*3) + 2 gaps (16*2)
const REPEAT_COUNT = 10; // "Slot Machine Tape" duplication (80 items for 8 categories)
const LANDING_CYCLE = 7; // Decelerates into the 7th cycle for multi-revolution momentum

export const RouletteModal: React.FC<RouletteModalProps> = ({
  visible,
  tier,
  onClose,
  onSelectCategory,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const categories = useMemo(() => getCategoriesForTier(tier), [tier]);

  // Artificially duplicate the category list into a continuous tape of items
  const wheelItems: CategoryMeta[] = useMemo(() => {
    if (categories.length === 0) return [];
    const items: CategoryMeta[] = [];
    for (let c = 0; c < REPEAT_COUNT; c++) {
      items.push(...categories);
    }
    return items;
  }, [categories]);

  const [isSpinning, setIsSpinning] = useState(false);
  const [hasLanded, setHasLanded] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Position translateY so an initial item is centered at rest
  const initialOffset = categories.length > 0
    ? -((categories.length * 1) - 1) * ITEM_STEP
    : 0;
  const translateY = useSharedValue(initialOffset);
  const pulseScale = useSharedValue(1);

  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up any timers and animations on unmount
  useEffect(() => {
    return () => {
      cancelAnimation(translateY);
      cancelAnimation(pulseScale);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [translateY, pulseScale]);

  // Pulsing animation for the CTA button once a category has landed
  useEffect(() => {
    if (hasLanded) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.035, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 700, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(pulseScale);
      pulseScale.value = 1.0;
    }
  }, [hasLanded, pulseScale]);

  const triggerHapticTick = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const triggerLandingHaptic = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const handleSpinComplete = (winIdx: number) => {
    setSelectedIndex(winIdx);
    setIsSpinning(false);
    setHasLanded(true);
    triggerLandingHaptic();
  };

  const spinWheel = () => {
    if (categories.length === 0) return;
    cancelAnimation(translateY);
    setIsSpinning(true);
    setHasLanded(false);

    // Pick random target category
    const winningCategoryIndex = Math.floor(Math.random() * categories.length);
    const targetSlot = categories.length * LANDING_CYCLE + winningCategoryIndex;
    const finalY = -(targetSlot - 1) * ITEM_STEP;

    // Reset smoothly to cycle 1 for consistent full runway
    const startSlot = categories.length * 1 + selectedIndex;
    translateY.value = -(startSlot - 1) * ITEM_STEP;

    // Deceleration animation with cubic bezier easing
    translateY.value = withTiming(
      finalY,
      {
        duration: 3200,
        easing: Easing.bezier(0.12, 0.82, 0.22, 1.0),
      },
      (finished) => {
        if (finished) {
          runOnJS(handleSpinComplete)(winningCategoryIndex);
        }
      }
    );

    // Periodic haptic clicks during spin
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      triggerHapticTick();
    }, 160);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }, 2800);
  };

  useEffect(() => {
    if (visible) {
      spinWheel();
    } else {
      cancelAnimation(translateY);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsSpinning(false);
      setHasLanded(false);
    }
  }, [visible, tier]);

  const wheelAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulseScale.value }],
    };
  });

  const activeCategory = categories[selectedIndex] || categories[0];

  const handleEnterForge = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onSelectCategory(activeCategory.slug);
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      {/* Blurred / Dark Backdrop */}
      <View className="flex-1 bg-black/75 justify-between items-center py-12 px-6">
        {/* Header Bar */}
        <View className="w-full flex-row justify-between items-center px-2 pt-2">
          <View>
            <Text className="text-[10px] text-peach-300 font-extrabold uppercase tracking-widest">
              ROULETTE DROP
            </Text>
            <Text className="text-white text-lg font-black tracking-tight">
              {tier === 'tier_03'
                ? 'Tier 3: Arch-Sage'
                : tier === 'tier_02'
                ? 'Tier 2: Cult Classic'
                : 'Tier 1: Shonen Jump'}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onClose}
            className="w-10 h-10 rounded-full bg-slate-800/80 items-center justify-center border border-white/10"
          >
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Roulette Drum Container (3-Slot Vertical Window) */}
        <View className="w-full items-center justify-center my-auto">
          {/* Drum Viewport - Clean and free of dark rectangular overlay boxes */}
          <View
            style={{
              height: VIEWPORT_HEIGHT,
              width: screenWidth * 0.9,
            }}
            className="overflow-hidden relative items-center"
          >
            {/* Animated Slot Machine Tape */}
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  alignItems: 'center',
                },
                wheelAnimatedStyle,
              ]}
            >
              {wheelItems.map((item, idx) => {
                const isWinningCard = hasLanded && item.slug === activeCategory.slug;
                return (
                  <View
                    key={`${item.slug}-${idx}`}
                    style={{
                      height: CARD_HEIGHT,
                      width: screenWidth * 0.88,
                      marginBottom: CARD_GAP,
                    }}
                    className={`bg-white rounded-[28px] flex-row items-center justify-between px-6 ${
                      isWinningCard
                        ? 'border-2 border-mango-500 shadow-xl opacity-100'
                        : hasLanded
                        ? 'border border-slate-100 shadow-sm opacity-60'
                        : 'border border-slate-100 shadow-md opacity-90'
                    }`}
                  >
                    <View className="flex-row items-center flex-1 pr-3">
                      <View className="w-11 h-11 rounded-2xl bg-[#FFF1E5] items-center justify-center mr-3.5 border border-peach-300/40">
                        <Ionicons
                          name={(item.icon as any) || 'flash'}
                          size={22}
                          color="#FF9A44"
                        />
                      </View>
                      <View className="flex-1">
                        <Text
                          numberOfLines={1}
                          className="text-slate-900 font-extrabold text-base tracking-tight"
                        >
                          {item.title}
                        </Text>
                        <Text
                          numberOfLines={1}
                          className="text-slate-400 text-xs mt-0.5"
                        >
                          {item.description}
                        </Text>
                      </View>
                    </View>

                    <View className="bg-peach-300/30 px-2.5 py-1 rounded-full">
                      <Text className="text-mango-600 font-bold text-[10px]">
                        20 CARDS
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Animated.View>
          </View>

          {/* Landed Category Confirmation or Spinning Status */}
          <View className="h-10 mt-3 items-center justify-center">
            {hasLanded ? (
              <View className="bg-[#FFF1E5] px-4 py-1.5 rounded-full border border-peach-300">
                <Text className="text-mango-600 font-black text-xs uppercase tracking-wider">
                  LOCKED: {activeCategory.title}
                </Text>
              </View>
            ) : (
              <Text className="text-slate-400 text-xs font-semibold tracking-wider uppercase">
                Selecting Category...
              </Text>
            )}
          </View>
        </View>

        {/* Bottom CTA Area matching Roulette Drop.mp4 */}
        <View className="w-full items-center pb-4">
          <Animated.View style={[{ width: '100%' }, buttonAnimatedStyle]}>
            <TouchableOpacity
              activeOpacity={0.88}
              disabled={isSpinning}
              onPress={handleEnterForge}
              className={`w-full py-4 rounded-full items-center justify-center shadow-2xl flex-row ${
                isSpinning ? 'bg-slate-700' : 'bg-mango-500'
              }`}
            >
              <Text className="text-white font-black text-lg tracking-wider uppercase mr-2">
                {isSpinning ? 'Spinning...' : 'ENTER THE FORGE'}
              </Text>
              {!isSpinning && (
                <Ionicons name="arrow-forward" size={22} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Quick Respin Option */}
          {hasLanded && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={spinWheel}
              className="mt-3 py-2 px-4"
            >
              <Text className="text-slate-400 text-xs font-semibold text-center">
                Respin Category
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};
