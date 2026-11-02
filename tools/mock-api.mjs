/**
 * 本地 Mock OpenAI 兼容服务：只用于验证插件的"真实 API 路径"（经 ST 代理）。
 */
import http from 'node:http';

const PORT = 8799;

const T2 = {
    选项: [
        { 类型: '洞察', 属性: ['感知'], 难度: '常规', 奖惩: null, 描述: '林言停下脚步，侧耳倾听走廊尽头的动静。', 成功: '检定成功了，林言听出脚步来自两人，正往反方向走。', 失败: '检定失败了，脚步声突然消失，林言不确定对方是否发现了他。' },
        { 类型: '潜行', 属性: ['敏捷'], 难度: '困难', 奖惩: null, 描述: '林言压低身形，沿墙根接近那扇半掩的门。', 成功: '检定成功了，林言无声贴近门边，看清了门内布置。', 失败: '检定失败了，地板发出一声轻响。' },
        { 类型: '交涉', 属性: ['魅力'], 难度: '常规', 奖惩: null, 描述: '林言向守夜人表明身份，试图问出昨夜的异常。', 成功: '检定成功了，守夜人犹豫片刻，说出了西侧走廊的事。', 失败: '检定失败了，守夜人闭口不谈。' },
        { 类型: '观察', 属性: ['感知'], 难度: '极难', 奖惩: null, 描述: '林言检查窗台灰尘，判断最近是否有人翻越。', 成功: '检定成功了，林言发现两处新鲜擦痕。', 失败: '检定失败了，窗台太脏，看不出信息。' },
        { 类型: '强攻', 属性: ['力量'], 难度: '绝对失败', 奖惩: null, 描述: '林言试图直接撞开被结界封死的铁门。', 成功: '（不会发生）', 失败: '难度：绝对失败，结界纹丝不动。' },
    ],
    场景: { 类型: '封闭', 名称: '荒废酒庄', 是否变化: false },
    任务链更新: { 状态: '活跃中', 当前节点: 2, 节点结果: '找到线索' },
    地图更新: { 当前位置: '②', 已探索: ['①', '②'], 区域状态: [{ 编号: '②', 状态: '已探索' }] },
};

const T3 = {
    任务链: {
        名称: '失踪的守夜人',
        任务时限: '3游戏日',
        任务梗概: {
            表面故事: '酒庄守夜人连续两夜没有出现。',
            真实原委: '守夜人发现了酒窖下的密道。',
            关键NPC: [{ 名称: '管家', 表面立场: '委托人', 真实立场: '知情不报', 核心动机: '保住名声' }],
            核心矛盾: '查会惊动幕后，不查人白死。',
        },
        事件链: [
            { 序号: 1, 类型: '引子', 名称: '委托', 说明: '管家请求寻找守夜人。', 完成条件: '接受委托' },
            { 序号: 2, 类型: '调查', 名称: '房间', 说明: '搜查住处。', 完成条件: '找到线索' },
            { 序号: 3, 类型: '反转', 名称: '密道', 说明: '线索指向密道。', 完成条件: '进入密道' },
        ],
        结局: [
            { 类型: '表', 触发条件: '交出线索', 即时后果: '管家收下线索', 后续影响: '密道封死' },
            { 类型: '真', 触发条件: '带证据对峙', 即时后果: '管家认罪', 后续影响: '酒庄易主' },
            { 类型: '失败', 触发条件: '超时', 即时后果: '守夜人失踪', 后续影响: '线索沉底' },
        ],
    },
};

const T4 = {
    地图: {
        地点名称: '荒废酒庄',
        结构: '分支',
        入口: '①',
        出口: '④',
        当前位置: '①',
        区域: [
            { 编号: '①', 名称: '大厅', 状态: '已探索', 用途: '剧情', 描述: '积灰的长桌与熄灭的壁炉', 连接: ['↓ ②', '→ ③'], 敌对: [], 元素: [], 概率事件: [{ 编号: 'E-1', 名称: '地板异响', 类型: '危险', 权重: 20, 触发条件: '停留', 结果提示: '地板下传来轻微刮擦声。' }] },
            { 编号: '②', 名称: '酒窖', 状态: '未探索', 用途: '解谜', 描述: '潮湿的石阶与酒桶', 连接: ['↑ ①'], 敌对: [], 元素: [], 概率事件: [{ 编号: 'E-2', 名称: '鼠群突袭', 类型: '魔物', 权重: 30, 触发条件: '进入', 结果提示: '鼠群从酒桶后窜出。' }] },
            { 编号: '③', 名称: '回廊', 状态: '未探索', 用途: '氛围', 描述: '挂满旧画像的窄廊', 连接: ['← ①'], 敌对: [], 元素: [], 概率事件: [] },
        ],
    },
};

function reply(text) {
    return JSON.stringify({ id: 'mock', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }] });
}

const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url.includes('/models')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: [{ id: 'mock' }] }));
        return;
    }
    if (req.method !== 'POST') {
        res.writeHead(404); res.end('not found'); return;
    }
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
        let messages = [];
        try { messages = JSON.parse(body).messages || []; } catch { /* ignore */ }
        const sys = messages.find((m) => m.role === 'system')?.content || '';
        const user = messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n');
        let content = '{}';
        if (sys.includes('属性生成器')) {
            content = JSON.stringify({ 力量: 55, 敏捷: 62, 体质: 48, 感知: 58, 智力: 51, 意志: 60, 魅力: 53, 幸运: 57 });
        } else if (sys.includes('世界书条目分类器')) {
            const uids = [...user.matchAll(/^\[([^\]]+)\]/gm)].map((m) => m[1]);
            content = JSON.stringify({ entries: uids.map((uid) => ({ uid, kind: '世界基础', intro: '世界资料', retrieveWhen: '相关时', important: false, needsReview: false })) });
        } else if (sys.includes('跑团主持人')) {
            content = JSON.stringify(T2);
        } else if (sys.includes('任务链编剧')) {
            content = JSON.stringify(T3);
        } else if (sys.includes('地图构筑者')) {
            content = JSON.stringify(T4);
        }
        console.log(`[mock-api] ${req.url} -> ${content.slice(0, 60)}...`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(reply(content));
    });
});

server.listen(PORT, '127.0.0.1', () => console.log(`mock-api listening on ${PORT}`));
