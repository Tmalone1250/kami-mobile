import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { usePrivy } from '@privy-io/expo';

import { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { searchAnime, calculatePromptTier, getTierMetadata, AniListSearchResult } from '../lib/anilist';
import { TierKey } from '../types/forge';
import { useKamiWallet } from '../hooks/useKamiWallet';
import { useKamiBalance } from '../hooks/useKamiBalance';

export const CATEGORIES = [
  { slug: 'genre_clash', title: 'Genre Clash' },
  { slug: 'ost_sound_design', title: 'OST & Sound Design' },
  { slug: 'plot_armor', title: 'Plot Armor' },
  { slug: 'studio_vs_studio', title: 'Studio vs. Studio' },
  { slug: 'the_adaptation_test', title: 'The Adaptation Test' },
  { slug: 'verse_vs_verse', title: 'Verse vs Verse' },
  { slug: 'villain_justification', title: 'Villain Justification' },
  { slug: 'waifu_husbando_wars', title: 'Waifu Wars' },
];

export const ForgeCreateScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = usePrivy();
  const { address: walletAddress } = useKamiWallet();
  const { balance: onChainBalance } = useKamiBalance(walletAddress);

  const userId = user?.id || walletAddress || 'anon_user';

  // Cooldown & user data
  const [dbBalance, setDbBalance] = useState<number>(0);
  const [lastFreeForgeAt, setLastFreeForgeAt] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('Architect');
  const [loadingUser, setLoadingUser] = useState<boolean>(true);

  // Form State
  const [selectedAnimeA, setSelectedAnimeA] = useState<AniListSearchResult | null>(null);
  const [selectedAnimeB, setSelectedAnimeB] = useState<AniListSearchResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORIES[0].slug);
  const [question, setQuestion] = useState<string>('');

  // Search State for Anime A
  const [queryA, setQueryA] = useState<string>('');
  const [resultsA, setResultsA] = useState<AniListSearchResult[]>([]);
  const [isSearchingA, setIsSearchingA] = useState<boolean>(false);

  // Search State for Anime B
  const [queryB, setQueryB] = useState<string>('');
  const [resultsB, setResultsB] = useState<AniListSearchResult[]>([]);
  const [isSearchingB, setIsSearchingB] = useState<boolean>(false);

  // Submitting
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Debounce timers
  const timerARef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerBRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch user profile & last_free_forge_at
  const fetchUserData = useCallback(async () => {
    if (!userId || userId === 'anon_user') {
      setLoadingUser(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('users')
        .select('username, kami_balance, last_free_forge_at')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        if (data.username) setUsername(data.username);
        if (data.kami_balance !== null && data.kami_balance !== undefined) {
          setDbBalance(Number(data.kami_balance));
        }
        setLastFreeForgeAt(data.last_free_forge_at);
      }
    } catch (e) {
      console.warn('Error loading user forge profile:', e);
    } finally {
      setLoadingUser(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Free daily check: free if null or > 24 hours ago
  const isFreeForge = useMemo(() => {
    if (!lastFreeForgeAt) return true;
    const lastDate = new Date(lastFreeForgeAt).getTime();
    const now = Date.now();
    const diffHours = (now - lastDate) / (1000 * 60 * 60);
    return diffHours >= 24;
  }, [lastFreeForgeAt]);

  const countdownText = useMemo(() => {
    if (isFreeForge || !lastFreeForgeAt) return null;
    const lastDate = new Date(lastFreeForgeAt).getTime();
    const unlockTime = lastDate + 24 * 60 * 60 * 1000;
    const diffMs = unlockTime - Date.now();
    if (diffMs <= 0) return null;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `Next free in ${hours}h ${mins}m`;
  }, [isFreeForge, lastFreeForgeAt]);

  // Debounced search for Anime A (300ms, minimum 2 chars)
  const handleQueryAChange = (text: string) => {
    setQueryA(text);
    if (timerARef.current) clearTimeout(timerARef.current);

    if (text.trim().length < 2) {
      setResultsA([]);
      setIsSearchingA(false);
      return;
    }

    setIsSearchingA(true);
    timerARef.current = setTimeout(async () => {
      const results = await searchAnime(text);
      setResultsA(results);
      setIsSearchingA(false);
    }, 300);
  };

  // Debounced search for Anime B (300ms, minimum 2 chars)
  const handleQueryBChange = (text: string) => {
    setQueryB(text);
    if (timerBRef.current) clearTimeout(timerBRef.current);

    if (text.trim().length < 2) {
      setResultsB([]);
      setIsSearchingB(false);
      return;
    }

    setIsSearchingB(true);
    timerBRef.current = setTimeout(async () => {
      const results = await searchAnime(text);
      setResultsB(results);
      setIsSearchingB(false);
    }, 300);
  };

  // Auto-calculated Tier & Mean Popularity
  const calculatedTier = useMemo<TierKey | null>(() => {
    if (!selectedAnimeA || !selectedAnimeB) return null;
    return calculatePromptTier(selectedAnimeA.popularity, selectedAnimeB.popularity);
  }, [selectedAnimeA, selectedAnimeB]);

  const meanPopularity = useMemo<number>(() => {
    if (!selectedAnimeA || !selectedAnimeB) return 0;
    return Math.round((selectedAnimeA.popularity + selectedAnimeB.popularity) / 2);
  }, [selectedAnimeA, selectedAnimeB]);

  // Guardrail Validations
  const trimmedQuestion = question.trim();
  const isAnimeSelected = !!(selectedAnimeA && selectedAnimeB);
  const isLengthValid = trimmedQuestion.length >= 25 && trimmedQuestion.length <= 140;
  const isEndsWithQuestion = trimmedQuestion.endsWith('?');
  const isNotWhichOrWho = !/^(which|who)\s/i.test(trimmedQuestion);
  const isNotOrSeparator = !/\bor\b/i.test(trimmedQuestion);
  const isStrictYesNo = isNotWhichOrWho && isNotOrSeparator;

  const isFormValid = isAnimeSelected && isLengthValid && isEndsWithQuestion && isStrictYesNo;

  // Total balance: onChain or db
  const effectiveBalance = onChainBalance ? Number(onChainBalance) : dbBalance;

  // Submission handler
  const handleForgeSubmit = async () => {
    if (!isFormValid || !selectedAnimeA || !selectedAnimeB || !calculatedTier) return;

    if (!isFreeForge && effectiveBalance < 50) {
      Alert.alert(
        'Insufficient $KAMI',
        'Overclocking requires 50 $KAMI. Complete daily hot takes or transfer $KAMI to overclock.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('submit_community_prompt', {
        p_author_id: userId,
        p_author_username: username,
        p_tier: calculatedTier,
        p_category: selectedCategory,
        p_anime_a: selectedAnimeA.title,
        p_anime_b: selectedAnimeB.title,
        p_popularity_a: selectedAnimeA.popularity,
        p_popularity_b: selectedAnimeB.popularity,
        p_mean_popularity: meanPopularity,
        p_image_a_url: selectedAnimeA.coverImage || selectedAnimeA.bannerImage || '',
        p_image_b_url: selectedAnimeB.coverImage || selectedAnimeB.bannerImage || '',
        p_question: trimmedQuestion,
        p_trait_right: 'HELL YES',
        p_trait_left: 'NOPE',
      });

      if (error) {
        throw error;
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        '🔥 Card Forged!',
        'Your hot take has entered The Crucible arena. Community swipers will now vote to crown it Canon!',
        [
          {
            text: 'View Profile',
            onPress: () => navigation.navigate('Profile', { userId }),
          },
          {
            text: 'Back to Hub',
            onPress: () => navigation.goBack(),
            style: 'cancel',
          },
        ]
      );
    } catch (err: any) {
      console.error('Failed to forge prompt:', err);
      Alert.alert('Forge Failed', err.message || 'Could not forge card. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Top Header */}
        <View className="px-5 py-3 flex-row items-center justify-between border-b border-slate-100 bg-white">
          <TouchableOpacity
            testID="forge-back-button"
            onPress={() => navigation.goBack()}
            className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center"
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color="#1E293B" />
          </TouchableOpacity>

          <View className="items-center">
            <Text className="text-lg font-black text-slate-900 tracking-tight">
              The Creator Forge
            </Text>
            <Text className="text-xs font-semibold text-slate-500">
              Prompt Architect Studio
            </Text>
          </View>

          {/* Cooldown Status Badge */}
          <View
            className={`px-2.5 py-1 rounded-full flex-row items-center ${isFreeForge ? 'bg-emerald-100' : 'bg-purple-100'
              }`}
          >
            <Text
              className={`text-[11px] font-black ${isFreeForge ? 'text-emerald-700' : 'text-purple-700'
                }`}
            >
              {isFreeForge ? '🔥 FREE' : '⚙️ 50 $KAMI'}
            </Text>
          </View>
        </View>

        <ScrollView
          className="flex-1 px-5 pt-4"
          contentContainerStyle={{ paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Overclock Notice if on cooldown */}
          {!isFreeForge && (
            <View className="mb-4 p-3.5 rounded-2xl bg-purple-50 border border-purple-200 flex-row items-center justify-between">
              <View className="flex-row items-center flex-1 mr-2">
                <Ionicons name="time-outline" size={18} color="#7C3AED" />
                <View className="ml-2 flex-1">
                  <Text className="text-xs font-bold text-purple-900">
                    Free Daily Used
                  </Text>
                  <Text className="text-[11px] text-purple-600 font-medium">
                    {countdownText || '24h cooldown in progress'}
                  </Text>
                </View>
              </View>
              <View className="bg-purple-600 px-2.5 py-1 rounded-lg">
                <Text className="text-[11px] font-black text-white">
                  50 $KAMI
                </Text>
              </View>
            </View>
          )}

          {/* SECTION 1: MATCHUP SELECTION */}
          <View className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm mb-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-xs font-black text-slate-400 uppercase tracking-wider">
                1. Select Anime for Matchup
              </Text>
            </View>

            {/* Anime A Input */}
            <View className="mb-3">
              <Text className="text-xs font-bold text-slate-700 mb-1.5">
                Anime A (Top Half of Card)
              </Text>
              {selectedAnimeA ? (
                <View className="flex-row items-center justify-between p-2.5 rounded-2xl bg-orange-50 border border-orange-200">
                  <View className="flex-row items-center flex-1 mr-2">
                    {selectedAnimeA.coverImage ? (
                      <Image
                        source={{ uri: selectedAnimeA.coverImage }}
                        className="w-10 h-10 rounded-xl mr-3 bg-slate-200"
                      />
                    ) : (
                      <View className="w-10 h-10 rounded-xl mr-3 bg-slate-200 items-center justify-center">
                        <Ionicons name="image-outline" size={16} color="#64748B" />
                      </View>
                    )}
                    <View className="flex-1">
                      <Text
                        className="text-xs font-black text-slate-900"
                        numberOfLines={1}
                      >
                        {selectedAnimeA.title}
                      </Text>
                      <Text className="text-[10px] font-semibold text-orange-600">
                        Pop: {selectedAnimeA.popularity.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    testID="clear-anime-a"
                    onPress={() => setSelectedAnimeA(null)}
                    className="p-1.5 rounded-full bg-orange-100"
                  >
                    <Ionicons name="close" size={16} color="#EA580C" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2">
                    <Ionicons name="search" size={16} color="#94A3B8" />
                    <TextInput
                      testID="anime-a-input"
                      placeholder="Search e.g. 'Attack on Titan'..."
                      placeholderTextColor="#94A3B8"
                      value={queryA}
                      onChangeText={handleQueryAChange}
                      className="flex-1 ml-2 text-xs font-semibold text-slate-900"
                      autoCorrect={false}
                    />
                    {isSearchingA && (
                      <ActivityIndicator size="small" color="#FF9A44" />
                    )}
                  </View>

                  {/* Dropdown Results A */}
                  {resultsA.length > 0 && (
                    <View className="mt-2 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                      {resultsA.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          testID={`select-anime-a-${item.id}`}
                          onPress={() => {
                            setSelectedAnimeA(item);
                            setResultsA([]);
                            setQueryA('');
                          }}
                          className="flex-row items-center p-2.5 border-b border-slate-100 active:bg-slate-50"
                        >
                          <Image
                            source={{ uri: item.coverImage }}
                            className="w-8 h-8 rounded-lg mr-2 bg-slate-200"
                          />
                          <View className="flex-1">
                            <Text
                              className="text-xs font-bold text-slate-900"
                              numberOfLines={1}
                            >
                              {item.title}
                            </Text>
                            <Text className="text-[10px] text-slate-400 font-semibold">
                              Pop: {item.popularity.toLocaleString()}
                            </Text>
                          </View>
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={16}
                            color="#CBD5E1"
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Anime B Input */}
            <View className="mb-3">
              <Text className="text-xs font-bold text-slate-700 mb-1.5">
                Anime B (Bottom Half of Card)
              </Text>
              {selectedAnimeB ? (
                <View className="flex-row items-center justify-between p-2.5 rounded-2xl bg-orange-50 border border-orange-200">
                  <View className="flex-row items-center flex-1 mr-2">
                    {selectedAnimeB.coverImage ? (
                      <Image
                        source={{ uri: selectedAnimeB.coverImage }}
                        className="w-10 h-10 rounded-xl mr-3 bg-slate-200"
                      />
                    ) : (
                      <View className="w-10 h-10 rounded-xl mr-3 bg-slate-200 items-center justify-center">
                        <Ionicons name="image-outline" size={16} color="#64748B" />
                      </View>
                    )}
                    <View className="flex-1">
                      <Text
                        className="text-xs font-black text-slate-900"
                        numberOfLines={1}
                      >
                        {selectedAnimeB.title}
                      </Text>
                      <Text className="text-[10px] font-semibold text-orange-600">
                        Pop: {selectedAnimeB.popularity.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    testID="clear-anime-b"
                    onPress={() => setSelectedAnimeB(null)}
                    className="p-1.5 rounded-full bg-orange-100"
                  >
                    <Ionicons name="close" size={16} color="#EA580C" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2">
                    <Ionicons name="search" size={16} color="#94A3B8" />
                    <TextInput
                      testID="anime-b-input"
                      placeholder="Search e.g. 'Code Geass'..."
                      placeholderTextColor="#94A3B8"
                      value={queryB}
                      onChangeText={handleQueryBChange}
                      className="flex-1 ml-2 text-xs font-semibold text-slate-900"
                      autoCorrect={false}
                    />
                    {isSearchingB && (
                      <ActivityIndicator size="small" color="#FF9A44" />
                    )}
                  </View>

                  {/* Dropdown Results B */}
                  {resultsB.length > 0 && (
                    <View className="mt-2 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                      {resultsB.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          testID={`select-anime-b-${item.id}`}
                          onPress={() => {
                            setSelectedAnimeB(item);
                            setResultsB([]);
                            setQueryB('');
                          }}
                          className="flex-row items-center p-2.5 border-b border-slate-100 active:bg-slate-50"
                        >
                          <Image
                            source={{ uri: item.coverImage }}
                            className="w-8 h-8 rounded-lg mr-2 bg-slate-200"
                          />
                          <View className="flex-1">
                            <Text
                              className="text-xs font-bold text-slate-900"
                              numberOfLines={1}
                            >
                              {item.title}
                            </Text>
                            <Text className="text-[10px] text-slate-400 font-semibold">
                              Pop: {item.popularity.toLocaleString()}
                            </Text>
                          </View>
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={16}
                            color="#CBD5E1"
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Dynamic Calculated Tier Banner */}
            {calculatedTier && (
              <View className="mt-1 p-3 rounded-2xl bg-slate-900 border border-slate-800 flex-row items-center justify-between">
                <View>
                  <Text className="text-[11px] font-bold text-amber-400 uppercase tracking-wide">
                    ⚡ Auto-Calculated Tier
                  </Text>
                  <Text className="text-xs font-black text-white mt-0.5">
                    {getTierMetadata(calculatedTier).title}
                  </Text>
                  <Text className="text-[10px] text-slate-400 font-medium">
                    Mean Popularity: {meanPopularity.toLocaleString()}
                  </Text>
                </View>
                <View className="bg-amber-400/20 px-2.5 py-1 rounded-xl border border-amber-400/30">
                  <Text className="text-xs font-black text-amber-300">
                    {getTierMetadata(calculatedTier).multiplier}x
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* SECTION 2: CATEGORY & HOT TAKE QUESTION */}
          <View className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm mb-4">
            <Text className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2.5">
              2. Category & Yes/No Hot Take
            </Text>

            {/* Category selector (Wrapped Chip Grid - prevents Android horizontal ScrollView text clipping) */}
            <View className="flex-row flex-wrap mb-3">
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.slug;
                return (
                  <TouchableOpacity
                    key={cat.slug}
                    testID={`category-${cat.slug}`}
                    onPress={() => setSelectedCategory(cat.slug)}
                    activeOpacity={0.75}
                    style={{
                      flexShrink: 0,
                      backgroundColor: isSelected ? '#0F172A' : '#F8FAFC' ,
                      borderColor: isSelected ? '#0F172A' : '#E2E8F0' ,
                      borderWidth: 1,
                      borderRadius: 9999,
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      marginRight: 8,
                      marginBottom: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        color: isSelected ? '#FFFFFF' : '#475569',
                        fontSize: 12,
                        fontWeight: '700',
                        includeFontPadding: false,
                      }}
                    >
                      {cat.title}{' '}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Question Input */}
            <View className="bg-slate-50 border border-slate-200 rounded-2xl p-3 mb-2">
              <TextInput
                testID="question-input"
                placeholder="Does Okarin watching Mayuri die infinitely hit way harder than Kousei reading Kaori's final letter?"
                placeholderTextColor="#94A3B8"
                value={question}
                onChangeText={setQuestion}
                multiline
                numberOfLines={3}
                maxLength={140}
                className="text-xs font-medium text-slate-900 min-h-[60px]"
                style={{ textAlignVertical: 'top' }}
              />
              <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-slate-200">
                <Text className="text-[10px] text-slate-400 font-semibold">
                  Strict Yes/No comparative question
                </Text>
                <Text
                  testID="char-counter"
                  className={`text-[10px] font-bold ${isLengthValid ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                >
                  {trimmedQuestion.length} / 140
                </Text>
              </View>
            </View>

            {/* Real-time Guardrail Checklist */}
            <View className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <Text className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                Guardrail Checklist
              </Text>
              <View className="space-y-1">
                <View className="flex-row items-center">
                  <Text className="text-xs mr-2">
                    {isAnimeSelected ? '✅' : '⚪'}
                  </Text>
                  <Text
                    className={`text-xs font-semibold ${isAnimeSelected ? 'text-slate-900' : 'text-slate-400'
                      }`}
                  >
                    Both anime selected from AniList
                  </Text>
                </View>

                <View className="flex-row items-center">
                  <Text className="text-xs mr-2">
                    {isLengthValid ? '✅' : '⚪'}
                  </Text>
                  <Text
                    className={`text-xs font-semibold ${isLengthValid ? 'text-slate-900' : 'text-slate-400'
                      }`}
                  >
                    25–140 characters ({trimmedQuestion.length} chars)
                  </Text>
                </View>

                <View className="flex-row items-center">
                  <Text className="text-xs mr-2">
                    {isEndsWithQuestion ? '✅' : '⚪'}
                  </Text>
                  <Text
                    className={`text-xs font-semibold ${isEndsWithQuestion ? 'text-slate-900' : 'text-slate-400'
                      }`}
                  >
                    Ends with '?'
                  </Text>
                </View>

                <View className="flex-row items-center">
                  <Text className="text-xs mr-2">
                    {isStrictYesNo ? '✅' : '⚪'}
                  </Text>
                  <Text
                    className={`text-xs font-semibold ${isStrictYesNo ? 'text-slate-900' : 'text-slate-400'
                      }`}
                  >
                    Strict Yes/No (No 'Which/Who' or ' or ')
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* SECTION 3: LIVE MINI SPLIT-CARD PREVIEW */}
          <View className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm mb-6">
            <Text className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2.5">
              3. Live Card Preview (Mini Split-Card)
            </Text>

            <View className="h-56 rounded-3xl overflow-hidden border-2 border-slate-800 bg-slate-950 relative shadow-lg">
              {/* Top Half: Anime A */}
              <View className="flex-1 relative overflow-hidden bg-slate-900 border-b border-black/40">
                {selectedAnimeA?.bannerImage || selectedAnimeA?.coverImage ? (
                  <Image
                    source={{
                      uri: selectedAnimeA.bannerImage || selectedAnimeA.coverImage,
                    }}
                    className="absolute inset-0 w-full h-full opacity-70"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="flex-1 items-center justify-center bg-slate-800/80">
                    <Text className="text-[11px] font-bold text-slate-400">
                      Select Anime A
                    </Text>
                  </View>
                )}
                {/* Anime A Pill */}
                {selectedAnimeA && (
                  <View className="absolute top-2.5 left-2.5 bg-black/75 px-2.5 py-1 rounded-full border border-white/20">
                    <Text
                      className="text-[10px] font-black text-white"
                      numberOfLines={1}
                    >
                      {selectedAnimeA.title}
                    </Text>
                  </View>
                )}
              </View>

              {/* Center Frosted Glass Question Pill */}
              <View className="absolute top-1/2 left-0 right-0 -translate-y-1/2 z-20 items-center px-4 pointer-events-none">
                <View className="bg-slate-950/85 px-4 py-2 rounded-2xl border border-white/20 shadow-2xl max-w-full">
                  <Text
                    className="text-xs font-black text-white text-center tracking-tight"
                    numberOfLines={3}
                  >
                    {trimmedQuestion || 'Your Hot Take Question will display here...'}
                  </Text>
                </View>
              </View>

              {/* Bottom Half: Anime B */}
              <View className="flex-1 relative overflow-hidden bg-slate-900">
                {selectedAnimeB?.bannerImage || selectedAnimeB?.coverImage ? (
                  <Image
                    source={{
                      uri: selectedAnimeB.bannerImage || selectedAnimeB.coverImage,
                    }}
                    className="absolute inset-0 w-full h-full opacity-70"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="flex-1 items-center justify-center bg-slate-800/80">
                    <Text className="text-[11px] font-bold text-slate-400">
                      Select Anime B
                    </Text>
                  </View>
                )}
                {/* Anime B Pill */}
                {selectedAnimeB && (
                  <View className="absolute bottom-2.5 left-2.5 bg-black/75 px-2.5 py-1 rounded-full border border-white/20">
                    <Text
                      className="text-[10px] font-black text-white"
                      numberOfLines={1}
                    >
                      {selectedAnimeB.title}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* SUBMIT BUTTON */}
          <TouchableOpacity
            testID="forge-submit-button"
            disabled={!isFormValid || isSubmitting}
            onPress={handleForgeSubmit}
            activeOpacity={0.85}
            className={`py-4 rounded-2xl items-center justify-center shadow-md flex-row ${!isFormValid
              ? 'bg-slate-300'
              : isFreeForge
                ? 'bg-orange-500'
                : 'bg-purple-600'
              }`}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text className="text-white font-black text-sm tracking-wide uppercase mr-1.5">
                  {isFreeForge
                    ? '🔥 FORGE CARD INTO THE CRUCIBLE (FREE TODAY)'
                    : '⚙️ OVERCLOCK FORGE (50 $KAMI)'}
                </Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ForgeCreateScreen;
