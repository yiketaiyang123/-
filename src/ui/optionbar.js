/**
 * 命运编织者 · Ananke v2 — 行动选项栏（消息内 UI）
 */
import { getStore, saveStore } from '../state.js';
import { getSettings } from '../config.js';
import { runCheck, metaNarrative } from '../checks.js';
import { growAttribute } from '../attributes.js';
import { drawFate, applyFate, fateText } from '../t5.js';
import { escapeHtml } from '../utils.js';
import { logInfo } from '../logger.js';

let bound = false;

export function renderOptions(store, opts) {
    const idx = opts.message;
    const el = document.querySelector(`#chat .mes[mesid="${idx}"] .mes_text`);
    if (!el) return;
    el.querySelector('.ananke-options')?.remove();
    const showDiff = getSettings().showDifficulty;
    const html = `<div class="ananke-options" data-round="${opts.round}">
        ${opts.items.map((it, i) => `
            <div class="ananke-opt" data-i="${i}" role="button" tabindex="0">
                <span class="ananke-tag">【${escapeHtml(it.类型)}】</span>
                ${showDiff ? `<span class="ananke-diff">【${escapeHtml(it.难度)}】</span>` : ''}
                <span class="ananke-desc">${escapeHtml(it.描述)}</span>
            </div>`).join('')}
    </div>`;
    el.insertAdjacentHTML('beforeend', html);
    bindOnce();
}

function bindOnce() {
    if (bound) return;
    bound = true;
    document.addEventListener('click', onClick, true);
}

async function onClick(e) {
    const optEl = e.target?.closest?.('.ananke-opt');
    if (!optEl) return;
    e.preventDefault();
    e.stopPropagation();
    const bar = optEl.closest('.ananke-options');
    if (!bar || bar.dataset.done) return;
    bar.dataset.done = '1';
    const store = getStore();
    const opts = store.options;
    if (!opts || opts.clicked) return;
    const item = opts.items[Number(optEl.dataset.i)];
    if (!item) return;

    const r = runCheck(store.attributes, item.属性, item.难度);
    if (r.level === '大成功' || r.level === '大失败') {
        if (growAttribute(store.attributes, item.属性[0])) {
            logInfo('t2', `属性成长：${item.属性[0]} +1`);
        }
    }
    const branch = r.success ? item.成功 : item.失败;
    let text = `${item.描述}\n元叙事：${metaNarrative(item.属性, r)}\n${branch || ''}`.trim();
    const ev = drawFate(store);
    if (ev) {
        applyFate(store, ev);
        text += `\n\n${fateText(ev)}`;
    }
    opts.clicked = true;
    saveStore();
    bar.remove();
    sendText(text);
}

function sendText(text) {
    const ta = document.getElementById('send_textarea');
    if (!ta) return;
    ta.value = text;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
    if (getSettings().clickMode === 'send') {
        setTimeout(() => document.getElementById('send_but')?.click(), 80);
    }
}
