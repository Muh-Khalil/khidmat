import React from 'react';
import { View, Text } from 'react-native';
import type { BookingStatus } from '@/lib/stores/useBookingsStore';

type StatusBadgeProps = {
  status: BookingStatus;
};

const STATUS_STYLES: Record<
  BookingStatus,
  { bg: string; text: string; label: string }
> = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Waiting • Intezaar' },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Confirmed' },
  on_the_way: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Raste Mein 🛵' },
  reminded: {
    bg: 'bg-primary-100',
    text: 'text-primary-700',
    label: 'Reminded',
  },
  completed: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    label: 'Completed',
  },
  cancelled: {
    bg: 'bg-gray-100',
    text: 'text-gray-500',
    label: 'Cancelled',
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;

  return (
    <View className={`rounded-full px-3 py-1 ${style.bg}`}>
      <Text className={`text-xs font-semibold ${style.text}`}>
        {style.label}
      </Text>
    </View>
  );
}
