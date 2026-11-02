/**
 * 命运编织者 · Ananke v2 — 轻量解析器
 * 只解析 JSON 与标签，不再做旧版 prose 反解。
 */

/** 从模型输出里抽出第一个 JSON 对象；失败返回 null */
export function extractJson(text) {
    let s = String(text ?? '').trim();
    if (!s) return null;
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    const body = s.slice(start, end + 1).replace(/,(\s*[}\]])/g, '$1');
    try {
        return JSON.parse(body);
    } catch {
        return null;
    }
}

/** 取 <tag>...</tag> 内容 */
export function extractTag(text, tag) {
    const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const m = String(text ?? '').match(re);
    return m ? m[1] : '';
}

/** 剔除思维链 */
export function stripThought(text) {
    return String(text ?? '')
        .replace(/<thought\b[^>]*>[\s\S]*?<\/thought>/gi, '')
        .replace(/<thought\b[^>]*>[\s\S]*$/gi, '')
        .trim();
}

/** 最近 n 条消息的正文（带角色名） */
export function recentHistory(chat, n = 6) {
    const list = Array.isArray(chat) ? chat.slice(-n * 2) : [];
    return list
        .map((m) => {
            const body = stripThought(m?.mes || '').trim();
            if (!body) return '';
            return `${m?.is_user ? '用户' : (m?.name || '角色')}：${body}`;
        })
        .filter(Boolean)
        .join('\n');
}
