import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDuesStore } from '@/lib/stores/useDuesStore';
import { toast } from '@/lib/stores/useToastStore';
import { colors } from '@/lib/theme/colors';

export default function DuesScreen() {
  const dues = useDuesStore((s) => s.dues);
  const markAsPaid = useDuesStore((s) => s.markAsPaid);
  const deleteDue = useDuesStore((s) => s.deleteDue);
  const addDue = useDuesStore((s) => s.addDue);

  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [search, setSearch] = useState('');

  // Modal State for recording a new due
  const [modalVisible, setModalVisible] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [desc, setDesc] = useState('');
  const [sectorStr, setSectorStr] = useState('G-11');

  const filteredDues = dues.filter((d) => {
    const matchesFilter = filter === 'all' ? true : d.status === filter;
    const matchesSearch =
      d.customerName.toLowerCase().includes(search.toLowerCase()) ||
      d.sector.toLowerCase().includes(search.toLowerCase()) ||
      d.description.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const pendingDues = dues.filter((d) => d.status === 'pending');
  const paidDues = dues.filter((d) => d.status === 'paid');

  const totalPending = pendingDues.reduce((acc, curr) => acc + curr.amount, 0);
  const totalCollected = paidDues.reduce((acc, curr) => acc + curr.amount, 0);

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleAddDueSubmit = () => {
    if (!custName.trim() || !amountStr.trim()) {
      toast.warning('Required Fields', 'Please enter customer name and amount.');
      return;
    }
    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) {
      toast.warning('Invalid Amount', 'Please enter a valid rupee amount.');
      return;
    }

    addDue({
      customerName: custName.trim(),
      customerPhone: custPhone.trim() || '+92 300 1234567',
      serviceCategory: 'general',
      sector: sectorStr.trim() || 'G-11',
      amount: amt,
      description: desc.trim() || 'Service & Repair Dues',
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
    });

    setCustName('');
    setCustPhone('');
    setAmountStr('');
    setDesc('');
    setSectorStr('G-11');
    setModalVisible(false);
    toast.success('Due Recorded', 'Customer ledger record added successfully.');
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Remove Ledger Entry',
      `Are you sure you want to remove the dues entry for ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            deleteDue(id);
            toast.info('Entry Removed', `Record for ${name} removed.`);
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Top Header */}
      <View className="border-b border-gray-100 px-5 pb-3.5 pt-3 flex-row items-center justify-between">
        <View>
          <Text className="text-xl font-extrabold text-gray-900">
            Dues Ledger
          </Text>
          <Text className="text-xs text-gray-500 font-medium">
            Khata & Udhaar Tracker
          </Text>
        </View>

        {/* Record Due Action Button */}
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          className="flex-row items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 active:bg-primaryActive shadow-sm"
        >
          <Ionicons name="add-circle" size={17} color="#FFFFFF" />
          <Text className="text-xs font-bold text-white">+ Record Due</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-5 pt-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Ledger Overview Cards (Clean & High Contrast) */}
        <View className="mb-4 flex-row gap-3">
          <View className="flex-1 rounded-2xl bg-amber-50/80 p-4 border border-amber-200/80 shadow-sm">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-bold text-amber-900">
                Outstanding Dues
              </Text>
              <View className="h-2 w-2 rounded-full bg-amber-500" />
            </View>
            <Text className="mt-1 text-xl font-black text-amber-950">
              Rs {totalPending.toLocaleString()}
            </Text>
            <Text className="mt-0.5 text-[11px] font-semibold text-amber-800">
              {pendingDues.length} clients pending
            </Text>
          </View>

          <View className="flex-1 rounded-2xl bg-green-50/80 p-4 border border-green-200/80 shadow-sm">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-bold text-green-900">
                Received Payments
              </Text>
              <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
            </View>
            <Text className="mt-1 text-xl font-black text-green-950">
              Rs {totalCollected.toLocaleString()}
            </Text>
            <Text className="mt-0.5 text-[11px] font-semibold text-green-800">
              {paidDues.length} settled
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View className="mb-3 flex-row items-center rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5">
          <Ionicons name="search" size={16} color={colors.gray400} />
          <TextInput
            className="ml-2 flex-1 text-xs text-gray-900 font-medium"
            placeholder="Search by client name, sector or work..."
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.gray400} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Pills */}
        <View className="mb-4 flex-row gap-2">
          {(['all', 'pending', 'paid'] as const).map((tab) => {
            const count =
              tab === 'all'
                ? dues.length
                : tab === 'pending'
                ? pendingDues.length
                : paidDues.length;
            const isSelected = filter === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setFilter(tab)}
                className={`rounded-xl px-3.5 py-1.5 border ${
                  isSelected
                    ? 'border-primary bg-primary'
                    : 'border-gray-200 bg-gray-50 active:bg-gray-100'
                }`}
              >
                <Text
                  className={`text-xs font-bold capitalize ${
                    isSelected ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  {tab === 'all'
                    ? `All (${count})`
                    : tab === 'pending'
                    ? `Pending (${count})`
                    : `Settled (${count})`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Section Header */}
        <View className="mb-2.5 flex-row items-center justify-between">
          <Text className="text-xs font-extrabold uppercase tracking-wider text-gray-400">
            Ledger Records ({filteredDues.length})
          </Text>
          <Text className="text-[11px] font-semibold text-gray-500">
            Tap to call or mark paid
          </Text>
        </View>

        {/* Unified Clean Dues Cards (Matching Image 3 Style) */}
        {filteredDues.length === 0 ? (
          <View className="my-8 rounded-2xl bg-gray-50 p-8 items-center border border-dashed border-gray-200">
            <Ionicons name="document-text-outline" size={36} color={colors.gray400} />
            <Text className="mt-2 text-sm font-bold text-gray-700">
              No ledger entries found
            </Text>
            <Text className="mt-1 text-xs text-gray-400 text-center">
              Tap &quot;+ Record Due&quot; above to log an outstanding customer payment.
            </Text>
          </View>
        ) : (
          filteredDues.map((item) => (
            <View
              key={item.id}
              className="mb-3.5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              {/* Top Row: Client Name, Status Badge & Bold Amount */}
              <View className="flex-row items-center justify-between">
                <View className="flex-1 flex-row items-center gap-2">
                  <Text className="text-base font-extrabold text-gray-900" numberOfLines={1}>
                    {item.customerName}
                  </Text>
                  <View
                    className={`rounded-full px-2.5 py-0.5 ${
                      item.status === 'pending' ? 'bg-amber-100' : 'bg-green-100'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-extrabold ${
                        item.status === 'pending'
                          ? 'text-amber-800'
                          : 'text-green-800'
                      }`}
                    >
                      {item.status === 'pending' ? 'Pending' : 'Settled'}
                    </Text>
                  </View>
                </View>

                <Text className="text-lg font-black text-gray-900 ml-2">
                  Rs {item.amount.toLocaleString()}
                </Text>
              </View>

              {/* Service Description Box */}
              <View className="mt-2 rounded-xl bg-gray-50 p-2.5 border border-gray-100">
                <Text className="text-xs font-semibold text-gray-800">
                  {item.description}
                </Text>
              </View>

              {/* Sector, Phone & Date Strip */}
              <View className="mt-2 flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="location-outline" size={13} color={colors.gray500} />
                  <Text className="text-xs text-gray-500 font-medium">
                    Sector {item.sector} • {item.date}
                  </Text>
                </View>

                {item.customerPhone ? (
                  <TouchableOpacity
                    onPress={() => handleCall(item.customerPhone)}
                    className="flex-row items-center gap-1 rounded-lg bg-green-50 px-2.5 py-1 border border-green-200"
                  >
                    <Ionicons name="call" size={12} color="#16A34A" />
                    <Text className="text-[11px] font-bold text-green-700">Call</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Action Buttons Row */}
              <View className="mt-3 flex-row items-center justify-between border-t border-gray-100 pt-3">
                <TouchableOpacity
                  onPress={() => handleDelete(item.id, item.customerName)}
                  className="flex-row items-center gap-1 px-1 py-1"
                >
                  <Ionicons name="trash-outline" size={14} color="#EF4444" />
                  <Text className="text-xs font-bold text-red-500">Remove</Text>
                </TouchableOpacity>

                {item.status === 'pending' ? (
                  <TouchableOpacity
                    onPress={() => {
                      markAsPaid(item.id);
                      toast.success('Payment Recorded', `Received Rs ${item.amount} from ${item.customerName}`);
                    }}
                    className="flex-row items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 active:bg-green-700 shadow-sm"
                  >
                    <Ionicons name="checkmark-done" size={15} color="#FFFFFF" />
                    <Text className="text-xs font-bold text-white">
                      Mark as Paid (Wasool Hua)
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View className="flex-row items-center gap-1 rounded-xl bg-green-50 px-3 py-1.5">
                    <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                    <Text className="text-xs font-bold text-green-700">
                      Cleared & Paid
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}

        <View className="h-10" />
      </ScrollView>

      {/* Record New Due Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="rounded-t-3xl bg-white p-5 shadow-2xl">
            <View className="flex-row items-center justify-between border-b border-gray-100 pb-3">
              <View>
                <Text className="text-lg font-bold text-gray-900">
                  Record Customer Due
                </Text>
                <Text className="text-xs text-gray-500">Naya Khata / Udhaar Darj Karein</Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="rounded-full bg-gray-100 p-1.5"
              >
                <Ionicons name="close" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View className="mt-4 space-y-3">
              <View>
                <Text className="text-xs font-bold text-gray-700 mb-1">
                  Customer Name *
                </Text>
                <TextInput
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-semibold text-gray-900"
                  placeholder="e.g. Tariq Mehmood"
                  value={custName}
                  onChangeText={setCustName}
                />
              </View>

              <View>
                <Text className="text-xs font-bold text-gray-700 mb-1">
                  Amount (PKR) *
                </Text>
                <TextInput
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-semibold text-gray-900"
                  placeholder="e.g. 2500"
                  keyboardType="numeric"
                  value={amountStr}
                  onChangeText={setAmountStr}
                />
              </View>

              <View>
                <Text className="text-xs font-bold text-gray-700 mb-1">
                  Sector (Islamabad)
                </Text>
                <TextInput
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-semibold text-gray-900"
                  placeholder="e.g. G-11, F-7, G-13"
                  value={sectorStr}
                  onChangeText={setSectorStr}
                />
              </View>

              <View>
                <Text className="text-xs font-bold text-gray-700 mb-1">
                  Phone Number
                </Text>
                <TextInput
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-semibold text-gray-900"
                  placeholder="+92 300 1234567"
                  keyboardType="phone-pad"
                  value={custPhone}
                  onChangeText={setCustPhone}
                />
              </View>

              <View>
                <Text className="text-xs font-bold text-gray-700 mb-1">
                  Work / Service Description
                </Text>
                <TextInput
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-semibold text-gray-900"
                  placeholder="e.g. Ceiling fan installation & switch repair"
                  value={desc}
                  onChangeText={setDesc}
                />
              </View>
            </View>

            <View className="mt-5 flex-row gap-3">
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="flex-1 items-center justify-center rounded-xl border border-gray-300 py-3 active:bg-gray-100"
              >
                <Text className="text-sm font-bold text-gray-600">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleAddDueSubmit}
                className="flex-1 items-center justify-center rounded-xl bg-primary py-3 active:bg-primaryActive shadow-sm"
              >
                <Text className="text-sm font-bold text-white">Save Due Entry</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
