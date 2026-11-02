/**
 * 临时 E2E 驱动：CDP 连接 headless Edge，驱动真实 SillyTavern 页面。
 * 不随插件发布，只用于本地验收。
 */
const CDP = 'http://127.0.0.1:9222';

async function main() {
    const list = await (await fetch(`${CDP}/json/list`)).json();
    const target = list.find((t) => t.type === 'page' && t.url.includes('8000')) || list.find((t) => t.type === 'page');
    if (!target) throw new Error('没有可用的页面 target');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let seq = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && pending.has(msg.id)) {
            const { resolve, reject } = pending.get(msg.id);
            pending.delete(msg.id);
            if (msg.error) reject(new Error(msg.error.message));
            else resolve(msg.result);
        }
    };
    await new Promise((r) => (ws.onopen = r));
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression) => {
        const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'evaluate error');
        return r.result?.value;
    };
    const waitFor = async (expression, timeout = 30000, interval = 500) => {
        const t0 = Date.now();
        while (Date.now() - t0 < timeout) {
            try { if (await evaluate(expression)) return true; } catch { /* ignore */ }
            await new Promise((r) => setTimeout(r, interval));
        }
        return false;
    };

    await send('Runtime.enable');
    await send('Page.enable');

    const loaded = await waitFor(`!!(window.SillyTavern && window.SillyTavern.getContext && document.querySelector('#ananke-fab'))`, 40000);
    const info = await evaluate(`JSON.stringify({
        url: location.href,
        loaded: ${loaded},
        hasTH: !!window.TavernHelper,
        wand: !!document.querySelector('#ananke-wand'),
        fab: !!document.querySelector('#ananke-fab'),
        chars: (window.SillyTavern?.getContext?.().characters || []).length,
        chatLen: (window.SillyTavern?.getContext?.().chat || []).length
    })`);
    console.log('INFO', info);

    // 设置 mock + 只填输入框
    await evaluate(`(() => {
        const ctx = window.SillyTavern.getContext();
        const es = ctx.extensionSettings || window.extension_settings;
        const s = es['fate-weaver'] || (es['fate-weaver'] = {});
        s.mock = true; s.clickMode = 'fill';
        return true;
    })()`);

    // 选一个角色
    const picked = await evaluate(`(() => {
        const el = document.querySelector('#rm_print_characters_block .character_select');
        if (!el) return 'none';
        const id = el.getAttribute('chid') || el.dataset.chid || '';
        el.click();
        return id || 'clicked';
    })()`);
    console.log('PICK', picked);

    const hasMes = await waitFor(`!!document.querySelector('#chat .mes')`, 15000);
    console.log('HAS_MES', hasMes);

    // 触发一次“生成结束”，让插件跑 mock T2
    await evaluate(`(() => {
        const c = window.SillyTavern.getContext();
        c.eventSource.emit(c.eventTypes.GENERATION_ENDED);
        return true;
    })()`);

    const optsReady = await waitFor(`document.querySelectorAll('.ananke-opt').length >= 5`, 15000);
    const optCount = await evaluate(`document.querySelectorAll('.ananke-opt').length`);
    const optText = await evaluate(`Array.from(document.querySelectorAll('.ananke-opt')).map(e => e.textContent.trim()).join(' || ')`);
    console.log('OPTIONS_READY', optsReady, 'COUNT', optCount);
    console.log('OPTIONS', optText);

    if (optCount >= 1) {
        await evaluate(`document.querySelector('.ananke-opt').click()`);
        const filled = await waitFor(`(document.getElementById('send_textarea')?.value || '').includes('元叙事')`, 8000);
        const value = await evaluate(`document.getElementById('send_textarea')?.value || ''`);
        console.log('FILLED', filled);
        console.log('VALUE', value);
    }

    const store = await evaluate(`JSON.stringify((window.SillyTavern?.getContext?.().chatMetadata?.extensions || {})['fate-weaver-v2'] || null)`);
    console.log('STORE', store);

    ws.close();
}

main().catch((e) => { console.error('E2E_FAIL', e.message); process.exitCode = 1; });
