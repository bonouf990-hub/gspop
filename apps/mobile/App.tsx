import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { supabase } from "./src/lib/supabase";
import LoginScreen from "./src/screens/LoginScreen";
import JobListScreen from "./src/screens/JobListScreen";
import JobDetailScreen from "./src/screens/JobDetailScreen";
import ProfileScreen from "./src/screens/ProfileScreen";

export type RootStackParamList = {
  JobList: undefined;
  JobDetail: { workOrderId: string };
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (authed === null) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0B1320", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#2F6FED" />
      </View>
    );
  }

  if (!authed) {
    return (
      <>
        <LoginScreen onLogin={() => setAuthed(true)} />
        <StatusBar style="light" />
      </>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="JobList"
        screenOptions={{
          headerStyle: { backgroundColor: "#0B1320" },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "600" },
        }}
      >
        <Stack.Screen
          name="JobList"
          component={JobListScreen}
          options={({ navigation }) => ({
            title: "My Jobs",
            headerRight: () => (
              <View style={{ marginRight: 4 }}>
                <ProfileButton onPress={() => navigation.navigate("Profile")} />
              </View>
            ),
          })}
        />
        <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: "Job Detail" }} />
        <Stack.Screen name="Profile" options={{ title: "Profile" }}>
          {() => <ProfileScreen onLogout={() => setAuthed(false)} />}
        </Stack.Screen>
      </Stack.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
  );
}

function ProfileButton({ onPress }: { onPress: () => void }) {
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#2F6FED",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <View
        style={{ position: "absolute", width: "100%", height: "100%" }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            justifyContent: "center",
            alignItems: "center",
          }}
          onTouchEnd={onPress}
        >
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: "#fff",
              marginBottom: 1,
            }}
          />
          <View
            style={{
              width: 20,
              height: 8,
              borderTopLeftRadius: 10,
              borderTopRightRadius: 10,
              backgroundColor: "#fff",
            }}
          />
        </View>
      </View>
    </View>
  );
}
