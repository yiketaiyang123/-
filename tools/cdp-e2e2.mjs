const CDP = 'http://127.0.0.1:9222';

async function main() {
    const list = await (await fetch(`${CDP}/json/list`)).json();
    const target = list.find((t) => t.type === 'page' && t.url.includes('8000')) || list.find((t) => t.type === 'page');
    if (!target) throw new Error('no page');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let seq = 0; const pending = new Map();
    ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result); }
    };
    await new Promise((r) => (ws.onopen = r));
    const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
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

    const opened = await ev(`(async () => {
        const m = await import('/script.js');
        const ctx = window.SillyTavern.getContext();
        const ch = ctx.characters.find(c => String(c.name).includes('阿卡迪亚')) || ctx.characters[0];
        await m.selectCharacterById(ch.chid);
        await m.doNewChat({});
        return JSON.stringify({ chid: ch.chid, name: ch.name });
    })()`);
    console.log('OPENED', opened);
    const ready = await wait(`(window.SillyTavern.getContext().chat || []).length > 0 && document.querySelectorAll('#chat .mes').length > 0`, 15000);
    console.log('CHAT_READY', ready);

    await ev(`(() => { const s = window.__ananke.getSettings(); s.mock = true; s.clickMode = 'fill'; return true; })()`);
    await new Promise((r) => setTimeout(r, 500));
    await ev(`(() => { const c = window.SillyTavern.getContext(); c.eventSource.emit(c.eventTypes.GENERATION_ENDED); return true; })()`);

    const optReady = await wait(`document.querySelectorAll('.ananke-opt').length >= 5`, 20000);
    const optCount = await ev(`document.querySelectorAll('.ananke-opt').length`);
    const optText = await ev(`Array.from(document.querySelectorAll('.ananke-opt')).map(e => e.textContent.trim()).join(' || ')`);
    console.log('OPTIONS_READY', optReady, 'COUNT', optCount);
    console.log('OPTIONS', optText);

    if (optCount >= 1) {
        await ev(`document.querySelector('.ananke-opt').click()`);
        const filled = await wait(`(document.getElementById('send_textarea')?.value || '').includes('元叙事')`, 8000);
        const value = await ev(`document.getElementById('send_textarea')?.value || ''`);
        console.log('FILLED', filled);
        console.log('VALUE', value);
    }

    const state = await ev(`JSON.stringify({
        chatLen: (window.SillyTavern.getContext().chat || []).length,
        options: window.__ananke.getStore().options ? { clicked: window.__ananke.getStore().options.clicked, n: window.__ananke.getStore().options.items.length } : null,
        attrs: window.__ananke.getStore().attributes,
        logs: (window.__ananke.getLogs() || []).slice(-10).map(l => l.message)
    })`);
    console.log('STATE', state);
    ws.close();
}
main().catch((e) => { console.error('E2E2_FAIL', e.message); process.exitCode = 1; });
