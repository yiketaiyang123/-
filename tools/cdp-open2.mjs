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
    await send('Page.enable');
    await send('Page.reload', { ignoreCache: true });
    await new Promise((r) => setTimeout(r, 8000));
    console.log(await ev(`(async () => {
        const m = await import('/script.js');
        const ctx = window.SillyTavern.getContext();
        const ch = ctx.characters.find(c => String(c.name).includes('阿卡迪亚'));
        const idx = ctx.characters.indexOf(ch);
        await m.selectCharacterById(idx, { switchMenu: false });
        await m.doNewChat({});
        await new Promise(r => setTimeout(r, 1500));
        const c2 = window.SillyTavern.getContext();
        return JSON.stringify({ idx, name2: c2.name2, chatLen: (c2.chat || []).length, last: (() => { const c = c2.chat; const x = c[c.length-1]; return x ? { is_user: x.is_user, is_system: x.is_system, name: x.name, len: (x.mes||'').length } : null; })() });
    })()`));
    ws.close();
}
main().catch((e) => { console.error('FAIL', e.message); process.exitCode = 1; });
