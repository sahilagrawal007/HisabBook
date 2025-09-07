// import { Stack } from "expo-router";
// import { onAuthStateChanged, User } from "firebase/auth";
// import { doc, getDoc } from "firebase/firestore";
// import { useEffect, useState } from "react";
// import { ActivityIndicator, View } from "react-native";
// import { auth, db } from "../firebaseConfig";
// import { useRouter } from "expo-router";

// export default function RootLayout() {
//   const [user, setUser] = useState<User | null>(null);
//   const [userRole, setUserRole] = useState<"owner" | "customer" | null>(null);
//   const [loading, setLoading] = useState(true);
//   const router = useRouter();

//   useEffect(() => {
//     const unsubscribe = onAuthStateChanged(auth, async (user) => {
//       setUser(user);
//       if (user) {
//         try {
//           const ownerDoc = await getDoc(doc(db, "owners", user.uid));
//           if (ownerDoc.exists()) {
//             setUserRole("owner");
//           } else {
//             const customerDoc = await getDoc(doc(db, "customers", user.uid));
//             if (customerDoc.exists()) {
//               setUserRole("customer");
//             } else setUserRole(null);
//           }
//         } catch (error) {
//           console.error("Error checking user role:", error);
//           setUserRole(null);
//         }
//       } else {
//         setUserRole(null);
//       }
//       setLoading(false);
//     });
//     return unsubscribe;
//   }, []);

//   // Redirect after login+role detected
//   useEffect(() => {
//     if (!loading && user && userRole) {
//       if (userRole === "owner") {
//         router.replace('/(ownerTabs)');
//       } else if (userRole === "customer") {
//         router.replace('/(customerTabs)');
//       }
//     }
//     if (!loading && !user) {
//       router.replace('/(auth)/phone-auth');
//     }
//   }, [loading, user, userRole, router]);

//   if (loading) {
//     return (
//       <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
//         <ActivityIndicator size="large" color="#007AFF" />
//       </View>
//     );
//   }

//   return (
//     <Stack screenOptions={{ headerShown: false }}>
//       <Stack.Screen name="(ownerTabs)" />
//       <Stack.Screen name="(customerTabs)" />
//     </Stack>
//   );
// }



// In app/_layout.tsx
// import { Stack, useRouter, useSegments } from "expo-router";
// import { onAuthStateChanged, User } from "firebase/auth";
// import { doc, getDoc } from "firebase/firestore";
// import React, { useEffect, useState } from "react";
// import { ActivityIndicator, View } from "react-native";
// import { auth, db } from "../firebaseConfig";

// // This hook is essential for preventing screen flicker and ensuring navigation state is correct
// const useProtectedRoute = (user: User | null) => {
//   const segments = useSegments();
//   const router = useRouter();

//   useEffect(() => {
//     const inAuthGroup = segments[0] === '(auth)';

//     if (user && !inAuthGroup) {
//       // User is authenticated but not in the main app sections.
//       // This can happen on initial load. We let the logic below handle redirection.
//       return;
//     }
    
//     if (!user && !inAuthGroup) {
//       // User is not authenticated and is not in the auth section, redirect them.
//       router.replace('/(auth)/phone-auth');
//     }
//   }, [user, segments, router]);
// };

// export default function RootLayout() {
//   const [user, setUser] = useState<User | null>(null);
//   const [loading, setLoading] = useState(true);
//   const router = useRouter();

//   useEffect(() => {
//     const unsubscribe = onAuthStateChanged(auth, async (authenticatedUser) => {
//       setLoading(true);
//       if (authenticatedUser) {
//         setUser(authenticatedUser);
        
//         // Check if user has a role defined in Firestore
//         const ownerDocRef = doc(db, "owners", authenticatedUser.uid);
//         const customerDocRef = doc(db, "customers", authenticatedUser.uid);

//         const ownerDoc = await getDoc(ownerDocRef);
//         if (ownerDoc.exists()) {
//           router.replace('/(ownerTabs)');
//         } else {
//           const customerDoc = await getDoc(customerDocRef);
//           if (customerDoc.exists()) {
//             router.replace('/(customerTabs)');
//           } else {
//             // New user: authenticated but no profile. Go to role selection.
//             router.replace('/(auth)/roleSelection');
//           }
//         }
//       } else {
//         // User is logged out
//         setUser(null);
//         router.replace('/(auth)/phone-auth');
//       }
//       setLoading(false);
//     });

//     return () => unsubscribe();
//   }, []);
  
//   // Use the protected route hook
//   useProtectedRoute(user);

//   if (loading) {
//     return (
//       <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
//         <ActivityIndicator size="large" color="#3B82F6" />
//       </View>
//     );
//   }

//   return (
//     <Stack screenOptions={{ headerShown: false }}>
//       <Stack.Screen name="(ownerTabs)" />
//       <Stack.Screen name="(customerTabs)" />
//       <Stack.Screen name="(auth)" />
//     </Stack>
//   );
// }


``
// In app/_layout.tsx

import { Stack, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect } from "react";
import { auth, db } from "../firebaseConfig";

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authenticatedUser) => {
      if (authenticatedUser) {
        // User is signed in, let's check their role in Firestore.
        const ownerDocRef = doc(db, "owners", authenticatedUser.uid);
        const customerDocRef = doc(db, "customers", authenticatedUser.uid);

        const ownerDoc = await getDoc(ownerDocRef);
        if (ownerDoc.exists()) {
          // It's an owner, go to the owner dashboard.
          router.replace('/(ownerTabs)');
        } else {
          const customerDoc = await getDoc(customerDocRef);
          if (customerDoc.exists()) {
            // It's a customer, go to the customer dashboard.
            router.replace('/(customerTabs)');
          } else {
            // This is a new user who has authenticated but not completed their profile.
            router.replace('/(auth)/roleSelection');
          }
        }
      } else {
        // User is signed out, send them to the phone authentication screen.
        router.replace('/(auth)/phone-auth');
      }
    });

    // Cleanup the subscription when the component unmounts
    return () => unsubscribe();
  }, []);

  // This Stack navigator is now ALWAYS rendered, which fixes the error.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* The initial loading screen */}
      <Stack.Screen name="index" />
      {/* The authentication flow screens */}
      <Stack.Screen name="(auth)" />
      {/* The main app screens for logged-in users */}
      <Stack.Screen name="(ownerTabs)" />
      <Stack.Screen name="(customerTabs)" />
    </Stack>
  );
}