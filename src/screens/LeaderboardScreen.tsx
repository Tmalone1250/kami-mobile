import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { usePrivy } from '@privy-io/expo';
import { useKamiWallet } from '../hooks/useKamiWallet';
import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../navigation/types';
import { getBorderById } from '../constants/cosmetics';

export type LeaderboardMode = 'curator' | 'architect';

export interface LeaderboardUser {
  id: string;
  username: string;
  avatar_url: string | null;
  dominant_trait: string;
  equipped_border: string;
  equipped_banner: string;
  equipped_stamp: string;
  kami_balance: number;
  lifetime_earned_kami: number;
  total_swipes: number;
  current_streak: number;
  prompts_forged: number;
  creator_swipes_received: number;
  curator_score: number;
  architect_score: number;
  global_rank: number;
  architect_rank: number;
}

export const LeaderboardScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { user } = usePrivy();
  const { address } = useKamiWallet();
  const currentUserId = user?.id || address || '';

  const [mode, setMode] = useState<LeaderboardMode>('curator');
  const [curatorsData, setCuratorsData] = useState<LeaderboardUser[]>([]);
  const [architectsData, setArchitectsData] = useState<LeaderboardUser[]>([]);
  const [currentUserStanding, setCurrentUserStanding] = useState<LeaderboardUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Parallel dual-dataset prefetch: avoids unmounting UI and network roundtrip lag on tab switch
  const fetchLeaderboard = useCallback(async (isRefresh = false) => {
    if (!isRefresh && curatorsData.length === 0 && architectsData.length === 0) {
      setIsLoading(true);
    }
    try {
      const [curatorsRes, architectsRes] = await Promise.all([
        supabase
          .from('curator_leaderboard')
          .select('*')
          .order('global_rank', { ascending: true })
          .limit(50),
        supabase
          .from('curator_leaderboard')
          .select('*')
          .order('architect_rank', { ascending: true })
          .limit(50),
      ]);

      const curators = (!curatorsRes.error && curatorsRes.data ? curatorsRes.data : []) as LeaderboardUser[];
      const architects = (!architectsRes.error && architectsRes.data ? architectsRes.data : []) as LeaderboardUser[];

      setCuratorsData(curators);
      setArchitectsData(architects);

      // Resolve current user standing
      let standingUser =
        curators.find((r) => r.id === currentUserId) ||
        architects.find((r) => r.id === currentUserId);

      if (!standingUser && currentUserId) {
        const { data: userRow } = await supabase
          .from('curator_leaderboard')
          .select('*')
          .eq('id', currentUserId)
          .maybeSingle();

        if (userRow) {
          standingUser = userRow as LeaderboardUser;
        }
      }
      setCurrentUserStanding(standingUser || null);
    } catch (err) {
      console.warn('Failed to load curator leaderboard:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Screen focus refresh: strictly runs on screen focus, never on intra-screen tab switch
  useFocusEffect(
    useCallback(() => {
      fetchLeaderboard(true);
    }, [fetchLeaderboard])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    fetchLeaderboard(true);
  };

  const handleModeChange = (newMode: LeaderboardMode) => {
    if (newMode === mode) return;
    Haptics.selectionAsync().catch(() => {});
    // Instantaneous local state switch: zero network delay, zero UI unmount
    setMode(newMode);
  };

  const handleUserPress = (userId: string) => {
    Haptics.selectionAsync().catch(() => {});
    navigation.navigate('Profile', { userId });
  };

  const activeData = mode === 'curator' ? curatorsData : architectsData;
  const top1 = activeData[0] || null;
  const top2 = activeData[1] || null;
  const top3 = activeData[2] || null;
  const ranks4to50 = useMemo(() => activeData.slice(3), [activeData]);

  const renderAvatar = (
    avatarUrl: string | null | undefined,
    username: string,
    size: number,
    borderId?: string | null
  ) => {
    const borderCosmetic = getBorderById(borderId);
    const borderColor = borderCosmetic?.borderColor || '#E2E8F0';
    const fallbackSeed = encodeURIComponent(username || 'curator');
    const sourceUri = avatarUrl || `https://api.dicebear.com/7.x/bottts/png?seed=${fallbackSeed}`;

    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 9999,
          borderWidth: 2.5,
          borderColor,
          overflow: 'hidden',
          backgroundColor: '#F8FAFC',
          shadowColor: borderColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 4,
        }}
      >
        <Image source={{ uri: sourceUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-gray-50">
      {/* Header Bar */}
      <View className="px-5 pt-3 pb-2 flex-row items-center justify-between">
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="text-2xl font-black text-slate-900 tracking-tight">🏆 Hall of Kami</Text>
            <View className="ml-2.5 bg-orange-100 border border-orange-200 px-2.5 py-1 rounded-full items-center justify-center">
              <Text style={{ includeFontPadding: false, lineHeight: 14 }} className="text-[11px] font-black text-orange-600 uppercase tracking-wider">
                Top 50 • S1
              </Text>
            </View>
          </View>
          <Text className="text-xs font-semibold text-slate-500 mt-0.5">
            Global Curator & Architect Standings
          </Text>
        </View>
      </View>

      {/* Dual Mode Switcher: Top Curators vs Master Architects */}
      {/* Rendered with inline styles to eliminate Android NativeWind re-calculation stutter */}
      <View className="px-5 pt-2 pb-3">
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: 'rgba(226, 232, 240, 0.7)',
            padding: 6,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#E2E8F0',
          }}
        >
          <TouchableOpacity
            testID="curators-tab"
            activeOpacity={0.8}
            onPress={() => handleModeChange('curator')}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              backgroundColor: mode === 'curator' ? '#FFFFFF' : 'transparent',
              borderColor: mode === 'curator' ? 'rgba(226, 232, 240, 0.8)' : 'transparent',
              borderWidth: 1,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: mode === 'curator' ? 0.08 : 0,
              shadowRadius: 2,
              elevation: mode === 'curator' ? 2 : 0,
            }}
          >
            <Text style={{ marginRight: 6, fontSize: 13 }}>⚡</Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '900',
                letterSpacing: 0.3,
                color: mode === 'curator' ? '#0F172A' : '#64748B',
              }}
            >
              Top Curators
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="architects-tab"
            activeOpacity={0.8}
            onPress={() => handleModeChange('architect')}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              backgroundColor: mode === 'architect' ? '#FFFFFF' : 'transparent',
              borderColor: mode === 'architect' ? 'rgba(226, 232, 240, 0.8)' : 'transparent',
              borderWidth: 1,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: mode === 'architect' ? 0.08 : 0,
              shadowRadius: 2,
              elevation: mode === 'architect' ? 2 : 0,
            }}
          >
            <Text style={{ marginRight: 6, fontSize: 13 }}>🔨</Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '900',
                letterSpacing: 0.3,
                color: mode === 'architect' ? '#0F172A' : '#64748B',
              }}
            >
              Master Architects
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      {isLoading && activeData.length === 0 ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#FF9A44" />
          <Text className="text-xs font-bold text-slate-400 mt-3">Summoning Legends...</Text>
        </View>
      ) : activeData.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-4xl mb-3">⛩️</Text>
          <Text className="text-base font-bold text-slate-800 text-center mb-1">No Curators Found</Text>
          <Text className="text-xs text-slate-500 text-center">
            The Hall of Kami awaits its first conquerors. Forge prompts and swipe to climb the ranks!
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: Math.max(insets.bottom, 16) + 160,
          }}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#FF9A44" />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Top 3 Olympic Podium */}
          <View className="mt-2 mb-6 pt-2 pb-4 bg-white rounded-3xl border border-slate-100 shadow-sm px-3">
            <View className="flex-row items-end justify-center pt-2 pb-1">
              {/* #2 Silver (Left) */}
              {top2 ? (
                <TouchableOpacity
                  testID="podium-card-2"
                  activeOpacity={0.85}
                  onPress={() => handleUserPress(top2.id)}
                  style={{ width: '31%', alignItems: 'center' }}
                >
                  <View className="items-center mb-1">
                    <Text className="text-xl mb-1">🥈</Text>
                    {renderAvatar(top2.avatar_url, top2.username, 56, top2.equipped_border)}
                  </View>
                  <Text numberOfLines={1} className="text-xs font-black text-slate-800 text-center mt-1 px-1">
                    @{top2.username}
                  </Text>
                  {/* Metric Pill */}
                  <View className="bg-slate-100 px-2.5 py-1.5 rounded-full mt-1.5 border border-slate-200/70 items-center justify-center">
                    <Text numberOfLines={1} style={{ includeFontPadding: false, lineHeight: 15 }} className="text-[11px] font-black text-slate-700">
                      {mode === 'curator'
                        ? `${(top2.curator_score ?? 0).toLocaleString()} PTS`
                        : `${top2.creator_swipes_received ?? 0} Swipes`}
                    </Text>
                  </View>
                  <Text numberOfLines={1} className="text-[9px] font-bold text-slate-400 mt-1 text-center">
                    {mode === 'curator'
                      ? `${Number(top2.lifetime_earned_kami ?? 0).toFixed(1)} $KAMI`
                      : `${top2.prompts_forged ?? 0} Forged`}
                  </Text>
                  {/* Pedestal Base */}
                  <View
                    style={{
                      height: 52,
                      width: '100%',
                      backgroundColor: '#F1F5F9',
                      borderTopLeftRadius: 16,
                      borderTopRightRadius: 16,
                      marginTop: 8,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                    }}
                  >
                    <Text className="text-lg font-black text-slate-400">2</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={{ width: '31%' }} />
              )}

              {/* #1 Gold (Center - Elevated) */}
              {top1 ? (
                <TouchableOpacity
                  testID="podium-card-1"
                  activeOpacity={0.85}
                  onPress={() => handleUserPress(top1.id)}
                  style={{ width: '36%', alignItems: 'center', marginHorizontal: 4 }}
                >
                  <View className="items-center mb-1">
                    <Text className="text-2xl mb-1">👑</Text>
                    {renderAvatar(top1.avatar_url, top1.username, 70, top1.equipped_border)}
                  </View>
                  <Text numberOfLines={1} className="text-xs font-black text-slate-900 text-center mt-1 px-1">
                    @{top1.username}
                  </Text>
                  {/* Metric Pill */}
                  <View className="bg-amber-100/80 px-3 py-1.5 rounded-full mt-1.5 border border-amber-300 items-center justify-center shadow-xs">
                    <Text numberOfLines={1} style={{ includeFontPadding: false, lineHeight: 16 }} className="text-xs font-black text-amber-800">
                      {mode === 'curator'
                        ? `${(top1.curator_score ?? 0).toLocaleString()} PTS`
                        : `${top1.creator_swipes_received ?? 0} Swipes`}
                    </Text>
                  </View>
                  <Text numberOfLines={1} className="text-[9px] font-black text-orange-600 mt-1 text-center">
                    {mode === 'curator'
                      ? `${Number(top1.lifetime_earned_kami ?? 0).toFixed(2)} $KAMI • ${top1.total_swipes ?? 0} Swipes`
                      : `${top1.prompts_forged ?? 0} Takes Forged`}
                  </Text>
                  {/* Pedestal Base */}
                  <View
                    style={{
                      height: 74,
                      width: '100%',
                      backgroundColor: '#FEF3C7',
                      borderTopLeftRadius: 20,
                      borderTopRightRadius: 20,
                      marginTop: 8,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1.5,
                      borderColor: '#FDE68A',
                      shadowColor: '#F59E0B',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.15,
                      shadowRadius: 6,
                      elevation: 3,
                    }}
                  >
                    <Text className="text-2xl font-black text-amber-600">1</Text>
                  </View>
                </TouchableOpacity>
              ) : null}

              {/* #3 Bronze (Right) */}
              {top3 ? (
                <TouchableOpacity
                  testID="podium-card-3"
                  activeOpacity={0.85}
                  onPress={() => handleUserPress(top3.id)}
                  style={{ width: '31%', alignItems: 'center' }}
                >
                  <View className="items-center mb-1">
                    <Text className="text-xl mb-1">🥉</Text>
                    {renderAvatar(top3.avatar_url, top3.username, 54, top3.equipped_border)}
                  </View>
                  <Text numberOfLines={1} className="text-xs font-black text-slate-800 text-center mt-1 px-1">
                    @{top3.username}
                  </Text>
                  {/* Metric Pill */}
                  <View className="bg-slate-100 px-2.5 py-1.5 rounded-full mt-1.5 border border-slate-200/70 items-center justify-center">
                    <Text numberOfLines={1} style={{ includeFontPadding: false, lineHeight: 15 }} className="text-[11px] font-black text-slate-700">
                      {mode === 'curator'
                        ? `${(top3.curator_score ?? 0).toLocaleString()} PTS`
                        : `${top3.creator_swipes_received ?? 0} Swipes`}
                    </Text>
                  </View>
                  <Text numberOfLines={1} className="text-[9px] font-bold text-slate-400 mt-1 text-center">
                    {mode === 'curator'
                      ? `${Number(top3.lifetime_earned_kami ?? 0).toFixed(1)} $KAMI`
                      : `${top3.prompts_forged ?? 0} Forged`}
                  </Text>
                  {/* Pedestal Base */}
                  <View
                    style={{
                      height: 40,
                      width: '100%',
                      backgroundColor: '#F1F5F9',
                      borderTopLeftRadius: 16,
                      borderTopRightRadius: 16,
                      marginTop: 8,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                    }}
                  >
                    <Text className="text-base font-black text-slate-400">3</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={{ width: '31%' }} />
              )}
            </View>
          </View>

          {/* Rankings List: #4 through #50 */}
          {ranks4to50.length > 0 && (
            <View className="space-y-2.5">
              {ranks4to50.map((row, index) => {
                const rankNumber = index + 4;
                const isCurrentUser = row.id === currentUserId;

                return (
                  <TouchableOpacity
                    key={row.id}
                    testID={`leaderboard-row-${row.id}`}
                    activeOpacity={0.8}
                    onPress={() => handleUserPress(row.id)}
                    className={`flex-row items-center justify-between p-3.5 rounded-2xl border ${
                      isCurrentUser
                        ? 'bg-orange-50/70 border-orange-300 shadow-sm'
                        : 'bg-white border-slate-100 shadow-2xs'
                    }`}
                  >
                    {/* Left: Rank & Avatar & User Info */}
                    <View className="flex-row items-center flex-1 mr-2">
                      {/* Rank Number */}
                      <View className="w-7 items-center justify-center mr-2.5">
                        <Text className="text-sm font-black text-slate-400 font-mono">#{rankNumber}</Text>
                      </View>

                      {/* Avatar */}
                      <View className="mr-3">
                        {renderAvatar(row.avatar_url, row.username, 42, row.equipped_border)}
                      </View>

                      {/* Username & Trait */}
                      <View className="flex-1">
                        <View className="flex-row items-center">
                          <Text
                            numberOfLines={1}
                            className={`text-xs font-black ${
                              isCurrentUser ? 'text-orange-900' : 'text-slate-900'
                            }`}
                          >
                            @{row.username}
                          </Text>
                          {isCurrentUser && (
                            <View className="ml-1.5 bg-orange-200/80 px-1.5 py-0.2 rounded">
                              <Text className="text-[9px] font-black text-orange-800">YOU</Text>
                            </View>
                          )}
                        </View>
                        <Text numberOfLines={1} className="text-[10px] font-semibold text-slate-400 mt-0.5">
                          {mode === 'curator' ? `"${row.dominant_trait}"` : `${row.prompts_forged ?? 0} Takes Forged`}
                        </Text>
                      </View>
                    </View>

                    {/* Right: Streak & Score Pill */}
                    <View className="items-end">
                      <View
                        className={`px-3 py-1.5 rounded-full border items-center justify-center ${
                          isCurrentUser
                            ? 'bg-orange-100 border-orange-200'
                            : 'bg-slate-100 border-slate-200/80'
                        }`}
                      >
                        <Text
                          numberOfLines={1}
                          style={{ includeFontPadding: false, lineHeight: 16 }}
                          className={`text-xs font-black ${
                            isCurrentUser ? 'text-orange-700' : 'text-slate-800'
                          }`}
                        >
                          {mode === 'curator'
                            ? `${(row.curator_score ?? 0).toLocaleString()} PTS`
                            : `${row.creator_swipes_received ?? 0} Swipes`}
                        </Text>
                      </View>
                      {row.current_streak > 0 && mode === 'curator' && (
                        <Text className="text-[10px] font-black text-amber-500 mt-1">
                          🔥 {row.current_streak}d
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* Sticky "Your Standing" Card (Floating above Bottom Navigation Tab Bar) */}
      {currentUserStanding && (
        <View
          testID="sticky-your-standing"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: Math.max(insets.bottom, 16) + 74,
            zIndex: 40,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
            elevation: 10,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handleUserPress(currentUserStanding.id)}
            className="bg-slate-900 rounded-2xl p-3.5 border border-slate-700/80 flex-row items-center justify-between"
          >
            {/* Left: Rank & Avatar & User Info */}
            <View className="flex-row items-center flex-1 mr-3">
              {/* True Rank Pill */}
              <View className="bg-amber-400 px-2.5 py-1 rounded-lg mr-2.5 items-center justify-center min-w-[34px]">
                <Text testID="user-standing-rank" numberOfLines={1} style={{ includeFontPadding: false, lineHeight: 16 }} className="text-xs font-black text-slate-950 font-mono">
                  #{mode === 'curator' ? currentUserStanding.global_rank : currentUserStanding.architect_rank}
                </Text>
              </View>

              {/* Avatar with Equipped Border */}
              <View className="mr-2.5">
                {renderAvatar(
                  currentUserStanding.avatar_url,
                  currentUserStanding.username,
                  38,
                  currentUserStanding.equipped_border
                )}
              </View>

              {/* Title & Username */}
              <View className="flex-1">
                <Text className="text-[9px] font-black text-amber-400 uppercase tracking-widest">
                  YOUR STANDING
                </Text>
                <Text numberOfLines={1} className="text-xs font-extrabold text-white mt-0.5">
                  @{currentUserStanding.username} (You)
                </Text>
              </View>
            </View>

            {/* Right: Score Pill */}
            <View className="items-end">
              <View className="bg-slate-800 px-3.5 py-1.5 rounded-full border border-slate-700 items-center justify-center">
                <Text testID="user-standing-score" numberOfLines={1} style={{ includeFontPadding: false, lineHeight: 16 }} className="text-xs font-black text-amber-400">
                  {mode === 'curator'
                    ? `${(currentUserStanding.curator_score ?? 0).toLocaleString()} PTS`
                    : `${currentUserStanding.creator_swipes_received ?? 0} Swipes`}
                </Text>
              </View>
              <Text className="text-[9px] font-bold text-slate-400 mt-1">
                {mode === 'curator'
                  ? `${Number(currentUserStanding.lifetime_earned_kami ?? 0).toFixed(2)} $KAMI`
                  : `${currentUserStanding.prompts_forged ?? 0} Takes Forged`}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

export default LeaderboardScreen;
