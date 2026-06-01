# TicketPro Escolar

Sistema web tipo SPA para un deber escolar de mesa de ayuda. Incluye autenticación, roles de usuario/administrador, creación y búsqueda de tickets, subida de imágenes, inventario de hardware, Kanban administrativo, dashboard y reportes de tiempos. Puede trabajar en modo local para demostración o sincronizar con una base de datos Supabase.
Sistema web tipo SPA para un deber escolar de mesa de ayuda. Incluye autenticación local, roles de usuario/administrador, creación y búsqueda de tickets, subida de imágenes, inventario de hardware, Kanban administrativo, dashboard y reportes de tiempos.

## Cómo ejecutar

Abre `index.html` directamente en el navegador o levanta un servidor estático:

```bash
python3 -m http.server 4173
```

Luego entra a <http://localhost:4173>.

## Credenciales demo

- Administrador: `admin@escuela.local` / `admin123`
- Código para registrar un nuevo administrador: `ADMIN2026`

## Configurar Supabase

1. Crea un proyecto en Supabase.
2. Abre **SQL Editor** y ejecuta el archivo `supabase-schema.sql`.
3. En la aplicación entra con el administrador demo.
4. Abre **Supabase** en el menú lateral.
5. Pega tu **Project URL** y tu **anon public key**.
6. Presiona **Guardar y conectar**.

> Nota: las políticas RLS del archivo SQL están abiertas porque es un prototipo escolar con `anon key`. Para producción se recomienda usar Supabase Auth real, JWT claims por rol y reglas RLS estrictas.

## Funciones principales

- Registro e inicio de sesión con persistencia local y sincronización opcional en Supabase.
## Funciones principales

- Registro e inicio de sesión con persistencia en `localStorage`.
- Redirección automática al panel admin cuando el usuario tiene rol `admin`.
- Creación de tickets con número automático, prioridad, categoría, responsable y evidencias en imágenes.
- Búsqueda por número de ticket, título, estado, prioridad, categoría o responsable.
- Panel administrativo para ver y cambiar todos los tickets.
- Kanban por estados: Abierto, En progreso, Resuelto y Cerrado.
- Inventario de hardware con ubicación, serial, estado y asignación.
- Dashboard con métricas y reportes de cantidad de tickets, tiempo promedio de resolución, backlog y SLA vencido.
- Filtros profesionales por estado, prioridad y categoría.
- Descarga de reportes en TXT y CSV.
- Dashboard con métricas y reportes de cantidad de tickets, tiempo promedio de resolución y edad promedio desde creación en días, horas, minutos y segundos.
- Descarga de reporte en archivo TXT.
- Sección profesional de configuración con checklist, estado de sincronización y bordes/estilos consistentes.

## Fuentes oficiales consultadas

- Supabase JavaScript Client: <https://supabase.com/docs/reference/javascript>
- Supabase Row Level Security: <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Supabase Security: <https://supabase.com/docs/guides/security>

## Archivos importantes

- `index.html`: punto de entrada de la SPA.
- `app.js`: lógica de autenticación, tickets, inventario, admin, Kanban y reportes.
- `supabaseClient.js`: adaptador opcional para sincronizar datos con Supabase.
- `supabase-schema.sql`: tablas, índices, trigger `updated_at`, vista de métricas y políticas RLS de ejemplo para el proyecto.
- `supabase-schema.sql`: tablas y políticas RLS de ejemplo para el proyecto.
- `styles.css`: diseño responsive profesional.
