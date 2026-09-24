import React from 'react';
import { Pressable, Text } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'destructive';

type ButtonProps = {
  variant?: ButtonVariant;
  onPress: () => void;
  children: React.ReactNode;
  disabled?: boolean;
};

const BASE = 'items-center justify-center rounded-xl py-3 px-6';

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-primary active:bg-primary-600',
  secondary: 'bg-gray-100 active:bg-gray-200',
  destructive: 'border border-red-300 bg-white active:bg-red-50',
};

const TEXT_STYLES: Record<ButtonVariant, string> = {
  primary: 'text-white font-bold text-sm',
  secondary: 'text-gray-900 font-semibold text-sm',
  destructive: 'text-red-600 font-semibold text-sm',
};

export function Button({
  variant = 'primary',
  onPress,
  children,
  disabled = false,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`${BASE} ${VARIANT_STYLES[variant]} ${disabled ? 'opacity-50' : ''}`}
    >
      <Text className={TEXT_STYLES[variant]}>{children}</Text>
    </Pressable>
  );
}
