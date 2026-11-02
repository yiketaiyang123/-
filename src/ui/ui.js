/**
 * 命运编织者 · Ananke v2 — 设置面板 + 入口
 */
import { getSettings, saveSettings } from '../config.js';
import { getStore, resetStore } from '../state.js';
import { ensureWorldModel, ensureAttributes } from '../t1.js';
import { getLogs, clearLogs } from '../logger.js';
import { escapeHtml } from '../utils.js';
import { ATTRS } from '../attributes.js';

let overlay = null;

export function injectUI() {
    injectWand();
    injectFab();
}

export function openPanel() {
    closePanel();
    overlay = document.createElement('div');
    overlay.className = 'ananke-overlay';
    overlay.innerHTML = `
    <div class="ananke-panel" role="dialog" aria-label="命运编织者">
        <div class="ananke-header">
            <span class="ananke-title">命运编织者</span>
            <span class="ananke-ver">v2.0.0</span>
            <button class="ananke-btn ananke-close" id="a-close">×</button>
        </div>
        <div class="ananke-status" id="a-status"></div>
        <div class="ananke-grid">
            <label>API 地址<input id="a-url" placeholder="https://..."></label>
            <label>API Key<input id="a-key" type="password"></label>
            <label>模型<input id="a-model" placeholder="模型名"></label>
            <label class="ananke-check"><input type="checkbox" id="a-mock"> Mock 调试（不调真实 API）</label>
            <label class="ananke-check"><input type="checkbox" id="a-showdiff"> 显示难度标签</label>
            <label>点击模式
                <select id="a-clickmode">
                    <option value="send">直接发送</option>
                    <option value="fill">只填输入框</option>
                </select>
            </label>
            <label class="ananke-check"><input type="checkbox" id="a-t3"> 启用任务链</label>
            <label class="ananke-check"><input type="checkbox" id="a-t4"> 启用地图</label>
            <label class="ananke-check"><input type="checkbox" id="a-t5"> 启用命运事件</label>
            <label>任务链概率<input id="a-ptask" type="number" step="0.05" min="0" max="1"></label>
            <label>地图概率<input id="a-pmap" type="number" step="0.05" min="0" max="1"></label>
            <label>命运概率<input id="a-pfate" type="number" step="0.05" min="0" max="1"></label>
            <label>任务链冷却（轮）<input id="a-ctask" type="number" min="0"></label>
            <label>命运冷却（轮）<input id="a-cfate" type="number" min="0"></label>
        </div>
        <div class="ananke-actions">
            <button class="ananke-btn" id="a-scan">重扫世界书</button>
            <button class="ananke-btn" id="a-attr">重生成属性</button>
            <button class="ananke-btn" id="a-reset">重置当前聊天</button>
            <button class="ananke-btn" id="a-clear">清空日志</button>
        </div>
        <div class="ananke-logs" id="a-logs"></div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closePanel(); });
    overlay.querySelector('#a-close').addEventListener('click', closePanel);
    overlay.querySelector('#a-scan').addEventListener('click', async () => {
        const st = getStore();
        try { await ensureWorldModel({ force: true }); toast('世界书已重扫'); } catch (e) { toast(`重扫失败：${e?.message || e}`); }
        refresh();
    });
    overlay.querySelector('#a-attr').addEventListener('click', async () => {
        const st = getStore();
        st.attributes = null;
        try { await ensureAttributes(); toast('属性已重生成'); } catch (e) { toast(`失败：${e?.message || e}`); }
        refresh();
    });
    overlay.querySelector('#a-reset').addEventListener('click', () => {
        if (!confirm('确定重置当前聊天的插件数据？')) return;
        resetStore();
        toast('已重置');
        refresh();
    });
    overlay.querySelector('#a-clear').addEventListener('click', () => { clearLogs(); refresh(); });
    overlay.addEventListener('change', saveForm);
    refresh();
}

function saveForm() {
    const s = getSettings();
    const v = (id) => overlay.querySelector(id);
    s.api.url = v('#a-url').value.trim();
    s.api.key = v('#a-key').value.trim();
    s.api.model = v('#a-model').value.trim();
    s.mock = v('#a-mock').checked;
    s.showDifficulty = v('#a-showdiff').checked;
    s.clickMode = v('#a-clickmode').value;
    s.toggles.t3 = v('#a-t3').checked;
    s.toggles.t4 = v('#a-t4').checked;
    s.toggles.t5 = v('#a-t5').checked;
    s.probs.task = Number(v('#a-ptask').value) || 0;
    s.probs.map = Number(v('#a-pmap').value) || 0;
    s.probs.fate = Number(v('#a-pfate').value) || 0;
    s.cooldowns.task = Number(v('#a-ctask').value) || 0;
    s.cooldowns.fate = Number(v('#a-cfate').value) || 0;
    saveSettings();
}

function refresh() {
    if (!overlay) return;
    const s = getSettings();
    const st = getStore();
    const cat = st.worldbook?.catalog || {};
    const count = Object.keys(cat).length;
    overlay.querySelector('#a-status').innerHTML = [
        `世界书条目：<b>${count}</b>`,
        `属性：<b>${st.attributes ? '已生成' : '未生成'}</b>`,
        `回合：<b>${st.round || 0}</b>`,
        `任务链：<b>${st.task_chain ? escapeHtml(st.task_chain.名称 || '有') : '无'}</b>`,
        `地图：<b>${st.map ? escapeHtml(st.map.地点名称 || '有') : '无'}</b>`,
    ].join(' · ');
    overlay.querySelector('#a-url').value = s.api.url || '';
    overlay.querySelector('#a-key').value = s.api.key || '';
    overlay.querySelector('#a-model').value = s.api.model || '';
    overlay.querySelector('#a-mock').checked = !!s.mock;
    overlay.querySelector('#a-showdiff').checked = !!s.showDifficulty;
    overlay.querySelector('#a-clickmode').value = s.clickMode || 'send';
    overlay.querySelector('#a-t3').checked = !!s.toggles.t3;
    overlay.querySelector('#a-t4').checked = !!s.toggles.t4;
    overlay.querySelector('#a-t5').checked = !!s.toggles.t5;
    overlay.querySelector('#a-ptask').value = s.probs.task;
    overlay.querySelector('#a-pmap').value = s.probs.map;
    overlay.querySelector('#a-pfate').value = s.probs.fate;
    overlay.querySelector('#a-ctask').value = s.cooldowns.task;
    overlay.querySelector('#a-cfate').value = s.cooldowns.fate;
    const logs = getLogs().slice(-40).reverse();
    overlay.querySelector('#a-logs').innerHTML = logs.length
        ? logs.map((l) => `<div class="ananke-log ananke-${l.level}">[${l.time}] ${escapeHtml(l.message)}</div>`).join('')
        : '<div class="ananke-log">（暂无日志）</div>';
}

export function closePanel() {
    if (overlay) { overlay.remove(); overlay = null; }
}

function toast(msg) {
    const el = document.createElement('div');
    el.className = 'ananke-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
}

const STAR = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2 L14 9 L21 12 L14 15 L12 22 L10 15 L3 12 L10 9 Z"/></svg>`;

function injectWand() {
    function mount() {
        const c = document.getElementById('extensionsMenu') || document.getElementById('sp_wand_container') || document.getElementById('WandMenu');
        if (!c || document.getElementById('ananke-wand')) return false;
        const div = document.createElement('div');
        div.id = 'ananke-wand';
        div.className = 'list-group-item flex-container flexGap5';
        div.title = '打开命运编织者';
        div.style.cursor = 'pointer';
        div.innerHTML = `<span class="ananke-wand-icon">${STAR}</span><span>命运编织者</span>`;
        div.addEventListener('click', openPanel);
        c.appendChild(div);
        return true;
    }
    if (!mount()) {
        const obs = new MutationObserver(() => { if (mount()) obs.disconnect(); });
        obs.observe(document.body, { childList: true, subtree: true });
    }
}

function injectFab() {
    if (document.getElementById('ananke-fab')) return;
    const fab = document.createElement('div');
    fab.id = 'ananke-fab';
    fab.innerHTML = `<button title="命运编织者">${STAR}</button>`;
    document.body.appendChild(fab);
    fab.querySelector('button').addEventListener('click', () => { overlay ? closePanel() : openPanel(); });
}
