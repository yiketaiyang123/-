const CDP = 'http://127.0.0.1:9222';
async function main() {
    const list = await (await fetch(`${CDP}/json/list`)).json();
    const t = list.find((x) => x.type === 'page' && x.url.includes('8000')) || list.find((x) => x.type === 'page');
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    let id = 0; const p = new Map();
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { const q = p.get(m.id); p.delete(m.id); m.error ? q.reject(new Error(m.error.message)) : q.resolve(m.result); } };
    await new Promise((r) => (ws.onopen = r));
    const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; p.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async (expression) => {
        const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'eval error');
        return r.result?.value;
    };
    const wait = async (expr, timeout = 30000) => {
        const t0 = Date.now();
        while (Date.now() - t0 < timeout) {
            try { if (await ev(expr)) return true; } catch { /* ignore */ }
            await new Promise((r) => setTimeout(r, 500));
        }
        return false;
    };
    await send('Page.enable');
    await send('Page.reload', { ignoreCache: true });
    await new Promise((r) => setTimeout(r, 8500));
    console.log('LOADED', await ev(`!!window.__ananke`));
    await ev(`(async () => {
        const m = await import('/script.js');
        const ctx = window.SillyTavern.getContext();
        const ch = ctx.characters.find(c => String(c.name).includes('阿卡迪亚'));
        const idx = ctx.characters.indexOf(ch);
        await m.selectCharacterById(idx, { switchMenu: false });
        await m.doNewChat({});
        await new Promise(r => setTimeout(r, 800));
        const c2 = window.SillyTavern.getContext();
        c2.chat.push({ name: ch.name, is_user: false, is_system: false, send_date: Date.now(), mes: ch.first_mes || '（测试开场）', extra: {} });
        await m.printMessages();
        await new Promise(r => setTimeout(r, 800));
        return true;
    })()`);
    await ev(`(() => {
        const s = window.__ananke.getSettings();
        s.mock = false;
        s.api = { url: 'http://127.0.0.1:8799', key: 'test', model: 'mock' };
        s.clickMode = 'fill';
        s.probs = { task: 1, map: 1, fate: 1 };
        s.cooldowns = { task: 0, fate: 0 };
        return true;
    })()`);
    await new Promise((r) => setTimeout(r, 500));
    await ev(`(() => { const c = window.SillyTavern.getContext(); c.eventSource.emit(c.eventTypes.GENERATION_ENDED); return true; })()`);
    const ok = await wait(`document.querySelectorAll('.ananke-opt').length >= 5`, 40000);
    console.log('OPTIONS_READY', ok, await ev(`document.querySelectorAll('.ananke-opt').length`));
    console.log('LOGS', await ev(`JSON.stringify((window.__ananke.getLogs() || []).slice(-14).map(l => l.message))`));
    console.log('STORE', await ev(`JSON.stringify({ wb: Object.keys(window.__ananke.getStore().worldbook?.catalog || {}).length, attrs: window.__ananke.getStore().attributes, tc: window.__ananke.getStore().task_chain?.名称 || null, map: window.__ananke.getStore().map?.地点名称 || null })`));
    const n = await ev(`document.querySelectorAll('.ananke-opt').length`);
    if (n > 0) {
        await ev(`document.querySelector('.ananke-opt').click()`);
        console.log('VALUE', await ev(`document.getElementById('send_textarea')?.value || ''`));
    }
    ws.close();
}
main().catch((e) => { console.error('FAIL', e.message); process.exitCode = 1; });
