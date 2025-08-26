import { Text, View, StyleSheet } from "react-native";
import axios from "axios";
import { useEffect } from "react";
import AppText from "../../components/AppText";

export default function Index() {
    
  useEffect(() => {
    axios
      .get("http://127.0.0.1:8000/ping")
      .then((res) => console.log(res.data))
      .catch((err) => console.log(err));
  }, []); // runs once when component mounts

    return (
      <View style={styles.container}>
        <AppText style={styles.apptext}>Edit app/index.tsx to edit this screen.</AppText>
      </View>
    );
  }

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
  apptext: {
    fontSize: 32
  }
});