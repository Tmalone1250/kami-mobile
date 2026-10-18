import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLoginWithOAuth, useLoginWithEmail, usePrivy } from '@privy-io/expo';
import { KamiLogo } from '../components/KamiLogo';

interface LoginScreenProps {
  onMockLogin?: () => void;
}

const describeError = (error: any): string =>
  error?.message || error?.error || error?.code || String(error);

export const LoginScreen: React.FC<LoginScreenProps> = ({ onMockLogin }) => {
  const { isReady } = usePrivy();
  const { login: loginWithOAuth } = useLoginWithOAuth();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [emailStep, setEmailStep] = useState<'idle' | 'email' | 'code'>('idle');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  const handleOAuthLogin = async (provider: 'google' | 'discord') => {
    try {
      setLoadingProvider(provider);
      await loginWithOAuth({ provider });
    } catch (error: any) {
      // Use console.error so it shows up in LogBox / Metro, and show the real
      // reason to the user instead of a misleading success message.
      console.error(`OAuth login error (${provider}):`, error);
      Alert.alert(`${provider} login failed`, describeError(error));
      onMockLogin?.();
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleEmailLogin = async () => {
    try {
      setLoadingProvider('email');
      if (emailStep === 'idle') {
        setEmailStep('email');
      } else if (emailStep === 'email') {
        await sendCode({ email: email.trim() });
        setEmailStep('code');
      } else {
        await loginWithCode({ code: code.trim(), email: email.trim() });
      }
    } catch (error: any) {
      console.error('Email login error:', error);
      Alert.alert('Email login failed', describeError(error));
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1 px-6 justify-between pt-12 pb-6">
        {/* Top Content Area */}
        <View className="items-center mt-6">
          {/* Circular Logo Container */}
          <View className="w-44 h-44 rounded-full bg-[#FFF1E5] items-center justify-center mb-8 shadow-sm">
            <KamiLogo size={90} />
          </View>

          {/* Title & Subtitles */}
          <Text className="text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">
            Project Kami
          </Text>

          <Text className="text-slate-500 text-base text-center font-normal leading-relaxed">
            Your anime instincts.
          </Text>
          <Text className="text-slate-500 text-base text-center font-normal leading-relaxed mb-5">
            A whole new way to play.
          </Text>

          {/* Tagline */}
          <Text className="text-xs font-bold text-peach-500 tracking-[2px] uppercase">
            SWIPE. DISCOVER. LEVEL UP.
          </Text>
        </View>

        {/* Bottom Actions Area */}
        <View className="w-full space-y-3 mb-2">
          {/* Continue with Google */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleOAuthLogin('google')}
            className="w-full bg-white rounded-full py-4 px-6 mb-3 flex-row items-center justify-center shadow-md border border-slate-100"
          >
            {loadingProvider === 'google' ? (
              <ActivityIndicator color="#FF9A44" />
            ) : (
              <Text className="text-slate-900 font-bold text-base">
                Continue with Google
              </Text>
            )}
          </TouchableOpacity>

          {/* Continue with Discord */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleOAuthLogin('discord')}
            className="w-full bg-white rounded-full py-4 px-6 mb-3 flex-row items-center justify-center shadow-md border border-slate-100"
          >
            {loadingProvider === 'discord' ? (
              <ActivityIndicator color="#FF9A44" />
            ) : (
              <Text className="text-slate-900 font-bold text-base">
                Continue with Discord
              </Text>
            )}
          </TouchableOpacity>

          {/* Email / code input (shown after tapping Continue with Email) */}
          {emailStep === 'email' && (
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              className="w-full bg-white rounded-full py-4 px-6 mb-3 text-slate-900 border border-slate-100"
            />
          )}
          {emailStep === 'code' && (
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="6-digit code from your email"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              className="w-full bg-white rounded-full py-4 px-6 mb-3 text-slate-900 border border-slate-100"
            />
          )}

          {/* Continue with Email */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleEmailLogin}
            className="w-full bg-white rounded-full py-4 px-6 mb-4 flex-row items-center justify-center shadow-md border border-slate-100"
          >
            {loadingProvider === 'email' ? (
              <ActivityIndicator color="#FF9A44" />
            ) : (
              <Text className="text-slate-900 font-bold text-base">
                {emailStep === 'email'
                  ? 'Send Code'
                  : emailStep === 'code'
                  ? 'Verify Code'
                  : 'Continue with Email'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Terms Disclaimer */}
          <Text className="text-xs text-slate-400 text-center leading-normal px-6">
            By continuing, you agree to our{'\n'}Terms of Service and Privacy Policy.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default LoginScreen;
