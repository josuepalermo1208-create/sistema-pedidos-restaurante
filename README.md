# Lumbre POS

Aplicación web en español para el menú digital y la operación diaria de un
restaurante. Incluye vistas para comensales, gerencia, cocina/barra, servicio,
caja y administración de red.

## Iniciar la aplicación

Requiere Node.js. Desde la carpeta del proyecto:

```bash
npm install
npm run dev
```

Para validar o generar la versión de producción:

```bash
npm run lint
npm run build
```

## Perfiles de demostración

En **Acceso de personal**, selecciona un perfil de demostración para completar
su usuario. La contraseña de demostración es `Lumbre2026`.

| Perfil | Usuario |
| --- | --- |
| Gerencia | `gerente` |
| Cocina | `cocina` |
| Servicio | `mesero` |
| Caja | `cajero` |
| Administrador de red | `adminred` |

El comensal puede explorar el menú sin iniciar sesión. Selecciona la mesa en la
parte superior para enviar pedidos y consultar su cuenta.

## Flujos incluidos

- El comensal arma un pedido, agrega comentarios por producto, lo envía al área
  correspondiente y solicita su cuenta con método de pago.
- Cocina y barra reciben sus propias comandas, actualizan su preparación y
  marcan los pedidos listos.
- Servicio ve las mesas, confirma entregas y atiende solicitudes de cuenta.
- Caja cobra en efectivo o tarjeta, calcula el cambio y consulta el corte del
  turno.
- Gerencia administra productos, mesas y personal, y consulta pedidos y
  reportes de ventas.
- Administración de red monitorea dispositivos, registra equipos, consulta la
  bitácora y genera o restaura respaldos JSON.

## Alcance de esta versión

Esta entrega es un prototipo funcional de frontend. Los datos se conservan en
el almacenamiento local del navegador y se sincronizan entre pestañas del
mismo navegador; **no hay API ni base de datos compartida entre dispositivos**.
La autenticación y las credenciales de demostración no sustituyen un sistema de
identidad real. Los respaldos son manuales; para producción se requiere un
backend con contraseñas protegidas, sesiones con expiración, sincronización en
tiempo real y almacenamiento seguro. Los respaldos diarios o semanales de esta
demostración se generan únicamente mientras la aplicación permanece abierta;
en producción deben ejecutarse en el servidor.

Para comenzar de nuevo, borra los datos del sitio en el navegador.
