import { Text, View, StyleSheet } from "react-native";
import axios from "axios";
import { useEffect } from "react";

export default function Index() {
  useEffect(() => {
    axios
      .get("http://127.0.0.1:8000/ping")
      .then((res) => console.log(res.data))
      .catch((err) => console.log(err));
  }, []); // runs once when component mounts

  return (
    <View style={styles.container}>
      <Text>edit app/index.tsx to edit this screen.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center", // centers text horizontally
  },
});