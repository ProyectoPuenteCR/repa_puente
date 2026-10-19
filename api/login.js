import { json, checkLogin, sessionCookie } from './_lib/store.js';
export async function POST(request) {
  let b = {}; try { b = await request.json(); } catch {}
  if (!checkLogin(b.user || '', b.pass || '')) return json({ error: 'Usuario o contraseña incorrectos.' }, 401);
  try { return json({ ok: true }, 200, { 'set-cookie': sessionCookie(b.user) }); } catch (e) { return json({ error: e.message }, 503); }
}
