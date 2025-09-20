import { useRouter } from 'expo-router';
import { deleteUser, signOut } from 'firebase/auth';
import { deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from 'react-native-vector-icons/Feather';
import { auth, db } from '../../firebaseConfig';

export default function CustomerSettings() {
  const router = useRouter();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, 'customers', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setPushEnabled(!!data.notificationsEnabled);
        }
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/(auth)/phone-auth');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const user = auth.currentUser;
              if (user) {
                await deleteDoc(doc(db, 'customers', user.uid));
                await deleteUser(user);
                router.replace('/(auth)/phone-auth');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message);
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleTogglePush = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const newValue = !pushEnabled;
    setPushEnabled(newValue);
    try {
      await updateDoc(doc(db, 'customers', user.uid), { notificationsEnabled: newValue });
    } catch (e) {
      // Optionally show error
    }
  };

  if (loading) {
    return <View style={{flex:1,justifyContent:'center',alignItems:'center'}}><Text>Loading...</Text></View>;
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1">
      <ScrollView>
        <View style={styles.container}>
          <Text style={styles.header}>Settings</Text>

          {/* Profile Management */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile</Text>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => router.navigate("/(customerTabs)/editProfile")}
            >
              <Feather name="user" size={20} color="#555" style={styles.icon} />
              <Text style={styles.settingText}>Edit Profile</Text>
            </TouchableOpacity>
            {/* <TouchableOpacity
              style={styles.settingItem}
              onPress={() => router.navigate("/(customerTabs)/changePassword")}
            >
              <Feather name="lock" size={20} color="#555" style={styles.icon} />
              <Text style={styles.settingText}>Change Password</Text>
            </TouchableOpacity> */}
          </View>

          {/* Order & Payment */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order & Payment</Text>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => router.navigate("./(customerTabs)/history")}
            >
              <Feather name="list" size={20} color="#555" style={styles.icon} />
              <Text style={styles.settingText}>Order History</Text>
            </TouchableOpacity>
          </View>

          {/* Notifications */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => router.navigate("/(customerTabs)/notifications")}
            >
              <Feather name="bell" size={20} color="#555" style={styles.icon} />
              <Text style={styles.settingText}>View All Notifications</Text>
            </TouchableOpacity>
          </View>

          {/* Account Management */}
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
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    color: '#333',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#007AFF',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  icon: {
    marginRight: 12,
  },
  settingText: {
    fontSize: 16,
    color: '#333',
  },
}); 