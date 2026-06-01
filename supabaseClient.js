const SUPABASE_CONFIG_KEY = 'ticketpro-supabase-config';

export function getSupabaseConfig() {
  try {
    return JSON.parse(localStorage.getItem(SUPABASE_CONFIG_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveSupabaseConfig(config) {
  const cleanConfig = {
    url: String(config.url || '').trim(),
    anonKey: String(config.anonKey || '').trim(),
  };
  localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(cleanConfig));
  return cleanConfig;
}

export function clearSupabaseConfig() {
  localStorage.removeItem(SUPABASE_CONFIG_KEY);
}

export function hasSupabaseConfig() {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.anonKey);
}

export async function createSupabaseDataSource() {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) return null;

  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const client = createClient(config.url, config.anonKey);

  return {
    client,
    async loadState(localState) {
      const [{ data: profiles, error: profilesError }, { data: tickets, error: ticketsError }, { data: inventory, error: inventoryError }] = await Promise.all([
        client.from('profiles').select('*').order('created_at', { ascending: true }),
        client.from('tickets').select('*').order('created_at', { ascending: false }),
        client.from('hardware_inventory').select('*').order('created_at', { ascending: false }),
      ]);

      if (profilesError || ticketsError || inventoryError) {
        throw profilesError || ticketsError || inventoryError;
      }

      return {
        ...localState,
        users: profiles.map(mapProfileFromDb),
        tickets: tickets.map(mapTicketFromDb),
        inventory: inventory.map(mapHardwareFromDb),
      };
    },
    async saveState(state) {
      const profiles = state.users.map(mapProfileToDb);
      const tickets = state.tickets.map(mapTicketToDb);
      const inventory = state.inventory.map(mapHardwareToDb);

      const operations = [
        profiles.length ? client.from('profiles').upsert(profiles, { onConflict: 'id' }) : Promise.resolve({ error: null }),
        tickets.length ? client.from('tickets').upsert(tickets, { onConflict: 'id' }) : Promise.resolve({ error: null }),
        inventory.length ? client.from('hardware_inventory').upsert(inventory, { onConflict: 'id' }) : Promise.resolve({ error: null }),
      ];
      const [{ error: profilesError }, { error: ticketsError }, { error: inventoryError }] = await Promise.all(operations);

      if (profilesError || ticketsError || inventoryError) {
        throw profilesError || ticketsError || inventoryError;
      }
    },
    async deleteHardware(id) {
      const { error } = await client.from('hardware_inventory').delete().eq('id', id);
      if (error) throw error;
    },
  };
}

function mapProfileFromDb(row) {
  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
    password: row.demo_password || '',
    role: row.role,
    createdAt: row.created_at,
  };
}

function mapProfileToDb(user) {
  return {
    id: user.id,
    full_name: user.name,
    email: user.email,
    demo_password: user.password,
    role: user.role,
    created_at: user.createdAt,
  };
}

function mapTicketFromDb(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    requesterId: row.requester_id,
    assignee: row.assignee,
    images: row.images || [],
    comments: row.comments || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  };
}

function mapTicketToDb(ticket) {
  return {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    requester_id: ticket.requesterId,
    assignee: ticket.assignee,
    images: ticket.images,
    comments: ticket.comments,
    created_at: ticket.createdAt,
    updated_at: ticket.updatedAt,
    resolved_at: ticket.resolvedAt,
  };
}

function mapHardwareFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    serial: row.serial,
    location: row.location,
    assignedTo: row.assigned_to,
    status: row.status,
    purchaseDate: row.purchase_date,
    notes: row.notes,
  };
}

function mapHardwareToDb(item) {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    serial: item.serial,
    location: item.location,
    assigned_to: item.assignedTo,
    status: item.status,
    purchase_date: item.purchaseDate || null,
    notes: item.notes,
  };
}
