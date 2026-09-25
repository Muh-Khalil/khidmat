import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useAuthStore, UserRole, Coordinates } from '@/lib/stores/useAuthStore';
import { useSettingsStore } from '@/lib/stores/useSettingsStore';
import { getCurrentUserLocation } from '@/lib/services/locationService';
import { toast } from '@/lib/stores/useToastStore';
import { colors } from '@/lib/theme/colors';

// Human-readable city/area list for manual fallback (Islamabad & Rawalpindi)
interface AreaOption {
  id: string;
  name: string;
  city: string;
  popular?: boolean;
}

const POPULAR_AREAS: AreaOption[] = [
  // Islamabad Sectors
  { id: 'isb_g11', name: 'Sector G-11', city: 'Islamabad', popular: true },
  { id: 'isb_g13', name: 'Sector G-13', city: 'Islamabad', popular: true },
  { id: 'isb_f7', name: 'Sector F-7', city: 'Islamabad', popular: true },
  { id: 'isb_f10', name: 'Sector F-10', city: 'Islamabad', popular: true },
  { id: 'isb_f11', name: 'Sector F-11', city: 'Islamabad', popular: true },
  { id: 'isb_f8', name: 'Sector F-8', city: 'Islamabad' },
  { id: 'isb_f6', name: 'Sector F-6', city: 'Islamabad' },
  { id: 'isb_e11', name: 'Sector E-11', city: 'Islamabad', popular: true },
  { id: 'isb_i8', name: 'Sector I-8', city: 'Islamabad', popular: true },
  { id: 'isb_i9', name: 'Sector I-9', city: 'Islamabad' },
  { id: 'isb_i10', name: 'Sector I-10', city: 'Islamabad' },
  { id: 'isb_g9', name: 'Sector G-9 (Karachi Company)', city: 'Islamabad' },
  { id: 'isb_g10', name: 'Sector G-10', city: 'Islamabad' },
  { id: 'isb_h13', name: 'Sector H-13', city: 'Islamabad' },
  { id: 'isb_d12', name: 'Sector D-12', city: 'Islamabad' },
  { id: 'isb_pwd', name: 'PWD Housing Society', city: 'Islamabad' },
  { id: 'isb_bahria', name: 'Bahria Town (Phases 1-8)', city: 'Islamabad / Rawalpindi', popular: true },
  // Rawalpindi
  { id: 'rwp_saddar', name: 'Saddar Cantt', city: 'Rawalpindi', popular: true },
  { id: 'rwp_commercial', name: 'Commercial Market (Satellite Town)', city: 'Rawalpindi', popular: true },
  { id: 'rwp_westridge', name: 'Westridge', city: 'Rawalpindi' },
  { id: 'rwp_peshawar_rd', name: 'Peshawar Road', city: 'Rawalpindi' },
  { id: 'rwp_chaklala', name: 'Chaklala Scheme 3', city: 'Rawalpindi' },
  // Khyber Pakhtunkhwa (Mardan, Peshawar, Swabi, etc.)
  { id: 'kpk_mardan', name: 'Mardan City', city: 'Mardan, Khyber Pakhtunkhwa', popular: true },
  { id: 'kpk_peshawar_city', name: 'Peshawar City', city: 'Peshawar, Khyber Pakhtunkhwa', popular: true },
  { id: 'kpk_hayatabad', name: 'Hayatabad', city: 'Peshawar, Khyber Pakhtunkhwa', popular: true },
  { id: 'kpk_swabi', name: 'Swabi City', city: 'Swabi, Khyber Pakhtunkhwa' },
  { id: 'kpk_nowshehra', name: 'Nowshera Cantt', city: 'Nowshera, Khyber Pakhtunkhwa' },
  { id: 'kpk_abbottabad', name: 'Abbottabad City', city: 'Abbottabad, Khyber Pakhtunkhwa' },
  // Other Major Cities
  { id: 'lhr_gulberg', name: 'Gulberg', city: 'Lahore, Punjab', popular: true },
  { id: 'lhr_dha', name: 'DHA', city: 'Lahore, Punjab' },
  { id: 'khi_clifton', name: 'Clifton', city: 'Karachi, Sindh' },
];

