import React, { useState } from 'react';
import { View, TextInput, Pressable, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '@/lib/theme/colors';

type InputBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
};

const SAMPLE_VOICE_TRANSCRIPTS = [
  'Mujhe kal subah G-13 mein AC technician chahiye',
  'Plumber abhi chahiye, bathroom mein leak hai',
  'Electrical DB box repair specialist in F-7',
];

export function InputBar({
  value,
  onChangeText,
  onSend,
  placeholder = 'Type or tap mic for voice request...',
  disabled = false,
}: InputBarProps) {
  const [isListening, setIsListening] = useState(false);

  const isEmpty = value.trim().length === 0;
  const sendDisabled = isEmpty || disabled;

  const handleVoicePress = () => {
    if (disabled) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsListening(true);

    setTimeout(() => {
      setIsListening(false);
      const randomTranscript =
        SAMPLE_VOICE_TRANSCRIPTS[
          Math.floor(Math.random() * SAMPLE_VOICE_TRANSCRIPTS.length)
        ];
      onChangeText(randomTranscript);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 1500);
  };

  return (
    <View className="border-t border-gray-100 bg-white px-3 pb-2 pt-2">
      {/* Listening Status Banner */}
      {isListening && (
        <View className="mb-2 flex-row items-center justify-between rounded-xl bg-orange-50 px-3.5 py-2 border border-orange-200">
          <View className="flex-row items-center gap-2">
            <View className="h-2.5 w-2.5 rounded-full bg-primary animate-ping" />
            <Text className="text-xs font-bold text-primary">
              Listening to Voice Note (Urdu / Roman Urdu)...
            </Text>
          </View>
          <Text className="text-[11px] font-semibold text-gray-500">ASR Active</Text>
        </View>
      )}

      <View className="flex-row items-end">
        {/* Mic Voice Button */}
        <TouchableOpacity
          onPress={handleVoicePress}
          disabled={disabled || isListening}
          className={`mr-2 h-11 w-11 items-center justify-center rounded-2xl border ${
            isListening
              ? 'border-primary bg-orange-100'
              : 'border-gray-200 bg-gray-50 active:bg-gray-100'
          }`}
        >
          <Ionicons
            name={isListening ? 'mic' : 'mic-outline'}
            size={20}
            color={isListening ? colors.primary : colors.gray500}
          />
        </TouchableOpacity>

        <TextInput
          className="mr-2 max-h-24 min-h-[44px] flex-1 rounded-2xl bg-gray-50 px-4 py-3 text-[15px] text-gray-900"
          placeholder={placeholder}
          placeholderTextColor={colors.gray400}
          value={value}
          onChangeText={onChangeText}
          multiline
          editable={!disabled}
          textAlignVertical="top"
        />

        <Pressable
          onPress={onSend}
          disabled={sendDisabled}
          className={`h-11 w-11 items-center justify-center rounded-full ${
            sendDisabled ? 'bg-gray-200' : 'bg-primary active:bg-primaryActive'
          }`}
        >
          <Ionicons
            name="send"
            size={18}
            color={sendDisabled ? colors.gray400 : colors.white}
          />
        </Pressable>
      </View>
    </View>
  );
}

