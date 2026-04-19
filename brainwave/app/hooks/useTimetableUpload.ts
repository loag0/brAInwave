import * as DocumentPicker from "expo-document-picker";
import { doc, setDoc } from "firebase/firestore";
import { db as firestore } from "../../firebaseConfig";
import { LocalDB } from "../database/localDb";
import brainwaveApi from "@/api/brAInwaveApi";
import { Toast } from "react-native-toast-message/lib/src/Toast";

export function useTimetableUpload(
  userId?: string,
  refresh?: (force?: boolean) => Promise<void>,
  showAlert?: any,
  setIsLoading?: (loading: boolean) => void,
  setLoadingMessage?: (msg: string) => void,
  replacingTimetable?: { id: number; remote_id: number | null },
) {
  const upload = async () => {
    if (!userId) {
      showAlert?.({ title: "Error", message: "You must be logged in" });
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets) return;

    const file = result.assets[0];
    const title = `Schedule ${new Date().toLocaleDateString()}`;
    const mimeType = file.mimeType || "application/octet-stream";

    if (mimeType !== "application/pdf" && !mimeType.startsWith("image/")) {
      Toast.show({
        type: "error",
        text1: "Unsupported file type",
        text2: "Please upload a PDF or photo of your timetable.",
        position: "bottom",
        visibilityTime: 4000,
      });
      return;
    }

    setIsLoading?.(true);
    setLoadingMessage?.("Uploading Timetable...");

    try {
      const response = await brainwaveApi.uploadTimetable(
        userId,
        file.uri,
        file.name,
        mimeType,
      );

      // Create local record once backend confirms valid parse
      const localId = LocalDB.createTimetableLocally(
        userId,
        title,
        response.weekly_template,
        file.uri,
        mimeType,
      );

      LocalDB.markTimetableSynced(localId, response.id, response.weekly_template);

      // Delete old timetable before refresh so both never coexist in state
      if (replacingTimetable) {
        LocalDB.hardDeleteTimetable(replacingTimetable.id);
        if (replacingTimetable.remote_id) {
          brainwaveApi.deleteTimetable(userId, replacingTimetable.remote_id).catch(() => {});
        }
      }

      // Write to Firestore so planner and home screen update in real time
      await setDoc(
        doc(firestore, "users", userId, "data", "timetable"),
        { weekly_template: response.weekly_template },
        { merge: true },
      );

      await refresh?.(true);

      Toast.show({ type: "success", text1: "Timetable uploaded", position: "bottom", visibilityTime: 4000 });
    } catch (error: any) {
      const status = error?.response?.status;

      if (status === 422) {
        const detail =
          error?.response?.data?.detail ||
          "We couldn't find any classes in that file. u sure it's a timetable twin?";
        showAlert?.({ title: "Upload Failed", message: detail });
        return;
      }

      if (status === 413) {
        showAlert?.({ title: "File Too Large", message: "Please upload a file smaller than 10MB." });
        return;
      }

      // Network/server error — save locally for later sync
      if (__DEV__) console.error("Timetable upload failed, remaining offline-only:", error);
      LocalDB.createTimetableLocally(userId, title, {}, file.uri, mimeType);
      Toast.show({
        type: "warning",
        text1: "Saved locally",
        text2: "Upload failed. Your timetable has been saved and will sync when you're back online.",
        position: "bottom",
        visibilityTime: 6000,
      });
    } finally {
      setIsLoading?.(false);
      setLoadingMessage?.("Analyzing...");
    }
  };

  return { upload };
}
