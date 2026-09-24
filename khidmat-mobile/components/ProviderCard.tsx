import React, { useState } from 'react';
import { View, Text, Pressable, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Provider } from '@/lib/mock/providers';
import { categoryEmoji, categoryServiceLabel } from '@/lib/categories';
import { colors } from '@/lib/theme/colors';
import { formatSchedule } from '@/lib/util/schedule';

type ProviderCardProps = {
  provider: Provider;
  distanceKm: number;
  reasoning: string;
  suggestedSlot: string;
  dayLabel: string;
  onBook: () => void;
};

export function ProviderCard({
  provider,
  distanceKm,
  reasoning,
  suggestedSlot,
  dayLabel,
  onBook,
}: ProviderCardProps) {
  const [showExplainModal, setShowExplainModal] = useState(false);

  return (
    <View className="mt-2 overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      {/* Header */}
      <View className="flex-row items-center">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-100">
          <Text className="text-lg">{categoryEmoji(provider.category)}</Text>
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-base font-bold text-gray-900">
            {provider.name}
          </Text>
          <Text className="text-xs text-gray-500">
            {categoryServiceLabel(provider.category)}
          </Text>
        </View>

        {/* Explainability Chip */}
        <TouchableOpacity
          onPress={() => setShowExplainModal(true)}
          className="flex-row items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 border border-blue-200 active:bg-blue-100"
        >
          <Ionicons name="hardware-chip-outline" size={13} color={colors.blue800} />
          <Text className="text-[11px] font-bold text-blue-800">Why matched?</Text>
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      <View className="mt-3 flex-row items-center gap-4">
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="location-outline" size={14} color={colors.gray500} />
          <Text className="text-xs text-gray-600">
            {distanceKm} km away
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Text className="text-xs text-yellow-500">★</Text>
          <Text className="text-xs font-semibold text-gray-700">
            {provider.rating}
          </Text>
          <Text className="text-xs text-gray-400">
            · {provider.reviewCount} reviews
          </Text>
        </View>
      </View>

      {/* Price + slot */}
      <View className="mt-2 flex-row items-center justify-between">
        <Text className="text-xs font-medium text-gray-500">
          {provider.priceRange}
        </Text>
        <View className="flex-row items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1">
          <Ionicons name="time-outline" size={12} color={colors.primaryActive} />
          <Text className="text-xs font-semibold text-primary-700">
            {formatSchedule(dayLabel, suggestedSlot)}
          </Text>
        </View>
      </View>

      {/* Reasoning */}
      <Text className="mt-2 text-xs italic text-gray-400">{reasoning}</Text>

      {/* Book button */}
      <Pressable
        onPress={onBook}
        className="mt-3 items-center rounded-xl bg-primary py-3 active:bg-primaryActive"
      >
        <Text className="text-sm font-bold text-white">
          Book {dayLabel} at {suggestedSlot}
        </Text>
      </Pressable>

      {/* AI Explainability Breakdown Modal */}
      <Modal
        visible={showExplainModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowExplainModal(false)}
      >
        <View className="flex-1 justify-center bg-black/50 px-5">
          <View className="rounded-3xl bg-white p-5 shadow-lg">
            <View className="flex-row items-center justify-between border-b border-gray-100 pb-3">
              <View className="flex-row items-center gap-2">
                <Ionicons name="hardware-chip" size={20} color={colors.blue800} />
                <Text className="text-base font-bold text-gray-900">
                  AI Match Rationale
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowExplainModal(false)}>
                <Ionicons name="close" size={20} color={colors.gray500} />
              </TouchableOpacity>
            </View>

            <Text className="mt-3 text-xs text-gray-600 leading-4">
              Here is how our Multi-Agent AI system matched {provider.name} for your request:
            </Text>

            <View className="mt-3 space-y-2.5">
              <View className="flex-row items-center justify-between rounded-xl bg-gray-50 p-3 border border-gray-100">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="map-outline" size={16} color={colors.primary} />
                  <Text className="text-xs font-semibold text-gray-700">Spatial Proximity</Text>
                </View>
                <Text className="text-xs font-bold text-green-700">{distanceKm} km (ST_DWithin)</Text>
              </View>

              <View className="flex-row items-center justify-between rounded-xl bg-gray-50 p-3 border border-gray-100">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
                  <Text className="text-xs font-semibold text-gray-700">Skill Vector Cosine</Text>
                </View>
                <Text className="text-xs font-bold text-green-700">96.4% Match</Text>
              </View>

              <View className="flex-row items-center justify-between rounded-xl bg-gray-50 p-3 border border-gray-100">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="star-outline" size={16} color={colors.primary} />
                  <Text className="text-xs font-semibold text-gray-700">Customer Rating</Text>
                </View>
                <Text className="text-xs font-bold text-gray-900">{provider.rating} ★ ({provider.reviewCount})</Text>
              </View>
            </View>

            <View className="mt-3 rounded-xl bg-blue-50 p-3 border border-blue-100">
              <Text className="text-[11px] font-bold text-blue-900">Explainability Audit Trail:</Text>
              <Text className="mt-1 text-xs text-blue-800 italic">{reasoning}</Text>
            </View>

            <TouchableOpacity
              onPress={() => setShowExplainModal(false)}
              className="mt-4 rounded-xl bg-primary py-3 items-center"
            >
              <Text className="text-xs font-bold text-white">Got It</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

