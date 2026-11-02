/**
 * 命运编织者 · Ananke v2 — T3 任务链生成
 */
import { getChat } from './runtime.js';
import { saveStore } from './state.js';
import { buildT3Messages } from './prompts.js';
import { extractJson, recentHistory } from './parser2.js';
import { quietGenerate } from './llm.js';

export function pickCatalog(store, kinds, limit = 8) {
    const cat = Object.values(store.worldbook?.catalog || {});
    return cat
        .filter((m) => kinds.includes(m.kind) && !m.blocked)
        .sort((a, b) => (b.important ? 1 : 0) - (a.important ? 1 : 0))
        .slice(0, limit)
        .map((m) => ({ uid: m.uid, title: m.title, content: m.excerpt || m.intro || '' }));
}

export function seedText(store) {
    const parts = [];
    const map = store.map;
    const region = (map?.区域 || []).find((r) => r.编号 === map?.当前位置);
    if (region) parts.push(`地点：${region.名称}（${region.描述 || ''}）`);
    const factions = Object.values(store.worldbook?.catalog || {}).filter((m) => m.kind === '势力' && !m.blocked);
    if (factions.length) parts.push(`势力：${factions[Math.floor(Math.random() * factions.length)].title}`);
    const hist = store.task_history || [];
    if (hist.length) parts.push(`最近任务：${hist[hist.length - 1].name}`);
    return parts.join('；');
}

export async function generateTaskChain(store) {
    const entries = pickCatalog(store, ['势力', 'NPC', '物品资源', '地理', '规则禁忌']);
    const history = recentHistory(getChat(), 4);
    const player = JSON.stringify({ 属性: store.attributes || {}, 状态: store.player_status || null });
    const raw = await quietGenerate(
        buildT3Messages({ seed: seedText(store), history, entries, player }),
        't3',
        { temperature: 0.8, maxTokens: 4000 },
    );
    const json = extractJson(raw);
    const tc = json?.任务链;
    if (!tc || !Array.isArray(tc.事件链) || !tc.事件链.length) {
        throw new Error('T3 输出结构无效（缺少任务链或事件链）');
    }
    store.taskSeq = (store.taskSeq || 0) + 1;
    tc.id = store.taskSeq;
    tc.status = '待激活';
    tc.current = 1;
    store.task_chain = tc;
    saveStore();
    return tc;
}
