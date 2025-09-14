import { useRoute } from "@react-navigation/native";
import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "react-native-vector-icons/Feather";
import { db, auth } from "../../firebaseConfig";
import { Customer, Transaction } from "../../types";

interface RouteParams {
  customerId: string;
  shopId: string;
}

const CustomerProfile: React.FC = () => {
  const route = useRoute();
  const router = useRouter();
  const { customerId, shopId } = (route.params || {}) as RouteParams;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states for offline payment
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [processingPayment, setProcessingPayment] = useState(false);

  // Statement (invoice) generation states
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [processingStatement, setProcessingStatement] = useState(false);

  // Shop info for invoices/statements
  const [shopInfo, setShopInfo] = useState<any>(null);
  // Dynamic date picker support
  const [DateTimePickerComponent, setDateTimePickerComponent] = useState<any>(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  // Reminder functionality states
  const [sendingReminder, setSendingReminder] = useState(false);
  const [lastReminderSent, setLastReminderSent] = useState<string | null>(null);

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

  useEffect(() => {
    if (!customerId || !shopId) {
      Alert.alert("Error", "Missing customerId or shopId");
      setLoading(false);
      return;
    }

    let unsubscribeTransactions: (() => void) | null = null;
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      // 1) load customer doc once
      try {
        const customerRef = doc(db, "customers", customerId);
        const customerSnap = await getDoc(customerRef);
        if (!cancelled) {
          if (customerSnap.exists()) {
            const customerData = customerSnap.data();
            setCustomer({ uid: customerSnap.id, ...customerData } as Customer);
            
            // Load customer's last reminder sent time
            if (customerData.lastPaymentReminder) {
              setLastReminderSent(customerData.lastPaymentReminder);
            }
          } else {
            setCustomer(null);
          }
        }
      } catch (err) {
        console.error("Failed to load customer:", err);
        if (!cancelled) Alert.alert("Error", "Could not load customer info.");
      }

      // Load shop/owner info for invoice/statement header
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

      // 2) subscribe to transactions ordered by createdAt desc (newest first)
      try {
        const q = query(
          collection(db, "transactions"),
          where("customerId", "==", customerId),
          where("shopId", "==", shopId),
          orderBy("createdAt", "desc") // server-side ordering
        );

        unsubscribeTransactions = onSnapshot(
          q,
          (snapshot) => {
            if (cancelled) return;
            // Check if user is still authenticated before processing data
            if (!auth.currentUser) return;
            
            const txns: Transaction[] = snapshot.docs.map((d) => ({
              id: d.id,
              ...(d.data() as any),
            }));
            
            // Client-side sorting as backup to ensure proper order
            const sortedTxns = txns.sort((a, b) => {
              const timeA = getTimeFromCreatedAt(a.createdAt);
              const timeB = getTimeFromCreatedAt(b.createdAt);
              // Sort by newest first (descending order)
              return timeB - timeA;
            });
            
            console.log('Raw transactions:', txns.length);
            console.log('Sorted transactions:', sortedTxns.length);
            console.log('Sample transaction dates:', sortedTxns.slice(0, 3).map(t => ({
              id: t.id,
              createdAt: t.createdAt,
              time: getTimeFromCreatedAt(t.createdAt),
              date: new Date(getTimeFromCreatedAt(t.createdAt)).toLocaleString()
            })));
            
            setTransactions(sortedTxns);
            setLoading(false);
          },
          (err) => {
            console.error("Transactions subscription error:", err);
            if (!cancelled) Alert.alert("Error", "Could not load transactions.");
            setLoading(false);
          }
        );
      } catch (err: any) {
        console.error("Failed to subscribe to transactions:", err);
        if (!cancelled) Alert.alert("Error", "Failed to load transaction history.");
        setLoading(false);
      }
    };

    load();

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

    return () => {
      cancelled = true;
      if (unsubscribeTransactions) unsubscribeTransactions();
    };
  }, [customerId, shopId]);

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
      // Customer owes money
      return { due: runningBalance, advance: 0 };
    } else if (runningBalance < 0) {
      // Customer has paid more than owed (has credit)
      return { due: 0, advance: Math.abs(runningBalance) };
    } else {
      // Perfect balance
      return { due: 0, advance: 0 };
    }
  };

  // Function to check if reminder can be sent (spam prevention - 6 hours)
  const canSendReminder = () => {
    if (!lastReminderSent) return true;
    
    const lastSent = new Date(lastReminderSent);
    const now = new Date();
    const timeDiff = now.getTime() - lastSent.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    // Allow sending reminders only once every 6 hours
    return hoursDiff >= 6;
  };

  // Function to check if customer has recent notifications (additional spam prevention)
  const hasRecentNotifications = async () => {
    try {
      const now = new Date();
      const sixHoursAgo = new Date(now.getTime() - (6 * 60 * 60 * 1000));
      
      const q = query(
        collection(db, 'notifications'),
        where('customerId', '==', customer?.uid),
        where('shopId', '==', shopId),
        where('type', '==', 'payment_reminder'),
        where('createdAt', '>=', sixHoursAgo.toISOString())
      );
      
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.warn('Failed to check recent notifications:', error);
      return false; // Allow sending if check fails
    }
  };

  // Function to send reminder notification to specific customer
  const sendReminderNotification = async () => {
    if (!customer || !shopInfo) {
      Alert.alert('Error', 'Customer or shop information not available. Please try again.');
      return;
    }

    // Check if reminder was recently sent (spam prevention)
    if (!canSendReminder()) {
      const lastSent = new Date(lastReminderSent!);
      const nextAllowed = new Date(lastSent.getTime() + (6 * 60 * 60 * 1000));
      const hoursLeft = Math.ceil((nextAllowed.getTime() - new Date().getTime()) / (1000 * 60 * 60));
      
      Alert.alert(
        'Reminder Recently Sent', 
        `A reminder was sent recently. You can send a new reminder in ${hoursLeft} hour(s).`,
        [{ text: 'OK' }]
      );
      return;
    }

    // Additional check for recent notifications in database
    const hasRecent = await hasRecentNotifications();
    if (hasRecent) {
      Alert.alert(
        'Reminder Recently Sent', 
        'A reminder was sent recently to this customer. Please wait 6 hours before sending another.',
        [{ text: 'OK' }]
      );
      return;
    }

    setSendingReminder(true);
    
    try {
      const calculatedBalance = calculateBalance();
      
      if (calculatedBalance.due <= 0) {
        Alert.alert('No Dues', 'This customer has no pending payments.');
        return;
      }

      // Create notification record in Firestore
      const notificationData = {
        shopId: shopId,
        shopName: shopInfo.shopName || 'Shop',
        customerId: customer.uid,
        customerName: customer.name,
        customerPhone: customer.phone,
        type: 'payment_reminder',
        title: 'Payment Reminder',
        message: `Dear ${customer.name}, you have a pending payment of ₹${calculatedBalance.due.toFixed(2)} at ${shopInfo.shopName || 'our shop'}. Please clear your dues at your earliest convenience.`,
        amount: calculatedBalance.due,
        status: 'sent',
        createdAt: new Date().toISOString(),
        read: false,
        shopOwnerName: shopInfo.name || 'Shop Owner',
        // Additional fields for better customer targeting
        customerEmail: customer.email || null,
        reminderType: 'individual_customer',
        source: 'CustomerProfile'
      };

      // Add to notifications collection
      const notificationRef = await addDoc(collection(db, 'notifications'), notificationData);
      console.log('✅ Reminder notification sent successfully:', {
        notificationId: notificationRef.id,
        customerId: customer.uid,
        customerName: customer.name,
        amount: calculatedBalance.due,
        timestamp: new Date().toISOString()
      });

      // Update customer's last reminder sent
      if (customer.uid) {
        try {
          await updateDoc(doc(db, 'customers', customer.uid), {
            lastPaymentReminder: new Date().toISOString(),
            lastReminderAmount: calculatedBalance.due
          });
        } catch (updateError) {
          console.warn('Failed to update customer reminder timestamp:', updateError);
        }
      }

      // Update last reminder sent time in local state
      setLastReminderSent(new Date().toISOString());

      // Log the action for analytics
      await addDoc(collection(db, 'notificationLogs'), {
        shopId: shopId,
        action: 'individual_payment_reminder',
        customerId: customer.uid,
        customerName: customer.name,
        amount: calculatedBalance.due,
        timestamp: new Date().toISOString(),
        notificationId: notificationRef.id
      });

      // Verify notification was saved (optional verification)
      try {
        const savedNotification = await getDoc(doc(db, 'notifications', notificationRef.id));
        if (savedNotification.exists()) {
          console.log('✅ Notification verified in database:', savedNotification.data());
        } else {
          console.warn('⚠️ Notification not found in database after saving');
        }
      } catch (verifyError) {
        console.warn('⚠️ Could not verify notification in database:', verifyError);
      }

      Alert.alert(
        'Reminder Sent Successfully!', 
        `Payment reminder sent to ${customer.name} (${customer.uid}) for ₹${calculatedBalance.due.toFixed(2)}.\n\nNotification ID: ${notificationData.customerId}\nShop: ${shopInfo.shopName}`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('Failed to send reminder:', error);
      Alert.alert('Error', 'Failed to send reminder. Please try again.');
    } finally {
      setSendingReminder(false);
    }
  };

  // Open small modal to record offline payment
  const openPaymentModal = () => {
    setPaymentAmount("");
    setPaymentNote("");
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    if (processingPayment) return; // prevent closing when processing
    setShowPaymentModal(false);
  };

  // Confirm offline payment -> add a 'paid' transaction
  const submitOfflinePayment = async () => {
    const amt = Number(paymentAmount.toString().replace(/[^\d.]/g, ""));
    if (!amt || isNaN(amt) || amt <= 0) {
      Alert.alert("Error", "Please enter a valid amount greater than 0.");
      return;
    }
    if (!customerId || !shopId) {
      Alert.alert("Error", "Missing customer or shop information.");
      return;
    }

    setProcessingPayment(true);
    try {
      const description = paymentNote?.trim() ? `Offline payment: ${paymentNote.trim()}` : "Offline payment";
      await addDoc(collection(db, "transactions"), {
        shopId,
        customerId,
        amount: amt,
        type: "paid",
        description,
        createdAt: serverTimestamp(),
        meta: { method: "offline" },
      });

      // Optionally: you can update a customer's quick fields here (like lastPaidAt / lastPayment)
      // await updateDoc(doc(db, 'customers', customerId), { lastPaidAt: serverTimestamp() });

      Alert.alert("Success", `Recorded payment of ₹${amt}`, [{ text: "OK", onPress: closePaymentModal }]);
    } catch (e) {
      console.error("Failed to add offline payment:", e);
      Alert.alert("Error", "Failed to record payment. Try again.");
    } finally {
      setProcessingPayment(false);
    }
  };

  // Helpers for date range
  const parseDateInput = (value: string) => {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed);
  };

  const filterTransactionsByDateRange = (from: string, to: string) => {
    const fromDt = parseDateInput(from);
    const toDt = parseDateInput(to);
    if (!fromDt || !toDt) return [] as Transaction[];
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
    const shopName = shopInfo?.shopName || "ShopMunim";
    const ownerName = shopInfo?.name || "";
    const phone = shopInfo?.phone ? `Phone: ${shopInfo.phone}` : "";
    const email = shopInfo?.email ? `Email: ${shopInfo.email}` : "";
    const address = shopInfo?.address ? `${shopInfo.address}` : "";
    return `
      <div class=\"header\">
        <div>
          <div class=\"title\">${shopName}</div>
          <div class=\"muted\">${ownerName}</div>
        </div>
        <div style=\"text-align:right\">
          <div class=\"muted\">${phone}</div>
          <div class=\"muted\">${email}</div>
          <div class=\"muted\">${address}</div>
        </div>
      </div>
    `;
  };

  const buildStatementHtml = (from: string, to: string, txns: Transaction[]) => {
    const customerName = customer?.name || customer?.uid || "Customer";
    const rows = txns
      .map((t) => {
        const dateStr = new Date(getTimeFromCreatedAt((t as any).createdAt)).toLocaleString();
        const amount = Number(t.amount || 0).toFixed(2);
        const sign = t.type === "due" ? "+" : "-";
        const color = t.type === "due" ? "#DC2626" : "#059669";
        return `<tr>
          <td style=\"padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;\">${dateStr}</td>
          <td style=\"padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;\">${t.description || "Transaction"}</td>
          <td style=\"padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;\">${t.type.toUpperCase()}</td>
          <td style=\"padding:8px;border-bottom:1px solid #e5e7eb;font-weight:700;color:${color};text-align:right;\">${sign}₹${amount}</td>
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
            <div style=\"display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;\">
              <div class=\"muted\">Statement for ${customerName}</div>
              <div class=\"muted\">${new Date().toLocaleString()}</div>
            </div>
            <div class=\"muted\" style=\"margin-bottom:6px;\">Range: ${from} to ${to}</div>
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
                ${rows || `<tr><td colspan=\"4\" style=\"padding:12px;text-align:center;color:#6b7280;\">No transactions</td></tr>`}
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
      const name = `statement_${fromDate}_${toDate}_${customer?.uid || "customer"}.pdf`;
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Share Statement",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("Saved", `Statement saved at: ${uri}`);
      }

      // Log admin download event (statement)
      try {
        await addDoc(collection(db, "owners", shopId, "invoiceDownloads"), {
          shopId,
          customerId,
          invoiceType: "statement",
          periodFrom: fromDate,
          periodTo: toDate,
          transactionCount: filtered.length,
          createdAt: serverTimestamp(),
          platform: Platform.OS,
          source: "CustomerProfile",
        });
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
  const buildInvoiceHtml = (txn: Transaction) => {
    const shopName = shopInfo?.shopName || "ShopMunim";
    const ownerName = shopInfo?.name || "";
    const phone = shopInfo?.phone ? `Phone: ${shopInfo.phone}` : "";
    const email = shopInfo?.email ? `Email: ${shopInfo.email}` : "";
    const address = shopInfo?.address ? `${shopInfo.address}` : "";
    const customerName = customer?.name || customer?.uid || "Customer";
    const createdAtMs = getTimeFromCreatedAt((txn as any).createdAt);
    const dateStr = createdAtMs ? new Date(createdAtMs).toLocaleString() : new Date().toLocaleString();
    const amountStr = `₹${Number(txn.amount || 0).toFixed(2)}`;
    const sign = txn.type === "due" ? "+" : "-";
    return `
      <html>
        <head>
          <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
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
          <div class=\"card\">
            ${buildHeaderHtml()}
            <div class=\"row\"><div class=\"label\">Invoice ID</div><div class=\"value\">${txn.id}</div></div>
            <div class=\"row\"><div class=\"label\">Date</div><div class=\"value\">${dateStr}</div></div>
            <div class=\"row\"><div class=\"label\">Customer</div><div class=\"value\">${customerName}</div></div>
            <div class=\"row\"><div class=\"label\">Type</div><div class=\"value\">${txn.type.toUpperCase()}</div></div>
            <div class=\"row\"><div class=\"label\">Description</div><div class=\"value\">${txn.description || "Transaction"}</div></div>
            <div class=\"row\" style=\"margin-top:16px;\">
              <div class=\"label\">Amount</div>
              <div class=\"amount\">${sign}${amountStr}</div>
            </div>
            <div class=\"footer\">Generated by ShopMunim</div>
          </div>
        </body>
      </html>
    `;
  };

  const handleDownloadInvoice = async (txn: Transaction) => {
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

      // Log admin download event (single invoice)
      try {
        await addDoc(collection(db, "owners", shopId, "invoiceDownloads"), {
          shopId,
          customerId,
          transactionId: txn.id,
          invoiceType: "single",
          createdAt: serverTimestamp(),
          platform: Platform.OS,
          source: "CustomerProfile",
        });
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

  if (!customer) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text>Customer not found.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-[#F7F7F7]">
      <ScrollView>
        <View className="flex-1 p-4">
          <TouchableOpacity
            onPress={() => router.navigate("/(ownerTabs)")}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>

          {/* Header */}
          <View className="mb-4 bg-white p-4 rounded-lg shadow">
            <Text className="text-xl font-bold text-gray-800">{customer.name}</Text>
            <Text className="text-xs text-gray-500">Customer ID: {customer.uid}</Text>

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
                    {calculateBalance().due > 0 ? "Customer owes this amount" : "No amount due"}
                  </Text>
                </View>

                {/* Advance Section */}
                <View className="flex-1 bg-green-50 p-3 rounded-lg ml-2">
                  <Text className="text-xs text-gray-600 mb-1">Credit Balance</Text>
                  <Text className="text-lg font-bold text-green-600">
                    ₹{calculateBalance().advance.toFixed(2)}
                  </Text>
                  <Text className="text-xs text-gray-500 mt-1">
                    {calculateBalance().advance > 0 ? "Customer has credit" : "No credit"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Row with Add Transaction, Record Payment, Download Statement and Send Reminder */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <TouchableOpacity
              className="bg-blue-500 rounded-lg py-2 px-3"
              onPress={() =>
                router.push({
                  pathname: "/(ownerTabs)/AddTransaction",
                  params: { customerId, shopId },
                })
              }
              style={{ flex: 1, marginRight: 6, marginBottom: 6, minWidth: "48%" }}
            >
              <Text className="text-white font-bold text-center text-sm">+ Add Transaction</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-blue-500 rounded-lg py-2 px-3"
              onPress={openPaymentModal}
              accessibilityLabel="record-offline-payment"
              style={{ flex: 1, marginLeft: 6, marginBottom: 6, minWidth: "48%" }}
            >
              <Text className="text-white font-bold text-center text-sm">Record Payment</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-blue-500 rounded-lg py-2 px-3"
              onPress={() => setShowStatementModal(true)}
              accessibilityLabel="download-statement"
              style={{ flex: 1, marginRight: 6, minWidth: "48%" }}
            >
              <Text className="text-white font-bold text-center text-sm">Download Statement</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`rounded-lg py-2 px-3 ${
                sendingReminder || !canSendReminder() ? "bg-gray-300" : "bg-orange-500"
              }`}
              onPress={sendReminderNotification}
              disabled={sendingReminder || !canSendReminder()}
              style={{ flex: 1, marginLeft: 6, minWidth: "48%" }}
            >
              <Text
                className={`font-bold text-center text-sm ${
                  sendingReminder || !canSendReminder() ? "text-gray-500" : "text-white"
                }`}
              >
                {sendingReminder
                  ? "Sending..."
                  : !canSendReminder()
                  ? "Recently Sent"
                  : "Send Reminder"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Reminder Status */}
          {calculateBalance().due > 0 && (
            <View className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
              <View className="flex-row items-center">
                <Feather name="bell" size={20} color="#F97316" />
                <View className="ml-2 flex-1">
                  <Text className="text-orange-800 text-sm">
                    {sendingReminder
                      ? "Sending payment reminder to customer..."
                      : `Ready to send payment reminder to ${
                          customer?.name
                        } for ₹${calculateBalance().due.toFixed(2)}.`}
                  </Text>
                  {lastReminderSent && !sendingReminder && (
                    <View>
                      <Text className="text-orange-600 text-xs mt-1">
                        Last sent: {new Date(lastReminderSent).toLocaleString()}
                      </Text>
                      {!canSendReminder() && (
                        <Text className="text-orange-600 text-xs mt-1">
                          Next reminder available in{" "}
                          {Math.ceil(
                            (new Date(lastReminderSent).getTime() +
                              6 * 60 * 60 * 1000 -
                              new Date().getTime()) /
                              (1000 * 60 * 60)
                          )}{" "}
                          hour(s)
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Transaction History */}
          <View className="bg-white rounded-lg p-4 shadow">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-base font-bold text-gray-800">Transaction History</Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text className="text-xs text-gray-500" style={{ marginRight: 12 }}>
                  ({transactions.length} transactions)
                </Text>
                {transactions.length > 5 && (
                  <TouchableOpacity
                    onPress={() =>
                      router.navigate({ pathname: "./history", params: { customerId } })
                    }
                  >
                    <Text className="text-sm font-semibold text-blue-600">View All</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {transactions.slice(0, 5).map((item) => (
              <View
                key={item.id}
                className="flex-row justify-between items-center py-3 border-b border-gray-100"
              >
                <View>
                  <Text className="font-medium text-gray-800">
                    {item.description || "Transaction"}
                  </Text>
                  <Text className="text-xs text-gray-400">
                    {new Date(getTimeFromCreatedAt(item.createdAt)).toLocaleString()}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text
                    className={`font-semibold ${
                      item.type === "due" ? "text-red-600" : "text-green-600"
                    }`}
                    style={{ marginRight: 12 }}
                  >
                    {item.type === "due" ? "+" : "-"}₹{item.amount}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleDownloadInvoice(item)}
                    accessibilityLabel={`download-invoice-${item.id}`}
                  >
                    <Feather name="download" size={20} color="#2563EB" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {transactions.length === 0 && (
              <Text className="text-center text-gray-400 mt-4">No transactions found.</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ========== Offline Payment Modal ========== */}
      <Modal visible={showPaymentModal} animationType="fade" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={modalStyles.container}
        >
          <View style={[modalStyles.inner, { marginBottom: Platform.OS === "ios" ? 34 : 0 }]}>
            <Text style={modalStyles.title}>Record Offline Payment</Text>

            <Text style={modalStyles.label}>Amount (₹)</Text>
            <TextInput
              keyboardType="numeric"
              placeholder="e.g. 500"
              placeholderTextColor="#9CA3AF"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              style={modalStyles.input}
            />

            <Text style={[modalStyles.label, { marginTop: 8 }]}>Note (optional)</Text>
            <TextInput
              placeholder="e.g. Cash received at shop"
              placeholderTextColor="#9CA3AF"
              value={paymentNote}
              onChangeText={setPaymentNote}
              style={modalStyles.input}
            />

            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 12 }}>
              <Pressable onPress={closePaymentModal} style={modalStyles.buttonOutline}>
                <Text style={modalStyles.buttonOutlineText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={submitOfflinePayment}
                style={[modalStyles.buttonPrimary, processingPayment ? { opacity: 0.6 } : {}]}
                disabled={processingPayment}
              >
                <Text style={modalStyles.buttonPrimaryText}>
                  {processingPayment ? "Saving..." : "Confirm"}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========== Statement Range Modal ========== */}
      <Modal visible={showStatementModal} animationType="fade" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={modalStyles.container}
        >
          <View style={[modalStyles.inner, { marginBottom: Platform.OS === "ios" ? 34 : 0 }]}>
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
        </KeyboardAvoidingView>
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
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
    marginBottom: 0, // Remove the small margin
  },
  inner: {
    backgroundColor: "#fff",
    padding: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingBottom: 32, // Add extra padding at bottom for safe area
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
  segment: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  segmentText: {
    color: "#111827",
    fontWeight: "600",
  },
  segmentActive: {
    backgroundColor: "#4F46E5",
    borderColor: "#4F46E5",
  },
  segmentActiveText: {
    color: "#fff",
    fontWeight: "700",
  },
});

export default CustomerProfile;