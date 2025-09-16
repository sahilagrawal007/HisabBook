import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  documentId,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Feather from "react-native-vector-icons/Feather";
import Icon from "react-native-vector-icons/MaterialIcons";
import { auth, db } from "../../firebaseConfig";
import { Transaction } from "../../types";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";

interface TransactionWithCustomer extends Transaction {
  customerName?: string;
}

export default function OwnerHistory() {
  const router = useRouter();
  const { customerId: initialCustomerId } = useLocalSearchParams<{ customerId?: string }>();
  const [transactions, setTransactions] = useState<TransactionWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "paid" | "due">("all");
  const [customerFilter, setCustomerFilter] = useState<string>("");
  const [customerIdFilter, setCustomerIdFilter] = useState<string>("");
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, "transactions"),
      where("shopId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        if (!auth.currentUser) return;

        const txData = snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() } as TransactionWithCustomer)
        );

        // Gather unique customer IDs
        const uniqueCustomerIds = [
          ...new Set(txData.map((t) => t.customerId).filter(Boolean)),
        ] as string[];

        // Build a map of id -> name using batched queries that respect security rules:
        // Only read customers that have joined this shop (shopsJoined contains owner uid)
        const idToName: { [key: string]: string } = {};
        try {
          const ownerUid = auth.currentUser?.uid;
          if (ownerUid && uniqueCustomerIds.length) {
            // Firestore 'in' queries accept up to 10 values; chunk if needed
            const chunkSize = 10;
            for (let i = 0; i < uniqueCustomerIds.length; i += chunkSize) {
              const batchIds = uniqueCustomerIds.slice(i, i + chunkSize);
              const customersQ = query(
                collection(db, "customers"),
                where("shopsJoined", "array-contains", ownerUid),
                where(documentId(), "in", batchIds)
              );
              const customersSnap = await getDocs(customersQ);
              customersSnap.forEach((c) => {
                const data: any = c.data();
                idToName[c.id] = data?.name || "Unknown";
              });
            }
          }
        } catch (e) {
          // If permissions/rules block this, fall back to Unknown names without crashing UI
        }

        const withNames = txData.map((t) => ({ ...t, customerName: idToName[t.customerId || ""] }));
        setTransactions(withNames);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isFocused]);

  // Initialize customerId filter from route params
  useEffect(() => {
    if (typeof initialCustomerId === "string" && initialCustomerId) {
      setCustomerIdFilter(initialCustomerId);
    }
  }, [initialCustomerId]);

  const formatDateTime = (createdAt: any) => {
    if (!createdAt) return "Invalid Date";
    try {
      if (createdAt && typeof createdAt.toDate === "function") {
        return createdAt.toDate().toLocaleString();
      }
      if (createdAt && typeof createdAt.seconds === "number") {
        return new Date(createdAt.seconds * 1000).toLocaleString();
      }
      if (typeof createdAt === "string") {
        return new Date(createdAt).toLocaleString();
      }
      if (typeof createdAt === "number") {
        return new Date(createdAt).toLocaleString();
      }
      return "Invalid Date";
    } catch {
      return "Invalid Date";
    }
  };

  const filteredTransactions = useMemo(() => {
    const typeFiltered =
      filter === "all" ? transactions : transactions.filter((t) => t.type === filter);
    const byCustomerId = customerIdFilter
      ? typeFiltered.filter((t) => (t as any).customerId === customerIdFilter)
      : typeFiltered;
    const nameFiltered = customerFilter.trim().length
      ? byCustomerId.filter((t) =>
          (t.customerName || "").toLowerCase().includes(customerFilter.trim().toLowerCase())
        )
      : byCustomerId;
    return nameFiltered;
  }, [transactions, filter, customerFilter, customerIdFilter]);

  const content = useMemo(() => {
    if (loading) {
      return <Text style={styles.emptyText}>Loading history...</Text>;
    }
    if (!filteredTransactions.length) {
      return <Text style={styles.emptyText}>No transactions found.</Text>;
    }
    return (
      <View style={styles.section}>
        {filteredTransactions.map((tx) => (
          <View key={tx.id} style={styles.transactionCard}>
            <View style={styles.transactionInfo}>
              <Text style={styles.customerName}>{tx.customerName || "Unknown"}</Text>
              <Text style={styles.transactionDescription}>{tx.description || "Transaction"}</Text>
              <Text style={styles.transactionDate}>{formatDateTime(tx.createdAt)}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={[
                  styles.transactionAmount,
                  tx.type === "due" ? styles.dueAmount : styles.paidAmount,
                ]}
              >
                {tx.type === "paid" || tx.type === "advance" ? "+" : "-"}₹
                {Number(tx.amount).toFixed(2)}
              </Text>
              <Text style={styles.transactionType}>{tx.type.toUpperCase()}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  }, [loading, filteredTransactions]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-[#F7F7F7]">
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.navigate("/(ownerTabs)/settings")}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Transaction History</Text>
          <View style={styles.headerRight}>
            <Icon name="history" size={28} color="#3B82F6" />
          </View>
        </View>
        {customerIdFilter ? (
          <Text style={{ textAlign: "center", color: "#555", marginBottom: 8 }}>
            Showing transactions for selected customer
          </Text>
        ) : null}
        {/* Customer name search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by customer name..."
            placeholderTextColor="#9CA3AF"
            value={customerFilter}
            onChangeText={setCustomerFilter}
          />
          {customerIdFilter ? (
            <TouchableOpacity
              style={styles.clearFilterButton}
              onPress={() => setCustomerIdFilter("")}
            >
              <Text style={styles.clearFilterText}>Clear Customer</Text>
            </TouchableOpacity>
          ) : null}
          {customerFilter.length > 0 && (
            <TouchableOpacity
              style={styles.clearFilterButton}
              onPress={() => setCustomerFilter("")}
            >
              <Text style={styles.clearFilterText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Type filters */}
        <View style={styles.filterContainer}>
          {["all", "paid", "due"].map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterButton, filter === f && styles.filterButtonActive]}
              onPress={() => setFilter(f as any)}
            >
              <Text
                style={[styles.filterButtonText, filter === f && styles.filterButtonTextActive]}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {content}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
  },
  headerRight: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
    color: "#333",
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
  filterButtonTextActive: {
    color: "#fff",
    fontWeight: "bold",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 16,
    borderColor: "#000",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
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
  customerName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
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
  transactionType: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
    color: "#555",
  },
  dueAmount: {
    color: "#FF3B30",
  },
  paidAmount: {
    color: "#007AFF",
  },
});
