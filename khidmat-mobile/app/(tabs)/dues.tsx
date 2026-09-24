import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDuesStore } from '@/lib/stores/useDuesStore';
import { DuesLedgerCard } from '@/components/provider/DuesLedgerCard';
import { colors } from '@/lib/theme/colors';

export default function DuesScreen() {
  const dues = useDuesStore((s) => s.dues);
  const markAsPaid = useDuesStore((s) => s.markAsPaid);
  const deleteDue = useDuesStore((s) => s.deleteDue);

  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [search, setSearch] = useState('');

  const filteredDues = dues.filter((d) => {
    const matchesFilter = filter === 'all' ? true : d.status === filter;
    const matchesSearch =
      d.customerName.toLowerCase().includes(search.toLowerCase()) ||
      d.sector.toLowerCase().includes(search.toLowerCase()) ||
      d.description.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const totalPending = dues
    .filter((d) => d.status === 'pending')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalCollected = dues
    .filter((d) => d.status === 'paid')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Delete Due Entry',
      `Are you sure you want to remove the ledger record for ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteDue(id) },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Top Header */}
      <View className="border-b border-gray-100 px-5 pb-3 pt-3 flex-row items-center justify-between">
        <View>
          <Text className="text-lg font-bold text-gray-900">
            Customer Dues Ledger
          </Text>
          <Text className="text-xs text-gray-500">
            Micro-Enterprise Financial Tracker
          </Text>
        </View>
        <View className="rounded-xl bg-amber-50 px-3 py-1.5 border border-amber-200">
          <Text className="text-xs font-bold text-amber-900">
            Pending: Rs {totalPending.toLocaleString()}
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-5 pt-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Quick Add Section */}
        <DuesLedgerCard />

        {/* Ledger Overview Cards */}
        <View className="mb-4 flex-row gap-3">
          <View className="flex-1 rounded-2xl bg-amber-50 p-3.5 border border-amber-100">
            <Text className="text-xs font-semibold text-gray-500">
              Outstanding Dues
            </Text>
            <Text className="mt-1 text-xl font-extrabold text-amber-900">
              Rs {totalPending.toLocaleString()}
            </Text>
          </View>

          <View className="flex-1 rounded-2xl bg-green-50 p-3.5 border border-green-100">
            <Text className="text-xs font-semibold text-gray-500">
              Total Payments Received
            </Text>
            <Text className="mt-1 text-xl font-extrabold text-green-900">
              Rs {totalCollected.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View className="mb-3 flex-row items-center rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5">
          <Ionicons name="search" size={16} color={colors.gray400} />
          <TextInput
            className="ml-2 flex-1 text-xs text-gray-900"
            placeholder="Search by client name, sector or work..."
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Filter Pills */}
        <View className="mb-4 flex-row gap-3 flex-wrap">
          {(['all', 'pending', 'paid'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setFilter(tab)}
              className={`rounded-xl px-3.5 py-1.5 border ${
                filter === tab
                  ? 'border-primary bg-primary text-white'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <Text
                className={`text-xs font-bold capitalize ${
                  filter === tab ? 'text-white' : 'text-gray-600'
                }`}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Detailed Ledger Records */}
        <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
          Ledger History ({filteredDues.length})
        </Text>

        {filteredDues.length === 0 ? (
          <View className="my-6 rounded-2xl bg-gray-50 p-6 items-center border border-dashed border-gray-200">
            <Ionicons name="document-text-outline" size={32} color={colors.gray400} />
            <Text className="mt-2 text-sm font-bold text-gray-700">
              No dues records found
            </Text>
          </View>
        ) : (
          filteredDues.map((item) => (
            <View
              key={item.id}
              className="mb-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-bold text-gray-900">
                    {item.customerName}
                  </Text>
                  <View
                    className={`rounded-full px-2.5 py-0.5 ${
                      item.status === 'pending'
                        ? 'bg-amber-100'
                        : 'bg-green-100'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-bold ${
                        item.status === 'pending'
                          ? 'text-amber-800'
                          : 'text-green-800'
                      }`}
                    >
                      {item.status === 'pending' ? 'Pending' : 'Settled'}
                    </Text>
                  </View>
                </View>

                <Text className="text-base font-extrabold text-gray-900">
                  Rs {item.amount.toLocaleString()}
                </Text>
              </View>

              <Text className="mt-1 text-xs text-gray-600">
                {item.description}
              </Text>
              <Text className="mt-0.5 text-[11px] text-gray-400">
                Sector: {item.sector} • Phone: {item.customerPhone} • Date: {item.date}
              </Text>

              <View className="mt-3 flex-row items-center justify-between border-t border-gray-100 pt-2.5">
                <TouchableOpacity
                  onPress={() => handleDelete(item.id, item.customerName)}
                  className="flex-row items-center gap-1.5"
                >
                  <Ionicons name="trash-outline" size={14} color="#EF4444" />
                  <Text className="text-xs font-semibold text-red-500">Remove</Text>
                </TouchableOpacity>

                {item.status === 'pending' && (
                  <TouchableOpacity
                    onPress={() => markAsPaid(item.id)}
                    className="flex-row items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 active:bg-green-700"
                  >
                    <Ionicons name="checkmark-done" size={14} color="#FFFFFF" />
                    <Text className="text-xs font-bold text-white">Mark Paid</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}

        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
}
