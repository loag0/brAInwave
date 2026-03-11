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

const log = (emoji: string, msg: string, data?: any) => {
  if (__DEV__) {
    if (data) console.log(`${emoji} [Sync] ${msg}`, data);
    else console.log(`${emoji} [Sync] ${msg}`);
  }
};

const isOnline = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return !!(state.isConnected && state.isInternetReachable);
};

export const useContent = () => {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<any[]>([]);
  const [timetables, setTimetables] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOnlineStatus, setIsOnlineStatus] = useState<boolean | null>(null);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const isSyncing = useRef(false);
  const [error, setError] = useState<string | null>(null);

  //checks connectivity on mount
  useEffect(() => {
    // Set initial status
    NetInfo.fetch().then((state) => {
      const online = !!(state.isConnected && state.isInternetReachable);
      setIsOnlineStatus(online);
      log(online ? "🟢" : "🔴", online ? "Online" : "Offline");
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!(state.isConnected && state.isInternetReachable);
      setIsOnlineStatus((prev) => {
        if (prev !== online) {
          log(online ? "🟢" : "🔴", online ? "Back online" : "Gone offline");
        }
        return online;
      });
    });

    return () => unsubscribe();
  }, []);

  // Sync dirty records to backend
  const syncDirtyRecords = useCallback(
    async (
      currentMaterials: any[],
      currentTimetables: any[],
      currentAssignments: any[],
      currentPlans: any[],
    ) => {
      if (!user?.id || isSyncing.current) return;

      const online = await isOnline();
      if (!online) {
        log("🔴", "Skipping sync — offline");
        return;
      }

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

      if (totalToSync === 0) {
        log("✅", "Nothing dirty to sync");
        return;
      }

      log("🔄", `Starting sync — ${totalToSync} record(s) to push`, {
        materials: dirtyMaterials.length,
        timetables: dirtyTimetables.length,
        assignments: dirtyAssignments.length,
        plans: dirtyPlans.length,
      });

      isSyncing.current = true;
      setSyncProgress({ current: 0, total: totalToSync });
      let completed = 0;

      // study materials, including syllabi and text notes
      for (const item of dirtyMaterials) {
        try {
          if (item.is_deleted === 1) {
            log("🗑️", `Deleting material: ${item.title}`);
            if (item.remote_id) {
              await BrainwaveAPI.deleteMaterial(user.id, item.remote_id);
            }
            LocalDB.hardDeleteMaterial(item.id);
            log("✅", `Material deleted: ${item.title}`);
          } else if (item.file_uri) {
            log("⬆️", `Uploading syllabus: ${item.title}`);
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
            log(
              "✅",
              `Syllabus synced: ${item.title} → remote id ${result.id}`,
            );
          } else {
            log("⬆️", `Syncing text material: ${item.title}`);
            const result = await BrainwaveAPI.createMaterial(user.id, {
              title: item.title,
              rawContent: item.rawContent,
            });
            await LocalDB.markMaterialSynced(item.id, result.id);
            log(
              "✅",
              `Text material synced: ${item.title} → remote id ${result.id}`,
            );
          }

          completed++;
          setSyncProgress({ current: completed, total: totalToSync });
        } catch (e: any) {
          log("❌", `Material sync failed [${item.title}]: ${e.message}`);
          // Only hard delete on definitive server error (5xx), leave alone otherwise
          if (e.response?.status >= 500) {
            log("🗑️", `Hard deleting failed material after 5xx: ${item.title}`);
            LocalDB.hardDeleteMaterial(item.id);
          }
        }
      }

      // timetables
      for (const table of dirtyTimetables) {
        try {
          if (table.is_deleted === 1) {
            log("🗑️", `Deleting timetable: ${table.title}`);
            if (table.remote_id) {
              await BrainwaveAPI.deleteTimetable(user.id, table.remote_id);
            }
            LocalDB.hardDeleteTimetable(table.id);
            log("✅", `Timetable deleted: ${table.title}`);
          } else if (table.uri) {
            log("⬆️", `Uploading timetable: ${table.title}`);
            const result = await BrainwaveAPI.uploadTimetable(
              user.id,
              table.uri,
              table.title,
              table.type || "application/pdf",
            );
            await LocalDB.markTimetableSynced(
              table.id,
              result.id,
              result.weekly_template,
            );
            log(
              "✅",
              `Timetable synced: ${table.title} → remote id ${result.id}`,
            );
          } else {
            // Timetable exists locally but has no file: so manually created
            log("⬆️", `Syncing manual timetable: ${table.title}`);
            const result = await BrainwaveAPI.syncTimetable(
              user.id,
              table.title,
              table.structuredData,
            );
            await LocalDB.markTimetableSynced(table.id, result.id);
            log(
              "✅",
              `Manual timetable synced: ${table.title} → remote id ${result.id}`,
            );
          }

          completed++;
          setSyncProgress({ current: completed, total: totalToSync });
        } catch (e: any) {
          log("❌", `Timetable sync failed [${table.title}]: ${e.message}`);
          if (e.response?.status >= 500) {
            log(
              "🗑️",
              `Hard deleting failed timetable after 5xx: ${table.title}`,
            );
            LocalDB.hardDeleteTimetable(table.id);
          }
        }
      }

      // assignments
      for (const ass of dirtyAssignments) {
        try {
          if (ass.is_deleted === 1) {
            log("🗑️", `Deleting assignment: ${ass.title}`);
            if (ass.remote_id) {
              await BrainwaveAPI.deleteAssignment(user.id, ass.remote_id);
            }
            LocalDB.hardDeleteAssignment(ass.id);
            log("✅", `Assignment deleted: ${ass.title}`);
          } else if (ass.file_uri) {
            log("⬆️", `Uploading assignment: ${ass.title}`);
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
            log(
              "✅",
              `Assignment synced: ${ass.title} → remote id ${result.id}`,
            );
          } else {
            // Assignment with no file: just a catch
            log("⚠️", `Assignment has no file_uri, skipping: ${ass.title}`);
          }

          completed++;
          setSyncProgress({ current: completed, total: totalToSync });
        } catch (e: any) {
          log("❌", `Assignment sync failed [${ass.title}]: ${e.message}`);
          if (e.response?.status >= 500) {
            log(
              "🗑️",
              `Hard deleting failed assignment after 5xx: ${ass.title}`,
            );
            LocalDB.hardDeleteAssignment(ass.id);
          }
        }
      }

      // daily plans
      for (const plan of dirtyPlans) {
        try {
          log("⬆️", `Syncing plan for: ${plan.date}`);
          await BrainwaveAPI.saveDailyPlan(user.id, plan.date, plan.tasks);
          LocalDB.markPlanSynced(user.id, plan.date);
          log("✅", `Plan synced: ${plan.date}`);
          completed++;
          setSyncProgress({ current: completed, total: totalToSync });
        } catch (e: any) {
          log("❌", `Plan sync failed [${plan.date}]: ${e.message}`);
          // Stays dirty - retries on next reconnect
        }
      }

      log("🏁", `Sync complete — ${completed}/${totalToSync} succeeded`);

      setTimeout(() => setSyncProgress({ current: 0, total: 0 }), 2000);
      isSyncing.current = false;

      // Refresh state from local DB after sync
      setMaterials(await LocalDB.getAllMaterials(user.id));
      setTimetables(await LocalDB.getAllTimetables(user.id));
      setAssignments(await LocalDB.getAllAssignments(user.id));
      setPlans(await LocalDB.getAllPlans(user.id));
    },
    [user?.id],
  );

  // Fetch data with local-first strategy, then sync
  const fetchData = useCallback(
    async (force = false) => {
      if (!user?.id) return;

      // 1. Load local immediately for instant UI
      log("📦", "Loading from local DB...");
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
        const online = await isOnline();

        if (!online) {
          log("🔴", "Offline — showing local data only");
          return;
        }

        // 2. Push dirty records to backend first
        await syncDirtyRecords(
          localMaterials,
          localTimetables,
          localAssignments,
          localPlans,
        );

        // 3. Pull from backend if forced or 12hr cache expired
        const lastSync = await AsyncStorage.getItem("lastPlansSync");
        const TWELVE_HOURS = 1000 * 60 * 60 * 12;
        const cacheExpired =
          !lastSync || Date.now() - Number(lastSync) > TWELVE_HOURS;

        if (force || cacheExpired) {
          log(
            "⬇️",
            force
              ? "Force pulling from server..."
              : "Cache expired — pulling from server...",
          );

          const remotePlans = await BrainwaveAPI.listDailyPlans(user.id);
          if (remotePlans?.plans) {
            LocalDB.syncPlansFromServer(user.id, remotePlans.plans);
            log("✅", `Pulled ${remotePlans.plans.length} plans`);
          }

          const remoteMaterials = await BrainwaveAPI.listStudyPlans(user.id);
          if (remoteMaterials?.plans) {
            await LocalDB.syncMaterialsFromServer(
              user.id,
              remoteMaterials.plans,
            );
            log("✅", `Pulled ${remoteMaterials.plans.length} materials`);
          }

          const remoteTimetables = await BrainwaveAPI.listTimetables(user.id);
          if (remoteTimetables?.timetables) {
            await LocalDB.syncTimetablesFromServer(
              user.id,
              remoteTimetables.timetables,
            );
            log(
              "✅",
              `Pulled ${remoteTimetables.timetables.length} timetables`,
            );
          }

          const remoteAssignments = await BrainwaveAPI.listAssignments(user.id);
          if (remoteAssignments?.assignments) {
            await LocalDB.syncAssignmentsFromServer(
              user.id,
              remoteAssignments.assignments,
            );
            log(
              "✅",
              `Pulled ${remoteAssignments.assignments.length} assignments`,
            );
          }

          await AsyncStorage.setItem("lastPlansSync", String(Date.now()));
          log("✅", "Cache timestamp updated");
        } else {
          log("⏭️", "Cache still fresh — skipping server pull");
        }

        // 4. Update app state after full sync
        setMaterials(await LocalDB.getAllMaterials(user.id));
        setTimetables(await LocalDB.getAllTimetables(user.id));
        setPlans(await LocalDB.getAllPlans(user.id));
        setAssignments(await LocalDB.getAllAssignments(user.id));

        log("✅", "fetchData complete");
      } catch (err: any) {
        log("❌", `fetchData error: ${err.message}`);
        setError("Failed to sync with cloud.");
      } finally {
        setIsLoading(false);
      }
    },
    [user?.id, syncDirtyRecords],
  );

  // netinfo listener to auto-sync on reconnect
  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!(state.isConnected && state.isInternetReachable);
      if (online && !isSyncing.current) {
        log("🔄", "Reconnected — triggering sync");
        fetchData();
      }
    });

    return () => unsubscribe();
  }, [user?.id, fetchData]);

  //Initial load
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

    log("📝", `Creating material locally: ${title}`);
    const localId = await LocalDB.createMaterialLocally(
      user.id,
      title,
      rawContent,
      uri,
      type,
    );
    setMaterials(await LocalDB.getAllMaterials(user.id));

    const online = await isOnline();
    if (!online) {
      log("🔴", `Offline — material saved locally, will sync later: ${title}`);
      return localId;
    }

    try {
      if (uri) {
        log("⬆️", `Immediate upload: ${title}`);
        const result = await BrainwaveAPI.uploadSyllabus(
          user.id,
          uri,
          title,
          type || "application/pdf",
        );
        await LocalDB.markMaterialSynced(localId, result.id, result.studyPlan);
        setMaterials(await LocalDB.getAllMaterials(user.id));
        log("✅", `Material uploaded: ${title} → remote id ${result.id}`);
      }
    } catch (syncError: any) {
      log(
        "❌",
        `Immediate upload failed, will retry on reconnect: ${syncError.message}`,
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
    isOnline: isOnlineStatus,
    error,
    refresh: fetchData,
    generatePlanForDate,
    createMaterial,

    createAssignment: async (title: string, uri: string, type: string) => {
      if (!user?.id) return null;

      log("📝", `Creating assignment locally: ${title}`);
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

      const online = await isOnline();
      if (!online) {
        log(
          "🔴",
          `Offline — assignment saved locally, will sync later: ${title}`,
        );
        return localId;
      }

      try {
        log("⬆️", `Immediate assignment upload: ${title}`);
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
        log("✅", `Assignment uploaded: ${title} → remote id ${result.id}`);
      } catch (err: any) {
        log(
          "❌",
          `Immediate assignment upload failed, will retry: ${err.message}`,
        );
      }

      return localId;
    },

    deleteAssignment: async (id: string, remoteId?: number) => {
      if (!user?.id) return false;
      try {
        LocalDB.deleteAssignment(user.id, id);
        setAssignments(await LocalDB.getAllAssignments(user.id));
        log("🗑️", `Assignment soft deleted locally: id ${id}`);

        const online = await isOnline();
        if (online && remoteId) {
          await BrainwaveAPI.deleteAssignment(user.id, remoteId);
          LocalDB.hardDeleteAssignment(Number(id));
          log(
            "✅",
            `Assignment hard deleted from server: remote id ${remoteId}`,
          );
        }
        return true;
      } catch (e: any) {
        log("❌", `Delete assignment error: ${e.message}`);
        return true; // Soft delete already happened, sync will retry
      }
    },

    deleteMaterial: async (id: string, remoteId?: number) => {
      if (!user?.id) return false;
      try {
        LocalDB.deleteMaterial(user.id, id);
        setMaterials(await LocalDB.getAllMaterials(user.id));
        log("🗑️", `Material soft deleted locally: id ${id}`);

        const online = await isOnline();
        if (online && remoteId) {
          await BrainwaveAPI.deleteMaterial(user.id, remoteId);
          LocalDB.hardDeleteMaterial(Number(id));
          log("✅", `Material hard deleted from server: remote id ${remoteId}`);
        }
        return true;
      } catch (e: any) {
        log("❌", `Delete material error: ${e.message}`);
        return true;
      }
    },

    deleteTimetable: async (id: string, remoteId?: number) => {
      if (!user?.id) return false;
      try {
        LocalDB.deleteTimetable(user.id, id);
        setTimetables(await LocalDB.getAllTimetables(user.id));
        log("🗑️", `Timetable soft deleted locally: id ${id}`);

        const online = await isOnline();
        if (online && remoteId) {
          await BrainwaveAPI.deleteTimetable(user.id, remoteId);
          LocalDB.hardDeleteTimetable(Number(id));
          log(
            "✅",
            `Timetable hard deleted from server: remote id ${remoteId}`,
          );
        }
        return true;
      } catch (e: any) {
        log("❌", `Delete timetable error: ${e.message}`);
        return true;
      }
    },
  };

  // generate AI study plan for a specific date, with optional preferences and custom tasks
  async function generatePlanForDate(
    date: string,
    preferences?: any,
    customTasks?: any[],
  ) {
    if (!user?.id) return [];

    const existing = await LocalDB.getPlanByDate(user.id, date);
    if (existing) {
      log("⏭️", `Plan already exists locally for ${date}, skipping AI`);
      return existing.tasks;
    }

    setIsLoading(true);
    setError(null);

    try {
      log("🤖", `Generating AI plan for ${date}...`);
      const dailyPlan = await BrainwaveAPI.generateDailyPlan(
        user.id,
        date,
        preferences || {},
        customTasks || [],
        {},
      );

      if (dailyPlan?.items) {
        // Save locally as dirty first
        await LocalDB.upsertPlan(user.id, date, dailyPlan.items, true);
        log("📦", `Plan saved locally as dirty for ${date}`);

        // Try immediate backend push
        try {
          await BrainwaveAPI.saveDailyPlan(user.id, date, dailyPlan.items);
          LocalDB.markPlanSynced(user.id, date);
          log("✅", `Plan pushed to server and marked clean for ${date}`);
        } catch {
          log(
            "⚠️",
            `Plan push failed — stays dirty, will retry on reconnect: ${date}`,
          );
        }

        const updatedPlans = await LocalDB.getAllPlans(user.id);
        setPlans(updatedPlans);
        return dailyPlan.items;
      }

      return [];
    } catch (err: any) {
      log("❌", `generatePlanForDate error: ${err.message}`);
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