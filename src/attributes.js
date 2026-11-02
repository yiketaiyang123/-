/**
 * 命运编织者 · Ananke v2 — 属性系统
 * 8 项固定属性，独立于角色卡数值，首次按玩家背景生成。
 */
export const ATTRS = ['力量', '敏捷', '体质', '感知', '智力', '意志', '魅力', '幸运'];

const RANGE = [30, 75];

export function clampAttr(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 50;
    return Math.max(1, Math.min(99, Math.round(n)));
}

export function defaultAttributes() {
    const o = {};
    for (const a of ATTRS) {
        o[a] = RANGE[0] + Math.floor(Math.random() * (RANGE[1] - RANGE[0] + 1));
    }
    return o;
}

/** 生成属性的提示消息（结构化输出，只要 JSON） */
export function buildAttributeMessages({ name = '', persona = '', description = '' } = {}) {
    return [
        {
            role: 'system',
            content: [
                '你是角色属性生成器。根据给定的玩家角色背景，为 8 项属性各生成一个 1-100 的整数。',
                '属性固定为：力量、敏捷、体质、感知、智力、意志、魅力、幸运。',
                '大多数属性落在 30-75；根据背景给出强弱项，不要所有值相同。',
                '只输出一个 JSON 对象，键为 8 个属性名，值为整数，不要任何解释或代码围栏。',
            ].join('\n'),
        },
        {
            role: 'user',
            content: `角色名：${name || '未命名'}\n角色背景：\n${persona || description || '（无背景，按普通人处理）'}`,
        },
    ];
}

/** 解析属性 JSON；失败返回 null */
export function parseAttributes(text) {
    const s = String(text ?? '');
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
        const obj = JSON.parse(s.slice(start, end + 1).replace(/,(\s*[}\]])/g, '$1'));
        const out = {};
        for (const a of ATTRS) {
            if (obj[a] === undefined) return null;
            out[a] = clampAttr(obj[a]);
        }
        return out;
    } catch {
        return null;
    }
}

/** 属性成长：大成功/大失败 +1，上限 99 */
export function growAttribute(attrs, name) {
    if (!attrs || !ATTRS.includes(name)) return false;
    const v = Number(attrs[name]) || 50;
    if (v >= 99) return false;
    attrs[name] = Math.min(99, v + 1);
    return true;
}
