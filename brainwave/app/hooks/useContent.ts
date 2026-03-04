import { useState, useEffect, useCallback, useRef } from "react";
import { LocalDB } from "../database/localDb";
import BrainwaveAPI from "@/api/brAInwaveApi";
import { useAuth } from "../contexts/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

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
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const isSyncing = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const syncDirtyRecords = useCallback(
    async (
      currentMaterials: any[],
      currentTimetables: any[],
      currentAssignments: any[],
    ) => {
      if (!user?.id || isSyncing.current) return;

      const dirtyMaterials = currentMaterials.filter((m) => m.is_dirty === 1);
      const dirtyTimetables = currentTimetables.filter((t) => t.is_dirty === 1);
      const dirtyAssignments = currentAssignments.filter(
        (a) => a.is_dirty === 1,
      );

      const totalToSync =
        dirtyMaterials.length +
        dirtyTimetables.length +
        dirtyAssignments.length;
      if (totalToSync === 0) return;

      isSyncing.current = true;
      setSyncProgress({ current: 0, total: totalToSync });
      let completed = 0;

      //each file is wapped individually so the loop continues when one fails
      for (const item of dirtyMaterials) {
        try {
          if (item.uri) {
            const result = await BrainwaveAPI.uploadSyllabus(
              user.id,
              item.uri,
              item.title,
              item.type,
            );
            const cloudId = result.id;
            await LocalDB.markMaterialSynced(
              item.id,
              cloudId,
              result.studyPlan,
            );

            completed++;
            setSyncProgress({ current: completed, total: totalToSync });
          }
        } catch (e: any) {
          // Individual error: This file failed, but the loop continues!
          console.error(`Syllabus Sync Failed [${item.title}]:`, e.message);
          if (e.response && e.response.status >= 500) {
            console.log(
              `Deleting failed syllabus [${item.title}] to prevent retry loop.`,
            );
            LocalDB.deleteMaterial(user.id, item.id);
          }
        }
      }

      // Sync Timetables - Wrapped individually
      for (const table of dirtyTimetables) {
        try {
          if (table.uri) {
            const result = await BrainwaveAPI.uploadTimetable(
              user.id,
              table.uri,
              table.title,
              table.type || "application/pdf",
            );

            const cloudId = result.id;
            await LocalDB.markTimetableSynced(
              table.id,
              cloudId,
              table.weekly_template,
            );
          }
        } catch (e: any) {
          console.error(`Timetable Sync Failed [${table.title}]:`, e.message);
          if (e.response && e.response.status >= 500) {
            console.log(
              `Deleting failed timetable [${table.title}] to prevent retry loop.`,
            );
            LocalDB.deleteTimetable(user.id, table.id);
          }
        }
      }

      // Sync Assignments - Wrapped individually
      for (const ass of dirtyAssignments) {
        try {
          if (ass.file_uri) {
            const result = await BrainwaveAPI.uploadAssignment(
              user.id,
              ass.file_uri,
              ass.title,
              ass.file_type || "application/pdf",
            );

            await LocalDB.markAssignmentSynced(ass.id, result.id, {
              title: result.assignment.title,
              subject: result.assignment.subject,
              due_date: result.assignment.due_date,
              priority: result.assignment.priority,
              rawContent: result.assignment.rawContent || ass.rawContent, // Fallback if backend doesnt return it in the meta object
            });
            completed++;
            setSyncProgress({ current: completed, total: totalToSync });
          }
        } catch (e: any) {
          console.error(`Assignment Sync Failed [${ass.title}]:`, e.message);
          if (e.response && e.response.status >= 500) {
            console.log(
              `Deleting failed assignment [${ass.title}] to prevent retry loop.`,
            );
            LocalDB.deleteAssignment(user.id, ass.id);
          }
        }
      }

      setTimeout(() => setSyncProgress({ current: 0, total: 0 }), 2000);

      isSyncing.current = false;
      setSyncProgress({ current: 0, total: 0 });

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
      const localAssignments = await LocalDB.getAllAssignments(user.id);

      setMaterials(localMaterials);
      setTimetables(localTimetables);
      setPlans(localPlans);
      setAssignments(localAssignments);

      setIsLoading(true);
      setError(null);

      try {
        // 2. sync dirty records in background
        await syncDirtyRecords(
          localMaterials,
          localTimetables,
          localAssignments,
        );

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
          }

          const remoteMaterials = await BrainwaveAPI.listStudyPlans(user.id);
          if (remoteMaterials?.studyPlans) {
            LocalDB.syncMaterialsFromServer(
              user.id,
              remoteMaterials.studyPlans,
            );
          }

          const remoteTimetables = await BrainwaveAPI.listTimetables(user.id);
          if (remoteTimetables?.timetables) {
            LocalDB.syncTimetablesFromServer(
              user.id,
              remoteTimetables.timetables,
            );
          }

          const remoteAssignments = await BrainwaveAPI.listAssignments(user.id);
          if (remoteAssignments?.assignments) {
            LocalDB.syncAssignmentsFromServer(
              user.id,
              remoteAssignments.assignments,
            );
          }

          await AsyncStorage.setItem("lastPlansSync", String(Date.now()));
        }

        // 4. update app state after full sync
        setMaterials(await LocalDB.getAllMaterials(user.id));
        setTimetables(await LocalDB.getAllTimetables(user.id));
        setPlans(await LocalDB.getAllPlans(user.id));
        setAssignments(await LocalDB.getAllAssignments(user.id));
      } catch (err: any) {
        console.log("Fetch Error: ", err.message);
        setError("Failed to sync with cloud.");
      } finally {
        setIsLoading(false);
      }
    },
    [user?.id, syncDirtyRecords],
  );

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (
        state.isConnected &&
        state.isInternetReachable &&
        !isSyncing.current
      ) {
        console.log("Network reconnected, attempting sync...");
        fetchData();
      }
    });

    return () => unsubscribe();
  }, [user?.id, fetchData]);

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
        {},
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

    try {
      if (uri) {
        const result = await BrainwaveAPI.uploadSyllabus(
          user.id,
          uri,
          title,
          type || "application/pdf",
        );

        console.log("Cloud sync success: ", result.id);
        await LocalDB.markMaterialSynced(localId, result.id, result.studyPlan);

        setMaterials(await LocalDB.getAllMaterials(user.id));
      }
    } catch (syncError: any) {
      console.error("Cloud sync failed directly: ", syncError.message);
    }

    return localId;
  };

  return {
    materials,
    timetables,
    syncProgress,
    plans,
    assignments,
    isLoading,
    error,
    refresh: fetchData,
    generatePlanForDate,
    createMaterial,
    createAssignment: async (title: string, uri: string, type: string) => {
      if (!user?.id) return null;
      const localId = await LocalDB.createAssignmentLocally(
        user.id,
        title,
        "Analyzing...",
        "Pending",
        "medium",
        "brAInwave is analyzing your assignment...",
        uri,
        type,
      );
      setAssignments(await LocalDB.getAllAssignments(user.id));

      // Try immediate sync
      try {
        const result = await BrainwaveAPI.uploadAssignment(
          user.id,
          uri,
          title,
          type,
        );
        await LocalDB.markAssignmentSynced(localId, result.id, {
          title: result.assignment.title,
          subject: result.assignment.subject,
          due_date: result.assignment.due_date,
          priority: result.assignment.priority,
          rawContent: result.assignment.rawContent || "",
        });
        setAssignments(await LocalDB.getAllAssignments(user.id));
      } catch (err) {
        console.error("Immediate assignment sync failed:", err);
      }
      return localId;
    },
    deleteAssignment: async (id: string, remoteId?: number) => {
      if (!user?.id) return false;

      try {
        // Delete locally first
        LocalDB.deleteAssignment(user.id, id);

        // Update state
        setAssignments(await LocalDB.getAllAssignments(user.id));

        // If it was already synced to the cloud, delete it there too
        if (remoteId) {
          await BrainwaveAPI.deleteAssignment(user.id, remoteId);
        }
        return true;
      } catch (e) {
        console.error("Error deleting assignment:", e);
        return false;
      }
    },
  };
};
