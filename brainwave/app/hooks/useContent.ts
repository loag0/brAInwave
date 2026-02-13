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
  const [syncProgress, setSyncProgress] = useState({current: 0, total: 0});
  const [error, setError] = useState<string | null>(null);

  const syncDirtyRecords = useCallback(
    async (currentMaterials: any[], currentTimetables: any[]) => {
      if (!user?.id) return;

      const dirtyMaterials = currentMaterials.filter((m) => m.is_dirty === 1);
      const dirtyTimetables = currentTimetables.filter((t) => t.is_dirty === 1);

      const totalToSync = dirtyMaterials.length + dirtyTimetables.length;
      if (totalToSync === 0) return;

      setSyncProgress({current: 0, total: totalToSync});
      let completed = 0;

      //each file is wapped individually so the loop continues when one fails
      for (const item of dirtyMaterials) {
        try {
          if (item.uri) {
            await BrainwaveAPI.uploadSyllabus(
              user.id,
              item.uri,
              item.title,
              item.type,
            );
            await LocalDB.markMaterialSynced(item.id, item.id);

            completed++;
            setSyncProgress({current: completed, total: totalToSync});
          }
        } catch (e: any) {
          // Individual error: This file failed, but the loop continues!
          console.error(`Syllabus Sync Failed [${item.title}]:`, e.message);
        }
      }

      // Sync Timetables - Wrapped individually
      for (const table of dirtyTimetables) {
        try {
          if (table.uri) {
            await BrainwaveAPI.uploadTimetable(
              user.id,
              table.uri,
              table.title,
              table.type || "application/pdf",
            );
            await LocalDB.markTimetableSynced(table.id, table.id, table.weely_template);
          }
        } catch (e: any) {
          console.error(`Timetable Sync Failed [${table.title}]:`, e.message);
        }
      }

      setTimeout(() => setSyncProgress({current: 0, total: 0}), 2000);

      setMaterials(await LocalDB.getAllMaterials(user.id));
      setTimetables(await LocalDB.getAllTimetables(user.id));
    },
    [user?.id],
  );

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
      // generate from AI (only if no local plan)
      const dailyPlan = await BrainwaveAPI.generateDailyPlan(
        user.id,
        date,
        preferences || {},
        customTasks || [],
      );

      if (dailyPlan?.items) {
        // Upsert just this date into the local DB instead of nuking all plans type shi
        await LocalDB.upsertPlan(user.id, date, dailyPlan.items);

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

    console.log("Saving to Local SQLite...");
    const localId = await LocalDB.createMaterialLocally(
      user.id,
      title,
      rawContent,
      uri,
      type,
    );
    const updatedLocal = await LocalDB.getAllMaterials(user.id);
    setMaterials(updatedLocal);

    console.log("Attempting immediate cloud sync for: ", title);

    try{
      if(uri){
        const result = await BrainwaveAPI.uploadSyllabus(
          user.id,
          uri,
          title,
          type || "application/pdf"
        );

        console.log("Cloud sync success: ", result.id);
        await LocalDB.markMaterialSynced(localId, result.id);

        setMaterials(await LocalDB.getAllMaterials(user.id));
      }
    } catch(syncError: any){
      console.error("Cloud sync failed directly: ", syncError.message);
    }

    return localId;
  };

  return {
    materials,
    timetables,
    syncProgress,
    plans,
    isLoading,
    error,
    refresh: fetchData,
    generatePlanForDate,
    createMaterial,
  };
};
