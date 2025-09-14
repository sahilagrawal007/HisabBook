import { useRoute } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { addDoc, collection, doc, onSnapshot, serverTimestamp } from "firebase/firestore";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  View,
  TouchableWithoutFeedback,
} from "react-native";
import { db } from "../../firebaseConfig";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "react-native-vector-icons/Feather";

interface RouteParams {
  customerId: string;
  shopId: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

const FOOTER_HEIGHT = 75; // px - adjust if you want bigger footer

const AddTransaction: React.FC = () => {
  const route = useRoute();
  const router = useRouter();
  const { customerId, shopId } = route.params as RouteParams;

  const [products, setProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<{ [productId: string]: number }>({});
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const subscribeToProducts = useCallback(() => {
    if (!shopId) return () => {};

    const docRef = doc(db, "products", shopId);
    const user = getAuth().currentUser;
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        // Check if user is still authenticated before processing data
        if (!getAuth().currentUser) return;
        
        if (docSnap.exists()) {
          const items = docSnap.data().products || [];
          setProducts(
            items.map((item: any, index: number) => ({
              ...item,
              id: item.id ?? String(index),
              price: Number(item.price),
            }))
          );
        } else {
          setProducts([]);
        }
      },
      (error) => {
        Alert.alert("Error", "Failed to fetch products.");
        console.error("Firestore products subscription error:", error);
      }
    );

    return unsubscribe;
  }, [shopId, setProducts]);

  useEffect(() => {
    const unsubscribe = subscribeToProducts();
    return () => unsubscribe && unsubscribe();
  }, [subscribeToProducts]);

  // --- Reset quantities when switching customer/shop ---
  useEffect(() => {
    setQuantities({});
    setSearchTerm("");
    Keyboard.dismiss();
  }, [customerId, shopId]);

  // Update quantity from text input (keeps non-negative integer)
  const handleQuantityChange = (productId: string, value: string) => {
    const digits = value.replace(/\D/g, "");
    const qty = Math.max(0, parseInt(digits || "0", 10));
    setQuantities((prev) => ({ ...prev, [productId]: qty }));
  };

  // +/- buttons
  const changeQuantityBy = (productId: string, delta: number) => {
    setQuantities((prev) => {
      const current = Number(prev[productId] || 0);
      const next = Math.max(0, current + delta);
      return { ...prev, [productId]: next };
    });
  };

  // Filtered products based on search (case-insensitive)
  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) => (p.name || "").toLowerCase().includes(term));
  }, [products, searchTerm]);

  const totalAmount = useMemo(
    () => products.reduce((sum, product) => sum + (quantities[product.id] || 0) * product.price, 0),
    [products, quantities]
  );

  // Actual Firestore write (called after user confirms)
  const handleConfirmSubmit = async (itemsList: string[], description: string) => {
    setSubmitting(true);
    try {
      await addDoc(collection(db, "transactions"), {
        shopId,
        customerId,
        amount: totalAmount,
        type: "due",
        description,
        createdAt: serverTimestamp(),
      });

      // clear quantities for current customer after successful submit
      setQuantities({});
      setSearchTerm("");

      Alert.alert("Success", "Transaction added successfully.", [
        {
          text: "OK",
          onPress: () => {
            router.back();
          },
        },
      ]);
    } catch (e) {
      console.error("add transaction error", e);
      Alert.alert("Error", "Failed to add transaction.");
    } finally {
      setSubmitting(false);
    }
  };

  // On submit click show confirmation alert listing products + quantities
  const handleSubmit = () => {
    const selected = products
      .filter((p) => (quantities[p.id] || 0) > 0)
      .map((p) => `${p.name} x${quantities[p.id]}`);

    if (selected.length === 0 || totalAmount <= 0) {
      Alert.alert("Error", "Please enter quantity for at least one product.");
      return;
    }

    const description = selected.join(", ");
    const prettyList = selected.join("\n");
    const message = `${prettyList}\n\nTotal: ₹${totalAmount}\n\nDo you want to proceed?`;

    Alert.alert("Confirm Transaction", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: () => handleConfirmSubmit(selected, description),
      },
    ]);
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const qty = Number(quantities[item.id] || 0);
    return (
      <View key={item.id} className="flex-row items-center mb-3">
        <Text className="flex-1 text-gray-800">
          {item.name} (₹{item.price})
        </Text>

        <TouchableOpacity
          onPress={() => changeQuantityBy(item.id, -1)}
          className="bg-gray-100 rounded-full px-3 py-1 mr-2"
          accessibilityLabel={`decrease-${item.id}`}
        >
          <Text className="text-lg">−</Text>
        </TouchableOpacity>

        <TextInput
          className="border border-gray-300 rounded px-2 py-1 w-12 text-center mr-2"
          keyboardType="numeric"
          returnKeyType="done"
          value={qty > 0 ? String(qty) : ""}
          onChangeText={(val) => handleQuantityChange(item.id, val)}
          placeholder="0"
          placeholderTextColor="#9CA3AF"
        />

        <TouchableOpacity
          onPress={() => changeQuantityBy(item.id, +1)}
          className="bg-gray-100 rounded-full px-3 py-1"
          accessibilityLabel={`increase-${item.id}`}
        >
          <Text className="text-lg">+</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-white edges">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          {/* Header & Search are placed above the list */}
          <View style={{ padding: 24, paddingBottom: 12, paddingTop: 20 }}>
            <TouchableOpacity
              onPress={() => router.navigate("/(ownerTabs)/Customers")}
              style={styles.backButton}
            >
              <Feather name="arrow-left" size={24} color="#333" />
            </TouchableOpacity>

            <Text className="text-xl font-bold mb-6">Add Transaction</Text>

            {/* Search */}
            <View className="mb-4">
              <View className="flex-row items-center bg-white border-gray-200 rounded-xl border text-base px-3 py-2">
                <Feather name="search" size={18} color="#666" />
                <TextInput
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  style={{ paddingTop: 5, paddingBottom: 5 }}
                  placeholder="Search products..."
                  placeholderTextColor="#9CA3AF"
                  className="ml-2 flex-1"
                  returnKeyType="search"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  clearButtonMode="while-editing"
                />
              </View>
            </View>

            <Text className="text-base font-semibold mb-2">Select Products</Text>
          </View>

          {/* Product list (virtualized) */}
          {filteredProducts.length === 0 ? (
            <View style={{ paddingHorizontal: 24 }}>
              <Text>No products found.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredProducts}
              keyExtractor={(p) => p.id}
              renderItem={renderProduct}
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingBottom: FOOTER_HEIGHT + 24,
                paddingTop: 0,
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Sticky footer */}
          <View
            style={[
              styles.footer,
              {
                height: FOOTER_HEIGHT,
                paddingHorizontal: 16,
                paddingVertical: 12,
              },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                flex: 1,
              }}
            >
              <View>
                <Text style={{ color: "#6B7280", fontSize: 12 }}>Total</Text>
                <Text style={{ fontSize: 18, fontWeight: "700" }}>₹{totalAmount}</Text>
              </View>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting || totalAmount <= 0}
                style={{
                  backgroundColor: totalAmount > 0 ? "#2563EB" : "#9CA3AF",
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                  borderRadius: 10,
                  opacity: submitting ? 0.8 : 1,
                }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>
                  {submitting ? "Submitting..." : "Submit"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  backButton: {
    width: 40,
    height: 40,
  },
  footer: {
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    // shadow for iOS
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    // elevation for Android
  },
});

export default AddTransaction;