// app/(ownerTabs)/qr.tsx
import { db } from "@/firebaseConfig";
import * as FileSystem from "expo-file-system";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { getAuth } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

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
      const ownerRef = doc(db, "owners", user.uid);
      const ownerSnap = await getDoc(ownerRef);
      if (ownerSnap.exists()) {
        const ownerData = ownerSnap.data();
        const ownerLink = ownerData.shopLink;
        setShopLink(ownerLink);
        setShopName(ownerData.name);

        // Ensure a corresponding shop document exists for customer discovery/join
        const shopRef = doc(db, "shops", user.uid);
        const shopSnap = await getDoc(shopRef);
        if (!shopSnap.exists()) {
          await setDoc(shopRef, {
            name: ownerData.shopName || ownerData.name || "",
            link: ownerLink,
            address: ownerData.address || "",
            city: ownerData.city || "",
            pincode: ownerData.pincode || "",
            ownerUid: user.uid,
            customers: [],
            createdAt: new Date(),
          });
        }
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
          encoding: FileSystem.EncodingType.Base64,
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
