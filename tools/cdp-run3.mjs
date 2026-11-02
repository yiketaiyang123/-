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

    // 强制任务链
    await ev(`(() => { const s = window.__ananke.getSettings(); s.mock = true; s.clickMode = 'fill'; s.probs.task = 1; s.toggles.t3 = true; const st = window.__ananke.getStore(); st.task_chain = null; st.taskCooldown = 0; return true; })()`);
    await ev(`(() => { const c = window.SillyTavern.getContext(); c.eventSource.emit(c.eventTypes.GENERATION_ENDED); return new Promise(r => setTimeout(r, 2500)); })()`);
    console.log('TASK', await ev(`JSON.stringify({ tc: window.__ananke.getStore().task_chain ? { id: window.__ananke.getStore().task_chain.id, name: window.__ananke.getStore().task_chain.名称, events: window.__ananke.getStore().task_chain.事件链?.length } : null, map: !!window.__ananke.getStore().map })`));

    // 强制命运事件（点击选项）
    await ev(`(() => { const s = window.__ananke.getSettings(); s.probs.fate = 1; s.toggles.t5 = true; const st = window.__ananke.getStore(); st.fate.cooldown = 0; return true; })()`);
    const n = await ev(`document.querySelectorAll('.ananke-opt').length`);
    console.log('OPT', n);
    if (n > 0) {
        await ev(`document.querySelector('.ananke-opt').click()`);
        console.log('VALUE', await ev(`document.getElementById('send_textarea')?.value || ''`));
    }
    console.log('FATE', await ev(`JSON.stringify({ history: window.__ananke.getStore().fate.history, cooldown: window.__ananke.getStore().fate.cooldown })`));

    // 面板
    await ev(`window.__ananke.openPanel()`);
    console.log('PANEL', await ev(`!!document.querySelector('.ananke-panel')`));
    console.log('PANEL_TEXT', await ev(`document.querySelector('.ananke-panel')?.textContent.slice(0, 120)`));
    ws.close();
}
main().catch((e) => { console.error('FAIL', e.message); process.exitCode = 1; });
