import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../firebaseConfig';
import Feather from "react-native-vector-icons/Feather";

export default function CustomersScreen() {
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const ownerUid = auth.currentUser?.uid;

  // Calculate customer balance based on transactions
  const calculateCustomerBalance = (customerId: string) => {
    if (!allTransactions.length) {
      return 0;
    }
    
    const customerTransactions = allTransactions.filter(txn => txn.customerId === customerId);
    
    let totalDue = 0;
    let totalPaid = 0;
    let totalAdvance = 0;
    
    customerTransactions.forEach(txn => {
      if (txn.type === 'credit' || txn.type === 'due') {
        totalDue += Number(txn.amount) || 0;
      } else if (txn.type === 'payment' || txn.type === 'paid') {
        totalPaid += Number(txn.amount) || 0;
      } else if (txn.type === 'advance') {
        totalAdvance += Number(txn.amount) || 0;
      }
    });
    
    // Net due = total credit - (payments + advances)
    const netDue = Math.max(totalDue - (totalPaid + totalAdvance), 0);
    
    return netDue;
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        
        // Fetch customers
        const customersRef = query(
          collection(db, 'customers'),
          where('shopsJoined', 'array-contains', user.uid)
        );
        
        // Fetch all transactions for this shop
        const transactionsRef = query(
          collection(db, 'transactions'),
          where('shopId', '==', user.uid)
        );
        
        const unsubCustomers = onSnapshot(customersRef, (querySnapshot) => {
          // Check if user is still authenticated before processing data
          if (!auth.currentUser) return;
          
          const list: any[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            list.push({ id: doc.id, ...data });
          });
          setCustomers(list);
        });
        
        const unsubTransactions = onSnapshot(transactionsRef, (querySnapshot) => {
          // Check if user is still authenticated before processing data
          if (!auth.currentUser) return;
          
          const list: any[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            list.push({ id: doc.id, ...data });
          });
          setAllTransactions(list);
          setLoading(false);
        });
        
        return () => {
          unsubCustomers();
          unsubTransactions();
        };
      } else {
        setCustomers([]);
        setAllTransactions([]);
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-100">
        <Text className="text-lg text-gray-700">Loading customers...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]">
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <TouchableOpacity onPress={() => router.navigate("/(ownerTabs)")} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>

        <Text className="text-2xl font-bold text-gray-900 mb-6">All Customers</Text>

        <TextInput
          className="mb-3 px-4 py-4 bg-white rounded-xl border border-gray-200 text-gray-900 text-base"
          style={{ paddingTop: 10, paddingBottom: 15 }}
          placeholder="Search by customer name..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {customers.filter((cust) => cust.name?.toLowerCase().includes(searchQuery.toLowerCase()))
          .length > 0 ? (
          customers
            .filter((cust) => cust.name?.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((cust, index) => {
              const calculatedDue = calculateCustomerBalance(cust.id);
              return (
                <TouchableOpacity
                  key={index}
                  className="flex-row justify-between items-center py-3 px-2 mb-2 bg-white rounded-lg shadow-sm border border-gray-100"
                  onPress={() => {
                    if (!ownerUid) {
                      Alert.alert("Error", "Unable to identify shop. Please sign in again.");
                      return;
                    }
                    router.push({
                      pathname: "/(ownerTabs)/CustomerProfile",
                      params: {
                        customerId: cust.id,
                        shopId: ownerUid,
                      },
                    });
                  }}
                >
                  <View className="flex-row items-center">
                    <Feather name="user" size={30} color="#3B82F6" />
                    <View>
                      <Text className="text-gray-700 font-medium ml-2">{cust.name}</Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text
                      className={`font-bold ${
                        calculatedDue === 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {calculatedDue === 0 ? "Paid" : "Due"}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
        ) : (
          <Text className="text-gray-500">No customers found.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 40,
    height: 40,
  },
}); 