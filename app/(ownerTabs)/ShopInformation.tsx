import { useRouter } from "expo-router";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Feather from "react-native-vector-icons/Feather";
import { auth, db } from "../../firebaseConfig";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ShopInformation() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [formData, setFormData] = useState({
    shopName: "",
    shopType: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    phone: "",
    gstNumber: "",
    openingTime: "",
    closingTime: "",
    isOpen: true,
    description: "",
  });

  useEffect(() => {
    loadShopData();
  }, []);

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

  const loadShopData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const shopDoc = await getDoc(doc(db, "shops", user.uid));
      if (shopDoc.exists()) {
        const data = shopDoc.data();
        setFormData({
          shopName: data.name || "",
          shopType: data.shopType || "",
          address: data.address || "",
          city: data.city || "",
          state: data.state || "",
          pincode: data.pincode || "",
          phone: data.phone || "",
          gstNumber: data.gstNumber || "",
          openingTime: data.openingTime || "",
          closingTime: data.closingTime || "",
          isOpen: data.isOpen !== undefined ? data.isOpen : true,
          description: data.description || "",
        });
      }
    } catch (error) {
      console.error("Error loading shop data:", error);
    }
  };

  const handleSave = async () => {
    if (!formData.shopName.trim() || !formData.address.trim() || !formData.phone.trim()) {
      Alert.alert("Error", "Shop Name, Address and Phone Number are required");
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated");

      await updateDoc(doc(db, "shops", user.uid), {
        name: formData.shopName,
        shopType: formData.shopType,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        phone: `+91${formData.phone}`,
        gstNumber: formData.gstNumber,
        openingTime: formData.openingTime,
        closingTime: formData.closingTime,
        isOpen: formData.isOpen,
        description: formData.description,
        updatedAt: new Date(),
      });

      Alert.alert("Success", "Shop information updated successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-[#F7F7F7]">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.container}>
          <TouchableOpacity onPress={() => router.navigate("/settings")} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>

          <Text style={styles.title}>Shop Information</Text>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Shop Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.shopName}
                onChangeText={(text) => setFormData({ ...formData, shopName: text })}
                placeholder="Enter shop name"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Shop Type</Text>
              <TextInput
                style={styles.input}
                value={formData.shopType}
                onChangeText={(text) => setFormData({ ...formData, shopType: text })}
                placeholder="e.g., Grocery, Electronics, etc."
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
                placeholder="Enter complete address"
                placeholderTextColor="#9CA3AF"
                numberOfLines={3}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Pincode</Text>
                <TextInput
                  style={styles.input}
                  value={formData.pincode}
                  onChangeText={(text) => {
                    setFormData({ ...formData, pincode: text });
                    detectCityFromPincode(text);
                  }}
                  placeholder="Pincode"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>State</Text>
                <TextInput
                  style={[styles.input, styles.disabledInput]}
                  value={state}
                  editable={false}
                  onChangeText={(text) => setFormData({ ...formData, state: text })}
                  placeholder="State"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>City</Text>
                <TextInput
                  style={[styles.input, styles.disabledInput]}
                  value={city}
                  editable={false}
                  onChangeText={(text) => setFormData({ ...formData, city: text })}
                  placeholder="City"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Shop Status</Text>
                {/* Label + switch in a row */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderWidth: 1,
                    borderColor: "#ddd",
                    borderRadius: 8,
                    padding: 12,
                    backgroundColor: "white",
                  }}
                >
                  <Text style={styles.switchLabel}>{formData.isOpen ? "Open" : "Closed"}</Text>
                  <Switch
                    value={formData.isOpen}
                    onValueChange={(value) => setFormData({ ...formData, isOpen: value })}
                    trackColor={{ false: "#767577", true: "#81b0ff" }}
                    thumbColor={formData.isOpen ? "#007AFF" : "#f4f3f4"}
                  />
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>GST Number</Text>
              <TextInput
                style={styles.input}
                value={formData.gstNumber}
                onChangeText={(text) => setFormData({ ...formData, gstNumber: text })}
                placeholder="GST Number (optional)"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Opening Time</Text>
                <TextInput
                  style={styles.input}
                  value={formData.openingTime}
                  onChangeText={(text) => setFormData({ ...formData, openingTime: text })}
                  placeholder="e.g., 9:00 AM"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Closing Time</Text>
                <TextInput
                  style={styles.input}
                  value={formData.closingTime}
                  onChangeText={(text) => setFormData({ ...formData, closingTime: text })}
                  placeholder="e.g., 8:00 PM"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone</Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={styles.prefixBox}>
                  <Text style={{ fontSize: 16 }}>+91</Text>
                </View>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={formData.phone}
                  onChangeText={(text) => {
                    let cleaned = text.replace(/\D/g, "");
                    if (cleaned.startsWith("91") && cleaned.length > 10) {
                      cleaned = cleaned.slice(2);
                    }
                    if (cleaned.length > 10) cleaned = cleaned.slice(0, 10);

                    setFormData({ ...formData, phone: cleaned });
                  }}
                  placeholder="Phone number"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Brief description about your shop"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, loading && styles.disabledButton]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {loading ? "Saving..." : "Save Shop Information"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  backButton: {
    marginBottom: 20,
    marginTop: 40,
    width: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 24,
    color: "#333",
  },
  form: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "white",
  },
  textArea: {
    height: 50,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  halfWidth: {
    width: "48%",
  },
  switchContainer: {
    marginBottom: 20,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 16,
    color: "#333",
  },
  saveButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  disabledInput: {
    backgroundColor: "#f5f5f5",
    color: "#666",
  },
  prefixBox: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "white",
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
});
