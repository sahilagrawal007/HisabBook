// import * as FileSystem from 'expo-file-system';
// import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Feather from "react-native-vector-icons/Feather";
import { auth, db } from "../../firebaseConfig";
import { Transaction } from "../../types";
import Icon from "react-native-vector-icons/MaterialIcons";
// import * as MailComposer from 'expo-mail-composer';

interface TransactionWithShop extends Transaction {
  shopName?: string;
}

export default function CustomerHistory() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [transactions, setTransactions] = useState<TransactionWithShop[]>([]);
  const [filter, setFilter] = useState<"all" | "paid" | "due">("all");
  const [shopFilter, setShopFilter] = useState<string>(params.shopFilter as string || "");
  const [shops, setShops] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);

  // Update shop filter when params change
  useEffect(() => {
    const newShopFilter = params.shopFilter as string || "";
    setShopFilter(newShopFilter);
  }, [params.shopFilter, params.timestamp]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Set up real-time listener for transactions
    const transactionsQuery = query(
      collection(db, "transactions"),
      where("customerId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribeTransactions = onSnapshot(transactionsQuery, async (snapshot) => {
      // Check if user is still authenticated before processing data
      if (!auth.currentUser) return;
      
      const transactionsData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as TransactionWithShop)
      );

      // Fetch shop names for all transactions
      const shopIds = [...new Set(transactionsData.map(t => t.shopId))];
      const shopsData: { [key: string]: string } = {};
      
      for (const shopId of shopIds) {
        try {
          const shopDoc = await getDoc(doc(db, "shops", shopId));
          if (shopDoc.exists()) {
            shopsData[shopId] = shopDoc.data().name || "Unknown Shop";
          }
        } catch (error) {
          console.error(`Error fetching shop ${shopId}:`, error);
          shopsData[shopId] = "Unknown Shop";
        }
      }

      setShops(shopsData);
      
      // Add shop names to transactions
      const transactionsWithShops = transactionsData.map(transaction => ({
        ...transaction,
        shopName: shopsData[transaction.shopId] || "Unknown Shop"
      }));

      setTransactions(transactionsWithShops);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to transactions:", error);
      setLoading(false);
    });

    // Cleanup function to unsubscribe from listeners
    return () => {
      unsubscribeTransactions();
    };
  }, []);

  // Helper function to format date from Firestore timestamp
  const formatDate = (createdAt: any) => {
    if (!createdAt) return "Invalid Date";
    
    try {
      // Handle Firestore Timestamp
      if (createdAt && typeof createdAt.toDate === 'function') {
        return createdAt.toDate().toLocaleString();
      }
      
      // Handle Firestore-like object with seconds
      if (createdAt && typeof createdAt.seconds === 'number') {
        return new Date(createdAt.seconds * 1000).toLocaleString();
      }
      
      // Handle ISO string
      if (typeof createdAt === 'string') {
        return new Date(createdAt).toLocaleString();
      }
      
      // Handle number (timestamp)
      if (typeof createdAt === 'number') {
        return new Date(createdAt).toLocaleString();
      }
      
      return "Invalid Date";
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid Date";
    }
  };

  const filteredTransactions = transactions.filter((transaction) => {
    const typeMatch = filter === "all" || transaction.type === filter;
    const shopMatch = !shopFilter || 
      transaction.shopName?.toLowerCase().includes(shopFilter.toLowerCase());
    return typeMatch && shopMatch;
  });

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.navigate("/(customerTabs)/settings")}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Transaction History</Text>
        <TouchableOpacity
          onPress={() => router.navigate("/(customerTabs)/notifications")}
          style={styles.notificationButton}
        >
          <Icon name="notifications-active" size={30} color="#3B82F6" />
        </TouchableOpacity>
      </View>
      {shopFilter && <Text style={styles.subtitle}>Filtered by: {shopFilter}</Text>}

      {/* Shop Filter - Only show if not pre-filtered */}
      {!params.shopFilter && (
        <View style={styles.shopFilterContainer}>
          <TextInput
            style={styles.shopFilterInput}
            placeholder="Search by shop name..."
            placeholderTextColor="#9CA3AF"
            value={shopFilter}
            onChangeText={setShopFilter}
          />
          {shopFilter.length > 0 && (
            <TouchableOpacity style={styles.clearFilterButton} onPress={() => setShopFilter("")}>
              <Text style={styles.clearFilterText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.filterContainer}>
        {["all", "paid", "due"].map((filterType) => (
          <TouchableOpacity
            key={filterType}
            style={[styles.filterButton, filter === filterType && styles.filterButtonActive]}
            onPress={() => setFilter(filterType as any)}
          >
            <Text
              style={[
                styles.filterButtonText,
                filter === filterType && styles.filterButtonTextActive,
              ]}
            >
              {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        {loading ? (
          <Text style={styles.emptyText}>Loading transactions...</Text>
        ) : filteredTransactions.length === 0 ? (
          <Text style={styles.emptyText}>
            {shopFilter ? `No transactions found for "${shopFilter}"` : "No transactions found"}
          </Text>
        ) : (
          filteredTransactions.map((transaction) => (
            <View key={transaction.id} style={styles.transactionCard}>
              <View style={styles.transactionInfo}>
                {!shopFilter && (
                  <Text style={styles.shopName}>{transaction.shopName || "Unknown Shop"}</Text>
                )}
                <Text style={styles.transactionDescription}>
                  {transaction.description || "Transaction"}
                </Text>
                <Text style={styles.transactionDate}>{formatDate(transaction.createdAt)}</Text>
                <Text style={styles.transactionType}>Type: {transaction.type.toUpperCase()}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={[
                    styles.transactionAmount,
                    transaction.type === "due" ? styles.dueAmount : styles.paidAmount,
                  ]}
                >
                  {transaction.type === "paid" || transaction.type === "advance" ? "+" : "-"}₹
                  {transaction.amount.toFixed(2)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
    color: "#333",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 32,
    color: "#666",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: "white",
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  linkButton: {
    alignItems: "center",
  },
  linkText: {
    color: "#007AFF",
    fontSize: 16,
  },
  roleContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 32,
  },
  roleButton: {
    flex: 1,
    marginHorizontal: 8,
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#ddd",
    alignItems: "center",
    backgroundColor: "white",
  },
  roleButtonSelected: {
    borderColor: "#007AFF",
    backgroundColor: "#007AFF",
  },
  roleButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  roleButtonTextSelected: {
    color: "white",
  },
  formContainer: {
    marginTop: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    paddingTop: 40,
  },
  welcomeText: {
    fontSize: 16,
    color: "#666",
  },
  nameText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  summaryAmount: {
    fontSize: 20,
    fontWeight: "bold",
  },
  dueAmount: {
    color: "#FF3B30",
  },
  advanceAmount: {
    color: "#34C759",
  },
  paidAmount: {
    color: "#007AFF",
  },
  section: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#333",
  },
  emptyText: {
    textAlign: "center",
    color: "#666",
    fontStyle: "italic",
  },
  transactionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  transactionDate: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "bold",
  },
  filterContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 12,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#e0e0e0",
  },
  filterButtonActive: {
    backgroundColor: "#1e88e5",
  },
  filterButtonText: {
    color: "#333",
    fontSize: 14,
  },
  transactionType: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
    color: "#555",
  },
  filterButtonTextActive: {
    color: "#fff",
    fontWeight: "bold",
  },
  downloadButton: {
    marginTop: 8,
    backgroundColor: "#007AFF",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  downloadButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  shopFilterContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    borderColor: "#000",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  shopFilterInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  clearFilterButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#FF3B30",
    borderRadius: 6,
  },
  clearFilterText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  shopName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  backButton: {
    width: 40,
    height: 40,
  },
  notificationButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});