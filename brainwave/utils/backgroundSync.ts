import NetInfo from "@react-native-community/netinfo";
import { LocalDB } from "../app/database/localDb";
import BrainwaveAPI from "@/api/brAInwaveApi";

/**
 * Lightweight background sync which pushes dirty completion logs and module goals
 * silently with no UI overlay.
 */

export async function backgroundSync(userId: string): Promise<void> {
    try {
        const state = await NetInfo.fetch();
        const online = !!(state.isConnected && state.isInternetReachable);
        
        if (!online) return;

        // Completion logs
        const dirtyLogs = LocalDB.getDirtyCompletionLogs(userId);

        if (dirtyLogs.length > 0) {
            await BrainwaveAPI.syncCompletionLogs(
            dirtyLogs.map((l) => ({
                date: l.date,
                minutes_studied: l.minutes_studied,
                module_tag: l.module_tag,
            })));

            LocalDB.markCompletionLogsSynced(
                userId,
                dirtyLogs.map((l) => l.id),
            );
            if (__DEV__) console.log(`[Sync] Completion logs pushed: ${dirtyLogs.length}`);
        }

        // Module goals
        const dirtyGoals = LocalDB.getDirtyModuleGoals(userId);
        
        if (dirtyGoals.length > 0) {
            await BrainwaveAPI.syncModuleGoals(
                dirtyGoals.map((g) => ({
                module_tag: g.module_tag,
                weekly_goal_minutes: g.weekly_goal_minutes,
                })));
            LocalDB.markModuleGoalsSynced(userId);
        
        if (__DEV__) console.log(`[Sync] Module goals pushed: ${dirtyGoals.length}`);
        }
        } catch (e: any) {
            if (__DEV__) console.log(`[Sync] Background sync failed: ${e.message}`);
    }
}
