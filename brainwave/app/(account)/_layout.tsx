import { Stack } from "expo-router";

export default function AccountLayout() {

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="profile" />
      <Stack.Screen name="mfa-setup" options={{ title: "Authenticator App" }} />
    </Stack>
  );
}
