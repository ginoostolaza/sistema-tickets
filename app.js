import { clearSupabaseConfig, createSupabaseDataSource, getSupabaseConfig, hasSupabaseConfig, saveSupabaseConfig } from './supabaseClient.js';

const STORAGE_KEY = 'ticketpro-escolar-v1';
const ADMIN_CODE = 'ADMIN2026';
const STATUSES = ['Abierto', 'En progreso', 'Resuelto', 'Cerrado'];
const PRIORITIES = ['Baja', 'Media', 'Alta'];
const CATEGORIES = ['Hardware', 'Software', 'Red', 'Acceso', 'Otro'];
const SLA_HOURS = { Alta: 24, Media: 48, Baja: 96 };

const initialState = {
  currentUserId: null,
  users: [
    {
      id: 'u-admin',
      name: 'Administrador Demo',
      email: 'admin@escuela.local',
      password: 'admin123',
      role: 'admin',
      createdAt: new Date().toISOString(),
    },
  ],
  tickets: [
    {
      id: 'TCK-2026-0001',
      title: 'No enciende el computador del laboratorio 3',
      description: 'El equipo prende el ventilador, pero no muestra imagen en el monitor.',
      category: 'Hardware',
      priority: 'Alta',
      status: 'Abierto',
      requesterId: 'u-admin',
      assignee: 'Soporte TI',
      images: [],
      comments: [{ at: new Date().toISOString(), author: 'Sistema', text: 'Ticket de ejemplo creado.' }],
      createdAt: hoursAgo(52),
      updatedAt: hoursAgo(7),
      resolvedAt: null,
    },
    {
      id: 'TCK-2026-0002',
      title: 'Instalar software de diseño',
      description: 'Se necesita instalar la suite de diseño para el curso de multimedia.',
      category: 'Software',
      priority: 'Media',
      status: 'Resuelto',
      requesterId: 'u-admin',
      assignee: 'Mesa de ayuda',
      images: [],
      comments: [{ at: hoursAgo(28), author: 'Mesa de ayuda', text: 'Instalación completada y validada.' }],
      createdAt: hoursAgo(96),
      updatedAt: hoursAgo(28),
      resolvedAt: hoursAgo(28),
    },
  ],
  inventory: [
    {
      id: 'HW-001',
      name: 'Laptop Lenovo ThinkPad',
      type: 'Laptop',
      serial: 'SN-LAB-0001',
      location: 'Laboratorio 1',
      assignedTo: 'Docente de Informática',
      status: 'Activo',
      purchaseDate: '2025-08-15',
      notes: 'Equipo para clases de programación.',
    },
  ],
};

let state = loadState();
let supabaseDataSource = null;
let dataMode = 'Local';
let syncStatus = hasSupabaseConfig() ? 'Conectando con Supabase...' : 'Modo local listo';
let activeView = 'dashboard';
let authMode = 'login';
let selectedTicketId = null;
let uploadedImages = [];
let searchTerm = '';
let ticketFilters = { status: 'Todos', priority: 'Todas', category: 'Todas' };

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(initialState);
  try {
    const parsed = JSON.parse(saved);
    return { ...structuredClone(initialState), ...parsed };
  } catch {
    return structuredClone(initialState);
  }
}

async function initDataSource() {
  if (!hasSupabaseConfig()) {
    syncStatus = 'Modo local listo';
    return;
  }

  try {
    supabaseDataSource = await createSupabaseDataSource();
    if (!supabaseDataSource) return;
    state = await supabaseDataSource.loadState(state);
    dataMode = 'Supabase';
    syncStatus = 'Base de datos Supabase conectada';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error(error);
    supabaseDataSource = null;
    dataMode = 'Local';
    syncStatus = `No se pudo conectar Supabase: ${error.message || 'revisa URL, anon key y tablas'}`;
  }
}

async function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!supabaseDataSource) return;
  try {
    await supabaseDataSource.saveState(state);
    syncStatus = 'Cambios sincronizados con Supabase';
  } catch (error) {
    console.error(error);
    syncStatus = `Guardado local OK, Supabase pendiente: ${error.message || 'error de sincronización'}`;
  }
}

function currentUser() {
  return state.users.find((user) => user.id === state.currentUserId) || null;
}

function isAdmin() {
  return currentUser()?.role === 'admin';
}

function ticketOwner(ticket) {
  return state.users.find((user) => user.id === ticket.requesterId)?.name || 'Usuario eliminado';
}

