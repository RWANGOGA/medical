import { Tabs } from "expo-router";
import { BRANDING } from "../../constants/branding";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";

export default function TabLayout() {
  const { isAuthenticated } = useAuth();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: BRANDING.colors.primary,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
        headerStyle: { backgroundColor: BRANDING.colors.primary },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "bold" },
      }}
    >
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: "Home", 
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={22} color={color} /> 
        }} 
      />
      <Tabs.Screen 
        name="search" 
        options={{ 
          title: "Search", 
          tabBarIcon: ({ color }) => <Ionicons name="search-outline" size={22} color={color} /> 
        }} 
      />
      
      {/* Patients tab only visible for authenticated users */}
      <Tabs.Screen 
        name="patients" 
        options={{ 
          title: "Patients", 
          tabBarIcon: ({ color }) => <Ionicons name="people-outline" size={22} color={color} />,
          href: isAuthenticated ? undefined : null, // Hide if not authenticated
        }} 
      />
      
      <Tabs.Screen 
        name="resistance" 
        options={{ 
          title: "Resistance", 
          tabBarIcon: ({ color }) => <Ionicons name="pulse-outline" size={22} color={color} /> 
        }} 
      />
      <Tabs.Screen 
        name="guidelines" 
        options={{ 
          title: "Guidelines", 
          tabBarIcon: ({ color }) => <Ionicons name="book-outline" size={22} color={color} /> 
        }} 
      />
      <Tabs.Screen 
        name="profile" 
        options={{ 
          title: "Profile", 
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={22} color={color} /> 
        }} 
      />
      
      {/* Hidden routes */}
      <Tabs.Screen name="cds" options={{ href: null }} />
    </Tabs>
  );
}