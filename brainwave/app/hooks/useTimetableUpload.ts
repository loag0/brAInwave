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

    // Create local copy first for offline support
    const localId = LocalDB.createTimetableLocally(
      userId,
      title,
      {},
      file.uri,
      mimeType,
    );

    try {
      const response = await brainwaveApi.uploadTimetable(
        userId,
        file.uri,
        file.name,
        mimeType,
      );

      // Mark local record as synced with structured data from backend
      LocalDB.markTimetableSynced(
        localId,
        response.id,
        response.weekly_template,
      );

      // Write to Firestore so planner and home screen update in real time
      await setDoc(
        doc(firestore, "users", userId, "data", "timetable"),
        { weekly_template: response.weekly_template },
        { merge: true },
      );

      await refresh?.(true);

      showAlert?.({ title: "Success", message: "Timetable uploaded!" });
    } catch (error: any) {
      console.error("Timetable upload failed, remaining offline-only:", error);
      Toast.show({
        type: "warning",
        text1: "Failed to upload",
        text2: "Timetable upload failed. Your timetable has been saved locally and will sync when you're back online.",
        position: "bottom",
        visibilityTime: 6000
      });
    } finally {
      setIsLoading?.(false);
      setLoadingMessage?.("Analyzing...");
    }
  };

  return { upload };
}
