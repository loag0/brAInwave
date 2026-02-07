import * as DocumentPicker from "expo-document-picker";
import { LocalDB } from "../database/localDb";
import brainwaveApi from "@/api/brAInwaveApi";

export function useTimetableUpload(
  userId?: string,
  refresh?: (force?: boolean) => Promise<void>,
  showAlert?: any,
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

    const response = await brainwaveApi.uploadTimetable(
      userId,
      file.uri,
      file.name,
      file.mimeType || "application/octet-stream",
    );

    LocalDB.createTimetableLocally(
      userId,
      `Schedule ${new Date().toLocaleDateString()}`,
      response.weekly_template,
      file.uri,
      file.mimeType,
    );

    await refresh?.(true);

    showAlert?.({
      title: "Success",
      message: "Timetable uploaded",
    });
  };

  return { upload };
}
