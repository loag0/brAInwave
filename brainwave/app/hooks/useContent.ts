import { useState, useEffect, useCallback, useRef } from "react";
import { LocalDB } from "../database/localDb";
import BrainwaveAPI from "@/api/brAInwaveApi";
import { useAuth } from "../contexts/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import Toast from "react-native-toast-message";

export interface StudyPlan {
  id: string;
  date: string;
  tasks: any[];
  [key: string]: any;
}

const log = (msg: string, data?: any) => {
  if (__DEV__) {
    if (data) console.log(`[Sync] ${msg}`, data);
    else console.log(`[Sync] ${msg}`);
  }
};

const isOnline = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return !!(state.isConnected && state.isInternetReachable);
};

const ONE_HOUR = 1000 * 60 * 60;

// Per-resource cache keys so a stale assignment doesn't block a fresh material pull
const SYNC_KEYS = {
  materials: "lastSync_materials",
  timetables: "lastSync_timetables",
  assignments: "lastSync_assignments",
  plans: "lastSync_plans",
  goals: "lastSync_goals",
  logs: "lastSync_logs",
};

export const useContent = () => {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<any[]>([]);
  const [timetables, setTimetables] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // True only until the first local DB read completes — gates the initial skeleton/spinner.
  // Background server sync after that is silent; it does NOT reset this flag.
  const [isInitializing, setIsInitializing] = useState(true);
  const [isOnlineStatus, setIsOnlineStatus] = useState<boolean | null>(null);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const isSyncing = useRef(false);
  const lastErrorToast = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Connectivity status listener
  useEffect(() => {
    NetInfo.fetch().then((state) => {
      const online = !!(state.isConnected && state.isInternetReachable);
      setIsOnlineStatus(online);
      log(online ? "Online" : "Offline");
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!(state.isConnected && state.isInternetReachable);
      setIsOnlineStatus((prev) => {
        if (prev !== online) log(online ? "Back online" : "Gone offline");
        return online;
      });
    });

    return () => unsubscribe();
  }, []);

  // Reads dirty records directly from the DB and pushes them to the backend.
  const syncDirtyRecords = useCallback(async () => {
    if (!user?.id || isSyncing.current) return;

    const online = await isOnline();
    if (!online) {
      log("Skipping sync - offline");
      return;
    }

    const dirtyMaterials = LocalDB.getDirtyMaterials(user.id);
    const dirtyTimetables = LocalDB.getDirtyTimetables(user.id);
    const dirtyAssignments = LocalDB.getDirtyAssignments(user.id);
    const dirtyPlans = LocalDB.getDirtyPlans(user.id);
    const dirtyLogs = LocalDB.getDirtyCompletionLogs(user.id);
    const dirtyModuleGoals = LocalDB.getDirtyModuleGoals(user.id);

    const totalToSync =
      dirtyMaterials.length +
      dirtyTimetables.length +
      dirtyAssignments.length +
      dirtyPlans.length +
      dirtyLogs.length +
      dirtyModuleGoals.length;

    if (totalToSync === 0) {
      log("Nothing dirty to sync");
      return;
    }

    log(`Starting sync - ${totalToSync} record(s) to push`, {
      materials: dirtyMaterials.length,
      timetables: dirtyTimetables.length,
      assignments: dirtyAssignments.length,
      plans: dirtyPlans.length,
    });

    isSyncing.current = true;
    setSyncProgress({ current: 0, total: totalToSync });
    let completed = 0;

    // --- Study materials ---
    for (const item of dirtyMaterials) {
      try {
        if (item.is_deleted === 1) {
          if (item.remote_id) await BrainwaveAPI.deleteMaterial(user.id, item.remote_id);
          LocalDB.hardDeleteMaterial(item.id);
          log(`Material deleted: ${item.title}`);
        } else if (item.remote_id) {
          // already on server — just patch the module tag, don't re-upload
          await BrainwaveAPI.updateMaterialModuleTag(item.remote_id, item.module_tag ?? null);
          await LocalDB.markMaterialSynced(item.id, item.remote_id, undefined, item.module_tag ?? null);
          log(`Material module tag patched: ${item.title}`);
        } else if (item.file_uri) {
          const result = await BrainwaveAPI.uploadSyllabus(
            user.id, item.file_uri, item.title, item.file_type || "application/pdf",
          );
          await LocalDB.markMaterialSynced(item.id, result.id, result.studyPlan, result.module_tag ?? null);
          log(`Syllabus synced: ${item.title} → ${result.id}`);
        } else {
          const result = await BrainwaveAPI.createMaterial(user.id, {
            title: item.title, rawContent: item.rawContent,
          });
          await LocalDB.markMaterialSynced(item.id, result.id, undefined, item.module_tag ?? null);
          log(`Text material synced: ${item.title} → ${result.id}`);
        }
        completed++;
        setSyncProgress({ current: completed, total: totalToSync });
      } catch (e: any) {
        log(`Material sync failed [${item.title}]: ${e.message}`);
        if (e.response?.status >= 500) LocalDB.hardDeleteMaterial(item.id);
      }
    }

    // --- Timetables ---
    for (const table of dirtyTimetables) {
      try {
        if (table.is_deleted === 1) {
          if (table.remote_id) await BrainwaveAPI.deleteTimetable(user.id, table.remote_id);
          LocalDB.hardDeleteTimetable(table.id);
          log(`Timetable deleted: ${table.title}`);
        } else if (table.uri) {
          const result = await BrainwaveAPI.uploadTimetable(
            user.id, table.uri, table.title, table.type || "application/pdf",
          );
          await LocalDB.markTimetableSynced(table.id, result.id, result.weekly_template);
          log(`Timetable synced: ${table.title} → ${result.id}`);
        } else {
          const result = await BrainwaveAPI.syncTimetable(user.id, table.title, table.structuredData);
          await LocalDB.markTimetableSynced(table.id, result.id);
          log(`Manual timetable synced: ${table.title} → ${result.id}`);
        }
        completed++;
        setSyncProgress({ current: completed, total: totalToSync });
      } catch (e: any) {
        log(`Timetable sync failed [${table.title}]: ${e.message}`);
        if (e.response?.status >= 500) LocalDB.hardDeleteTimetable(table.id);
      }
    }

    // --- Assignments ---
    for (const ass of dirtyAssignments) {
      try {
        if (ass.is_deleted === 1) {
          if (ass.remote_id) await BrainwaveAPI.deleteAssignment(user.id, ass.remote_id);
          LocalDB.hardDeleteAssignment(ass.id);
          log(`Assignment deleted: ${ass.title}`);
        } else if (ass.file_uri) {
          // Handles both fresh uploads and assignments queued offline (pending_extraction=1)
          const result = await BrainwaveAPI.uploadAssignment(user.id, ass.file_uri, ass.title, ass.file_type);
          await LocalDB.markAssignmentSynced(ass.id, result.id, {
            title: result.assignment.title,
            subject: result.assignment.subject,
            due_date: result.assignment.due_date,
            due_time: result.assignment.due_time,
            priority: result.assignment.priority,
            rawContent: result.assignment.rawContent || ass.rawContent,
          });
          log(`Assignment synced: ${ass.title} → ${result.id}`);
        } else if (ass.remote_id) {
          // Due-date edit with no file — patch the server record
          await BrainwaveAPI.updateAssignmentDueDate(ass.remote_id, ass.due_date, ass.due_time);
          LocalDB.markAssignmentSynced(ass.id, ass.remote_id);
          log(`Assignment due date patched: ${ass.title}`);
        }
        completed++;
        setSyncProgress({ current: completed, total: totalToSync });
      } catch (e: any) {
        log(`Assignment sync failed [${ass.title}]: ${e.message}`);
        if (e.response?.status >= 500) LocalDB.hardDeleteAssignment(ass.id);
      }
    }

    // --- Daily plans ---
    for (const plan of dirtyPlans) {
      try {
        await BrainwaveAPI.saveDailyPlan(user.id, plan.date, plan.tasks);
        LocalDB.markPlanSynced(user.id, plan.date);
        log(`Plan synced: ${plan.date}`);
        completed++;
        setSyncProgress({ current: completed, total: totalToSync });
      } catch (e: any) {
        log(`Plan sync failed [${plan.date}]: ${e.message}`);
        // Stays dirty — retries on next reconnect
      }
    }

    // --- Completion logs ---
    if (dirtyLogs.length > 0) {
      try {
        await BrainwaveAPI.syncCompletionLogs(
          dirtyLogs.map((l) => ({
            date: l.date,
            minutes_studied: l.minutes_studied,
            module_tag: l.module_tag,
          })),
        );
        LocalDB.markCompletionLogsSynced(user.id, dirtyLogs.map((l) => l.id));
        completed += dirtyLogs.length;
        setSyncProgress({ current: completed, total: totalToSync });
        log("Completion logs synced");
      } catch (e: any) {
        log(`Completion logs sync failed: ${e.message}`);
      }
    }

    // --- Module goals ---
    if (dirtyModuleGoals.length > 0) {
      try {
        await BrainwaveAPI.syncModuleGoals(
          dirtyModuleGoals.map((g) => ({
            module_tag: g.module_tag,
            weekly_goal_minutes: g.weekly_goal_minutes,
          })),
        );
        LocalDB.markModuleGoalsSynced(user.id);
        completed++;
        setSyncProgress({ current: completed, total: totalToSync });
        log("Module goals synced");
      } catch (e: any) {
        log(`Module goals sync failed: ${e.message}`);
      }
    }

    log(`Sync complete - ${completed}/${totalToSync} succeeded`);
    setTimeout(() => setSyncProgress({ current: 0, total: 0 }), 2000);
    isSyncing.current = false;

    // Refresh state from local DB after sync
    setMaterials(await LocalDB.getAllMaterials(user.id));
    setTimetables(await LocalDB.getAllTimetables(user.id));
    setAssignments(await LocalDB.getAllAssignments(user.id));
    setPlans(await LocalDB.getAllPlans(user.id));
  }, [user?.id]);

  // Local-first fetch: renders immediately from SQLite, then syncs + pulls from server in background.
  const fetchData = useCallback(
    async (force = false) => {
      if (!user?.id) return;

      // Step 1: Load local DB immediately — UI renders with whatever is cached.
      // isInitializing goes false here so the skeleton/spinner clears as soon as we have data.
      const localMaterials = await LocalDB.getAllMaterials(user.id);
      const localTimetables = await LocalDB.getAllTimetables(user.id);
      const localPlans = await LocalDB.getAllPlans(user.id);
      const localAssignments = await LocalDB.getAllAssignments(user.id);

      setMaterials(localMaterials);
      setTimetables(localTimetables);
      setPlans(localPlans);
      setAssignments(localAssignments);
      setIsInitializing(false);

      setIsLoading(true);
      setError(null);

      try {
        const online = await isOnline();
        if (!online) {
          log("Offline - showing local data only");
          return;
        }

        // Step 2: Push any dirty local changes before pulling.
        await syncDirtyRecords();

        // Step 3: Pull each resource independently based on its own cache timestamp.
        // This means a fresh assignment pull doesn't re-pull materials that are still fresh.
        const now = Date.now();
        const [lastMat, lastTT, lastAss, lastPlan, lastGoals, lastLogs] = await Promise.all([
          AsyncStorage.getItem(SYNC_KEYS.materials),
          AsyncStorage.getItem(SYNC_KEYS.timetables),
          AsyncStorage.getItem(SYNC_KEYS.assignments),
          AsyncStorage.getItem(SYNC_KEYS.plans),
          AsyncStorage.getItem(SYNC_KEYS.goals),
          AsyncStorage.getItem(SYNC_KEYS.logs),
        ]);

        const stale = (ts: string | null) => force || !ts || now - Number(ts) > ONE_HOUR;

        if (stale(lastMat)) {
          const r = await BrainwaveAPI.listStudyPlans(user.id);
          if (r?.plans) {
            await LocalDB.syncMaterialsFromServer(user.id, r.plans);
            await AsyncStorage.setItem(SYNC_KEYS.materials, String(now));
            log(`Pulled ${r.plans.length} materials`);
          }
        }

        if (stale(lastTT)) {
          const r = await BrainwaveAPI.listTimetables(user.id);
          if (r?.timetables) {
            await LocalDB.syncTimetablesFromServer(user.id, r.timetables);
            await AsyncStorage.setItem(SYNC_KEYS.timetables, String(now));
            log(`Pulled ${r.timetables.length} timetables`);
          }
        }

        if (stale(lastAss)) {
          const r = await BrainwaveAPI.listAssignments(user.id);
          if (r?.assignments) {
            await LocalDB.syncAssignmentsFromServer(user.id, r.assignments);
            await AsyncStorage.setItem(SYNC_KEYS.assignments, String(now));
            log(`Pulled ${r.assignments.length} assignments`);
          }
        }

        if (stale(lastPlan)) {
          const r = await BrainwaveAPI.listDailyPlans(user.id);
          if (r?.plans) {
            LocalDB.syncPlansFromServer(user.id, r.plans);
            await AsyncStorage.setItem(SYNC_KEYS.plans, String(now));
            log(`Pulled ${r.plans.length} plans`);
          }
        }

        if (stale(lastGoals)) {
          const r = await BrainwaveAPI.getModuleGoals();
          if (r?.goals) {
            LocalDB.syncModuleGoalsFromServer(user.id, r.goals);
            await AsyncStorage.setItem(SYNC_KEYS.goals, String(now));
            log(`Pulled ${r.goals.length} module goals`);
          }
        }

        if (stale(lastLogs)) {
          const r = await BrainwaveAPI.getCompletionLogs();
          if (r?.logs) {
            LocalDB.syncCompletionLogsFromServer(user.id, r.logs);
            await AsyncStorage.setItem(SYNC_KEYS.logs, String(now));
            log(`Pulled ${r.logs.length} completion logs`);
          }
        }

        // Step 4: Update state after all pulls complete
        setMaterials(await LocalDB.getAllMaterials(user.id));
        setTimetables(await LocalDB.getAllTimetables(user.id));
        setPlans(await LocalDB.getAllPlans(user.id));
        setAssignments(await LocalDB.getAllAssignments(user.id));

        log("fetchData complete");
      } catch (err: any) {
        log(`fetchData error: ${err.message}`);
        setError("Failed to sync with cloud.");
        const now = Date.now();
        if (now - lastErrorToast.current > 30000) {
          lastErrorToast.current = now;
          Toast.show({
            type: "error",
            text1: "Couldn't reach the server",
            text2: "Showing local data. Check your connection.",
            position: "bottom",
            visibilityTime: 4000,
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [user?.id, syncDirtyRecords],
  );

  // Reconnect listener — debounced 3s to avoid multiple syncs on flaky wifi.
  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!(state.isConnected && state.isInternetReachable);
      if (online) {
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        reconnectTimer.current = setTimeout(() => {
          if (!isSyncing.current) fetchData();
        }, 3000);
      }
    });

    return () => {
      unsubscribe();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [user?.id, fetchData]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Create new material (syllabus upload or text note)
  const createMaterial = async (
    title: string,
    rawContent: string,
    uri?: string,
    type?: string,
  ) => {
    if (!user?.id) return null;

    log(`Creating material locally: ${title}`);
    const localId = await LocalDB.createMaterialLocally(user.id, title, rawContent, uri, type);
    setMaterials(await LocalDB.getAllMaterials(user.id));

    const online = await isOnline();
    if (!online) {
      log(`Offline - material saved locally, will sync later: ${title}`);
      return localId;
    }

    try {
      if (uri) {
        log(`Immediate upload: ${title}`);
        const result = await BrainwaveAPI.uploadSyllabus(user.id, uri, title, type || "application/pdf");
        await LocalDB.markMaterialSynced(localId, result.id, result.studyPlan, result.module_tag ?? null);
        setMaterials(await LocalDB.getAllMaterials(user.id));
        log(`Material uploaded: ${title} → ${result.id}`);
      }
    } catch (syncError: any) {
      log(`Immediate upload failed, will retry on reconnect: ${syncError.message}`);
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
    isInitializing,
    isOnline: isOnlineStatus,
    error,
    refresh: fetchData,
    generatePlanForDate,
    createMaterial,

    // Write locally first, upload when online. If offline, queued with pending_extraction=1
    // and processed automatically when the device reconnects.
    createAssignment: async (title: string, uri: string, type: string) => {
      if (!user?.id) return null;

      const localId = LocalDB.createAssignmentLocally(
        user.id,
        title,
        "",         // subject — filled by server extraction
        "",         // due_date — filled by server extraction
        "medium",   // priority — placeholder
        "",         // rawContent — filled by server extraction
        uri,
        type,
        true,       // pendingExtraction = true until server processes it
      );
      setAssignments(await LocalDB.getAllAssignments(user.id));

      const online = await isOnline();
      if (!online) {
        log(`Offline - assignment queued locally: ${title}`);
        return localId;
      }

      try {
        log(`Uploading assignment: ${title}`);
        const result = await BrainwaveAPI.uploadAssignment(user.id, uri, title, type);
        LocalDB.markAssignmentSynced(localId, result.id, {
          title: result.assignment.title,
          subject: result.assignment.subject,
          due_date: result.assignment.due_date,
          due_time: result.assignment.due_time,
          priority: result.assignment.priority,
          rawContent: result.assignment.rawContent || "",
        });
        setAssignments(await LocalDB.getAllAssignments(user.id));
        log(`Assignment uploaded and saved: ${title} → remote id ${result.id}`);
        return localId;
      } catch (syncError: any) {
        log(`Assignment upload failed, queued for retry: ${syncError.message}`);
        return localId;
      }
    },

    deleteAssignment: async (id: string, remoteId?: number) => {
      if (!user?.id) return false;
      try {
        LocalDB.deleteAssignment(user.id, id);
        setAssignments(await LocalDB.getAllAssignments(user.id));
        log(`Assignment soft deleted locally: id ${id}`);

        const online = await isOnline();
        if (online && remoteId) {
          await BrainwaveAPI.deleteAssignment(user.id, remoteId);
          LocalDB.hardDeleteAssignment(Number(id));
          log(`Assignment hard deleted from server: remote id ${remoteId}`);
        }
        return true;
      } catch (e: any) {
        log(`Delete assignment error: ${e.message}`);
        return true;
      }
    },

    deleteMaterial: async (id: string, remoteId?: number) => {
      if (!user?.id) return false;
      try {
        LocalDB.deleteMaterial(user.id, id);
        setMaterials(await LocalDB.getAllMaterials(user.id));
        log(`Material soft deleted locally: id ${id}`);

        const online = await isOnline();
        if (online && remoteId) {
          await BrainwaveAPI.deleteMaterial(user.id, remoteId);
          LocalDB.hardDeleteMaterial(Number(id));
          log(`Material hard deleted from server: remote id ${remoteId}`);
        }
        return true;
      } catch (e: any) {
        log(`Delete material error: ${e.message}`);
        return true;
      }
    },

    deleteTimetable: async (id: string, remoteId?: number) => {
      if (!user?.id) return false;
      try {
        LocalDB.deleteTimetable(user.id, id);
        setTimetables(await LocalDB.getAllTimetables(user.id));
        log(`Timetable soft deleted locally: id ${id}`);

        const online = await isOnline();
        if (online && remoteId) {
          await BrainwaveAPI.deleteTimetable(user.id, remoteId);
          LocalDB.hardDeleteTimetable(Number(id));
          log(`Timetable hard deleted from server: remote id ${remoteId}`);
        }
        return true;
      } catch (e: any) {
        log(`Delete timetable error: ${e.message}`);
        return true;
      }
    },
  };

  // Generate AI study plan for a specific date
  async function generatePlanForDate(
    date: string,
    preferences?: any,
    customTasks?: any[],
  ) {
    if (!user?.id) return [];

    const existing = await LocalDB.getPlanByDate(user.id, date);
    if (existing) {
      log(`Plan already exists locally for ${date}, skipping AI`);
      return existing.tasks;
    }

    setIsLoading(true);
    setError(null);

    try {
      log(`Generating AI plan for ${date}...`);
      const dailyPlan = await BrainwaveAPI.generateDailyPlan(
        user.id,
        date,
        preferences || {},
        customTasks || [],
        {},
      );

      if (dailyPlan?.items) {
        await LocalDB.upsertPlan(user.id, date, dailyPlan.items, true);
        log(`Plan saved locally as dirty for ${date}`);

        try {
          await BrainwaveAPI.saveDailyPlan(user.id, date, dailyPlan.items);
          LocalDB.markPlanSynced(user.id, date);
          log(`Plan pushed to server and marked clean for ${date}`);
        } catch {
          log(`Plan push failed - stays dirty, will retry on reconnect: ${date}`);
        }

        const updatedPlans = await LocalDB.getAllPlans(user.id);
        setPlans(updatedPlans);
        return dailyPlan.items;
      }

      return [];
    } catch (err: any) {
      log(`generatePlanForDate error: ${err.message}`);
      setError(
        err.message?.includes("429")
          ? "AI quota hit. Slow down brochacho ✌️"
          : "Failed to generate plan",
      );
      return [];
    } finally {
      setIsLoading(false);
    }
  }
};
