import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  FlatList,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../../firebaseConfig";
import { Transaction } from "../../types";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "react-native-vector-icons/Feather";

const DownloadStatement: React.FC = () => {
  const params = useLocalSearchParams();
  const router = useRouter();

  // params come in as strings from navigation
  const shopId = String(params.shopId || "");

  // Data states
  const [shopInfo, setShopInfo] = useState<any>(null);
  const [shopDetails, setShopDetails] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Date range states
  const [fromDate, setFromDate] = useState<Date>(() => {
    const today = new Date();
    // default: last 30 days
    const last30 = new Date(today);
    last30.setDate(today.getDate() - 30);
    return last30;
  });
  const [toDate, setToDate] = useState<Date>(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const [processingStatement, setProcessingStatement] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !shopId) {
      Alert.alert("Missing parameters", "User not authenticated or shopId is missing.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    let unsubscribeTransactions: (() => void) | null = null;

    const load = async () => {
      setLoading(true);

      // load shop details
      try {
        const shopRef = doc(db, "shops", shopId);
        const shopSnap = await getDoc(shopRef);
        if (!cancelled && shopSnap.exists()) {
          setShopDetails({ id: shopSnap.id, ...(shopSnap.data() as any) });
        }
      } catch (err) {
        console.error("Failed to load shop details:", err);
      }

      // load shop/owner info
      try {
        const ownerRef = doc(db, "owners", shopId);
        const ownerSnap = await getDoc(ownerRef);
        if (!cancelled) {
          if (ownerSnap.exists()) {
            setShopInfo({ uid: ownerSnap.id, ...(ownerSnap.data() as any) });
          } else {
            setShopInfo(null);
          }
        }
      } catch (err) {
        console.error("Failed to load shop info:", err);
      }

      // subscribe to transactions for current user + shop
      try {
        const q = query(
          collection(db, "transactions"),
          where("customerId", "==", user.uid),
          where("shopId", "==", shopId),
          orderBy("createdAt", "desc")
        );

        unsubscribeTransactions = onSnapshot(
          q,
          (snapshot) => {
            if (cancelled) return;
            // optional auth check
            if (!auth.currentUser) return;

            const txns: Transaction[] = snapshot.docs.map((d) => ({
              id: d.id,
              ...(d.data() as any),
            }));

            // client-side fallback sort (newest first)
            const sorted = txns.sort((a, b) => {
              const aTs = getTimeFromCreatedAt(a.createdAt);
              const bTs = getTimeFromCreatedAt(b.createdAt);
              return bTs - aTs;
            });

            setTransactions(sorted);
            setLoading(false);
          },
          (err) => {
            console.error("Transactions subscription error:", err);
            Alert.alert("Error", "Could not load transactions.");
            setLoading(false);
          }
        );
      } catch (err) {
        console.error("Failed to subscribe to transactions:", err);
        setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (unsubscribeTransactions) unsubscribeTransactions();
    };
  }, [shopId]);

  useEffect(() => {
    return () => {
      setShowFromPicker(false);
      setShowToPicker(false);
    };
  }, []);

  // Helper: convert various createdAt shapes to ms
  const getTimeFromCreatedAt = (createdAt: any) => {
    if (!createdAt) return 0;
    // Firestore Timestamp with toDate()
    if (typeof createdAt === "object" && typeof createdAt.toDate === "function") {
      return createdAt.toDate().getTime();
    }
    // Firestore-like object with seconds/nanoseconds
    if (typeof createdAt === "object" && typeof createdAt.seconds === "number") {
      return createdAt.seconds * 1000 + (createdAt.nanoseconds ?? 0) / 1e6;
    }
    // ISO string
    if (typeof createdAt === "string") {
      const parsed = Date.parse(createdAt);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    // epoch number (ms)
    if (typeof createdAt === "number") return createdAt;
    return 0;
  };

  // Format date for display YYYY-MM-DD
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Filter transactions by inclusive date range
  const filterTransactionsByDateRange = (fromDt: Date, toDt: Date) => {
    const fromMs = fromDt.getTime();
    const toEnd = new Date(toDt);
    toEnd.setHours(23, 59, 59, 999);
    const toMs = toEnd.getTime();

    return transactions.filter((t) => {
      const ts = getTimeFromCreatedAt(t.createdAt);
      return ts >= fromMs && ts <= toMs;
    });
  };

  // Build header html for PDF
  const buildHeaderHtml = () => {
    const shopName = shopInfo?.shopName || shopDetails?.name || "Shop";
    const ownerName = shopInfo?.name || "";
    const phone = shopInfo?.phone ? `Phone: ${shopInfo.phone}` : "";
    const email = shopInfo?.email ? `Email: ${shopInfo.email}` : "";
    const address = shopInfo?.address ? `${shopInfo.address}` : "";
    return `
      <div class="header">
        <div>
          <div class="title">${shopName}</div>
          <div class="muted">${ownerName}</div>
        </div>
        <div style="text-align:right">
          <div class="muted">${phone}</div>
          <div class="muted">${email}</div>
          <div class="muted">${address}</div>
        </div>
      </div>
    `;
  };

  // Build statement HTML
  const buildStatementHtml = (fromDt: Date, toDt: Date, txns: Transaction[]) => {
    const customerName = auth.currentUser?.displayName || auth.currentUser?.email || "Customer";
    const fromStr = formatDate(fromDt);
    const toStr = formatDate(toDt);

    const rows =
      txns
        .map((t) => {
          const dateStr = new Date(getTimeFromCreatedAt(t.createdAt)).toLocaleString();
          const amount = Number(t.amount || 0).toFixed(2);
          const sign = t.type === "due" ? "+" : "-";
          const color = t.type === "due" ? "#DC2626" : "#059669";
          return `<tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${dateStr}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${
              t.description || "Transaction"
            }</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${(
              t.type || ""
            ).toUpperCase()}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:700;color:${color};text-align:right;">${sign}₹${amount}</td>
          </tr>`;
        })
        .join("") || "";

    const totals = txns.reduce(
      (acc, t) => {
        if (t.type === "due") acc.due += Number(t.amount || 0);
        if (t.type === "paid" || t.type === "advance") acc.paid += Number(t.amount || 0);
        return acc;
      },
      { due: 0, paid: 0 }
    );
    const net = totals.due - totals.paid;

    return `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 16px; color: #111827; }
            .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
            .title { font-size: 20px; font-weight: 800; color: #111827; }
            .muted { color: #6b7280; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { text-align: left; font-size: 12px; color: #374151; padding: 8px; border-bottom: 1px solid #e5e7eb; }
            .summary { margin-top: 14px; }
            .summary div { display:flex; justify-content: space-between; margin: 6px 0; }
          </style>
        </head>
        <body>
          <div class="card">
            ${buildHeaderHtml()}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <div class="muted">Statement for ${customerName}</div>
              <div class="muted">${new Date().toLocaleString()}</div>
            </div>
            <div class="muted" style="margin-bottom:6px;">Range: ${fromStr} to ${toStr}</div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th style="text-align:right">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${
                  rows ||
                  `<tr><td colspan="4" style="padding:12px;text-align:center;color:#6b7280;">No transactions</td></tr>`
                }
              </tbody>
            </table>
            <div class="summary">
              <div><span>Total Due Added</span><strong>₹${totals.due.toFixed(2)}</strong></div>
              <div><span>Total Paid/Advance</span><strong>₹${totals.paid.toFixed(2)}</strong></div>
              <div><span>Net Balance</span><strong style="color:${
                net > 0 ? "#DC2626" : "#059669"
              }">₹${net.toFixed(2)}</strong></div>
            </div>
            <div class="muted" style="margin-top: 16px;">Generated by ShopMunim</div>
          </div>
        </body>
      </html>
    `;
  };

  // Download full statement PDF (for the date range)
  const handleDownloadStatement = async () => {
    if (processingStatement) return;
    setProcessingStatement(true);

    try {
      // Validate
      if (fromDate.getTime() > toDate.getTime()) {
        Alert.alert("Error", "From date cannot be after To date.");
        setProcessingStatement(false);
        return;
      }

      const filtered = filterTransactionsByDateRange(fromDate, toDate);

      if (filtered.length === 0) {
        Alert.alert("No Data", "No transactions found in the selected date range.");
        setProcessingStatement(false);
        return;
      }

      const html = buildStatementHtml(fromDate, toDate, filtered);

      // dynamic require so we don't crash when libs are missing
      let PrintModule: any, SharingModule: any;
      try {
        PrintModule = require("expo-print");
        SharingModule = require("expo-sharing");
      } catch (requireError) {
        console.error("Failed to load expo-print/expo-sharing:", requireError);
        Alert.alert(
          "Missing Dependencies",
          "Please install expo-print and expo-sharing:\n\nnpx expo install expo-print expo-sharing"
        );
        setProcessingStatement(false);
        return;
      }

      // Generate PDF
      const { uri } = await PrintModule.printToFileAsync({
        html,
        width: 612,
        height: 792,
        margins: { left: 20, top: 20, right: 20, bottom: 20 },
      });

      const fileName = `statement_${formatDate(fromDate)}_${formatDate(toDate)}_${
        shopDetails?.name || "shop"
      }.pdf`;

      if (await SharingModule.isAvailableAsync()) {
        await SharingModule.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `Share ${fileName}`,
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("PDF Generated", `Statement saved to: ${uri}`);
      }

      // Log the download to customer's invoiceDownloads
      try {
        const user = auth.currentUser;
        if (user) {
          await addDoc(collection(db, "customers", user.uid, "invoiceDownloads"), {
            shopId,
            invoiceType: "statement",
            periodFrom: formatDate(fromDate),
            periodTo: formatDate(toDate),
            transactionCount: filtered.length,
            createdAt: serverTimestamp(),
            platform: Platform.OS,
            source: "CustomerDownloadStatementScreen",
          });
        }
      } catch (logErr) {
        console.warn("Failed to log statement download:", logErr);
      }
    } catch (error: any) {
      console.error("Failed to generate statement:", error);
      Alert.alert("Error", "Could not generate statement PDF.");
    } finally {
      setProcessingStatement(false);
    }
  };

  // Download single transaction invoice
  const buildInvoiceHtml = (txn: Transaction) => {
    const shopName = shopInfo?.shopName || shopDetails?.name || "Shop";
    const ownerName = shopInfo?.name || "";
    const phone = shopInfo?.phone ? `Phone: ${shopInfo.phone}` : "";
    const email = shopInfo?.email ? `Email: ${shopInfo.email}` : "";
    const address = shopInfo?.address ? `${shopInfo.address}` : "";
    const customerName = auth.currentUser?.displayName || auth.currentUser?.email || "Customer";
    const createdAtMs = getTimeFromCreatedAt(txn.createdAt);
    const dateStr = createdAtMs
      ? new Date(createdAtMs).toLocaleString()
      : new Date().toLocaleString();
    const amountStr = `₹${Number(txn.amount || 0).toFixed(2)}`;
    const sign = txn.type === "due" ? "+" : "-";

    return `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 16px; color: #111827; }
            .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
            .title { font-size: 20px; font-weight: 800; color: #111827; }
            .muted { color: #6b7280; font-size: 12px; }
            .row { display: flex; justify-content: space-between; margin: 10px 0; }
            .label { color: #374151; font-weight: 600; }
            .value { color: #111827; }
            .amount { font-weight: 800; font-size: 22px; }
            .footer { margin-top: 20px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="card">
            ${buildHeaderHtml()}
            <div class="row"><div class="label">Invoice ID</div><div class="value">${
              txn.id
            }</div></div>
            <div class="row"><div class="label">Date</div><div class="value">${dateStr}</div></div>
            <div class="row"><div class="label">Customer</div><div class="value">${customerName}</div></div>
            <div class="row"><div class="label">Type</div><div class="value">${(
              txn.type || ""
            ).toUpperCase()}</div></div>
            <div class="row"><div class="label">Description</div><div class="value">${
              txn.description || "Transaction"
            }</div></div>
            <div class="row" style="margin-top:16px;">
              <div class="label">Amount</div>
              <div class="amount">${sign}${amountStr}</div>
            </div>
            <div class="footer">Generated by ShopMunim</div>
          </div>
        </body>
      </html>
    `;
  };

  const handleDownloadInvoice = async (txn: Transaction) => {
    try {
      const html = buildInvoiceHtml(txn);

      let PrintModule: any, SharingModule: any;
      try {
        PrintModule = require("expo-print");
        SharingModule = require("expo-sharing");
      } catch (requireError) {
        Alert.alert(
          "Missing Dependencies",
          "Please install expo-print and expo-sharing:\n\nnpx expo install expo-print expo-sharing"
        );
        return;
      }

      const { uri } = await PrintModule.printToFileAsync({
        html,
        width: 612,
        height: 792,
        margins: { left: 20, top: 20, right: 20, bottom: 20 },
      });

      if (await SharingModule.isAvailableAsync()) {
        await SharingModule.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Share Invoice",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("Saved", `Invoice saved at: ${uri}`);
      }

      // log single invoice download
      try {
        const user = auth.currentUser;
        if (user) {
          await addDoc(collection(db, "customers", user.uid, "invoiceDownloads"), {
            shopId,
            transactionId: txn.id,
            invoiceType: "single",
            createdAt: serverTimestamp(),
            platform: Platform.OS,
            source: "CustomerDownloadStatementScreen",
          });
        }
      } catch (logErr) {
        console.warn("Failed to log invoice download:", logErr);
      }
    } catch (error) {
      console.error("Failed to generate invoice:", error);
      Alert.alert("Error", "Could not generate invoice PDF.");
    }
  };

  // Date change handlers
  const handleFromDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === "set" && selected) {
      setFromDate(selected);
      if (toDate < selected) setToDate(selected); // auto-adjust
    }
    setShowFromPicker(false);
    setShowToPicker(false); // close other picker just in case
  };

  const handleToDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === "set" && selected) {
      setToDate(selected);
    }
    setShowFromPicker(false);
    setShowToPicker(false);
  };
  
  // Derived values for preview
  const filteredTxns = filterTransactionsByDateRange(fromDate, toDate);
  const totalsPreview = filteredTxns.reduce(
    (acc, t) => {
      if (t.type === "due") acc.due += Number(t.amount || 0);
      if (t.type === "paid" || t.type === "advance") acc.paid += Number(t.amount || 0);
      return acc;
    },
    { due: 0, paid: 0 }
  );
  const netPreview = totalsPreview.due - totalsPreview.paid;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-white edges">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>

        <Text className="text-xl font-bold mb-6">Download Statement</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hint}>
          Shop: <Text style={{ fontWeight: "700" }}>{shopDetails?.name || shopId}</Text>
        </Text>
        <Text style={styles.hint}>
          Customer: <Text style={{ fontWeight: "700" }}>{auth.currentUser?.displayName || auth.currentUser?.email || "You"}</Text>
        </Text>

        <View style={{ marginTop: 16 }}>
          <Text style={styles.label}>From Date</Text>
          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => {
              setShowToPicker(false); // close To picker
              setShowFromPicker(true); // open From picker
            }}
          >
            <Text style={styles.dateText}>{formatDate(fromDate)}</Text>
          </TouchableOpacity>

          <Text style={[styles.label, { marginTop: 12 }]}>To Date</Text>
          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => {
              setShowFromPicker(false); // close From picker
              setShowToPicker(true); // open To picker
            }}
          >
            <Text style={styles.dateText}>{formatDate(toDate)}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryRow}>
            <Text>Total Due Added: </Text>
            <Text style={{ fontWeight: "700" }}>₹{totalsPreview.due.toFixed(2)}</Text>
          </Text>
          <Text style={styles.summaryRow}>
            <Text>Total Paid/Advance: </Text>
            <Text style={{ fontWeight: "700" }}>₹{totalsPreview.paid.toFixed(2)}</Text>
          </Text>
          <Text style={styles.summaryRow}>
            <Text>Net Balance: </Text>
            <Text style={{ fontWeight: "700", color: netPreview > 0 ? "#DC2626" : "#059669" }}>
              ₹{netPreview.toFixed(2)}
            </Text>
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.downloadButton, processingStatement && { opacity: 0.6 }]}
          onPress={handleDownloadStatement}
          disabled={processingStatement}
        >
          <Text style={styles.downloadButtonText}>
            {processingStatement ? "Preparing..." : "Download Statement (PDF)"}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
          Transactions ({filteredTxns.length})
        </Text>

        {filteredTxns.length === 0 ? (
          <Text style={styles.empty}>No transactions in selected range.</Text>
        ) : (
          <FlatList
            data={filteredTxns}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => {
              const created = new Date(getTimeFromCreatedAt(item.createdAt)).toLocaleString();
              return (
                <View style={styles.txnRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txnDesc}>{item.description || "Transaction"}</Text>
                    <Text style={styles.txnDate}>{created}</Text>
                  </View>

                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={[
                        styles.txnAmount,
                        { color: item.type === "due" ? "#DC2626" : "#059669" },
                      ]}
                    >
                      {item.type === "due" ? "+" : "-"}₹{Number(item.amount || 0).toFixed(2)}
                    </Text>

                    <TouchableOpacity
                      style={styles.smallButton}
                      onPress={() => handleDownloadInvoice(item)}
                    >
                      <Text style={styles.smallButtonText}>Invoice</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )}
      </ScrollView>

      {/* Date Pickers (system) */}
      {showFromPicker && (
        <DateTimePicker
          value={fromDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          maximumDate={new Date()}
          onChange={handleFromDateChange}
        />
      )}

      {showToPicker && (
        <DateTimePicker
          value={toDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minimumDate={fromDate}
          maximumDate={new Date()}
          onChange={handleToDateChange}
        />
      )}
    </SafeAreaView>
  );
};

export default DownloadStatement;

const styles = StyleSheet.create({
  backButton: {
    width: 40,
    height: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#e6e6e6",
    backgroundColor: "#fff",
  },
  content: { padding: 16, paddingBottom: 40 },
  hint: { fontSize: 13, color: "#374151", marginTop: 6 },
  label: { marginBottom: 6, marginTop: 4, fontSize: 13, color: "#374151" },
  dateInput: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  dateText: { fontSize: 15, color: "#111827" },
  summaryCard: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  summaryRow: { marginBottom: 6, fontSize: 14, color: "#374151" },
  downloadButton: {
    marginTop: 16,
    backgroundColor: "#10B981",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  downloadButtonText: { color: "white", fontWeight: "700", fontSize: 15 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 8, color: "#111827" },
  empty: { marginTop: 8, color: "#6b7280" },
  txnRow: {
    flexDirection: "row",
    padding: 12,
    marginTop: 8,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  txnDesc: { fontSize: 14, fontWeight: "600", color: "#111827" },
  txnDate: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  txnAmount: { fontSize: 14, fontWeight: "700", marginBottom: 6 },
  smallButton: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  smallButtonText: { color: "#111827", fontWeight: "600" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
});