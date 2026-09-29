import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme/colors';

export type ProviderLead = {
  dispatch: { id: string; distanceKm: number; rationale: string };
  request: { category: string; issueDescription: string; sector: string; requestedTimeLabel: string; urgency: string };
};

const TIME_PRESETS = ['Abhi (30 min)', '1 ghantay mein', 'Aaj shaam 5 baje', 'Kal subah 10 baje'];
const PRICE_PRESETS = [500, 1000, 1500, 2000, 3000];
const MESSAGE_PRESETS = [
  'Pehle masla check karunga',
  'Saman sath le aaunga',
  'Main raste mein hoon',
  'Munisib rate hoga',
];

export function LeadCard({ lead, onRespond }: { lead: ProviderLead; onRespond: (id: string, data: any) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [time, setTime] = useState(lead.request.requestedTimeLabel || 'Abhi (30 min)');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    await onRespond(lead.dispatch.id, {
      available: true,
      proposedStartAt: Date.now() + 3_600_000,
      proposedTimeLabel: time,
      amount: amount ? Number(amount) : undefined,
      priceType: amount ? 'estimate' : undefined,
      message,
    });
    setSending(false);
    setOpen(false);
  };

  return (
    <>
      <View className="mb-4 rounded-3xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
        <View className="flex-row items-center justify-between">
          <View className={`rounded-full px-3 py-1 ${lead.request.urgency === 'urgent' ? 'bg-red-500' : 'bg-orange-500'}`}>
            <Text className="text-xs font-black text-white">
              {lead.request.urgency === 'urgent' ? '⚡ FORAN CHAHIYE' : '🔔 NAYA KAAM'}
            </Text>
          </View>
          <View className="flex-row items-center rounded-full bg-white px-2.5 py-1">
            <Ionicons name="navigate-circle" size={16} color={colors.primary} />
            <Text className="ml-1 text-xs font-bold text-gray-800">{lead.dispatch.distanceKm} km door</Text>
          </View>
        </View>

        <Text className="mt-3 text-lg font-black leading-6 text-gray-900">{lead.request.issueDescription}</Text>

        <View className="mt-2.5 flex-row flex-wrap gap-2">
          <View className="rounded-xl bg-white/80 px-2.5 py-1">
            <Text className="text-xs font-bold text-gray-700">📍 {lead.request.sector}</Text>
          </View>
          <View className="rounded-xl bg-white/80 px-2.5 py-1">
            <Text className="text-xs font-bold text-gray-700">🕐 {lead.request.requestedTimeLabel}</Text>
          </View>
        </View>

        <View className="mt-4 flex-row gap-3">
          <Pressable
            onPress={() => onRespond(lead.dispatch.id, { available: false, message: 'Unavailable' })}
            className="h-13 flex-1 items-center justify-center rounded-2xl border border-gray-300 bg-white active:bg-gray-100"
          >
            <Text className="font-bold text-gray-700">❌ Nahi ja sakta</Text>
          </Pressable>
          <Pressable
            onPress={() => setOpen(true)}
            className="h-13 flex-1 items-center justify-center rounded-2xl bg-primary shadow-sm active:opacity-90"
          >
            <Text className="text-base font-black text-white">✅ Jawab dein</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="max-h-[90%] rounded-t-[32px] bg-white p-6">
            <View className="flex-row items-center justify-between border-b border-gray-100 pb-3">
              <View>
                <Text className="text-xl font-black text-gray-900">Jawab dein (Bina Typing)</Text>
                <Text className="text-xs text-gray-500">Chips par tap karke foran jawab bhejein</Text>
              </View>
              <Pressable onPress={() => setOpen(false)} className="p-1">
                <Ionicons name="close-circle" size={28} color={colors.gray400} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="mt-4">
              {/* Time selection chips */}
              <Text className="mb-2 text-xs font-black uppercase tracking-wider text-gray-600">
                🕐 Kab pohnch sakte hain?
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {TIME_PRESETS.map((preset) => (
                  <Pressable
                    key={preset}
                    onPress={() => setTime(preset)}
                    className={`rounded-xl border px-3.5 py-2.5 ${time === preset ? 'border-primary bg-orange-50' : 'border-gray-200 bg-gray-50'}`}
                  >
                    <Text className={`font-bold text-sm ${time === preset ? 'text-primary' : 'text-gray-700'}`}>
                      {preset}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Price selection chips */}
              <Text className="mb-2 text-xs font-black uppercase tracking-wider text-gray-600">
                💰 Andazay ki Raqam (Visit / Kaam)
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {PRICE_PRESETS.map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setAmount(String(p))}
                    className={`rounded-xl border px-3.5 py-2.5 ${amount === String(p) ? 'border-green-600 bg-green-50' : 'border-gray-200 bg-gray-50'}`}
                  >
                    <Text className={`font-bold text-sm ${amount === String(p) ? 'text-green-700' : 'text-gray-700'}`}>
                      Rs {p.toLocaleString()}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Optional Custom Input */}
              <View className="flex-row gap-2 mb-4">
                <TextInput
                  value={time}
                  onChangeText={setTime}
                  placeholder="Ya mukhtalif waqt..."
                  className="h-12 flex-1 rounded-xl border border-gray-200 px-3 text-sm"
                />
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="number-pad"
                  placeholder="Ya qeemat..."
                  className="h-12 w-28 rounded-xl border border-gray-200 px-3 text-sm"
                />
              </View>

              {/* Message preset chips */}
              <Text className="mb-2 text-xs font-black uppercase tracking-wider text-gray-600">
                💬 Paigham (Optional)
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-6">
                {MESSAGE_PRESETS.map((preset) => (
                  <Pressable
                    key={preset}
                    onPress={() => setMessage(preset)}
                    className={`rounded-xl border px-3 py-2 ${message === preset ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}
                  >
                    <Text className={`text-xs font-bold ${message === preset ? 'text-blue-700' : 'text-gray-700'}`}>
                      {preset}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                disabled={sending || !time.trim()}
                onPress={submit}
                className="h-14 items-center justify-center rounded-2xl bg-primary shadow-md active:opacity-90 disabled:opacity-40"
              >
                <Text className="text-base font-black text-white">
                  {sending ? 'Bhej rahe hain…' : '🚀 Jawab Bhejein'}
                </Text>
              </Pressable>
              <View className="h-6" />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
