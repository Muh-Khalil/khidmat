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
import { toast } from '@/lib/stores/useToastStore';
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
    toast.success('Sector Updated', `Default location set to ${sector}`);
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
          onPress: () => {
            clearBookings();
            toast.info('Bookings Cleared', 'All saved bookings have been removed.');
          },
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
            toast.success('Signed Out', 'You have been safely signed out.');
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

  const POPULAR_SECTORS = ['G-11', 'G-13', 'F-10', 'F-7', 'E-11', 'I-8', 'H-13'];

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Top Header */}
      <View className="border-b border-gray-100 px-5 pb-3.5 pt-3 flex-row items-center justify-between">
        <View>
          <Text className="text-xl font-extrabold text-gray-900">Settings</Text>
          <Text className="text-xs text-gray-400 font-medium">Tarteebat & Account</Text>
        </View>
        <View className="rounded-full bg-orange-50 px-3 py-1 border border-orange-200/60">
          <Text className="text-xs font-bold text-primary">Islamabad / Pindi</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-5 pt-4"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* User Account Profile Card (Clean & Responsive) */}
        {isAuthenticated && user ? (
          <View className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1 flex-row items-center gap-3">
                <View className="h-13 w-13 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
                  <Text className="text-base font-extrabold text-primary">
                    {userInitials}
                  </Text>
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-1.5 flex-wrap">
                    <Text className="text-base font-bold text-gray-900" numberOfLines={1}>
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
                        className={`text-[10px] font-extrabold ${
                          user.role === 'provider'
                            ? 'text-amber-800'
                            : 'text-primary'
                        }`}
                      >
                        {user.role === 'provider' ? 'Karigar Pro' : 'Customer'}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-xs text-gray-500 mt-0.5 font-medium">{user.phone}</Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => router.push('/auth')}
                className="flex-row items-center gap-1 rounded-xl bg-gray-100 border border-gray-200/80 px-3 py-2 active:bg-gray-200"
              >
                <Ionicons name="swap-horizontal" size={14} color="#374151" />
                <Text className="text-xs font-bold text-gray-800">Switch</Text>
              </TouchableOpacity>
            </View>

            <View className="mt-4 flex-row items-center justify-between border-t border-gray-100 pt-3">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="location" size={15} color={colors.primary} />
                <Text className="text-xs text-gray-600">
                  Registered Sector: <Text className="font-bold text-gray-900">{user.sector || 'G-11'}</Text>
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleLogout}
                className="flex-row items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 border border-red-200 active:bg-red-100"
              >
                <Ionicons name="log-out-outline" size={14} color="#DC2626" />
                <Text className="text-xs font-bold text-red-600">Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View className="mb-5 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-full bg-gray-200">
                  <Ionicons name="person-outline" size={20} color={colors.gray500} />
                </View>
                <View>
                  <Text className="text-sm font-bold text-gray-900">Guest User</Text>
                  <Text className="text-xs text-gray-500">Sign in to book and manage jobs</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/auth')}
              className="mt-3 rounded-xl bg-primary py-2.5 items-center active:bg-primaryActive"
            >
              <Text className="text-xs font-bold text-white">Sign In / Register</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Section 1: Default Location (Visual Chips + Accessible Input) */}
        <View className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <View className="flex-row items-center gap-2 mb-1">
            <Ionicons name="navigate-circle" size={20} color={colors.primary} />
            <Text className="text-base font-bold text-gray-900">
              Default Sector
            </Text>
          </View>
          <Text className="text-xs text-gray-500 mb-3">
            Aap ka ilaaqa — used automatically when you request a service without specifying location.
          </Text>

          {/* Quick Sector Tap Chips (Low-literacy friendly) */}
          <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            Quick Select (Aik touch se chunein):
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-3">
            {POPULAR_SECTORS.map((sec) => {
              const isSelected = locationInput.toUpperCase() === sec.toUpperCase();
              return (
                <TouchableOpacity
                  key={sec}
                  onPress={() => handleSectorSelect(sec)}
                  className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl border ${
                    isSelected
                      ? 'bg-primary border-primary'
                      : 'bg-gray-50 border-gray-200 active:bg-gray-100'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      isSelected ? 'text-white' : 'text-gray-700'
                    }`}
                  >
                    📍 {sec}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Text Input with Search Dropdown */}
          <TextInput
            className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-[15px] font-semibold text-gray-900"
            value={locationInput}
            onChangeText={handleLocationChange}
            onFocus={() => setShowDropdown(true)}
            onBlur={handleBlur}
            placeholder={`Or type sector e.g. ${DEFAULT_SECTOR}`}
            placeholderTextColor={colors.gray400}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          {showDropdown && filteredSectors.length > 0 && (
            <View className="mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md">
              {filteredSectors.slice(0, 5).map((sector) => (
                <Pressable
                  key={sector}
                  onPress={() => handleSectorSelect(sector)}
                  className="border-b border-gray-100 px-4 py-2.5 active:bg-orange-50 flex-row items-center justify-between"
                >
                  <Text
                    className={`text-sm ${
                      sector === locationInput
                        ? 'font-bold text-primary'
                        : 'text-gray-700'
                    }`}
                  >
                    📍 Sector {sector}
                  </Text>
                  {sector === locationInput && (
                    <Ionicons name="checkmark" size={16} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Section 2: Psychological Safety & Privacy Badge */}
        <View className="mb-5 rounded-2xl border border-green-200 bg-green-50/70 p-4">
          <View className="flex-row items-center gap-2 mb-1.5">
            <Ionicons name="shield-checkmark" size={20} color="#16A34A" />
            <Text className="text-sm font-bold text-green-900">
              Mehfooz & Verified Platform
            </Text>
          </View>
          <Text className="text-xs leading-4.5 text-green-800">
            Aap ka data aur phone number mehfooz hai. Direct call kar ke rate aur waqt tay karein. No hidden commission.
          </Text>
        </View>

        {/* Section 3: About Khidmat (Simple & Clear) */}
        <View className="mb-5 rounded-2xl border border-orange-100 bg-orange-50/50 p-4">
          <View className="flex-row items-center gap-2 mb-1.5">
            <Ionicons name="sparkles" size={18} color={colors.primary} />
            <Text className="text-sm font-bold text-gray-900">
              Khidmat AI Orchestrator
            </Text>
          </View>
          <Text className="text-xs leading-5 text-gray-600">
            Bolo aur Kaam Pao — Speak in Urdu or Roman Urdu to book verified technicians near you in Islamabad.
          </Text>
        </View>

        {/* Section 4: Clear Bookings / Reset */}
        <View className="mb-10">
          <TouchableOpacity
            onPress={handleClearBookings}
            className="flex-row items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50/40 py-3 active:bg-red-100"
          >
            <Ionicons name="trash-outline" size={16} color="#DC2626" />
            <Text className="text-xs font-bold text-red-600">
              Clear All Local Booking History
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

