import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, useIsFocused } from "@react-navigation/native";
import { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { usePrivy } from "@privy-io/expo";
import { RootStackParamList } from "../navigation/types";
import { supabase } from "../lib/supabase";
import { useKamiWallet } from "../hooks/useKamiWallet";
import { useKamiBalance } from "../hooks/useKamiBalance";
import {
  getBorderCosmetic,
  getBannerCosmetic,
  getStampCosmetic,
  CosmeticItem,
} from "../constants/cosmetics";

// Prompt datasets for dynamic trait resolution
import genreClash from "../../assets/categories/tier_01/genre_clash.json";
import ostSoundDesign from "../../assets/categories/tier_01/ost_sound_design.json";
import plotArmor from "../../assets/categories/tier_01/plot_armor.json";
import studioVsStudio from "../../assets/categories/tier_01/studio_vs_studio.json";
import theAdaptationTest from "../../assets/categories/tier_01/the_adaptation_test.json";
import verseVsVerse from "../../assets/categories/tier_01/verse_vs_verse.json";
import villainJustification from "../../assets/categories/tier_01/villain_justification.json";
import waifuHusbandoWars from "../../assets/categories/tier_01/waifu_husbando_wars.json";

export interface ProfileScreenProps
  extends Partial<NativeStackScreenProps<RootStackParamList, "Profile">> { }

const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80";

// Build prompt-to-trait lookup table for 100% dynamic personality matrix calculations
const PROMPTS_MAP: Record<string, any> = {};
const allCategoryDatasets = [
  genreClash,
  ostSoundDesign,
  plotArmor,
  studioVsStudio,
  theAdaptationTest,
  verseVsVerse,
  villainJustification,
  waifuHusbandoWars,
];

allCategoryDatasets.forEach((dataset: any[]) => {
  if (Array.isArray(dataset)) {
    dataset.forEach((p) => {
      if (p?.id) PROMPTS_MAP[p.id] = p;
    });
  }
});

// Format trait slugs (e.g. "scarf_wrapper" -> "🧣 Scarf Wrapper")
const formatTraitTitle = (traitSlug?: string | null): string => {
  if (!traitSlug || traitSlug === "Novice Curator") return "🌱 Novice Curator";

  const emojiMap: Record<string, string> = {
    spiral_warrior: "🔥",
    tearjerker_junkie: "💧",
    kira_worshipper: "🍎",
    love_is_war_strategist: "👑",
    titan_doomer: "⚔️",
    elf_philosopher: "🧝",
    dango_weeper: "🍡",
    diving_club_alcoholic: "🍻",
    bored_hero: "👊",
    true_warrior: "🛡️",
    mad_scientist: "🧪",
    tsundere_loyalist: "💖",
    cyberpsycho_choom: "⚡",
    special_grade_glazer: "👁️",
    speedwagon_foundation_ceo: "💼",
    ainclad_survivor: "🗡️",
    scarf_wrapper: "🧣",
  };

  const emoji = emojiMap[traitSlug] || "⚡";
  const words = traitSlug
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return `${emoji} ${words}`;
};

// Calculate real consecutive days streak from swipe timestamps
const calculateRealStreak = (timestamps: string[]): number => {
  if (!timestamps || timestamps.length === 0) return 0;

  const distinctDays = Array.from(
    new Set(timestamps.map((t) => t.slice(0, 10)))
  ).sort().reverse();

  if (distinctDays.length === 0) return 0;

  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // If the user swiped today or yesterday, the streak is alive
  if (distinctDays[0] === todayStr || distinctDays[0] === yesterdayStr) {
    let streak = 1;
    let checkDate = new Date(distinctDays[0]);

    for (let i = 1; i < distinctDays.length; i++) {
      const expectedPrev = new Date(checkDate.getTime() - 86400000).toISOString().slice(0, 10);
      if (distinctDays[i] === expectedPrev) {
        streak++;
        checkDate = new Date(distinctDays[i]);
      } else {
        break;
      }
    }
    return streak;
  }

  return 0;
};

export const ProfileScreen: React.FC<ProfileScreenProps> = (props) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<any>();
  const isFocused = useIsFocused();
  const { user } = usePrivy();
  const { address: myWalletAddress } = useKamiWallet();

  const routeUserId = route.params?.userId || props.route?.params?.userId;
  const isOwnProfile = !routeUserId || routeUserId === user?.id || routeUserId === myWalletAddress;

  // Profile data states (all initialized to neutral, zero-mock defaults)
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [trustScore, setTrustScore] = useState<number | null>(null);
  const [totalSwipes, setTotalSwipes] = useState<number>(0);
  const [streakDays, setStreakDays] = useState<number>(0);
  const [globalRank, setGlobalRank] = useState<number | null>(null);
  const [curatorScore, setCuratorScore] = useState<number | null>(null);
  const [lifetimeEarned, setLifetimeEarned] = useState<number>(0);
  const [promptsForged, setPromptsForged] = useState<number>(0);
  const [creatorSwipesReceived, setCreatorSwipesReceived] = useState<number>(0);
  const [forgedCards, setForgedCards] = useState<any[]>([]);
  const [dominantTrait, setDominantTrait] = useState<string>("🌱 Novice Curator");
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live on-chain balance for the active wallet
  const activeWallet = isOwnProfile ? myWalletAddress : profile?.wallet_address;
  const { formatted: onChainFormatted, balance: onChainNum } = useKamiBalance(activeWallet);

  const fetchProfileData = useCallback(async () => {
    try {
      setIsLoading(true);

      // 1. Resolve User Record & Dynamic Ranking from curator_leaderboard
      let leaderboardData: any = null;

      if (routeUserId) {
        // Query specific requested user (by id or wallet address)
        const { data } = await supabase
          .from("curator_leaderboard")
          .select("*")
          .or(`id.eq.${routeUserId},wallet_address.eq.${routeUserId}`)
          .maybeSingle();
        leaderboardData = data;
      } else {
        // Query logged-in user with robust multi-column matching
        const conditions: string[] = [];
        if (user?.id) conditions.push(`id.eq.${user.id}`);
        if (myWalletAddress) conditions.push(`wallet_address.eq.${myWalletAddress}`);
        if (user?.id) conditions.push(`wallet_address.eq.${user.id}`);

        if (conditions.length > 0) {
          const { data } = await supabase
            .from("curator_leaderboard")
            .select("*")
            .or(conditions.join(","))
            .maybeSingle();
          leaderboardData = data;
        }
      }

      let userData = leaderboardData;
      if (!userData) {
        const { data } = await supabase
          .from("users")
          .select("*")
          .or(routeUserId ? `id.eq.${routeUserId},wallet_address.eq.${routeUserId}` : `id.eq.${user?.id || "none"}`)
          .maybeSingle();
        userData = data;
      }

      // If leaderboardData was not resolved, fallback query by resolved user id
      if (!leaderboardData && userData?.id) {
        const { data: rankLookup } = await supabase
          .from("curator_leaderboard")
          .select("*")
          .eq("id", userData.id)
          .maybeSingle();
        if (rankLookup) {
          leaderboardData = rankLookup;
        }
      }

      setProfile(userData);
      setGlobalRank(leaderboardData?.global_rank ?? null);
      setCuratorScore(leaderboardData?.curator_score ?? null);
      setLifetimeEarned(Number(userData?.lifetime_earned_kami ?? 0));
      setPromptsForged(Number(userData?.prompts_forged ?? 0));
      setCreatorSwipesReceived(Number(userData?.creator_swipes_received ?? 0));

      const targetLookupId = userData?.id || routeUserId || user?.id;

      if (targetLookupId) {
        // 2. Fetch User Swipes Ledger
        const { data: swipesData } = await supabase
          .from("swipes")
          .select("agreed_with_consensus, created_at, prompt_id, swipe_direction")
          .eq("user_id", targetLookupId)
          .order("created_at", { ascending: false });

        const swipes = swipesData || [];
        const realSwipesCount = userData?.total_swipes ?? swipes.length;
        setTotalSwipes(realSwipesCount);

        // 3. Dynamic Consensus Trust Score
        if (swipes.length > 0) {
          const agreed = swipes.filter((s) => s.agreed_with_consensus).length;
          const pct = Math.round((agreed / swipes.length) * 100);
          setTrustScore(pct);
        } else {
          setTrustScore(null);
        }

        // 4. Dynamic Streak Calculation
        const realStreak = calculateRealStreak(swipes.map((s) => s.created_at));
        setStreakDays(realStreak);

        // 5. Dynamic Personality Matrix / Dominant Trait
        if (userData?.dominant_trait && userData.dominant_trait !== "Novice Curator") {
          setDominantTrait(userData.dominant_trait);
        } else if (swipes.length > 0) {
          // Compute most frequent trait from actual swiped prompts
          const traitCounts: Record<string, number> = {};
          swipes.forEach((s) => {
            const p = PROMPTS_MAP[s.prompt_id];
            if (p?.traits) {
              const traitKey = s.swipe_direction === "left" ? p.traits.swipe_left : p.traits.swipe_right;
              if (traitKey) {
                traitCounts[traitKey] = (traitCounts[traitKey] || 0) + 1;
              }
            }
          });
          const sortedTraits = Object.entries(traitCounts).sort((a, b) => b[1] - a[1]);
          if (sortedTraits.length > 0) {
            setDominantTrait(formatTraitTitle(sortedTraits[0][0]));
          } else {
            setDominantTrait("🌱 Novice Curator");
          }
        } else {
          setDominantTrait("🌱 Novice Curator");
        }

        // 6. Global Rank & Curator Score resolved from curator_leaderboard view
        if (leaderboardData?.global_rank !== undefined && leaderboardData?.global_rank !== null) {
          setGlobalRank(leaderboardData.global_rank);
          setCuratorScore(leaderboardData.curator_score);
          setLifetimeEarned(Number(leaderboardData.lifetime_earned_kami ?? 0));
        }

        // 7. Fetch user's forged prompts from community_prompts
        try {
          const { data: userPrompts } = await supabase
            .from("community_prompts")
            .select("*")
            .eq("author_id", targetLookupId)
            .order("created_at", { ascending: false })
            .limit(3);

          setForgedCards(userPrompts || []);
        } catch (promptErr) {
          console.warn("Failed to fetch user forged prompts:", promptErr);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch dynamic profile in ProfileScreen:", err);
    } finally {
      setIsLoading(false);
    }
  }, [routeUserId, user?.id, myWalletAddress]);

  useEffect(() => {
    if (isFocused) {
      fetchProfileData();
    }
  }, [isFocused, fetchProfileData]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleCopyWalletAddress = async (addr?: string | null) => {
    if (!addr) return;
    await Clipboard.setStringAsync(addr);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });

    setShowCopiedToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setShowCopiedToast(false);
    }, 2000);
  };

  const handleNavigateEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    navigation.navigate("EditProfile");
  };

  const handleChallengeUser = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    const targetName = profile?.username ? `@${profile.username}` : "this curator";
    Alert.alert(
      "Async Social Challenge",
      `Challenge invitation sent to ${targetName}! Direct 1v1 Hot-Take Showdowns will unlock in the Social Season.`,
      [{ text: "Awesome", style: "default" }]
    );
  };

  const handleNavigateShop = (_slotCategory: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    navigation.navigate("Main" as any, { screen: "Shop" });
  };

  const formatAddress = (addr?: string | null) => {
    if (!addr) return "No Wallet Linked";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Resolve equipped cosmetics from database
  const bannerCosmetic: CosmeticItem = getBannerCosmetic(profile?.equipped_banner);
  const borderCosmetic: CosmeticItem = getBorderCosmetic(profile?.equipped_border);
  const stampCosmetic: CosmeticItem = getStampCosmetic(profile?.equipped_stamp);

  const bannerColors: [string, string] = bannerCosmetic.bannerColors || ["#FF9A44", "#FFD8B5"];

  // Display earnings/balance: prioritize on-chain balance, fallback to database balance
  const displayEarnings =
    onChainNum > 0
      ? `${onChainFormatted} $KAMI`
      : profile?.kami_balance !== null && profile?.kami_balance !== undefined
        ? `${Number(profile.kami_balance).toFixed(2)} $KAMI`
        : "0.00 $KAMI";

  // Display handle: real username, or real formatted wallet address
  const displayUsername = profile?.username
    ? `@${profile.username}`
    : activeWallet
      ? `@${formatAddress(activeWallet)}`
      : "@Curator";

  // Display bio: real bio or friendly empty indicator
  const displayBio =
    profile?.bio ||
    (isOwnProfile
      ? "No bio set yet. Tap Edit to broadcast your anime instincts."
      : "No bio provided.");

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top", "bottom"]}>
      {/* Top Header Bar */}
      <View className="flex-row items-center justify-between px-6 py-3 border-b border-slate-100 bg-white z-20">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.goBack()}
          className="w-10 h-10 rounded-full bg-slate-50 items-center justify-center border border-slate-100 shadow-sm"
          testID="profile-back-button"
        >
          <Ionicons name="arrow-back" size={20} color="#0F172A" />
        </TouchableOpacity>

        <Text className="text-lg font-black text-slate-900 tracking-tight">
          Curator Passport
        </Text>

        {isOwnProfile ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleNavigateEdit}
            className="flex-row items-center bg-slate-100 px-3.5 py-1.5 rounded-full border border-slate-200/60 active:scale-95"
            testID="profile-edit-button"
          >
            <Ionicons name="create-outline" size={14} color="#0F172A" />
            <Text className="text-slate-900 font-extrabold text-xs ml-1.5">
              Edit
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleChallengeUser}
            className="flex-row items-center bg-mango-500 px-4 py-1.5 rounded-full shadow-sm active:scale-95"
            testID="profile-challenge-button"
          >
            <Ionicons name="flash" size={14} color="#FFFFFF" />
            <Text className="text-white font-black text-xs ml-1.5">
              Challenge
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Floating Copied Toast Pill */}
      {showCopiedToast && (
        <View className="absolute top-16 self-center z-50 bg-slate-900 px-4 py-2 rounded-full flex-row items-center shadow-xl">
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text className="text-white text-xs font-bold ml-2">
            Address copied to clipboard!
          </Text>
        </View>
      )}

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF9A44" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          className="flex-1"
        >
          {/* Section 1: Hero Banner & Avatar */}
          <View className="relative">
            {/* Wide Banner Area */}
            <View className="h-36 w-full overflow-hidden rounded-b-[32px] shadow-sm">
              <Svg width="100%" height="100%">
                <Defs>
                  <LinearGradient id="bannerGrad" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={bannerColors[0]} />
                    <Stop offset="1" stopColor={bannerColors[1]} />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#bannerGrad)" />
              </Svg>
            </View>

            {/* Overlapping Avatar with Cosmetic Border */}
            <View className="items-center -mt-12">
              <View
                style={{
                  borderColor: borderCosmetic.borderColor || "#E2E8F0",
                  borderWidth: borderCosmetic.id === "default" ? 3 : 4,
                }}
                className="w-24 h-24 rounded-full bg-white items-center justify-center shadow-md p-0.5"
              >
                <Image
                  source={{ uri: profile?.avatar_url || DEFAULT_AVATAR }}
                  className="w-full h-full rounded-full bg-peach-300"
                  testID="profile-avatar"
                />
              </View>
            </View>
          </View>

          {/* Section 2: Identity & Personality Matrix */}
          <View className="items-center px-6 mt-3">
            {/* Bold Handle */}
            <Text
              numberOfLines={1}
              className="text-2xl font-black text-slate-900 tracking-tight"
              testID="profile-username"
            >
              {displayUsername}
            </Text>

            {/* Wallet Address Clickable Pill */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handleCopyWalletAddress(activeWallet)}
              className="flex-row items-center bg-white px-3 py-1 rounded-full border border-slate-200 shadow-xs mt-1.5"
              testID="profile-wallet-pill"
            >
              <Ionicons name="wallet-outline" size={13} color="#64748B" />
              <Text className="text-xs text-slate-600 font-bold ml-1.5">
                {formatAddress(activeWallet)}
              </Text>
              <Ionicons name="copy-outline" size={12} color="#94A3B8" className="ml-1" />
            </TouchableOpacity>

            {/* Otaku Title Badge (Personality Matrix) */}
            <View className="bg-amber-50 border border-amber-200/80 px-3.5 py-1.5 rounded-full flex-row items-center shadow-xs mt-3">
              <Text style={{ includeFontPadding: false, lineHeight: 16 }} className="text-amber-800 font-extrabold text-xs tracking-wide">
                {dominantTrait}
              </Text>
            </View>

            {/* Bio Text */}
            <Text className="text-slate-600 text-sm text-center mt-3 px-4 leading-relaxed font-medium">
              {displayBio}
            </Text>
          </View>

          {/* Section 3: Curation Stats Bento Grid */}
          <View className="px-6 mt-6">
            <Text className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 px-1">
              Curator Stats
            </Text>

            {/* 2x2 Bento Grid */}
            <View className="flex-row flex-wrap justify-between gap-y-3">
              {/* Card 1: Consensus Trust Score */}
              <View className="w-[48%] bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-[11px] font-extrabold text-slate-400 uppercase">
                    Consensus
                  </Text>
                  <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                </View>
                <Text className="text-2xl font-black text-slate-900 tracking-tight" style={{ includeFontPadding: false }}>
                  {trustScore !== null ? `${trustScore}%` : "--"}
                </Text>
                <Text
                  numberOfLines={2}
                  style={{ includeFontPadding: false }}
                  className={`text-[10px] font-bold mt-1 ${trustScore !== null && trustScore >= 80
                    ? "text-emerald-600"
                    : trustScore !== null
                      ? "text-slate-500"
                      : "text-slate-400"
                    }`}
                >
                  {trustScore !== null
                    ? trustScore >= 80
                      ? "1.2x Multiplier Active"
                      : "1.0x Base Multiplier"
                    : "No Swipes Yet"}
                </Text>
              </View>

              {/* Card 2: Hot Takes Judged */}
              <View className="w-[48%] bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-[11px] font-extrabold text-slate-400 uppercase">
                    Judged
                  </Text>
                  <Ionicons name="flame" size={16} color="#FF9A44" />
                </View>
                <Text className="text-2xl font-black text-slate-900 tracking-tight" style={{ includeFontPadding: false }}>
                  {totalSwipes}
                </Text>
                <Text className="text-[10px] font-bold text-slate-400 mt-1" style={{ includeFontPadding: false }} numberOfLines={1}>
                  Hot Takes Swiped
                </Text>
              </View>

              {/* Card 3: Daily Streak */}
              <View className="w-[48%] bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-[11px] font-extrabold text-slate-400 uppercase">
                    Streak
                  </Text>
                  <Text className="text-xs">🔥</Text>
                </View>
                <Text className="text-2xl font-black text-slate-900 tracking-tight" style={{ includeFontPadding: false }}>
                  {streakDays} {streakDays === 1 ? "Day" : "Days"}
                </Text>
                <Text className="text-[10px] font-bold text-amber-600 mt-1" style={{ includeFontPadding: false }} numberOfLines={1}>
                  {streakDays > 0 ? "Unbroken Instinct" : "Start Swiping"}
                </Text>
              </View>

              {/* Card 4: Global Rank & Curator Score */}
              <View className="w-[48%] bg-white p-4 rounded-3xl border border-slate-100 shadow-xs" testID="card-global-rank">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-[11px] font-extrabold text-slate-400 uppercase">
                    Global Rank
                  </Text>
                  <Ionicons name="trophy" size={16} color="#F59E0B" />
                </View>
                <Text className="text-2xl font-black text-slate-900 tracking-tight" numberOfLines={1} style={{ includeFontPadding: false }}>
                  {globalRank !== null ? `#${globalRank}` : "--"}
                </Text>
                <Text className="text-[10px] font-bold text-amber-600 mt-1" numberOfLines={2} style={{ includeFontPadding: false }}>
                  {curatorScore !== null
                    ? `${curatorScore.toLocaleString()} Pts • ${lifetimeEarned.toFixed(2)} $KAMI`
                    : `${displayEarnings} Earned`}
                </Text>
              </View>
            </View>
          </View>

          {/* Section 4: Equipped Loadout Showcase */}
          <View className="px-6 mt-6">
            <View className="flex-row items-center justify-between mb-3 px-1">
              <Text className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Equipped Loadout
              </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleNavigateShop("All")}
                className="flex-row items-center"
              >
                <Text className="text-xs font-extrabold text-mango-500">Shop Upgrades</Text>
                <Ionicons name="chevron-forward" size={14} color="#FF9A44" />
              </TouchableOpacity>
            </View>

            {/* 3 Horizontal Loadout Slots */}
            <View className="flex-row justify-between">
              {/* Slot 1: Border */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleNavigateShop("Border")}
                className="w-[31%] bg-white p-3 rounded-2xl border border-slate-100 shadow-xs items-center"
                testID="slot-border"
              >
                <View
                  style={{ borderColor: borderCosmetic.borderColor || "#CBD5E1" }}
                  className="w-10 h-10 rounded-full border-2 items-center justify-center bg-slate-50 mb-2"
                >
                  <Ionicons name="ellipse-outline" size={20} color={borderCosmetic.borderColor || "#64748B"} />
                </View>
                <Text className="text-[11px] font-black text-slate-900 text-center" numberOfLines={1}>
                  {borderCosmetic.name}
                </Text>
                <View className="bg-slate-100 px-2.5 py-1 rounded-full mt-1.5 items-center justify-center">
                  <Text style={{ includeFontPadding: false, lineHeight: 13 }} className="text-[9px] font-black text-slate-500 uppercase">
                    {borderCosmetic.rarity}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Slot 2: Banner */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleNavigateShop("Banner")}
                className="w-[31%] bg-white p-3 rounded-2xl border border-slate-100 shadow-xs items-center"
                testID="slot-banner"
              >
                <View className="w-10 h-10 rounded-xl overflow-hidden mb-2 shadow-xs">
                  <Svg width="100%" height="100%">
                    <Defs>
                      <LinearGradient id="slotBannerGrad" x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor={bannerColors[0]} />
                        <Stop offset="1" stopColor={bannerColors[1]} />
                      </LinearGradient>
                    </Defs>
                    <Rect width="100%" height="100%" fill="url(#slotBannerGrad)" />
                  </Svg>
                </View>
                <Text className="text-[11px] font-black text-slate-900 text-center" numberOfLines={1}>
                  {bannerCosmetic.name}
                </Text>
                <View className="bg-slate-100 px-2.5 py-1 rounded-full mt-1.5 items-center justify-center">
                  <Text style={{ includeFontPadding: false, lineHeight: 13 }} className="text-[9px] font-black text-slate-500 uppercase">
                    {bannerCosmetic.rarity}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Slot 3: Stamp */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleNavigateShop("Stamp")}
                className="w-[31%] bg-white p-3 rounded-2xl border border-slate-100 shadow-xs items-center"
                testID="slot-stamp"
              >
                <View className="w-10 h-10 rounded-xl border border-dashed border-slate-300 items-center justify-center bg-slate-50 mb-2">
                  <Ionicons name="sparkles" size={18} color="#FF9A44" />
                </View>
                <Text className="text-[11px] font-black text-slate-900 text-center" numberOfLines={1}>
                  {stampCosmetic.name}
                </Text>
                <View className="bg-slate-100 px-2.5 py-1 rounded-full mt-1.5 items-center justify-center">
                  <Text style={{ includeFontPadding: false, lineHeight: 13 }} className="text-[9px] font-black text-slate-500 uppercase">
                    {stampCosmetic.rarity}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Section 5: Architect Studio */}
          <View className="px-6 mt-6 mb-8">
            <View className="flex-row items-center justify-between mb-3 px-1">
              <View className="flex-row items-center">
                <Text className="text-base mr-1.5">🔨</Text>
                <Text className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Architect Studio
                </Text>
              </View>
              {isOwnProfile && (
                <TouchableOpacity
                  testID="architect-forge-button"
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate("ForgeCreate")}
                  className="flex-row items-center bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/30"
                >
                  <Text className="text-[11px] font-black text-orange-600 mr-1">
                    🔨 Forge New Card
                  </Text>
                  <Ionicons name="chevron-forward" size={12} color="#EA580C" />
                </TouchableOpacity>
              )}
            </View>

            {/* 2 Bento Stats */}
            <View className="flex-row justify-between mb-4">
              {/* Prompts Forged */}
              <View className="w-[48%] bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-[11px] font-extrabold text-slate-400 uppercase">
                    Forged
                  </Text>
                  <Ionicons name="hammer-outline" size={16} color="#FF9A44" />
                </View>
                <Text className="text-2xl font-black text-slate-900 tracking-tight">
                  {promptsForged}
                </Text>
                <Text className="text-[10px] font-bold text-slate-400 mt-1">
                  Cards Created
                </Text>
              </View>

              {/* Community Swipes Received */}
              <View className="w-[48%] bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-[11px] font-extrabold text-slate-400 uppercase">
                    Impact
                  </Text>
                  <Ionicons name="people-outline" size={16} color="#7C3AED" />
                </View>
                <Text className="text-2xl font-black text-slate-900 tracking-tight">
                  {creatorSwipesReceived}
                </Text>
                <Text className="text-[10px] font-bold text-slate-400 mt-1">
                  Swipes Received
                </Text>
              </View>
            </View>

            {/* Forged Cards Showcase */}
            {forgedCards.length > 0 ? (
              <View className="space-y-3">
                {forgedCards.map((card) => {
                  const totalVotes = (card.yes_votes || 0) + (card.no_votes || 0);
                  const yesPct =
                    totalVotes > 0
                      ? Math.round(((card.yes_votes || 0) / totalVotes) * 100)
                      : 50;
                  const noPct = totalVotes > 0 ? 100 - yesPct : 50;
                  const isCanon = card.status === "canon";

                  return (
                    <View
                      key={card.id}
                      testID={`forged-card-${card.id}`}
                      className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs mb-3"
                    >
                      {/* Header: Status Pill & Quality Votes */}
                      <View className="flex-row items-center justify-between mb-2">
                        <View
                          className={`px-3 py-1 rounded-full items-center justify-center ${isCanon ? "bg-emerald-100" : "bg-purple-100"
                            }`}
                        >
                          <Text
                            style={{ includeFontPadding: false, lineHeight: 14 }}
                            className={`text-[10px] font-black uppercase tracking-wider ${isCanon ? "text-emerald-700" : "text-purple-700"
                              }`}
                          >
                            {isCanon ? "⚡ CANON TITAN" : "🔥 IN CRUCIBLE"}
                          </Text>
                        </View>

                        <View className="flex-row items-center">
                          <Text className="text-[11px] text-slate-500 font-semibold">
                            🔥 {card.quality_upvotes || 0}   🗑️ {card.trash_flags || 0}
                          </Text>
                        </View>
                      </View>

                      {/* Question */}
                      <Text className="text-xs font-black text-slate-900 leading-snug mb-2.5">
                        {card.question}
                      </Text>

                      {/* Split Bar */}
                      <View className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex-row mb-1.5">
                        {totalVotes > 0 ? (
                          <>
                            <View
                              style={{ width: `${yesPct}%` }}
                              className="h-full bg-emerald-500"
                            />
                            <View
                              style={{ width: `${noPct}%` }}
                              className="h-full bg-rose-500"
                            />
                          </>
                        ) : (
                          <View className="h-full w-full bg-slate-200" />
                        )}
                      </View>

                      {/* Split Percentages & Swipes Count (Symmetrical & Android font-safe) */}
                      <View className="flex-row items-center justify-between">
                        <Text
                          numberOfLines={1}
                          style={{
                            color: "#059669",
                            fontSize: 10,
                            fontWeight: "700",
                            includeFontPadding: false,
                          }}
                        >
                          {totalVotes > 0 ? `YES ${yesPct}% ` : "YES -- "}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{
                            color: "#94A3B8",
                            fontSize: 10,
                            fontWeight: "600",
                            includeFontPadding: false,
                          }}
                        >
                          {totalVotes > 0
                            ? `${totalVotes} ${totalVotes === 1 ? "swipe" : "swipes"}`
                            : "No swipes yet "}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{
                            color: "#F43F5E",
                            fontSize: 10,
                            fontWeight: "700",
                            includeFontPadding: false,
                          }}
                        >
                          {totalVotes > 0 ? `NO ${noPct}% ` : "NO -- "}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View className="bg-white p-5 rounded-3xl border border-dashed border-slate-200 items-center">
                <Text className="text-2xl mb-1.5">🔨</Text>
                <Text className="text-xs font-black text-slate-800 text-center mb-1">
                  No Prompts Forged Yet
                </Text>
                <Text className="text-[11px] text-slate-400 text-center font-medium leading-relaxed mb-3">
                  Step into The Creator Forge to launch your first hot take into The Crucible arena!
                </Text>
                {isOwnProfile && (
                  <TouchableOpacity
                    onPress={() => navigation.navigate("ForgeCreate")}
                    className="bg-slate-900 px-4 py-2 rounded-full"
                  >
                    <Text className="text-white text-xs font-black">
                      Forge Your First Card
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default ProfileScreen;
