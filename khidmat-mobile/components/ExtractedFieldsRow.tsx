import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ExtractedFieldsRowProps = {
  service: string | null;
  location: string | null;
  time: string | null;
};

export function ExtractedFieldsRow({
  service,
  location,
  time,
}: ExtractedFieldsRowProps) {
  const fields = [
    {
      icon: 'construct-sharp' as const,
      value: service,
      bgColor: '#FFF7ED',
      borderColor: '#FDBA74',
      textColor: '#9A3412',
      iconColor: '#EA580C',
      fallback: 'General Service',
    },
    {
      icon: 'location-sharp' as const,
      value: location,
      bgColor: '#EFF6FF',
      borderColor: '#BFDBFE',
      textColor: '#1E40AF',
      iconColor: '#2563EB',
      fallback: 'Location Not Set',
    },
    {
      icon: 'time' as const,
      value: time,
      bgColor: '#FAF5FF',
      borderColor: '#E9D5FF',
      textColor: '#6B21A8',
      iconColor: '#7C3AED',
      fallback: 'As Soon As Possible',
    },
  ];

  return (
    <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {fields.map((field, idx) => {
        const textValue = field.value || field.fallback;
        return (
          <View
            key={idx}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: field.bgColor,
              borderColor: field.borderColor,
              borderWidth: 1,
              borderRadius: 12,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <Ionicons name={field.icon} size={12} color={field.iconColor} />
            <Text
              style={{
                marginLeft: 5,
                fontSize: 12,
                fontWeight: '700',
                color: field.textColor,
                textTransform: 'capitalize',
              }}
            >
              {textValue}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
