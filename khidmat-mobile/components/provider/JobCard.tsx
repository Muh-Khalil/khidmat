import React from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExplainableRationaleBadge } from './ExplainableRationaleBadge';

export interface ProviderJob {
  id: string;
  customerName: string;
  customerPhone: string;
  serviceCategory: string;
  sector: string;
  scheduledTime: string;
  urgency: 'high' | 'normal';
  problemDescription: string;
  estimatedFare: number;
  status: 'pending' | 'accepted' | 'on_the_way' | 'in_progress' | 'completed' | 'declined';
  explainableRationale: string;
}

interface JobCardProps {
  job: ProviderJob;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onOnMyWay?: (id: string) => void;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
}

export function JobCard({ job, onAccept, onDecline, onOnMyWay, onStart, onComplete }: JobCardProps) {
  const handleCall = () => {
    Linking.openURL(`tel:${job.customerPhone}`);
  };

  const isPending = job.status === 'pending';
  const isAccepted = job.status === 'accepted';
  const isOnMyWay = job.status === 'on_the_way';
  const isInProgress = job.status === 'in_progress';
  const isCompleted = job.status === 'completed';

  return (
    <View className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      {/* Top row: Urgency & Sector Badge */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View
            className={`rounded-full px-2.5 py-1 ${
              job.urgency === 'high' ? 'bg-red-100' : 'bg-blue-100'
            }`}
          >
            <Text
              className={`text-[11px] font-bold ${
                job.urgency === 'high' ? 'text-red-700' : 'text-blue-700'
              }`}
            >
              {job.urgency === 'high' ? '⚡ URGENT REQUEST' : 'Standard Booking'}
            </Text>
          </View>

          <View className="rounded-full bg-gray-100 px-2.5 py-1">
            <Text className="text-[11px] font-semibold text-gray-700">
              📍 {job.sector}
            </Text>
          </View>
        </View>

        <Text className="text-base font-extrabold text-primary">
          Rs {job.estimatedFare.toLocaleString()}
        </Text>
      </View>

      {/* Customer Info */}
      <View className="mt-3 flex-row items-center justify-between border-t border-gray-100 pt-3">
        <View>
          <Text className="text-sm font-bold text-gray-900">{job.customerName}</Text>
          <Text className="text-xs text-gray-500">Scheduled: {job.scheduledTime}</Text>
        </View>

        <TouchableOpacity
          onPress={handleCall}
          className="flex-row items-center gap-1.5 rounded-xl bg-green-50 px-3 py-1.5 border border-green-200 active:bg-green-100"
        >
          <Ionicons name="call" size={14} color="#16A34A" />
          <Text className="text-xs font-bold text-green-700">Call Client</Text>
        </TouchableOpacity>
      </View>

      {/* Problem Description */}
      <View className="mt-2.5 rounded-xl bg-gray-50 p-3">
        <Text className="text-xs font-semibold text-gray-800">
          Request: {job.problemDescription}
        </Text>
      </View>

      {/* AI Explainability Rationale */}
      <ExplainableRationaleBadge rationale={job.explainableRationale} />

      {/* Touch Action Buttons */}
      {isPending && (
        <View className="mt-4 flex-row gap-3">
          <TouchableOpacity
            onPress={() => onDecline(job.id)}
            className="flex-1 items-center justify-center rounded-xl border border-gray-300 py-3 active:bg-gray-100"
          >
            <Text className="text-sm font-bold text-gray-600">Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onAccept(job.id)}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3 active:bg-primaryActive"
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
            <Text className="text-sm font-bold text-white">Accept Job</Text>
          </TouchableOpacity>
        </View>
      )}

      {isAccepted && (
        <View className="mt-4 flex-row gap-2">
          {onOnMyWay && (
            <TouchableOpacity
              onPress={() => onOnMyWay(job.id)}
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-3 active:bg-blue-700"
            >
              <Ionicons name="bicycle" size={18} color="#FFFFFF" />
              <Text className="text-xs font-black text-white">🛵 Raste Mein Hoon</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => onStart(job.id)}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-green-600 py-3 active:bg-green-700"
          >
            <Ionicons name="play-circle-outline" size={18} color="#FFFFFF" />
            <Text className="text-xs font-black text-white">Kaam Shuru</Text>
          </TouchableOpacity>
        </View>
      )}

      {isOnMyWay && (
        <View className="mt-4 space-y-2">
          <View className="rounded-xl bg-blue-50 p-2.5 border border-blue-200 flex-row items-center justify-center">
            <Ionicons name="navigate-circle" size={16} color="#1D4ED8" />
            <Text className="ml-1.5 text-xs font-black text-blue-900">Aap raste mein hain • Customer informed</Text>
          </View>
          <TouchableOpacity
            onPress={() => onStart(job.id)}
            className="flex-row items-center justify-center gap-2 rounded-xl bg-green-600 py-3 active:bg-green-700"
          >
            <Ionicons name="play-circle-outline" size={18} color="#FFFFFF" />
            <Text className="text-sm font-bold text-white">Pohnch Gaye • Kaam Shuru</Text>
          </TouchableOpacity>
        </View>
      )}

      {isInProgress && (
        <View className="mt-4">
          <TouchableOpacity
            onPress={() => onComplete(job.id)}
            className="flex-row items-center justify-center gap-2 rounded-xl bg-green-600 py-3 active:bg-green-700"
          >
            <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
            <Text className="text-sm font-bold text-white">Kaam mukammal • Complete</Text>
          </TouchableOpacity>
        </View>
      )}

      {isCompleted && (
        <View className="mt-3 flex-row items-center justify-center gap-2 rounded-xl bg-green-50 p-2">
          <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
          <Text className="text-xs font-bold text-green-800">
            Kaam mukammal • Payment alag record karein
          </Text>
        </View>
      )}
    </View>
  );
}
