import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{tabBarActiveTintColor: '##ffd33d',
    tabBarStyle: {
        backgroundColor: '#d9d9d9',
    }
    }}>
        
      <Tabs.Screen name="index" options={{ headerShown: false, title: 'Home', tabBarIcon: ({color, focused}) => (
        <Ionicons name={focused ? 'home-sharp' : 'home-outline'} color={color} size={24}/>
      ),
      }} 
      />
      <Tabs.Screen name="account" options={{headerShown: false, title: 'Account', tabBarIcon: ({color, focused}) => (
        <Ionicons name={focused ? 'person-sharp' : 'person-outline'} color={color} size={24}/>
      ),
      }} />
    </Tabs>
  );
}
