/**
 * 命运编织者 · Ananke v2 — T4 地图生成
 */
import { getChat } from './runtime.js';
import { saveStore } from './state.js';
import { buildT4Messages } from './prompts.js';
import { extractJson, recentHistory } from './parser2.js';
import { quietGenerate } from './llm.js';
import { pickCatalog } from './t3.js';

export async function generateMap(store) {
    const entries = pickCatalog(store, ['地理', '势力', '事件', '规则禁忌']);
    const history = recentHistory(getChat(), 4);
    const sceneName = store.scene?.名称 || '当前场景';
    const raw = await quietGenerate(
        buildT4Messages({
            scene: sceneName,
            history,
            entries,
            player: JSON.stringify({ 属性: store.attributes || {}, 等级: store.player_status?.等级 || null }),
            oldMap: store.map,
        }),
        't4',
        { temperature: 0.8, maxTokens: 5000 },
    );
    const json = extractJson(raw);
    const map = json?.地图;
    if (!map || !Array.isArray(map.区域) || !map.区域.length) {
        throw new Error('T4 输出结构无效（缺少地图或区域）');
    }
    map.explored = [map.入口 || map.区域[0].编号].filter(Boolean);
    store.map = map;
    saveStore();
    return map;
}
