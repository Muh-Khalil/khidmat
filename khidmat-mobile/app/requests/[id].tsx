import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRequestsStore, ServiceRequest } from '@/lib/stores/useRequestsStore';
import { toast } from '@/lib/stores/useToastStore';
import { colors } from '@/lib/theme/colors';

const PRICE_LABEL = { visit_fee: 'Visit fee', estimate: 'Andaza', fixed_quote: 'Final quote' } as const;

export default function RequestOffersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { offers, fetchRequest, acceptOffer, isLoading } = useRequestsStore();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const pollTimerRef = useRef<any>(null);

  const loadData = useCallback(async () => {
    if (!id) return null;
    const data = await fetchRequest(id);
    if (data) {
      setRequest(data);
      // Stop polling once finalized
      if (data.status === 'booked' || data.status === 'cancelled' || data.status === 'expired') {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      }
    }
    return data;
  }, [id, fetchRequest]);

  useEffect(() => {
    if (!id) return;
    let pollCount = 0;
    const MAX_POLLS = 12; // Stop auto-polling after 2 minutes (12 x 10s)

    loadData();

    // Smart polling: poll every 10 seconds while waiting for responses
    pollTimerRef.current = setInterval(async () => {
      pollCount++;
      if (pollCount >= MAX_POLLS) {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        return;
      }
      await loadData();
    }, 10000);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [id, loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const choose = async (responseId: string) => {
    if (!id || selecting) return;
    // Clear polling timer upon selecting an offer
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setSelecting(responseId);
    const jobId = await acceptOffer(id, responseId);
    setSelecting(null);
    if (!jobId) return toast.error('Dobara koshish karein', 'Yeh jawab ab available nahi hai.');
    toast.success('Karigar chun liya! 🤝', 'Booking confirm ho gayi hai.');
    router.replace(`/bookings/${jobId}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center border-b border-gray-100 bg-white px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-11 w-11 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
        >
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>
        <View className="ml-3 flex-1">
          <Text className="text-lg font-black text-gray-900">Karigar ke Jawab</Text>
          <Text className="text-xs text-gray-500">Apni pasand ka rate aur waqt chunain</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Request Summary Card */}
        {request && (
          <View className="mb-4 rounded-3xl border border-orange-200 bg-orange-50 p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-black uppercase tracking-wider text-orange-800">
                Aap Ki Request
              </Text>
              <View className="rounded-full bg-white px-2.5 py-0.5">
                <Text className="text-xs font-bold text-orange-700">📍 {request.sector}</Text>
              </View>
            </View>
            <Text className="mt-2 text-base font-black text-gray-900">{request.issueDescription}</Text>
            <Text className="mt-1 text-xs font-semibold text-gray-600">🕐 {request.requestedTimeLabel}</Text>
          </View>
        )}

        {/* Live Status Banner */}
        <View className="mb-4 flex-row items-center rounded-2xl bg-blue-50 px-4 py-3">
          <Ionicons name="radio-outline" size={20} color="#2563EB" />
          <Text className="ml-2.5 flex-1 text-xs font-bold text-blue-900">
            {offers.length > 0
              ? `${offers.length} karigar ne jawab diya hai. Behtareen option chunain.`
              : 'Qareebi 3 karigaron ko request bheji hai. Thori dair mein jawab aayega...'}
          </Text>
        </View>

        {isLoading && offers.length === 0 && <ActivityIndicator color={colors.primary} className="my-6" />}

        {/* Empty State with 1-Tap Fallback to External Listings */}
        {!isLoading && offers.length === 0 && (
          <View className="items-center rounded-3xl border border-dashed border-gray-200 bg-white p-6 shadow-sm">
            <Text className="text-5xl">⏳</Text>
            <Text className="mt-4 text-lg font-black text-gray-900">Jawab ka Intezaar Hai</Text>
            <Text className="mt-1 text-center text-sm leading-5 text-gray-500">
              Aap ke ilaqay ke karigar notification check kar rahe hain. Screen automatically update ho rahi hai.
            </Text>

            <View className="mt-6 w-full rounded-2xl bg-amber-50 p-4 border border-amber-200">
              <Text className="font-black text-amber-900">Emergency ya jaldi hai?</Text>
              <Text className="mt-1 text-xs text-amber-800 leading-4">
                Aap foran qareebi verified aur public karigaron ko direct call bhi kar sakte hain.
              </Text>
              <Pressable
                onPress={() => router.push('/providers/external' as any)}
                className="mt-3 h-12 flex-row items-center justify-center rounded-xl bg-amber-600 active:bg-amber-700"
              >
                <Ionicons name="call" size={17} color="white" />
                <Text className="ml-2 font-black text-white">External Providers</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Offers List */}
        {offers.map((offer, index) => {
          const isFirst = index === 0;
          return (
            <View
              key={offer.id}
              className={`mb-4 rounded-3xl border bg-white p-5 shadow-sm ${
                isFirst ? 'border-green-300 ring-2 ring-green-100' : 'border-gray-100'
              }`}
            >
              {isFirst && (
                <View className="mb-3 self-start rounded-full bg-green-100 px-3 py-1">
                  <Text className="text-[11px] font-black text-green-800">⭐ PEHLA JAWAB • ACTIVE</Text>
                </View>
              )}

              <View className="flex-row items-center">
                <View className="h-14 w-14 items-center justify-center rounded-2xl bg-green-50 border border-green-200">
                  <Ionicons name="person" size={26} color="#15803d" />
                </View>
                <View className="ml-3.5 flex-1">
                  <Text className="text-lg font-black text-gray-900">
                    {offer.provider?.name || 'Service Karigar'}
                  </Text>
                  <Text className="mt-0.5 text-xs font-semibold text-gray-500">
                    ⭐ {offer.provider?.rating ? offer.provider.rating.toFixed(1) : '5.0'} •{' '}
                    {offer.provider?.totalJobs || 12} kaam mukammal
                  </Text>
                </View>
              </View>

              {/* Big High-Contrast Price and Time Grid */}
              <View className="my-4 flex-row gap-3">
                <View className="flex-1 rounded-2xl bg-orange-50/80 p-3.5 border border-orange-100">
                  <Text className="text-xs font-bold text-gray-500">🕐 Pohnchne ka Waqt</Text>
                  <Text className="mt-1 text-base font-black text-gray-900">
                    {offer.proposedTimeLabel || 'Jaldi'}
                  </Text>
                </View>
                <View className="flex-1 rounded-2xl bg-green-50/80 p-3.5 border border-green-100">
                  <Text className="text-xs font-bold text-gray-500">💰 Andaza / Visit</Text>
                  <Text className="mt-1 text-base font-black text-green-800">
                    {offer.amount ? `Rs ${offer.amount.toLocaleString()}` : 'Check karke'}
                  </Text>
                  {offer.priceType && (
                    <Text className="text-[10px] font-bold text-green-700">
                      {PRICE_LABEL[offer.priceType]}
                    </Text>
                  )}
                </View>
              </View>

              {!!offer.message && (
                <View className="mb-4 rounded-xl bg-gray-50 p-3 border border-gray-100">
                  <Text className="text-xs font-semibold text-gray-700 italic">“{offer.message}”</Text>
                </View>
              )}

              {/* Big 1-Tap Choose Action */}
              <Pressable
                disabled={!!selecting}
                onPress={() => choose(offer.id)}
                className="h-14 items-center justify-center rounded-2xl bg-primary shadow-md active:opacity-90 disabled:opacity-40"
              >
                <Text className="text-base font-black text-white">
                  {selecting === offer.id ? 'Booking Confirm Ho Rahi Hai…' : '✅ Is Karigar Ko Chunain'}
                </Text>
              </Pressable>
            </View>
          );
        })}

        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
}
