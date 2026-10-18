import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Buffer } from 'buffer';
import { usePrivy } from '@privy-io/expo';
import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../navigation/types';
import { useKamiWallet } from '../hooks/useKamiWallet';

const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/notionists/svg?seed=kami&backgroundColor=FFF1E5';

export const EditProfileScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = usePrivy();
  const { address } = useKamiWallet();

  const userId = user?.id || address || 'anon_user';

  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch initial profile data on mount
  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        setIsLoading(true);
        const { data: profile, error } = await supabase
          .from('users')
          .select('username, avatar_url, bio')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          console.warn('Error loading profile from Supabase:', error.message);
        }

        if (isMounted && profile) {
          if (profile.username) setUsername(profile.username);
          if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
          if (profile.bio) setBio(profile.bio);
        }
      } catch (err: any) {
        console.warn('Unexpected error loading profile:', err?.message || err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Handle avatar picking & Supabase Storage upload
  const handlePickAvatar = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to set a custom profile avatar.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert('Upload Error', 'Could not process the selected image.');
        return;
      }

      setIsUploading(true);

      const fileExt = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const cleanExt = fileExt === 'png' ? 'png' : 'jpeg';
      const fileName = `${userId}/avatar_${Date.now()}.${cleanExt}`;
      const arrayBuffer = Buffer.from(asset.base64, 'base64');

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, {
          contentType: `image/${cleanExt}`,
          upsert: true,
        });

      if (uploadError) {
        console.error('Supabase avatar upload failed:', uploadError.message);
        Alert.alert('Upload Failed', uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      if (publicUrlData?.publicUrl) {
        setAvatarUrl(publicUrlData.publicUrl);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch (err: any) {
      console.error('Avatar selection/upload error:', err);
      Alert.alert('Error', err?.message || 'Failed to upload avatar.');
    } finally {
      setIsUploading(false);
    }
  };

  // Save profile to Supabase
  const handleSave = async () => {
    if (isSaving) return;

    try {
      setIsSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      const trimmedUsername = username.trim() || null;
      const trimmedBio = bio.trim() || null;

      const { error } = await supabase.from('users').upsert({
        id: userId,
        username: trimmedUsername,
        bio: trimmedBio,
        avatar_url: avatarUrl,
        wallet_address: address || null,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error('Error saving profile:', error.message);
        Alert.alert('Save Failed', error.message);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      navigation.goBack();
    } catch (err: any) {
      console.error('Unexpected save error:', err);
      Alert.alert('Error', err?.message || 'Could not save profile changes.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top', 'bottom']}>
      {/* Header Bar */}
      <View className="flex-row items-center justify-between px-6 py-3 border-b border-slate-100 bg-white">
        {/* Back Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.goBack()}
          className="w-10 h-10 rounded-full bg-white items-center justify-center border border-slate-100 shadow-sm"
        >
          <Ionicons name="arrow-back" size={20} color="#0F172A" />
        </TouchableOpacity>

        {/* Title */}
        <Text className="text-lg font-black text-slate-900 tracking-tight">
          Edit Profile
        </Text>

        {/* Save Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={isSaving || isUploading || isLoading}
          onPress={handleSave}
          className="py-1 px-3"
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FF9A44" />
          ) : (
            <Text className="text-mango-500 font-extrabold text-base">
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 28 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar Section */}
          <View className="items-center mb-8">
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={isUploading}
              onPress={handlePickAvatar}
              className="relative"
            >
              <Image
                source={{ uri: avatarUrl || DEFAULT_AVATAR }}
                className="w-24 h-24 rounded-full bg-peach-300 border-2 border-white shadow-md"
              />

              {/* Uploading Overlay */}
              {isUploading && (
                <View className="absolute inset-0 rounded-full bg-black/40 items-center justify-center">
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              )}

              {/* Camera Badge Icon */}
              <View className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-mango-500 items-center justify-center border-2 border-white shadow-sm">
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              disabled={isUploading}
              onPress={handlePickAvatar}
              className="mt-3 py-1 px-3"
            >
              <Text className="text-mango-500 font-bold text-sm">
                {isUploading ? 'Uploading...' : 'Change Avatar'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View className="space-y-6">
            {/* Username Input */}
            <View>
              <Text className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                Username
              </Text>
              <View className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3.5">
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="e.g. OtakuGod99"
                  placeholderTextColor="#94A3B8"
                  maxLength={30}
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="text-slate-900 text-base font-semibold"
                />
              </View>
              <Text className="text-[11px] text-slate-400 mt-1.5 ml-1">
                Your public handle across leaderboards and consensus stats.
              </Text>
            </View>

            {/* Bio Input */}
            <View className="mt-5">
              <View className="flex-row justify-between items-center mb-2 px-1">
                <Text className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                  Bio
                </Text>
                <Text className="text-[11px] text-slate-400 font-semibold">
                  {bio.length}/160
                </Text>
              </View>
              <View className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3.5">
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell the community about your anime instincts..."
                  placeholderTextColor="#94A3B8"
                  maxLength={160}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  className="text-slate-900 text-base font-normal min-h-[96px]"
                />
              </View>
              <Text className="text-[11px] text-slate-400 mt-1.5 ml-1">
                Max 160 characters. Displayed on your public collector profile.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default EditProfileScreen;
