import React from 'react';
import { View, Text, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme/colors';
import { User } from '@/lib/stores/useAuthStore';

interface ProviderHeaderProps {
  user: User;
  isOnline: boolean;
  onToggleOnline: (val: boolean) => void;
  onSwitchRole: () => void;
  pendingJobsCount: number;
  totalDuesAmount: number;
}

export function ProviderHeader({
  user,
  isOnline,
  onToggleOnline,
  onSwitchRole,
  pendingJobsCount,
  totalDuesAmount,
}: ProviderHeaderProps) {
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <View className="mb-4 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
      {/* Top row: Profile & Availability Switch */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10 border border-primary/30">
            <Text className="text-base font-bold text-primary">{initials}</Text>
          </View>
          <View>
            <View className="flex-row items-center gap-2">
              <Text className="text-base font-bold text-gray-900">{user.name}</Text>
              <View className="rounded-full bg-amber-100 px-2 py-0.5">
                <Text className="text-[10px] font-bold text-amber-800">
                  Karigar Pro
                </Text>
              </View>
            </View>
            <Text className="text-xs text-gray-500">
              Sector: {user.sector || 'F-7'} • 4.9 ★ (48 reviews)
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onSwitchRole}
          className="rounded-lg bg-gray-100 px-2.5 py-1.5 active:bg-gray-200"
        >
          <Text className="text-xs font-semibold text-gray-600">Switch Role</Text>
        </TouchableOpacity>
      </View>

      {/* Online Availability Toggle Bar */}
      <View className="mt-4 flex-row items-center justify-between rounded-xl bg-gray-50 p-3 border border-gray-100 gap-3">
        <View className="flex-1 flex-row items-center gap-2">
          <View
            className={`h-3 w-3 rounded-full ${
              isOnline ? 'bg-green-500' : 'bg-gray-400'
            }`}
          />
          <Text className="flex-shrink text-xs font-bold text-gray-900">
            {isOnline ? 'Accepting Jobs (Online)' : 'Offline (Not Receiving Jobs)'}
          </Text>
        </View>
        <Switch
          value={isOnline}
          onValueChange={onToggleOnline}
          trackColor={{ false: colors.gray400, true: colors.primary }}
          thumbColor="#FFFFFF"
        />
      </View>

      {/* Micro Metrics Strip */}
      <View className="mt-3 flex-row gap-3">
        <View className="flex-1 rounded-xl bg-orange-50/70 p-3 border border-orange-100">
          <Text className="text-[11px] font-semibold text-gray-500">Active Requests</Text>
          <Text className="mt-0.5 text-lg font-bold text-primary">
            {pendingJobsCount} Pending
          </Text>
        </View>

        <View className="flex-1 rounded-xl bg-amber-50/70 p-3 border border-amber-100">
          <Text className="text-[11px] font-semibold text-gray-500">Customer Dues</Text>
          <Text className="mt-0.5 text-lg font-bold text-amber-900">
            Rs {totalDuesAmount.toLocaleString()}
          </Text>
        </View>
      </View>
    </View>
  );
}
