'use strict';
/* Lógica do bot do Telegram do Fluxo Pessoal. Sem dependências: recebe tudo por "deps",
   o que permite testar sem rede. api/telegram.js e api/reminders.js montam os deps reais. */

const TZ = 'America/Sao_Paulo';
const pad = n => String(n).padStart(2, '0');
const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl = v => BRL.format(v).replace(/ /g, ' ');
const todayBR = now => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
const dstr = d => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
const shiftDay = (s, n) => { const [y, m, d] = s.split('-').map(Number); return dstr(new Date(Date.UTC(y, m - 1, d + n))); };
const diffDays = (a, b) => { const f = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; }; return Math.round(f(b) - f(a)); };
const lastDayOf = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const validDate = s => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || s < '2000-01-01' || s > '2100-12-31') return false; const [y, m, d] = s.split('-').map(Number); return dstr(new Date(Date.UTC(y, m - 1, d))) === s; };
const dm = s => s.slice(8) + '/' + s.slice(5, 7);
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

const KW = {
  'Alimentação': ['alimenta', 'comida', 'mercado', 'supermercado', 'restaurante', 'almoco', 'jantar', 'feira', 'padaria', 'lanche', 'ifood', 'pizza', 'cafe'],
  'Transporte': ['transporte', 'uber', '99', 'combustivel', 'gasolina', 'onibus', 'corrida', 'metro', 'estacionamento', 'pedagio'],
  'Moradia': ['moradia', 'aluguel', 'condominio', 'iptu'],
  'Contas': ['contas', 'conta de', 'luz', 'agua', 'internet', 'telefone', 'celular', 'energia', 'gas'],
  'Saúde': ['saude', 'farmacia', 'consulta', 'remedio', 'medico', 'dentista', 'exame'],
  'Lazer': ['lazer', 'cinema', 'streaming', 'netflix', 'spotify', 'diversao', 'bar', 'show', 'viagem'],
  'Educação': ['educacao', 'curso', 'escola', 'faculdade', 'livro', 'mensalidade']
};

function parseMoney(s) {
  s = String(s).trim().replace(/R\$\s?/i, '').replace(/\s/g, '');
  if (!s) return NaN;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return r2(parseFloat(s));
}

/* resolve "dia N": futuro (vencimentos) ou o mais recente (lançamentos já feitos) */
function resolveDay(today, d, future) {
  let y = +today.slice(0, 4), m = +today.slice(5, 7);
  const cand = (yy, mm) => yy + '-' + pad(mm) + '-' + pad(Math.min(d, lastDayOf(yy, mm)));
  let c = cand(y, m);
  if (future && c < today) { m += 1; if (m > 12) { m = 1; y += 1; } c = cand(y, m); }
  if (!future && c > today) { m -= 1; if (m < 1) { m = 12; y -= 1; } c = cand(y, m); }
  return c;
}

