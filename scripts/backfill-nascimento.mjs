// USO: EXPO_TOKEN nao serve aqui. `export FEEGOW_MCP_TOKEN=... && MAX=110 node scripts/backfill-nascimento.mjs`
// Retomavel: grava ckpt.jsonl linha a linha. Rode em lotes de ~110 — acima disso a Feegow
// devolve {"error":"rate limit"} em JSON puro (sem envelope SSE). NAO rodar em background:
// nohup/& NAO sobrevive entre chamadas de tool no container, o processo morre sem gravar.
// ═══ BLOCO: BACKFILL-NASCIMENTO-FEEGOW ═══
// Le o campo `nascimento` de cada paciente vinculado e emite APENAS
// {feegow_paciente_id, nascimento_iso, motivo}. Nome/CPF/telefone NAO
// saem daqui de proposito: dado de saude de terceiro nao vai para log.
const fs = require('fs');

const URL_MCP =
  'https://erp-dimplus.vercel.app/api/mcp/feegow/' +
  process.env.FEEGOW_MCP_TOKEN;

// Feegow devolve nascimento em d-m-Y ("29-04-1964"). `new Date()` nessa
// string e Invalid Date SILENCIOSO — parse explicito, sempre.
function parseNascimentoBR(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null; // string vazia e forma REAL nessa API (vide `documento`)
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = Number(dd), mo = Number(mm), y = Number(yyyy);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  if (y < 1900) return null; // CHECK do banco recusaria
  // round-trip: rejeita 31-02-1990 e afins
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  if (dt.getTime() >= Date.now()) return null; // futuro: CHECK recusaria
  return `${yyyy}-${mm}-${dd}`;
}

async function detalhe(id) {
  const res = await fetch(URL_MCP, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    // sem timeout, uma chamada pendurada trava o lote inteiro
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name: 'feegow_paciente_detalhe', arguments: { paciente_id: id } },
    }),
  });
  const txt = await res.text();
  // resposta vem como SSE: linhas `data: {...}`
  const line = txt.split('\n').find((l) => l.startsWith('data:'));
  if (!line) {
    // rate limit e erro de transporte NAO vem em envelope SSE, vem JSON puro.
    // Sem distinguir, o retry trata "espera um pouco" como "dado ruim".
    try {
      const j = JSON.parse(txt);
      if (j && j.error) throw new Error('RATELIMIT:' + JSON.stringify(j.error).slice(0, 60));
    } catch (e) { if (String(e.message).startsWith('RATELIMIT')) throw e; }
    throw new Error('sem data: ' + txt.slice(0, 100));
  }
  const env = JSON.parse(line.slice(5).trim());
  if (env.error) throw new Error('rpc: ' + JSON.stringify(env.error).slice(0, 120));
  const inner = env.result?.content?.[0]?.text;
  if (!inner) throw new Error('sem content');
  return JSON.parse(inner);
}

(async () => {
  const CKPT = '/home/claude/bf/ckpt.jsonl';
  const MAX = Number(process.env.MAX || 120);

  const ids = fs.readFileSync('/home/claude/bf/ids.lst', 'utf8')
    .split('\n').map((s) => s.trim()).filter(Boolean).map(Number);

  // retomavel: nao refaz o que ja tem linha no checkpoint
  const feitos = new Set();
  if (fs.existsSync(CKPT)) {
    for (const l of fs.readFileSync(CKPT, 'utf8').split('\n')) {
      if (!l.trim()) continue;
      try { feitos.add(JSON.parse(l).id); } catch {}
    }
  }
  const pend = ids.filter((i) => !feitos.has(i)).slice(0, MAX);

  let ok = 0, vazio = 0, erro = 0;
  for (const id of pend) {
    let rec = null;
    for (let tent = 1; tent <= 3 && !rec; tent++) {
      try {
        const p = await detalhe(id);
        const iso = parseNascimentoBR(p.nascimento);
        rec = iso
          ? { id, iso, motivo: 'ok' }
          : {
              id, iso: null,
              motivo: p.nascimento ? 'informe_invalido' : 'vazio_na_origem',
              // string bruta so nos invalidos: e data, nao identifica ninguem
              ...(p.nascimento ? { raw: String(p.nascimento).slice(0, 20) } : {}),
            };
      } catch (e) {
        if (tent === 3) rec = { id, iso: null, motivo: 'erro:' + String(e.message).slice(0, 60) };
        else {
          const rate = String(e.message).includes('RATELIMIT');
          await new Promise((r) => setTimeout(r, (rate ? 6000 : 500) * tent));
        }
      }
    }
    fs.appendFileSync(CKPT, JSON.stringify(rec) + '\n');
    if (rec.motivo === 'ok') ok++; else if (rec.motivo === 'vazio_na_origem') vazio++; else erro++;
    await new Promise((r) => setTimeout(r, 350));
  }
  console.log(JSON.stringify({ lote: pend.length, ok, vazio, erro, restam: ids.length - feitos.size - pend.length }));
})();
// ── FIM BLOCO ──
