import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme/colors';

type ExtractedFieldsRowProps = {
  service: string | null;
  location: string | null;
  time: string | null;
};

// Placeholder shown for a field the agent couldn't extract.
const EMPTY = {
  bg: 'bg-gray-200',
  text: 'text-gray-500',
  iconColor: colors.gray500,
} as const;

export function ExtractedFieldsRow({
  service,
  location,
  time,
}: ExtractedFieldsRowProps) {
  const fields = [
    {
      icon: 'construct' as const,
      value: service,
      bg: 'bg-primary-100',
      text: 'text-primary-800',
      iconColor: colors.primary800,
    },
    {
      icon: 'location' as const,
      value: location,
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      iconColor: colors.blue800,
    },
    {
      icon: 'time' as const,
      value: time,
      bg: 'bg-purple-100',
      text: 'text-purple-800',
      iconColor: colors.purple800,
    },
  ];

  return (
    <View className="mt-2 flex-row flex-wrap gap-2">
      {fields.map((field) => {
        const style = field.value ? field : EMPTY;
        return (
          <View
            key={field.icon}
            className={`flex-row items-center rounded-full px-3 py-1.5 ${style.bg}`}
          >
            <Ionicons name={field.icon} size={13} color={style.iconColor} />
            <Text
              className={`ml-1.5 text-xs font-semibold capitalize ${style.text}`}
            >
              {field.value ?? 'Unknown'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
