import React, { useState } from "react";
import {
  View,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLoginWithOAuth, useLoginWithEmail, usePrivy } from "@privy-io/expo";

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
  const [emailStep, setEmailStep] = useState<"idle" | "email" | "code">("idle");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const handleOAuthLogin = async (provider: "google") => {
    try {
      setLoadingProvider(provider);
      await loginWithOAuth({ provider });
    } catch (error: any) {
      console.error(`OAuth login error (${provider}):`, error);
      Alert.alert(`${provider} login failed`, describeError(error));
      onMockLogin?.();
    } finally {
      setLoadingProvider(null);
    }
  };

  const connectExternalWallet = async (provider: "metamask" | "coinbase" | "rainbow") => {
    try {
      setLoadingProvider("wallet");
      const schemes: Record<string, string> = {
        metamask: "metamask://",
        coinbase: "cbwallet://",
        rainbow: "rainbow://",
      };
      const scheme = schemes[provider];
      const canOpen = await Linking.canOpenURL(scheme);
      if (canOpen) {
        await Linking.openURL(scheme);
      } else {
        const names: Record<string, string> = {
          metamask: "MetaMask",
          coinbase: "Coinbase Wallet",
          rainbow: "Rainbow",
        };
        Alert.alert(
          `${names[provider]} Not Detected`,
          `Could not open ${names[provider]}. Please make sure the app is installed, or continue with Google or Email.`,
          [{ text: "OK", onPress: () => onMockLogin?.() }]
        );
      }
    } catch (err: any) {
      console.error(`Error connecting ${provider}:`, err);
      Alert.alert("Wallet Error", describeError(err));
      onMockLogin?.();
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleWalletLogin = async () => {
    try {
      setLoadingProvider("wallet");
      Alert.alert(
        "Connect External Wallet",
        "Select your preferred Web3 wallet to connect with Project Kami:",
        [
          {
            text: "MetaMask",
            onPress: () => connectExternalWallet("metamask"),
          },
          {
            text: "Coinbase Wallet",
            onPress: () => connectExternalWallet("coinbase"),
          },
          {
            text: "Rainbow",
            onPress: () => connectExternalWallet("rainbow"),
          },
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setLoadingProvider(null),
          },
        ]
      );
    } catch (error: any) {
      console.error("Wallet login error:", error);
      Alert.alert("Wallet login failed", describeError(error));
      onMockLogin?.();
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleEmailLogin = async () => {
    try {
      setLoadingProvider("email");
      if (emailStep === "idle") {
        setEmailStep("email");
      } else if (emailStep === "email") {
        await sendCode({ email: email.trim() });
        setEmailStep("code");
      } else {
        await loginWithCode({ code: code.trim(), email: email.trim() });
      }
    } catch (error: any) {
      console.error("Email login error:", error);
      Alert.alert("Email login failed", describeError(error));
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
          <View className="w-44 h-44 rounded-full bg-[#FFF1E5] items-center justify-center mb-8 shadow-sm border border-peach-300/30">
            <Image
              source={require("../../assets/kami_kanji_transparent.png")}
              style={{ width: 110, height: 110 }}
              resizeMode="contain"
              testID="login-brand-logo"
              accessibilityLabel="Project Kami Logo"
            />
          </View>

          {/* Title & Subtitles */}
          <Text
            style={{ includeFontPadding: false }}
            className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight text-center"
          >
            Project Kami
          </Text>

          <Text
            style={{ includeFontPadding: false, lineHeight: 24 }}
            className="text-slate-500 text-base text-center font-normal"
          >
            Your anime instincts.
          </Text>
          <Text
            style={{ includeFontPadding: false, lineHeight: 24 }}
            className="text-slate-500 text-base text-center font-normal mb-5"
          >
            A whole new way to play.
          </Text>

          {/* Tagline Pill */}
          <View
            style={{ alignSelf: "center" }}
            className="bg-[#FFF1E5] px-5 py-2 rounded-full border border-peach-300/50 items-center justify-center shadow-xs"
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.8}
              style={{ includeFontPadding: false }}
              className="text-[11px] font-black text-peach-600 tracking-wider uppercase text-center"
            >
              SWIPE. DISCOVER. LEVEL UP.
            </Text>
          </View>
        </View>

        {/* Bottom Actions Area */}
        <View className="w-full mb-2">
          {/* Continue with Google Pill */}
          <TouchableOpacity
            testID="login-google-button"
            activeOpacity={0.85}
            onPress={() => handleOAuthLogin("google")}
            className="w-full bg-white rounded-full py-4 px-4 mb-3 items-center justify-center shadow-md border border-slate-100 min-h-[56px]"
          >
            {loadingProvider === "google" ? (
              <ActivityIndicator color="#FF9A44" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="logo-google" size={18} color="#EA4335" style={{ marginRight: 8 }} />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.8}
                  maxFontSizeMultiplier={1.2}
                  style={{ includeFontPadding: false }}
                  className="text-slate-900 font-bold text-[15px] text-center"
                >
                  Continue with Google
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Connect External Wallet Pill */}
          <TouchableOpacity
            testID="login-wallet-button"
            activeOpacity={0.85}
            onPress={handleWalletLogin}
            className="w-full bg-white rounded-full py-4 px-4 mb-3 items-center justify-center shadow-md border border-slate-100 min-h-[56px]"
          >
            {loadingProvider === "wallet" ? (
              <ActivityIndicator color="#FF9A44" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="wallet-outline" size={18} color="#FF9A44" style={{ marginRight: 8 }} />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.8}
                  maxFontSizeMultiplier={1.2}
                  style={{ includeFontPadding: false }}
                  className="text-slate-900 font-bold text-[15px] text-center"
                >
                  Connect External Wallet
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Email / code input */}
          {emailStep === "email" && (
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={{ includeFontPadding: false, paddingVertical: 0 }}
              className="w-full bg-white rounded-full py-3.5 px-6 mb-3 text-slate-900 border border-slate-200 text-base font-medium shadow-xs min-h-[52px]"
            />
          )}
          {emailStep === "code" && (
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="6-digit code from your email"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              style={{ includeFontPadding: false, paddingVertical: 0 }}
              className="w-full bg-white rounded-full py-3.5 px-6 mb-3 text-slate-900 border border-slate-200 text-base font-medium shadow-xs min-h-[52px]"
            />
          )}

          {/* Continue with Email Pill */}
          <TouchableOpacity
            testID="login-email-button"
            activeOpacity={0.85}
            onPress={handleEmailLogin}
            className="w-full bg-white rounded-full py-4 px-4 mb-4 items-center justify-center shadow-md border border-slate-100 min-h-[56px]"
          >
            {loadingProvider === "email" ? (
              <ActivityIndicator color="#FF9A44" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="mail-outline" size={18} color="#FF9A44" style={{ marginRight: 8 }} />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.8}
                  maxFontSizeMultiplier={1.2}
                  style={{ includeFontPadding: false }}
                  className="text-slate-900 font-bold text-[15px] text-center"
                >
                  {emailStep === "email"
                    ? "Send Code"
                    : emailStep === "code"
                    ? "Verify Code"
                    : "Continue with Email"}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Terms Disclaimer */}
          <Text
            style={{ includeFontPadding: false, lineHeight: 18 }}
            className="text-xs text-slate-400 text-center px-6"
          >
            By continuing, you agree to our{"\n"}Terms of Service and Privacy Policy.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default LoginScreen;
