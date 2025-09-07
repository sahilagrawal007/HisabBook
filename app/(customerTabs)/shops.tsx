import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useCallback, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "react-native-vector-icons/Feather";
import Icon from "react-native-vector-icons/MaterialIcons";
import { auth, db } from "../../firebaseConfig";
import { Customer, Shop } from "../../types";

export default function CustomerShops() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopLink, setShopLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredShops, setFilteredShops] = useState<Shop[]>([]);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      loadCustomerData();
    }, [])
  );

  // Filter shops based on search query
  React.useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredShops(shops);
    } else {
      const filtered = shops.filter((shop) =>
        shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shop.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shop.link?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredShops(filtered);
    }
  }, [searchQuery, shops]);

  const loadCustomerData = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const customerDoc = await getDoc(doc(db, "customers", user.uid));
      if (customerDoc.exists()) {
        const customerData = customerDoc.data() as Customer;
        setCustomer(customerData);

        if (customerData.shopsJoined && customerData.shopsJoined.length > 0) {
            const shopPromises = customerData.shopsJoined.map((shopId) =>
              getDoc(doc(db, "shops", shopId))
            );
            const shopDocs = await Promise.all(shopPromises);
            const shopsData = shopDocs
              .map((doc) => ({ id: doc.id, ...doc.data() } as Shop))
              .filter((shop) => shop.id);
            setShops(shopsData);
          } else {
            setShops([]);
          }
        }
      }
     catch (error) {
      console.error("Error loading customer data:", error);
    }
  };

  const loadJoinedShops = async (shopIds: string[]) => {
    if (shopIds.length === 0) return;

    try {
      const shopsQuery = query(collection(db, "shops"), where("__name__", "in", shopIds));

      const shopsSnapshot = await getDocs(shopsQuery);
      const shopsData = shopsSnapshot.docs.map((doc) => ({ ...doc.data() } as Shop));
     
      setShops(shopsData);
      setFilteredShops(shopsData);
    } catch (error) {
      console.error("Error loading shops:", error);
    }
  };

  const joinShop = async () => {
    if (!shopLink.trim()) {
      Alert.alert("Error", "Please enter a shop link");
      return;
    }

    const user = auth.currentUser;
    if (!user || !customer) return;

    setLoading(true);
    try {
      // Find shop by link
      const shopsQuery = query(collection(db, "shops"), where("link", "==", shopLink.trim()));

      const shopsSnapshot = await getDocs(shopsQuery);

      if (shopsSnapshot.empty) {
        Alert.alert("Error", "Shop not found with this link");
        setLoading(false);
        return;
      }

      const shopDoc = shopsSnapshot.docs[0];
      const shopData = shopDoc.data() as Shop;

      // Check if already joined (use the actual document id)
      if (customer.shopsJoined.includes(shopDoc.id)) {
        Alert.alert("Info", "You are already a member of this shop");
        setLoading(false);
        return;
      }

      // Update customer's shopsJoined array
      await updateDoc(doc(db, "customers", user.uid), {
        shopsJoined: arrayUnion(shopDoc.id),
        updatedAt: new Date(),
      });

      // Update shop's customers array (use the actual document id)
      await updateDoc(doc(db, "shops", shopDoc.id), {
        customers: arrayUnion(user.uid),
        updatedAt: new Date(),
      });

      Alert.alert("Success", `You have joined ${shopData.name}!`);
      setShopLink("");
      loadCustomerData(); // Refresh data
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQRScan = () => {
    router.navigate("/(customerTabs)/scan");
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]">
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView 
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="flex-row justify-between items-center mb-6">
            <View className="flex-row items-center">
              <Icon name="storefront" size={30} color="#4B82F6" />
              <Text className="text-xl font-bold text-gray-900 ml-2">My Shops</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/(customerTabs)/notifications")}
              className="relative"
            >
              <Icon name="notifications-active" size={30} color="#3B82F6" />
            </TouchableOpacity>
          </View>

          {/* Join New Shop Section */}
          <View className="bg-white rounded-xl p-4 mb-6 shadow-sm border border-gray-100">
            <Text className="text-gray-700 text-lg font-bold mb-2">+ Join New Shop</Text>
            <Text className="text-gray-500 text-sm mb-4">Enter shop link or scan QR code to join</Text>

            <Text className="text-gray-400 mb-2 text-sm">Shop Link</Text>
            <TextInput
              placeholder="e.g. shop123"
              value={shopLink}
              onChangeText={setShopLink}
              autoCapitalize="none"
              className="border border-gray-300 rounded-lg px-3 py-3 mb-3 text-gray-700"
            />

            <TouchableOpacity 
              onPress={joinShop}
              disabled={loading}
              className="rounded-lg overflow-hidden mb-3"
            >
              <LinearGradient
                colors={loading ? ["#9CA3AF", "#6B7280"] : ["#3b82f6", "#8b5cf6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="py-3 rounded-lg"
              >
                <Text className="text-center text-white font-semibold">
                  {loading ? "Joining..." : "Join Shop"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleQRScan} className="rounded-lg overflow-hidden">
              <LinearGradient
                colors={["#10B981", "#059669"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="py-3 rounded-lg"
              >
                <Text className="text-center text-white font-semibold">Join via QR Code</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Joined Shops Section */}
          <View className="bg-white rounded-xl p-4 mb-6 shadow-sm border border-gray-100">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-gray-700 text-lg font-bold">
                Joined Shops ({filteredShops.length})
              </Text>
              {shops.length > 0 && (
                <TouchableOpacity onPress={loadCustomerData} className="p-2">
                  <Feather name="refresh-cw" size={20} color="#3B82F6" />
                </TouchableOpacity>
              )}
            </View>

            {/* Search Bar */}
            {shops.length > 0 && (
              <View className="mb-4">
                <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
                  <Feather name="search" size={20} color="#666" />
                  <TextInput
                    className="flex-1 ml-2 text-gray-700"
                    placeholder="Search shops..."
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
            )}

            {shops.length === 0 ? (
              <View className="py-8 items-center">
                <Icon name="storefront" size={48} color="#9CA3AF" />
                <Text className="text-gray-500 text-center mt-3 text-lg font-medium">
                  No shops joined yet
                </Text>
                <Text className="text-gray-400 text-center mt-2 text-sm">
                  Join shops to start tracking your purchases and dues
                </Text>
              </View>
            ) : filteredShops.length > 0 ? (
              filteredShops.map((shop) => (
                <TouchableOpacity
                  key={shop.id}
                  className="flex-row justify-between items-center py-4 px-3 mb-3 bg-gray-50 rounded-lg border border-gray-100"
                  onPress={() =>
                    router.push({
                      pathname: "/(customerTabs)/shopDetails",
                      params: { shopId: shop.id },
                    })
                  }
                >
                  <View className="flex-row items-center flex-1">
                    <View className="bg-blue-100 p-3 rounded-full mr-3">
                      <Icon name="storefront" size={24} color="#3B82F6" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-gray-800 font-semibold text-base mb-1">
                        {shop.name}
                      </Text>
                      {shop.address && (
                        <Text className="text-gray-500 text-sm" numberOfLines={1}>
                          📍 {shop.address}
                        </Text>
                      )}
                      {/* {shop.link && (
                        <Text className="text-gray-500 text-sm" numberOfLines={1}>
                          🔗 {shop.link}
                        </Text> */}
                    </View>
                  </View>
                  <View className="ml-2">
                    <Icon name="arrow-forward-ios" size={20} color="#9CA3AF" />
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View className="py-8 items-center">
                <Icon name="search-off" size={48} color="#9CA3AF" />
                <Text className="text-gray-500 text-center mt-3 text-lg font-medium">
                  No shops found for "{searchQuery}"
                </Text>
                <Text className="text-gray-400 text-center mt-2 text-sm">
                  Try searching with different keywords
                </Text>
                <TouchableOpacity
                  onPress={() => setSearchQuery("")}
                  className="mt-3 bg-blue-50 px-4 py-2 rounded-lg"
                >
                  <Text className="text-blue-600 font-medium">Clear Search</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Keep minimal styles for any specific needs
});
