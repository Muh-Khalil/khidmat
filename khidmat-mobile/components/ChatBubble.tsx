import React from 'react';
import { View, Text } from 'react-native';

type ChatBubbleTone = 'default' | 'success';

type ChatBubbleProps = {
  side: 'user' | 'agent';
  tone?: ChatBubbleTone;
  children: React.ReactNode;
};

// User bubbles ignore tone; agent bubbles vary by tone.
const USER_STYLE = { bg: 'bg-primary', text: 'text-white' } as const;
const AGENT_STYLES: Record<ChatBubbleTone, { bg: string; text: string }> = {
  default: { bg: 'bg-gray-100', text: 'text-gray-900' },
  success: { bg: 'bg-green-50', text: 'text-green-900' },
};

export function ChatBubble({
  side,
  tone = 'default',
  children,
}: ChatBubbleProps) {
  const isUser = side === 'user';

  const containerAlign = isUser ? 'items-end' : 'items-start';
  const { bg: bubbleBg, text: textColor } = isUser
    ? USER_STYLE
    : AGENT_STYLES[tone];

  return (
    <View className={`mb-2 ${containerAlign}`}>
      <View
        className={`max-w-[85%] px-4 py-3 ${bubbleBg} ${
          isUser
            ? 'rounded-2xl rounded-br-md'
            : 'rounded-2xl rounded-bl-md'
        }`}
      >
        {typeof children === 'string' ? (
          <Text className={`text-[15px] leading-5 ${textColor}`}>
            {children}
          </Text>
        ) : (
          <View>{children}</View>
        )}
      </View>
    </View>
  );
}
