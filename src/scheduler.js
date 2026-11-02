/**
 * 命运编织者 · Ananke v2 — 调度器
 * 生成后运行 T2，异步掷骰触发 T3/T4；生成前不阻塞。
 */
import { getEventSource, getEventTypes, getChat, getContextObject } from './runtime.js';
import { getSettings } from './config.js';
import { getStore } from './state.js';
import { ensureWorldModel, ensureAttributes } from './t1.js';
import { generateOptions } from './t2.js';
import { generateTaskChain } from './t3.js';
import { generateMap } from './t4.js';
import { logInfo, logError } from './logger.js';

let optionsBusy = false;

export function initScheduler() {
    const es = getEventSource();
    const et = getEventTypes();
    if (!es || !et) return;
    if (et.GENERATION_ENDED) {
        es.on(et.GENERATION_ENDED, () => {
            onGenerationEnded().catch((e) => logError('system', e?.message || e));
        });
    }
    if (et.CHAT_CHANGED) {
        es.on(et.CHAT_CHANGED, () => { ensureFirstEntry().catch(() => {}); });
    }
    setTimeout(() => ensureFirstEntry().catch(() => {}), 1200);
}

export async function ensureFirstEntry() {
    const s = getSettings();
    if (!s.enabled) return;
    const store = getStore();
    const ctx = getContextObject();
    const charName = ctx?.characters?.[ctx?.characterId]?.name || '';
    const wbName = store.worldbook?.meta?.name || '';
    const wbCount = Object.keys(store.worldbook?.catalog || {}).length;
    if (!store.worldbook || (charName && wbName !== charName) || (charName && wbCount === 0)) {
        try {
            await ensureWorldModel({ force: true });
            logInfo('t1', `世界书扫描完成：${Object.keys(store.worldbook.catalog).length} 条`);
        } catch (e) {
            logError('t1', `世界书扫描失败：${e?.message || e}`);
        }
    }
    if (!store.attributes) {
        try {
            await ensureAttributes();
            logInfo('t1', '属性已生成');
        } catch (e) {
            logError('t1', `属性生成失败：${e?.message || e}`);
        }
    }
}

async function onGenerationEnded() {
    const s = getSettings();
    if (!s.enabled || optionsBusy) return;
    const chat = getChat();
    if (!chat.length) return;
    const last = chat[chat.length - 1];
    window.__anankeDebug = { t: Date.now(), chatLen: chat.length, lastUser: last?.is_user, lastSystem: last?.is_system, busy: optionsBusy };
    if (!last || last.is_user || last.is_system) return;
    optionsBusy = true;
    try {
        const store = getStore();
        store.round = Math.max((Number(store.round) || 0) + 1, Math.ceil(chat.length / 2));
        store.taskCooldown = Math.max(0, Number(store.taskCooldown) || 0);
        store.fate.cooldown = Math.max(0, (Number(store.fate.cooldown) || 0) - 1);
        if (!store.worldbook) await ensureWorldModel();
        if (!store.attributes) await ensureAttributes();
        const opts = await generateOptions(store);
        const { renderOptions } = await import('./ui/optionbar.js');
        renderOptions(store, opts);
        logInfo('t2', `已生成 ${opts.items.length} 条行动选项`);
        postDice(store).catch((e) => logError('system', e?.message || e));
    } catch (e) {
        logError('t2', `行动选项生成失败：${e?.message || e}`);
    } finally {
        optionsBusy = false;
    }
}

async function postDice(store) {
    const s = getSettings();
    if (s.toggles.t3 && !store.task_chain && (store.taskCooldown || 0) <= 0) {
        if (Math.random() < Number(s.probs.task || 0.25)) {
            try {
                await generateTaskChain(store);
                logInfo('t3', `任务链已生成：#${store.task_chain.id} ${store.task_chain.名称 || ''}`);
            } catch (e) {
                logError('t3', `任务链生成失败：${e?.message || e}`);
            }
        }
    }
    if (s.toggles.t4) {
        const closed = store.scene?.类型 === '封闭';
        const changed = store.scene?.是否变化;
        const need = !store.map || (closed && changed);
        if (closed && need && (!store.map || Math.random() < Number(s.probs.map || 0.5))) {
            try {
                await generateMap(store);
                logInfo('t4', `地图已生成：${store.map.地点名称 || ''}`);
            } catch (e) {
                logError('t4', `地图生成失败：${e?.message || e}`);
            }
        }
    }
}
