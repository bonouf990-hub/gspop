import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import JobListScreen from "./src/screens/JobListScreen";
import JobDetailScreen from "./src/screens/JobDetailScreen";

export type RootStackParamList = {
  JobList: undefined;
  JobDetail: { workOrderId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="JobList">
        <Stack.Screen name="JobList" component={JobListScreen} options={{ title: "My Jobs" }} />
        <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: "Job Detail" }} />
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}
