import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { usePrivy } from '@privy-io/expo';
import { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { useKamiWallet } from '../hooks/useKamiWallet';

export interface ResultsScreenProps
  extends Partial<NativeStackScreenProps<RootStackParamList, 'Results'>> {}

export const ResultsScreen: React.FC<ResultsScreenProps> = (props) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<any>();
  const { user } = usePrivy();
  const { address } = useKamiWallet();

  const params = route.params || props.route?.params || {};
  const category = params.category || 'Anime Showdown';
  const answersCount = params.answersCount ?? 10;
  const agreedCount = params.agreedCount ?? 8;
  const baseReward = params.baseReward ?? 0.5;

  // Dynamic consensus bonus calculation (e.g. 8/10 matches majority yields 1.2x multiplier)
  const consensusBonus =
    params.consensusBonus ??
    Number((1.0 + (answersCount > 0 ? (agreedCount / answersCount) * 0.25 : 0.2)).toFixed(1));

  const tierMultiplier = params.tierMultiplier ?? 1.0;
  const totalEarned =
    params.totalEarned ??
    Number((baseReward * consensusBonus * tierMultiplier).toFixed(2));

  const [isClaiming, setIsClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const claimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (claimTimerRef.current) clearTimeout(claimTimerRef.current);
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
    };
  }, []);

  const handleClaim = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIsClaiming(true);
    setClaimError(null);

    const userId = user?.id || address || 'anon_user';
    const targetWallet = address;

    try {
      // 1. Invoke Supabase Edge Function to distribute on-chain rewards
      let edgeSuccess = false;
      let failureReason: string | null = null;

      if (targetWallet) {
        try {
          const { data: edgeData, error: edgeError } = await supabase.functions.invoke(
            'claim-reward',
            {
              body: {
                amount: totalEarned,
                walletAddress: targetWallet,
              },
            }
          );
          if (!edgeError && edgeData?.success) {
            edgeSuccess = true;
            console.log('Claim reward on-chain success:', edgeData.txHash);
          } else {
            failureReason =
              edgeError?.message || edgeData?.error || 'Failed to distribute on-chain rewards.';
            console.warn('Edge function claim-reward warning:', failureReason);
          }
        } catch (callErr: any) {
          failureReason = callErr?.message || 'Network error invoking reward distributor.';
          console.warn('Edge function invocation failed (fallback enabled):', callErr);
        }
      }

      // 2. Also record/sync reward to Supabase database
      const { error: rpcError } = await supabase.rpc('claim_kami_rewards', {
        p_user_id: userId,
        p_reward_amount: totalEarned,
      });

      if (rpcError) {
        const { data: userRow } = await supabase
          .from('users')
          .select('kami_balance')
          .eq('id', userId)
          .maybeSingle();

        const currentBalance = Number(userRow?.kami_balance || 0);
        await supabase.from('users').upsert({
          id: userId,
          kami_balance: Number((currentBalance + totalEarned).toFixed(2)),
          wallet_address: address || null,
          updated_at: new Date().toISOString(),
        });
      }

      // If user has a wallet connected and on-chain broadcast failed, inform them
      if (targetWallet && !edgeSuccess) {
        setClaimError(failureReason || 'Failed to distribute on-chain reward. Please try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setIsClaiming(false);
        return;
      }

      // Success affirmation
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setIsClaiming(false);
      setClaimed(true);

      // Short delay for visual dopamine affirmation before returning to Hub
      navTimerRef.current = setTimeout(() => {
        navigation.navigate('Main');
      }, 900);
    } catch (err: any) {
      console.warn('Error during claim process:', err);
      setClaimError(err?.message || 'Claiming process failed. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setIsClaiming(false);
    }
  };

  return (
    <SafeAreaView key="results-screen-root" className="flex-1 bg-gray-50 justify-center items-center px-6">
      {/* Centered Hero Card matching Results & Claim */}
      <View
        key="results-hero-card"
        className="w-full max-w-[360px] bg-white rounded-[32px] p-8 items-center shadow-2xl border border-slate-100"
      >
        {/* Top Flame Pill Icon */}
        <View className="w-20 h-20 rounded-full bg-[#FFF1E5] items-center justify-center mb-4 border border-peach-300/40">
          <Ionicons name="flame" size={44} color="#FF9A44" />
        </View>

        {/* Title & Category Narrative */}
        <Text className="text-3xl font-black text-slate-900 tracking-tight text-center">
          Stack Cleared!
        </Text>
        <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider text-center mt-1">
          {category}
        </Text>
        <Text className="text-slate-500 text-center text-sm mt-2 leading-relaxed">
          {answersCount} instincts logged on-chain. Rewards calibrated.
        </Text>

        {/* Breakdown Box */}
        <View className="w-full bg-gray-50 rounded-2xl p-5 border border-slate-100 my-6">
          <View className="flex-row justify-between items-center mb-2.5">
            <Text className="text-xs text-slate-500 font-medium">Base Reward</Text>
            <Text className="text-xs font-extrabold text-slate-900">
              {baseReward.toFixed(2)} $KAMI
            </Text>
          </View>

          <View className="flex-row justify-between items-center mb-2.5">
            <View className="flex-row items-center">
              <Text className="text-xs text-slate-500 font-medium">Consensus Bonus</Text>
              <Text className="text-[10px] text-slate-400 font-semibold ml-1">
                ({agreedCount}/{answersCount})
              </Text>
            </View>
            <Text className="text-xs font-extrabold text-emerald-600">
              {consensusBonus.toFixed(1)}x
            </Text>
          </View>

          <View className="flex-row justify-between items-center pt-2.5 border-t border-slate-200">
            <Text className="text-xs text-slate-500 font-medium">Tier Multiplier</Text>
            <Text className="text-xs font-extrabold text-mango-600">
              {tierMultiplier.toFixed(1)}x
            </Text>
          </View>
        </View>

        {/* Massive Total Earned */}
        <View className="items-center mb-6">
          <Text className="text-[10px] text-slate-400 font-black tracking-widest uppercase mb-1">
            TOTAL EARNED
          </Text>
          <Text className="text-3xl font-black text-slate-900 tracking-tight">
            {totalEarned.toFixed(2)} $KAMI
          </Text>
        </View>

        {/* Error Feedback Message if On-Chain Claim Reverts */}
        {claimError && (
          <View className="flex-row items-center bg-rose-50 border border-rose-200/60 rounded-2xl px-3 py-2 mb-4 w-full">
            <Ionicons name="alert-circle" size={16} color="#EF4444" />
            <Text className="text-rose-600 text-xs font-semibold ml-1.5 flex-1">
              {claimError}
            </Text>
          </View>
        )}

        {/* CTA Button ("CLAIM TO WALLET") */}
        <TouchableOpacity
          activeOpacity={0.88}
          disabled={isClaiming || claimed}
          onPress={handleClaim}
          className={`w-full py-4 rounded-full items-center justify-center shadow-xl flex-row ${
            claimed
              ? 'bg-emerald-500'
              : isClaiming
              ? 'bg-slate-700'
              : 'bg-mango-500'
          }`}
        >
          {isClaiming ? (
            <>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text className="text-white font-extrabold text-sm ml-2.5">
                Broadcasting to Base L2...
              </Text>
            </>
          ) : claimed ? (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text className="text-white font-black text-base uppercase tracking-wider ml-2">
                Claimed to Wallet!
              </Text>
            </>
          ) : (
            <>
              <Text className="text-white font-black text-base uppercase tracking-wider mr-1.5">
                CLAIM TO WALLET
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default ResultsScreen;