function visibleTickets() {
  const user = currentUser();
  const base = isAdmin() ? state.tickets : state.tickets.filter((ticket) => ticket.requesterId === user?.id);
  const q = searchTerm.toLowerCase().trim();
  return base.filter((ticket) => {
    const matchesText = !q || [ticket.id, ticket.title, ticket.description, ticket.category, ticket.status, ticket.priority, ticket.assignee]
      .join(' ')
      .toLowerCase()
      .includes(q);
    const matchesStatus = ticketFilters.status === 'Todos' || ticket.status === ticketFilters.status;
    const matchesPriority = ticketFilters.priority === 'Todas' || ticket.priority === ticketFilters.priority;
    const matchesCategory = ticketFilters.category === 'Todas' || ticket.category === ticketFilters.category;
    return matchesText && matchesStatus && matchesPriority && matchesCategory;
  });
}

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function nextTicketNumber() {
  const next = state.tickets.length + 1;
  return `TCK-${new Date().getFullYear()}-${String(next).padStart(4, '0')}`;
}

function formatDate(iso) {
  if (!iso) return 'Pendiente';
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

function durationParts(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const restSeconds = seconds % 60;
  return { days, hours, minutes, seconds: restSeconds, totalSeconds: seconds };
}

function formatDuration(ms) {
  const d = durationParts(ms);
  return `${d.days} días, ${d.hours} horas, ${d.minutes} minutos y ${d.seconds} segundos`;
}

function ticketResolutionMs(ticket) {
  const end = ticket.resolvedAt || ticket.updatedAt || new Date().toISOString();
  return new Date(end) - new Date(ticket.createdAt);
}

function ticketAgeMs(ticket) {
  const end = ticket.resolvedAt || new Date().toISOString();
  return new Date(end) - new Date(ticket.createdAt);
}

function ticketSlaInfo(ticket) {
  const limitMs = (SLA_HOURS[ticket.priority] || 72) * 60 * 60 * 1000;
  const elapsed = ticketAgeMs(ticket);
  const remaining = limitMs - elapsed;
  if (ticket.resolvedAt) {
    return { label: elapsed <= limitMs ? 'Cumplido' : 'Fuera SLA', className: elapsed <= limitMs ? 'sla-ok' : 'sla-breach', remaining };
  }
  if (remaining <= 0) return { label: 'Vencido', className: 'sla-breach', remaining };
  if (remaining <= 6 * 60 * 60 * 1000) return { label: 'En riesgo', className: 'sla-risk', remaining };
  return { label: 'En tiempo', className: 'sla-ok', remaining };
}

function reportStats(tickets = visibleTickets()) {
  const total = tickets.length;
  const resolved = tickets.filter((ticket) => ticket.resolvedAt);
  const avgResolution = resolved.length
    ? resolved.reduce((sum, ticket) => sum + ticketResolutionMs(ticket), 0) / resolved.length
    : 0;
  const avgCreationAge = total
    ? tickets.reduce((sum, ticket) => sum + (Date.now() - new Date(ticket.createdAt)), 0) / total
    : 0;
  const byStatus = STATUSES.reduce((acc, status) => {
    acc[status] = tickets.filter((ticket) => ticket.status === status).length;
    return acc;
  }, {});
  const byPriority = PRIORITIES.reduce((acc, priority) => {
    acc[priority] = tickets.filter((ticket) => ticket.priority === priority).length;
    return acc;
  }, {});
  const backlog = tickets.filter((ticket) => !['Resuelto', 'Cerrado'].includes(ticket.status)).length;
  const breached = tickets.filter((ticket) => ticketSlaInfo(ticket).className === 'sla-breach').length;
  const risk = tickets.filter((ticket) => ticketSlaInfo(ticket).className === 'sla-risk').length;
  return { total, resolved: resolved.length, avgResolution, avgCreationAge, byStatus, byPriority, backlog, breached, risk };
}

function generateReportText() {
  const stats = reportStats();
  const allResolution = visibleTickets().map((ticket) => `${ticket.id}: creado ${formatDate(ticket.createdAt)} | ${ticket.resolvedAt ? `resuelto ${formatDate(ticket.resolvedAt)} | duración ${formatDuration(ticketResolutionMs(ticket))}` : `sin resolver | edad ${formatDuration(Date.now() - new Date(ticket.createdAt))}`}`);
  return `Reporte ejecutivo de tickets\n\n` +
    `Cantidad de tickets creados: ${stats.total}\n` +
    `Tickets resueltos: ${stats.resolved}\n` +
    `Tiempo promedio de resolución: ${formatDuration(stats.avgResolution)}\n` +
    `Edad promedio desde creación: ${formatDuration(stats.avgCreationAge)}\n\n` +
    `Por estado: ${Object.entries(stats.byStatus).map(([k, v]) => `${k}: ${v}`).join(' | ')}\n` +
    `Por prioridad: ${Object.entries(stats.byPriority).map(([k, v]) => `${k}: ${v}`).join(' | ')}\n\n` +
    `Detalle con días, horas, minutos y segundos:\n${allResolution.join('\n') || 'Sin tickets para reportar.'}`;
}

function setView(view) {
  activeView = view;
  render();
}

function html(strings, ...values) {
  return strings.reduce((acc, str, i) => acc + str + (values[i] ?? ''), '');
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function render() {
  const app = document.querySelector('#app');
  app.innerHTML = currentUser() ? renderApp() : renderAuth();
  bindEvents();
}

function renderAuth(error = '') {
  const isLogin = authMode === 'login';
  return html`
    <main class="auth-shell">
      <section class="hero">
        <div>
          <div class="badge">🎓 Proyecto escolar profesional</div>
          <h1>Sistema de tickets e inventario TI</h1>
          <p>Gestiona solicitudes de soporte, evidencia con imágenes, búsqueda por número de ticket, inventario de hardware, reportes y panel administrativo con Kanban.</p>
          <div class="hero-badges">
            <span class="badge">📌 Ticket: TCK-2026-0001</span>
            <span class="badge">🧑‍💼 Admin automático con código</span>
            <span class="badge">📊 Reportes en segundos</span>
          </div>
        </div>
        <p><strong>Demo admin:</strong> admin@escuela.local / admin123 · Código para nuevos admins: ${ADMIN_CODE}</p>
      </section>
      <section class="auth-card">
        <div class="tabs">
          <button class="tab ${isLogin ? 'active' : ''}" data-auth-tab="login">Iniciar sesión</button>
          <button class="tab ${!isLogin ? 'active' : ''}" data-auth-tab="register">Registro</button>
        </div>
        ${error ? `<div class="alert error">${escapeHtml(error)}</div>` : ''}
        <form id="authForm" class="form-grid">
          ${!isLogin ? `<label>Nombre completo<input name="name" required placeholder="Ej. Ana Pérez" /></label>` : ''}
          <label>Correo electrónico<input type="email" name="email" required placeholder="tu@escuela.local" /></label>
          <label>Contraseña<input type="password" name="password" required minlength="4" placeholder="Mínimo 4 caracteres" /></label>
          ${!isLogin ? `<label>Código administrador (opcional)<input name="adminCode" placeholder="Solo si eres admin" /></label>` : ''}
          <button class="btn" type="submit">${isLogin ? 'Entrar al sistema' : 'Crear cuenta'}</button>
          <p class="help">Si te registras con el código correcto, el sistema reconoce tu rol de administrador y te redirige al panel admin.</p>
        </form>
      </section>
    </main>`;
}

function renderApp() {
  const user = currentUser();
  const navItems = [
    ['dashboard', '📊 Dashboard'],
    ['tickets', '🎫 Tickets'],
    ['new-ticket', '➕ Crear ticket'],
    ['inventory', '💻 Inventario'],
    ['reports', '📄 Reportes'],
    ...(isAdmin() ? [['admin', '🧑‍💼 Panel admin'], ['kanban', '🧩 Kanban'], ['settings', '⚙️ Supabase']] : []),
  ];
  return html`
    <div class="layout">
      <aside class="sidebar">
        <div class="logo"><div class="logo-mark">TP</div><div><strong>TicketPro</strong><span>Mesa de ayuda escolar</span></div></div>
        <nav class="nav">${navItems.map(([view, label]) => `<button class="${activeView === view ? 'active' : ''}" data-view="${view}">${label}</button>`).join('')}</nav>
        <div class="user-box">
          <strong>${escapeHtml(user.name)}</strong><br />
          <span class="help">${user.role === 'admin' ? 'Administrador' : 'Usuario'} · ${escapeHtml(user.email)}</span>
          <button class="btn secondary" id="logoutBtn" style="width:100%; margin-top:.8rem">Cerrar sesión</button>
        </div>
      </aside>
      <main class="main">
        <div class="topbar">
          <div><h2>${pageTitle()}</h2><span class="help">${isAdmin() ? 'Vista administrativa con acceso total.' : 'Vista de usuario con tus tickets.'} · Datos: ${dataMode} · ${escapeHtml(syncStatus)}</span></div>
          <div class="searchbar">
            <input id="globalSearch" value="${escapeHtml(searchTerm)}" placeholder="Buscar por número de ticket, título, estado..." />
            <button class="btn" id="searchBtn">Buscar</button>
          </div>
        </div>
        ${renderView()}
      </main>
      ${renderTicketModal()}
    </div>`;
}

function pageTitle() {
  return {
    dashboard: 'Dashboard',
    tickets: 'Tickets',
    'new-ticket': 'Crear ticket',
    inventory: 'Inventario de hardware',
    reports: 'Reportes',
    admin: 'Panel administrador',
    kanban: 'Kanban de tickets',
    settings: 'Configuración Supabase',
  }[activeView];
}

function renderView() {
  const views = {
    dashboard: renderDashboard,
    tickets: renderTickets,
    'new-ticket': renderTicketForm,
    inventory: renderInventory,
    reports: renderReports,
    admin: renderAdmin,
    kanban: renderKanban,
    settings: renderSettings,
  };
  return (views[activeView] || renderDashboard)();
}

function renderDashboard() {
  const stats = reportStats();
  return html`
    <section class="grid cols-4 metrics-6">
      ${metric('🎫', 'Tickets creados', stats.total)}
      ${metric('✅', 'Tickets resueltos', stats.resolved)}
      ${metric('⏱️', 'Promedio resolución', formatDuration(stats.avgResolution))}
      ${metric('💻', 'Equipos en inventario', state.inventory.length)}
      ${metric('🛡️', 'Base de datos', dataMode)}
      ${metric('🚨', 'SLA vencido', stats.breached)}
    </section>
    <div class="grid cols-2" style="margin-top:1rem">
      <section class="card"><div class="section-title"><h3>Estado de tickets</h3></div>${barList(stats.byStatus)}</section>
      <section class="card"><div class="section-title"><h3>Prioridad</h3></div>${barList(stats.byPriority)}</section>
    </div>
    <section class="card" style="margin-top:1rem">
      <div class="section-title"><h3>Tickets recientes</h3><button class="btn ghost" data-view="tickets">Ver todos</button></div>
      ${renderTicketsTable(visibleTickets().slice(0, 6))}
    </section>`;
}

function metric(icon, label, value) {
  return `<article class="card metric"><div><span>${label}</span><strong>${value}</strong></div><div class="metric-icon">${icon}</div></article>`;
}

function barList(data) {
  const max = Math.max(1, ...Object.values(data));
  return `<div class="stack">${Object.entries(data).map(([label, value]) => `<div><div class="actions" style="justify-content:space-between"><strong>${label}</strong><span>${value}</span></div><div style="height:10px;background:#e2e8f0;border-radius:999px;overflow:hidden"><div style="height:100%;width:${(value / max) * 100}%;background:linear-gradient(90deg,var(--brand),var(--brand-2))"></div></div></div>`).join('')}</div>`;
}

function renderTickets() {
  return html`
    <section class="card">
      <div class="section-title"><h3>Listado de tickets</h3><button class="btn" data-view="new-ticket">Nuevo ticket</button></div>
      ${renderTicketFilters()}
      ${renderTicketsTable(visibleTickets())}
    </section>`;
}

function renderTicketFilters() {
  return `<div class="filter-grid">
    <label>Estado<select data-filter="status"><option>Todos</option>${STATUSES.map((status) => `<option ${ticketFilters.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></label>
    <label>Prioridad<select data-filter="priority"><option>Todas</option>${PRIORITIES.map((priority) => `<option ${ticketFilters.priority === priority ? 'selected' : ''}>${priority}</option>`).join('')}</select></label>
    <label>Categoría<select data-filter="category"><option>Todas</option>${CATEGORIES.map((category) => `<option ${ticketFilters.category === category ? 'selected' : ''}>${category}</option>`).join('')}</select></label>
    <button class="btn secondary" id="clearFilters" type="button">Limpiar filtros</button>
  </div>`;
}

function renderTicketsTable(tickets) {
  if (!tickets.length) return '<div class="empty">No hay tickets para mostrar.</div>';
  return html`<div class="table-wrap"><table><thead><tr><th>Número</th><th>Solicitud</th><th>Estado</th><th>Prioridad</th><th>SLA</th><th>Creación</th><th>Resolución</th><th>Acciones</th></tr></thead><tbody>
    ${tickets.map((ticket) => `<tr>
      <td><strong>${ticket.id}</strong><br><span class="help">${escapeHtml(ticket.category)}</span></td>
      <td>${escapeHtml(ticket.title)}<br><span class="help">Solicita: ${escapeHtml(ticketOwner(ticket))}</span></td>
      <td><span class="status ${statusClass(ticket.status)}">${ticket.status}</span></td>
      <td><span class="priority-${ticket.priority.toLowerCase()}">${ticket.priority}</span></td>
      <td>${renderSlaBadge(ticket)}</td>
      <td>${formatDate(ticket.createdAt)}</td>
      <td>${ticket.resolvedAt ? formatDuration(ticketResolutionMs(ticket)) : 'Pendiente'}</td>
      <td><button class="btn secondary" data-open-ticket="${ticket.id}">Ver / editar</button></td>
    </tr>`).join('')}
  </tbody></table></div>`;
}

function renderSlaBadge(ticket) {
  const sla = ticketSlaInfo(ticket);
  const timeText = sla.remaining >= 0 ? `restan ${formatDuration(sla.remaining)}` : `excedido por ${formatDuration(Math.abs(sla.remaining))}`;
  return `<span class="sla ${sla.className}">${sla.label}</span><br><span class="help">${timeText}</span>`;
}

function statusClass(status) {
  return status.toLowerCase().replace('en ', '').replace(' ', '-');
}

function renderTicketForm() {
  return html`
    <section class="card">
      <form id="ticketForm" class="form-grid">
        <div class="split">
          <label>Título del problema<input name="title" required placeholder="Ej. Impresora sin tóner" /></label>
          <label>Categoría<select name="category">${CATEGORIES.map((category) => `<option>${category}</option>`).join('')}</select></label>
        </div>
        <div class="split">
          <label>Prioridad<select name="priority">${PRIORITIES.map((p) => `<option>${p}</option>`).join('')}</select></label>
          <label>Asignado a<input name="assignee" placeholder="Soporte TI / Técnico" /></label>
        </div>
        <label>Descripción<textarea name="description" required placeholder="Describe el problema, ubicación y equipo afectado"></textarea></label>
        <label>Subir imágenes como evidencia<input id="imageInput" type="file" accept="image/*" multiple /></label>
        <div id="preview" class="image-preview"></div>
        <button class="btn" type="submit">Crear ticket</button>
      </form>
    </section>`;
}

function renderInventory() {
  return html`
    <section class="grid cols-2">
      <article class="card">
        <h3>Registrar hardware</h3>
        <form id="inventoryForm" class="form-grid">
          <label>Nombre del equipo<input name="name" required placeholder="Ej. Monitor Dell 24" /></label>
          <div class="split"><label>Tipo<input name="type" required placeholder="Laptop, monitor, router..." /></label><label>Serial<input name="serial" required /></label></div>
          <div class="split"><label>Ubicación<input name="location" required /></label><label>Asignado a<input name="assignedTo" /></label></div>
          <div class="split"><label>Estado<select name="status"><option>Activo</option><option>En reparación</option><option>Prestado</option><option>Baja</option></select></label><label>Fecha de compra<input type="date" name="purchaseDate" /></label></div>
          <label>Notas<textarea name="notes"></textarea></label>
          <button class="btn" type="submit">Guardar hardware</button>
        </form>
      </article>
      <article class="card">
        <h3>Inventario registrado</h3>
        ${renderInventoryTable()}
      </article>
    </section>`;
}

function renderInventoryTable() {
  if (!state.inventory.length) return '<div class="empty">Aún no hay hardware registrado.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>ID</th><th>Equipo</th><th>Ubicación</th><th>Estado</th><th></th></tr></thead><tbody>${state.inventory.map((item) => `<tr><td><strong>${item.id}</strong></td><td>${escapeHtml(item.name)}<br><span class="help">${escapeHtml(item.type)} · ${escapeHtml(item.serial)}</span></td><td>${escapeHtml(item.location)}<br><span class="help">${escapeHtml(item.assignedTo || 'Sin asignar')}</span></td><td>${escapeHtml(item.status)}</td><td>${isAdmin() ? `<button class="btn danger" data-delete-hw="${item.id}">Eliminar</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderReports() {
  const stats = reportStats();
  return html`
    <section class="grid cols-3">
      ${metric('📦', 'Total creado', stats.total)}
      ${metric('⚡', 'Promedio rápido', formatDuration(stats.avgResolution))}
      ${metric('🕒', 'Edad promedio', formatDuration(stats.avgCreationAge))}
    </section>
    <section class="card" style="margin-top:1rem">
      <div class="section-title"><h3>Generación de reporte</h3><div class="actions"><button class="btn secondary" id="downloadCsv">Descargar CSV</button><button class="btn" id="downloadReport">Descargar TXT</button></div></div>
      <div class="report-box" id="reportText">${escapeHtml(generateReportText())}</div>
    </section>`;
}

function renderAdmin() {
  if (!isAdmin()) return '<div class="alert error">No tienes permisos de administrador.</div>';
  return html`
    <section class="grid cols-3">
      ${metric('👥', 'Usuarios', state.users.length)}
      ${metric('🎫', 'Todos los tickets', state.tickets.length)}
      ${metric('💻', 'Hardware', state.inventory.length)}
    </section>
    <section class="card" style="margin-top:1rem">
      <div class="section-title"><h3>Control total de tickets</h3><button class="btn" data-view="kanban">Abrir Kanban</button></div>
      ${renderTicketsTable(visibleTickets())}
    </section>`;
}

function renderKanban() {
  if (!isAdmin()) return '<div class="alert error">No tienes permisos de administrador.</div>';
  return `<section class="kanban">${STATUSES.map((status) => {
    const items = visibleTickets().filter((ticket) => ticket.status === status);
    return `<article class="kanban-col"><header>${status}<span class="badge">${items.length}</span></header><div class="stack">${items.map((ticket) => `<div class="ticket-card"><h4>${ticket.id}</h4><strong>${escapeHtml(ticket.title)}</strong><span class="help">${escapeHtml(ticketOwner(ticket))} · ${ticket.priority}</span><button class="btn secondary" data-open-ticket="${ticket.id}">Administrar</button></div>`).join('') || '<div class="empty">Sin tickets</div>'}</div></article>`;
  }).join('')}</section>`;
}

function renderTicketModal() {
  const ticket = state.tickets.find((item) => item.id === selectedTicketId);
  if (!ticket) return '<div class="modal" id="ticketModal"></div>';
  return html`<div class="modal open" id="ticketModal">
    <section class="modal-card">
      <div class="modal-head"><div><h3>${ticket.id} · ${escapeHtml(ticket.title)}</h3><span class="help">Creado ${formatDate(ticket.createdAt)} por ${escapeHtml(ticketOwner(ticket))}</span></div><button class="btn secondary" id="closeModal">Cerrar</button></div>
      <div class="split">
        <div class="stack">
          <p>${escapeHtml(ticket.description)}</p>
          <div><strong>Imágenes adjuntas</strong><div class="image-preview">${ticket.images.length ? ticket.images.map((img) => `<a href="${img}" target="_blank"><img class="thumb" src="${img}" alt="Evidencia" /></a>`).join('') : '<span class="help">Sin imágenes.</span>'}</div></div>
          <div><strong>Comentarios</strong><div class="stack">${ticket.comments.map((c) => `<div class="report-box"><strong>${escapeHtml(c.author)}</strong> · ${formatDate(c.at)}<br>${escapeHtml(c.text)}</div>`).join('')}</div></div>
        </div>
        <form id="editTicketForm" class="form-grid">
          <label>Estado<select name="status" ${isAdmin() ? '' : 'disabled'}>${STATUSES.map((s) => `<option ${ticket.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
          <label>Prioridad<select name="priority" ${isAdmin() ? '' : 'disabled'}>${PRIORITIES.map((p) => `<option ${ticket.priority === p ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
          <label>Asignado a<input name="assignee" value="${escapeHtml(ticket.assignee || '')}" ${isAdmin() ? '' : 'disabled'} /></label>
          <label>Comentario<textarea name="comment" placeholder="Agregar nota de seguimiento"></textarea></label>
          <button class="btn" type="submit">Guardar cambios</button>
        </form>
      </div>
    </section>
  </div>`;
}

function renderSettings() {
  if (!isAdmin()) return '<div class="alert error">No tienes permisos de administrador.</div>';
  const config = getSupabaseConfig();
  return html`
    <section class="grid cols-2">
      <article class="card certified-card">
        <span class="badge badge-certified">✓ Arquitectura preparada para Supabase</span>
        <h3>Conexión a base de datos</h3>
        <p class="help">Pega la URL del proyecto y la anon public key de Supabase. El sistema conservará una copia local y sincronizará perfiles demo, tickets e inventario con las tablas del archivo <strong>supabase-schema.sql</strong>.</p>
        <form id="supabaseForm" class="form-grid">
          <label>Project URL<input name="url" value="${escapeHtml(config.url || '')}" placeholder="https://xxxxx.supabase.co" /></label>
          <label>Anon public key<input name="anonKey" value="${escapeHtml(config.anonKey || '')}" placeholder="eyJhbGciOi..." /></label>
          <div class="actions">
            <button class="btn" type="submit">Guardar y conectar</button>
            <button class="btn secondary" type="button" id="clearSupabase">Usar modo local</button>
          </div>
        </form>
      </article>
      <article class="card certified-card">
        <span class="badge badge-certified">✓ Fuentes y controles verificables</span>
        <h3>Checklist profesional</h3>
        <ul class="cert-list">
          <li>Tablas normalizadas para perfiles, tickets e inventario.</li>
          <li>Políticas RLS de ejemplo para operar con anon key en un prototipo escolar.</li>
          <li>Reportes con tiempos auditables en creación, actualización y resolución.</li>
          <li>Interfaz responsive con estados visuales, bordes consistentes y panel admin.</li>
        </ul>
        <div class="report-box">Estado actual: ${escapeHtml(syncStatus)}\nModo activo: ${dataMode}</div>
      </article>
    </section>`;
}

function bindEvents() {
  document.querySelectorAll('[data-auth-tab]').forEach((btn) => btn.addEventListener('click', () => { authMode = btn.dataset.authTab; render(); }));
  document.querySelector('#authForm')?.addEventListener('submit', handleAuth);
  document.querySelectorAll('[data-view]').forEach((btn) => btn.addEventListener('click', () => setView(btn.dataset.view)));
  document.querySelector('#logoutBtn')?.addEventListener('click', () => { state.currentUserId = null; saveState(); activeView = 'dashboard'; render(); });
  document.querySelector('#globalSearch')?.addEventListener('input', (event) => { searchTerm = event.target.value; });
  document.querySelector('#searchBtn')?.addEventListener('click', () => { activeView = 'tickets'; render(); });
  document.querySelector('#ticketForm')?.addEventListener('submit', handleCreateTicket);
  document.querySelector('#imageInput')?.addEventListener('change', handleImages);
  document.querySelector('#inventoryForm')?.addEventListener('submit', handleInventory);
  document.querySelectorAll('[data-delete-hw]').forEach((btn) => btn.addEventListener('click', () => deleteHardware(btn.dataset.deleteHw)));
  document.querySelectorAll('[data-open-ticket]').forEach((btn) => btn.addEventListener('click', () => { selectedTicketId = btn.dataset.openTicket; render(); }));
  document.querySelector('#closeModal')?.addEventListener('click', () => { selectedTicketId = null; render(); });
  document.querySelector('#editTicketForm')?.addEventListener('submit', handleEditTicket);
  document.querySelector('#downloadReport')?.addEventListener('click', downloadReport);
  document.querySelector('#downloadCsv')?.addEventListener('click', downloadCsvReport);
  document.querySelectorAll('[data-filter]').forEach((select) => select.addEventListener('change', () => { ticketFilters[select.dataset.filter] = select.value; render(); }));
  document.querySelector('#clearFilters')?.addEventListener('click', () => { ticketFilters = { status: 'Todos', priority: 'Todas', category: 'Todas' }; render(); });
  document.querySelector('#supabaseForm')?.addEventListener('submit', handleSupabaseConfig);
  document.querySelector('#clearSupabase')?.addEventListener('click', handleClearSupabase);
}


async function handleAuth(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const email = String(form.get('email')).toLowerCase().trim();
  const password = String(form.get('password'));
  if (authMode === 'login') {
    const user = state.users.find((item) => item.email === email && item.password === password);
    if (!user) return rerenderAuthWithError('Correo o contraseña incorrectos.');
    state.currentUserId = user.id;
    activeView = user.role === 'admin' ? 'admin' : 'dashboard';
  } else {
    if (state.users.some((item) => item.email === email)) return rerenderAuthWithError('Ya existe una cuenta con ese correo.');
    const role = String(form.get('adminCode')).trim() === ADMIN_CODE ? 'admin' : 'user';
    const user = { id: uid('u'), name: String(form.get('name')).trim(), email, password, role, createdAt: new Date().toISOString() };
    state.users.push(user);
    state.currentUserId = user.id;
    activeView = role === 'admin' ? 'admin' : 'dashboard';
  }
  await saveState();
  render();
}

function rerenderAuthWithError(message) {
  document.querySelector('#app').innerHTML = renderAuth(message);
  bindEvents();
}

async function handleImages(event) {
  const files = [...event.target.files].slice(0, 4);
  uploadedImages = await Promise.all(files.map((file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  })));
  document.querySelector('#preview').innerHTML = uploadedImages.map((img) => `<img src="${img}" alt="Vista previa" />`).join('');
}

async function handleCreateTicket(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.tickets.unshift({
    id: nextTicketNumber(),
    title: String(form.get('title')).trim(),
    description: String(form.get('description')).trim(),
    category: String(form.get('category')),
    priority: String(form.get('priority')),
    status: 'Abierto',
    requesterId: currentUser().id,
    assignee: String(form.get('assignee')).trim() || 'Sin asignar',
    images: uploadedImages,
    comments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: null,
  });
  uploadedImages = [];
  await saveState();
  activeView = 'tickets';
  render();
}

async function handleInventory(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.inventory.unshift({
    id: `HW-${String(state.inventory.length + 1).padStart(3, '0')}`,
    name: String(form.get('name')).trim(),
    type: String(form.get('type')).trim(),
    serial: String(form.get('serial')).trim(),
    location: String(form.get('location')).trim(),
    assignedTo: String(form.get('assignedTo')).trim(),
    status: String(form.get('status')),
    purchaseDate: String(form.get('purchaseDate')),
    notes: String(form.get('notes')).trim(),
  });
  await saveState();
  render();
}

async function deleteHardware(id) {
  state.inventory = state.inventory.filter((item) => item.id !== id);
  if (supabaseDataSource) {
    try {
      await supabaseDataSource.deleteHardware(id);
      syncStatus = 'Hardware eliminado en Supabase';
    } catch (error) {
      console.error(error);
      syncStatus = `Eliminado local; Supabase pendiente: ${error.message || 'error'}`;
    }
  }
  await saveState();
  render();
}

async function handleEditTicket(event) {
  event.preventDefault();
  const ticket = state.tickets.find((item) => item.id === selectedTicketId);
  if (!ticket) return;
  const form = new FormData(event.currentTarget);
  if (isAdmin()) {
    const previousStatus = ticket.status;
    ticket.status = String(form.get('status'));
    ticket.priority = String(form.get('priority'));
    ticket.assignee = String(form.get('assignee')).trim() || 'Sin asignar';
    if (ticket.status === 'Resuelto' && previousStatus !== 'Resuelto') ticket.resolvedAt = new Date().toISOString();
    if (ticket.status !== 'Resuelto') ticket.resolvedAt = null;
  }
  const comment = String(form.get('comment')).trim();
  if (comment) ticket.comments.push({ at: new Date().toISOString(), author: currentUser().name, text: comment });
  ticket.updatedAt = new Date().toISOString();
  await saveState();
  render();
}

async function handleSupabaseConfig(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  saveSupabaseConfig({ url: form.get('url'), anonKey: form.get('anonKey') });
  syncStatus = 'Conectando con Supabase...';
  await initDataSource();
  await saveState();
  render();
}

function handleClearSupabase() {
  clearSupabaseConfig();
  supabaseDataSource = null;
  dataMode = 'Local';
  syncStatus = 'Modo local listo';
  render();
}

function reportRows() {
  return visibleTickets().map((ticket) => ({
    numero: ticket.id,
    titulo: ticket.title,
    categoria: ticket.category,
    prioridad: ticket.priority,
    estado: ticket.status,
    solicitante: ticketOwner(ticket),
    asignado: ticket.assignee,
    creado: formatDate(ticket.createdAt),
    resuelto: ticket.resolvedAt ? formatDate(ticket.resolvedAt) : 'Pendiente',
    duracion: ticket.resolvedAt ? formatDuration(ticketResolutionMs(ticket)) : formatDuration(ticketAgeMs(ticket)),
    sla: ticketSlaInfo(ticket).label,
  }));
}

function downloadCsvReport() {
  const rows = reportRows();
  const headers = ['numero', 'titulo', 'categoria', 'prioridad', 'estado', 'solicitante', 'asignado', 'creado', 'resuelto', 'duracion', 'sla'];
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => `"${String(row[header]).replaceAll('"', '""')}"`).join(',')),
  ].join('\n');
  downloadBlob(csv, `reporte-tickets-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
}

function downloadReport() {
  downloadBlob(generateReportText(), `reporte-tickets-${new Date().toISOString().slice(0, 10)}.txt`, 'text/plain;charset=utf-8');
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

initDataSource().finally(render);
