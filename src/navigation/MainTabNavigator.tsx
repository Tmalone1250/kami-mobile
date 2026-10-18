import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { HubScreen } from '../screens/HubScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { ShopScreen } from '../screens/ShopScreen';

const Tab = createBottomTabNavigator();

const CustomTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  
  return (
    <View
      style={{
        position: 'absolute',
        bottom: Math.max(insets.bottom, 16), // Use max to ensure it floats but doesn't get cut by safe area
        left: 20,
        right: 20,
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 40,
        height: 70,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 8,
      }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        // Determine Icons based on route
        let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';
        if (route.name === 'Home') iconName = isFocused ? 'home' : 'home-outline';
        else if (route.name === 'Leaderboard') iconName = isFocused ? 'stats-chart' : 'stats-chart-outline';
        else if (route.name === 'Shop') iconName = isFocused ? 'cart' : 'cart-outline';

        const color = isFocused ? '#FF9A44' : '#94A3B8';
        const bgColor = isFocused ? '#FFF1E5' : 'transparent';

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            onPress={onPress}
            activeOpacity={0.8}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            <View
              style={{
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: bgColor,
                borderRadius: 24,
                paddingVertical: 8,
                paddingHorizontal: 20,
                minWidth: 70,
              }}
            >
              <Ionicons name={iconName} size={22} color={color} />
              <Text
                style={{
                  color,
                  fontSize: 10,
                  fontWeight: isFocused ? 'bold' : 'normal',
                  marginTop: 2,
                }}
              >
                {label as string}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HubScreen} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Tab.Screen name="Shop" component={ShopScreen} />
    </Tab.Navigator>
  );
};
