import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { arrayUnion, doc, setDoc } from "firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { auth, db } from "../../firebaseConfig";
import { useRouter } from "expo-router";
import Icon from "react-native-vector-icons/MaterialIcons";
import { Owner, Shop } from "@/types";

export default function RoleSelection() {
  const [role, setRole] = useState<"owner" | "customer" | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(""); // Optional email field
  const [phone, setPhone] = useState(""); // This will be pre-filled
  const [shopName, setShopName] = useState("");
  const [pincode, setPincode] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Pre-fill the phone number from the authenticated user
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.phoneNumber) {
      // Firebase provides the number with country code, e.g., +919876543210
      // You can format it as needed. Here we remove the country code.
      setPhone(currentUser.phoneNumber.replace("+91", ""));
    }
  }, []);

  const generateShopLink = (shopName: string) => {
    return shopName.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
  };

  const detectCityFromPincode = async (pincode: string) => {
    if (pincode.length === 6) {
      try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
        const data = await response.json();
        if (data && data[0] && data[0].PostOffice && data[0].PostOffice[0]) {
          setCity(data[0].PostOffice[0].District);
          setState(data[0].PostOffice[0].State);
        }
      } catch (error) {
        console.error("Failed to fetch city from pincode:", error);
      }
    }
  };

  const handleContinue = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert("Error", "You are not logged in.");
      router.replace("/(auth)/phone-auth");
      return;
    }
    if (!role) {
      Alert.alert("Error", "Please select a role.");
      return;
    }
    if (!name.trim()) {
      Alert.alert("Error", "Please enter your name.");
      return;
    }

    setLoading(true);

    try {
      if (role === "owner") {
        const now = new Date();
        const shopLink = generateShopLink(shopName);
        const ownerData: Owner = {
          uid: currentUser.uid,
          name,
          email: currentUser.email || "",
          phone: currentUser.phoneNumber, // Store full number with country code
          shopName,
          shopLink,
          createdAt: now,
          updatedAt: now,
        };

        await setDoc(doc(db, "owners", currentUser.uid), ownerData);

        // Create shop document
        const shopData: Shop = {
          id: currentUser.uid,
          ownerId: currentUser.uid,
          name: shopName,
          link: shopLink,
          customers: [],
          pincode,
          city,
          state,
          address,
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(doc(db, "shops", currentUser.uid), shopData);

        router.replace("/(ownerTabs)");
      } else {
        await setDoc(doc(db, "customers", currentUser.uid), {
          name,
          email,
          phone: currentUser.phoneNumber,
          address,
          uid: currentUser.uid,
          createdAt: new Date(),
        });
        router.replace("/(customerTabs)");
      }
    } catch (error: any) {
      Alert.alert("Registration Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-[#DBEAFE]">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView>
          <LinearGradient
            colors={["#DBEAFE", "#F3F4F6", "#FFFFFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="flex-1"
          >
            <View className="flex-1 justify-center items-center px-8 py-12">
              <Text className="text-3xl font-bold text-blue-900 mb-2">Complete Your Profile</Text>
              <Text className="text-blue-700 text-base text-center mb-8">
                Tell us a bit more about yourself to get started.
              </Text>

              {/* Role Selection UI from your original file */}
              <View className="w-full max-w-sm">
                <Text className="text-blue-800 text-lg font-medium mb-3 text-center">
                  I am a ...
                </Text>
                <View className="flex-row w-full justify-center gap-4 mb-8">
                  <TouchableOpacity
                    style={[styles.roleButton, role === "owner" && styles.roleButtonSelected]}
                    onPress={() => setRole("owner")}
                  >
                    <Icon name="store" size={24} color={role === "owner" ? "white" : "#3B82F6"} />
                    <Text style={[styles.roleButtonText, role === "owner" && { color: "white" }]}>
                      Shop Owner
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.roleButton, role === "customer" && styles.roleButtonSelected]}
                    onPress={() => setRole("customer")}
                  >
                    <Icon
                      name="shopping-cart"
                      size={24}
                      color={role === "customer" ? "white" : "#3B82F6"}
                    />
                    <Text
                      style={[styles.roleButtonText, role === "customer" && { color: "white" }]}
                    >
                      Customer
                    </Text>
                  </TouchableOpacity>
                </View>

                {role && (
                  <View className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 border border-blue-200 shadow-lg">
                    {/* Common Fields */}
                    <Text className="text-blue-800 text-sm font-medium mb-2 ml-1">Full Name *</Text>
                    <View className="bg-white rounded-xl border border-blue-300 shadow-sm mb-4">
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your full name"
                        placeholderTextColor="#9CA3AF"
                        value={name}
                        onChangeText={setName}
                      />
                    </View>

                    <Text className="text-blue-800 text-sm font-medium mb-2 ml-1">
                      Phone Number
                    </Text>
                    <View className="bg-gray-200 rounded-xl border border-blue-300 shadow-sm mb-4">
                      <TextInput
                        style={[styles.input, { color: "#6B7280" }]}
                        value={phone}
                        editable={false}
                      />
                    </View>

                    <Text className="text-blue-800 text-sm font-medium mb-2 ml-1">
                      Email (Optional)
                    </Text>
                    <View className="bg-white rounded-xl border border-blue-300 shadow-sm mb-4">
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your email address"
                        placeholderTextColor="#9CA3AF"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                      />
                    </View>

                    {/* Owner Specific Fields */}
                    {role === "owner" && (
                      <>
                        <Text className="text-blue-800 text-sm font-medium mb-2 ml-1">
                          Shop Name *
                        </Text>
                        <View className="bg-white rounded-xl border border-blue-300 shadow-sm mb-4">
                          <TextInput
                            style={styles.input}
                            placeholder="Your shop's name"
                            placeholderTextColor="#9CA3AF"
                            value={shopName}
                            onChangeText={setShopName}
                          />
                        </View>
                        <Text className="text-blue-800 text-sm font-medium mb-2 ml-1">
                          Pincode *
                        </Text>
                        <View className="bg-white rounded-xl border border-blue-300 shadow-sm mb-4">
                          <TextInput
                            style={styles.input}
                            placeholder="6-digit pincode"
                            placeholderTextColor="#9CA3AF"
                            value={pincode}
                            onChangeText={(text) => {
                              setPincode(text);
                              detectCityFromPincode(text);
                            }}
                            keyboardType="number-pad"
                            maxLength={6}
                          />
                        </View>
                        <Text className="text-blue-800 text-sm font-medium mb-2 ml-1">City</Text>
                        <View className="bg-gray-200 rounded-xl border border-blue-300 shadow-sm mb-4">
                          <TextInput
                            style={[styles.input, { color: "#6B7280" }]}
                            value={city}
                            editable={false}
                            placeholder="City will be auto-detected"
                            placeholderTextColor="#9CA3AF"
                          />
                        </View>
                        <Text className="text-blue-800 text-sm font-medium mb-2 ml-1">State</Text>
                        <View className="bg-gray-200 rounded-xl border border-blue-300 shadow-sm mb-4">
                          <TextInput
                            style={[styles.input, { color: "#6B7280" }]}
                            value={state}
                            editable={false}
                            placeholder="State will be auto-detected"
                            placeholderTextColor="#9CA3AF"
                          />
                        </View>
                        <Text className="text-blue-800 text-sm font-medium mb-2 ml-1">
                          Address *
                        </Text>
                        <View className="bg-white rounded-xl border border-blue-300 shadow-sm mb-4">
                          <TextInput
                            style={styles.input}
                            placeholder="Shop address"
                            placeholderTextColor="#9CA3AF"
                            value={address}
                            onChangeText={setAddress}
                          />
                        </View>
                      </>
                    )}

                    {/* Customer Specific Fields */}
                    {role === "customer" && (
                      <>
                        <Text className="text-blue-800 text-sm font-medium mb-2 ml-1">Address</Text>
                        <View className="bg-white rounded-xl border border-blue-300 shadow-sm mb-4">
                          <TextInput
                            style={styles.input}
                            placeholder="Your address"
                            placeholderTextColor="#9CA3AF"
                            value={address}
                            onChangeText={setAddress}
                          />
                        </View>
                      </>
                    )}

                    <TouchableOpacity onPress={handleContinue} disabled={loading} className="mt-4">
                      <LinearGradient
                        colors={loading ? ["#9CA3AF", "#6B7280"] : ["#3B82F6", "#60A5FA"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        className="w-full rounded-xl py-4 items-center"
                      >
                        <Text className="text-white font-bold text-lg">
                          {loading ? "Setting Up..." : "Continue"}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </LinearGradient>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  input: {
    padding: 16,
    fontSize: 16,
    color: "#1F2937",
    fontWeight: "500",
  },
  roleButton: {
    flex: 1,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(59, 130, 246, 0.3)",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  roleButtonSelected: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  roleButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3B82F6",
  },
});
