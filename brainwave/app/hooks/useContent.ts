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
      currentPlans: any[],
    ) => {
      if (!user?.id || isSyncing.current) return;

      const dirtyMaterials = currentMaterials.filter((m) => m.is_dirty === 1);
      const dirtyTimetables = currentTimetables.filter((t) => t.is_dirty === 1);
      const dirtyAssignments = currentAssignments.filter(
        (a) => a.is_dirty === 1,
      );
      const dirtyPlans = currentPlans.filter((p) => p.is_dirty === 1);

      const totalToSync =
        dirtyMaterials.length +
        dirtyTimetables.length +
        dirtyAssignments.length +
        dirtyPlans.length;

      if (totalToSync === 0) return;

      isSyncing.current = true;
      setSyncProgress({ current: 0, total: totalToSync });
      let completed = 0;

      // ── MATERIALS ──────────────────────────────────────────────────────────
      for (const item of dirtyMaterials) {
        try {
          if (item.is_deleted === 1) {
            if (item.remote_id) {
              await BrainwaveAPI.deleteMaterial(user.id, item.remote_id);
            }
            LocalDB.hardDeleteMaterial(item.id);
            completed++;
            setSyncProgress({ current: completed, total: totalToSync });
            continue;
          }

          if (item.file_uri) {
            const result = await BrainwaveAPI.uploadSyllabus(
              user.id,
              item.file_uri,
              item.title,
              item.file_type || "application/pdf",
            );
            await LocalDB.markMaterialSynced(
              item.id,
              result.id,
              result.studyPlan,
            );
          } else {
            const result = await BrainwaveAPI.createMaterial(user.id, {
              title: item.title,
              rawContent: item.rawContent,
            });
            await LocalDB.markMaterialSynced(item.id, result.id);
          }

          completed++;
          setSyncProgress({ current: completed, total: totalToSync });
        } catch (e: any) {
          console.error(`Material Sync Failed [${item.title}]:`, e.message);
          if (e.response?.status >= 500) {
            LocalDB.hardDeleteMaterial(item.id);
          }
        }
      }

      // ── TIMETABLES ─────────────────────────────────────────────────────────
      for (const table of dirtyTimetables) {
        try {
          if (table.is_deleted === 1) {
            if (table.remote_id) {
              await BrainwaveAPI.deleteTimetable(user.id, table.remote_id);
            }
            LocalDB.hardDeleteTimetable(table.id);
            completed++;
            setSyncProgress({ current: completed, total: totalToSync });
            continue;
          }

          if (table.uri) {
            const result = await BrainwaveAPI.uploadTimetable(
              user.id,
              table.uri,
              table.title,
              table.type || "application/pdf",
            );
            await LocalDB.markTimetableSynced(
              table.id,
              result.id,
              table.weekly_template,
            );
          }

          completed++;
          setSyncProgress({ current: completed, total: totalToSync });
        } catch (e: any) {
          console.error(`Timetable Sync Failed [${table.title}]:`, e.message);
          if (e.response?.status >= 500) {
            LocalDB.hardDeleteTimetable(table.id);
          }
        }
      }

      // ── ASSIGNMENTS ────────────────────────────────────────────────────────
      for (const ass of dirtyAssignments) {
        try {
          if (ass.is_deleted === 1) {
            if (ass.remote_id) {
              await BrainwaveAPI.deleteAssignment(user.id, ass.remote_id);
            }
            LocalDB.hardDeleteAssignment(ass.id);
            completed++;
            setSyncProgress({ current: completed, total: totalToSync });
            continue;
          }

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
              rawContent: result.assignment.rawContent || ass.rawContent,
            });
          }

          completed++;
          setSyncProgress({ current: completed, total: totalToSync });
        } catch (e: any) {
          console.error(`Assignment Sync Failed [${ass.title}]:`, e.message);
          if (e.response?.status >= 500) {
            LocalDB.hardDeleteAssignment(ass.id);
          }
        }
      }

      // ── DAILY PLANS ────────────────────────────────────────────────────────
      for (const plan of dirtyPlans) {
        try {
          await BrainwaveAPI.saveDailyPlan(user.id, plan.date, plan.tasks);
          LocalDB.markPlanSynced(user.id, plan.date);
          completed++;
          setSyncProgress({ current: completed, total: totalToSync });
        } catch (e: any) {
          console.error(`Plan Sync Failed [${plan.date}]:`, e.message);
          // Stays dirty — retries on next reconnect
        }
      }

      setTimeout(() => setSyncProgress({ current: 0, total: 0 }), 2000);
      isSyncing.current = false;
      setSyncProgress({ current: 0, total: 0 });

      setMaterials(await LocalDB.getAllMaterials(user.id));
      setTimetables(await LocalDB.getAllTimetables(user.id));
      setAssignments(await LocalDB.getAllAssignments(user.id));
      setPlans(await LocalDB.getAllPlans(user.id));
    },
    [user?.id],
  );

  const fetchData = useCallback(
    async (force = false) => {
      if (!user?.id) return;

      // 1. Load local immediately for instant UI
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
        // 2. Push all dirty records (including plans) to backend first
        await syncDirtyRecords(
          localMaterials,
          localTimetables,
          localAssignments,
          localPlans,
        );

        // 3. Pull from backend if forced or 12hr cache expired
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
          if (remoteMaterials?.plans) {
            await LocalDB.syncMaterialsFromServer(
              user.id,
              remoteMaterials.plans,
            );
          }

          const remoteTimetables = await BrainwaveAPI.listTimetables(user.id);
          if (remoteTimetables?.timetables) {
            await LocalDB.syncTimetablesFromServer(
              user.id,
              remoteTimetables.timetables,
            );
          }

          const remoteAssignments = await BrainwaveAPI.listAssignments(user.id);
          if (remoteAssignments?.assignments) {
            await LocalDB.syncAssignmentsFromServer(
              user.id,
              remoteAssignments.assignments,
            );
          }

          await AsyncStorage.setItem("lastPlansSync", String(Date.now()));
        }

        // 4. Update app state after full sync
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

  // NetInfo listener — triggers sync on reconnect
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

    const existing = await LocalDB.getPlanByDate(user.id, date);
    if (existing) {
      console.log("Plan already exists locally, skipping AI");
      return existing.tasks;
    }

    setIsLoading(true);
    setError(null);

    try {
      const dailyPlan = await BrainwaveAPI.generateDailyPlan(
        user.id,
        date,
        preferences || {},
        customTasks || [],
        {},
      );

      if (dailyPlan?.items) {
        // Save locally as dirty first — backend push determines if it clears
        await LocalDB.upsertPlan(user.id, date, dailyPlan.items, true);

        // Try immediate backend push
        try {
          await BrainwaveAPI.saveDailyPlan(user.id, date, dailyPlan.items);
          // Success — mark clean
          LocalDB.markPlanSynced(user.id, date);
        } catch {
          // Stays dirty — syncDirtyRecords retries on reconnect
          console.warn("Plan saved locally as dirty, will sync on reconnect.");
        }

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
    setMaterials(await LocalDB.getAllMaterials(user.id));

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
      console.error(
        "Immediate cloud sync failed, will retry on reconnect: ",
        syncError.message,
      );
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
        console.error(
          "Immediate assignment sync failed, will retry on reconnect:",
          err,
        );
      }

      return localId;
    },

    deleteAssignment: async (id: string, remoteId?: number) => {
      if (!user?.id) return false;

      try {
        LocalDB.deleteAssignment(user.id, id);
        setAssignments(await LocalDB.getAllAssignments(user.id));

        if (remoteId) {
          await BrainwaveAPI.deleteAssignment(user.id, remoteId);
          LocalDB.hardDeleteAssignment(Number(id));
        }

        return true;
      } catch (e) {
        console.error("Error deleting assignment:", e);
        return true;
      }
    },

    deleteMaterial: async (id: string, remoteId?: number) => {
      if (!user?.id) return false;

      try {
        LocalDB.deleteMaterial(user.id, id);
        setMaterials(await LocalDB.getAllMaterials(user.id));

        if (remoteId) {
          await BrainwaveAPI.deleteMaterial(user.id, remoteId);
          LocalDB.hardDeleteMaterial(Number(id));
        }

        return true;
      } catch (e) {
        console.error("Error deleting material:", e);
        return true;
      }
    },

    deleteTimetable: async (id: string, remoteId?: number) => {
      if (!user?.id) return false;

      try {
        LocalDB.deleteTimetable(user.id, id);
        setTimetables(await LocalDB.getAllTimetables(user.id));

        if (remoteId) {
          await BrainwaveAPI.deleteTimetable(user.id, remoteId);
          LocalDB.hardDeleteTimetable(Number(id));
        }

        return true;
      } catch (e) {
        console.error("Error deleting timetable:", e);
        return true;
      }
    },
  };
};
