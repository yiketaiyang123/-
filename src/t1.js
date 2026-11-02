/**
 * 命运编织者 · Ananke v2 — T1 世界书扫描与分类
 */
import { getContextObject } from './runtime.js';
import { getStore, saveStore } from './state.js';
import { buildT1ClassifyMessages, KINDS } from './prompts.js';
import { extractJson } from './parser2.js';
import { quietGenerate } from './llm.js';
import { getSettings } from './config.js';
import { buildAttributeMessages, parseAttributes, defaultAttributes } from './attributes.js';

function isScriptOnly(text) {
    const t = String(text || '');
    if (!t.includes('<%') && !t.includes('{{')) return false;
    const rest = t.replace(/<%[\s\S]*?%>/g, '').replace(/\{\{[\s\S]*?\}\}/g, '')
        .replace(/^[ \t]*@@\S.*$/gm, '').replace(/[\s{}()[\];,]/g, '');
    return rest.length <= Math.max(8, Math.floor(t.length * 0.02));
}

export function heuristicKind(title, content) {
    const t = `${title} ${content}`;
    if (/规则|禁忌|禁止|不可|必须|代价|消耗|限制/.test(t)) return '规则禁忌';
    if (/力量|境界|等级|修行|灵力|魔力|职阶|体系/.test(t)) return '力量体系';
    if (/城|镇|村|山|河|森林|平原|沙漠|海域|区域|版图|地图|地理/.test(t)) return '地理';
    if (/公会|教团|家族|帝国|王国|势力|组织|阵营/.test(t)) return '势力';
    if (/人物|角色|NPC|守夜人|管家|村长|队长/.test(t)) return 'NPC';
    if (/物品|装备|武器|道具|材料|药材|货币/.test(t)) return '物品资源';
    if (/事件|战争|灾难|传说|历史|纪元/.test(t)) return '事件';
    if (/示例|格式|说明|提示词|测试|草稿|作者注/.test(t)) return '文风格式';
    return '世界基础';
}

export async function collectWorldInfo() {
    const ctx = getContextObject();
    const char = ctx?.characters?.[ctx?.characterId];
    const out = new Map();
    const bookName = String(char?.data?.extensions?.world || '').trim();
    if (bookName && typeof ctx?.loadWorldInfo === 'function') {
        try {
            const data = await ctx.loadWorldInfo(bookName);
            for (const [uid, e] of Object.entries(data?.entries || {})) {
                if (e?.disable) continue;
                const content = String(e.content || '').trim();
                if (!content) continue;
                const title = e.comment || (Array.isArray(e.key) ? e.key.join(',') : '') || `条目${uid}`;
                out.set(`${bookName}:${uid}`, { uid: `${bookName}:${uid}`, book: bookName, title, content });
            }
        } catch { /* 单本失败忽略 */ }
    }
    if (!out.size) {
        const book = char?.data?.character_book;
        for (const e of (book?.entries || [])) {
            if (e?.disable || e?.disabled) continue;
            const content = String(e.content || '').trim();
            if (!content) continue;
            const key = Array.isArray(e.keys) ? e.keys.join(',') : (Array.isArray(e.key) ? e.key.join(',') : '');
            const title = e.comment || key || '';
            out.set(title + content, { uid: title + content, book: '内嵌', title, content });
        }
    }
    return { name: char?.name || '', entries: [...out.values()] };
}

function chunkByChars(list, max = 6000) {
    const batches = [];
    let cur = [], size = 0;
    for (const e of list) {
        const len = String(e.content || '').length + 60;
        if (cur.length && size + len > max) { batches.push(cur); cur = []; size = 0; }
        cur.push(e); size += len;
    }
    if (cur.length) batches.push(cur);
    return batches;
}

function parseClassify(raw, batch) {
    const json = extractJson(raw);
    const map = new Map();
    for (const it of (json?.entries || [])) {
        if (it?.uid) map.set(String(it.uid), it);
    }
    return batch.map((e) => {
        const it = map.get(e.uid) || {};
        const kind = KINDS.includes(it.kind) ? it.kind : heuristicKind(e.title, e.content);
        return {
            uid: e.uid, book: e.book, title: e.title,
            excerpt: String(e.content || '').slice(0, 300),
            kind,
            intro: String(it.intro || '').slice(0, 80),
            retrieveWhen: String(it.retrieveWhen || '').slice(0, 100),
            important: Boolean(it.important),
            needsReview: it.needsReview !== false,
            blocked: kind === '文风格式' && isScriptOnly(e.content),
            hash: `${e.title}|${e.content.length}`,
        };
    });
}

export async function ensureWorldModel({ force = false } = {}) {
    const store = getStore();
    if (!force && store.worldbook) return store.worldbook;
    const { name, entries } = await collectWorldInfo();
    const catalog = {};
    const settled = entries.filter((e) => !isScriptOnly(e.content) || e.content.includes('规则'));
    const batches = chunkByChars(settled);
    const mock = getSettings().mock;
    for (const batch of batches) {
        let metas;
        if (mock) {
            metas = batch.map((e) => ({
                uid: e.uid, book: e.book, title: e.title,
                excerpt: String(e.content || '').slice(0, 300),
                kind: heuristicKind(e.title, e.content),
                intro: '', retrieveWhen: '', important: false,
                needsReview: true, blocked: false, hash: `${e.title}|${e.content.length}`,
            }));
        } else {
            try {
                const raw = await quietGenerate(buildT1ClassifyMessages({ name, entries: batch }), 't1');
                metas = parseClassify(raw, batch);
            } catch {
                metas = parseClassify('', batch);
            }
        }
        for (const m of metas) catalog[m.uid] = m;
    }
    store.worldbook = {
        catalog,
        meta: { scannedAt: Date.now(), count: Object.keys(catalog).length, degraded: false, name },
    };
    saveStore();
    return store.worldbook;
}

export async function ensureAttributes() {
    const store = getStore();
    if (store.attributes) return store.attributes;
    const ctx = getContextObject();
    const char = ctx?.characters?.[ctx?.characterId];
    const persona = ctx?.powerUserSettings?.persona_description || ctx?.powerUserSettings?.persona || '';
    let attrs = null;
    if (!getSettings().mock) {
        try {
            const raw = await quietGenerate(buildAttributeMessages({
                name: char?.name || '', persona, description: char?.description || '',
            }), 't1-attr');
            attrs = parseAttributes(raw);
        } catch { /* fallthrough */ }
    }
    store.attributes = attrs || defaultAttributes();
    saveStore();
    return store.attributes;
}
