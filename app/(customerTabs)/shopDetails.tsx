import { useRoute } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import {
    addDoc,
    collection,
    doc,
    getDoc,
    onSnapshot,
    query,
    serverTimestamp,
    where
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "react-native-vector-icons/Feather";
import Icon from "react-native-vector-icons/MaterialIcons";
import { db } from "../../firebaseConfig";

interface RouteParams {
  customerId: string;
  shopId: string;
}

const JoinedShopDetails: React.FC = () => {
  const route = useRoute();
  const router = useRouter();
  const { customerId, shopId } = (route.params || {}) as RouteParams;

  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [shopDetails, setShopDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showShopInfoModal, setShowShopInfoModal] = useState(false);

  // Invoice/Statement generation states
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [processingStatement, setProcessingStatement] = useState(false);

  // Shop info for invoices/statements
  const [shopInfo, setShopInfo] = useState<any>(null);
  const [DateTimePickerComponent, setDateTimePickerComponent] = useState<any>(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return;
    
    // Set up real-time listener for shop details
    const shopUnsubscribe = onSnapshot(doc(db, "shops", shopId), (shopDoc) => {
      // Check if user is still authenticated before processing data
      if (!getAuth().currentUser) return;
      
      if (shopDoc.exists()) {
        const shopData = { id: shopDoc.id, ...shopDoc.data() } as any;  
        setShopDetails(shopData);
      }
    }, (error) => {
      console.error("Error listening to shop details:", error);
    });

    // Set up real-time listener for products
    const productsUnsubscribe = onSnapshot(doc(db, "products", shopId), (productDoc) => {
      // Check if user is still authenticated before processing data
      if (!getAuth().currentUser) return;
      
      if (productDoc.exists()) {
        const productList = productDoc.data().products || [];
        setProducts(productList);
        setFilteredProducts(productList);
      }
    }, (error) => {
      console.error("Error listening to products:", error);
    });

    // Set up real-time listener for transactions
    const txnQuery = query(
      collection(db, "transactions"),
      where("shopId", "==", shopId),
      where("customerId", "==", user.uid)
    );
    
    const txnUnsubscribe = onSnapshot(txnQuery, (txnSnap) => {
      // Check if user is still authenticated before processing data
      if (!getAuth().currentUser) return;
      
      const txnList = txnSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTransactions(txnList);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to transactions:", error);
      setLoading(false);
    });

    // Load shop/owner info for invoice/statement header
    const loadShopInfo = async () => {
      try {
        const ownerRef = doc(db, "owners", shopId);
        const ownerSnap = await getDoc(ownerRef);
        if (ownerSnap.exists()) {
          setShopInfo({ uid: ownerSnap.id, ...(ownerSnap.data() as any) });
          console.log(shopInfo);
          
        }    
      } catch (err) {
        console.error("Failed to load shop info:", err);
      }
    };
    loadShopInfo();

    // Lazy-load date picker (optional dependency)
    (async () => {
      try {
        const dtp = await import("@react-native-community/datetimepicker");
        // default export comes as object { default: Component }
        // store the component constructor
        setDateTimePickerComponent(() => (dtp as any).default || dtp);
      } catch (e) {
      }
    })();

    // Cleanup function to unsubscribe from all listeners
    return () => {
      shopUnsubscribe();
      productsUnsubscribe();
      txnUnsubscribe();
    };
  }, [shopId]);

  useEffect(() => {
    // Filter products based on search query
    const filtered = products.filter(product =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredProducts(filtered);
  }, [products, searchQuery]);

  // Debug effect to track shop name changes
  useEffect(() => {
  }, [shopDetails?.name]);

  const calculateBalance = () => {
    let runningBalance = 0;
    
    // Process transactions in chronological order to maintain running balance
    const sortedTransactions = [...transactions].sort((a, b) => {
      const timeA = getTimeFromCreatedAt(a.createdAt);
      const timeB = getTimeFromCreatedAt(b.createdAt);
      return timeA - timeB;
    });

    sortedTransactions.forEach((txn) => {
      if (txn.type === "due") {
        runningBalance += Number(txn.amount || 0);
      } else if (txn.type === "paid" || txn.type === "advance") {
        runningBalance -= Number(txn.amount || 0);
      }
    });

    // Calculate final due and advance based on running balance
    if (runningBalance > 0) {
      // User owes money
      return { due: runningBalance, advance: 0 };
    } else if (runningBalance < 0) {
      // User has paid more than owed (has credit)
      return { due: 0, advance: Math.abs(runningBalance) };
    } else {
      // Perfect balance
      return { due: 0, advance: 0 };
    }
  };

  const calculateNetBalance = () => {
    const balance = calculateBalance();
    return balance.due - balance.advance;
  };

  const getDisplayProducts = () => {
    if (showAllProducts) {
      return filteredProducts;
    }
    return filteredProducts.slice(0, 3);
  };

  // Helper to convert different createdAt formats -> JS timestamp ms
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

  // Helpers for date range
  const parseDateInput = (value: string) => {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed);
  };

  const filterTransactionsByDateRange = (from: string, to: string) => {
    const fromDt = parseDateInput(from);
    const toDt = parseDateInput(to);
    if (!fromDt || !toDt) return [] as any[];
    const fromMs = fromDt.getTime();
    const toEnd = new Date(toDt);
    toEnd.setHours(23, 59, 59, 999);
    const toMs = toEnd.getTime();
    return transactions.filter((t) => {
      const ts = getTimeFromCreatedAt((t as any).createdAt);
      return ts >= fromMs && ts <= toMs;
    });
  };

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

  const buildStatementHtml = (from: string, to: string, txns: any[]) => {
    const customerName = getAuth().currentUser?.displayName || "Customer";
    const rows = txns
      .map((t) => {
        const dateStr = new Date(getTimeFromCreatedAt((t as any).createdAt)).toLocaleString();
        const amount = Number(t.amount || 0).toFixed(2);
        const sign = t.type === "due" ? "+" : "-";
        const color = t.type === "due" ? "#DC2626" : "#059669";
        return `<tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${dateStr}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${t.description || "Transaction"}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${t.type.toUpperCase()}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:700;color:${color};text-align:right;">${sign}₹${amount}</td>
        </tr>`;
      })
      .join("");

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
            <div class="muted" style="margin-bottom:6px;">Range: ${from} to ${to}</div>
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
                ${rows || `<tr><td colspan="4" style="padding:12px;text-align:center;color:#6b7280;">No transactions</td></tr>`}
              </tbody>
            </table>
            <div class="summary">
              <div><span>Total Due Added</span><strong>₹${totals.due.toFixed(2)}</strong></div>
              <div><span>Total Paid/Advance</span><strong>₹${totals.paid.toFixed(2)}</strong></div>
              <div><span>Net Balance</span><strong style="color:${net > 0 ? "#DC2626" : "#059669"}">₹${net.toFixed(2)}</strong></div>
            </div>
            <div class="muted" style="margin-top: 16px;">Generated by ShopMunim</div>
          </div>
        </body>
      </html>
    `;
  };

  const handleDownloadStatement = async () => {
    try {
      setProcessingStatement(true);
      if (!fromDate || !toDate) {
        Alert.alert("Error", "Please enter both From and To dates in YYYY-MM-DD format.");
        setProcessingStatement(false);
        return;
      }
      const fromDt = parseDateInput(fromDate);
      const toDt = parseDateInput(toDate);
      if (!fromDt || !toDt) {
        Alert.alert("Error", "Invalid date format. Please use YYYY-MM-DD.");
        setProcessingStatement(false);
        return;
      }
      if (fromDt.getTime() > toDt.getTime()) {
        Alert.alert("Error", "From date cannot be after To date.");
        setProcessingStatement(false);
        return;
      }
      const filtered = filterTransactionsByDateRange(fromDate, toDate);
      const html = buildStatementHtml(fromDate, toDate, filtered);
      
      // @ts-ignore - optional dependency resolved at runtime
      const Print = await import("expo-print");
      // @ts-ignore - optional dependency resolved at runtime
      const Sharing = await import("expo-sharing");
      const { uri } = await Print.printToFileAsync({ html });
      const name = `statement_${fromDate}_${toDate}_${shopId}.pdf`;
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Share Statement",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("Saved", `Statement saved at: ${uri}`);
      }

      // Log customer download event (statement) to customer's database
      try {
        const user = getAuth().currentUser;
        if (user) {
          await addDoc(collection(db, "customers", user.uid, "invoiceDownloads"), {
            shopId,
            invoiceType: "statement",
            periodFrom: fromDate,
            periodTo: toDate,
            transactionCount: filtered.length,
            createdAt: serverTimestamp(),
            platform: Platform.OS,
            source: "ShopDetails",
          });
        }
      } catch (logErr) {
        console.warn("Failed to log statement download:", logErr);
      }

      setShowStatementModal(false);
    } catch (error) {
      console.error("Failed to generate statement:", error);
      Alert.alert("Error", "Could not generate statement PDF. Please ensure 'expo-print' is installed.");
    } finally {
      setProcessingStatement(false);
    }
  };

  // Per-transaction invoice with shop details
  const buildInvoiceHtml = (txn: any) => {
    const shopName = shopInfo?.shopName || shopDetails?.name || "Shop";
    const ownerName = shopInfo?.name || "";
    const phone = shopInfo?.phone ? `Phone: ${shopInfo.phone}` : "";
    const email = shopInfo?.email ? `Email: ${shopInfo.email}` : "";
    const address = shopInfo?.address ? `${shopInfo.address}` : "";
    const customerName = getAuth().currentUser?.displayName || "Customer";
    const createdAtMs = getTimeFromCreatedAt((txn as any).createdAt);
    const dateStr = createdAtMs ? new Date(createdAtMs).toLocaleString() : new Date().toLocaleString();
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
            <div class="row"><div class="label">Invoice ID</div><div class="value">${txn.id}</div></div>
            <div class="row"><div class="label">Date</div><div class="value">${dateStr}</div></div>
            <div class="row"><div class="label">Customer</div><div class="value">${customerName}</div></div>
            <div class="row"><div class="label">Type</div><div class="value">${txn.type.toUpperCase()}</div></div>
            <div class="row"><div class="label">Description</div><div class="value">${txn.description || "Transaction"}</div></div>
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

  const handleDownloadInvoice = async (txn: any) => {
    try {
      const html = buildInvoiceHtml(txn);
      // @ts-ignore - optional dependency resolved at runtime
      const Print = await import("expo-print");
      // @ts-ignore - optional dependency resolved at runtime
      const Sharing = await import("expo-sharing");
      const { uri } = await Print.printToFileAsync({ html });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Share Invoice",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("Saved", `Invoice saved at: ${uri}`);
      }

      // Log customer download event (single invoice) to customer's database
      try {
        const user = getAuth().currentUser;
        if (user) {
          await addDoc(collection(db, "customers", user.uid, "invoiceDownloads"), {
            shopId,
            transactionId: txn.id,
            invoiceType: "single",
            createdAt: serverTimestamp(),
            platform: Platform.OS,
            source: "ShopDetails",
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

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]">
      <FlatList
        ListHeaderComponent={
          <View className="px-4 pb-4">
            {/* App Header */}
            <View className="flex-row justify-between items-center mb-6 mt-4">
              <View className="flex-row items-center">
                <Icon name="storefront" size={30} color="#3B82F6" />
                <Text className="text-xl font-bold text-gray-900 ml-2">ShopMunim</Text>
              </View>
              <TouchableOpacity>
                <Icon name="notifications-active" size={30} color="#3B82F6" />
              </TouchableOpacity>
            </View>

            {/* Shop Info */}
            <TouchableOpacity
              onPress={() => router.navigate("/(customerTabs)")}
              style={styles.backButton}
            >
              <Feather name="arrow-left" size={24} color="#333" />
            </TouchableOpacity>
            <View className="bg-white p-4 rounded-lg mb-4 shadow">
              <Text className="text-xl font-bold text-gray-900 mb-1">
                {shopDetails?.name || "Shop"}
              </Text>

              {shopInfo?.shopName || shopDetails?.name || shopDetails?.address ? (
                <TouchableOpacity
                  onPress={() => setShowShopInfoModal(true)}
                  className="mt-2 py-2 bg-blue-500 rounded-lg"
                >
                  <Text className="text-white text-center font-semibold">View Shop Details</Text>
                </TouchableOpacity>
              ) : null}

              {/* Balance Section */}
              <View className="mt-3">
                <Text className="text-sm font-semibold text-gray-700 mb-2">Current Balance</Text>
                <View className="flex-row justify-between">
                  {/* Due Section */}
                  <View className="flex-1 bg-red-50 p-3 rounded-lg mr-2">
                    <Text className="text-xs text-gray-600 mb-1">Amount Due</Text>
                    <Text className="text-lg font-bold text-red-600">
                      ₹{calculateBalance().due.toFixed(2)}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-1">
                      {calculateBalance().due > 0 ? "You owe this amount" : "No amount due"}
                    </Text>
                  </View>

                  {/* Advance Section */}
                  <View className="flex-1 bg-green-50 p-3 rounded-lg ml-2">
                    <Text className="text-xs text-gray-600 mb-1">Credit Balance</Text>
                    <Text className="text-lg font-bold text-green-600">
                      ₹{calculateBalance().advance.toFixed(2)}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-1">
                      {calculateBalance().advance > 0 ? "You have credit" : "No credit"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Product List */}
            <View className="bg-white p-4 rounded-lg mb-4 shadow">
              <Text className="text-lg font-bold text-gray-800 mb-3">Products</Text>

              {/* Search Bar */}
              <View className="mb-3">
                <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
                  <Feather name="search" size={20} color="#666" />
                  <TextInput
                    className="flex-1 ml-2 text-gray-700"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor="#999"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery("")}>
                      <Feather name="x" size={20} color="#666" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {filteredProducts.length > 0 ? (
                <ScrollView
                  className="max-h-64"
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled={true}
                >
                  {getDisplayProducts().map((product) => (
                    <View
                      key={product.id}
                      className="flex-row justify-between items-center py-2 border-b border-gray-100"
                    >
                      <Text className="text-gray-700">{product.name}</Text>
                      <Text className="text-gray-600 font-semibold">₹{product.price}</Text>
                    </View>
                  ))}

                  {/* View More Button */}
                  {!showAllProducts && filteredProducts.length > 3 && (
                    <TouchableOpacity
                      onPress={() => setShowAllProducts(true)}
                      className="mt-3 py-2 bg-blue-500 rounded-lg"
                    >
                      <Text className="text-white text-center font-semibold">
                        View More ({filteredProducts.length - 3} more)
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Show Less Button */}
                  {showAllProducts && filteredProducts.length > 3 && (
                    <TouchableOpacity
                      onPress={() => setShowAllProducts(false)}
                      className="mt-3 py-2 bg-gray-500 rounded-lg"
                    >
                      <Text className="text-white text-center font-semibold">Show Less</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              ) : (
                <Text className="text-gray-400 text-sm">
                  {searchQuery ? "No products found matching your search." : "No products found."}
                </Text>
              )}
            </View>

            {/* Transaction History Section */}
            <View className="bg-white p-4 rounded-lg mb-4 shadow">
              <Text className="text-lg font-bold text-gray-800 mb-3">Transaction History</Text>

              {/* Action Buttons - Below heading */}
              {transactions.length > 0 && (
                <View className="flex-row justify-center gap-2 mb-3">
                  {/* <TouchableOpacity
                    onPress={() => setShowStatementModal(true)}
                    className="bg-blue-500 px-3 py-2 rounded-lg"
                    style={{ minWidth: 140, alignItems: "center" }}
                  >
                    <Text className="text-white text-sm font-semibold">Download Statement</Text>
                  </TouchableOpacity>
                   */}

                  <TouchableOpacity
                    className="bg-blue-500 rounded-lg py-2 px-3"
                    onPress={() =>
                      router.push({
                        pathname: "/(customerTabs)/DownloadStatement",
                        params: { customerId, shopId },
                      })
                    }
                    accessibilityLabel="download-statement"
                    style={{ flex: 1, marginRight: 6, minWidth: "48%" }}
                  >
                    <Text className="text-white font-bold text-center text-sm">
                      Download Statement
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      const currentShopName = shopDetails?.name || "";
                      router.push({
                        pathname: "/(customerTabs)/history",
                        params: {
                          shopFilter: currentShopName,
                          timestamp: Date.now(), // Add timestamp to force fresh navigation
                        },
                      });
                    }}
                    className="bg-blue-500 px-3 py-2 rounded-lg"
                    style={{ minWidth: 140, alignItems: "center" }}
                  >
                    <Text className="text-white text-sm font-semibold">
                      View All {transactions.length > 3 ? `(${transactions.length - 3})` : ""}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {transactions.length > 0 ? (
                <View>
                  {transactions
                    .sort((a, b) => {
                      const getTime = (createdAt: any) => {
                        if (!createdAt) return 0;
                        if (createdAt && typeof createdAt.toDate === "function") {
                          return createdAt.toDate().getTime();
                        }
                        if (createdAt && typeof createdAt.seconds === "number") {
                          return createdAt.seconds * 1000;
                        }
                        if (typeof createdAt === "string") {
                          return new Date(createdAt).getTime();
                        }
                        if (typeof createdAt === "number") {
                          return createdAt;
                        }
                        return 0;
                      };
                      return getTime(b.createdAt) - getTime(a.createdAt);
                    })
                    .slice(0, 3)
                    .map((item) => {
                      const formatDate = (createdAt: any) => {
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
                        } catch (error) {
                          return "Invalid Date";
                        }
                      };

                      return (
                        <View
                          key={item.id}
                          className="flex-row justify-between items-center py-3 border-b border-gray-100"
                        >
                          <View className="flex-1">
                            <Text className="font-medium text-gray-800 mb-1">
                              {item.description || "Transaction"}
                            </Text>
                            <Text className="text-xs text-gray-500">
                              {formatDate(item.createdAt)}
                            </Text>
                            <Text className="text-xs text-gray-400 mt-1">
                              Type: {item.type.toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text
                              className={`font-semibold text-lg ${
                                item.type === "paid" || item.type === "advance"
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {item.type === "paid" || item.type === "advance" ? "+" : "-"}₹
                              {item.amount}
                            </Text>
                            <TouchableOpacity
                              onPress={() => handleDownloadInvoice(item)}
                              accessibilityLabel={`download-invoice-${item.id}`}
                              style={{
                                marginTop: 4,
                                padding: 4,
                                backgroundColor: "#F3F4F6",
                                borderRadius: 6,
                              }}
                            >
                              <Feather name="download" size={16} color="#2563EB" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}

                  {transactions.length > 3 && (
                    <TouchableOpacity
                      onPress={() => {
                        const currentShopName = shopDetails?.name || "";
                        router.push({
                          pathname: "/(customerTabs)/history",
                          params: {
                            shopFilter: currentShopName,
                            timestamp: Date.now(), // Add timestamp to force fresh navigation
                          },
                        });
                      }}
                      className="mt-3 py-2 bg-blue-500 rounded-lg"
                    >
                      <Text className="text-white text-center font-semibold">
                        View All Transactions ({transactions.length - 3} more)
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <Text className="text-gray-400 text-center py-4">No transactions found.</Text>
              )}
            </View>
          </View>
        }
        data={[]}
        renderItem={() => null}
      />

      {/* ========== Statement Range Modal ========== */}
      <Modal visible={showStatementModal} animationType="fade" transparent>
        <View style={modalStyles.container}>
          <View style={modalStyles.inner}>
            <Text style={modalStyles.title}>Download Statement</Text>
            <Text style={modalStyles.label}>From</Text>
            <TouchableOpacity
              onPress={() => setShowFromPicker(true)}
              style={[modalStyles.input, { justifyContent: "center" }]}
            >
              <Text>{fromDate || "Select start date"}</Text>
            </TouchableOpacity>

            <Text style={[modalStyles.label, { marginTop: 8 }]}>To</Text>
            <TouchableOpacity
              onPress={() => setShowToPicker(true)}
              style={[modalStyles.input, { justifyContent: "center" }]}
            >
              <Text>{toDate || "Select end date"}</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 12 }}>
              <Pressable
                onPress={() => setShowStatementModal(false)}
                style={modalStyles.buttonOutline}
              >
                <Text style={modalStyles.buttonOutlineText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleDownloadStatement}
                style={[modalStyles.buttonPrimary, processingStatement ? { opacity: 0.6 } : {}]}
                disabled={processingStatement}
              >
                <Text style={modalStyles.buttonPrimaryText}>
                  {processingStatement ? "Preparing..." : "Download"}
                </Text>
              </Pressable>
            </View>

            {/* Date Pickers */}
            {DateTimePickerComponent && showFromPicker && (
              <DateTimePickerComponent
                value={fromDate ? new Date(fromDate) : new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(event: any, selectedDate?: Date) => {
                  setShowFromPicker(Platform.OS === "ios");
                  if (selectedDate) {
                    const yyyy = selectedDate.getFullYear();
                    const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
                    const dd = String(selectedDate.getDate()).padStart(2, "0");
                    setFromDate(`${yyyy}-${mm}-${dd}`);
                  }
                }}
              />
            )}
            {DateTimePickerComponent && showToPicker && (
              <DateTimePickerComponent
                value={toDate ? new Date(toDate) : new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(event: any, selectedDate?: Date) => {
                  setShowToPicker(Platform.OS === "ios");
                  if (selectedDate) {
                    const yyyy = selectedDate.getFullYear();
                    const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
                    const dd = String(selectedDate.getDate()).padStart(2, "0");
                    setToDate(`${yyyy}-${mm}-${dd}`);
                  }
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ========== Shop Info Modal ========== */}
      <Modal visible={showShopInfoModal} animationType="fade" transparent>
        <View style={modalStyles.container}>
          <View style={modalStyles.inner}>
            <Text style={modalStyles.title}>Shop Details</Text>

            <View style={{ gap: 6 }}>
              {!!(shopInfo?.shopName || shopDetails?.name) && (
                <Text style={{ fontSize: 14 }}>
                  <Text style={{ fontWeight: "700" }}>Name: </Text>
                  {shopInfo?.shopName || shopDetails?.name}
                </Text>
              )}
              {!!shopInfo?.name && (
                <Text style={{ fontSize: 14 }}>
                  <Text style={{ fontWeight: "700" }}>Owner: </Text>
                  {shopInfo?.name}
                </Text>
              )}

              {!!shopDetails?.phone && (
                <Text style={{ fontSize: 14 }}>
                  <Text style={{ fontWeight: "700" }}>Phone: </Text>
                  {shopDetails?.phone}
                </Text>
              )}
              {!!shopInfo?.email && (
                <Text style={{ fontSize: 14 }}>
                  <Text style={{ fontWeight: "700" }}>Email: </Text>
                  {shopInfo?.email}
                </Text>
              )}
              {!!shopDetails?.address && (
                <Text style={{ fontSize: 14 }}>
                  <Text style={{ fontWeight: "700" }}>Address: </Text>
                  {shopDetails?.address}
                </Text>
              )}
              {!!shopDetails?.city && (
                <Text style={{ fontSize: 14 }}>
                  <Text style={{ fontWeight: "700" }}>City: </Text>
                  {shopDetails?.city}
                </Text>
              )}
              {!!shopDetails?.state && (
                <Text style={{ fontSize: 14 }}>
                  <Text style={{ fontWeight: "700" }}>State: </Text>
                  {shopDetails?.state}
                </Text>
              )}
              {!!shopDetails?.pincode && (
                <Text style={{ fontSize: 14 }}>
                  <Text style={{ fontWeight: "700" }}>Pincode: </Text>
                  {shopDetails?.pincode}
                </Text>
              )}
              {!!shopDetails?.gstNumber && (
                <Text style={{ fontSize: 14 }}>
                  <Text style={{ fontWeight: "700" }}>GST: </Text>
                  {shopDetails?.gstNumber}
                </Text>
              )}
              {!!shopDetails?.openingTime && (
                <Text style={{ fontSize: 14 }}>
                  <Text style={{ fontWeight: "700" }}>Opening: </Text>
                  {shopDetails?.openingTime}
                </Text>
              )}
              {!!shopDetails?.closingTime && (
                <Text style={{ fontSize: 14 }}>
                  <Text style={{ fontWeight: "700" }}>Closing: </Text>
                  {shopDetails?.closingTime}
                </Text>
              )}
              {shopDetails?.isOpen !== undefined && (
                <Text style={{ fontSize: 14 }}>
                  <Text style={{ fontWeight: "700" }}>Status: </Text>
                  {shopDetails?.isOpen ? "Open" : "Closed"}
                </Text>
              )}
              {!!shopDetails?.description && (
                <Text style={{ fontSize: 14 }}>
                  <Text style={{ fontWeight: "700" }}>About: </Text>
                  {shopDetails?.description}
                </Text>
              )}
            </View>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 12 }}>
              <Pressable
                onPress={() => setShowShopInfoModal(false)}
                style={modalStyles.buttonPrimary}
              >
                <Text style={modalStyles.buttonPrimaryText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  backButton: {
    width: 40,
    height: 40,
  },
});

const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: 16,
  },
  inner: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  buttonPrimary: {
    backgroundColor: "#10B981",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  buttonPrimaryText: {
    color: "#fff",
    fontWeight: "700",
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonOutlineText: {
    color: "#111827",
    fontWeight: "600",
  },
});

export default JoinedShopDetails;
