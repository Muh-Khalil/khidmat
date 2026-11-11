import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/Button';
import { useBookingsStore } from '@/lib/stores/useBookingsStore';
import type { BookingStatus } from '@/lib/stores/useBookingsStore';
import { providers } from '@/lib/mock/providers';
import { categoryEmoji, categoryServiceLabel } from '@/lib/categories';
import { toast } from '@/lib/stores/useToastStore';
import { colors } from '@/lib/theme/colors';
import { authenticatedFetch } from '@/lib/services/authenticatedFetch';
import { getApiBaseUrl } from '@/lib/util/apiConfig';

const REVIEW_PRESET_TAGS = [
  '⭐⭐⭐⭐⭐ Zabardast Kaam',
  '🕐 Waqt Par Aaye',
  '💰 Munisib Rate',
  '🤝 Ikhlaq Acha Tha',
  '🧰 Safai Ka Khayal Rakha',
];

const COMPLAINT_PRESET_REASONS = [
  'Kaam theek nahi hua',
  'Saman naqis lagaya',
  'Ziada paise talab kiye',
  'Waqt par nahi aaye',
  'Rawaiyya theek nahi tha',
];

// ── Status Timeline ─────────────────────────────────────────────

const TIMELINE_STEPS: {
  key: BookingStatus;
  label: string;
  icon: 'checkmark-circle' | 'alarm' | 'checkmark-done-circle' | 'bicycle';
}[] = [
  { key: 'pending', label: 'Intezaar (Waiting)', icon: 'alarm' },
  { key: 'confirmed', label: 'Booking Confirmed', icon: 'checkmark-circle' },
  { key: 'on_the_way', label: 'Karigar Raste Mein Hai 🛵', icon: 'bicycle' },
  { key: 'completed', label: 'Kaam Mukammal', icon: 'checkmark-done-circle' },
];

