import { useRouter } from "expo-router";
import { deleteUser, signOut } from "firebase/auth";
import { deleteDoc, doc, updateDoc } from "firebase/firestore";
import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "react-native-vector-icons/Feather";
import { auth, db } from "../../firebaseConfig";

export default function OwnerSettings() {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace("/(auth)/phone-auth");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              const user = auth.currentUser;
              if (user) {
                await deleteDoc(doc(db, "customers", user.uid));
                await deleteUser(user);
                router.replace("/(auth)/phone-auth");
              }
            } catch (error: any) {
              Alert.alert("Error", error.message);
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1">
      <ScrollView>
        <View style={styles.container}>
          <Text style={styles.header}>
            <Text style={styles.title}>Settings</Text>
          </Text>

          {/* Profile Management */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile</Text>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => router.navigate("/(ownerTabs)/EditProfile" as any)}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Feather name="user" size={20} color="#555" style={{ marginRight: 12 }} />
                <Text style={styles.settingText}>Edit Profile</Text>
              </View>
            </TouchableOpacity>
            {/* <TouchableOpacity
              style={styles.settingItem}
              onPress={() => router.navigate("/(ownerTabs)/ChangePassword" as any)}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Feather name="lock" size={20} color="#555" style={{ marginRight: 12 }} />
                <Text style={styles.settingText}>Change Password</Text>
              </View>
            </TouchableOpacity> */}
          </View>

          {/* Shop Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shop Details</Text>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => router.navigate("/(ownerTabs)/ShopInformation" as any)}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Feather name="shopping-bag" size={20} color="#555" style={{ marginRight: 12 }} />
                <Text style={styles.settingText}>Shop Information</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => router.navigate("/(ownerTabs)/history" as any)}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Feather name="clock" size={20} color="#555" style={{ marginRight: 12 }} />
                <Text style={styles.settingText}>Transaction History</Text>
              </View>
            </TouchableOpacity>
            
          </View>

          {/* Account */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <TouchableOpacity style={styles.settingItem} onPress={handleSignOut}>
              <Feather name="log-out" size={20} color="#d9534f" style={styles.icon} />
              <Text style={[styles.settingText, { color: "#d9534f" }]}>Sign Out</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={handleDeleteAccount}
              disabled={deleting}
            >
              <Feather name="trash-2" size={20} color="#d9534f" style={styles.icon} />
              <Text style={[styles.settingText, { color: "#d9534f" }]}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 24,
    color: "#333",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
    color: "#333",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 32,
    color: "#666",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: "white",
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  linkButton: {
    alignItems: "center",
  },
  linkText: {
    color: "#007AFF",
    fontSize: 16,
  },
  roleContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 32,
  },
  roleButton: {
    flex: 1,
    marginHorizontal: 8,
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#ddd",
    alignItems: "center",
    backgroundColor: "white",
  },
  roleButtonSelected: {
    borderColor: "#007AFF",
    backgroundColor: "#007AFF",
  },
  roleButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  roleButtonTextSelected: {
    color: "white",
  },
  formContainer: {
    marginTop: 16,
  },
  welcomeText: {
    fontSize: 16,
    color: "#666",
  },
  nameText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  summaryAmount: {
    fontSize: 20,
    fontWeight: "bold",
  },
  dueAmount: {
    color: "#FF3B30",
  },
  advanceAmount: {
    color: "#34C759",
  },
  paidAmount: {
    color: "#007AFF",
  },
  section: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    color: "#007AFF",
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
  settingText: {
    fontSize: 16,
    color: "#333",
  },
  signOutButton: {
    backgroundColor: "#ff5252",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  preferencesDisplay: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  preferencesTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  preferencesText: {
    fontSize: 16,
    color: "#666",
  },
  icon: {
    marginRight: 12,
  },
});
