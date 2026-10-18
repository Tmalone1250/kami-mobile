import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { usePrivy } from '@privy-io/expo';
import { ActivityIndicator, Text, View } from 'react-native';
import { LoginScreen } from '../screens/LoginScreen';
import { MainTabNavigator } from './MainTabNavigator';
import ForgeScreen from '../screens/ForgeScreen';
import ForgeCreateScreen from '../screens/ForgeCreateScreen';
import ResultsScreen from '../screens/ResultsScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import TransferScreen from '../screens/TransferScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  const { isReady, user } = usePrivy();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (isReady) return;
    const timer = setTimeout(() => setTimedOut(true), 10000);
    return () => clearTimeout(timer);
  }, [isReady]);

  if (!isReady) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-8">
        <ActivityIndicator size="large" color="#FF9A44" />
        {timedOut && (
          <Text className="text-slate-500 text-center mt-6">
            Privy hasn't finished initializing. Check EXPO_PUBLIC_PRIVY_APP_ID and
            EXPO_PUBLIC_PRIVY_CLIENT_ID in .env, then restart with `npx expo start -c`.
          </Text>
        )}
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} />
          <Stack.Screen name="Forge" component={ForgeScreen} />
          <Stack.Screen
            name="ForgeCreate"
            component={ForgeCreateScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="Results" component={ResultsScreen} />
          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Transfer"
            component={TransferScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
};

export default RootNavigator;
