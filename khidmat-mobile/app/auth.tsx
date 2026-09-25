import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore, UserRole } from '@/lib/stores/useAuthStore';
import { toast } from '@/lib/stores/useToastStore';
import { colors } from '@/lib/theme/colors';
import { SECTORS } from '@/lib/mock/providers';

export default function AuthScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const signup = useAuthStore((s) => s.signup);

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [role, setRole] = useState<UserRole>('customer');

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sector, setSector] = useState('F-7');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleClose = () => {
    try {
      if (router.canDismiss && router.canDismiss()) {
        router.dismiss();
      } else if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    } catch {
      try {
        router.replace('/(tabs)');
      } catch (err) {
        console.warn('Navigation close error:', err);
      }
    }
  };

  const validateForm = () => {
    setErrorMsg('');
    if (!phone.trim()) {
      setErrorMsg('Please enter your phone number');
      return false;
    }
    if (!password.trim() || password.length < 4) {
      setErrorMsg('Password must be at least 4 characters');
      return false;
    }
    if (mode === 'signup' && !name.trim()) {
      setErrorMsg('Please enter your full name');
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      const formattedPhone = phone.startsWith('+92')
        ? phone
        : `+92 ${phone.replace(/^0+/, '')}`;

      if (mode === 'login') {
        login({
          name: name.trim() || (role === 'provider' ? 'Tariq Electrician' : 'Customer Account'),
          phone: formattedPhone,
          email: email.trim() || 'user@khidmat.pk',
          role,
          sector,
        });
        toast.success(
          'Welcome Back!',
          `Signed in as ${role === 'provider' ? 'Service Provider' : 'Customer'}.`,
        );
        handleClose();
      } else {
        signup({
          name: name.trim(),
          phone: formattedPhone,
          email: email.trim(),
          role,
          sector,
        });
        toast.success('Account Created!', 'Your Khidmat account has been registered.');
        handleClose();
      }
    }, 600);
  };

  const handleQuickDemoLogin = (demoRole: UserRole) => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      if (demoRole === 'customer') {
        login({
          id: 'usr_demo_customer',
          name: 'Ahmed Hassan',
          phone: '+92 300 1234567',
          email: 'ahmed.hassan@example.com',
          role: 'customer',
          sector: 'F-7',
        });
        toast.success('Demo Active', 'Signed in as Customer (Ahmed Hassan).');
      } else {
        login({
          id: 'usr_demo_provider',
          name: 'Tariq Mehmood (Electrician)',
          phone: '+92 321 9876543',
          email: 'tariq.services@example.com',
          role: 'provider',
          sector: 'G-11',
        });
        toast.success('Demo Active', 'Signed in as Provider (Tariq Mehmood).');
      }
      handleClose();
    }, 400);
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Top Header */}
        <View className="flex-row items-center justify-between border-b border-gray-100 px-5 py-3">
          <View className="flex-row items-center gap-2">
            <View className="h-8 w-8 items-center justify-center rounded-xl bg-primary">
              <Ionicons name="flash-sharp" size={18} color="#FFFFFF" />
            </View>
            <Text className="text-lg font-bold text-gray-900">Khidmat Auth</Text>
          </View>
          <TouchableOpacity
            onPress={handleClose}
            className="h-9 w-9 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
          >
            <Ionicons name="close" size={20} color={colors.gray500} />
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1 px-5 pt-4"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero Banner */}
          <View className="mb-6 rounded-2xl bg-orange-50/70 p-4 border border-orange-100">
            <Text className="text-xl font-bold text-gray-900">
              {mode === 'login' ? 'Welcome Back 👋' : 'Join Khidmat Ecosystem'}
            </Text>
            <Text className="mt-1 text-xs leading-4 text-gray-600">
              Access AI-orchestrated micro-tasks, verified home service providers & real-time bookings.
            </Text>
          </View>

          {/* Mode Switcher Tabs */}
          <View className="mb-5 flex-row rounded-xl bg-gray-100 p-1">
            <TouchableOpacity
              onPress={() => {
                setMode('login');
                setErrorMsg('');
              }}
              style={mode === 'login' ? { backgroundColor: '#FFFFFF', elevation: 1 } : undefined}
              className="flex-1 items-center py-2.5 rounded-lg"
            >
              <Text
                className={`text-sm font-semibold ${
                  mode === 'login' ? 'text-primary font-bold' : 'text-gray-500'
                }`}
              >
                Sign In
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setMode('signup');
                setErrorMsg('');
              }}
              style={mode === 'signup' ? { backgroundColor: '#FFFFFF', elevation: 1 } : undefined}
              className="flex-1 items-center py-2.5 rounded-lg"
            >
              <Text
                className={`text-sm font-semibold ${
                  mode === 'signup' ? 'text-primary font-bold' : 'text-gray-500'
                }`}
              >
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          {/* Account Role Selector */}
          <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
            Account Type
          </Text>
          <View className="mb-5 flex-row gap-3">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setRole('customer')}
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl border p-3 ${
                role === 'customer'
                  ? 'border-primary bg-orange-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <Ionicons
                name="person-outline"
                size={18}
                color={role === 'customer' ? colors.primary : colors.gray500}
              />
              <Text
                className={`text-sm font-semibold ${
                  role === 'customer' ? 'text-primary font-bold' : 'text-gray-600'
                }`}
              >
                Customer
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setRole('provider')}
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl border p-3 ${
                role === 'provider'
                  ? 'border-primary bg-orange-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <Ionicons
                name="construct-outline"
                size={18}
                color={role === 'provider' ? colors.primary : colors.gray500}
              />
              <Text
                className={`text-sm font-semibold ${
                  role === 'provider' ? 'text-primary font-bold' : 'text-gray-600'
                }`}
              >
                Provider 
              </Text>
            </TouchableOpacity>
          </View>

          {/* Validation Error Banner */}
          {errorMsg ? (
            <View className="mb-4 flex-row items-center gap-2 rounded-xl bg-red-50 p-3 border border-red-100">
              <Ionicons name="alert-circle" size={18} color="#EF4444" />
              <Text className="flex-1 text-xs font-medium text-red-600">
                {errorMsg}
              </Text>
            </View>
          ) : null}

          {/* Form Fields */}
          {mode === 'signup' && (
            <View className="mb-4">
              <Text className="mb-1.5 text-xs font-bold text-gray-700">Full Name</Text>
              <View className="flex-row items-center rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3">
                <Ionicons name="person-outline" size={18} color={colors.gray400} />
                <TextInput
                  className="ml-2.5 flex-1 text-sm text-gray-900"
                  placeholder="e.g. Ahmed Hassan"
                  placeholderTextColor={colors.gray400}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </View>
          )}

          {/* Phone Number Field */}
          <View className="mb-4">
            <Text className="mb-1.5 text-xs font-bold text-gray-700">Mobile Phone Number</Text>
            <View className="flex-row items-center rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3">
              <Ionicons name="call-outline" size={18} color={colors.gray400} />
              <Text className="ml-2.5 font-semibold text-gray-600 text-sm">+92</Text>
              <View className="mx-2 h-4 w-[1px] bg-gray-300" />
              <TextInput
                className="flex-1 text-sm text-gray-900"
                placeholder="300 1234567"
                placeholderTextColor={colors.gray400}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>

          {/* Email Field (Optional for Sign In, included for Sign Up) */}
          {mode === 'signup' && (
            <View className="mb-4">
              <Text className="mb-1.5 text-xs font-bold text-gray-700">Email Address (Optional)</Text>
              <View className="flex-row items-center rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3">
                <Ionicons name="mail-outline" size={18} color={colors.gray400} />
                <TextInput
                  className="ml-2.5 flex-1 text-sm text-gray-900"
                  placeholder="name@example.com"
                  placeholderTextColor={colors.gray400}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>
          )}

          {/* Sector / Location Picker (For Sign Up) */}
          {mode === 'signup' && (
            <View className="mb-4">
              <Text className="mb-1.5 text-xs font-bold text-gray-700">Sector / City Area</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
                {SECTORS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    activeOpacity={0.8}
                    onPress={() => setSector(s)}
                    className={`mr-2 rounded-lg px-3 py-1.5 border ${
                      sector === s
                        ? 'border-primary bg-primary'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        sector === s ? 'text-white font-bold' : 'text-gray-700'
                      }`}
                    >
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Password Field */}
          <View className="mb-6">
            <Text className="mb-1.5 text-xs font-bold text-gray-700">Password / PIN</Text>
            <View className="flex-row items-center rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3">
              <Ionicons name="lock-closed-outline" size={18} color={colors.gray400} />
              <TextInput
                className="ml-2.5 flex-1 text-sm text-gray-900"
                placeholder="••••••••"
                placeholderTextColor={colors.gray400}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={colors.gray500}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            disabled={isLoading}
            onPress={handleSubmit}
            activeOpacity={0.85}
            className={`items-center justify-center rounded-xl bg-primary py-3.5 px-6 shadow-sm active:bg-primaryActive ${
              isLoading ? 'opacity-60' : ''
            }`}
          >
            <Text className="text-white font-bold text-sm">
              {isLoading
                ? 'Processing...'
                : mode === 'login'
                ? 'Sign In to Khidmat'
                : 'Create Account'}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View className="my-6 flex-row items-center">
            <View className="flex-1 h-[1px] bg-gray-200" />
            <Text className="mx-3 text-xs font-medium text-gray-400">OR QUICK TESTING</Text>
            <View className="flex-1 h-[1px] bg-gray-200" />
          </View>

          {/* Quick Demo Login Options */}
          <View className="mb-8 gap-3">
            <TouchableOpacity
              onPress={() => handleQuickDemoLogin('customer')}
              className="flex-row items-center justify-between rounded-xl bg-gray-50 border border-gray-200 p-3.5 active:bg-gray-100"
            >
              <View className="flex-row items-center gap-2.5">
                <Ionicons name="person-circle-outline" size={22} color={colors.primary} />
                <View>
                  <Text className="text-xs font-bold text-gray-900">Demo Customer Account</Text>
                  <Text className="text-[11px] text-gray-500">Ahmed Hassan (+92 300 1234567)</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleQuickDemoLogin('provider')}
              className="flex-row items-center justify-between rounded-xl bg-gray-50 border border-gray-200 p-3.5 active:bg-gray-100"
            >
              <View className="flex-row items-center gap-2.5">
                <Ionicons name="build-outline" size={20} color={colors.primary} />
                <View>
                  <Text className="text-xs font-bold text-gray-900">Demo Provider (Karigar)</Text>
                  <Text className="text-[11px] text-gray-500">Tariq Mehmood (Electrician)</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
