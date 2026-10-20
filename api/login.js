import { json, fail, checkLogin, sessionCookie } from './_lib/store.js';
export async function POST(request) {
  let b = {}; try { b = await request.json(); } catch {}
  try {
    const s = await checkLogin(b.user || '', b.pass || '');
    if (!s) return json({ error: 'Usuario o contraseña incorrectos.' }, 401);
    return json({ ok: true, ...s }, 200, { 'set-cookie': sessionCookie(s) });
  } catch (e) { return fail(e); }
}
