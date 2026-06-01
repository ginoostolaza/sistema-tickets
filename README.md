# TicketPro Escolar

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

## Funciones principales

- Registro e inicio de sesión con persistencia en `localStorage`.
- Redirección automática al panel admin cuando el usuario tiene rol `admin`.
- Creación de tickets con número automático, prioridad, categoría, responsable y evidencias en imágenes.
- Búsqueda por número de ticket, título, estado, prioridad, categoría o responsable.
- Panel administrativo para ver y cambiar todos los tickets.
- Kanban por estados: Abierto, En progreso, Resuelto y Cerrado.
- Inventario de hardware con ubicación, serial, estado y asignación.
- Dashboard con métricas y reportes de cantidad de tickets, tiempo promedio de resolución y edad promedio desde creación en días, horas, minutos y segundos.
- Descarga de reporte en archivo TXT.
