import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme/colors';

interface ExplainableRationaleBadgeProps {
  rationale: string;
}

export function ExplainableRationaleBadge({ rationale }: ExplainableRationaleBadgeProps) {
  return (
    <View className="mt-2.5 flex-row items-start gap-2 rounded-xl bg-blue-50/80 p-2.5 border border-blue-100">
      <Ionicons name="hardware-chip-outline" size={16} color={colors.blue800} />
      <View className="flex-1">
        <Text className="text-[11px] font-bold text-blue-900">
          AI Agent Match Rationale
        </Text>
        <Text className="mt-0.5 text-xs text-blue-800 leading-4">
          {rationale}
        </Text>
      </View>
    </View>
  );
}
