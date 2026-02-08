import { Tabs } from "expo-router";
import { useTheme } from "../contexts/ThemeContext";
import { PomoTabIcon } from "@/components/PomoTabIcon";
import { HomeIcon, PlannerC_Icon, SettingsIcon, ProgressIcon } from "@/components/Icons";

export default function TabsLayout() {
  const { theme } = useTheme();

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false, tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
            borderTopWidth: 1,
          },
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.text.secondary,
          tabBarLabelStyle: { fontFamily: theme.fonts.regular, fontSize: 12,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ tabBarLabel: "Home", tabBarIcon: ({ color, size }) => (
              <HomeIcon color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="planner"
          options={{ title: "Planner", tabBarIcon: ({ color, size }) => (
              <PlannerC_Icon color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen 
          name="focus"
          options={{ title: "Focus", tabBarIcon: ({ color, focused }) => (
              <PomoTabIcon color = {color} focused = {focused} />
            )
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{ title: "Progress", tabBarIcon: ({ color, size }) => (
              <ProgressIcon color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{ title: "Settings", tabBarIcon: ({ color, size }) => (
              <SettingsIcon color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
