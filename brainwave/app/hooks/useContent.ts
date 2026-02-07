import { useState, useEffect, useCallback } from "react";
import { LocalDB } from "../database/localDb";
import BrainwaveAPI from "@/api/brAInwaveApi";
import { useAuth } from "../contexts/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface StudyPlan {
  id: string;
  date: string;
  tasks: any[];
  [key: string]: any;
}

export const useContent = () => {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<any[]>([]);
  const [timetables, setTimetables] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. SYNC MANAGER: Pushes local "Dirty" changes to the Python Backend
  const syncDirtyRecords = useCallback(
    async (currentMaterials: any[], currentTimetables: any[]) => {
      if (!user?.id) return;

      const dirtyMaterials = currentMaterials.filter((m) => m.is_dirty === 1);
      const dirtyTimetables = currentTimetables.filter((t) => t.is_dirty === 1);

      // Sync Unsynced Materials
      for (const item of dirtyMaterials) {
        try {
          if (item.uri) {
            const fileName = item.uri.split("/").pop();
            const result = await BrainwaveAPI.uploadSyllabus(
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
            const result = await BrainwaveAPI.uploadTimetable(
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

      // Update local state with the newly "cleaned" (is_dirty=0) rows
      setMaterials(LocalDB.getAllMaterials(user.id));
      setTimetables(LocalDB.getAllTimetables(user.id));
    },
    [user?.id],
  );

  // 2. FETCH DATA: Instant load from SQLite + Background Cloud Refresh
  const fetchData = useCallback(async () => {
    if (!user?.id) return;

    //const targetDate = new Date().toISOString().split("T")[0];

    // Load SQLite immediately for speed
    const localMaterials = LocalDB.getAllMaterials(user.id);
    const localTimetables = LocalDB.getAllTimetables(user.id);
    const localPlans = LocalDB.getAllPlans(user.id);

    setMaterials(localMaterials);
    setTimetables(localTimetables);
    setPlans(localPlans);

    setIsLoading(true);
    setError(null);

    try {
      // Step A: Sync any local changes first
      await syncDirtyRecords(localMaterials, localTimetables);

      // Step B: Check if we have an AI plan for today.
      // If we don't have one in localPlans, ask the API.
      const lastSync = await AsyncStorage.getItem("lastPlansSync");
      const TWELVE_HOURS = 1000 * 60 * 60 * 12;

      if(!lastSync || Date.now() - Number(lastSync) > TWELVE_HOURS){
        const remotePlans = await BrainwaveAPI.listDailyPlans(user.id);

        if(remotePlans?.plans?.length){
          LocalDB.syncPlansFromServer(user.id, remotePlans.plans);
          await AsyncStorage.setItem("lastPlansSync", String(Date.now()));
        }
      }

      // Step D: Final state refresh from LocalDB (The "Single Source of Truth")
      setMaterials(LocalDB.getAllMaterials(user.id));
      setPlans(LocalDB.getAllPlans(user.id));
    } catch (err: any) {
      console.log("Fetch Error: ", err.message);
      setError("Failed to sync with cloud. Using offline data.");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, syncDirtyRecords]);

  const generatePlanForDate = async (date: string) => {
    if (!user?.id) return;

    //GUARD: Checks for local existence instead of using AI all the time
    const existing = LocalDB.getPlanByDate(user.id, date);
    if(existing){
      console.log("Plan already exists, skipping AI");
      return existing.tasks
    }

    setIsLoading(true);
    setError(null);
    try {

      const dailyPlan = await BrainwaveAPI.generateDailyPlan(user.id, date);

      if (dailyPlan?.items) {
        LocalDB.syncPlansFromServer(user.id, [
          { date, items: dailyPlan.items },
        ]);
        setPlans(LocalDB.getAllPlans(user.id));
        return dailyPlan.items;
      }
    } catch (err: any) {        
      setError(
        err.message.includes("429")
          ? "AI quota hit. Slow down brochacho ✌️✌️✌️"
          : "Failed to generate plan",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

    // Sync in background
    syncDirtyRecords(updatedLocal, timetables);
    return localId;
  };

  return {
    materials,
    timetables,
    plans,
    isLoading,
    error,
    refresh: fetchData,
    generatePlanForDate,
    createMaterial,
  };
};;
