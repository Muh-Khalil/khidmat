import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { colors } from '@/lib/theme/colors';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const isProvider = user?.role === 'provider';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isProvider ? colors.primary : colors.primary,
        tabBarInactiveTintColor: colors.gray400,
        tabBarHideOnKeyboard: false,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.gray100,
          borderTopWidth: 1,
          paddingTop: 4,
          paddingBottom: insets.bottom,
          height: 60 + insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isProvider ? 'Job Queue' : 'Chat',
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name={isProvider ? 'construct-outline' : 'chatbubbles'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarItemStyle: isProvider ? { display: 'none' } : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="dues"
        options={{
          title: 'Dues Ledger',
          tabBarItemStyle: isProvider ? undefined : { display: 'none' },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

