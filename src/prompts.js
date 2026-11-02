/**
 * 命运编织者 · Ananke v2 — 提示词
 */

export const KINDS = ['世界基础', '规则禁忌', '力量体系', '地理', '势力', 'NPC', '物品资源', '事件', '文风格式', '其它'];

export function formatEntries(entries, maxContent = 120) {
    return entries
        .map((e) => `[${e.uid}] ${e.title || ''} :: ${String(e.content || '').slice(0, maxContent)}`)
        .join('\n');
}

/** T1 条目分类 */
export function buildT1ClassifyMessages({ name = '', entries = [] }) {
    return [
        {
            role: 'system',
            content: [
                '你是世界书条目分类器，服务于一个剧情调度插件。',
                '给每个条目判定类别、一句话简介、何时该用，并标记是否重要。',
                `类别只能是：${KINDS.join('、')}。`,
                '拿不准的标 needsReview=true；不要改写条目正文。',
                '只输出 JSON：{"entries":[{"uid":"","kind":"","intro":"","retrieveWhen":"","important":false,"needsReview":false}]}',
            ].join('\n'),
        },
        {
            role: 'user',
            content: `作品/角色：${name || '未命名'}\n\n条目列表：\n${formatEntries(entries)}`,
        },
    ];
}

/** T2 行动选项 + 维护 */
export function buildT2Messages({ attrs = {}, history = '', taskChain = null, map = null, toggles = {} }) {
    const attrText = Object.entries(attrs).map(([k, v]) => `${k}=${v}`).join('，');
    const cap = (s, n = 2500) => {
        const t = String(s || '');
        return t.length > n ? `${t.slice(0, n)}…` : t;
    };
    return [
        {
            role: 'system',
            content: [
                '你是一个跑团主持人，负责根据最新剧情生成 5 条行动选项，并顺带维护任务链与地图状态。',
                '输出要求：',
                '1. 选项 5 条；每条含 类型（2-4 字）、属性（1-2 项）、难度（常规|困难|极难|绝对失败）、奖惩（null|奖励1|惩罚1）、描述（≤80字）、成功（≤80字）、失败（≤80字）。',
                '2. 属性必须是：力量、敏捷、体质、感知、智力、意志、魅力、幸运。',
                '3. 难度按局面给：实力差距碾压时用“绝对失败”。',
                '4. 禁止写数值运算（伤害值/成功率），禁止写既定结果（击杀、砍头、必然被擒），禁止替 NPC 决定反应。',
                '5. 描述只写行动意图与方式，不写结果；成功/失败段写行动后果。',
                '6. 顺带输出：场景类型（开放|封闭）、是否变化；若任务链存在，输出任务链更新；若地图存在，输出地图更新。',
                '只输出 JSON：{"选项":[...],"场景":{"类型":"","名称":"","是否变化":false},"任务链更新":{...},"地图更新":{...}}',
            ].join('\n'),
        },
        {
            role: 'user',
            content: [
                `玩家属性：${attrText}`,
                `最近剧情：\n${history || '（无）'}`,
                `当前任务链：${taskChain ? cap(JSON.stringify(taskChain)) : '无'}`,
                `当前地图：${map ? cap(JSON.stringify(map)) : '无'}`,
                `功能开关：${JSON.stringify(toggles)}`,
            ].join('\n\n'),
        },
    ];
}

/** T3 任务链生成 */
export function buildT3Messages({ seed = '', history = '', entries = [], player = '' }) {
    return [
        {
            role: 'system',
            content: [
                '你是任务链编剧。根据种子、已发生剧情与世界观资料，写一条可执行的任务链。',
                '只写框架，不写演出细节；不得替主 AI 写 NPC 台词或玩家反应。',
                '输出 JSON：{"任务链":{"名称":"≤8字","任务时限":"N游戏日","任务梗概":{"表面故事":"","真实原委":"","关键NPC":[{"名称":"","表面立场":"","真实立场":"","核心动机":""}],"核心矛盾":""},"事件链":[{"序号":1,"类型":"引子","名称":"","说明":"","完成条件":""}],"结局":[{"类型":"表|真|失败","触发条件":"","即时后果":"","后续影响":""}]}}',
                '事件链 3-6 个，首个为“引子”，至少 1 个“反转”；结局至少 3 个，真结局必须有代价。',
            ].join('\n'),
        },
        {
            role: 'user',
            content: [
                `种子：${seed || '（无，按当前剧情自然展开）'}`,
                `最近剧情：\n${history || '（无）'}`,
                `世界观资料：\n${entries.length ? formatEntries(entries, 200) : '（无）'}`,
                `玩家状态：${player || '未知'}`,
            ].join('\n\n'),
        },
    ];
}

/** T4 地图生成 */
export function buildT4Messages({ scene = '', history = '', entries = [], player = '', oldMap = null }) {
    return [
        {
            role: 'system',
            content: [
                '你是地图构筑者。为当前封闭场景生成一张可探索地图，并为每个区域写 1-5 条概率事件。',
                '输出 JSON：{"地图":{"地点名称":"","结构":"线性|分支|环形|复合","入口":"①","出口":"⑥","当前位置":"①","区域":[{"编号":"①","名称":"","状态":"未探索","用途":"战斗|解谜|奖励|剧情|氛围|陷阱|NPC","描述":"","连接":["↓ ②"],"敌对":[{"名称":"","数量":1,"等级":1,"特征":"","BOSS":false}],"元素":[{"描述":"","功能":""}],"概率事件":[{"编号":"","名称":"","类型":"遭遇|魔物|机遇|危险|剧情","权重":10,"触发条件":"","结果提示":""}]}]}}',
                '区域 3-15 个；隐藏区域至少 1 个；连接目标必须存在；敌对不超过 4 个；概率事件权重 1-100。',
                '不得写 NPC 台词，不得预设玩家反应。',
            ].join('\n'),
        },
        {
            role: 'user',
            content: [
                `场景：${scene || '当前场景'}`,
                `最近剧情：\n${history || '（无）'}`,
                `世界观资料：\n${entries.length ? formatEntries(entries, 200) : '（无）'}`,
                `玩家状态：${player || '未知'}`,
                `旧地图：${oldMap ? JSON.stringify(oldMap) : '无'}`,
            ].join('\n\n'),
        },
    ];
}
