/**
 * 命运编织者 · Ananke v2 — T2 行动选项 + 维护
 */
import { getChat } from './runtime.js';
import { getStore, saveStore } from './state.js';
import { getSettings } from './config.js';
import { buildT2Messages } from './prompts.js';
import { extractJson, recentHistory } from './parser2.js';
import { quietGenerate } from './llm.js';
import { ATTRS } from './attributes.js';

const DIFFS = ['常规', '困难', '极难', '绝对失败'];

function normalizeOptions(list) {
    const out = [];
    for (const it of (Array.isArray(list) ? list : [])) {
        const names = (Array.isArray(it?.属性) ? it.属性 : [it?.属性]).filter((a) => ATTRS.includes(a));
        if (!names.length) continue;
        const desc = String(it?.描述 || '').slice(0, 120).trim();
        if (!desc) continue;
        out.push({
            类型: String(it?.类型 || '行动').slice(0, 6),
            属性: names,
            难度: DIFFS.includes(it?.难度) ? it.难度 : '常规',
            奖惩: it?.奖惩 || null,
            描述: desc,
            成功: String(it?.成功 || '').slice(0, 160),
            失败: String(it?.失败 || '').slice(0, 160),
        });
        if (out.length >= 5) break;
    }
    return out;
}

function applyScene(store, scene) {
    if (!scene || typeof scene !== 'object') return;
    store.scene = {
        类型: scene.类型 === '封闭' ? '封闭' : '开放',
        名称: String(scene.名称 || '').slice(0, 30),
        是否变化: Boolean(scene.是否变化),
    };
}

function applyTaskUpdate(store, u) {
    if (!u || !store.task_chain) return;
    const tc = store.task_chain;
    const events = Array.isArray(tc.事件链) ? tc.事件链 : [];
    if (u.状态 === '已完成') {
        const ending = ['表', '真', '失败'].includes(u.结局) ? u.结局 : '表';
        store.task_history.push({ name: tc.名称 || '', 结局: ending, 完成游戏日: store.clock.gameDay });
        store.task_chain = null;
        store.taskCooldown = Number(getSettings().cooldowns.task) || 3;
        return;
    }
    const idx = Number(u.当前节点);
    if (Number.isInteger(idx) && idx >= 1 && idx <= events.length) {
        tc.current = idx;
        tc.status = '活跃中';
    }
    if (u.节点结果) tc.节点结果 = String(u.节点结果).slice(0, 120);
}

function applyMapUpdate(store, u) {
    if (!u || !store.map) return;
    const ids = new Set((store.map.区域 || []).map((r) => r.编号));
    if (u.当前位置 && ids.has(u.当前位置)) store.map.当前位置 = u.当前位置;
    const explored = new Set(store.map.explored || []);
    for (const id of (u.已探索 || [])) if (ids.has(id)) explored.add(id);
    store.map.explored = [...explored];
    for (const s of (u.区域状态 || [])) {
        if (!s || !ids.has(s.编号)) continue;
        const region = store.map.区域.find((r) => r.编号 === s.编号);
        if (!region) continue;
        if (['已探索', '已清除'].includes(s.状态)) region.状态 = s.状态;
    }
}

export async function generateOptions(store) {
    const s = getSettings();
    const history = recentHistory(getChat(), s.maxHistory);
    const msgs = buildT2Messages({
        attrs: store.attributes || {},
        history,
        taskChain: store.task_chain,
        map: store.map,
        toggles: s.toggles,
    });
    const raw = await quietGenerate(msgs, 't2', { temperature: 0.8, maxTokens: 3000 });
    const json = extractJson(raw);
    if (!json) throw new Error('T2 输出不是合法 JSON');
    const items = normalizeOptions(json.选项);
    if (items.length < 5) throw new Error(`T2 选项不足（${items.length}/5）`);
    applyScene(store, json.场景);
    applyTaskUpdate(store, json.任务链更新);
    applyMapUpdate(store, json.地图更新);
    store.options = {
        items,
        round: store.round,
        message: getChat().length - 1,
        clicked: false,
    };
    saveStore();
    return store.options;
}
