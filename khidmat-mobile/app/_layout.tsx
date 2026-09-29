import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors } from '@/lib/theme/colors';
import { ToastNotification } from '@/components/ToastNotification';
import '../global.css';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <StatusBar style="dark" />
        <Stack
          initialRouteName="(tabs)"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.white },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="auth"
            options={{
              headerShown: false,
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="bookings/[id]"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen name="requests/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="providers/external" options={{ headerShown: false }} />
          <Stack.Screen name="provider/crm" options={{ headerShown: false }} />
        </Stack>
        <ToastNotification />
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
