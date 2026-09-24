import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme/colors';
import { useDuesStore, CustomerDue } from '@/lib/stores/useDuesStore';

export function DuesLedgerCard() {
  const dues = useDuesStore((s) => s.dues);
  const markAsPaid = useDuesStore((s) => s.markAsPaid);
  const addDue = useDuesStore((s) => s.addDue);

  const [modalVisible, setModalVisible] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [desc, setDesc] = useState('');

  const pendingDues = dues.filter((d) => d.status === 'pending');
  const totalPending = pendingDues.reduce((acc, curr) => acc + curr.amount, 0);

  const handleAddDueSubmit = () => {
    if (!custName.trim() || !amountStr.trim()) {
      Alert.alert('Validation Error', 'Please enter customer name and amount.');
      return;
    }
    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    addDue({
      customerName: custName.trim(),
      customerPhone: custPhone.trim() || '+92 300 0000000',
      serviceCategory: 'general',
      sector: 'F-7',
      amount: amt,
      description: desc.trim() || 'Service Dues',
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
    });

    setCustName('');
    setCustPhone('');
    setAmountStr('');
    setDesc('');
    setModalVisible(false);
    Alert.alert('Due Recorded', 'Customer dues record added to ledger.');
  };

  return (
    <View className="mb-5 rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-sm">
      {/* Header */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className="h-8 w-8 items-center justify-center rounded-xl bg-amber-500">
            <Ionicons name="wallet-outline" size={18} color="#FFFFFF" />
          </View>
          <View>
            <Text className="text-sm font-bold text-gray-900">
              Customer Dues & Ledger
            </Text>
            <Text className="text-[11px] text-gray-500">
              Micro-Enterprise Dues Tracking
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          className="flex-row items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 active:bg-amber-700"
        >
          <Ionicons name="add-circle-outline" size={15} color="#FFFFFF" />
          <Text className="text-xs font-bold text-white">Record Due</Text>
        </TouchableOpacity>
      </View>

      {/* Summary Total */}
      <View className="mt-3 flex-row items-center justify-between rounded-xl bg-white p-3 border border-amber-100">
        <Text className="text-xs font-semibold text-gray-700">
          Total Pending Dues ({pendingDues.length} clients):
        </Text>
        <Text className="text-base font-extrabold text-amber-900">
          Rs {totalPending.toLocaleString()}
        </Text>
      </View>

      {/* Dues Items List */}
      <View className="mt-3 space-y-2">
        {dues.slice(0, 3).map((item) => (
          <View
            key={item.id}
            className="flex-row items-center justify-between rounded-xl bg-white p-3 border border-gray-100"
          >
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-xs font-bold text-gray-900">
                  {item.customerName}
                </Text>
                <View
                  className={`rounded-full px-2 py-0.5 ${
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
                    {item.status === 'pending' ? 'Pending' : 'Paid'}
                  </Text>
                </View>
              </View>
              <Text className="text-[11px] text-gray-500 mt-0.5">
                {item.description} • {item.sector}
              </Text>
            </View>

            <View className="items-end space-y-1">
              <Text className="text-xs font-bold text-gray-900">
                Rs {item.amount.toLocaleString()}
              </Text>
              {item.status === 'pending' ? (
                <TouchableOpacity
                  onPress={() => markAsPaid(item.id)}
                  className="rounded-lg bg-green-50 px-2 py-1 border border-green-200 active:bg-green-100 flex-row items-center gap-1.5"
                >
                  <Text className="text-[10px] font-bold text-green-700">
                    Mark Paid
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      {/* Record Due Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="rounded-t-3xl bg-white p-5">
            <View className="flex-row items-center justify-between border-b border-gray-100 pb-3">
              <Text className="text-base font-bold text-gray-900">
                Record Customer Dues
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={20} color={colors.gray500} />
              </TouchableOpacity>
            </View>

            <View className="mt-4 space-y-3">
              <View>
                <Text className="text-xs font-semibold text-gray-700 mb-1">
                  Customer Name
                </Text>
                <TextInput
                  className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm"
                  placeholder="e.g. Ahmed Hassan"
                  value={custName}
                  onChangeText={setCustName}
                />
              </View>

              <View>
                <Text className="text-xs font-semibold text-gray-700 mb-1">
                  Customer Phone Number
                </Text>
                <TextInput
                  className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm"
                  placeholder="0300 1234567"
                  keyboardType="phone-pad"
                  value={custPhone}
                  onChangeText={setCustPhone}
                />
              </View>

              <View>
                <Text className="text-xs font-semibold text-gray-700 mb-1">
                  Dues Amount (PKR)
                </Text>
                <TextInput
                  className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm"
                  placeholder="e.g. 1500"
                  keyboardType="numeric"
                  value={amountStr}
                  onChangeText={setAmountStr}
                />
              </View>

              <View>
                <Text className="text-xs font-semibold text-gray-700 mb-1">
                  Service Description
                </Text>
                <TextInput
                  className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm"
                  placeholder="e.g. Wiring repair & switch replacement"
                  value={desc}
                  onChangeText={setDesc}
                />
              </View>

              <TouchableOpacity
                onPress={handleAddDueSubmit}
                className="mt-2 rounded-xl bg-amber-600 py-3.5 items-center active:bg-amber-700"
              >
                <Text className="text-sm font-bold text-white">
                  Save Record to Ledger
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
