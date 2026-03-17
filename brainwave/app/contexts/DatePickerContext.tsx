import React, {
  createContext,
  useContext,
  useRef,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
} from "react-native";
import { useTheme } from "./ThemeContext";
import DateTimePicker from "@react-native-community/datetimepicker";

// Types
type PickerMode = "date" | "time" | "datetime";

interface DatePickerOptions {
  value: Date;
  mode?: PickerMode;
  title?: string;
  onConfirm: (date: Date) => void;
  onCancel?: () => void;
  minimumDate?: Date;
  maximumDate?: Date;
}

interface DatePickerContextType {
  showPicker: (options: DatePickerOptions) => void;
  hidePicker: () => void;
}

{/* Constants */}
const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const pad = (n: number) => String(n).padStart(2, "0");

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const getYears = () => {
  const y = new Date().getFullYear();
  return Array.from({ length: 10 }, (_, i) => String(y - 2 + i));
};

const getDays = (month: number, year: number) =>
  Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) =>
    pad(i + 1),
  );

{/* WheelColumn */}
interface WheelColumnProps {
  items: string[];
  selectedIndex: number;
  onIndexChange: (i: number) => void;
  textColor: string;
  accentColor: string;
  flex?: number;
  loop?: boolean;
}

const WheelColumn = ({
  items,
  selectedIndex,
  onIndexChange,
  textColor,
  accentColor,
  flex = 1,
  loop = false,
}: WheelColumnProps) => {
  const listRef = useRef<FlatList>(null);

  const data = loop ? [...items, ...items, ...items] : items;
  const offset = loop ? items.length : 0;

  const getY = useCallback(
    (trueIndex: number) => (offset + trueIndex) * ITEM_HEIGHT,
    [offset],
  );

  const scrollToY = useCallback((y: number, animated: boolean) => {
    listRef.current?.scrollToOffset({ offset: y, animated });
  }, []);

  // Set initial position once on mount
  useEffect(() => {
    const t = setTimeout(() => scrollToY(getY(selectedIndex), false), 50);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onMomentumScrollEnd = useCallback(
    (e: any) => {
      const y = e.nativeEvent.contentOffset.y;
      const rawIndex = Math.round(y / ITEM_HEIGHT);
      const trueIndex = loop
        ? (((rawIndex - offset) % items.length) + items.length) % items.length
        : Math.max(0, Math.min(rawIndex, items.length - 1));

      onIndexChange(trueIndex);
      // Re-center into middle copy so both scroll directions stay available
      if (loop) scrollToY(getY(trueIndex), false);
    },
    [loop, offset, items.length, onIndexChange, scrollToY, getY],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: string; index: number }) => {
      const trueIdx = loop
        ? (((index - offset) % items.length) + items.length) % items.length
        : index;
      const isSelected = trueIdx === selectedIndex;
      return (
        <View style={col.item}>
          <Text
            style={[
              col.itemText,
              { color: isSelected ? accentColor : textColor },
              isSelected && col.itemTextSelected,
            ]}
          >
            {item}
          </Text>
        </View>
      );
    },
    [selectedIndex, accentColor, textColor, loop, offset, items.length],
  );

  return (
    <View style={[col.column, { flex }]}>
      <View
        style={[
          col.highlight,
          {
            borderColor: accentColor + "55",
            backgroundColor: accentColor + "15",
          },
        ]}
        pointerEvents="none"
      />
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
        onMomentumScrollEnd={onMomentumScrollEnd}
        style={{ height: PICKER_HEIGHT }}
        onScrollToIndexFailed={() => {}}
      />
    </View>
  );
};

