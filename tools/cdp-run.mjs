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
    const wait = async (expr, timeout = 20000) => {
        const t0 = Date.now();
        while (Date.now() - t0 < timeout) {
            try { if (await ev(expr)) return true; } catch { /* ignore */ }
            await new Promise((r) => setTimeout(r, 400));
        }
        return false;
    };
    await send('Page.enable');
    await send('Page.reload', { ignoreCache: true });
    await new Promise((r) => setTimeout(r, 8000));
    console.log('LOADED', await ev(`!!(window.__ananke && window.SillyTavern)`));
    const opened = await ev(`(async () => {
        const m = await import('/script.js');
        const ctx = window.SillyTavern.getContext();
        const ch = ctx.characters.find(c => String(c.name).includes('阿卡迪亚')) || ctx.characters[0];
        const idx = ctx.characters.indexOf(ch);
        await m.selectCharacterById(idx);
        await m.doNewChat({});
        return JSON.stringify({ idx, name: ch.name });
    })()`);
    console.log('OPENED', opened);
    console.log('CHAT', await wait(`(window.SillyTavern.getContext().chat || []).length > 0`, 15000));
    await ev(`(() => { const s = window.__ananke.getSettings(); s.mock = true; s.clickMode = 'fill'; return true; })()`);
    await new Promise((r) => setTimeout(r, 600));
    await ev(`(() => { const c = window.SillyTavern.getContext(); c.eventSource.emit(c.eventTypes.GENERATION_ENDED); return new Promise(res => setTimeout(res, 2500)); })()`);
    console.log('DEBUG', await ev(`JSON.stringify(window.__anankeDebug || null)`));
    console.log('LOGS', await ev(`JSON.stringify((window.__ananke.getLogs() || []).slice(-12).map(l => l.message))`));
    const n = await ev(`document.querySelectorAll('.ananke-opt').length`);
    console.log('OPTIONS', n);
    if (n > 0) {
        await ev(`document.querySelector('.ananke-opt').click()`);
        console.log('VALUE', await ev(`document.getElementById('send_textarea')?.value || ''`));
    }
    console.log('STORE', await ev(`JSON.stringify({ options: window.__ananke.getStore().options, attrs: window.__ananke.getStore().attributes, wb: Object.keys(window.__ananke.getStore().worldbook?.catalog || {}).length })`));
    ws.close();
}
main().catch((e) => { console.error('FAIL', e.message); process.exitCode = 1; });
