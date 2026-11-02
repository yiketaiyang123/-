/**
 * 命运编织者 · Ananke v2 — 检定系统（1d100，CoC 口径）
 */
import { ATTRS } from './attributes.js';

export function attrValue(attrs, names) {
    const list = (Array.isArray(names) ? names : [names]).filter((n) => ATTRS.includes(n));
    const vals = list.map((n) => Number(attrs?.[n])).filter((n) => Number.isFinite(n));
    if (!vals.length) return 50;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return Math.max(1, Math.min(99, Math.floor(avg)));
}

export function difficultyTarget(base, difficulty) {
    if (difficulty === '困难') return Math.max(1, Math.floor(base / 2));
    if (difficulty === '极难') return Math.max(1, Math.floor(base / 5));
    return base;
}

export function rollD100() {
    return 1 + Math.floor(Math.random() * 100);
}

/** 六级（内部用于成长），对外只取成功/失败 */
export function successLevel(roll, base) {
    if (roll <= 5) return '大成功';
    if (roll <= Math.floor(base / 5)) return '极难成功';
    if (roll <= Math.floor(base / 2)) return '困难成功';
    if (roll <= base) return '普通成功';
    if (base < 50 ? roll >= 96 : roll === 100) return '大失败';
    return '失败';
}

/**
 * 执行一次检定。
 * @returns { roll, target, base, success, level, difficulty }
 */
export function runCheck(attrs, names, difficulty = '常规') {
    const base = attrValue(attrs, names);
    if (difficulty === '绝对失败') {
        return { roll: null, target: null, base, success: false, level: '失败', difficulty };
    }
    const target = difficultyTarget(base, difficulty);
    const roll = rollD100();
    const success = roll <= target;
    return { roll, target, base, success, level: successLevel(roll, base), difficulty };
}

/** 元叙事文本 */
export function metaNarrative(names, r) {
    const label = (Array.isArray(names) ? names : [names]).join('·');
    if (r.difficulty === '绝对失败') {
        return `难度：绝对失败，判定为【失败】`;
    }
    return `发起了【${label}】检定，1d100=${r.roll}，判定 ${r.roll} <= ${r.target}？${r.success ? '成立' : '不成立'}，判定为【${r.success ? '成功' : '失败'}】`;
}
