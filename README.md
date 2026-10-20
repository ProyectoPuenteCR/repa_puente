# Puente Service · Reparación de PC

Tienda de servicios de reparación con carrito, pago por Mercado Pago, panel de precios y gestión de usuarios.

## Usuarios y roles

- **Administrador**: edita precios, ve y marca pedidos, crea y administra usuarios (pestaña *Usuarios*, ruta `#/usuarios`).
- **Visitante**: navega, arma el carrito y paga. Para generar el pedido tiene que ingresar con su usuario.
- Los usuarios se guardan en el Blob (`db/users.json`) con la contraseña hasheada (scrypt).
- `ADMIN_USER` / `ADMIN_PASS` siguen funcionando como administrador de respaldo: sirven para entrar la primera vez y crear los usuarios reales. Cambiá `ADMIN_PASS` por una contraseña propia.

## Pago

Por defecto se cobra con el link fijo `https://link.mercadopago.com.ar/repopuente` (variable `MP_LINK` para cambiarlo). El sistema registra el pedido, muestra el monto a pagar y el número de pedido; el cliente escribe ese monto en Mercado Pago. El link fijo no avisa los pagos, así que el administrador marca cada pedido como *pagado* desde la lista de pedidos.

Si se carga `MP_ACCESS_TOKEN`, en vez del link fijo se genera una preferencia con el monto exacto y el estado se actualiza solo por webhook.

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
| POST | `/api/login` / `/api/logout` | Sesión (cookie firmada con usuario y rol) |
| GET | `/api/me` | Sesión actual |
| GET/POST/PATCH/DELETE | `/api/users` | Gestión de usuarios (admin) |
| POST | `/api/checkout` | Requiere sesión. Recalcula precios en el servidor, crea el pedido y devuelve el link de pago |
| GET / PATCH | `/api/orders` | Últimos pedidos y cambio de estado (admin) |
| POST | `/api/mp-webhook` | Mercado Pago avisa pagos y se actualiza el estado del pedido |
