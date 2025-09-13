import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Feather from "react-native-vector-icons/Feather";
import { auth, db } from "../../firebaseConfig";
import { uploadProfileImage } from "../../utils/cloudUtils";

export default function EditProfile() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    shopName: "",
    address: "",
  });
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Get user data from Firestore
      const userDoc = await getDoc(doc(db, "owners", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setFormData({
          name: data.name || "",
          email: user.email || "",
          phone: data.phone || "",
          shopName: data.shopName || "",
          address: data.address || "",
        });
        setProfileImage(data.photoURL || user.photoURL || null);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

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
    if (!formData.name.trim() || !formData.shopName.trim()) {
      Alert.alert("Error", "Name and Shop Name are required");
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated");

      // Update Firebase Auth profile
      await updateProfile(user, {
        displayName: formData.name,
        photoURL: profileImage,
      });

      // Update Firestore data
      await updateDoc(doc(db, "owners", user.uid), {
        name: formData.name,
        phone: formData.phone,
        shopName: formData.shopName,
        address: formData.address,
        photoURL: profileImage,
        updatedAt: new Date(),
      });

      Alert.alert("Success", "Profile updated successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => router.navigate("/settings")} style={styles.backButton}>
        <Feather name="arrow-left" size={24} color="#333" />
      </TouchableOpacity>

      <Text style={styles.title}>Edit Profile</Text>

      <View style={styles.form}>
        {/* Profile Image Picker */}
        <View style={styles.imagePickerContainer}>
          <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.placeholderImage}>
                <Feather name="user" size={40} color="#ccc" />
              </View>
            )}
            <Text style={styles.imageText}>Change Photo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="Enter your full name"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, styles.disabledInput]}
            value={formData.email}
            editable={false}
            placeholder="Email (cannot be changed)"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            value={formData.phone}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            placeholder="Enter phone number"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Shop Name</Text>
          <TextInput
            style={styles.input}
            value={formData.shopName}
            onChangeText={(text) => setFormData({ ...formData, shopName: text })}
            placeholder="Enter shop name"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Address</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.address}
            onChangeText={(text) => setFormData({ ...formData, address: text })}
            placeholder="Enter shop address"
            multiline
            numberOfLines={3}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.disabledButton]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>{loading ? "Saving..." : "Save Changes"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  disabledInput: {
    backgroundColor: "#f5f5f5",
    color: "#666",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
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
  imagePickerContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  imagePicker: {
    alignItems: "center",
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
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  imageText: {
    color: "#007AFF",
    fontSize: 16,
  },
});
