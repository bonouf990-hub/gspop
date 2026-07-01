import { useEffect, useState } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { supabase } from "./src/lib/supabase";
import { COLORS } from "./src/theme";
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
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: "center" }}>
        <ActivityIndicator size="large" color={COLORS.gold} />
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
          headerStyle: { backgroundColor: COLORS.background },
          headerTintColor: COLORS.gold,
          headerTitleStyle: { fontWeight: "700", color: COLORS.textPrimary },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="JobList"
          component={JobListScreen}
          options={({ navigation }) => ({
            title: "My Jobs",
            headerRight: () => (
              <TouchableOpacity
                onPress={() => navigation.navigate("Profile")}
                activeOpacity={0.7}
                style={{ marginRight: 4 }}
              >
                <ProfileButton />
              </TouchableOpacity>
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

function ProfileButton() {
  return (
    <View
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 1.5,
        borderColor: COLORS.gold,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: COLORS.goldPale,
      }}
    >
      <View
        style={{
          width: 11,
          height: 11,
          borderRadius: 5.5,
          backgroundColor: COLORS.gold,
          marginBottom: 1,
        }}
      />
      <View
        style={{
          width: 18,
          height: 7,
          borderTopLeftRadius: 9,
          borderTopRightRadius: 9,
          backgroundColor: COLORS.gold,
        }}
      />
    </View>
  );
}
