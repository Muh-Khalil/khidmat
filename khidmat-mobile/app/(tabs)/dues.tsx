import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Linking,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDuesStore } from '@/lib/stores/useDuesStore';
import { useCrmStore } from '@/lib/stores/useCrmStore';
import { toast } from '@/lib/stores/useToastStore';
import { colors } from '@/lib/theme/colors';

const AMOUNT_PRESETS = [500, 1000, 1500, 2000, 3000, 5000];

export default function DuesScreen() {
  const dues = useDuesStore((s) => s.dues);
  const markAsPaid = useDuesStore((s) => s.markAsPaid);
  const deleteDue = useDuesStore((s) => s.deleteDue);
  const addDue = useDuesStore((s) => s.addDue);
  const fetchDues = useDuesStore((s) => s.fetchDues);

  const { customers, refresh: refreshCrm } = useCrmStore();

  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDues();
    refreshCrm();
  }, [fetchDues, refreshCrm]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchDues(), refreshCrm()]);
    setRefreshing(false);
  };

  // Modal State for recording a new due
  const [modalVisible, setModalVisible] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [amountStr, setAmountStr] = useState('1000');
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

  const handleWhatsAppReminder = (phone: string, name: string, amount: number) => {
    const clean = phone.replace(/[^0-9]/g, '');
    const formatted = clean.startsWith('92') ? clean : clean.startsWith('0') ? `92${clean.slice(1)}` : `92${clean}`;
    const text = encodeURIComponent(
      `Salam ${name} bhai, Khidmat par aap ka Rs ${amount.toLocaleString()} ka hisab baqi hai. Baraye meherbani jab asani ho ada farma dein. Shukriya!`,
    );
    Linking.openURL(`whatsapp://send?phone=${formatted}&text=${text}`).catch(() => {
      Linking.openURL(`https://wa.me/${formatted}?text=${text}`);
    });
  };

  const handleSelectCrmCustomer = (customer: { name: string; phone?: string; sector?: string }) => {
    setCustName(customer.name);
    if (customer.phone) setCustPhone(customer.phone);
    if (customer.sector) setSectorStr(customer.sector);
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
    setAmountStr('1000');
    setDesc('');
    setSectorStr('G-11');
    setModalVisible(false);
    toast.success('Due Recorded! 📝', 'Customer ledger record added successfully.');
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
            Khata & Udhaar
          </Text>
          <Text className="text-xs text-gray-400">
            Micro-ERP Customer Ledger
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          className="flex-row items-center gap-1.5 rounded-full bg-primary px-4 py-2 active:bg-primaryActive shadow-sm"
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text className="text-xs font-bold text-white">Record Due</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-3"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* KPI Balance Summary Cards */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 rounded-2xl bg-amber-50 p-4 border border-amber-200">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-bold text-amber-800">Total Udhaar (Pending)</Text>
              <Ionicons name="time" size={16} color="#D97706" />
            </View>
            <Text className="mt-2 text-2xl font-black text-amber-900">
              Rs {totalPending.toLocaleString()}
            </Text>
            <Text className="text-[10px] text-amber-700 mt-0.5">
              {pendingDues.length} customers to collect from
            </Text>
          </View>

          <View className="flex-1 rounded-2xl bg-green-50 p-4 border border-green-200">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-bold text-green-800">Total Vasool (Paid)</Text>
              <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
            </View>
            <Text className="mt-2 text-2xl font-black text-green-900">
              Rs {totalCollected.toLocaleString()}
            </Text>
            <Text className="text-[10px] text-green-700 mt-0.5">
              {paidDues.length} settled payments
            </Text>
          </View>
        </View>

        {/* Filter Pills */}
        <View className="flex-row gap-2 mb-4">
          {(['all', 'pending', 'paid'] as const).map((tabKey) => (
            <TouchableOpacity
              key={tabKey}
              onPress={() => setFilter(tabKey)}
              className={`rounded-full px-4 py-2 border ${
                filter === tabKey
                  ? 'bg-gray-900 border-gray-900'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <Text
                className={`text-xs font-bold capitalize ${
                  filter === tabKey ? 'text-white' : 'text-gray-600'
                }`}
              >
                {tabKey === 'all'
                  ? `All (${dues.length})`
                  : tabKey === 'pending'
                  ? `Pending (${pendingDues.length})`
                  : `Paid (${paidDues.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search Input */}
        <View className="mb-4 flex-row items-center rounded-2xl bg-gray-50 border border-gray-200 px-3.5 py-2.5">
          <Ionicons name="search" size={16} color={colors.gray400} />
          <TextInput
            placeholder="Search customer, sector or task..."
            placeholderTextColor={colors.gray400}
            value={search}
            onChangeText={setSearch}
            className="ml-2 flex-1 text-xs text-gray-800 font-medium"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.gray400} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Ledger Items */}
        {filteredDues.length === 0 ? (
          <View className="my-8 items-center rounded-3xl border border-dashed border-gray-200 p-8">
            <Ionicons name="receipt-outline" size={40} color={colors.gray400} />
            <Text className="mt-3 text-base font-extrabold text-gray-700">
              No Ledger Records Found
            </Text>
            <Text className="mt-1 text-center text-xs text-gray-400">
              Tap &quot;Record Due&quot; above to log an outstanding customer payment.
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
                  <View className="flex-row gap-1.5">
                    <TouchableOpacity
                      onPress={() => handleCall(item.customerPhone)}
                      className="flex-row items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 border border-blue-200"
                    >
                      <Ionicons name="call" size={12} color="#1D4ED8" />
                      <Text className="text-[11px] font-bold text-blue-700">Call</Text>
                    </TouchableOpacity>
                    {item.status === 'pending' && (
                      <TouchableOpacity
                        onPress={() => handleWhatsAppReminder(item.customerPhone, item.customerName, item.amount)}
                        className="flex-row items-center gap-1 rounded-lg bg-green-50 px-2.5 py-1 border border-green-200"
                      >
                        <Ionicons name="logo-whatsapp" size={12} color="#16A34A" />
                        <Text className="text-[11px] font-bold text-green-700">WhatsApp</Text>
                      </TouchableOpacity>
                    )}
                  </View>
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
                      toast.success('Payment Recorded! 💰', `Received Rs ${item.amount} from ${item.customerName}`);
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

      {/* Record New Due Modal (With CRM Auto-Fill & Preset Amount Chips) */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="max-h-[92%] rounded-t-[32px] bg-white p-6 shadow-2xl">
            <View className="flex-row items-center justify-between border-b border-gray-100 pb-3">
              <View>
                <Text className="text-xl font-black text-gray-900">
                  Naya Khata / Udhaar
                </Text>
                <Text className="text-xs text-gray-500">Customer chunain aur raqam darj karein</Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="rounded-full bg-gray-100 p-1.5"
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="mt-4">
              {/* Select from existing CRM Customers */}
              {customers.length > 0 && (
                <View className="mb-4">
                  <Text className="text-xs font-black uppercase text-gray-600 mb-2">
                    👥 Mere Customers Se Chunain
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {customers.map((c) => (
                      <Pressable
                        key={c.id}
                        onPress={() => handleSelectCrmCustomer(c)}
                        className={`mr-2 rounded-2xl border px-3.5 py-2 ${
                          custName === c.name
                            ? 'border-primary bg-orange-50'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <Text
                          className={`font-bold text-xs ${
                            custName === c.name ? 'text-primary' : 'text-gray-800'
                          }`}
                        >
                          {c.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View className="space-y-3">
                <View>
                  <Text className="text-xs font-bold text-gray-700 mb-1">
                    Customer Name *
                  </Text>
                  <TextInput
                    className="h-13 rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-semibold text-gray-900"
                    placeholder="Maslan: Tariq Sahab"
                    value={custName}
                    onChangeText={setCustName}
                  />
                </View>

                {/* Amount with Zero-Typing Chips */}
                <View className="mt-2">
                  <Text className="text-xs font-black uppercase text-gray-600 mb-1.5">
                    💰 Raqam (PKR) *
                  </Text>
                  <View className="flex-row flex-wrap gap-2 mb-2">
                    {AMOUNT_PRESETS.map((amt) => (
                      <Pressable
                        key={amt}
                        onPress={() => setAmountStr(String(amt))}
                        className={`rounded-xl border px-3 py-2 ${
                          amountStr === String(amt)
                            ? 'border-green-600 bg-green-50'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <Text
                          className={`text-xs font-bold ${
                            amountStr === String(amt) ? 'text-green-700' : 'text-gray-700'
                          }`}
                        >
                          Rs {amt.toLocaleString()}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    className="h-13 rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-semibold text-gray-900"
                    placeholder="e.g. 2500"
                    keyboardType="numeric"
                    value={amountStr}
                    onChangeText={setAmountStr}
                  />
                </View>

                <View className="mt-2">
                  <Text className="text-xs font-bold text-gray-700 mb-1">
                    Sector (Islamabad)
                  </Text>
                  <TextInput
                    className="h-13 rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-semibold text-gray-900"
                    placeholder="e.g. G-11, F-7, G-13"
                    value={sectorStr}
                    onChangeText={setSectorStr}
                  />
                </View>

                <View className="mt-2">
                  <Text className="text-xs font-bold text-gray-700 mb-1">
                    Phone Number (WhatsApp Reminder ke liye)
                  </Text>
                  <TextInput
                    className="h-13 rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-semibold text-gray-900"
                    placeholder="0300 1234567"
                    keyboardType="phone-pad"
                    value={custPhone}
                    onChangeText={setCustPhone}
                  />
                </View>

                <View className="mt-2">
                  <Text className="text-xs font-bold text-gray-700 mb-1">
                    Kaam Ki Wazaahat (Service Description)
                  </Text>
                  <TextInput
                    className="h-13 rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-semibold text-gray-900"
                    placeholder="Maslan: Fan fitting & board repair"
                    value={desc}
                    onChangeText={setDesc}
                  />
                </View>
              </View>

              <View className="mt-6 flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  className="flex-1 items-center justify-center rounded-2xl border border-gray-300 py-3.5 active:bg-gray-100"
                >
                  <Text className="text-sm font-bold text-gray-600">Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleAddDueSubmit}
                  className="flex-1 items-center justify-center rounded-2xl bg-primary py-3.5 active:bg-primaryActive shadow-md"
                >
                  <Text className="text-base font-black text-white">Save Due Entry</Text>
                </TouchableOpacity>
              </View>
              <View className="h-6" />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