/* "gastei 45 no mercado", "recebi 3000 salário", "conta de luz 150 vence 10/11", "ontem 30 uber" */
function parseMessage(text, ctx) {
  let q = String(text || '').trim().slice(0, 300);
  if (!q) return null;
  const n0 = norm(q), today = ctx.today;
  const pending0 = /(vence|vencimento|vencendo|agend|a pagar|a receber|boleto)/.test(n0);
  let date = null, m;
  if ((m = q.match(/(?<![\d,.\/])(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![\d\/])/))) {
    const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : +today.slice(0, 4), c = y + '-' + pad(+m[2]) + '-' + pad(+m[1]);
    if (validDate(c)) { date = c; q = q.replace(m[0], ' '); }
  }
  if (!date && (m = q.match(/\bdia\s+(\d{1,2})\b/i)) && +m[1] >= 1 && +m[1] <= 31) { date = resolveDay(today, +m[1], pending0); q = q.replace(m[0], ' '); }
  if (!date && /\bontem\b/i.test(q)) { date = shiftDay(today, -1); q = q.replace(/\bontem\b/i, ' '); }
  if (!date && /\bamanh[aã]\b/i.test(q)) { date = shiftDay(today, 1); q = q.replace(/\bamanh[aã]\b/i, ' '); }
  if (!date && /\bhoje\b/i.test(q)) { date = today; q = q.replace(/\bhoje\b/i, ' '); }
  const am = q.match(/(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/);
  if (!am) return null;
  const amt = parseMoney(am[1]);
  if (!(amt > 0) || amt > 9999999.99) return null;
  const income = /(recebi|ganhei|entrou|caiu|salario|freela|rendimento|a receber|pix recebido)/.test(n0);
  const type = income ? 'income' : 'expense';
  if (pending0 && !date) return { needDate: true };
  if (!date) date = today;
  const pending = pending0 || date > today;
  const idx = q.indexOf(am[0]);
  const clean = s => s.replace(/\b(r\$|reais|real)\b/gi, ' ')
    .replace(/\b(vence|vencimento|vencendo|vencem|agendar|agende|agendado|a pagar|a receber)\b/gi, ' ')
    .replace(/^\s*(?:(?:gastei|paguei|comprei|recebi|ganhei|registre|registrar|lance|lancar|lançar|adicione|adicionar|uma?|o|a|um|de|do|da|no|na|em|com|para|pra|dia)\s+)+/i, '')
    .replace(/\s+(?:de|do|da|no|na|em|com|para|pra|dia|em)\s*$/i, '').replace(/\s+/g, ' ').trim();
  const after = clean(q.slice(idx + am[0].length)), before = clean(q.slice(0, idx));
  const names = (type === 'income' ? ctx.incCats : ctx.expCats) || [];
  let cat = names.find(c => !['Outros'].includes(c) && n0.includes(norm(c)));
  if (!cat) {
    if (type === 'income') cat = n0.includes('salario') ? 'Salário' : n0.includes('freela') ? 'Freelance' : (n0.includes('invest') || n0.includes('rendimento')) ? 'Investimentos' : 'Outros';
    else { cat = 'Outros'; for (const [c, ks] of Object.entries(KW)) if (ks.some(k => (k.length <= 3 ? new RegExp('\\b' + k + '\\b').test(n0) : n0.includes(k)))) { cat = c; break; } }
  }
  const desc = cap((after || before || cat).slice(0, 60));
  return { type, desc, amt, cat, date, pending };
}

const HELP = 'Como usar o Fluxo Pessoal por aqui:\n\n'
  + '• Lançar: "gastei 45 no mercado", "recebi 3000 salário", "ontem 30 uber"\n'
  + '• Agendar uma conta: "conta de luz 150 vence 10/11" (ou "vence dia 10")\n'
  + '• /saldo: saldo atual\n• /semana: o que vence nos próximos 7 dias\n• /mes: resumo do mês\n• /ultimos: últimos lançamentos\n• /desfazer: apaga o último lançamento feito por aqui\n• /desconectar: desfaz a ligação com o app\n\n'
  + 'Ainda não entendo áudio nem foto: escreva o lançamento em texto.';

const realized = t => !t.pending;
const sumBy = (l, ty) => r2(l.filter(t => t.type === ty).reduce((a, t) => a + t.amt, 0));
function balanceOf(d) { return r2((d.opening || 0) + d.tx.filter(realized).reduce((a, t) => a + (t.type === 'income' ? t.amt : -t.amt), 0)); }
const catLists = d => ({
  expCats: ['Alimentação', 'Transporte', 'Moradia', 'Contas', 'Saúde', 'Lazer', 'Educação'].concat((d.cats || []).filter(c => c.type === 'expense').map(c => c.name), ['Outros']),
  incCats: ['Salário', 'Freelance', 'Investimentos'].concat((d.cats || []).filter(c => c.type === 'income').map(c => c.name), ['Outros'])
});

function upcoming(d, today, days) {
  return d.tx.filter(t => t.pending && t.date <= shiftDay(today, days)).sort((a, b) => a.date.localeCompare(b.date));
}
function lineOf(t, today) {
  const late = t.date < today ? ' ⚠️ atrasada' : t.date === today ? ' (hoje)' : '';
  return '• ' + dm(t.date) + ' ' + t.desc + ': ' + brl(t.amt) + (t.type === 'income' ? ' a receber' : ' a pagar') + late;
}

async function mutate(db, uid, fn) {
  for (let i = 0; i < 4; i++) {
    const row = await db.getData(uid);
    if (!row || !row.data || !Array.isArray(row.data.tx)) return { missing: true };
    const data = JSON.parse(JSON.stringify(row.data));
    const out = fn(data);
    if (out === false) return { aborted: true };
    if (await db.putData(uid, data, row.updated_at)) return { ok: true, data, out };
  }
  return { conflict: true };
}

async function handleUpdate(u, deps) {
  const { tg, db } = deps, now = deps.now ? deps.now() : new Date(), today = todayBR(now);
  if (!u || typeof u !== 'object') return;

  if (u.callback_query) {
    const cq = u.callback_query, chat = cq.message && cq.message.chat && cq.message.chat.id;
    const link = chat && await db.linkByChat(chat);
    const mm = /^u:([\w-]{1,40})$/.exec(cq.data || '');
    if (!link || !mm) { await tg.answer(cq.id, 'Não foi possível.'); return; }
    const r = await mutate(db, link.user_id, d => {
      const i = d.tx.findIndex(t => t.id === mm[1] && t.src === 'bot');
      if (i < 0) return false;
      d.tx.splice(i, 1); return true;
    });
    await tg.answer(cq.id, r.ok ? 'Lançamento desfeito.' : 'Já não existe.');
    if (r.ok) await tg.send(chat, '↩️ Lançamento desfeito.');
    return;
  }

  const msg = u.message || u.edited_message;
  if (!msg || !msg.chat || msg.chat.type !== 'private' || u.edited_message) return;
  const chat = msg.chat.id, text = typeof msg.text === 'string' ? msg.text.trim() : '';
  const cmd = text.match(/^\/(\w+)(?:@\w+)?(?:\s+([\s\S]*))?$/);

  if (cmd && cmd[1] === 'start' && cmd[2] && cmd[2].trim()) {
    const code = cmd[2].trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const row = code.length >= 6 ? await db.linkByCode(code) : null;
    if (!row || !row.code_expires_at || new Date(row.code_expires_at) < now) {
      await tg.send(chat, 'Esse código não é válido ou já expirou. No app, abra Perfil > Telegram e gere um novo código.');
      return;
    }
    await db.setChat(row.user_id, chat);
    await tg.send(chat, '✅ Conectado! Agora é só escrever, por exemplo: "gastei 45 no mercado".\n\n' + HELP);
    return;
  }
  const link = await db.linkByChat(chat);
  if (!link) {
    await tg.send(chat, 'Olá! Para usar o Fluxo Pessoal por aqui, conecte sua conta: no app, abra Perfil > Telegram e toque em "Conectar". Não precisa enviar senha.');
    return;
  }
  const uidv = link.user_id;
  if (!text) { await tg.send(chat, 'Por enquanto só entendo texto. Escreva o lançamento, por exemplo: "gastei 45 no mercado".'); return; }

  if (cmd) {
    const c = cmd[1].toLowerCase();
    if (c === 'ajuda' || c === 'help' || c === 'start') { await tg.send(chat, HELP); return; }
    if (c === 'desconectar') { await db.unlink(uidv); await tg.send(chat, 'Desconectado. Para voltar, gere um novo código no app.'); return; }
    const row = await db.getData(uidv);
    if (!row || !row.data || !Array.isArray(row.data.tx)) { await tg.send(chat, 'Não encontrei seus dados. Abra o app uma vez para criá-los.'); return; }
    const d = row.data;
    if (c === 'saldo') {
      const pend = d.tx.filter(t => t.pending);
      await tg.send(chat, '💰 Saldo atual: ' + brl(balanceOf(d)) + (pend.length ? '\n' + pend.length + (pend.length === 1 ? ' lançamento agendado' : ' lançamentos agendados') + ' (use /semana).' : ''));
      return;
    }
    if (c === 'semana') {
      const l = upcoming(d, today, 7);
      if (!l.length) { await tg.send(chat, '🗓️ Nada a pagar ou receber nos próximos 7 dias.'); return; }
      await tg.send(chat, '🗓️ Próximos 7 dias\n' + l.slice(0, 20).map(t => lineOf(t, today)).join('\n') + '\n\nA pagar: ' + brl(sumBy(l, 'expense')) + ' · A receber: ' + brl(sumBy(l, 'income')));
      return;
    }
    if (c === 'mes') {
      const k = today.slice(0, 7), l = d.tx.filter(t => realized(t) && t.date.startsWith(k)), inc = sumBy(l, 'income'), out = sumBy(l, 'expense');
      const by = {}; l.filter(t => t.type === 'expense').forEach(t => by[t.cat] = r2((by[t.cat] || 0) + t.amt));
      const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 3);
      let s = '📊 ' + k.slice(5) + '/' + k.slice(0, 4) + '\nRecebido: ' + brl(inc) + '\nGasto: ' + brl(out) + '\nResultado: ' + brl(r2(inc - out));
      if (top.length) s += '\n\nMaiores gastos:\n' + top.map(x => '• ' + x[0] + ': ' + brl(x[1])).join('\n');
      if (d.limit > 0) s += '\n\nLimite do mês: ' + brl(out) + ' de ' + brl(d.limit) + (out > d.limit ? ' (acima!)' : ' · restam ' + brl(r2(d.limit - out)));
      await tg.send(chat, s);
      return;
    }
    if (c === 'ultimos') {
      const l = [...d.tx].sort((a, b) => b.date.localeCompare(a.date) || (b.ts || 0) - (a.ts || 0)).slice(0, 5);
      await tg.send(chat, l.length ? 'Últimos lançamentos\n' + l.map(t => '• ' + dm(t.date) + ' ' + t.desc + ': ' + (t.type === 'income' ? '+' : '−') + brl(t.amt) + (t.pending ? ' (agendada)' : '')).join('\n') : 'Ainda não há lançamentos.');
      return;
    }
    if (c === 'desfazer') {
      const r = await mutate(db, uidv, dd => {
        const bots = dd.tx.filter(t => t.src === 'bot').sort((a, b) => (b.ts || 0) - (a.ts || 0));
        if (!bots.length) return false;
        dd.tx = dd.tx.filter(t => t !== undefined && t.id !== bots[0].id);
        return bots[0];
      });
      await tg.send(chat, r.ok ? '↩️ Apaguei: ' + r.out.desc + ' (' + brl(r.out.amt) + ').' : 'Não há lançamentos feitos por aqui para desfazer.');
      return;
    }
    await tg.send(chat, 'Não conheço esse comando.\n\n' + HELP);
    return;
  }

  /* texto livre: lançamento */
  const first = await db.getData(uidv);
  if (!first || !first.data || !Array.isArray(first.data.tx)) { await tg.send(chat, 'Não encontrei seus dados. Abra o app uma vez para criá-los.'); return; }
  const p = parseMessage(text, Object.assign({ today }, catLists(first.data)));
  if (!p) { await tg.send(chat, 'Não entendi. Escreva o valor e do que se trata, por exemplo: "gastei 45 no mercado" ou "recebi 3000 salário". Digite /ajuda para ver mais.'); return; }
  if (p.needDate) { await tg.send(chat, 'Para agendar, informe o vencimento. Exemplo: "conta de luz 150 vence 10/11" ou "vence dia 10".'); return; }
  const tx = { id: uid(), ts: now.getTime(), type: p.type, desc: p.desc, amt: p.amt, cat: p.cat, date: p.date, src: 'bot' };
  if (p.pending) tx.pending = true;
  const r = await mutate(db, uidv, d => { d.tx.push(tx); return true; });
  if (!r.ok) { await tg.send(chat, r.missing ? 'Não encontrei seus dados. Abra o app uma vez para criá-los.' : 'Não consegui salvar agora. Tente de novo em instantes.'); return; }
  const when = p.date === today ? 'hoje' : dm(p.date);
  const head = p.pending ? '🗓️ Agendada' : p.type === 'income' ? '✅ Receita registrada' : '✅ Despesa registrada';
  await tg.send(chat, head + ': ' + p.desc + '\n' + brl(p.amt) + ' · ' + p.cat + ' · ' + (p.pending ? 'vence ' : '') + when + (p.pending ? '\nEla só entra no saldo quando você marcar como paga no app.' : '\nSaldo: ' + brl(balanceOf(r.data))),
    { inline_keyboard: [[{ text: '↩️ Desfazer', callback_data: 'u:' + tx.id }]] });
}

/* lembretes diários: vencidas, de hoje e de amanhã */
async function sendReminders(deps) {
  const { tg, db } = deps, now = deps.now ? deps.now() : new Date(), today = todayBR(now);
  let sent = 0;
  for (const l of await db.allLinked()) {
    try {
      const row = await db.getData(l.user_id);
      if (!row || !row.data || !Array.isArray(row.data.tx)) continue;
      const items = upcoming(row.data, today, 1);
      if (!items.length) continue;
      await tg.send(l.chat_id, '🔔 Lembrete\n' + items.slice(0, 15).map(t => lineOf(t, today)).join('\n') + '\n\nMarque como pago no app quando resolver.');
      sent++;
    } catch (e) { /* um usuário com problema não pode travar os outros */ }
  }
  return sent;
}

module.exports = { parseMessage, handleUpdate, sendReminders, todayBR, HELP, resolveDay };
