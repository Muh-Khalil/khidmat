import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useSettingsStore } from '@/lib/stores/useSettingsStore';
import { useBookingsStore } from '@/lib/stores/useBookingsStore';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { Button } from '@/components/Button';
import { SECTORS as SECTOR_OPTIONS, DEFAULT_SECTOR } from '@/lib/mock/providers';
import { colors } from '@/lib/theme/colors';

export default function SettingsScreen() {
  const router = useRouter();
  const defaultLocation = useSettingsStore((s) => s.defaultLocation);
  const setDefaultLocation = useSettingsStore((s) => s.setDefaultLocation);
  const clearBookings = useBookingsStore((s) => s.clear);

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);

  const [locationInput, setLocationInput] = useState(defaultLocation);
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredSectors = useMemo(() => {
    if (!locationInput) return SECTOR_OPTIONS;
    return SECTOR_OPTIONS.filter((s) =>
      s.toLowerCase().includes(locationInput.toLowerCase()),
    );
  }, [locationInput]);

  const handleLocationChange = (text: string) => {
    setLocationInput(text);
    setShowDropdown(true);
  };

  const handleSectorSelect = (sector: string) => {
    setLocationInput(sector);
    setDefaultLocation(sector);
    setShowDropdown(false);
  };

  const handleBlur = () => {
    setTimeout(() => {
      setShowDropdown(false);
      const trimmed = locationInput.trim();
      const matched = SECTOR_OPTIONS.find(
        (s) => s.toLowerCase() === trimmed.toLowerCase(),
      );
      if (matched) {
        setDefaultLocation(matched);
        setLocationInput(matched);
      } else {
        setLocationInput(defaultLocation);
      }
    }, 200);
  };

  const handleClearBookings = () => {
    Alert.alert(
      'Clear All Bookings',
      'This will permanently delete all your bookings. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => clearBookings(),
        },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your Khidmat account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            logout();
            Alert.alert('Signed Out', 'You have been signed out.');
          },
        },
      ],
    );
  };

  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="border-b border-gray-50 px-5 pb-3 pt-4">
        <Text className="text-lg font-bold text-gray-900">Settings</Text>
      </View>

      <ScrollView
        className="flex-1 px-5 pt-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* User Account Profile Card */}
        {isAuthenticated && user ? (
          <View className="mb-6 rounded-2xl border border-gray-100 bg-gray-50/70 p-4 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
                  <Text className="text-base font-bold text-primary">
                    {userInitials}
                  </Text>
                </View>
                <View>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base font-bold text-gray-900">
                      {user.name}
                    </Text>
                    <View
                      className={`rounded-full px-2 py-0.5 ${
                        user.role === 'provider'
                          ? 'bg-amber-100'
                          : 'bg-primary-50'
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-bold ${
                          user.role === 'provider'
                            ? 'text-amber-800'
                            : 'text-primary'
                        }`}
                      >
                        {user.role === 'provider' ? 'Provider' : 'Customer'}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-xs text-gray-500">{user.phone}</Text>
                  {user.email ? (
                    <Text className="text-[11px] text-gray-400">{user.email}</Text>
                  ) : null}
                </View>
              </View>

              <TouchableOpacity
                onPress={() => router.push('/auth')}
                className="rounded-lg bg-white border border-gray-200 px-3 py-1.5 active:bg-gray-100"
              >
                <Text className="text-xs font-semibold text-gray-700">Switch</Text>
              </TouchableOpacity>
            </View>

            <View className="mt-4 flex-row items-center justify-between border-t border-gray-200/60 pt-3">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="location-outline" size={15} color={colors.gray500} />
                <Text className="text-xs text-gray-600">
                  Sector: <Text className="font-semibold text-gray-900">{user.sector || 'F-7'}</Text>
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleLogout}
                className="flex-row items-center gap-1"
              >
                <Ionicons name="log-out-outline" size={16} color="#EF4444" />
                <Text className="text-xs font-bold text-red-600">Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View className="mb-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-gray-200">
                  <Ionicons name="person-outline" size={20} color={colors.gray500} />
                </View>
                <View>
                  <Text className="text-sm font-bold text-gray-900">Guest User</Text>
                  <Text className="text-xs text-gray-500">Sign in to save preferences & manage bookings</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/auth')}
              className="mt-3 rounded-xl bg-primary py-2.5 items-center"
            >
              <Text className="text-xs font-bold text-white">Sign In / Register</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Section 1: Default Location */}
        <View className="mb-6">
          <Text className="mb-2 text-sm font-bold text-gray-900">
            Your default location
          </Text>
          <TextInput
            className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[15px] text-gray-900"
            value={locationInput}
            onChangeText={handleLocationChange}
            onFocus={() => setShowDropdown(true)}
            onBlur={handleBlur}
            placeholder={`e.g. ${DEFAULT_SECTOR}`}
            placeholderTextColor={colors.gray400}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          {/* Dropdown */}
          {showDropdown && filteredSectors.length > 0 && (
            <View className="mt-1 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
              {filteredSectors.map((sector) => (
                <Pressable
                  key={sector}
                  onPress={() => handleSectorSelect(sector)}
                  className="border-b border-gray-50 px-4 py-3 active:bg-gray-50"
                >
                  <Text
                    className={`text-sm ${
                      sector === locationInput
                        ? 'font-bold text-primary'
                        : 'text-gray-700'
                    }`}
                  >
                    {sector}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text className="mt-2 text-xs text-gray-400">
            Used when you don&apos;t specify a location in your request.
          </Text>
        </View>

        {/* Section 2: About */}
        <View className="mb-6 rounded-2xl bg-primary-50 p-4">
          <Text className="mb-2 text-sm font-bold text-gray-900">
            About Khidmat
          </Text>
          <Text className="text-[13px] leading-5 text-gray-600">
            Khidmat is an AI-powered service orchestrator. Tell me what you need
            in natural language — I&apos;ll find the right provider, book the
            slot, and follow up.
          </Text>
        </View>

        {/* Section 3: Clear bookings */}
        <View className="mb-8">
          <Button variant="destructive" onPress={handleClearBookings}>
            Clear all bookings
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

