/**
 * 命运编织者 · Ananke v2 — 聊天级状态
 * 存于 chatMetadata.extensions['fate-weaver-v2']，与旧版数据隔离。
 */
import { getChatMetadata, saveChatPersist } from './runtime.js';

export const STORE_KEY = 'fate-weaver-v2';

export function defaultStore() {
    return {
        v: 2,
        round: 0,
        worldbook: null,
        attributes: null,
        options: null,
        pending_action: null,
        task_chain: null,
        map: null,
        scene: null,
        task_history: [],
        timeline_events: [],
        taskCooldown: 0,
        taskSeq: 0,
        fate: { history: [], cooldown: 0 },
        clock: { gameDay: 1 },
        player_status: null,
        ai_trace: {},
    };
}

export function getStore() {
    const cm = getChatMetadata();
    if (!cm || typeof cm !== 'object') return defaultStore();
    if (!cm.extensions) cm.extensions = {};
    if (!cm.extensions[STORE_KEY]) cm.extensions[STORE_KEY] = defaultStore();
    const s = cm.extensions[STORE_KEY];
    if (!s.clock) s.clock = { gameDay: 1 };
    if (!s.fate) s.fate = { history: [], cooldown: 0 };
    if (!Array.isArray(s.fate.history)) s.fate.history = [];
    return s;
}

export function saveStore() {
    saveChatPersist();
}

export function resetStore() {
    const cm = getChatMetadata();
    if (!cm || typeof cm !== 'object') return;
    if (!cm.extensions) cm.extensions = {};
    cm.extensions[STORE_KEY] = defaultStore();
    saveChatPersist();
}
