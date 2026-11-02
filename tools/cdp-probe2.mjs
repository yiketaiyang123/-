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
        if (r.exceptionDetails) return { ERR: r.exceptionDetails.text };
        return r.result?.value;
    };
    const info = await ev(`JSON.stringify({
        genEvents: Object.keys(window.SillyTavern.getContext().eventTypes).filter(k => k.includes('GENERATION')),
        hasEnded: !!window.SillyTavern.getContext().eventTypes.GENERATION_ENDED,
        last: (() => { const c = window.SillyTavern.getContext().chat; const m = c[c.length - 1]; return m ? { is_user: m.is_user, is_system: m.is_system, name: m.name, mes: (m.mes || '').slice(0, 40) } : null; })(),
        settings: window.__ananke.getSettings(),
        debug: window.__anankeDebug || null
    })`);
    console.log('INFO', info);
    const r = await ev(`(() => { const c = window.SillyTavern.getContext(); c.eventSource.emit(c.eventTypes.GENERATION_ENDED); return new Promise(res => setTimeout(() => res('emitted'), 1500)); })()`);
    console.log('EMIT', r);
    console.log('DEBUG', await ev(`JSON.stringify(window.__anankeDebug || null)`));
    console.log('OPTIONS', await ev(`document.querySelectorAll('.ananke-opt').length`));
    console.log('LOGS', await ev(`JSON.stringify((window.__ananke.getLogs() || []).slice(-10).map(l => l.message))`));
    ws.close();
}
main().catch((e) => { console.error('FAIL', e.message); process.exitCode = 1; });
