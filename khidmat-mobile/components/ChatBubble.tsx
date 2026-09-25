import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme/colors';

type ChatBubbleTone = 'default' | 'success';

type ChatBubbleProps = {
  side: 'user' | 'agent';
  tone?: ChatBubbleTone;
  children: React.ReactNode;
};

export function ChatBubble({
  side,
  tone = 'default',
  children,
}: ChatBubbleProps) {
  const isUser = side === 'user';

  if (isUser) {
    return (
      <View style={{ marginBottom: 12, alignItems: 'flex-end', paddingLeft: 40 }}>
        <View
          style={{
            backgroundColor: '#F97316',
            borderRadius: 20,
            borderBottomRightRadius: 4,
            paddingHorizontal: 16,
            paddingVertical: 12,
            shadowColor: '#EA580C',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          {typeof children === 'string' ? (
            <Text style={{ fontSize: 15, lineHeight: 22, color: '#FFFFFF', fontWeight: '600' }}>
              {children}
            </Text>
          ) : (
            children
          )}
        </View>
      </View>
    );
  }

  // Agent bubble with Khidmat AI Avatar
  const isSuccess = tone === 'success';

  return (
    <View
      style={{
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingRight: 16,
      }}
    >
      {/* Khidmat AI Sparkle Icon Avatar */}
      <View
        style={{
          height: 28,
          width: 28,
          borderRadius: 14,
          backgroundColor: '#FFF7ED',
          borderWidth: 1.5,
          borderColor: '#FED7AA',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 8,
          marginTop: 2,
        }}
      >
        <Ionicons name="sparkles" size={13} color={colors.primary} />
      </View>

      <View
        style={{
          flex: 1,
          backgroundColor: isSuccess ? '#F0FDF4' : '#FFFFFF',
          borderRadius: 20,
          borderTopLeftRadius: 4,
          borderWidth: 1,
          borderColor: isSuccess ? '#BBF7D0' : '#E5E7EB',
          paddingHorizontal: 16,
          paddingVertical: 12,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 3,
          elevation: 1,
        }}
      >
        {typeof children === 'string' ? (
          <Text
            style={{
              fontSize: 15,
              lineHeight: 22,
              color: isSuccess ? '#166534' : '#1F2937',
              fontWeight: '500',
            }}
          >
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}
