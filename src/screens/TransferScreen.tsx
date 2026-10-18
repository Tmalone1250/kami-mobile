import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { useSmartWallets } from '@privy-io/expo/smart-wallets';
import { encodeFunctionData, parseUnits, isAddress } from 'viem';
import { useKamiBalance } from '../hooks/useKamiBalance';
import { useKamiWallet } from '../hooks/useKamiWallet';
import { RootStackParamList } from '../navigation/types';

// ERC-20 transfer(address to, uint256 amount) ABI definition
const ERC20_ABI = [
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;

// Token Contract Address on Base Sepolia
const KAMI_TOKEN_ADDRESS =
  (process.env.EXPO_PUBLIC_KAMI_TOKEN_ADDRESS as `0x${string}`) ||
  '0xb7dE9b14742C3dbf3d4e3af83aF026Bf4CB6A9c6';

type TransferScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Transfer'
>;

export const TransferScreen: React.FC = () => {
  const navigation = useNavigation<TransferScreenNavigationProp>();
  const { address: walletAddress } = useKamiWallet();
  const { wallets } = useEmbeddedEthereumWallet();
  const { client: smartWalletClient } = useSmartWallets();
  const { balance, refetch: refetchBalance } = useKamiBalance(walletAddress);

  const safeBalance = typeof balance === 'number' && !isNaN(balance) ? balance : 0;

  // Local UI State
  const [copied, setCopied] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const handleGoBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.goBack();
  };

  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    await Clipboard.setStringAsync(walletAddress);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2500);
  };

  const handlePasteRecipient = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setRecipient(text.trim());
        if (errorMessage) setErrorMessage(null);
      }
    } catch {
      // Ignore clipboard error
    }
  };

  // Set amount to max available balance.
  // NOTE: On Base Sepolia testnet with a sponsored Paymaster, user gas is sponsored (0 ETH).
  const handleMaxAmount = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (safeBalance <= 0) {
      setAmount('0');
      return;
    }
    const maxStr = safeBalance.toString();
    setAmount(maxStr);
    if (errorMessage) setErrorMessage(null);
  };

  const handleSendKami = async () => {
    setErrorMessage(null);

    // 1. Validate Recipient Address
    const cleanRecipient = recipient.trim();
    if (!cleanRecipient || !isAddress(cleanRecipient)) {
      setErrorMessage('Please enter a valid EVM address (0x...)');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }

    // 2. Validate Amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Please enter a valid amount greater than 0');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }

    if (parsedAmount > safeBalance) {
      setErrorMessage(`Insufficient balance. You have ${safeBalance.toFixed(2)} $KAMI`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }

    // 3. Check for Available Wallet
    const embeddedWallet = wallets[0];
    if (!smartWalletClient && !embeddedWallet) {
      setErrorMessage('No wallet available. Please log in again.');
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      setIsSending(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      // 4. Encode ERC-20 transfer(to, amount)
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [cleanRecipient as `0x${string}`, parseUnits(amount, 18)],
      });

      // 5. Broadcast via Paymaster (ERC-4337 Smart Account) or fallback EOA provider
      let txPromise: Promise<string>;
      if (smartWalletClient) {
        // Gasless UserOperation sponsored by Kami Paymaster
        txPromise = smartWalletClient.sendTransaction({
          to: KAMI_TOKEN_ADDRESS,
          data,
          value: 0n,
        });
      } else {
        const provider = await embeddedWallet.getProvider();
        txPromise = provider.request({
          method: 'eth_sendTransaction',
          params: [
            {
              to: KAMI_TOKEN_ADDRESS,
              data,
            },
          ],
        });
      }

      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Transaction broadcast timed out (30s).')), 30000);
      });

      const txHash = (await Promise.race([txPromise, timeoutPromise])) as string;
      console.log('Transfer broadcast success:', txHash);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSendSuccess(true);
      setRecipient('');
      setAmount('');

      // Refresh balance in background
      refetchBalance().catch(() => {});

      // Reset success state after 3 seconds
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        setSendSuccess(false);
      }, 3000);
    } catch (err: any) {
      console.error('Transfer broadcast failed:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setErrorMessage(err?.message || 'Transaction failed to broadcast.');
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top', 'bottom']}>
      {/* Top Header Bar */}
      <View className="px-6 py-3 flex-row items-center justify-between border-b border-slate-200/60 bg-white">
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleGoBack}
          className="flex-row items-center py-1.5 pr-3 active:opacity-70"
        >
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
          <Text className="text-slate-900 font-extrabold text-sm ml-2">
            Back to The Hub
          </Text>
        </TouchableOpacity>

        {/* Network Pill Indicator */}
        <View className="bg-peach-300/40 px-3 py-1 rounded-full border border-mango-500/20">
          <Text className="text-mango-600 font-extrabold text-xs">Base Sepolia</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingBottom: 80 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Screen Title */}
          <View className="mt-6 mb-2">
            <Text className="text-3xl font-black text-slate-900 tracking-tight">
              Transfer $KAMI
            </Text>
            <Text className="text-slate-500 text-sm mt-1">
              Deposit or send tokens peer-to-peer on Base Sepolia L2
            </Text>
          </View>

          {/* SECTION 1: RECEIVE (DEPOSIT) */}
          <View className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 mt-4">
            <View className="flex-row items-center mb-3">
              <View className="w-10 h-10 rounded-full bg-peach-300/40 items-center justify-center mr-3">
                <Ionicons name="qr-code-outline" size={20} color="#FF9A44" />
              </View>
              <View>
                <Text className="text-slate-900 font-black text-base">
                  Receive $KAMI
                </Text>
                <Text className="text-slate-400 text-xs">
                  Your Base Sepolia account address
                </Text>
              </View>
            </View>

            {/* Address Box */}
            <View className="w-full bg-gray-50 rounded-2xl p-4 border border-slate-100 my-2">
              <Text
                selectable
                className="text-slate-700 font-mono text-xs text-center leading-relaxed"
              >
                {walletAddress || 'No wallet connected'}
              </Text>
            </View>

            {/* Copy Address Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleCopyAddress}
              className="w-full bg-slate-900 py-3.5 rounded-full flex-row items-center justify-center shadow-sm active:scale-98 mt-2"
            >
              <Ionicons
                name={copied ? 'checkmark-circle' : 'copy-outline'}
                size={18}
                color="#FFFFFF"
              />
              <Text className="text-white font-extrabold text-sm ml-2">
                {copied ? 'Address Copied!' : 'Copy Wallet Address'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* SECTION 2: SEND (TRANSFER) */}
          <View className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 mt-5">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-peach-300/40 items-center justify-center mr-3">
                  <Ionicons name="paper-plane-outline" size={20} color="#FF9A44" />
                </View>
                <View>
                  <Text className="text-slate-900 font-black text-base">
                    Send $KAMI
                  </Text>
                  <Text className="text-slate-400 text-xs">
                    Transfer tokens to any EVM address
                  </Text>
                </View>
              </View>

              {/* Available Balance Pill */}
              <View className="bg-gray-100 px-3 py-1.5 rounded-full border border-slate-200/50">
                <Text className="text-xs font-black text-mango-500">
                  {safeBalance.toFixed(2)} $KAMI
                </Text>
              </View>
            </View>

            {/* Recipient Input */}
            <Text className="text-xs font-bold text-slate-700 mb-1.5 ml-1">
              Recipient Address
            </Text>
            <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-3 border border-slate-200 mb-4">
              <TextInput
                value={recipient}
                onChangeText={(txt) => {
                  setRecipient(txt);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="0x..."
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
                className="flex-1 text-slate-900 font-mono text-xs"
              />
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handlePasteRecipient}
                className="bg-slate-200 px-2.5 py-1 rounded-lg ml-2"
              >
                <Text className="text-[10px] text-slate-700 font-extrabold uppercase">
                  Paste
                </Text>
              </TouchableOpacity>
            </View>

            {/* Amount Input */}
            <Text className="text-xs font-bold text-slate-700 mb-1.5 ml-1">
              Amount ($KAMI)
            </Text>
            <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-3 border border-slate-200 mb-2">
              <TextInput
                value={amount}
                onChangeText={(txt) => {
                  setAmount(txt);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="0.00"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
                className="flex-1 text-slate-900 font-black text-base"
              />
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleMaxAmount}
                className="bg-peach-300/60 px-3 py-1.5 rounded-lg ml-2"
              >
                <Text className="text-xs text-mango-600 font-black uppercase">
                  Max
                </Text>
              </TouchableOpacity>
            </View>

            {/* Error Message */}
            {errorMessage && (
              <View className="flex-row items-center my-2 px-1">
                <Ionicons name="alert-circle" size={16} color="#EF4444" />
                <Text className="text-rose-500 text-xs font-semibold ml-1.5 flex-1">
                  {errorMessage}
                </Text>
              </View>
            )}

            {/* Gasless Paymaster Badge */}
            <View className="flex-row items-center justify-center my-2 py-1 px-3 bg-emerald-50 rounded-full border border-emerald-100 self-center">
              <Ionicons name="sparkles" size={13} color="#059669" />
              <Text className="text-emerald-700 font-extrabold text-[11px] ml-1.5 uppercase tracking-wide">
                Gasless • Sponsored by Kami Paymaster
              </Text>
            </View>

            {/* CTA Button */}
            <TouchableOpacity
              testID="send-kami-button"
              activeOpacity={0.88}
              disabled={isSending || sendSuccess}
              onPress={handleSendKami}
              className={`w-full py-4 rounded-full flex-row items-center justify-center mt-2 shadow-lg active:scale-98 ${
                sendSuccess
                  ? 'bg-emerald-500'
                  : isSending
                  ? 'bg-slate-700'
                  : 'bg-mango-500'
              }`}
            >
              {isSending ? (
                <>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text className="text-white font-extrabold text-sm ml-2.5">
                    Broadcasting Transfer...
                  </Text>
                </>
              ) : sendSuccess ? (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text className="text-white font-black text-sm ml-2 uppercase tracking-wider">
                    Transfer Sent!
                  </Text>
                </>
              ) : (
                <>
                  <Text className="text-white font-black text-base uppercase tracking-wider mr-2">
                    Send $KAMI
                  </Text>
                  <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default TransferScreen;
