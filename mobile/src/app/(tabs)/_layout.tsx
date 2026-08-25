import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

export default function TabLayout() {
  const { isAuthenticated } = useAuth();
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtext,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
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
