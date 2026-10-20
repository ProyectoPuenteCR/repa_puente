import { json, getSession } from './_lib/store.js';
export function GET(request) {
  const s = getSession(request);
  return json({ session: s, admin: s?.role === 'admin', mp: !!process.env.MP_ACCESS_TOKEN });
}
