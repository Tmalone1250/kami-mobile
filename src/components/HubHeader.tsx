import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { usePrivy } from '@privy-io/expo';
import { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { useKamiWallet } from '../hooks/useKamiWallet';
import { useKamiBalance } from '../hooks/useKamiBalance';

const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/notionists/svg?seed=kami&backgroundColor=FFF1E5';

export const HubHeader: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const { user, logout } = usePrivy();
  const { address: walletAddress, isCreating: isCreatingWallet, error: walletError } = useKamiWallet();

  const userId = user?.id || walletAddress || 'anon_user';

  // Live on-chain balance via Base Sepolia
  const {
    balance: onChainBalance,
    formatted: onChainFormatted,
    refetch: refetchOnChainBalance,
  } = useKamiBalance(walletAddress);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [fallbackBalance, setFallbackBalance] = useState<number>(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to safely truncate the address
  const formatAddress = (address?: string) => {
    if (!address) return walletError ? 'Wallet error' : '0x00...0000';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  // Fetch user profile from Supabase whenever screen focuses
  const fetchProfile = useCallback(async () => {
    if (!userId || userId === 'anon_user') return;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('username, avatar_url, kami_balance')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        if (data.avatar_url) setAvatarUrl(data.avatar_url);
        if (data.username) setUsername(data.username);
        if (data.kami_balance !== null && data.kami_balance !== undefined) {
          setFallbackBalance(Number(data.kami_balance));
        }
      }
    } catch (err) {
      console.warn('Failed to fetch profile in HubHeader:', err);
    }
  }, [userId]);

  useEffect(() => {
    if (isFocused) {
      fetchProfile();
      refetchOnChainBalance();
    }
  }, [isFocused, fetchProfile, refetchOnChainBalance]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleToggleMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsMenuOpen((prev) => !prev);
  };

  const handleViewProfile = () => {
    setIsMenuOpen(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate("Profile");
  };

  const handleEditProfile = () => {
    setIsMenuOpen(false);
    navigation.navigate('EditProfile');
  };

  const handleNavigateTransfer = () => {
    setIsMenuOpen(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate('Transfer');
  };

  const handleCopyWalletAddress = async () => {
    setIsMenuOpen(false);
    if (!walletAddress) return;

    await Clipboard.setStringAsync(walletAddress);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    setShowCopiedToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setShowCopiedToast(false);
    }, 2000);
  };

  const handleDisconnect = async () => {
    setIsMenuOpen(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await logout();
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  // Determine displayed balance: prioritize live on-chain balance, fallback to database
  const displayBalance =
    onChainBalance > 0 ? onChainFormatted : fallbackBalance > 0 ? fallbackBalance.toFixed(2) : onChainFormatted;

  return (
    <View className="px-6 pt-2 pb-4 relative z-50">
      <View className="flex-row items-center justify-between">
        {/* Left: Avatar & Wallet Trigger (Enlarged for touch ease) */}
        <View className="items-center">
          <TouchableOpacity activeOpacity={0.8} onPress={handleToggleMenu} className="p-0.5">
            <Image
              source={{ uri: avatarUrl || DEFAULT_AVATAR }}
              className="w-12 h-12 rounded-full bg-peach-300 border border-slate-100 shadow-sm"
            />
          </TouchableOpacity>
          {isCreatingWallet ? (
            <View className="flex-row items-center mt-1">
              <ActivityIndicator size={10} color="#94A3B8" />
              <Text className="text-[10px] text-slate-400 font-medium ml-1">
                Creating Wallet...
              </Text>
            </View>
          ) : (
            <TouchableOpacity activeOpacity={0.7} onPress={handleToggleMenu}>
              <Text className="text-[11px] text-slate-500 mt-1 font-bold">
                {username ? `@${username}` : formatAddress(walletAddress)}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Right: Live On-Chain Balance Pill (Enlarged & more clickable) */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleNavigateTransfer}
          className="bg-gray-100 px-5 py-2.5 rounded-full flex-row items-center border border-slate-200/60 shadow-sm active:scale-95"
        >
          <Ionicons name="link-outline" size={18} color="#FF9A44" />
          <Text style={{ includeFontPadding: false }} className="text-mango-500 font-black ml-1.5 text-base tracking-tight">
            {displayBalance} $KAMI
          </Text>
        </TouchableOpacity>
      </View>

      {/* Copied Toast Pill */}
      {showCopiedToast && (
        <View className="absolute top-16 left-6 z-50 bg-slate-900 px-3 py-1.5 rounded-full flex-row items-center shadow-lg">
          <Ionicons name="checkmark-circle" size={14} color="#10B981" />
          <Text className="text-white text-xs font-bold ml-1.5">
            Address copied!
          </Text>
        </View>
      )}

      {/* Dropdown Menu Modal */}
      <Modal
        visible={isMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMenuOpen(false)}
      >
        <View className="flex-1 bg-black/10">
          {/* Backdrop Touch Dismiss */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setIsMenuOpen(false)}
            className="absolute inset-0"
          />

          {/* Dropdown Menu Box */}
          <View
            style={{ top: 76, left: 24, minWidth: 260 }} className="absolute bg-white rounded-2xl p-2.5 shadow-2xl border border-slate-100 w-64 z-10"
          >
            {/* User Identity Header */}
            <TouchableOpacity activeOpacity={0.7} onPress={handleViewProfile} className="px-3 py-2 border-b border-slate-100">
              <Text
                numberOfLines={1}
                className="text-slate-900 font-black text-sm tracking-tight"
              >
                {username ? `@${username}` : 'Kami Collector'}
              </Text>
              <Text className="text-[11px] text-slate-400 font-medium mt-0.5">
                {formatAddress(walletAddress)}
              </Text>
            </TouchableOpacity>

            {/* Menu Item: View Profile */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleViewProfile}
              className="flex-row items-center px-3 py-2.5 rounded-xl active:bg-slate-50 mt-1"
            >
              <Ionicons name="person-circle-outline" size={16} color="#FF9A44" />
              <Text numberOfLines={1} style={{ includeFontPadding: false }} className="text-slate-900 font-bold text-sm ml-2.5 flex-1">
                View Profile
              </Text>
            </TouchableOpacity>

            {/* Menu Item: Edit Profile */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleEditProfile}
              className="flex-row items-center px-3 py-2.5 rounded-xl active:bg-slate-50"
            >
              <Ionicons name="person-outline" size={16} color="#0F172A" />
              <Text numberOfLines={1} style={{ includeFontPadding: false }} className="text-slate-900 font-bold text-sm ml-2.5 flex-1">
                Edit Profile
              </Text>
            </TouchableOpacity>

            {/* Menu Item: Transfer $KAMI */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleNavigateTransfer}
              className="flex-row items-center px-3 py-2.5 rounded-xl active:bg-slate-50"
            >
              <Ionicons name="swap-horizontal-outline" size={16} color="#FF9A44" />
              <Text numberOfLines={1} style={{ includeFontPadding: false }} className="text-slate-900 font-bold text-sm ml-2.5 flex-1">
                Transfer $KAMI
              </Text>
            </TouchableOpacity>

            {/* Menu Item: Copy Wallet Address */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleCopyWalletAddress}
              className="flex-row items-center px-3 py-2.5 rounded-xl active:bg-slate-50"
            >
              <Ionicons name="copy-outline" size={16} color="#0F172A" />
              <Text numberOfLines={1} style={{ includeFontPadding: false }} className="text-slate-900 font-bold text-sm ml-2.5 flex-1">
                Copy Wallet Address
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View className="h-px bg-slate-100 my-1" />

            {/* Menu Item: Disconnect */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleDisconnect}
              className="flex-row items-center px-3 py-2.5 rounded-xl active:bg-rose-50"
            >
              <Ionicons name="log-out-outline" size={16} color="#EF4444" />
              <Text numberOfLines={1} style={{ includeFontPadding: false }} className="text-rose-500 font-extrabold text-sm ml-2.5 flex-1">
                Disconnect
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default HubHeader;
