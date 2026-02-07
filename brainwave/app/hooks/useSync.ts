import { useEffect, useState } from "react";
import * as Network from "expo-network";
import { LocalDB, db } from "../database/localDb";
import { useAuth } from "../contexts/AuthContext";

export const useSync = () => {
  const { token, user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);

  const syncOfflineData = async () => {
    const state = await Network.getNetworkStateAsync();

    // Only sync if we are online and have a logged-in user
    if (!state.isConnected || !state.isInternetReachable || !token || !user)
      return;

    setIsSyncing(true);
    try {
      // 1. Fetch "Dirty" Study Materials (created/modified offline)
      const dirtyMaterials = db.getAllSync(
        "SELECT * FROM study_materials WHERE is_dirty = 1",
      ) as any[];

      for (const material of dirtyMaterials) {
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_API_URL}/study-materials`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              title: material.title,
              rawContent: material.rawContent,
              aiPlan: material.aiPlan,
            }),
          },
        );

        if (response.ok) {
          const cloudData = await response.json();
          // Update local record: mark as clean and save the real ID from Python DB
          db.runSync(
            "UPDATE study_materials SET is_dirty = 0, remote_id = ? WHERE id = ?",
            [cloudData.id, material.id],
          );
        }
      }

      // 2. Fetch "Dirty" Timetables
      const dirtyTimetables = db.getAllSync(
        "SELECT * FROM timetables WHERE is_dirty = 1",
      ) as any[];

      for (const table of dirtyTimetables) {
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_API_URL}/timetables`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              title: table.title,
              structuredData: JSON.parse(table.structuredData),
            }),
          },
        );

        if (response.ok) {
          const cloudData = await response.json();
          db.runSync(
            "UPDATE timetables SET is_dirty = 0, remote_id = ? WHERE id = ?",
            [cloudData.id, table.id],
          );
        }
      }

      console.log("Sync complete: Local and Cloud are in parity.");
    } catch (error) {
      console.error("Sync process interrupted:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Automatically trigger sync when the hook is used or network changes
  useEffect(() => {
    syncOfflineData();

    // Optional: Poll every 5 minutes as a fallback
    const interval = setInterval(syncOfflineData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  return { isSyncing, forceSync: syncOfflineData };
};
