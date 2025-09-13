import * as ImagePicker from "expo-image-picker";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../firebaseConfig";
import { router } from "expo-router";
import Feather from "react-native-vector-icons/Feather";
import { uploadProfileImage } from "@/utils/cloudUtils";

export default function EditProfile() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, "customers", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setName(data.name || user.displayName || "");
          setPhone(data.phone || "");
          setProfileImage(data.photoURL || user.photoURL || null);
        } else {
          setName(user.displayName || "");
          setPhone("");
          setProfileImage(user.photoURL || null);
        }
      } catch (e) {
        Alert.alert("Error", "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const pickImage = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        const user = auth.currentUser;

        if (!user) {
          Alert.alert("Error", "User not authenticated");
          return;
        }

        try {
          // Upload using the utility function
          const uploadResult = await uploadProfileImage(imageUri, user.uid);

          if (uploadResult) {
            setProfileImage(uploadResult);
            Alert.alert("Success", "Profile photo uploaded successfully!");
          } else {
            throw new Error(uploadResult.error);
          }
        } catch (error) {
          Alert.alert("Error", "Failed to upload profile photo. Please try again.");
          console.error("Upload error:", error);
        } finally {
        }
      }
    } catch (error) {
      console.error("Error picking image:", error);
    }
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setSaving(true);
    try {
      await updateProfile(user, { displayName: name, photoURL: profileImage });
      await updateDoc(doc(db, "customers", user.uid), { name, phone, photoURL: profileImage });
      Alert.alert("Success", "Profile updated!");
    } catch (e) {
      Alert.alert("Error", "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1">
      <View style={styles.container}>
        <TouchableOpacity
          onPress={() => router.navigate("/(customerTabs)/settings")}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.header}>Edit Profile</Text>
        <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.profileImage} />
          ) : (
            <View style={styles.placeholderImage} />
          )}
          <Text style={styles.imageText}>Change Photo</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Full Name"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save Changes"}</Text>
        </TouchableOpacity>
      </View>
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
  imagePicker: {
    alignItems: "center",
    marginBottom: 24,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 8,
  },
  placeholderImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#ddd",
    marginBottom: 8,
  },
  imageText: {
    color: "#007AFF",
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "white",
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 10,
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  backButton: {
    width: 40,
    height: 40,
  },
  backButtonText: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "600",
  },
});
