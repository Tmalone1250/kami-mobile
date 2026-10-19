import React, { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { usePrivy } from "@privy-io/expo";
import { HubHeader } from "../components/HubHeader";
import { RouletteModal } from "../components/RouletteModal";
import { RootStackParamList } from "../navigation/types";
import { TierKey } from "../types/forge";
import { useKamiWallet } from "../hooks/useKamiWallet";
import { supabase } from "../lib/supabase";

export interface HubScreenProps {}

export function checkDailySpinsReset(
  resetAtString?: string | null,
  dailySpins?: { [key: string]: number | undefined } | null
): { tier_01: number; tier_02: number; tier_03: number } {
  if (!resetAtString) {
    return { tier_01: 0, tier_02: 0, tier_03: 0 };
  }
  const resetDate = new Date(resetAtString);
  const now = new Date();

  const resetUtcDay = Date.UTC(resetDate.getUTCFullYear(), resetDate.getUTCMonth(), resetDate.getUTCDate());
  const nowUtcDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  if (nowUtcDay > resetUtcDay) {
    return { tier_01: 0, tier_02: 0, tier_03: 0 };
  }

  return {
    tier_01: Number(dailySpins?.tier_01 || 0),
    tier_02: Number(dailySpins?.tier_02 || 0),
    tier_03: Number(dailySpins?.tier_03 || 0),
  };
}

export function getTimeUntilMidnightUtc(): string {
  const now = new Date();
  const nextMidnightUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0)
  );
  const diffMs = Math.max(0, nextMidnightUtc.getTime() - now.getTime());
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

