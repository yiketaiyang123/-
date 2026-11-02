/**
 * 命运编织者 · Ananke v2 — 扩展入口
 */
import { initScheduler } from './src/scheduler.js';
import { injectUI, openPanel } from './src/ui/ui.js';
import { logInfo, getLogs } from './src/logger.js';
import { getSettings } from './src/config.js';
import { getStore } from './src/state.js';
import { getEventSource, getEventTypes, getRegisterSlashCommand } from './src/runtime.js';

const MODULE_NAME = '命运编织者 · Ananke';

let started = false;

function start() {
    if (started) return;
    started = true;
    try { initScheduler(); } catch (e) { console.warn('[Ananke] 调度器初始化失败', e); }
    try { injectUI(); } catch (e) { console.warn('[Ananke] 面板入口注入失败', e); }
    const reg = getRegisterSlashCommand();
    if (typeof reg === 'function') {
        try { reg('ananke', () => openPanel(), [], '打开命运编织者面板', true, true); } catch { /* ignore */ }
    }
    logInfo('system', `${MODULE_NAME} v2.0.0 已加载`);
    console.log(`[${MODULE_NAME}] 已加载 v2.0.0`);
    window.__ananke = { getStore, getSettings, getLogs, openPanel, start: () => start() };
}

const es = getEventSource();
const et = getEventTypes();
if (es && et?.APP_READY) {
    es.on(et.APP_READY, start);
}

const t0 = Date.now();
const iv = setInterval(() => {
    if (started) { clearInterval(iv); return; }
    if (window.extension_settings || window.SillyTavern || Date.now() - t0 > 4000) {
        clearInterval(iv);
        start();
    }
}, 300);
