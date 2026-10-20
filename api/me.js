import { json, getSession, getUsers } from './_lib/store.js';
export async function GET(request) {
  const s = getSession(request);
  let profile = null;
  if (s) { try { const u = (await getUsers()).find((x) => x.user === s.user); if (u) profile = { name: u.name || '', phone: u.phone || '', address: u.address || '' }; } catch {} }
  return json({ session: s, profile, admin: s?.role === 'admin', mp: !!process.env.MP_ACCESS_TOKEN });
}