export const HubScreen: React.FC<HubScreenProps> = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const { user } = usePrivy();
  const { address } = useKamiWallet();
  const activeUserId = user?.id || address;

  const [selectedTier, setSelectedTier] = useState<TierKey | null>(null);
  const [isRouletteVisible, setIsRouletteVisible] = useState(false);
  const [isLimitModalVisible, setIsLimitModalVisible] = useState(false);
  const [limitTier, setLimitTier] = useState<TierKey | null>(null);

  const [spinsUsed, setSpinsUsed] = useState<{ [key in TierKey]?: number }>({
    tier_01: 0,
    tier_02: 0,
    tier_03: 0,
  });

  const fetchDailySpins = useCallback(async () => {
    if (!activeUserId) return;
    try {
      const { data, error } = await supabase
        .from("users")
        .select("daily_spins_used, spins_reset_at")
        .eq("id", activeUserId)
        .maybeSingle();

      if (!error && data) {
        const resetCounts = checkDailySpinsReset(data.spins_reset_at, data.daily_spins_used);
        setSpinsUsed(resetCounts);
      }
    } catch (err) {
      console.warn("Failed to fetch daily spins used:", err);
    }
  }, [activeUserId]);

  useEffect(() => {
    if (isFocused) {
      fetchDailySpins();
    }
  }, [isFocused, fetchDailySpins]);

  const getRemainingSpins = (tier: TierKey): number => {
    const used = spinsUsed[tier] ?? 0;
    return Math.max(0, 10 - used);
  };

  const handleSelectTier = (tier: TierKey) => {
    const remaining = getRemainingSpins(tier);
    if (remaining <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setLimitTier(tier);
      setIsLimitModalVisible(true);
      return;
    }

    setSelectedTier(tier);
    setIsRouletteVisible(true);
  };

  const handleCategorySelected = (categorySlug: string) => {
    const tier = selectedTier || "tier_01";
    setIsRouletteVisible(false);

    // Optimistically update local spin count
    setSpinsUsed((prev) => ({
      ...prev,
      [tier]: (prev[tier] ?? 0) + 1,
    }));

    // Atomically increment spins on backend safely preserving all other tiers
    if (activeUserId) {
      Promise.resolve(
        supabase.rpc("consume_daily_spin", {
          p_user_id: activeUserId,
          p_tier: tier,
        })
      )
        .then(({ data, error }: any) => {
          if (!error && data?.daily_spins_used) {
            setSpinsUsed((prev) => ({
              ...prev,
              ...data.daily_spins_used,
            }));
          }
        })
        .catch((err: any) => {
          console.warn("Error calling consume_daily_spin:", err);
        });
    }

    navigation.navigate("Forge", { tier, category: categorySlug });
  };

  const handleOpenCrucible = () => {
    navigation.navigate("Forge", {
      tier: "tier_01",
      category: "The Crucible",
      isCrucibleMode: true,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <HubHeader />

        {/* Title Section */}
        <View className="px-6 mt-4 mb-4">
          <Text className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1">
            Pick your power level.
          </Text>
          <Text className="text-slate-500 text-sm">
            A new challenge. A little more legendary.
          </Text>
        </View>

        {/* Forge Hot Take CTA Banner */}
        <View className="px-6 mb-5">
          <TouchableOpacity
            testID="hub-forge-cta"
            activeOpacity={0.88}
            onPress={() => navigation.navigate("ForgeCreate")}
            className="bg-slate-900 px-4 py-3.5 rounded-3xl border border-slate-800 shadow-sm flex-row items-center justify-between"
          >
            <View className="flex-row items-center flex-1 mr-2">
              <View className="w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-500/30 items-center justify-center mr-2.5 shrink-0">
                <Text className="text-lg">🔨</Text>
              </View>
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text numberOfLines={1} className="text-sm font-black text-white mr-2 shrink-0">
                    Forge a Hot Take
                  </Text>
                  <View
                    style={{ flexShrink: 0 }}
                    className="bg-orange-500/20 px-2 py-0.5 rounded-full border border-orange-500/40 items-center justify-center"
                  >
                    <Text
                      numberOfLines={1}
                      style={{ includeFontPadding: false, lineHeight: 13 }}
                      className="text-[9px] font-black text-orange-400"
                    >
                      1 FREE DAILY
                    </Text>
                  </View>
                </View>
                <Text numberOfLines={1} className="text-xs text-slate-400 font-medium mt-0.5">
                  1 Free Daily • Earn Architect Rank
                </Text>
              </View>
            </View>
            <View className="w-7 h-7 rounded-full bg-slate-800 items-center justify-center shrink-0">
              <Ionicons name="arrow-forward" size={14} color="#FF9A44" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Cards Section */}
        <View className="px-6">
          {/* Card 1: Shonen Jump */}
          <TouchableOpacity
            testID="tier-01-card"
            activeOpacity={0.9}
            onPress={() => handleSelectTier("tier_01")}
            className="bg-white rounded-[32px] p-6 mb-4 shadow-sm border border-slate-50"
          >
            <View className="flex-row justify-between items-start mb-6">
              <View>
                <Text className="text-[10px] text-slate-500 font-bold tracking-wider uppercase mb-1">
                  START YOUR STORY
                </Text>
                <Text className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  Tier 1: Shonen Jump
                </Text>
              </View>
              <View className="w-10 h-10 rounded-full bg-[#FFF1E5] items-center justify-center">
                <Ionicons name="flash-outline" size={20} color="#FF9A44" />
              </View>
            </View>

            <View className="flex-row justify-between items-end">
              <View>
                <Text className="text-base font-bold text-slate-900 mb-1">
                  1.0x Multiplier
                </Text>
                <Text className="text-xs text-slate-400">
                  [ {getRemainingSpins("tier_01")} / 10 Spins Remaining ]
                </Text>
              </View>
              <View className="w-10 h-10 rounded-full bg-[#FFF1E5] items-center justify-center">
                <Ionicons name="arrow-forward" size={20} color="#FF9A44" />
              </View>
            </View>
          </TouchableOpacity>

          {/* Card 2: Cult Classic */}
          <TouchableOpacity
            testID="tier-02-card"
            activeOpacity={0.9}
            onPress={() => handleSelectTier("tier_02")}
            className="bg-white rounded-[32px] p-6 mb-4 border border-peach-300 shadow-sm"
          >
            <View className="flex-row justify-between items-start mb-6">
              <View>
                <Text className="text-[10px] text-slate-500 font-bold tracking-wider uppercase mb-1">
                  FOR THE TRUE FANS
                </Text>
                <Text className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  Tier 2: Cult Classic
                </Text>
              </View>
              <View className="w-10 h-10 rounded-full bg-[#FFF1E5] items-center justify-center">
                <Ionicons name="flame-outline" size={20} color="#FF9A44" />
              </View>
            </View>

            <View className="flex-row justify-between items-end">
              <View>
                <Text className="text-base font-bold text-slate-900 mb-1">
                  1.5x Multiplier
                </Text>
                <Text className="text-xs text-slate-400">
                  [ {getRemainingSpins("tier_02")} / 10 Spins Remaining ]
                </Text>
              </View>
              <View className="w-10 h-10 rounded-full bg-[#FFF1E5] items-center justify-center">
                <Ionicons name="arrow-forward" size={20} color="#FF9A44" />
              </View>
            </View>
          </TouchableOpacity>

          {/* Card 3: Arch-Sage */}
          <TouchableOpacity
            testID="tier-03-card"
            activeOpacity={0.9}
            onPress={() => handleSelectTier("tier_03")}
            className="bg-slate-900 rounded-[32px] p-6 mb-4 shadow-md"
          >
            <View className="flex-row justify-between items-start mb-6">
              <View>
                <Text className="text-[10px] text-mango-400 font-bold tracking-wider uppercase mb-1">
                  LEGENDS ONLY
                </Text>
                <Text className="text-2xl font-extrabold text-mango-400 tracking-tight">
                  Tier 3: Arch-Sage
                </Text>
              </View>
              <View className="w-10 h-10 rounded-full border border-slate-700 items-center justify-center">
                <Ionicons name="ribbon-outline" size={20} color="#FF9A44" />
              </View>
            </View>

            <View className="flex-row justify-between items-end">
              <View>
                <Text className="text-base font-bold text-mango-400 mb-1">
                  3.0x Multiplier
                </Text>
                <Text className="text-xs text-slate-400">
                  [ {getRemainingSpins("tier_03")} / 10 Spins Remaining ]
                </Text>
              </View>
              <View className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center">
                <Ionicons name="arrow-forward" size={20} color="#94A3B8" />
              </View>
            </View>
          </TouchableOpacity>

          {/* Card 4: The Crucible (Community Arena) - 100% Free Play */}
          <TouchableOpacity
            testID="hub-crucible-card"
            activeOpacity={0.9}
            onPress={handleOpenCrucible}
            className="bg-white rounded-[32px] p-6 mb-4 border-2 border-purple-500 shadow-md"
          >
            <View className="flex-row justify-between items-start mb-6">
              <View className="flex-1 mr-2">
                <View className="flex-row items-center mb-1">
                  <Text className="text-[10px] text-purple-600 font-black tracking-wider uppercase mr-2">
                    UGC TESTING GROUNDS
                  </Text>
                  <View className="bg-purple-100 px-2 py-0.5 rounded-full">
                    <Text className="text-[10px] font-black text-purple-700">
                      100% FREE PLAY
                    </Text>
                  </View>
                </View>
                <Text className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  🔥 The Crucible: Community Arena
                </Text>
              </View>
              <View className="w-10 h-10 rounded-full bg-purple-100 items-center justify-center">
                <Ionicons name="flame" size={22} color="#7C3AED" />
              </View>
            </View>

            <View className="flex-row justify-between items-end">
              <View>
                <Text className="text-base font-bold text-purple-700 mb-1">
                  100% Free-Play
                </Text>
                <Text className="text-xs text-slate-400">
                  [ Unlimited Free Play ]
                </Text>
              </View>
              <View className="w-10 h-10 rounded-full bg-purple-100 items-center justify-center">
                <Ionicons name="arrow-forward" size={20} color="#7C3AED" />
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Daily Spin Limit Reached Modal */}
      <Modal
        visible={isLimitModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLimitModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View
            testID="daily-limit-modal"
            className="w-full max-w-[340px] bg-white rounded-[32px] p-6 items-center shadow-2xl border border-slate-100"
          >
            <View className="w-16 h-16 rounded-full bg-amber-50 items-center justify-center mb-4 border border-amber-200">
              <Ionicons name="time-outline" size={32} color="#D97706" />
            </View>

            <Text className="text-xl font-extrabold text-slate-900 text-center mb-1">
              Daily Spin Limit Reached (10/10)
            </Text>
            <Text className="text-xs text-amber-600 font-bold tracking-wider uppercase mb-3 text-center">
              Resets at midnight UTC!
            </Text>

            <Text className="text-slate-500 text-center text-xs leading-relaxed mb-4">
              You have exhausted your 10 daily spins for this tier. Daily limits maintain token sustainability and balanced rewards.
            </Text>

            <View className="bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-2xl mb-5 flex-row items-center justify-center">
              <Ionicons name="hourglass-outline" size={14} color="#64748B" />
              <Text className="text-xs font-bold text-slate-600 ml-1.5">
                Resets in {getTimeUntilMidnightUtc()} (Midnight UTC)
              </Text>
            </View>

            <TouchableOpacity
              testID="limit-play-crucible-button"
              activeOpacity={0.88}
              onPress={() => {
                setIsLimitModalVisible(false);
                handleOpenCrucible();
              }}
              className="w-full bg-purple-600 py-3.5 rounded-full items-center justify-center shadow-md mb-2.5 flex-row"
            >
              <Text className="text-white font-extrabold text-xs uppercase tracking-wider mr-1.5">
                PLAY THE CRUCIBLE (FREE PLAY)
              </Text>
              <Ionicons name="sparkles" size={16} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              testID="limit-dismiss-button"
              activeOpacity={0.7}
              onPress={() => setIsLimitModalVisible(false)}
              className="w-full py-2.5 items-center justify-center"
            >
              <Text className="text-slate-400 font-bold text-xs uppercase tracking-wider">
                Got It
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Dynamic Roulette Modal */}
      {selectedTier && (
        <RouletteModal
          visible={isRouletteVisible}
          tier={selectedTier}
          onClose={() => setIsRouletteVisible(false)}
          onSelectCategory={handleCategorySelected}
        />
      )}
    </SafeAreaView>
  );
};

export default HubScreen;
