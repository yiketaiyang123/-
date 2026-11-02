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
    await ev(`(() => { const s = window.__ananke.getSettings(); s.clickMode = 'send'; s.mock = false; s.probs = { task: 0, map: 0, fate: 0 }; const c = window.SillyTavern.getContext(); c.eventSource.emit(c.eventTypes.GENERATION_ENDED); return true; })()`);
    await new Promise((r) => setTimeout(r, 4000));
    const before = await ev(`window.SillyTavern.getContext().chat.length`);
    console.log('OPT', await ev(`document.querySelectorAll('.ananke-opt').length`), 'BEFORE', before);
    await ev(`document.querySelector('.ananke-opt').click()`);
    await new Promise((r) => setTimeout(r, 3500));
    console.log(await ev(`JSON.stringify({
        after: window.SillyTavern.getContext().chat.length,
        last: (() => { const c = window.SillyTavern.getContext().chat; const m = c[c.length-1]; return m ? { is_user: m.is_user, head: (m.mes||'').slice(0, 60) } : null; })(),
        clicked: window.__ananke.getStore().options?.clicked
    })`));
    ws.close();
}
main().catch((e) => { console.error('FAIL', e.message); process.exitCode = 1; });
