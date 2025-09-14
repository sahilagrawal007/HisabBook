import { useEffect, useRef, useState } from "react";
import { View, Text, Alert, Button, Share, Platform, TouchableOpacity } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useRouter } from "expo-router";
import Clipboard from "expo-clipboard";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebaseConfig";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export default function OwnerQRScreen() {
  const [shopLink, setShopLink] = useState("null");
  const [shopName, setShopName] = useState("null");
  const router = useRouter();
  const qrRef = useRef<any>(null);

  useEffect(() => {
    fetchProducts();  
  }, []);

  const fetchProducts = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    try {
      const docRef = doc(db, "owners", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setShopLink(docSnap.data().shopLink);
        setShopName(docSnap.data().name);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const shareQrImage = async () => {
    if (!qrRef.current) return;
    qrRef.current.toDataURL(async (dataURL: string) => {
      try {
        const fileUri = FileSystem.cacheDirectory + "qr-code.png";
        await FileSystem.writeAsStringAsync(fileUri, dataURL, {
          encoding: "base64",
        });
        // Share the image file
        await Sharing.shareAsync(fileUri, {
          mimeType: "image/png",
          dialogTitle: `QR code for shop "${shopName}"`,
        });
      } catch (err) {
        Alert.alert("Error", "Could not share QR code image.");
        console.error(err);
      }
    });
  };

  return (
    <View className="flex-1 justify-center items-center bg-white p-4">
      <Text className="text-lg font-semibold mb-4">Scan to Join:</Text>
      <QRCode
        value={shopLink}
        size={200}
        quietZone={24}
        getRef={(ref) => {
          qrRef.current = ref;
        }}
      />
      <View className="mt-6">
        <TouchableOpacity
          className="bg-[#4b91f3] px-6 py-5 rounded-lg"
          onPress={shareQrImage}
        >
          <Text className="text-l text-white">Share QR Image </Text>
        </TouchableOpacity>
      </View>
      <View className="mt-3">
        <TouchableOpacity
          className="bg-[#4b91f3] px-6 py-5 rounded-lg"
          onPress={() => router.back()}
        >
          <Text className="text-l text-white">Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
