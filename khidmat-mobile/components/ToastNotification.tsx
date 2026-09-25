import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useToastStore, ToastType } from '@/lib/stores/useToastStore';

interface ToastConfig {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  titleColor: string;
  badgeBg: string;
}

const TOAST_THEMES: Record<ToastType, ToastConfig> = {
  success: {
    icon: 'checkmark-circle-sharp',
    iconColor: '#059669', // Emerald 600
    bgColor: '#FFFFFF',
    borderColor: '#A7F3D0', // Emerald 200
    titleColor: '#065F46', // Emerald 800
    badgeBg: '#D1FAE5', // Emerald 100
  },
  info: {
    icon: 'information-circle-sharp',
    iconColor: '#EA580C', // Orange 600
    bgColor: '#FFFFFF',
    borderColor: '#FED7AA', // Orange 200
    titleColor: '#9A3412', // Orange 800
    badgeBg: '#FFEDD5', // Orange 100
  },
  warning: {
    icon: 'alert-circle-sharp',
    iconColor: '#D97706', // Amber 600
    bgColor: '#FFFFFF',
    borderColor: '#FDE68A', // Amber 200
    titleColor: '#92400E', // Amber 800
    badgeBg: '#FEF3C7', // Amber 100
  },
  error: {
    icon: 'close-circle-sharp',
    iconColor: '#DC2626', // Red 600
    bgColor: '#FFFFFF',
    borderColor: '#FECACA', // Red 200
    titleColor: '#991B1B', // Red 800
    badgeBg: '#FEE2E2', // Red 100
  },
};

export const ToastNotification: React.FC = () => {
  const currentToast = useToastStore((s) => s.currentToast);
  const hideToast = useToastStore((s) => s.hideToast);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Animations: slide in from right (+X) and fade in
  const translateY = useRef(new Animated.Value(-20)).current;
  const translateX = useRef(new Animated.Value(40)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (currentToast) {
      // Reset values
      translateY.setValue(-20);
      translateX.setValue(40);
      opacity.setValue(0);

      // Spring in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 70,
          friction: 9,
        }),
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 70,
          friction: 9,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();

      // Schedule auto dismiss
      const duration = currentToast.duration ?? 3500;
      timerRef.current = setTimeout(() => {
        dismissToast();
      }, duration);
    } else {
      opacity.setValue(0);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentToast?.id]);

  const dismissToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -20,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 30,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      hideToast();
    });
  };

  if (!currentToast) return null;

  const theme = TOAST_THEMES[currentToast.type] || TOAST_THEMES.info;
  const maxToastWidth = Math.min(width - 32, 340);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.overlayContainer,
        {
          top: Math.max(insets.top + 6, 16),
        },
      ]}
    >
      <Animated.View
        style={[
          styles.toastCard,
          {
            width: maxToastWidth,
            backgroundColor: theme.bgColor,
            borderColor: theme.borderColor,
            opacity,
            transform: [{ translateY }, { translateX }],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={dismissToast}
          style={styles.innerRow}
        >
          {/* Icon Badge */}
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: theme.badgeBg },
            ]}
          >
            <Ionicons name={theme.icon} size={22} color={theme.iconColor} />
          </View>

          {/* Text Content */}
          <View style={styles.textContainer}>
            <Text
              numberOfLines={1}
              style={[styles.titleText, { color: theme.titleColor }]}
            >
              {currentToast.title}
            </Text>
            {Boolean(currentToast.message) && (
              <Text numberOfLines={2} style={styles.messageText}>
                {currentToast.message}
              </Text>
            )}
          </View>

          {/* Close button */}
          <TouchableOpacity
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={dismissToast}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    right: 16,
    zIndex: 99999,
    alignItems: 'flex-end',
    elevation: 99999,
  },
  toastCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  messageText: {
    fontSize: 12,
    color: '#4B5563', // gray 600
    marginTop: 2,
    lineHeight: 16,
    fontWeight: '400',
  },
  closeBtn: {
    padding: 4,
    borderRadius: 8,
    marginLeft: 2,
  },
});
