import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import Feather from 'react-native-vector-icons/Feather';

export default function OwnerTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "#8E8E93",
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: "Products",
          tabBarIcon: ({ color, size }) => <Feather name="list" size={28} color="#555" />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="EditProfile"
        options={{
          href: null,
        }}
      />
      {/* <Tabs.Screen
        name="ChangePassword"
        options={{
          href: null,
        }}
      /> */}
      <Tabs.Screen
        name="ShopInformation"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="CustomerProfile"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="qr"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="AddTransaction"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="Customers"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}