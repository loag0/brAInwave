import { useState, useEffect, useCallback } from "react";
import { LocalDB } from "../database/localDb";
import BrAInwaveAPI from "@/api/brAInwaveApi";
import { useAuth } from "../contexts/AuthContext";

export const useContent = () => {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<any[]>([]);
  const [timetables, setTimetables] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. SYNC MANAGER: Pushes local "Dirty" changes to the Python Backend
  const syncDirtyRecords = useCallback(
    async (currentMaterials: any[], currentTimetables: any[]) => {
      if (!user?.id) return;

      const dirtyMaterials = currentMaterials.filter((m) => m.is_dirty === 1);
      const dirtyTimetables = currentTimetables.filter((t) => t.is_dirty === 1);

      // Sync Unsynced Materials (Syllabus uploads)
      for (const item of dirtyMaterials) {
        try {
          // Only attempt file sync if we have a URI
          if (item.uri) {
            const fileName = item.uri.split("/").pop();
            const result = await BrAInwaveAPI.uploadSyllabus(
              user.id,
              item.uri,
              fileName,
              item.type || "application/pdf",
            );
            LocalDB.markMaterialSynced(item.id, result.id);
          }
        } catch (e: any) {
          console.error("Failed to sync material:", item.title, e.message);
        }
      }

      // Sync Unsynced Timetables
      for (const table of dirtyTimetables) {
        try {
          if (table.uri) {
            const fileName = table.uri.split("/").pop();
            const result = await BrAInwaveAPI.uploadTimetable(
              user.id,
              table.uri,
              fileName,
              table.type || "application/pdf",
            );
            LocalDB.markTimetableSynced(table.id, result.id);
          }
        } catch (e: any) {
          console.error("Failed to sync timetable:", table.title, e.message);
        }
      }

      // Update state to reflect synced status (is_dirty 1 -> 0)
      setMaterials(LocalDB.getAllMaterials(user.id));
      setTimetables(LocalDB.getAllTimetables(user.id));
    },
    [user?.id],
  );

  // 2. FETCH DATA: Instant load from SQLite + Background Cloud Refresh
  const fetchData = useCallback(async () => {
    if (!user?.id) return;

    // Load SQLite immediately for speed
    const localMaterials = LocalDB.getAllMaterials(user.id);
    const localTimetables = LocalDB.getAllTimetables(user.id);
    setMaterials(localMaterials);
    setTimetables(localTimetables);

    // Run sync manager to push local changes up
    await syncDirtyRecords(localMaterials, localTimetables);

    setIsLoading(true);
    setError(null);

    try {
      // Pull fresh data from Python Backend
      const remoteData = await BrAInwaveAPI.listStudyPlans(user.id);

      // Update SQLite with fresh cloud data
      LocalDB.syncMaterialsFromServer(user.id, remoteData.plans || []);

      // Refresh state from the newly updated local DB
      setMaterials(LocalDB.getAllMaterials(user.id));
    } catch (err: any) {
      console.log("Device offline or server error, using local data.", err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, syncDirtyRecords]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 3. ACTION: Create a plan locally first
  const createMaterial = async (
    title: string,
    rawContent: string,
    uri?: string,
    type?: string,
  ) => {
    if (!user?.id) return null;

    const localId = LocalDB.createMaterialLocally(
      user.id,
      title,
      rawContent,
      uri,
      type,
    );
    const updatedLocal = LocalDB.getAllMaterials(user.id);

    setMaterials(updatedLocal);

    // Attempt to sync this specific item immediately
    syncDirtyRecords(updatedLocal, timetables);

    return localId;
  };

  return {
    materials,
    timetables,
    isLoading,
    error,
    refresh: fetchData,
    createMaterial,
  };
};
