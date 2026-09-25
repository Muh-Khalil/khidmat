import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  ActivityIndicator,
  Animated,
  PanResponder,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '@/lib/theme/colors';
import { toast } from '@/lib/stores/useToastStore';
import {
  startVoiceRecording,
  stopVoiceRecordingAndTranscribe,
  cancelVoiceRecording,
} from '@/lib/services/voiceService';

type InputBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: (customText?: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function InputBar({
  value,
  onChangeText,
  onSend,
  placeholder = 'Awaaz ke liye mic dabaye rakhein...',
  disabled = false,
}: InputBarProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isCancelledVisual, setIsCancelledVisual] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const isCancelledRef = useRef<boolean>(false);
  const isRecordingRef = useRef<boolean>(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation for active recording
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (isRecording) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    } else {
      pulseAnim.setValue(1);
    }

    return () => {
      if (loop) loop.stop();
    };
  }, [isRecording, pulseAnim]);

  // Slide chevron animation
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (isRecording && !isCancelledVisual) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(slideAnim, {
            toValue: -8,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    } else {
      slideAnim.setValue(0);
    }

    return () => {
      if (loop) loop.stop();
    };
  }, [isRecording, isCancelledVisual, slideAnim]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      cancelVoiceRecording().catch(() => {});
    };
  }, []);

  const startTimer = () => {
    setRecordSeconds(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRecordSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // WhatsApp-Style PanResponder: Hold to Speak & Slide to Cancel
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: async () => {
        if (disabled || isTranscribing || isRecordingRef.current) return;

        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          startTimeRef.current = Date.now();
          isCancelledRef.current = false;
          setIsCancelledVisual(false);

          isRecordingRef.current = true;
          setIsRecording(true);
          startTimer();

          await startVoiceRecording();
        } catch (err: any) {
          console.error('[InputBar] Failed to start voice recording:', err);
          stopTimer();
          isRecordingRef.current = false;
          setIsRecording(false);
          toast.error(
            'Microphone Access Needed',
            'Please allow microphone permission in your device settings.',
          );
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      },

      onPanResponderMove: (_evt, gestureState) => {
        if (!isRecordingRef.current) return;

        // User swiped left by 50px or more -> mark as cancelled
        if (gestureState.dx < -50) {
          if (!isCancelledRef.current) {
            isCancelledRef.current = true;
            setIsCancelledVisual(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        } else if (gestureState.dx > -30) {
          if (isCancelledRef.current) {
            isCancelledRef.current = false;
            setIsCancelledVisual(false);
          }
        }
      },

      onPanResponderRelease: async () => {
        if (!isRecordingRef.current) return;

        const duration = Date.now() - startTimeRef.current;
        stopTimer();
        isRecordingRef.current = false;
        setIsRecording(false);

        // Case 1: Swiped left to cancel
        if (isCancelledRef.current) {
          setIsCancelledVisual(false);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          await cancelVoiceRecording().catch(() => {});
          toast.info('Cancelled', 'Awaaz delete ho gayi.');
          return;
        }

        // Case 2: Tap was too short (under 600ms)
        if (duration < 600) {
          await cancelVoiceRecording().catch(() => {});
          toast.info(
            'Daba kar rakhein',
            'Bolne ke liye mic ko daba kar rakhein aur chorrne par send hoga.',
          );
          return;
        }

        // Case 3: Valid recording -> Transcribe and AUTO-SEND!
        setIsTranscribing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
          const result = await stopVoiceRecordingAndTranscribe();
          setIsTranscribing(false);
          setRecordSeconds(0);

          const recognizedText = (result.normalizedText || result.rawTranscript || '').trim();

          if (recognizedText) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Instant 1-step dispatch for low digital literacy
            onSend(recognizedText);
            toast.success(
              'Voice Sent',
              result.language === 'ur' || result.language === 'ur-Latn'
                ? `Bheja gaya: "${recognizedText}"`
                : recognizedText,
            );
          } else {
            toast.warning('No Speech Detected', 'Awaaz samajh nahi aayi. Baraye meherbani dobara bolein.');
          }
        } catch (err: any) {
          setIsTranscribing(false);
          setRecordSeconds(0);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          toast.error(
            'Voice Processing Failed',
            'Awaaz process nahi ho saki. Internet connection check karein.',
          );
        }
      },

      onPanResponderTerminate: async () => {
        if (isRecordingRef.current) {
          stopTimer();
          isRecordingRef.current = false;
          setIsRecording(false);
          setIsCancelledVisual(false);
          await cancelVoiceRecording().catch(() => {});
        }
      },
    }),
  ).current;

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const hasText = value.trim().length > 0;

  return (
    <View className="border-t border-gray-100 bg-white px-3 pb-2 pt-2">
      {/* Transcribing & Auto-Sending Indicator */}
      {isTranscribing && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FFF7ED',
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#FED7AA',
            marginBottom: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ marginLeft: 10, fontSize: 12, fontWeight: '700', color: colors.primary }}>
              Awaaz se message bheja ja raha hai...
            </Text>
          </View>
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#6B7280' }}>Gemini AI</Text>
        </View>
      )}

      {/* ── UNIFIED ROW: LEFT INPUT/STATUS & CONTINUOUS RIGHT MIC BUTTON ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Left Side: EITHER TextInput OR Recording Waveform Bar */}
        {isRecording ? (
          <View
            style={{
              flex: 1,
              height: 48,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#FFF7ED',
              borderColor: isCancelledVisual ? '#F87171' : '#FDBA74',
              borderWidth: 1.5,
              borderRadius: 24,
              paddingHorizontal: 14,
              marginRight: 8,
            }}
          >
            {/* Recording Timer & Red Pulse Dot */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Animated.View
                style={{
                  transform: [{ scale: pulseAnim }],
                  height: 12,
                  width: 12,
                  borderRadius: 6,
                  backgroundColor: isCancelledVisual ? '#DC2626' : '#EF4444',
                  marginRight: 8,
                }}
              />
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827' }}>
                {formatTime(recordSeconds)}
              </Text>
            </View>

            {/* Slide to Cancel or Cancelled State */}
            {isCancelledVisual ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="trash" size={17} color="#DC2626" />
                <Text style={{ marginLeft: 6, fontSize: 12, fontWeight: '700', color: '#DC2626' }}>
                  Chorrne par delete hoga
                </Text>
              </View>
            ) : (
              <Animated.View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  transform: [{ translateX: slideAnim }],
                }}
              >
                <Ionicons name="chevron-back" size={15} color="#9CA3AF" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280' }}>
                  ‹ Baen khainchein (Cancel)
                </Text>
              </Animated.View>
            )}
          </View>
        ) : (
          <TextInput
            style={{
              flex: 1,
              minHeight: 48,
              maxHeight: 96,
              borderRadius: 24,
              backgroundColor: '#F9FAFB',
              borderWidth: 1,
              borderColor: '#E5E7EB',
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontSize: 14,
              color: '#111827',
              marginRight: 8,
            }}
            placeholder={placeholder}
            placeholderTextColor={colors.gray400}
            value={value}
            onChangeText={onChangeText}
            multiline
            editable={!disabled && !isTranscribing}
            textAlignVertical="center"
          />
        )}

        {/* Right Side: EITHER typed Send button OR Continuously Mounted PanResponder Mic Button */}
        {hasText && !isRecording ? (
          <TouchableOpacity
            onPress={() => onSend()}
            disabled={disabled || isTranscribing}
            activeOpacity={0.8}
            style={{
              height: 48,
              width: 48,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 24,
              backgroundColor: colors.primary,
            }}
            accessibilityLabel="Send typed message"
          >
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <View
            {...panResponder.panHandlers}
            style={{
              height: 48,
              width: 48,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 24,
              backgroundColor: isRecording
                ? (isCancelledVisual ? '#DC2626' : colors.primary)
                : (isTranscribing ? '#F3F4F6' : '#FFF7ED'),
              borderWidth: isRecording ? 0 : 1.5,
              borderColor: isTranscribing ? '#E5E7EB' : colors.primary,
              opacity: isTranscribing ? 0.6 : 1,
            }}
            accessibilityLabel="Hold to speak voice request"
          >
            <Ionicons
              name={isRecording && isCancelledVisual ? 'trash' : 'mic'}
              size={24}
              color={isRecording ? '#FFFFFF' : colors.primary}
            />
          </View>
        )}
      </View>

      {/* Helper Micro-Hint for Novice / Low Digital Literacy Users */}
      {!isRecording && !isTranscribing && !hasText && (
        <View style={{ marginTop: 4, alignItems: 'center' }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#9CA3AF' }}>
            🎙️ Mic ko <Text style={{ color: colors.primary, fontWeight: '700' }}>daba kar rakhein</Text> aur bolein (Hold to speak)
          </Text>
        </View>
      )}
    </View>
  );
}
