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
    console.log(await ev(`JSON.stringify((window.SillyTavern.getContext().chat||[]).map((m,i)=>({i,is_user:m.is_user,name:m.name,head:(m.mes||'').slice(0,80)})))`));
    console.log(await ev(`JSON.stringify((()=>{const o=window.oai_settings||{};return {source:o.chat_completion_source, custom: !!o.custom_url, ollama: !!o.ollama_model, model:o.openai_model, hasKey:!!o.proxy_password};})())`));
    console.log('LOGS', await ev(`JSON.stringify((window.__ananke.getLogs()||[]).slice(-8).map(l=>l.message))`));
    ws.close();
}
main().catch((e) => { console.error('FAIL', e.message); process.exitCode = 1; });
