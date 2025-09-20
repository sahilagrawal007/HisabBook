import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/MaterialIcons";
import { FirebaseRecaptchaVerifierModal } from "expo-firebase-recaptcha";
import { PhoneAuthProvider, signInWithCredential } from "firebase/auth";
import { app, auth } from "../../firebaseConfig"; // Make sure this path is correct

export default function PhoneAuth() {
  const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);

  const sendVerificationCode = async () => {
    if (phoneNumber.length !== 10) {
      Alert.alert("Error", "Please enter a valid 10-digit phone number.");
      return;
    }

    setLoading(true);
    try {
      const phoneProvider = new PhoneAuthProvider(auth);
      const fullPhoneNumber = `+91${phoneNumber}`;
      const verifier = recaptchaVerifier.current;
      if (verifier) {
        const id = await phoneProvider.verifyPhoneNumber(fullPhoneNumber, verifier);
        setVerificationId(id);
        Alert.alert("OTP Sent", `An OTP has been sent to ${fullPhoneNumber}`);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmVerificationCode = async () => {
    if (!verificationId || verificationCode.length !== 6) {
      Alert.alert("Error", "Please enter the 6-digit OTP.");
      return;
    }

    setLoading(true);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
      await signInWithCredential(auth, credential);
      // Auth state listener in your _layout.tsx will handle navigation
    } catch (error: any) {
      Alert.alert("Error", error.message);
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
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <FirebaseRecaptchaVerifierModal
            ref={recaptchaVerifier}
            firebaseConfig={app.options}
            // attemptInvisibleVerification={true} // Use this for invisible reCAPTCHA
          />
          <LinearGradient
            colors={["#DBEAFE", "#F3F4F6", "#FFFFFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="flex-1"
          >
            <View className="flex-1 justify-center items-center px-8">
              <View className="items-center mb-12">
                <View className="bg-blue-100 rounded-3xl p-6 mb-6">
                  <Icon name="storefront" size={60} color="#3B82F6" />
                </View>
                <Text className="text-4xl font-bold text-blue-900 mb-2">HisabKitaab</Text>
                <Text className="text-blue-700 text-lg text-center">
                  Your Smart Shop Management Solution
                </Text>
              </View>

              <View className="w-full max-w-sm">
                <View className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 border border-blue-200 shadow-lg">
                  {!verificationId ? (
                    <>
                      <Text className="text-2xl font-bold text-blue-900 text-center mb-6">
                        Enter Your Phone Number
                      </Text>
                      <View className="mb-4 flex-row items-center bg-white rounded-xl border border-blue-300 shadow-sm">
                        <Text style={styles.countryCode}>+91</Text>
                        <TextInput
                          style={[styles.input, { flex: 1 }]}
                          placeholder="10-digit mobile number"
                          placeholderTextColor="#9CA3AF"
                          value={phoneNumber}
                          onChangeText={setPhoneNumber}
                          keyboardType="phone-pad"
                          maxLength={10}
                        />
                      </View>
                      <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={sendVerificationCode}
                        disabled={loading}
                      >
                        <LinearGradient
                          colors={loading ? ["#9CA3AF", "#6B7280"] : ["#3B82F6", "#60A5FA"]}
                          className="w-full rounded-xl py-4 items-center"
                        >
                          <Text className="text-white font-bold text-lg">
                            {loading ? "Sending OTP..." : "Send OTP"}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text className="text-2xl font-bold text-blue-900 text-center mb-6">
                        Enter OTP
                      </Text>
                      <View className="mb-6 bg-white rounded-xl border border-blue-300 shadow-sm">
                        <TextInput
                          style={styles.input}
                          placeholder="6-digit code"
                          placeholderTextColor="#9CA3AF"
                          value={verificationCode}
                          onChangeText={setVerificationCode}
                          keyboardType="number-pad"
                          maxLength={6}
                        />
                      </View>
                      <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={confirmVerificationCode}
                        disabled={loading}
                      >
                        <LinearGradient
                          colors={loading ? ["#9CA3AF", "#6B7280"] : ["#3B82F6", "#60A5FA"]}
                          className="w-full rounded-xl py-4 items-center"
                        >
                          <Text className="text-white font-bold text-lg">
                            {loading ? "Verifying..." : "Verify & Sign In"}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
              <View className="mt-8 items-center">
                <Text className="text-blue-600 text-sm text-center">Secure • Fast • Reliable</Text>
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
  countryCode: {
    paddingLeft: 16,
    fontSize: 16,
    color: "#1F2937",
    fontWeight: "500",
  },
  button: {
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
