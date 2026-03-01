import * as DocumentPicker from "expo-document-picker";
import { LocalDB } from "../database/localDb";
import brainwaveApi from "@/api/brAInwaveApi";

export function useTimetableUpload(
  userId?: string,
  refresh?: (force?: boolean) => Promise<void>,
  showAlert?: any,
  setIsLoading?: (loading: boolean) => void,
  setLoadingMessage?: (msg: string) => void,
) {
  const upload = async () => {
    if (!userId) {
      showAlert?.({
        title: "Error",
        message: "You must be logged in",
      });
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

    setIsLoading?.(true);
    setLoadingMessage?.("Uploading Timetable...");

    //Create a local copy first so the user has a timetable tracked offline
    const localId = LocalDB.createTimetableLocally(
      userId,
      title,
      {},
      file.uri,
      mimeType,
    );

    try {
      // upload to backend
      const response = await brainwaveApi.uploadTimetable(
        userId,
        file.uri,
        file.name,
        mimeType,
      );

      // Mark the local timetable as synced
      LocalDB.markTimetableSynced(
        localId,
        response.id,
        response.weekly_template,
      );

      await refresh?.(true);

      showAlert?.({
        title: "Success",
        message: "Timetable uploaded",
      });
    } catch (error: any) {
      console.error("Timetable upload failed, remaining offline-only:", error);

      showAlert?.({
        title: "Saved offline",
        message:
          "We saved your timetable locally and will sync it when you're back online.",
      });
    } finally {
      setIsLoading?.(false);
      setLoadingMessage?.("Analyzing...");
    }
  };

  return { upload };
}
