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
            console.log("Attempting sync for:", item.title, "URI:", item.uri);
            const result = await BrainwaveAPI.uploadSyllabus(
              user.id,
              item.uri,
              fileName,
              item.type || "application/pdf",
            );
            LocalDB.markMaterialSynced(item.id, result.id);
          }
        } catch (e: any) {
          console.error(
            `Failed to sync material on ${item.title}:`,
            e.response?.data,
          );

          setError(`Server could not read the timetable "${item.title}".`);
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
      setMaterials(await LocalDB.getAllMaterials(user.id));
      setTimetables(await LocalDB.getAllTimetables(user.id));
    },
    [user?.id],
  );

  // 2. FETCH DATA: Instant load from SQLite + Background Cloud Refresh
  const fetchData = useCallback(
    async (force = false) => {
      if (!user?.id) return;

      // 1. load local immediately
      const localMaterials = await LocalDB.getAllMaterials(user.id);
      const localTimetables = await LocalDB.getAllTimetables(user.id);
      const localPlans = await LocalDB.getAllPlans(user.id);

      setMaterials(await localMaterials);
      setTimetables(await localTimetables);
      setPlans(await localPlans);

      setIsLoading(true);
      setError(null);

      try {
        // 2. sync dirty records in background
        await syncDirtyRecords(localMaterials, localTimetables);

        // 3. pull from backend if forced or timer expired
        const lastSync = await AsyncStorage.getItem("lastPlansSync");
        const TWELVE_HOURS = 1000 * 60 * 60 * 12;

        if (
          force ||
          !lastSync ||
          Date.now() - Number(lastSync) > TWELVE_HOURS
        ) {
          const remotePlans = await BrainwaveAPI.listDailyPlans(user.id);
          if (remotePlans?.plans) {
            LocalDB.syncPlansFromServer(user.id, remotePlans.plans);
            await AsyncStorage.setItem("lastPlansSync", String(Date.now()));
          }
        }

        // 4. update app state after full sync
        setMaterials(await LocalDB.getAllMaterials(user.id));
        setTimetables(await LocalDB.getAllTimetables(user.id));
        setPlans(await LocalDB.getAllPlans(user.id));
      } catch (err: any) {
        console.log("Fetch Error: ", err.message);
        setError("Failed to sync with cloud.");
      } finally {
        setIsLoading(false);
      }
    },
    [user?.id, syncDirtyRecords],
  );

  const generatePlanForDate = async (
    date: string,
    preferences?: any,
    customTasks?: any[],
  ) => {
    if (!user?.id) return [];

    // check local first
    const existing = await LocalDB.getPlanByDate(user.id, date);
    if (existing) {
      console.log("Plan already exists locally, skipping AI");
      return existing.tasks;
    }

    setIsLoading(true);
    setError(null);

    try {
      // generate from AI
      const dailyPlan = await BrainwaveAPI.generateDailyPlan(
        user.id,
        date,
        preferences || {},
        customTasks || [],
      );

      if (dailyPlan?.items) {
        // sync to local DB
        await LocalDB.syncPlansFromServer(user.id, [
          { date, items: dailyPlan.items },
        ]);

        // update state
        const updatedPlans = await LocalDB.getAllPlans(user.id);
        setPlans(updatedPlans);

        return dailyPlan.items;
      }

      return [];
    } catch (err: any) {
      setError(
        err.message?.includes("429")
          ? "AI quota hit. Slow down brochacho ✌️"
          : "Failed to generate plan",
      );
      return [];
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

    const localId = await LocalDB.createMaterialLocally(
      user.id,
      title,
      rawContent,
      uri,
      type,
    );
    const updatedLocal = await LocalDB.getAllMaterials(user.id);
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
};
