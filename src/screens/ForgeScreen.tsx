import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { SwipeCard, SwipeCardRef } from '../components/SwipeCard';
import { Prompt, SwipeDirection, TierKey } from '../types/forge';
import { RootStackParamList } from '../navigation/types';
import { getShuffledPrompts, CATEGORY_METADATA } from '../data/PromptRegistry';
import { useTruthEngine, SwipeConsensusResult } from '../hooks/useTruthEngine';
import { usePrivy } from '@privy-io/expo';
import { useKamiWallet } from '../hooks/useKamiWallet';
import { supabase } from '../lib/supabase';

export interface ForgeScreenProps {
  route?: {
    params?: {
      tier?: TierKey;
      category?: string;
      isCrucibleMode?: boolean;
    };
  };
}

interface RecordedAnswer {
  promptId: string;
  direction: SwipeDirection;
  agreedWithMajority: boolean;
  consensusPercentage: number;
}

export const TIER_TIME_LIMITS: Record<TierKey, number> = {
  tier_01: 45,
  tier_02: 90,
  tier_03: 120,
};

export function formatShotClock(secondsRemaining: number, maxSeconds: number): string {
  const clamped = Math.max(0, Math.floor(secondsRemaining));
  if (maxSeconds < 60) {
    return `${clamped}s`;
  }
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

export interface ShotClockThreshold {
  ratio: number;
  textColor: string;
  bgColor: string;
  borderColor: string;
  iconColor: string;
  zone: "safe" | "warning" | "critical";
}

export function getShotClockThreshold(secondsRemaining: number, maxSeconds: number): ShotClockThreshold {
  const ratio = maxSeconds > 0 ? Math.max(0, secondsRemaining / maxSeconds) : 0;
  if (ratio > 0.5) {
    return {
      ratio,
      textColor: "#10B981",
      bgColor: "#ECFDF5",
      borderColor: "#A7F3D0",
      iconColor: "#10B981",
      zone: "safe",
    };
  }
  if (ratio > 0.15) {
    return {
      ratio,
      textColor: "#FF9A44",
      bgColor: "#FFF7ED",
      borderColor: "#FED7AA",
      iconColor: "#FF9A44",
      zone: "warning",
    };
  }
  return {
    ratio,
    textColor: "#EF4444",
    bgColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    iconColor: "#EF4444",
    zone: "critical",
  };
}

const TIER_CONFIG: Record<TierKey, { name: string; multiplier: number; label: string }> = {
  tier_01: { name: 'Shonen Jump', multiplier: 1.0, label: '1.0x' },
  tier_02: { name: 'Cult Classic', multiplier: 1.5, label: '1.5x' },
  tier_03: { name: 'Arch-Sage', multiplier: 3.0, label: '3.0x' },
};

export const ForgeScreen: React.FC<ForgeScreenProps> = (props) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<any>();
  const { recordSwipe } = useTruthEngine();
  const { user } = usePrivy();
  const { address } = useKamiWallet();
  const activeUserId = user?.id || address || 'anon_curator';

  const isCrucibleMode: boolean = Boolean(
    route.params?.isCrucibleMode || props.route?.params?.isCrucibleMode
  );
  const tier: TierKey = route.params?.tier || props.route?.params?.tier || 'tier_01';
  const categorySlug: string =
    route.params?.category || props.route?.params?.category || (isCrucibleMode ? 'the_crucible' : 'genre_clash');

  const tierInfo = isCrucibleMode
    ? { name: 'Community Arena', multiplier: 1.2, label: '1.2x' }
    : TIER_CONFIG[tier] || TIER_CONFIG.tier_01;

  const categoryInfo = isCrucibleMode
    ? {
        slug: 'the_crucible',
        title: 'The Crucible',
        icon: 'flame',
        description: 'UGC Testing Grounds',
      }
    : CATEGORY_METADATA[categorySlug] || {
        slug: categorySlug,
        title: categorySlug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        icon: 'flash',
        description: 'Anime Showdown',
      };

  // Pre-seed standard deck so 1/10 renders synchronously without flicker
  const [prompts, setPrompts] = useState<Prompt[]>(() =>
    getShuffledPrompts(tier, categorySlug, 10)
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<RecordedAnswer[]>([]);
  const [activeReveal, setActiveReveal] = useState<SwipeConsensusResult | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [selectedQualityVote, setSelectedQualityVote] = useState<'up' | 'trash' | null>(null);
  const selectedQualityVoteRef = useRef<'up' | 'trash' | null>(null);

  // Shot Clock Timer State
  const activeCardTier: TierKey =
    isCrucibleMode
      ? (prompts[currentIndex]?.tier as TierKey) || tier || 'tier_01'
      : tier || 'tier_01';
  const maxSeconds = TIER_TIME_LIMITS[activeCardTier] || 45;
  const [secondsRemaining, setSecondsRemaining] = useState<number>(maxSeconds);
  const [isTimingOut, setIsTimingOut] = useState<boolean>(false);
  const isTimingOutRef = useRef<boolean>(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevZoneRef = useRef<'safe' | 'warning' | 'critical'>('safe');

  const handleToggleQualityVote = (vote: 'up' | 'trash') => {
    setSelectedQualityVote((prev) => {
      const next = prev === vote ? null : vote;
      selectedQualityVoteRef.current = next;
      return next;
    });
  };

  const topCardRef = useRef<SwipeCardRef>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Overlay animations
  const overlayOpacity = useSharedValue(0);
  const overlayScale = useSharedValue(0.85);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, []);

  // Initialize deck: Crucible or Standard Tier (with 10th card community trial injection & backfill)
  const initializeDeck = useCallback(async () => {
    setCurrentIndex(0);
    setAnswers([]);
    setActiveReveal(null);
    setIsRevealing(false);
    selectedQualityVoteRef.current = null;
    setSelectedQualityVote(null);

    if (isCrucibleMode) {
      try {
        let excludedPromptIds: string[] = [];
        if (activeUserId && activeUserId !== 'anon_curator') {
          const { data: userVotes } = await supabase
            .from('community_prompt_votes')
            .select('prompt_id')
            .eq('user_id', activeUserId);
          if (userVotes && userVotes.length > 0) {
            excludedPromptIds = userVotes.map((v: any) => v.prompt_id);
          }
        }

        let query = supabase
          .from('community_prompts')
          .select('*')
          .in('status', ['crucible', 'canon'])
          .order('created_at', { ascending: false })
          .limit(10);

        if (activeUserId && activeUserId !== 'anon_curator') {
          query = query.neq('author_id', activeUserId);
        }

        if (excludedPromptIds.length > 0) {
          query = query.not('id', 'in', `(${excludedPromptIds.join(',')})`);
        }

        const { data, error } = await query;

        const communityCards: Prompt[] = (!error && data ? data : []).map((row: any) => ({
          id: row.id,
          anime_a: row.anime_a,
          anime_b: row.anime_b,
          question: row.question,
          image_a_url: row.image_a_url,
          image_b_url: row.image_b_url,
          category: row.category,
          tier: (row.tier as TierKey) || 'tier_01',
          author_id: row.author_id,
          author_username: row.author_username,
          status: row.status,
          quality_upvotes: row.quality_upvotes,
          trash_flags: row.trash_flags,
          isCommunityPrompt: true,
        }));

        // Crucible Stack Backfill: If fewer than 10 community prompts exist, pad with Tier 1 prompts
        if (communityCards.length < 10) {
          const needed = 10 - communityCards.length;
          const fallbackCards = getShuffledPrompts('tier_01', 'genre_clash', needed);
          setPrompts([...communityCards, ...fallbackCards]);
        } else {
          setPrompts(communityCards);
        }
      } catch (err) {
        console.warn('Error loading crucible prompts, falling back to tier 1:', err);
        setPrompts(getShuffledPrompts('tier_01', 'genre_clash', 10));
      }
    } else {
      // Standard Tier Stack
      const deck = getShuffledPrompts(tier, categorySlug, 10);

      // Card #10 Trial Injection: Fetch 1 community card for Card #10 (unvoted & non-author)
      try {
        let trialQuery = supabase
          .from('community_prompts')
          .select('*')
          .eq('tier', tier)
          .in('status', ['crucible', 'canon'])
          .order('created_at', { ascending: false })
          .limit(1);

        if (activeUserId && activeUserId !== 'anon_curator') {
          trialQuery = trialQuery.neq('author_id', activeUserId);

          const { data: userVotes } = await supabase
            .from('community_prompt_votes')
            .select('prompt_id')
            .eq('user_id', activeUserId);

          if (userVotes && userVotes.length > 0) {
            const excludedIds = userVotes.map((v: any) => v.prompt_id);
            trialQuery = trialQuery.not('id', 'in', `(${excludedIds.join(',')})`);
          }
        }

        const { data: communityTrial } = await trialQuery.maybeSingle();

        if (communityTrial && deck.length >= 10) {
          deck[9] = {
            id: communityTrial.id,
            anime_a: communityTrial.anime_a,
            anime_b: communityTrial.anime_b,
            question: communityTrial.question,
            image_a_url: communityTrial.image_a_url,
            image_b_url: communityTrial.image_b_url,
            category: communityTrial.category,
            tier: (communityTrial.tier as TierKey) || tier,
            author_id: communityTrial.author_id,
            author_username: communityTrial.author_username,
            status: communityTrial.status,
            quality_upvotes: communityTrial.quality_upvotes,
            trash_flags: communityTrial.trash_flags,
            isCommunityPrompt: true,
          };
        }
      } catch (err) {
        // Silently continue with standard deck
      }

      setPrompts(deck);
    }
  }, [isCrucibleMode, tier, categorySlug, activeUserId]);

  useEffect(() => {
    initializeDeck();
  }, [initializeDeck]);

  const isCompleted = prompts.length > 0 && currentIndex >= prompts.length;
  const currentPrompt = prompts[currentIndex];
  const nextPrompt = currentIndex + 1 < prompts.length ? prompts[currentIndex + 1] : null;

  const navigateToResults = (recordedAnswers: RecordedAnswer[] = answers) => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    const totalPrompts = prompts.length || 10;
    const agreedCount = recordedAnswers.filter((a) => a.agreedWithMajority).length;
    // Calculate consensus bonus: 8/10 matches community yields 1.2x multiplier
    const consensusBonus = Number((1.0 + (agreedCount / totalPrompts) * 0.25).toFixed(1));
    const baseReward = 0.5;
    const tierMultiplier = tierInfo.multiplier;
    const totalEarned = Number((baseReward * consensusBonus * tierMultiplier).toFixed(2));

    navigation.navigate('Results', {
      tier,
      category: categoryInfo.title,
      answersCount: totalPrompts,
      agreedCount,
      baseReward,
      consensusBonus,
      tierMultiplier,
      totalEarned,
    });
  };

  const handleCardSwiped = async (direction: SwipeDirection) => {
    if (!currentPrompt) return;

    // Capture quality vote via ref to prevent stale closures and reset state immediately
    const qualityVoteToSubmit = selectedQualityVoteRef.current ?? selectedQualityVote;
    selectedQualityVoteRef.current = null;
    setSelectedQualityVote(null);

    let consensusResult: SwipeConsensusResult;

    if (currentPrompt.isCommunityPrompt || currentPrompt.author_id) {
      try {
        const { data, error } = await supabase.rpc('record_community_swipe_and_quality', {
          p_user_id: activeUserId,
          p_prompt_id: currentPrompt.id,
          p_swipe_direction: direction,
          p_quality_vote: qualityVoteToSubmit,
        });

        if (!error && data) {
          const pct = Number(data.consensus_percentage ?? 50);
          consensusResult = {
            consensusPercentage: pct,
            agreedWithMajority: pct >= 50,
            majorityDirection: pct >= 50 ? direction : direction === 'right' ? 'left' : 'right',
            totalSwipes: Number(data.total_swipes ?? 1),
          };
        } else {
          consensusResult = await recordSwipe(currentPrompt.id, direction);
        }
      } catch (e) {
        consensusResult = await recordSwipe(currentPrompt.id, direction);
      }
    } else {
      // Standard Truth Engine RPC
      consensusResult = await recordSwipe(currentPrompt.id, direction);
    }

    const updatedAnswers = [
      ...answers,
      {
        promptId: currentPrompt.id,
        direction,
        agreedWithMajority: consensusResult.agreedWithMajority,
        consensusPercentage: consensusResult.consensusPercentage,
      },
    ];
    setAnswers(updatedAnswers);
    setActiveReveal(consensusResult);
    setIsRevealing(true);

    // Haptic feedback for consensus
    if (consensusResult.agreedWithMajority) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    // Animate overlay in
    overlayOpacity.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.ease) });
    overlayScale.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.back(1.5)) });

    // Show reveal overlay for ~800ms before advancing
    revealTimerRef.current = setTimeout(() => {
      overlayOpacity.value = withTiming(0, { duration: 150 });
      overlayScale.value = withTiming(0.85, { duration: 150 });

      setTimeout(() => {
        setIsRevealing(false);
        setActiveReveal(null);
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);

        // If completed all cards, navigate automatically
        if (nextIndex >= prompts.length) {
          setTimeout(() => {
            navigateToResults(updatedAnswers);
          }, 400);
        }
      }, 150);
    }, 800);
  };

  const handleCardTimeoutFinished = useCallback(() => {
    if (!currentPrompt) return;

    selectedQualityVoteRef.current = null;
    setSelectedQualityVote(null);

    const updatedAnswers: RecordedAnswer[] = [
      ...answers,
      {
        promptId: currentPrompt.id,
        direction: "left",
        agreedWithMajority: false,
        consensusPercentage: 0,
      },
    ];
    setAnswers(updatedAnswers);

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setIsTimingOut(false);
    isTimingOutRef.current = false;

    if (nextIndex >= prompts.length) {
      setTimeout(() => {
        navigateToResults(updatedAnswers);
      }, 400);
    }
  }, [currentPrompt, answers, currentIndex, prompts.length]);

  const handleTriggerTimeout = useCallback(() => {
    if (isTimingOutRef.current || isCompleted || isRevealing) return;
    isTimingOutRef.current = true;
    setIsTimingOut(true);

    if (topCardRef.current?.triggerTimeout) {
      topCardRef.current.triggerTimeout();
    } else {
      handleCardTimeoutFinished();
    }
  }, [isCompleted, isRevealing, handleCardTimeoutFinished]);

  // Reset timer on card change
  useEffect(() => {
    setSecondsRemaining(maxSeconds);
    isTimingOutRef.current = false;
    setIsTimingOut(false);
    prevZoneRef.current = "safe";
  }, [currentIndex, maxSeconds]);

  // Shot clock countdown interval with pause on reveal/timeout/completion
  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (isCompleted || isRevealing || isTimingOut) {
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          handleTriggerTimeout();
          return 0;
        }
        const next = prev - 1;
        const currentThreshold = getShotClockThreshold(next, maxSeconds);
        if (currentThreshold.zone === "critical" && prevZoneRef.current !== "critical") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        prevZoneRef.current = currentThreshold.zone;
        return next;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [currentIndex, isCompleted, isRevealing, isTimingOut, maxSeconds, handleTriggerTimeout]);

  const handleButtonSwipe = (direction: SwipeDirection) => {
    if (!isCompleted && !isRevealing && !isTimingOut && topCardRef.current) {
      topCardRef.current.swipe(direction);
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    transform: [{ scale: overlayScale.value }],
  }));

  const isCurrentCardCommunity = Boolean(
    currentPrompt?.isCommunityPrompt || currentPrompt?.author_username
  );

  const formattedTime = formatShotClock(secondsRemaining, maxSeconds);
  const threshold = getShotClockThreshold(secondsRemaining, maxSeconds);

  return (
    <SafeAreaView key="forge-screen-root" className="flex-1 bg-gray-50" edges={['top', 'bottom']}>
      {/* Header Bar */}
      <View key="forge-header" className="flex-row items-center justify-between px-6 py-3">
        {/* Back Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleGoBack}
          className="w-10 h-10 rounded-full bg-white items-center justify-center shadow-sm border border-slate-100"
        >
          <Ionicons name="arrow-back" size={20} color="#0F172A" />
        </TouchableOpacity>

        {/* Category & Tier Info Pill */}
        <View className="items-center max-w-[65%]">
          <Text
            numberOfLines={1}
            className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider"
          >
            {categoryInfo.title}
          </Text>
          <View className="flex-row items-center mt-0.5">
            <Text className="text-slate-900 font-extrabold text-sm">
              {tierInfo.name}
            </Text>
            <View
              className={`px-2.5 py-1 rounded-full ml-1.5 items-center justify-center ${
                isCrucibleMode ? 'bg-purple-100' : 'bg-peach-300/40'
              }`}
            >
              <Text
                style={{ includeFontPadding: false, lineHeight: 14 }}
                className={`font-bold text-[10px] ${
                  isCrucibleMode ? 'text-purple-700' : 'text-mango-600'
                }`}
              >
                {tierInfo.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Counter Badge */}
        <View className="bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm items-center justify-center">
          <Text style={{ includeFontPadding: false, lineHeight: 16 }} className="text-slate-500 font-bold text-xs">
            {isCompleted
              ? `${prompts.length}/${prompts.length}`
              : `${Math.min(currentIndex + 1, prompts.length || 10)}/${prompts.length || 10}`}
          </Text>
        </View>
      </View>

      {/* Main Content Area */}
      <View key="forge-main-container" className="flex-1 items-center justify-center px-4 relative">
        {isCompleted ? (
          /* Stack Cleared Interim Card */
          <View
            key="forge-stack-cleared"
            className="w-[90%] bg-white rounded-[32px] p-8 items-center shadow-2xl border border-slate-100"
          >
            <View className="w-20 h-20 rounded-full bg-[#FFF1E5] items-center justify-center mb-6">
              <Ionicons name="flame" size={40} color="#FF9A44" />
            </View>

            <Text className="text-2xl font-black text-slate-900 text-center mb-2">
              Stack Cleared!
            </Text>

            <Text className="text-slate-500 text-center text-sm mb-6 leading-relaxed">
              All 10 matchups decided! Calculating your rewards...
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigateToResults()}
              className="w-full bg-mango-500 py-4 rounded-full items-center justify-center shadow-md"
            >
              <Text className="text-white font-extrabold text-base">
                View Results & Claim
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Card Stack Area */
          <View
            key="forge-card-stack-deck"
            className="relative w-full items-center justify-center"
          >
            {/* Background / Next Card (Deck Effect) */}
            {nextPrompt && !isRevealing && (
              <View
                key={`bg-deck-${nextPrompt.id}`}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  transform: [{ scale: 0.94 }, { translateY: 14 }],
                  opacity: 0.6,
                }}
              >
                <SwipeCard prompt={nextPrompt} isTopCard={false} />
              </View>
            )}

            {/* Active Top Card */}
            {currentPrompt && !isRevealing && (
              <SwipeCard
                key={`top-card-${currentPrompt.id}`}
                ref={topCardRef}
                prompt={currentPrompt}
                onSwipe={handleCardSwiped}
                onTimeout={handleCardTimeoutFinished}
                isTopCard={true}
                shotClockText={formattedTime}
                shotClockThreshold={threshold}
              />
            )}

            {/* The Reveal: Community Consensus Overlay (~800ms) */}
            {isRevealing && activeReveal && (
              <Animated.View
                key="consensus-reveal-overlay"
                style={[
                  overlayAnimatedStyle,
                  {
                    position: 'absolute',
                    zIndex: 50,
                    width: '90%',
                    maxWidth: 340,
                  },
                ]}
                className={`bg-white rounded-[32px] p-8 items-center shadow-2xl border-2 ${
                  activeReveal.agreedWithMajority
                    ? 'border-emerald-400'
                    : 'border-peach-400'
                }`}
              >
                <View
                  className={`w-20 h-20 rounded-full items-center justify-center mb-4 ${
                    activeReveal.agreedWithMajority ? 'bg-emerald-50' : 'bg-[#FFF1E5]'
                  }`}
                >
                  <Ionicons
                    name={activeReveal.agreedWithMajority ? 'checkmark-circle' : 'flame'}
                    size={46}
                    color={activeReveal.agreedWithMajority ? '#10B981' : '#FF9A44'}
                  />
                </View>

                <Text className="text-3xl font-black text-slate-900 tracking-tight text-center">
                  {activeReveal.consensusPercentage}%{' '}
                  {activeReveal.agreedWithMajority ? 'Agreed!' : 'Disagreed'}
                </Text>

                <Text
                  className={`text-xs font-bold uppercase tracking-wider text-center mt-2 ${
                    activeReveal.agreedWithMajority ? 'text-emerald-600' : 'text-mango-600'
                  }`}
                >
                  {activeReveal.agreedWithMajority
                    ? 'You matched the community majority!'
                    : 'Rebel instinct logged against the crowd'}
                </Text>
              </Animated.View>
            )}
          </View>
        )}
      </View>

      {/* Quality Voting Bar (Rendered when active card is a Community Card - Aligned with Thumb Controls below) */}
      {!isCompleted && isCurrentCardCommunity && !isRevealing && (
        <View className="flex-row items-center justify-center mb-1">
          {/* Left: Trash (matches Red X below) */}
          <TouchableOpacity
            testID="quality-vote-trash"
            onPress={() => handleToggleQualityVote('trash')}
            activeOpacity={0.75}
            style={{
              flexShrink: 0,
              backgroundColor: selectedQualityVote === 'trash' ? '#E11D48' : '#FFFFFF',
              borderColor: selectedQualityVote === 'trash' ? '#BE123C' : '#E2E8F0',
              borderWidth: 1,
              borderRadius: 9999,
              paddingHorizontal: 14,
              paddingVertical: 7,
              marginRight: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 13, marginRight: 5 }}>🗑️</Text>
            <Text
              numberOfLines={1}
              style={{
                color: selectedQualityVote === 'trash' ? '#FFFFFF' : '#334155',
                fontSize: 12,
                fontWeight: '800',
                includeFontPadding: false,
              }}
            >
              Trash{' '}
            </Text>
          </TouchableOpacity>

          {/* Right: Fire (matches Green Check below) */}
          <TouchableOpacity
            testID="quality-vote-fire"
            onPress={() => handleToggleQualityVote('up')}
            activeOpacity={0.75}
            style={{
              flexShrink: 0,
              backgroundColor: selectedQualityVote === 'up' ? '#F59E0B' : '#FFFFFF',
              borderColor: selectedQualityVote === 'up' ? '#D97706' : '#E2E8F0',
              borderWidth: 1,
              borderRadius: 9999,
              paddingHorizontal: 14,
              paddingVertical: 7,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 13, marginRight: 5 }}>🔥</Text>
            <Text
              numberOfLines={1}
              style={{
                color: selectedQualityVote === 'up' ? '#FFFFFF' : '#334155',
                fontSize: 12,
                fontWeight: '800',
                includeFontPadding: false,
              }}
            >
              Fire{' '}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom Controls Area (Large Circular Buttons) */}
      {!isCompleted ? (
        <View
          key="forge-active-controls"
          className="flex-row items-center justify-center space-x-8 px-6 pb-4 pt-2"
        >
          {/* Disagree / Left Swipe Button (Red X) */}
          <TouchableOpacity
            testID="swipe-left-button"
            activeOpacity={0.8}
            disabled={isRevealing || isTimingOut}
            onPress={() => handleButtonSwipe('left')}
            className={`w-16 h-16 rounded-full bg-white shadow-xl items-center justify-center border-2 border-rose-100 active:scale-95 mx-4 ${
              isRevealing || isTimingOut ? 'opacity-40' : 'opacity-100'
            }`}
          >
            <Ionicons name="close" size={32} color="#F43F5E" />
          </TouchableOpacity>

          {/* Agree / Right Swipe Button (Green Check) */}
          <TouchableOpacity
            testID="swipe-right-button"
            activeOpacity={0.8}
            disabled={isRevealing || isTimingOut}
            onPress={() => handleButtonSwipe('right')}
            className={`w-16 h-16 rounded-full bg-white shadow-xl items-center justify-center border-2 border-emerald-100 active:scale-95 mx-4 ${
              isRevealing || isTimingOut ? 'opacity-40' : 'opacity-100'
            }`}
          >
            <Ionicons name="checkmark" size={32} color="#10B981" />
          </TouchableOpacity>
        </View>
      ) : (
        <View key="forge-completed-spacer" className="h-6" />
      )}
    </SafeAreaView>
  );
};

export default ForgeScreen;
