/**
 * 命运编织者 · Ananke v2 — 全局配置
 */
import { getExtensionSettings, saveSettingsPersist } from './runtime.js';

export const SETTINGS_KEY = 'fate-weaver';

export const DEFAULT_SETTINGS = {
    version: '2.0.0',
    enabled: true,
    mock: false,
    api: { url: '', key: '', model: '' },
    showDifficulty: true,
    clickMode: 'send',
    toggles: { t3: true, t4: true, t5: true },
    probs: { task: 0.25, map: 0.5, fate: 0.2 },
    cooldowns: { task: 3, fate: 2 },
    maxHistory: 6,
};

export function getSettings() {
    const es = getExtensionSettings();
    if (!es[SETTINGS_KEY]) {
        es[SETTINGS_KEY] = structuredClone(DEFAULT_SETTINGS);
        saveSettingsPersist();
    }
    const s = es[SETTINGS_KEY];
    for (const k of ['api', 'toggles', 'probs', 'cooldowns']) {
        if (!s[k] || typeof s[k] !== 'object') s[k] = structuredClone(DEFAULT_SETTINGS[k]);
    }
    for (const k of ['showDifficulty', 'clickMode', 'maxHistory', 'enabled', 'mock']) {
        if (s[k] === undefined) s[k] = DEFAULT_SETTINGS[k];
    }
    return s;
}

export function saveSettings() {
    saveSettingsPersist();
}
