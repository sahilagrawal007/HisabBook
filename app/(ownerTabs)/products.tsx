import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { getAuth } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";
import { db } from "../../firebaseConfig";
import Feather from "react-native-vector-icons/Feather";

export default function CustomersScreen() {
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter((product) =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  }, [searchQuery, products]);

  const fetchProducts = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    try {
      const docRef = doc(db, "products", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const items = docSnap.data().products || [];
        const formatted = items.map((item: any) => ({
          ...item,
          price: `₹${item.price}`,
        }));
        setProducts(formatted);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  async function addProduct() {
    if (!productName || !price) return;

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    const docRef = doc(db, "products", user.uid);

    try {
      const docSnap = await getDoc(docRef);
      const prevProducts = docSnap.exists() ? docSnap.data().products || [] : [];
      
      // Check if product name already exists
      const productExists = prevProducts.some((product: any) => 
        product.name.toLowerCase().trim() === productName.toLowerCase().trim()
      );
      
      if (productExists) {
        Alert.alert("Product Already Exists", "This product has already been added. Please check your products.");
        return;
      }

      const newProduct = {
        id: Date.now().toString(),
        name: productName,
        price: Number(price),
        createdAt: new Date(),
      };

      if (docSnap.exists()) {
        await setDoc(docRef, {
          products: [newProduct, ...prevProducts],
        });
      } else {
        await setDoc(docRef, {
          products: [newProduct],
        });
      }

      setProducts((prev) => [
        {
          ...newProduct,
          price: `₹${price}`,
        },
        ...prev,
      ]);

      setProductName("");
      setPrice("");
    } catch (e) {
      console.error("Error adding product:", e);
    }
  }

  async function deleteProduct(id: string) {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    const docRef = doc(db, "products", user.uid);
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const updatedProducts = (docSnap.data().products || []).filter((p: any) => p.id !== id);
        await setDoc(docRef, { products: updatedProducts });

        const formatted = updatedProducts.map((p: any) => ({
          ...p,
          price: `₹${p.price}`,
        }));
        setProducts(formatted);
      }
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-[#F7F7F7]">
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <TouchableOpacity onPress={() => router.navigate("/(ownerTabs)")} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>

        <Text className="text-2xl font-bold text-gray-900 mb-6">All Products</Text>

        {/* Add Product Section */}
        <View className="bg-white rounded-xl p-4 mb-6 shadow-sm border border-gray-100">
          <Text className="text-gray-700 text-lg font-bold mb-2">+ Add New Product</Text>
          <Text className="text-gray-500 text-sm mb-4">
            Manage all your shop's products and prices
          </Text>

          <Text className="text-gray-400 mb-2 text-sm">Product Name</Text>
          <TextInput
            placeholder="e.g. Tea"
            placeholderTextColor="#9CA3AF"
            value={productName}
            onChangeText={setProductName}
            className="border border-gray-300 rounded-lg px-3 py-3 mb-3 text-gray-700"
          />

          <Text className="text-gray-400 mb-2 text-sm">Price (₹)</Text>
          <TextInput
            placeholder="e.g. 10"
            placeholderTextColor="#9CA3AF"
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            className="border border-gray-300 rounded-lg px-3 py-3 mb-3 text-gray-700"
          />

          <TouchableOpacity onPress={addProduct} className="rounded-lg overflow-hidden">
            <LinearGradient
              colors={["#3b82f6", "#8b5cf6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="py-3 rounded-lg mb-4 mt-3"
            >
              <Text className="text-center text-white font-semibold">Add Product</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Products List Section */}
        <View className="bg-white rounded-xl p-4 mb-6 shadow-sm border border-gray-100">
          <Text className="text-gray-700 text-lg font-bold mb-3">Your Products</Text>

          {/* Search Bar */}
          <View className="mb-3">
            <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
              <Feather name="search" size={20} color="#666" />
              <TextInput
                className="flex-1 ml-2 text-gray-700"
                placeholder="Search products..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Feather name="x" size={20} color="#666" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {filteredProducts.length > 0 ? (
            filteredProducts.map((p, index) => (
              <TouchableOpacity
                key={index}
                className="flex-row justify-between items-center py-3 px-2 mb-2 bg-gray-50 rounded-lg border border-gray-100"
              >
                <View className="flex-row items-center">
                  <Feather name="package" size={30} color="#3B82F6" />
                  <View>
                    <Text className="text-gray-700 font-medium ml-2">{p.name}</Text>
                  </View>
                </View>
                <View className="flex-row items-center">
                  <Text className="text-gray-500 mr-4">{p.price}</Text>
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert(
                        "Delete Product",
                        `Are you sure you want to delete "${p.name}"?`,
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => deleteProduct(p.id),
                          },
                        ]
                      )
                    }
                    className="mx-1"
                  >
                    <Icon name="delete-forever" size={24} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View className="py-6">
              <Text className="text-gray-500 text-center">
                {searchQuery.trim()
                  ? `No products found for "${searchQuery}"`
                  : "No products added yet"}
              </Text>
            </View>
          )}
        </View>
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
