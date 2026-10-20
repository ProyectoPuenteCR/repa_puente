import { json, fail, getSession, getUsers, saveUsers, newUser, setPass, publicUser, ROLES } from './_lib/store.js';

const USER_RE = /^[a-z0-9._-]{3,32}$/;
const guard = (request) => {
  const s = getSession(request);
  if (!s) return [null, json({ error: 'Iniciá sesión.' }, 401)];
  if (s.role !== 'admin') return [null, json({ error: 'Solo un administrador puede gestionar usuarios.' }, 403)];
  return [s, null];
};
const body = async (request) => { try { return await request.json(); } catch { return {}; } };
const admins = (users) => users.filter((u) => u.role === 'admin').length;

export async function GET(request) {
  const [, err] = guard(request); if (err) return err;
  try { return json({ users: (await getUsers()).map(publicUser), roles: ROLES }); } catch (e) { return fail(e); }
}

// Crear usuario: { user, name, pass, role }
export async function POST(request) {
  const [s, err] = guard(request); if (err) return err;
  const b = await body(request);
  const user = String(b.user || '').trim().toLowerCase(), name = String(b.name || '').trim().slice(0, 80);
  const pass = String(b.pass || ''), role = String(b.role || '');
  if (!USER_RE.test(user)) return json({ error: 'El usuario debe tener entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo.' }, 400);
  if (pass.length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);
  if (!ROLES.includes(role)) return json({ error: 'Rol inválido.' }, 400);
  try {
    const users = await getUsers();
    if (users.some((u) => u.user === user)) return json({ error: `Ya existe el usuario “${user}”.` }, 409);
    users.push(newUser({ user, name, pass, role }, s.user));
    await saveUsers(users);
    return json({ ok: true, user: publicUser(users.at(-1)) }, 201);
  } catch (e) { return fail(e); }
}

// Editar: { user, role?, name?, pass? }
export async function PATCH(request) {
  const [s, err] = guard(request); if (err) return err;
  const b = await body(request);
  try {
    const users = await getUsers();
    const u = users.find((x) => x.user === String(b.user || '').toLowerCase());
    if (!u) return json({ error: 'Usuario no encontrado.' }, 404);
    if (b.role != null) {
      if (!ROLES.includes(b.role)) return json({ error: 'Rol inválido.' }, 400);
      if (u.role === 'admin' && b.role !== 'admin' && admins(users) === 1) return json({ error: 'Tiene que quedar al menos un administrador.' }, 400);
      if (u.user === s.user && b.role !== 'admin') return json({ error: 'No podés quitarte tu propio rol de administrador.' }, 400);
      u.role = b.role;
    }
    if (b.name != null) u.name = String(b.name).trim().slice(0, 80);
    if (b.pass != null) {
      if (String(b.pass).length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);
      setPass(u, b.pass);
    }
    await saveUsers(users);
    return json({ ok: true, user: publicUser(u) });
  } catch (e) { return fail(e); }
}

// Borrar: ?user=nombre
export async function DELETE(request) {
  const [s, err] = guard(request); if (err) return err;
  const name = String(new URL(request.url).searchParams.get('user') || '').toLowerCase();
  if (name === s.user) return json({ error: 'No podés borrar tu propio usuario.' }, 400);
  try {
    const users = await getUsers();
    const u = users.find((x) => x.user === name);
    if (!u) return json({ error: 'Usuario no encontrado.' }, 404);
    if (u.role === 'admin' && admins(users) === 1) return json({ error: 'Tiene que quedar al menos un administrador.' }, 400);
    await saveUsers(users.filter((x) => x !== u));
    return json({ ok: true });
  } catch (e) { return fail(e); }
}
