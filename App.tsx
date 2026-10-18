import './global.css';
import 'react-native-get-random-values';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { PrivyProvider } from '@privy-io/expo';
import { SmartWalletsProvider } from '@privy-io/expo/smart-wallets';
import { baseSepolia } from 'viem/chains';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootNavigator } from './src/navigation/RootNavigator';

const PRIVY_APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID || 'cmulr2l2h00ih0djksyttp3ov';
const PRIVY_CLIENT_ID = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID;

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PrivyProvider
        appId={PRIVY_APP_ID}
        clientId={PRIVY_CLIENT_ID}
        supportedChains={[baseSepolia]}
        config={{
          // NOTE: the Expo SDK reads `embedded`, not `embeddedWallets` (that is the
          // @privy-io/react-auth web key). Using the wrong key is silently ignored.
          embedded: {
            ethereum: {
              createOnLogin: 'users-without-wallets',
            },
          },
        }}
      >
        <SmartWalletsProvider>
          <NavigationContainer>
            <RootNavigator />
            <StatusBar style="dark" />
          </NavigationContainer>
        </SmartWalletsProvider>
      </PrivyProvider>
    </GestureHandlerRootView>
  );
}
