// Combos de la tienda. Son servicios del catálogo (categoría "Combos"), así su precio se edita en Precios
// como cualquier otro y el cobro usa ese precio. Mientras no se guarde otro, el precio inicial es la suma de los servicios incluidos.
export const COMBO_CAT = 'Combos';
const DEFS = [
  { id: 1001, name: 'Combo Puesta a punto · PC de escritorio', includes: ['Diagnóstico general de PC de escritorio', 'Limpieza interna PC de escritorio', 'Optimización de inicio y rendimiento', 'Instalación de antivirus'] },
  { id: 1002, name: 'Combo Puesta a punto · Notebook', includes: ['Diagnóstico general de notebook', 'Limpieza interna notebook', 'Optimización de inicio y rendimiento', 'Instalación de antivirus'] },
  { id: 1003, name: 'Combo Renovación total', includes: ['Respaldo de datos hasta 100 GB', 'Instalación limpia de Windows (licencia aparte)', 'Instalación de drivers', 'Instalación de aplicaciones básicas', 'Instalación de antivirus'] },
  { id: 1004, name: 'Combo Hogar y empresa · PC de escritorio', includes: ['Mantenimiento preventivo completo PC', 'Inventario y relevamiento de equipos', 'Visita técnica a domicilio (zona urbana)', 'Soporte remoto'] },
  { id: 1005, name: 'Combo Hogar y empresa · Notebook', includes: ['Mantenimiento preventivo completo notebook', 'Inventario y relevamiento de equipos', 'Visita técnica a domicilio (zona urbana)', 'Soporte remoto'] },
];

/** Agrega al catálogo los combos que falten (por id). No toca los que ya existen. */
export function withCombos(db) {
  const have = new Set(db.items.map((i) => i.id));
  for (const d of DEFS) {
    if (have.has(d.id)) continue;
    const price = d.includes.reduce((t, n) => t + (db.items.find((i) => i.name === n)?.price || 0), 0);
    db.items.push({ id: d.id, cat: COMBO_CAT, name: d.name, price: price || null, unit: 'Por combo', note: 'Incluye: ' + d.includes.join(' · '), active: true });
  }
  return db;
}
