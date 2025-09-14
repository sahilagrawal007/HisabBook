import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Dimensions, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "react-native-vector-icons/Feather";
import Icon from "react-native-vector-icons/MaterialIcons";
import { db } from "../../firebaseConfig";
import { useFocusEffect } from "@react-navigation/native";

const screenWidth = Dimensions.get("window").width;

export default function CustomerHomeScreen() {
  const [customer, setCustomer] = useState<any>(null);
  const [shops, setShops] = useState<any[]>([]);
  const [due, setDue] = useState(0);
  const [spent, setSpent] = useState(0);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [previousNotificationCount, setPreviousNotificationCount] = useState(0);
  const router = useRouter();

  // Function to mark notification as read
  const markNotificationAsRead = async (notificationId: string) => {
    try {
      // Update notification in Firestore to mark as read
      const notificationRef = doc(db, "notifications", notificationId);
      await updateDoc(notificationRef, { read: true });

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {}
  };

  // Function to show toast notification
  const displayToast = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Fallback function to fetch notifications without real-time updates
  const fetchNotificationsFallback = async (joinedShops: string[], customerId: string) => {
    try {
      const notificationsRef = collection(db, "notifications");
      const q = query(notificationsRef, where("customerId", "==", customerId));
      const snapshot = await getDocs(q);

      const notificationsList: any[] = [];
      let unread = 0;

      snapshot.forEach((doc) => {
        const notification = { id: doc.id, ...doc.data() };
        // Include ALL notifications for this customer (not just from joined shops)
        // This shows complete history including past notifications
        notificationsList.push(notification);
        if (!(notification as any).read) {
          unread++;
        }
      });

      // Sort by creation date (newest first)
      notificationsList.sort((a, b) => {
        const dateA = new Date((a as any).createdAt || 0).getTime();
        const dateB = new Date((b as any).createdAt || 0).getTime();
        return dateB - dateA;
      });

      setNotifications(notificationsList);
      setUnreadCount(unread);
      setPreviousNotificationCount(notificationsList.length);
    } catch (error) {
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return;

    let unsubscribe: any;
    let customerUnsubscribe: any;
    let notificationsUnsubscribe: any;

    const fetchData = async () => {
      const customerDoc = await getDoc(doc(db, "customers", user.uid));
      if (!customerDoc.exists()) return;

      const customerData = customerDoc.data();
      setCustomer(customerData);
      setProfileImage(customerData.photoURL || null);

      // Listen for customer profile changes
      customerUnsubscribe = onSnapshot(doc(db, "customers", user.uid), (doc) => {
        // Check if user is still authenticated before processing data
        if (!getAuth().currentUser) return;

        if (doc.exists()) {
          const data = doc.data();
          setCustomer(data);
          setProfileImage(data.photoURL || null);
        }
      });

      const joinedShops: string[] = customerData.shopsJoined || [];
      const shopsData = [];

      for (const shopId of joinedShops) {
        const shopDoc = await getDoc(doc(db, "shops", shopId));
        if (shopDoc.exists()) {
          shopsData.push({ id: shopId, ...shopDoc.data() });
        }
      }
      setShops(shopsData);

      // Listen for notifications from joined shops
      if (joinedShops.length > 0) {
        try {
          // Get ALL notifications for this customer (not just from joined shops)
          // This ensures customers see their complete notification history
          const notificationsQuery = query(
            collection(db, "notifications"),
            where("customerId", "==", user.uid)
          );

          notificationsUnsubscribe = onSnapshot(
            notificationsQuery,
            (snapshot) => {
              // Check if user is still authenticated before processing data
              if (!getAuth().currentUser) return;

              const notificationsList: any[] = [];
              let unread = 0;

              snapshot.forEach((doc) => {
                const notification = { id: doc.id, ...doc.data() };
                // Include ALL notifications for this customer (not just from joined shops)
                // This shows complete history including past notifications from shops they may have left
                notificationsList.push(notification);
                if (!(notification as any).read) {
                  unread++;
                }
              });

              // Sort by creation date (newest first)
              notificationsList.sort((a, b) => {
                const dateA = new Date((a as any).createdAt || 0).getTime();
                const dateB = new Date((b as any).createdAt || 0).getTime();
                return dateB - dateA;
              });

              // Check if new notifications arrived
              if (
                notificationsList.length > previousNotificationCount &&
                previousNotificationCount > 0
              ) {
                const newCount = notificationsList.length - previousNotificationCount;
                displayToast(`You have ${newCount} new notification${newCount > 1 ? "s" : ""}!`);
              }

              setNotifications(notificationsList);
              setUnreadCount(unread);
              setPreviousNotificationCount(notificationsList.length);
            },
            (error) => {
              // Fallback: try to fetch without real-time updates
              fetchNotificationsFallback(joinedShops, user.uid);
            }
          );
        } catch (error) {
          // Fallback: try to fetch without real-time updates
          fetchNotificationsFallback(joinedShops, user.uid);
        }
      }

      const txnQuery = query(
        collection(db, "transactions"),
        where("customerId", "==", user.uid)
        // Removed shopId filter to get ALL transactions for the customer
        // This ensures we don't miss transactions from shops they may have left
      );

      unsubscribe = onSnapshot(txnQuery, (snapshot) => {
        // Check if user is still authenticated before processing data
        if (!getAuth().currentUser) return;

        let totalPaid = 0;
        let totalAdvance = 0;
        let totalDue = 0;

        snapshot.forEach((doc) => {
          const txn = doc.data();
          const amount = Number(txn.amount) || 0;

          if (txn.type === "paid") {
            totalPaid += amount;
          } else if (txn.type === "due") {
            totalDue += amount;
          } else if (txn.type === "advance") {
            totalAdvance += amount;
          }
        });

        // Calculate net outstanding due (what customer actually owes)
        // Due transactions - (Paid + Advance payments)
        const netDue = Math.max(totalDue - (totalPaid + totalAdvance), 0);

        // Total spent = All payments made (paid + advance)
        const totalSpent = totalPaid + totalAdvance;

        // Total credit used = Total due amount (what was purchased on credit)
        const totalCreditUsed = totalDue;

        setDue(netDue);
        setSpent(totalSpent);
      });
    };

    fetchData();

    return () => {
      if (unsubscribe) unsubscribe();
      if (customerUnsubscribe) customerUnsubscribe();
      if (notificationsUnsubscribe) notificationsUnsubscribe();
    };
  }, []);

    useFocusEffect(
      useCallback(() => {
        const user = getAuth().currentUser;
        if (!user) return;

        const refetch = async () => {
          const customerDoc = await getDoc(doc(db, "customers", user.uid));
          if (!customerDoc.exists()) return;

          const customerData = customerDoc.data();
          setCustomer(customerData);
          setProfileImage(customerData.photoURL || null);

          const joinedShops: string[] = customerData.shopsJoined || [];
          const shopsData: any[] = [];
          for (const shopId of joinedShops) {
            const shopDoc = await getDoc(doc(db, "shops", shopId));
            if (shopDoc.exists()) {
              shopsData.push({ id: shopId, ...shopDoc.data() });
            }
          }
          setShops(shopsData);
        };

        refetch();
      }, [])
    );
    
  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-[#F7F7F7]">
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6">
          <View className="flex-row items-center">
            <Icon name="storefront" size={30} color="#4B82F6" />
            <Text className="text-xl font-bold text-gray-900 ml-2">ShopMunim</Text>
          </View>
          <TouchableOpacity onPress={() => router.navigate("./notifications")} className="relative">
            <Icon name="notifications-active" size={30} color="#3B82F6" />
            {unreadCount > 0 && (
              <View className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 items-center justify-center">
                <Text className="text-white text-xs font-bold">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <LinearGradient
          colors={["#3B82F6", "#60A5FA"]}
          className="rounded-2xl p-4 flex-row justify-between items-center mb-6"
        >
          <View className="flex-1">
            <Text className="text-white text-sm">Welcome back,</Text>
            <Text className="text-white text-xl font-bold mt-1">{customer?.name}</Text>
            <Text className="text-white text-xs mt-2 opacity-90">
              Track your purchases and dues from all your favourite shops.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(customerTabs)/editProfile")}
            className="ml-4"
          >
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                className="w-20 h-20 rounded-full border-4 border-white"
                style={{ resizeMode: "cover" }}
              />
            ) : (
              <View className="w-20 h-20 rounded-full border-4 border-white bg-gray-200 flex items-center justify-center">
                <Feather name="user" size={40} color="#9CA3AF" />
              </View>
            )}
          </TouchableOpacity>
        </LinearGradient>

        {/* Quick Actions */}
        <View className="mb-6 bg-white p-4 rounded-lg shadow-md border border-gray-200">
          <Text className="text-lg font-bold text-gray-800 mb-4">Quick Actions</Text>
          <View className="flex-row justify-between">
            {/* Scan QR Code */}
            <TouchableOpacity
              onPress={() => router.push("/(customerTabs)/scan")}
              className="w-[48%] bg-white p-4 rounded-xl shadow items-center"
            >
              <View className="bg-green-100 p-3 rounded-full mb-2">
                <Icon name="qr-code-scanner" size={28} color="#10B981" />
              </View>
              <Text className="text-lg font-bold text-green-600">Scan QR</Text>
              <Text className="text-sm text-gray-500 text-center">Join new shops</Text>
            </TouchableOpacity>

            {/* Browse Shops */}
            <TouchableOpacity
              onPress={() => router.push("/(customerTabs)/shops")}
              className="w-[48%] bg-white p-4 rounded-xl shadow items-center"
            >
              <View className="bg-blue-100 p-3 rounded-full mb-2">
                <Icon name="storefront" size={28} color="#3B82F6" />
              </View>
              <Text className="text-lg font-bold text-blue-600">Browse</Text>
              <Text className="text-sm text-gray-500 text-center">Find shops</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary Cards */}
        <View className="mb-6 bg-white p-4 rounded-lg shadow-md border border-gray-200">
          <Text className="text-lg font-bold text-gray-800 mb-4">Spending Summary</Text>
          <View className="flex-row justify-between">
            {/* Total Spent Card (Updated to Red Theme) */}
            <View className="w-[48%] bg-white p-4 rounded-xl shadow items-center">
              <View className="bg-red-100 p-3 rounded-full mb-2">
                <Icon name="currency-rupee" size={28} color="#EF4444" />
              </View>
              <Text className="text-lg font-bold text-red-600">₹{spent}</Text>
              <Text className="text-sm text-gray-500 text-center">Total Spent</Text>
            </View>

            {/* Due Card (Yellow Theme) */}
            <View className="w-[48%] bg-white p-4 rounded-xl shadow items-center">
              <View className="bg-yellow-100 p-3 rounded-full mb-2">
                <Feather name="clock" size={20} color="#F59E0B" />
              </View>
              <Text className="text-lg font-bold text-yellow-600">₹{due}</Text>
              <Text className="text-sm text-gray-500 text-center">Due</Text>
            </View>
          </View>
        </View>

        {/* Shops List */}
        <View className="mb-6 bg-white p-4 rounded-lg shadow-md border border-gray-200">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-gray-800">Your Shops</Text>
            {shops.length > 3 && (
              <TouchableOpacity
                onPress={() => router.push("/(customerTabs)/shops")}
                className="bg-blue-50 px-3 py-1 rounded-full"
              >
                <Text className="text-blue-600 text-sm font-medium">View All ({shops.length})</Text>
              </TouchableOpacity>
            )}
          </View>
          {shops.length > 0 ? (
            <>
              {shops.slice(0, 3).map((shop) => (
                <TouchableOpacity
                  key={shop.id}
                  className="flex-row justify-between items-center py-3 border-b border-gray-100 last:border-b-0"
                  onPress={() =>
                    router.push({
                      pathname: "/(customerTabs)/shopDetails",
                      params: { shopId: shop.id },
                    })
                  }
                >
                  <View className="flex-row items-center">
                    <View className="bg-blue-100 p-2 rounded-full mr-3">
                      <Icon name="storefront" size={18} color="#4B82F6" />
                    </View>
                    <View>
                      <Text className="text-gray-700 text-base font-medium">{shop.name}</Text>
                      {shop.address && (
                        <Text className="text-gray-500 text-sm" numberOfLines={1}>
                          📍 {shop.address}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Icon name="arrow-forward-ios" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
              {shops.length > 3 && (
                <TouchableOpacity
                  onPress={() => router.push("/(customerTabs)/shops")}
                  className="mt-3 py-2 items-center bg-gray-50 rounded-lg"
                >
                  <Text className="text-blue-600 text-sm font-medium">
                    +{shops.length - 3} more shops
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View className="py-4 items-center">
              <Icon name="storefront" size={32} color="#9CA3AF" />
              <Text className="text-gray-500 mt-2">No shops joined yet</Text>
              <Text className="text-gray-400 text-sm text-center mt-1">
                Join shops to start tracking your purchases
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(customerTabs)/shops")}
                className="mt-3 bg-blue-50 px-4 py-2 rounded-lg"
              >
                <Text className="text-blue-600 font-medium">Browse Shops</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Notifications Section */}
        <View className="mb-6 bg-white p-4 rounded-lg shadow-md border border-gray-200">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-gray-800">Notifications</Text>
            <Link
              href="./(customerTabs)/notifications"
              className="text-blue-600 text-sm mt-3 self-end"
            >
              View All
            </Link>
          </View>

          {notifications.length > 0 ? (
            <View>
              {/* Summary */}
              <View className="bg-blue-50 p-3 rounded-lg mb-3">
                <Text className="text-blue-800 text-sm font-medium">
                  📱 {notifications.length} total notifications • {unreadCount} unread
                </Text>
              </View>

              {/* Recent Notifications Preview */}
              {notifications.slice(0, 2).map((notification, index) => {
                const isNew = !(notification as any).read;
                return (
                  <TouchableOpacity
                    key={notification.id}
                    className={`p-3 border-l-4 mb-2 rounded-lg ${
                      isNew ? "bg-blue-50 border-blue-500" : "bg-gray-50 border-gray-300"
                    }`}
                    onPress={() => router.push("./(customerTabs)/notifications")}
                  >
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1">
                        <Text className="font-medium text-gray-900 text-sm mb-1">
                          {notification.title || "Payment Reminder"}
                        </Text>
                        <Text className="text-gray-600 text-xs" numberOfLines={2}>
                          {notification.message}
                        </Text>
                      </View>
                      {isNew && (
                        <View className="ml-2 bg-blue-500 px-2 py-1 rounded-full">
                          <Text className="text-white text-xs font-bold">NEW</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {notifications.length > 2 && (
                <TouchableOpacity
                  onPress={() => router.push("/(customerTabs)/notifications")}
                  className="bg-gray-50 p-3 rounded-lg border border-gray-200"
                >
                  <Text className="text-gray-600 text-sm text-center">
                    +{notifications.length - 2} more notifications
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View className="py-4 items-center">
              <Icon name="notifications-off" size={32} color="#9CA3AF" />
              <Text className="text-gray-500 text-sm mt-2">No notifications yet</Text>
              <Text className="text-gray-400 text-xs text-center">
                You'll see payment reminders and updates here
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Toast Notification */}
      {showToast && (
        <View className="absolute top-20 left-4 right-4 bg-blue-500 rounded-lg p-4 shadow-lg z-50">
          <View className="flex-row items-center">
            <Icon name="notifications-active" size={30} color="#3B82F6" />
            <Text className="text-white font-medium flex-1">{toastMessage}</Text>
            <TouchableOpacity onPress={() => setShowToast(false)}>
              <Text className="text-white text-lg">✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Notifications Modal */}
      {showNotifications && (
        <View className="absolute inset-0 bg-white bg-opacity-50 flex-1 justify-center items-center">
          <View className="bg-white rounded-2xl p-6 mx-4 w-[90%] max-h-[80%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-gray-900">Notification History</Text>
              <TouchableOpacity onPress={() => setShowNotifications(false)}>
                <Text className="text-gray-500 text-lg">✕</Text>
              </TouchableOpacity>
            </View>

            {/* Summary Header */}
            <View className="bg-blue-50 p-3 rounded-lg mb-4">
              <Text className="text-blue-800 text-sm font-medium">
                📱 {notifications.length} total notifications • {unreadCount} unread
              </Text>
              <Text className="text-blue-600 text-xs mt-1">
                Shows all payment reminders and updates from all shops
              </Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {notifications.length > 0 ? (
                notifications.map((notification, index) => {
                  const isNew = !(notification as any).read;
                  const isRecent =
                    new Date((notification as any).createdAt).getTime() >
                    Date.now() - 24 * 60 * 60 * 1000; // Last 24 hours

                  return (
                    <TouchableOpacity
                      key={notification.id}
                      className={`p-4 border-l-4 mb-3 rounded-lg ${
                        isNew ? "bg-blue-50 border-blue-500" : "bg-gray-50 border-gray-300"
                      }`}
                      onPress={() => markNotificationAsRead(notification.id)}
                    >
                      {/* Status Badge */}
                      <View className="flex-row justify-between items-start mb-2">
                        <View className="flex-row items-center">
                          <Text className="font-semibold text-gray-900 text-base">
                            {notification.title || "Payment Reminder"}
                          </Text>
                          {isNew && (
                            <View className="ml-2 bg-blue-500 px-2 py-1 rounded-full">
                              <Text className="text-white text-xs font-bold">NEW</Text>
                            </View>
                          )}
                          {isRecent && !isNew && (
                            <View className="ml-2 bg-green-500 px-2 py-1 rounded-full">
                              <Text className="text-white text-xs font-bold">RECENT</Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-xs text-gray-500">
                          {new Date((notification as any).createdAt).toLocaleDateString()}
                        </Text>
                      </View>

                      <Text className="text-gray-700 text-sm mb-2">{notification.message}</Text>

                      <View className="flex-row justify-between items-center">
                        <View>
                          <Text className="text-xs text-gray-500">
                            From: {(notification as any).shopName || "Shop"}
                          </Text>
                          <Text className="text-xs text-gray-400">
                            {new Date((notification as any).createdAt).toLocaleString()}
                          </Text>
                        </View>
                        {(notification as any).amount && (
                          <Text className="text-sm font-semibold text-red-600">
                            ₹{(notification as any).amount.toFixed(2)}
                          </Text>
                        )}
                      </View>

                      {isNew && (
                        <View className="mt-2">
                          <Text className="text-xs text-blue-600">👆 Tap to mark as read</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View className="py-8 items-center">
                  <Text className="text-gray-500 text-center">No notifications yet</Text>
                  <Text className="text-gray-400 text-sm text-center mt-1">
                    You'll see payment reminders and updates here
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
