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
    await ev(`(() => { const c = window.SillyTavern.getContext(); c.eventSource.emit(c.eventTypes.GENERATION_ENDED); return true; })()`);
    await new Promise((r) => setTimeout(r, 4000));
    console.log(await ev(`JSON.stringify({
        tc: window.__ananke.getStore().task_chain ? { current: window.__ananke.getStore().task_chain.current, status: window.__ananke.getStore().task_chain.status, result: window.__ananke.getStore().task_chain.节点结果 } : null,
        map: window.__ananke.getStore().map ? { pos: window.__ananke.getStore().map.当前位置, explored: window.__ananke.getStore().map.explored, r2: (window.__ananke.getStore().map.区域||[]).find(r=>r.编号==='②')?.状态 } : null,
        options: document.querySelectorAll('.ananke-opt').length
    })`));
    ws.close();
}
main().catch((e) => { console.error('FAIL', e.message); process.exitCode = 1; });
