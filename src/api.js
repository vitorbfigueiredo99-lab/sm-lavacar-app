import { supabase, supabaseEnabled } from "./supabaseClient";

const CLIENT_ID_KEY = "sm_lavacar_client_id";

// Garante que o "cliente logado" do protótipo tenha um registro real no
// banco (clients + vehicles), usando um id salvo no navegador para não
// duplicar a cada visita. Em uma versão futura isso vira login de verdade.
export async function ensureClientAndVehicles(myVehicles) {
  if (!supabaseEnabled) return null;
  let clientId = localStorage.getItem(CLIENT_ID_KEY);

  if (!clientId) {
    const { data, error } = await supabase.rpc("register_client", {
      p_name: "Você (cliente logado)", p_phone: "(11) 90000-0000", p_email: "voce@email.com",
    });
    if (error) { console.error(error); return null; }
    clientId = data;
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  }

  const { data: existing } = await supabase.rpc("list_my_vehicles", { p_client_id: clientId });
  const byPlate = {};
  (existing || []).forEach((v) => { byPlate[v.plate] = v.id; });

  for (const v of myVehicles) {
    if (!byPlate[v.plate]) {
      const { data, error } = await supabase.rpc("register_vehicle", {
        p_client_id: clientId, p_brand: v.brand, p_model: v.model, p_year: v.year, p_color: v.color,
        p_plate: v.plate, p_type: v.type, p_size: v.size, p_notes: v.notes || null,
      });
      if (!error) byPlate[v.plate] = data;
    }
  }

  return { clientId, vehicleIdByPlate: byPlate };
}

export async function fetchAppointments() {
  const { data, error } = await supabase
    .from("appointments")
    .select(`
      id, service_id, tier, price, date, time, status,
      payment_status, payment_method, payment_amount, payment_datetime, rating, rating_comment,
      photo_before_url, photo_after_url,
      client:clients(id, name),
      vehicle:vehicles(brand, model, plate),
      payment_employee:employees(name)
    `)
    .order("date", { ascending: false });
  if (error) { console.error(error); return []; }
  return data.map((row) => ({
    id: row.id,
    clientId: row.client?.id,
    clientName: row.client?.name,
    vehicle: row.vehicle ? `${row.vehicle.brand} ${row.vehicle.model} - ${row.vehicle.plate}` : "",
    serviceId: row.service_id,
    tier: row.tier,
    price: Number(row.price),
    date: row.date,
    time: row.time,
    status: row.status,
    payment: row.payment_status === "pago"
      ? { status: "pago", method: row.payment_method, amount: Number(row.payment_amount), employee: row.payment_employee?.name, datetime: row.payment_datetime }
      : { status: "pendente" },
    rating: row.rating,
    comment: row.rating_comment,
    photos: (row.photo_before_url || row.photo_after_url) ? { before: !!row.photo_before_url, after: !!row.photo_after_url } : null,
  }));
}

function mapPublicRow(row) {
  return {
    id: row.id,
    clientName: row.client_name,
    vehicle: `${row.vehicle_brand} ${row.vehicle_model} - ${row.vehicle_plate}`,
    serviceId: row.service_id,
    status: row.status,
  };
}

export async function fetchMyAppointments(clientId) {
  const { data, error } = await supabase.rpc("list_my_appointments", { p_client_id: clientId });
  if (error) { console.error(error); return []; }
  return data.map((row) => ({
    id: row.id,
    clientId,
    clientName: row.client_name,
    vehicle: `${row.vehicle_brand} ${row.vehicle_model} - ${row.vehicle_plate}`,
    serviceId: row.service_id,
    tier: row.tier,
    price: Number(row.price),
    date: row.appt_date,
    time: row.appt_time,
    status: row.status,
    payment: row.payment_status === "pago"
      ? { status: "pago", method: row.payment_method, amount: Number(row.payment_amount), datetime: row.payment_datetime }
      : { status: "pendente" },
    rating: row.rating,
    comment: row.rating_comment,
    photos: (row.photo_before_url || row.photo_after_url) ? { before: !!row.photo_before_url, after: !!row.photo_after_url } : null,
  }));
}

export async function fetchActiveQueue() {
  const { data, error } = await supabase.rpc("list_active_queue");
  if (error) { console.error(error); return []; }
  return data.map(mapPublicRow);
}

export async function fetchPublicData(clientId) {
  const [mine, queue] = await Promise.all([fetchMyAppointments(clientId), fetchActiveQueue()]);
  const merged = [...mine];
  queue.forEach((q) => { if (!merged.some((m) => m.id === q.id)) merged.push(q); });
  return merged;
}

export async function createAppointment({ clientId, vehicleId, serviceId, tier, price, date, time, status = "agendado" }) {
  const { data, error } = await supabase.rpc("create_appointment_public", {
    p_client_id: clientId, p_vehicle_id: vehicleId, p_service_id: serviceId, p_tier: tier || null,
    p_price: price, p_date: date, p_time: time, p_status: status,
  });
  if (error) throw error;
  return data;
}