const col = StyleSheet.create({
  column: { position: "relative" },
  highlight: {
    position: "absolute",
    top: ITEM_HEIGHT * 2,
    left: 4,
    right: 4,
    height: ITEM_HEIGHT,
    borderRadius: 10,
    borderWidth: 1,
    zIndex: 1,
    pointerEvents: "none",
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  itemText: { fontSize: 17 },
  itemTextSelected: { fontWeight: "700" },
});

{/* WheelPicker */}
interface WheelPickerProps {
  value: Date;
  mode: PickerMode;
  onChange: (date: Date) => void;
  textColor: string;
  accentColor: string;
}

const WheelPicker = ({
  value,
  mode,
  onChange,
  textColor,
  accentColor,
}: WheelPickerProps) => {
  const years = getYears();
  const days = getDays(value.getMonth(), value.getFullYear());
  const hours = Array.from({ length: 24 }, (_, i) => pad(i));
  const minutes = Array.from({ length: 60 }, (_, i) => pad(i));

  const patch = (
    updates: Partial<{
      year: number;
      month: number;
      day: number;
      hour: number;
      minute: number;
    }>,
  ) => {
    const d = new Date(value);
    if (updates.year !== undefined) d.setFullYear(updates.year);
    if (updates.month !== undefined) d.setMonth(updates.month);
    if (updates.day !== undefined) d.setDate(updates.day);
    if (updates.hour !== undefined) d.setHours(updates.hour);
    if (updates.minute !== undefined) d.setMinutes(updates.minute);
    onChange(d);
  };

  const yearIdx = Math.max(0, years.indexOf(String(value.getFullYear())));

  return (
    <View style={wp.row}>
      {(mode === "date" || mode === "datetime") && (
        <>
          <WheelColumn
            items={days}
            selectedIndex={value.getDate() - 1}
            onIndexChange={(i) => patch({ day: i + 1 })}
            textColor={textColor}
            accentColor={accentColor}
          />
          <WheelColumn
            items={MONTHS}
            selectedIndex={value.getMonth()}
            onIndexChange={(i) => patch({ month: i })}
            textColor={textColor}
            accentColor={accentColor}
            flex={2}
          />
          <WheelColumn
            items={years}
            selectedIndex={yearIdx}
            onIndexChange={(i) => patch({ year: parseInt(years[i]) })}
            textColor={textColor}
            accentColor={accentColor}
          />
        </>
      )}
      {(mode === "time" || mode === "datetime") && (
        <>
          <WheelColumn
            items={hours}
            selectedIndex={value.getHours()}
            onIndexChange={(i) => patch({ hour: i })}
            textColor={textColor}
            accentColor={accentColor}
            loop
          />
          <Text style={[wp.colon, { color: textColor }]}>:</Text>
          <WheelColumn
            items={minutes}
            selectedIndex={value.getMinutes()}
            onIndexChange={(i) => patch({ minute: i })}
            textColor={textColor}
            accentColor={accentColor}
            loop
          />
        </>
      )}
    </View>
  );
};

const wp = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  colon: { fontSize: 22, fontWeight: "700", paddingHorizontal: 4 },
});

{/* Context and Provider */}
const DatePickerContext = createContext<DatePickerContextType | null>(null);

export const DatePickerProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { theme, isDark } = useTheme();
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<DatePickerOptions | null>(null);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  const showPicker = (options: DatePickerOptions) => {
    setConfig(options);
    setTempDate(options.value || new Date());
    setVisible(true);
  };

  const hidePicker = () => {
    setVisible(false);
    setTimeout(() => setConfig(null), 250);
  };

  const handleConfirm = () => {
    config?.onConfirm(tempDate);
    hidePicker();
  };

  const accentColor = theme.colors.primary;

  return (
    <DatePickerContext.Provider value={{ showPicker, hidePicker }}>
      {children}
      <Modal
        transparent
        visible={visible}
        animationType="fade"
        onRequestClose={hidePicker}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={hidePicker}
          />
          <View
            style={[
              styles.pickerBox,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <View
              style={[styles.accentBar, { backgroundColor: accentColor }]}
            />
            <View style={styles.body}>
              <Text
                style={[styles.title, { color: theme.colors.text.primary }]}
              >
                {config?.title ||
                  (config?.mode === "time" ? "Set Time" : "Set Date")}
              </Text>

              <View style={styles.pickerContainer}>
                {config &&
                  (Platform.OS === "android" ? (
                    <WheelPicker
                      value={tempDate}
                      mode={config.mode || "date"}
                      onChange={setTempDate}
                      textColor={theme.colors.text.primary}
                      accentColor={accentColor}
                    />
                  ) : (
                    <DateTimePicker
                      value={tempDate}
                      mode={config.mode || "date"}
                      display={config.mode === "time" ? "spinner" : "inline"}
                      onChange={(_e, d) => {
                        if (d) setTempDate(d);
                      }}
                      minimumDate={config.minimumDate}
                      maximumDate={config.maximumDate}
                      themeVariant={isDark ? "dark" : "light"}
                      textColor={theme.colors.text.primary}
                      accentColor={accentColor}
                      style={{ width: "100%" }}
                    />
                  ))}
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: theme.colors.border }]}
                  onPress={() => {
                    config?.onCancel?.();
                    hidePicker();
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.cancelLabel,
                      { color: theme.colors.text.secondary },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmButton, { backgroundColor: accentColor }]}
                  onPress={handleConfirm}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmLabel}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </DatePickerContext.Provider>
  );
};

export const useDatePicker = () => {
  const context = useContext(DatePickerContext);
  if (!context)
    throw new Error("useDatePicker must be used within a DatePickerProvider");
  return context;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  pickerBox: {
    width: "100%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
  },
  accentBar: { height: 4, width: "100%" },
  body: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 10 },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
  },
  pickerContainer: {
    marginBottom: 20,
    minHeight: 220,
    justifyContent: "center",
  },
  buttonRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelLabel: { fontSize: 15, fontWeight: "600" },
  confirmButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmLabel: { fontSize: 15, fontWeight: "700", color: "#ffffff" },
});