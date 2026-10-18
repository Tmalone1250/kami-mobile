import React from 'react';
import { View, Text, SafeAreaView } from 'react-native';

export const ShopScreen: React.FC = () => {
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-2xl font-bold text-slate-900 mb-2">Cosmetics Shop</Text>
        <Text className="text-slate-500 text-center">
          Unlock Kami Cosmetics & Multipliers
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default ShopScreen;
