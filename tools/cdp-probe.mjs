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
        if (r.exceptionDetails) return { error: r.exceptionDetails.text };
        return r.result?.value;
    };
    await send('Page.enable');
    await send('Page.reload', { ignoreCache: true });
    await new Promise((r) => setTimeout(r, 9000));
    const out = await ev(`JSON.stringify({
        hasAnanke: !!window.__ananke,
        hasTH: !!window.TavernHelper,
        chatLen: (window.SillyTavern?.getContext?.().chat || []).length,
        last: (() => { const c = window.SillyTavern?.getContext?.().chat || []; const m = c[c.length-1]; return m ? { is_user: m.is_user, name: m.name, len: (m.mes||'').length } : null; })(),
        hasChatEl: !!document.querySelector('#chat'),
        mesCount: document.querySelectorAll('#chat .mes').length,
        charList: document.querySelectorAll('#rm_print_characters_block .character_select').length,
        charPanel: !!document.querySelector('#right-nav-panel'),
        welcome: !!document.querySelector('.welcome') || !!document.querySelector('#welcome_logo'),
        characterId: window.SillyTavern?.getContext?.().characterId,
        name2: window.SillyTavern?.getContext?.().name2,
        logs: (window.__ananke?.getLogs?.() || []).slice(-8).map(l => l.message)
    })`);
    console.log(out);
    ws.close();
}
main().catch((e) => { console.error('PROBE_FAIL', e.message); process.exitCode = 1; });