// Provider Setup Categories for progressive onboarding
const PROVIDER_TRADES = [
  { id: 'electrician', name: 'Electrician (Bijli)', icon: 'flash' },
  { id: 'plumber', name: 'Plumber (Nal Sazi)', icon: 'water' },
  { id: 'ac', name: 'AC & Cooling Repair', icon: 'snow' },
  { id: 'carpenter', name: 'Carpenter (Barhai)', icon: 'hammer' },
  { id: 'painter', name: 'Painter (Rang Roghan)', icon: 'color-palette' },
  { id: 'cleaner', name: 'Deep Cleaning (Safai)', icon: 'sparkles' },
  { id: 'tutor', name: 'Home Tutor (Ustaad)', icon: 'book' },
];

export default function AuthScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const signup = useAuthStore((s) => s.signup);

  // Progressive Onboarding Wizard: 'form' -> 'verify_phone' -> 'provider_setup'
  const [authStep, setAuthStep] = useState<'form' | 'verify_phone' | 'provider_setup'>('form');
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [role, setRole] = useState<UserRole>('customer');

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('Sector G-11, Islamabad');
  const [coordinates, setCoordinates] = useState<Coordinates | null>({
    latitude: 33.7215,
    longitude: 73.0538,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // Modal for manual Area/City selection
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');

  // Field-level error messages
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    phone?: string;
    location?: string;
    password?: string;
    otp?: string;
  }>({});

  // Phone Verification (Step 2) state
  const [otpCode, setOtpCode] = useState('1234');
  const [resendCountdown, setResendCountdown] = useState(30);

  // Provider Setup (Step 3) state
  const [selectedTrade, setSelectedTrade] = useState('electrician');
  const [experienceLevel, setExperienceLevel] = useState('3-5 Years');
  const [workRadius, setWorkRadius] = useState('Within My Sector & Nearby (5 km)');

  // Safely dismiss or go back
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

  // Filtered area list for manual fallback
  const filteredAreas = useMemo(() => {
    if (!locationSearch.trim()) return POPULAR_AREAS;
    const query = locationSearch.toLowerCase().trim();
    return POPULAR_AREAS.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        a.city.toLowerCase().includes(query),
    );
  }, [locationSearch]);

  // Primary Location Action: Real device GPS resolution via expo-location
  const handleUseCurrentLocation = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsDetectingLocation(true);
      setFieldErrors((prev) => ({ ...prev, location: undefined }));

      const result = await getCurrentUserLocation();
      setIsDetectingLocation(false);

      if (result.success && result.coordinates) {
        setCoordinates(result.coordinates);
        const loc = result.formattedAddress || 'Detected Location';
        setSelectedLocation(loc);

        // Store coordinates in settings store for PostGIS spatial matching
        useSettingsStore.getState().setUserCoordinates(result.coordinates);
        useSettingsStore.getState().setDefaultLocation(loc);

        toast.success('Location Detected', `📍 ${loc}`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

        if (result.error === 'SERVICES_DISABLED') {
          // Do not attempt to force enable GPS; inform user clearly
          Alert.alert(
            'Location Services Disabled',
            result.message || 'Please turn on Location in your device settings to detect your current area.',
            [{ text: 'OK' }],
          );
          toast.warning('GPS Turned Off', 'Please enable Location in settings.');
        } else if (result.error === 'PERMISSION_DENIED') {
          Alert.alert(
            'Location Permission Needed',
            result.message || 'Please allow location permission in settings to automatically find nearby providers.',
            [{ text: 'OK' }],
          );
          toast.error('Permission Required', 'Location access was denied.');
        } else {
          toast.error('Location Error', result.message || 'Could not retrieve coordinates.');
        }
      }
    } catch (err: any) {
      setIsDetectingLocation(false);
      console.error('[auth] Location detection exception:', err);
      toast.error('Location Failed', 'Could not detect GPS location. Please select your area manually.');
    }
  };

  // Validate initial form fields
  const validateForm = () => {
    const errors: typeof fieldErrors = {};
    let isValid = true;

    if (mode === 'signup') {
      if (!name.trim()) {
        errors.name = 'Please enter your full name (Apna poora naam darj karein)';
        isValid = false;
      }
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 9) {
      errors.phone = 'Please enter a valid mobile number (10 digits)';
      isValid = false;
    }

    if (mode === 'signup' && !selectedLocation) {
      errors.location = 'Please select or detect your city/area';
      isValid = false;
    }

    if (!password.trim() || password.length < 4) {
      errors.password = 'PIN / Password must be at least 4 digits';
      isValid = false;
    }

    setFieldErrors(errors);
    return isValid;
  };

  // Initial Form Submit
  const handleFormSubmit = () => {
    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const formattedPhone = cleanPhone.startsWith('92')
        ? `+${cleanPhone}`
        : cleanPhone.startsWith('0')
        ? `+92 ${cleanPhone.slice(1)}`
        : `+92 ${cleanPhone}`;

      if (mode === 'login') {
        // Direct Login
        login({
          name: name.trim() || (role === 'provider' ? 'Tariq Electrician' : 'Customer Account'),
          phone: formattedPhone,
          email: email.trim() || 'user@khidmat.pk',
          role,
          sector: selectedLocation.split(',')[0].trim() || 'G-11',
          coordinates: coordinates || undefined,
        });
        if (coordinates) {
          useSettingsStore.getState().setUserCoordinates(coordinates);
        }
        toast.success(
          'Welcome Back!',
          `Signed in as ${role === 'provider' ? 'Service Provider' : 'Customer'}.`,
        );
        handleClose();
      } else {
        // Progressive Signup: Advance to Step 2 (Phone Verification)
        setAuthStep('verify_phone');
      }
    }, 450);
  };

  // Step 2: Verify Phone Submit
  const handleVerifyPhone = () => {
    if (!otpCode || otpCode.length < 4) {
      setFieldErrors({ otp: 'Please enter the 4-digit code (Code darj karein)' });
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (role === 'provider') {
      // Advance to progressive Step 3 (Provider Trade Setup)
      setAuthStep('provider_setup');
    } else {
      // Customer registration completes immediately!
      finishRegistration();
    }
  };

  // Finish Registration & save to Zustand store
  const finishRegistration = (tradeInfo?: string) => {
    setIsLoading(true);
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.startsWith('92')
      ? `+${cleanPhone}`
      : cleanPhone.startsWith('0')
      ? `+92 ${cleanPhone.slice(1)}`
      : `+92 ${cleanPhone}`;

    setTimeout(() => {
      setIsLoading(false);
      signup({
        name: name.trim() || (role === 'provider' ? 'Tariq Electrician' : 'Ahmed Hassan'),
        phone: formattedPhone,
        email: email.trim(),
        role,
        sector: selectedLocation.split(',')[0].trim() || 'G-11',
        coordinates: coordinates || undefined,
      });

      if (coordinates) {
        useSettingsStore.getState().setUserCoordinates(coordinates);
      }
      useSettingsStore.getState().setDefaultLocation(selectedLocation);

      if (role === 'provider') {
        toast.success(
          'Account Ready! (Karigar Pro)',
          `Registered as ${tradeInfo || 'Electrician'} in ${selectedLocation}`,
        );
      } else {
        toast.success(
          'Account Created!',
          `Welcome to Khidmat! Your location is set to ${selectedLocation}`,
        );
      }
      handleClose();
    }, 400);
  };

  // Quick Demo Login (strictly for development testing)
  const handleQuickDemoLogin = (demoRole: UserRole) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        toast.success('Demo Customer', 'Logged in as Ahmed Hassan (Customer).');
      } else {
        login({
          id: 'usr_demo_provider',
          name: 'Tariq Mehmood (Electrician)',
          phone: '+92 321 9876543',
          email: 'tariq.services@example.com',
          role: 'provider',
          sector: 'G-11',
        });
        toast.success('Demo Provider', 'Logged in as Tariq Mehmood (Provider).');
      }
      handleClose();
    }, 350);
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
            <View>
              <Text className="text-base font-extrabold text-gray-900">Khidmat</Text>
              <Text className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                {authStep === 'form'
                  ? mode === 'signup'
                    ? 'Create Account'
                    : 'Sign In'
                  : authStep === 'verify_phone'
                  ? 'Step 2: Phone Verification'
                  : 'Step 3: Service Setup'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Close authentication"
            onPress={handleClose}
            className="h-9 w-9 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
          >
            <Ionicons name="close" size={20} color={colors.gray500} />
          </TouchableOpacity>
        </View>

        {/* ── STEP 1: INITIAL REGISTRATION & SIGN IN FORM ────────── */}
        {authStep === 'form' && (
          <ScrollView
            className="flex-1 px-5 py-4"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Friendly Greeting & Simple Plain Language Subtitle */}
            <View className="mb-5">
              <Text className="text-2xl font-black text-gray-900">
                {mode === 'signup' ? 'Create Account' : 'Welcome Back'}
              </Text>
              <Text className="text-sm text-gray-600 mt-1 font-medium leading-5">
                Find trusted local services or offer your services.
              </Text>
              <Text className="text-xs text-gray-400 mt-0.5">
                Apne ilaaqe mein ba-asani khidmaat daryaft karein ya pesh karein.
              </Text>
            </View>

            {/* Mode Switcher Tabs (Sign In vs Create Account) */}
            <View className="mb-5 flex-row rounded-xl bg-gray-100 p-1">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Switch to Sign In"
                activeOpacity={0.8}
                onPress={() => {
                  setMode('login');
                  setFieldErrors({});
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
                accessibilityRole="button"
                accessibilityLabel="Switch to Create Account"
                activeOpacity={0.8}
                onPress={() => {
                  setMode('signup');
                  setFieldErrors({});
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

            {/* ── ACCOUNT TYPE SELECTOR (Customer vs Provider) ── */}
            <View className="mb-5">
              <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                Account Type (Aap ka Maqsad)
              </Text>
              <View className="flex-row gap-3">
                {/* Customer Option */}
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="I need a service customer account"
                  activeOpacity={0.85}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setRole('customer');
                  }}
                  style={
                    role === 'customer'
                      ? { backgroundColor: '#FFF7ED', borderColor: '#F97316' }
                      : { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }
                  }
                  className="flex-1 rounded-2xl border-2 p-3.5"
                >
                  <View className="flex-row items-center justify-between">
                    <Text
                      numberOfLines={1}
                      className={`text-sm font-bold ${
                        role === 'customer' ? 'text-primary font-black' : 'text-gray-900'
                      }`}
                    >
                      Customer
                    </Text>
                    <Ionicons
                      name={role === 'customer' ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={role === 'customer' ? colors.primary : '#D1D5DB'}
                    />
                  </View>
                </TouchableOpacity>

                {/* Provider Option */}
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="I provide services professional account"
                  activeOpacity={0.85}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setRole('provider');
                  }}
                  style={
                    role === 'provider'
                      ? { backgroundColor: '#FFF7ED', borderColor: '#F97316' }
                      : { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }
                  }
                  className="flex-1 rounded-2xl border-2 p-3.5"
                >
                  <View className="flex-row items-center justify-between">
                    <Text
                      numberOfLines={1}
                      className={`text-sm font-bold ${
                        role === 'provider' ? 'text-primary font-black' : 'text-gray-900'
                      }`}
                    >
                      Provider
                    </Text>
                    <Ionicons
                      name={role === 'provider' ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={role === 'provider' ? colors.primary : '#D1D5DB'}
                    />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Informative Micro-Badge adapting to selected role */}
              <View className="mt-2.5 flex-row items-center gap-1.5 rounded-xl bg-gray-50 px-3 py-2 border border-gray-100">
                <Ionicons
                  name={role === 'provider' ? 'briefcase-outline' : 'sparkles-outline'}
                  size={14}
                  color={colors.primary}
                />
                <Text className="text-[11px] text-gray-600 font-medium">
                  {role === 'provider'
                    ? 'Providers get job alerts, customer dues ledger & direct client calls.'
                    : 'Customers book trusted providers instantly via voice or chat.'}
                </Text>
              </View>
            </View>

            {/* ── COMMON REGISTRATION / LOGIN FORM FIELDS ── */}
            <View className="space-y-4">
              {/* Field 1: Full Name (Required for Create Account) */}
              {mode === 'signup' && (
                <View className="mb-3.5">
                  <Text className="mb-1.5 text-xs font-bold text-gray-800">
                    Full Name <Text className="text-red-500">*</Text>
                  </Text>
                  <View
                    className={`flex-row items-center rounded-xl border bg-gray-50 px-3.5 py-3 ${
                      fieldErrors.name ? 'border-red-400 bg-red-50/20' : 'border-gray-200'
                    }`}
                  >
                    <Ionicons name="person-outline" size={18} color={colors.gray400} />
                    <TextInput
                      accessibilityLabel="Full Name input"
                      className="ml-2.5 flex-1 text-sm text-gray-900 font-medium"
                      placeholder="Enter your full name"
                      placeholderTextColor={colors.gray400}
                      value={name}
                      onChangeText={(t) => {
                        setName(t);
                        if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: undefined }));
                      }}
                      autoCapitalize="words"
                    />
                  </View>
                  {fieldErrors.name && (
                    <Text className="mt-1 text-xs font-semibold text-red-500">
                      {fieldErrors.name}
                    </Text>
                  )}
                </View>
              )}

              {/* Field 2: Mobile Number (Required, Primary Identifier) */}
              <View className="mb-3.5">
                <Text className="mb-1.5 text-xs font-bold text-gray-800">
                  Mobile Number <Text className="text-red-500">*</Text>
                </Text>
                <View
                  className={`flex-row items-center rounded-xl border bg-gray-50 px-3.5 py-3 ${
                    fieldErrors.phone ? 'border-red-400 bg-red-50/20' : 'border-gray-200'
                  }`}
                >
                  <Ionicons name="call-outline" size={18} color={colors.gray400} />
                  <View className="ml-2.5 flex-row items-center gap-1">
                    <Text className="text-sm font-bold text-gray-900">+92</Text>
                    <View className="mx-1.5 h-4 w-[1px] bg-gray-300" />
                  </View>
                  <TextInput
                    accessibilityLabel="Mobile phone number input"
                    className="flex-1 text-sm text-gray-900 font-medium"
                    placeholder="300 1234567"
                    placeholderTextColor={colors.gray400}
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={(t) => {
                      setPhone(t);
                      if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: undefined }));
                    }}
                  />
                </View>
                {fieldErrors.phone ? (
                  <Text className="mt-1 text-xs font-semibold text-red-500">
                    {fieldErrors.phone}
                  </Text>
                ) : (
                  <Text className="mt-1 text-[11px] text-gray-400">
                    Used as your primary account identifier and for verification
                  </Text>
                )}
              </View>

              {/* Field 3: City / Area Location (Required for Create Account) */}
              {mode === 'signup' && (
                <View className="mb-3.5">
                  <Text className="mb-1.5 text-xs font-bold text-gray-800">
                    City / Area <Text className="text-red-500">*</Text>
                  </Text>

                  {/* Detected / Selected Location Display Card */}
                  {selectedLocation ? (
                    <View className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2.5 flex-1">
                        <View className="h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
                          <Ionicons name="location" size={16} color="#FFFFFF" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-xs font-bold text-gray-900" numberOfLines={1}>
                            {selectedLocation}
                          </Text>
                          <Text className="text-[10px] text-emerald-700 font-medium">
                            Active Service Sector
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Change location"
                        onPress={() => setIsLocationModalOpen(true)}
                        className="rounded-lg bg-white px-2.5 py-1.5 border border-emerald-200 shadow-xs"
                      >
                        <Text className="text-xs font-bold text-emerald-800">Change</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  {/* Primary Location Trigger: Use Current Location */}
                  <View className="mt-2 flex-row gap-2">
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Use my current location button"
                      activeOpacity={0.85}
                      onPress={handleUseCurrentLocation}
                      disabled={isDetectingLocation}
                      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-orange-50 border border-orange-200 py-2.5 active:bg-orange-100"
                    >
                      {isDetectingLocation ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Ionicons name="navigate-circle" size={16} color={colors.primary} />
                      )}
                      <Text className="text-xs font-bold text-primary">
                        {isDetectingLocation
                          ? 'Detecting Location...'
                          : 'Use My Current Location'}
                      </Text>
                    </TouchableOpacity>

                    {/* Fallback Option: Choose City / Area Manually */}
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Choose city or area manually from list"
                      activeOpacity={0.85}
                      onPress={() => setIsLocationModalOpen(true)}
                      className="flex-row items-center justify-center gap-1 rounded-xl bg-gray-100 px-3 py-2.5 active:bg-gray-200"
                    >
                      <Ionicons name="list" size={15} color={colors.gray500} />
                      <Text className="text-xs font-bold text-gray-700">Choose Area</Text>
                    </TouchableOpacity>
                  </View>

                  {fieldErrors.location && (
                    <Text className="mt-1 text-xs font-semibold text-red-500">
                      {fieldErrors.location}
                    </Text>
                  )}
                </View>
              )}

              {/* Field 4: Email Address (Optional) */}
              {mode === 'signup' && (
                <View className="mb-3.5">
                  <View className="flex-row items-center justify-between mb-1.5">
                    <Text className="text-xs font-bold text-gray-800">Email Address</Text>
                    <Text className="text-[11px] font-semibold text-gray-400">(Optional)</Text>
                  </View>
                  <View className="flex-row items-center rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3">
                    <Ionicons name="mail-outline" size={18} color={colors.gray400} />
                    <TextInput
                      accessibilityLabel="Email address optional input"
                      className="ml-2.5 flex-1 text-sm text-gray-900 font-medium"
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

              {/* Field 5: Password / PIN (Required) */}
              <View className="mb-5">
                <Text className="mb-1.5 text-xs font-bold text-gray-800">
                  Password / PIN <Text className="text-red-500">*</Text>
                </Text>
                <View
                  className={`flex-row items-center rounded-xl border bg-gray-50 px-3.5 py-3 ${
                    fieldErrors.password ? 'border-red-400 bg-red-50/20' : 'border-gray-200'
                  }`}
                >
                  <Ionicons name="lock-closed-outline" size={18} color={colors.gray400} />
                  <TextInput
                    accessibilityLabel="Password or PIN input"
                    className="ml-2.5 flex-1 text-sm text-gray-900 font-medium"
                    placeholder="4-digit PIN or password"
                    placeholderTextColor={colors.gray400}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
                    }}
                  />
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    onPress={() => setShowPassword(!showPassword)}
                    className="p-1"
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={colors.gray500}
                    />
                  </TouchableOpacity>
                </View>
                {fieldErrors.password && (
                  <Text className="mt-1 text-xs font-semibold text-red-500">
                    {fieldErrors.password}
                  </Text>
                )}
              </View>
            </View>

            {/* ── LARGE PRIMARY CTA BUTTON ── */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={mode === 'login' ? 'Sign In to Khidmat' : 'Create Account'}
              disabled={isLoading}
              onPress={handleFormSubmit}
              activeOpacity={0.88}
              className={`items-center justify-center rounded-2xl bg-primary py-4 px-6 shadow-sm active:bg-primaryActive ${
                isLoading ? 'opacity-70' : ''
              }`}
            >
              {isLoading ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text className="text-white font-bold text-base">Please wait...</Text>
                </View>
              ) : (
                <Text className="text-white font-extrabold text-base">
                  {mode === 'login' ? 'Sign In to Khidmat' : 'Create Account'}
                </Text>
              )}
            </TouchableOpacity>

            {/* ── DEVELOPMENT / QUICK TESTING ONLY (Hidden in Production) ── */}
            {__DEV__ && (
              <View className="mt-8 mb-6">
                <View className="flex-row items-center mb-3">
                  <View className="flex-1 h-[1px] bg-gray-200" />
                  <Text className="mx-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                    Developer Quick Demo
                  </Text>
                  <View className="flex-1 h-[1px] bg-gray-200" />
                </View>

                <View className="gap-2.5">
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Quick test login as customer"
                    onPress={() => handleQuickDemoLogin('customer')}
                    className="flex-row items-center justify-between rounded-xl bg-gray-50 border border-gray-200 p-3 active:bg-gray-100"
                  >
                    <View className="flex-row items-center gap-2.5">
                      <Ionicons name="person-circle" size={24} color={colors.primary} />
                      <View>
                        <Text className="text-xs font-bold text-gray-900">Demo Customer</Text>
                        <Text className="text-[11px] text-gray-500">Ahmed Hassan (+92 300 1234567)</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Quick test login as provider"
                    onPress={() => handleQuickDemoLogin('provider')}
                    className="flex-row items-center justify-between rounded-xl bg-gray-50 border border-gray-200 p-3 active:bg-gray-100"
                  >
                    <View className="flex-row items-center gap-2.5">
                      <Ionicons name="construct" size={20} color={colors.primary} />
                      <View>
                        <Text className="text-xs font-bold text-gray-900">Demo Provider (Electrician)</Text>
                        <Text className="text-[11px] text-gray-500">Tariq Mehmood (+92 321 9876543)</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        )}

        {/* ── STEP 2: PHONE VERIFICATION (Progressive Onboarding) ── */}
        {authStep === 'verify_phone' && (
          <ScrollView className="flex-1 px-5 py-5" keyboardShouldPersistTaps="handled">
            <TouchableOpacity
              onPress={() => setAuthStep('form')}
              className="flex-row items-center gap-1 mb-4 self-start py-1"
            >
              <Ionicons name="arrow-back" size={18} color={colors.gray500} />
              <Text className="text-xs font-bold text-gray-600">Back to details</Text>
            </TouchableOpacity>

            <View className="mb-6 items-center text-center">
              <View className="h-16 w-16 items-center justify-center rounded-full bg-orange-100 mb-3">
                <Ionicons name="phone-portrait-outline" size={32} color={colors.primary} />
              </View>
              <Text className="text-2xl font-black text-gray-900">Verify Your Phone</Text>
              <Text className="text-sm text-gray-600 mt-1 text-center font-medium">
                We sent a 4-digit SMS verification code to:
              </Text>
              <Text className="text-base font-bold text-primary mt-0.5">
                {phone.startsWith('+92') ? phone : `+92 ${phone}`}
              </Text>
            </View>

            {/* 4-digit code box */}
            <View className="mb-6">
              <Text className="text-xs font-bold text-gray-700 text-center mb-2">
                Enter 4-Digit Code (SMS Code Likhein)
              </Text>
              <View className="flex-row justify-center gap-3">
                {[0, 1, 2, 3].map((idx) => (
                  <View
                    key={idx}
                    className="h-14 w-14 items-center justify-center rounded-2xl border-2 border-primary bg-orange-50/40"
                  >
                    <Text className="text-2xl font-extrabold text-gray-900">
                      {otpCode[idx] ?? '•'}
                    </Text>
                  </View>
                ))}
              </View>
              {fieldErrors.otp && (
                <Text className="mt-2 text-xs font-bold text-red-500 text-center">
                  {fieldErrors.otp}
                </Text>
              )}
            </View>

            {/* Action Button */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Verify phone and continue"
              onPress={handleVerifyPhone}
              activeOpacity={0.88}
              className="items-center justify-center rounded-2xl bg-primary py-4 px-6 shadow-sm active:bg-primaryActive mb-4"
            >
              <Text className="text-white font-extrabold text-base">
                {role === 'provider' ? 'Verify & Set Up Services →' : 'Verify & Enter Khidmat →'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setOtpCode('1234');
                toast.info('Code Resent', 'Verification code 1234 sent via SMS.');
              }}
              className="items-center py-2"
            >
              <Text className="text-xs font-bold text-primary">
                Didn't get code? Resend SMS
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── STEP 3: PROVIDER SERVICE SETUP (Progressive Onboarding) ── */}
        {authStep === 'provider_setup' && (
          <ScrollView className="flex-1 px-5 py-4" showsVerticalScrollIndicator={false}>
            <View className="mb-4">
              <Text className="text-2xl font-black text-gray-900">Set Up Your Services</Text>
              <Text className="text-sm text-gray-600 mt-1 font-medium">
                Choose your primary trade, skills, and working coverage.
              </Text>
              <Text className="text-xs text-gray-400 mt-0.5">
                Apna hunar aur kaam ka ilaaqa muntakhib karein.
              </Text>
            </View>

            {/* 1. Trade Category */}
            <View className="mb-5">
              <Text className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Select Your Trade (Aap ka Hunar)
              </Text>
              <View className="flex-row flex-wrap gap-2.5">
                {PROVIDER_TRADES.map((trade) => {
                  const isSelected = selectedTrade === trade.id;
                  return (
                    <TouchableOpacity
                      key={trade.id}
                      activeOpacity={0.8}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedTrade(trade.id);
                      }}
                      className={`flex-row items-center gap-2 rounded-xl border px-3.5 py-3 ${
                        isSelected
                          ? 'border-primary bg-orange-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <Ionicons
                        name={trade.icon as any}
                        size={17}
                        color={isSelected ? colors.primary : colors.gray500}
                      />
                      <Text
                        className={`text-xs font-bold ${
                          isSelected ? 'text-primary' : 'text-gray-800'
                        }`}
                      >
                        {trade.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 2. Experience Level */}
            <View className="mb-5">
              <Text className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Experience Level (Tajurba)
              </Text>
              <View className="flex-row gap-2">
                {['1-2 Years', '3-5 Years', '5+ Years (Ustaad)'].map((exp) => (
                  <TouchableOpacity
                    key={exp}
                    onPress={() => setExperienceLevel(exp)}
                    className={`flex-1 items-center justify-center rounded-xl border py-2.5 px-2 ${
                      experienceLevel === exp
                        ? 'border-primary bg-orange-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        experienceLevel === exp ? 'text-primary' : 'text-gray-700'
                      }`}
                    >
                      {exp}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 3. Coverage Radius */}
            <View className="mb-6">
              <Text className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Service Coverage (Kaam ka Daera)
              </Text>
              <View className="gap-2">
                {[
                  'Within My Sector & Nearby (5 km)',
                  'Whole City (Islamabad & Rawalpindi)',
                ].map((rad) => (
                  <TouchableOpacity
                    key={rad}
                    onPress={() => setWorkRadius(rad)}
                    className={`flex-row items-center gap-2.5 rounded-xl border p-3 ${
                      workRadius === rad
                        ? 'border-primary bg-orange-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <Ionicons
                      name={workRadius === rad ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={workRadius === rad ? colors.primary : colors.gray400}
                    />
                    <Text
                      className={`text-xs font-bold ${
                        workRadius === rad ? 'text-primary' : 'text-gray-800'
                      }`}
                    >
                      {rad}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Final CTA Button */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Complete provider setup and open dashboard"
              onPress={() => {
                const tradeLabel =
                  PROVIDER_TRADES.find((t) => t.id === selectedTrade)?.name || 'Provider';
                finishRegistration(tradeLabel);
              }}
              activeOpacity={0.88}
              className="items-center justify-center rounded-2xl bg-primary py-4 px-6 shadow-sm active:bg-primaryActive mb-8"
            >
              <Text className="text-white font-extrabold text-base">
                Complete Setup & Go to Job Queue →
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── ACCESSIBLE MODAL: CHOOSE CITY / AREA MANUALLY ── */}
        <Modal
          visible={isLocationModalOpen}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setIsLocationModalOpen(false)}
        >
          <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
            <View className="flex-row items-center justify-between border-b border-gray-100 px-5 py-3">
              <Text className="text-base font-bold text-gray-900">Choose City / Area</Text>
              <TouchableOpacity
                accessibilityLabel="Close area selection modal"
                onPress={() => setIsLocationModalOpen(false)}
                className="h-8 w-8 items-center justify-center rounded-full bg-gray-100"
              >
                <Ionicons name="close" size={18} color={colors.gray500} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View className="px-5 pt-3 pb-2">
              <View className="flex-row items-center rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5">
                <Ionicons name="search" size={18} color={colors.gray400} />
                <TextInput
                  accessibilityLabel="Search city or area input"
                  className="ml-2 flex-1 text-sm text-gray-900 font-medium"
                  placeholder="Search sector or area (e.g. G-11, F-7, Saddar)..."
                  placeholderTextColor={colors.gray400}
                  value={locationSearch}
                  onChangeText={setLocationSearch}
                  autoCorrect={false}
                />
                {locationSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setLocationSearch('')}>
                    <Ionicons name="close-circle" size={16} color={colors.gray400} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Location List */}
            <ScrollView className="flex-1 px-5 py-2" keyboardShouldPersistTaps="handled">
              <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 mt-1">
                Islamabad & Rawalpindi Sectors
              </Text>
              {filteredAreas.map((area) => {
                const isSelected = selectedLocation.includes(area.name);
                return (
                  <TouchableOpacity
                    key={area.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${area.name}, ${area.city}`}
                    activeOpacity={0.7}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const fullArea = `${area.name}, ${area.city}`;
                      setSelectedLocation(fullArea);
                      setIsLocationModalOpen(false);
                      setLocationSearch('');
                    }}
                    className={`flex-row items-center justify-between border-b border-gray-100 py-3.5 ${
                      isSelected ? 'bg-orange-50/50 px-2 rounded-lg' : ''
                    }`}
                  >
                    <View className="flex-row items-center gap-2.5">
                      <Ionicons
                        name="location-outline"
                        size={18}
                        color={isSelected ? colors.primary : colors.gray400}
                      />
                      <View>
                        <Text
                          className={`text-sm ${
                            isSelected ? 'font-bold text-primary' : 'font-semibold text-gray-900'
                          }`}
                        >
                          {area.name}
                        </Text>
                        <Text className="text-xs text-gray-400">{area.city}</Text>
                      </View>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
