# Puente Service · Reparación de PC

Tienda de servicios de reparación con carrito, link de pago de Mercado Pago y panel de precios.

- `public/index.html`: la tienda (HTML + JS, sin build).
- `api/`: funciones de Vercel (catálogo, login, pedidos, checkout, webhook de Mercado Pago).
- Base de datos: **Vercel Blob** privado (gratis en el plan Hobby). Guarda `db/catalog.json` y un archivo por pedido en `orders/`.
- `data/seed.js`: lista de precios original del Excel. Se usa hasta el primer guardado.

## Publicarlo

1. **Subir el proyecto**: desde esta carpeta, `npx vercel --prod` (o subir la carpeta a GitHub e importarla en Vercel con *Add New → Project*). No necesita configuración: Vercel toma `vercel.json`.
2. **Crear la base de datos**: en el proyecto, pestaña *Storage → Create → Blob*, acceso **Private**, y *Connect* al proyecto. Eso agrega `BLOB_READ_WRITE_TOKEN` solo.
3. **Variables de entorno** (*Settings → Environment Variables*): `ADMIN_USER`, `ADMIN_PASS`, `SESSION_SECRET` (opcional: si falta se deriva del token del Blob). Cambiá la contraseña `Admin` por una propia.
4. **Mercado Pago (opcional)**: cargá `MP_ACCESS_TOKEN`. Con un token `TEST-...` los links son de prueba; con uno de producción cobran de verdad. Sin token, el carrito genera links de demostración y igual guarda el pedido.
5. *Redeploy* para que tome las variables.

## Rutas de la API

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/catalog` | Catálogo público |
| PUT | `/api/catalog` | Guardar precios (admin) · `{reset:true}` restaura el Excel |
| POST | `/api/login` / `/api/logout` | Sesión de administrador (cookie firmada) |
| GET | `/api/me` | ¿Hay sesión? |
| POST | `/api/checkout` | Recalcula precios en el servidor, crea el pedido y la preferencia de Mercado Pago |
| GET | `/api/orders` | Últimos pedidos (admin) |
| POST | `/api/mp-webhook` | Mercado Pago avisa pagos y se actualiza el estado del pedido |
