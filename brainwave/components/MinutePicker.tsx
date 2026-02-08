import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from "react-native";
import { Theme } from "../app/types";
import { useTheme } from "../app/contexts/ThemeContext"; 

interface MinutePickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (minutes: number) => void;
  theme: Theme;
  initial?: number;
  existingDurations?: number[];
}

const ITEM_HEIGHT = 44;
const MINUTES = Array.from({ length: 36 }, (_, i) => (i + 1) * 5);

export default function MinutePicker({
  visible,
  onClose,
  onConfirm,
  theme,
  initial = 25,
}: MinutePickerProps) {
  const [pickedMinutes, setPickedMinutes] = useState(initial); 
  const {isDark} = useTheme();

  const styles = createStyles(theme, isDark);

return (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.modalOverlay}>
      <View
        style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
      >
        <Text style={[styles.modalTitle, { color: theme.colors.text.primary }]}>
          Pick duration
        </Text>

        <View style={{ height: ITEM_HEIGHT * 4, overflow: "hidden" }}>
          <FlatList
            data={MINUTES}
            keyExtractor={(item) => item.toString()}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_HEIGHT}
            decelerationRate="fast"
            contentContainerStyle={{
              paddingVertical: ITEM_HEIGHT * 2,
            }}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(
                e.nativeEvent.contentOffset.y / ITEM_HEIGHT,
              );
              setPickedMinutes(MINUTES[index]);
            }}
            renderItem={({ item }) => (
              <View
                style={{
                  height: ITEM_HEIGHT,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 22,
                    color:
                      item === pickedMinutes
                        ? theme.colors.primary
                        : theme.colors.text.secondary,
                  }}
                >
                  {item}
                </Text>
              </View>
            )}
          />
        </View>

          <TouchableOpacity
            onPress={() => {
              onConfirm(pickedMinutes);
              onClose();
            }}
          >
            <Text style={{ color: theme.colors.primary, marginTop: 20 }}>
              Ok
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: theme.colors.error, marginTop: 12 }}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
    </View>
  </Modal>
);
}

const createStyles = (theme: Theme, isDark: boolean) => 
    StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.67)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    padding: 30,
    borderRadius: 20,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
  },
});
