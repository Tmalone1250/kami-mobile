import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { HubHeader } from '../components/HubHeader';
import { RouletteModal } from '../components/RouletteModal';
import { RootStackParamList } from '../navigation/types';
import { TierKey } from '../types/forge';

export interface HubScreenProps {}

export const HubScreen: React.FC<HubScreenProps> = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [selectedTier, setSelectedTier] = useState<TierKey | null>(null);
  const [isRouletteVisible, setIsRouletteVisible] = useState(false);

  const handleSelectTier = (tier: TierKey) => {
    setSelectedTier(tier);
    setIsRouletteVisible(true);
  };

  const handleCategorySelected = (categorySlug: string) => {
    const tier = selectedTier || 'tier_01';
    setIsRouletteVisible(false);
    navigation.navigate('Forge', { tier, category: categorySlug });
  };

  const handleOpenCrucible = () => {
    navigation.navigate('Forge', {
      tier: 'tier_01',
      category: 'The Crucible',
      isCrucibleMode: true,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]" edges={['top']}>
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
            onPress={() => navigation.navigate('ForgeCreate')}
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
            activeOpacity={0.9}
            onPress={() => handleSelectTier('tier_01')}
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
                  [ 5 / 5 Spins Remaining ]
                </Text>
              </View>
              <View className="w-10 h-10 rounded-full bg-[#FFF1E5] items-center justify-center">
                <Ionicons name="arrow-forward" size={20} color="#FF9A44" />
              </View>
            </View>
          </TouchableOpacity>

          {/* Card 2: Cult Classic */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handleSelectTier('tier_02')}
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
                  [ 5 / 5 Spins Remaining ]
                </Text>
              </View>
              <View className="w-10 h-10 rounded-full bg-[#FFF1E5] items-center justify-center">
                <Ionicons name="arrow-forward" size={20} color="#FF9A44" />
              </View>
            </View>
          </TouchableOpacity>

          {/* Card 3: Arch-Sage */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handleSelectTier('tier_03')}
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
                  [ 5 / 5 Spins Remaining ]
                </Text>
              </View>
              <View className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center">
                <Ionicons name="arrow-forward" size={20} color="#94A3B8" />
              </View>
            </View>
          </TouchableOpacity>

          {/* Card 4: The Crucible (Community Arena) */}
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
                      1.2x MULTIPLIER
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
                  1.2x Multiplier
                </Text>
                <Text className="text-xs text-slate-400">
                  [ Live Community Stack ]
                </Text>
              </View>
              <View className="w-10 h-10 rounded-full bg-purple-100 items-center justify-center">
                <Ionicons name="arrow-forward" size={20} color="#7C3AED" />
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

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
