// import { Redirect } from "expo-router";

// export default function Index() {
//   // You can put role-based redirect logic here
//   return <Redirect href="/(auth)/phone-auth" />;
// }

import React from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function InitialLoadingScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#DBEAFE' }}>
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  );
}