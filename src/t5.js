/**
 * 命运编织者 · Ananke v2 — T5 命运事件（本地加权抽取，不调 LLM）
 */
import { getSettings } from './config.js';
import { saveStore } from './state.js';

export function buildEventLibrary(store) {
    const lib = [];
    for (const region of (store.map?.区域 || [])) {
        for (const ev of (region.概率事件 || [])) {
            lib.push({
                id: ev.编号 || `${region.编号}-${lib.length}`,
                名称: ev.名称 || '未知事件',
                类型: ev.类型 || '剧情',
                权重: Math.max(1, Number(ev.权重) || 10),
                结果提示: ev.结果提示 || '',
                来源: '地图',
                区域: region.编号,
            });
        }
    }
    for (const ending of (store.task_chain?.结局 || [])) {
        lib.push({
            id: `fate-${lib.length}`,
            名称: `${ending.类型 || ''}结局`,
            类型: '剧情',
            权重: 5,
            结果提示: ending.即时后果 || '',
            来源: '任务',
        });
    }
    return lib;
}

export function drawFate(store) {
    const s = getSettings();
    if (!s.toggles.t5) return null;
    if ((store.fate?.cooldown || 0) > 0) return null;
    if (Math.random() >= Number(s.probs.fate || 0.2)) return null;
    const lib = buildEventLibrary(store);
    if (!lib.length) return null;
    const recent = new Set((store.fate.history || []).slice(-5).map((h) => h.id));
    const weighted = lib.map((e) => ({ e, w: e.权重 * (recent.has(e.id) ? 0.3 : 1) }));
    const total = weighted.reduce((a, x) => a + x.w, 0);
    if (total <= 0) return null;
    let r = Math.random() * total;
    for (const x of weighted) {
        r -= x.w;
        if (r <= 0) return x.e;
    }
    return weighted[weighted.length - 1].e;
}

export function applyFate(store, ev) {
    store.fate.history.push({ id: ev.id, name: ev.名称, round: store.round });
    if (store.fate.history.length > 50) store.fate.history.shift();
    store.fate.cooldown = Number(getSettings().cooldowns.fate) || 2;
    saveStore();
}

export function fateText(ev) {
    return `【命运事件】${ev.名称}\n事件安排：${ev.结果提示 || ''}`;
}