export async function updateAppointmentStatus(id, status) {
  const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function updateAppointmentPayment(id, payment) {
  const { error } = await supabase.from("appointments").update({
    payment_status: "pago",
    payment_method: payment.method,
    payment_amount: payment.amount,
    payment_datetime: new Date().toISOString(),
    payment_employee_id: payment.employeeId || null,
  }).eq("id", id);
  if (error) throw error;
}

export async function rateAppointment(id, clientId, rating, comment) {
  const { error } = await supabase.rpc("rate_appointment_public", { p_appointment_id: id, p_client_id: clientId, p_rating: rating, p_comment: comment });
  if (error) throw error;
}

export async function fetchProducts() {
  const { data, error } = await supabase.from("products").select("*").order("name");
  if (error) { console.error(error); return []; }
  return data.map((p) => ({ id: p.id, name: p.name, unit: p.unit, quantity: Number(p.quantity), minStock: Number(p.min_stock), cost: Number(p.cost) }));
}

export async function consumeStockRemote(recipe) {
  for (const r of recipe) {
    const { data: prod } = await supabase.from("products").select("quantity").eq("id", r.productId).single();
    if (!prod) continue;
    const newQty = Math.max(0, Number(prod.quantity) - r.qty);
    await supabase.from("products").update({ quantity: newQty }).eq("id", r.productId);
    await supabase.from("stock_movements").insert({ product_id: r.productId, type: "saida", qty: r.qty, reason: "Consumo automático de serviço" });
  }
}

export async function addStockEntry(productId, qty, reason) {
  const { data: prod } = await supabase.from("products").select("quantity").eq("id", productId).single();
  const newQty = Number(prod?.quantity || 0) + Number(qty);
  await supabase.from("products").update({ quantity: newQty }).eq("id", productId);
  await supabase.from("stock_movements").insert({ product_id: productId, type: "entrada", qty, reason });
}

export async function fetchStockLog() {
  const { data, error } = await supabase.from("stock_movements").select("id, product_id, type, qty, reason, created_at").order("created_at", { ascending: false }).limit(30);
  if (error) return [];
  return data.map((m) => ({ id: m.id, productId: m.product_id, type: m.type, qty: Number(m.qty), reason: m.reason, date: new Date(m.created_at).toLocaleString("pt-BR") }));
}

export async function fetchEmployees() {
  const { data, error } = await supabase.from("employees").select("*").order("created_at");
  if (error) return [];
  const roleLabel = { administrador: "Administrador", gerente: "Gerente", funcionario: "Funcionário" };
  const statusLabel = { ativo: "Ativo", folga: "Folga", inativo: "Inativo" };
  return data.map((e) => ({ id: e.id, name: e.name, phone: e.phone || "—", role: roleLabel[e.role] || e.role, status: statusLabel[e.status] || e.status, since: e.since }));
}

export async function cancelAppointment(id, clientId) {
  const { error } = await supabase.rpc("cancel_appointment_public", { p_appointment_id: id, p_client_id: clientId });
  if (error) throw error;
}

export async function findClientByPhone(phone) {
  const { data, error } = await supabase.rpc("find_client_by_phone", { p_phone: phone });
  if (error) { console.error(error); return null; }
  return data;
}

export async function fetchServices() {
  const { data: services, error } = await supabase.from("services").select("*").order("name");
  if (error) { console.error(error); return null; }
  const { data: tiers } = await supabase.from("service_tiers").select("*");
  return services.map((s) => {
    const myTiers = (tiers || []).filter((t) => t.service_id === s.id);
    return {
      id: s.id, name: s.name, desc: s.description, price: s.price !== null ? Number(s.price) : null,
      duration: s.duration_min, category: s.category, badge: s.badge, active: s.active,
      tiered: s.tiered, icon: s.icon,
      tiers: s.tiered ? myTiers.reduce((acc, t) => ({ ...acc, [t.size]: Number(t.price) }), {}) : undefined,
    };
  });
}

export async function updateService(service) {
  const { error } = await supabase.from("services").update({
    name: service.name, description: service.desc, price: service.tiered ? null : service.price,
    duration_min: service.duration, active: service.active, badge: service.badge || null,
  }).eq("id", service.id);
  if (error) throw error;
  if (service.tiered && service.tiers) {
    for (const [size, price] of Object.entries(service.tiers)) {
      await supabase.from("service_tiers").upsert({ service_id: service.id, size, price });
    }
  }
}

export async function createClientAdmin(c) {
  const { data, error } = await supabase.from("clients").insert({ name: c.name, phone: c.phone, email: c.email || null }).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function fetchClients() {
  const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return data;
}

export async function fetchMyVehiclesFull(clientId) {
  const { data, error } = await supabase.rpc("list_my_vehicles_full", { p_client_id: clientId });
  if (error) { console.error(error); return []; }
  return data.map((v) => ({ id: v.id, brand: v.brand, model: v.model, year: v.year, color: v.color, plate: v.plate, type: v.type, size: v.size, notes: v.notes }));
}

export async function addVehicle(clientId, v) {
  const { data, error } = await supabase.rpc("register_vehicle", {
    p_client_id: clientId, p_brand: v.brand, p_model: v.model, p_year: v.year, p_color: v.color,
    p_plate: v.plate, p_type: v.type, p_size: v.size, p_notes: v.notes || null,
  });
  if (error) throw error;
  return data;
}

export async function addVehicleAdmin(clientId, v) {
  const { data, error } = await supabase.from("vehicles").insert({
    client_id: clientId, brand: v.brand, model: v.model, year: v.year, color: v.color,
    plate: v.plate, type: v.type, size: v.size, notes: v.notes || null,
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function fetchVehiclesAdmin() {
  const { data, error } = await supabase.from("vehicles").select("id, client_id, brand, model, plate, year, color, type");
  if (error) { console.error(error); return []; }
  return data;
}

export async function createEmployee({ name, phone, role, status }) {
  const { error } = await supabase.from("employees").insert({ name, phone, role, status });
  if (error) throw error;
}

export async function updateEmployee(id, patch) {
  const { error } = await supabase.from("employees").update(patch).eq("id", id);
  if (error) throw error;
}
