'use strict';
/* Conexões reais: Telegram e Supabase (com a chave de serviço, só no servidor). */

function makeDeps(env) {
  const base = String(env.SUPABASE_URL || '').replace(/\/+$/, ''), key = String(env.SUPABASE_SERVICE_ROLE_KEY || ''), token = String(env.TELEGRAM_BOT_TOKEN || '');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base) || !key || !token) throw new Error('configuração incompleta');
  const H = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) H.Authorization = 'Bearer ' + key;
  const rest = async (path, o) => {
    o = o || {};
    const r = await fetch(base + '/rest/v1/' + path, { method: o.method || 'GET', headers: Object.assign({}, H, o.headers || {}), body: o.body ? JSON.stringify(o.body) : undefined });
    if (!r.ok) throw new Error('supabase ' + r.status);
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  };
  const q = encodeURIComponent;
  const tgCall = async (method, body) => {
    const r = await fetch('https://api.telegram.org/bot' + token + '/' + method, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('telegram ' + r.status);
  };
  return {
    tg: {
      send: (chat, text, markup) => tgCall('sendMessage', Object.assign({ chat_id: chat, text, disable_web_page_preview: true }, markup ? { reply_markup: markup } : {})),
      answer: (id, text) => tgCall('answerCallbackQuery', { callback_query_id: id, text })
    },
    db: {
      linkByCode: async code => (await rest('telegram_links?code=eq.' + q(code) + '&select=user_id,code_expires_at'))[0] || null,
      linkByChat: async chat => (await rest('telegram_links?chat_id=eq.' + q(chat) + '&select=user_id'))[0] || null,
      setChat: async (userId, chat) => {
        await rest('telegram_links?chat_id=eq.' + q(chat), { method: 'PATCH', body: { chat_id: null }, headers: { Prefer: 'return=minimal' } });
        await rest('telegram_links?user_id=eq.' + q(userId), { method: 'PATCH', body: { chat_id: chat, code: null, code_expires_at: null, linked_at: new Date().toISOString() }, headers: { Prefer: 'return=minimal' } });
      },
      unlink: userId => rest('telegram_links?user_id=eq.' + q(userId), { method: 'PATCH', body: { chat_id: null }, headers: { Prefer: 'return=minimal' } }),
      allLinked: async () => (await rest('telegram_links?chat_id=not.is.null&select=user_id,chat_id')) || [],
      getData: async userId => (await rest('user_data?user_id=eq.' + q(userId) + '&select=data,updated_at'))[0] || null,
      /* só grava se ninguém alterou no meio do caminho (o app também grava nessa linha) */
      putData: async (userId, data, prev) => {
        const rows = await rest('user_data?user_id=eq.' + q(userId) + '&updated_at=eq.' + q(prev), { method: 'PATCH', body: { data }, headers: { Prefer: 'return=representation' } });
        return Array.isArray(rows) && rows.length > 0;
      }
    }
  };
}
module.exports = { makeDeps };