function getStepIndex(status: BookingStatus): number {
  if (status === 'cancelled') return -1;
  const idx = TIMELINE_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

export default function BookingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookings = useBookingsStore((s) => s.bookings);
  const booking = useMemo(() => bookings.find((b) => b.id === id), [bookings, id]);
  const cancel = useBookingsStore((s) => s.cancel);

  const [isFavorited, setIsFavorited] = useState(false);

  // Review Modal State
  const [reviewModal, setReviewModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>(['⭐⭐⭐⭐⭐ Zabardast Kaam']);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [existingReview, setExistingReview] = useState<{ rating: number; presetTags: string[] } | null>(null);

  // Complaint Modal State
  const [complaintModal, setComplaintModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState(COMPLAINT_PRESET_REASONS[0]);
  const [complaintDetails, setComplaintDetails] = useState('');
  const [submittingComplaint, setSubmittingComplaint] = useState(false);

  const provider = useMemo(() => providers.find((p) => p.id === booking?.providerId) || ({
      id: booking?.providerId || 'p_unknown',
      name: booking?.providerName || 'Service Karigar',
      category: booking?.category || 'ac',
      sector: booking?.sector || 'Islamabad',
      rating: 4.9,
      reviewCount: 45,
      yearsExperience: 5,
      priceRange: 'PKR 1500-2500',
      phone: '+92 300 1234567',
      badge: 'Verified Pro',
    }), [booking]);

  // Check if already favorited or reviewed
  useEffect(() => {
    if (!id || !booking?.providerId) return;
    const baseUrl = getApiBaseUrl();

    // Check review
    authenticatedFetch(`${baseUrl}/api/jobs/${encodeURIComponent(id)}/review`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success && json.data) {
          setExistingReview(json.data);
        }
      })
      .catch(() => {});

    // Check favorites
    authenticatedFetch(`${baseUrl}/api/jobs/favorites`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success && Array.isArray(json.data)) {
          setIsFavorited(json.data.includes(booking.providerId));
        }
      })
      .catch(() => {});
  }, [id, booking?.providerId]);

  const handleToggleFavorite = async () => {
    if (!booking?.providerId) return;
    const next = !isFavorited;
    setIsFavorited(next);
    toast.info(next ? 'Favorite Karigar ❤️' : 'Favorite se hata diya gaya', next ? `${provider.name} aap ke pasandida karigaron mein shamil hai.` : '');

    try {
      const baseUrl = getApiBaseUrl();
      await authenticatedFetch(`${baseUrl}/api/jobs/favorites/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: booking.providerId }),
      });
    } catch {
      // rollback if failed
      setIsFavorited(!next);
    }
  };

  const handleRebook = () => {
    // Navigate to Chat with this service requested
    toast.info('Rebooking...', `${provider.name} (${categoryServiceLabel(provider.category)}) dobara book ho rahe hain.`);
    router.push('/(tabs)');
  };

  const handleSubmitReview = async () => {
    if (!id) return;
    setSubmittingReview(true);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await authenticatedFetch(`${baseUrl}/api/jobs/${encodeURIComponent(id)}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          presetTags: selectedTags,
          comment: reviewComment.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setExistingReview({ rating, presetTags: selectedTags });
        setReviewModal(false);
        toast.success('Shukriya! ⭐', 'Aap ka review karigar ke record mein darj ho gaya.');
      } else {
        toast.error('Review submit nahi hua', json.message || 'Dobara koshish karein.');
      }
    } catch {
      toast.error('Internet masla', 'Check karke dobara koshish karein.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSubmitComplaint = async () => {
    if (!id) return;
    setSubmittingComplaint(true);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await authenticatedFetch(`${baseUrl}/api/jobs/${encodeURIComponent(id)}/complaint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'service_quality',
          reason: selectedReason,
          details: complaintDetails.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setComplaintModal(false);
        toast.success('Shikayat Darj Ho Gayi 📝', 'Khidmat support team jald rabta karegi.');
      } else {
        toast.error('Shikayat submit nahi hui', json.message || 'Dobara koshish karein.');
      }
    } catch {
      toast.error('Internet masla', 'Dobara koshish karein.');
    } finally {
      setSubmittingComplaint(false);
    }
  };

  const toggleReviewTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleCancel = useCallback(() => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel Booking',
        style: 'destructive',
        onPress: () => {
          if (id) {
            cancel(id);
            toast.info('Booking Cancelled', 'The booking has been cancelled.');
            router.back();
          }
        },
      },
    ]);
  }, [id, cancel, router]);

  const handleCall = useCallback(() => {
    if (provider?.phone) {
      Linking.openURL(`tel:${provider.phone}`);
    }
  }, [provider]);

  if (!booking) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white" edges={['top']}>
        <Text className="text-gray-400">Booking not found</Text>
      </SafeAreaView>
    );
  }

  const currentStep = getStepIndex(booking.status);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-gray-50 px-4 pb-3 pt-2">
        <View className="flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            className="mr-3 h-9 w-9 items-center justify-center rounded-full active:bg-gray-100"
          >
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </Pressable>
          <Text className="text-lg font-bold text-gray-900">Booking Details</Text>
        </View>

        {/* Favorite Heart Toggle */}
        <Pressable
          onPress={handleToggleFavorite}
          className="h-10 w-10 items-center justify-center rounded-full bg-red-50 active:bg-red-100"
        >
          <Ionicons
            name={isFavorited ? 'heart' : 'heart-outline'}
            size={22}
            color="#DC2626"
          />
        </Pressable>
      </View>

      <ScrollView className="flex-1 bg-white px-5 pt-4" showsVerticalScrollIndicator={false}>
        {/* On The Way Live Banner */}
        {booking.status === 'on_the_way' && (
          <View className="mb-4 rounded-3xl bg-blue-600 p-5 shadow-sm">
            <View className="flex-row items-center">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
                <Ionicons name="bicycle" size={26} color="white" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-lg font-black text-white">Karigar Raste Mein Hai! 🛵</Text>
                <Text className="text-xs text-blue-100">
                  {booking.providerName} aap ke pate ki taraf nikal chuke hain.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Provider Header */}
        <View className="items-center pb-4">
          <View className="mb-3 h-16 w-16 items-center justify-center rounded-full bg-primary-100">
            <Text className="text-3xl">{categoryEmoji(booking.category)}</Text>
          </View>
          <Text className="text-xl font-bold text-gray-900">{booking.providerName}</Text>
          <Text className="mt-1 text-sm text-gray-500">{categoryServiceLabel(booking.category)}</Text>
          <View className="mt-2">
            <StatusBadge status={booking.status} />
          </View>
        </View>

        {/* Booking Info Box */}
        <View className="mb-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <View className="mb-3 flex-row items-center">
            <Ionicons name="time-outline" size={18} color={colors.gray500} />
            <Text className="ml-2 text-sm text-gray-700">{booking.scheduledFor}</Text>
          </View>
          <View className="mb-3 flex-row items-center">
            <Ionicons name="location-outline" size={18} color={colors.gray500} />
            <Text className="ml-2 text-sm text-gray-700">{booking.sector}</Text>
          </View>
          {provider?.phone && (
            <Pressable onPress={handleCall} className="flex-row items-center active:opacity-60">
              <Ionicons name="call-outline" size={18} color={colors.primary} />
              <Text className="ml-2 text-sm font-medium text-primary">{provider.phone}</Text>
            </Pressable>
          )}
        </View>

        {/* Status Timeline */}
        <View className="mb-6 rounded-2xl border border-gray-100 bg-white p-4">
          <Text className="mb-4 text-sm font-bold text-gray-900">Status Timeline</Text>
          {TIMELINE_STEPS.map((step, idx) => {
            const isActive = idx <= currentStep && booking.status !== 'cancelled';
            const isCurrent = idx === currentStep && booking.status !== 'cancelled';
            return (
              <View key={step.key} className="flex-row">
                <View className="items-center" style={{ width: 32 }}>
                  <View
                    className={`h-7 w-7 items-center justify-center rounded-full ${
                      isActive ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  >
                    <Ionicons
                      name={step.icon as any}
                      size={16}
                      color={isActive ? colors.white : colors.gray400}
                    />
                  </View>
                  {idx < TIMELINE_STEPS.length - 1 && (
                    <View
                      className={`h-8 w-0.5 ${isActive ? 'bg-primary-300' : 'bg-gray-200'}`}
                    />
                  )}
                </View>
                <View className="ml-3 justify-center pb-5">
                  <Text
                    className={`text-sm ${
                      isCurrent
                        ? 'font-bold text-primary'
                        : isActive
                        ? 'font-medium text-gray-700'
                        : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </Text>
                </View>
              </View>
            );
          })}

          {booking.status === 'cancelled' && (
            <View className="mt-2 flex-row items-center rounded-xl bg-red-50 px-3 py-2">
              <Ionicons name="close-circle" size={16} color={colors.red600} />
              <Text className="ml-2 text-sm font-medium text-red-600">This booking was cancelled</Text>
            </View>
          )}
        </View>

        {/* Post-Completion Trust & Repeat Business Actions (Phase 4) */}
        {booking.status === 'completed' && (
          <View className="mb-8 gap-3">
            {/* Review Status or Action */}
            {existingReview ? (
              <View className="rounded-2xl border border-green-200 bg-green-50 p-4">
                <View className="flex-row items-center justify-between">
                  <Text className="font-bold text-green-900">Aap Ka Review Darj Hai</Text>
                  <Text className="text-base font-bold text-amber-500">
                    {'⭐'.repeat(existingReview.rating)}
                  </Text>
                </View>
                <View className="mt-2 flex-row flex-wrap gap-1.5">
                  {existingReview.presetTags.map((tag) => (
                    <View key={tag} className="rounded-lg bg-white px-2 py-1">
                      <Text className="text-xs font-bold text-gray-700">{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setReviewModal(true)}
                className="h-14 flex-row items-center justify-center rounded-2xl bg-amber-500 active:bg-amber-600"
              >
                <Ionicons name="star" size={20} color="white" />
                <Text className="ml-2 text-base font-bold text-white">Kaam Kaisa Raha? Review Dein</Text>
              </Pressable>
            )}

            {/* Rebook Button */}
            <Pressable
              onPress={handleRebook}
              className="h-14 flex-row items-center justify-center rounded-2xl bg-primary active:opacity-90"
            >
              <Ionicons name="repeat" size={20} color="white" />
              <Text className="ml-2 text-base font-bold text-white">Dobara Yeh Service Book Karein</Text>
            </Pressable>

            {/* Report Complaint Button */}
            <Pressable
              onPress={() => setComplaintModal(true)}
              className="h-12 flex-row items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 active:bg-gray-100"
            >
              <Ionicons name="alert-circle-outline" size={18} color="#4B5563" />
              <Text className="ml-2 text-sm font-semibold text-gray-700">Koi masla hua? Shikayat / Rework darj karein</Text>
            </Pressable>
          </View>
        )}

        {/* Cancellation Actions */}
        {(booking.status === 'pending' || booking.status === 'confirmed') && (
          <View className="mb-12 gap-3">
            <Button variant="destructive" onPress={handleCancel}>
              Cancel • Booking band karein
            </Button>
          </View>
        )}

        <View className="h-8" />
      </ScrollView>

      {/* Review Modal (Zero-Typing Presets) */}
      <Modal visible={reviewModal} transparent animationType="slide" onRequestClose={() => setReviewModal(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="max-h-[90%] rounded-t-[32px] bg-white p-6 shadow-2xl">
            <View className="flex-row items-center justify-between border-b border-gray-100 pb-3">
              <Text className="text-xl font-black text-gray-900">Karigar Ka Review Dein</Text>
              <Pressable onPress={() => setReviewModal(false)}>
                <Ionicons name="close-circle" size={26} color={colors.gray400} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="mt-4">
              {/* Star Rating Selector */}
              <Text className="mb-3 text-center text-xs font-black uppercase tracking-wider text-gray-600">
                Aap Kitne Sitare (Stars) Dena Chahte Hain?
              </Text>
              <View className="flex-row justify-center gap-3 mb-6">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Pressable key={s} onPress={() => setRating(s)} className="p-1">
                    <Ionicons
                      name={s <= rating ? 'star' : 'star-outline'}
                      size={42}
                      color="#F59E0B"
                    />
                  </Pressable>
                ))}
              </View>

              {/* 1-Tap Feedback Chips */}
              <Text className="mb-2 text-xs font-black uppercase tracking-wider text-gray-600">
                Khaas Batain (Tap Karke Select Karein)
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {REVIEW_PRESET_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <Pressable
                      key={tag}
                      onPress={() => toggleReviewTag(tag)}
                      className={`rounded-xl border px-3.5 py-2.5 ${
                        isSelected ? 'border-primary bg-orange-50' : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <Text className={`text-xs font-bold ${isSelected ? 'text-primary' : 'text-gray-700'}`}>
                        {tag}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                value={reviewComment}
                onChangeText={setReviewComment}
                placeholder="Koi mazeed baat likhna chahein (Optional)..."
                className="h-16 rounded-2xl border border-gray-200 p-3 text-xs mb-5"
                multiline
              />

              <Pressable
                disabled={submittingReview}
                onPress={handleSubmitReview}
                className="h-14 items-center justify-center rounded-2xl bg-primary shadow-md active:opacity-90 disabled:opacity-40"
              >
                {submittingReview ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-base font-black text-white">⭐ Review Submit Karein</Text>
                )}
              </Pressable>
              <View className="h-6" />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Complaint / Rework Modal */}
      <Modal visible={complaintModal} transparent animationType="slide" onRequestClose={() => setComplaintModal(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="max-h-[90%] rounded-t-[32px] bg-white p-6 shadow-2xl">
            <View className="flex-row items-center justify-between border-b border-gray-100 pb-3">
              <Text className="text-xl font-black text-gray-900">Masla Report Karein</Text>
              <Pressable onPress={() => setComplaintModal(false)}>
                <Ionicons name="close-circle" size={26} color={colors.gray400} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="mt-4">
              <Text className="mb-2 text-xs font-black uppercase tracking-wider text-gray-600">
                Kya Masla Pesh Aaya?
              </Text>
              <View className="space-y-2 mb-4">
                {COMPLAINT_PRESET_REASONS.map((reason) => (
                  <Pressable
                    key={reason}
                    onPress={() => setSelectedReason(reason)}
                    className={`flex-row items-center rounded-xl border p-3.5 ${
                      selectedReason === reason
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <Ionicons
                      name={selectedReason === reason ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={selectedReason === reason ? '#DC2626' : colors.gray400}
                    />
                    <Text className={`ml-3 text-xs font-bold ${selectedReason === reason ? 'text-red-900' : 'text-gray-700'}`}>
                      {reason}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                value={complaintDetails}
                onChangeText={setComplaintDetails}
                placeholder="Mazeed wazaahat (Optional)..."
                className="h-16 rounded-2xl border border-gray-200 p-3 text-xs mb-5"
                multiline
              />

              <Pressable
                disabled={submittingComplaint}
                onPress={handleSubmitComplaint}
                className="h-14 items-center justify-center rounded-2xl bg-red-600 shadow-md active:opacity-90 disabled:opacity-40"
              >
                {submittingComplaint ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-base font-black text-white">⚠️ Shikayat Bhejein</Text>
                )}
              </Pressable>
              <View className="h-6" />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
