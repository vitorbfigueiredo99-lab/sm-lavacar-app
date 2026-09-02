import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Home, CalendarClock, Car, User, History, Sparkles, Droplets, MapPin, Phone,
  Star, Clock, CheckCircle2, ChevronRight, ChevronLeft, Plus, X, Search,
  LayoutDashboard, ListOrdered, Users, Wrench, DollarSign, BarChart3, Settings,
  Bell, Edit3, Timer, Gauge, ShieldCheck, Navigation,
  TrendingUp, Wallet, ClipboardList, CalendarDays, Check,
  AlertCircle, ImageIcon, LogOut, UserCircle2, Lock, Eye, EyeOff, Mail,
  KeyRound, ShieldAlert, PackageSearch, Package, PackagePlus, PackageMinus,
  Smartphone, RotateCcw, Loader2
} from "lucide-react";
import { supabase, supabaseEnabled } from "./supabaseClient";
import {
  ensureClientAndVehicles, fetchAppointments, fetchProducts, fetchStockLog, fetchEmployees,
  createAppointment, updateAppointmentStatus, updateAppointmentPayment, rateAppointment,
  consumeStockRemote, addStockEntry, fetchPublicData, fetchServices, updateService,
  fetchClients, fetchVehiclesAdmin, createEmployee, updateEmployee, cancelAppointment, findClientByPhone,
  fetchMyVehiclesFull, addVehicle, addVehicleAdmin, createClientAdmin,
} from "./api";

/* =========================================================================
   DESIGN TOKENS — deep navy/ink base, cyan (água) + amber (brilho) accents
   ========================================================================= */

const STORAGE_KEY = "lavacar-db-v1";

const STATUS_FLOW = [
  { key: "agendado", label: "Agendado", icon: CalendarClock },
  { key: "chegou", label: "Cliente chegou", icon: MapPin },
  { key: "aguardando", label: "Aguardando", icon: Clock },
  { key: "lavagem", label: "Em lavagem", icon: Droplets },
  { key: "finalizacao", label: "Finalização", icon: Sparkles },
  { key: "pronto", label: "Pronto", icon: CheckCircle2 },
  { key: "entregue", label: "Entregue", icon: ShieldCheck },
];
const statusIndex = (key) => STATUS_FLOW.findIndex((s) => s.key === key);

/* ---- Catálogo de serviços — igual à tabela SM Lavacar ---- */
const SERVICES = [
  { id: "s1", name: "Lavagem Simples", desc: "Lava, seca, aspira, limpa os vidros e pretinho.", price: 45, duration: 30, active: true, category: "Lavagens", img: "🚿" },
  { id: "s2", name: "Lavagem Completa", desc: "Lava, seca, aspira, silicone, limpa os vidros e pretinho.", price: 55, duration: 45, active: true, category: "Lavagens", img: "✨" },
  { id: "s3", name: "Lavagem Completa com Cera Básica", desc: "Lava, seca, aspira, silicone, limpa vidros, cera básica e pretinho.", price: 60, duration: 50, active: true, category: "Lavagens", badge: "Mais pedido", img: "💎" },
  { id: "s4", name: "Lavagem Completa c/ Cera de 4 meses", desc: "Lava, seca, aspira, silicone, limpa vidros, cera (4 meses de proteção) e pretinho.", price: 70, duration: 55, active: true, category: "Lavagens", img: "🌟" },
  { id: "s5", name: "Lavagem Completa c/ Cera de 7 meses", desc: "Lava, seca, aspira, silicone, limpa vidros, cera (7 meses de proteção) e pretinho.", price: 90, duration: 60, active: true, category: "Lavagens", img: "🌟" },
  { id: "s6", name: "Higienização Simples", desc: "Higienização de banco.", price: 100, duration: 80, active: true, category: "Higienizações", img: "🧼" },
  { id: "s7", name: "Higienização Tradicional", desc: "Higienização de banco e teto.", price: 160, duration: 120, active: true, category: "Higienizações", img: "🪑" },
  { id: "s8", name: "Higienização Completa", desc: "Higienização de banco, teto, carpete e cinto.", price: 280, duration: 180, active: true, category: "Higienizações", img: "🫧" },
  { id: "s9", name: "Lavagem de Motor", desc: "Desengraxe e limpeza do compartimento do motor.", price: 70, duration: 30, active: true, category: "Extras", img: "🔧" },
  { id: "s10", name: "Polimento", desc: "Remoção de riscos e restauração do brilho — preço por porte do veículo.", tiered: true, tiers: { Pequeno: 250, Médio: 300, Grande: 350, Caminhonete: 400 }, duration: 150, active: true, category: "Extras", img: "🪞" },
];

const ServicesContext = React.createContext(SERVICES);
const VehiclesContext = React.createContext({ vehicles: [], addVehicle: () => {} });

const TIME_SLOTS = ["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00"];
const MAX_CAPACITY = 3;

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const fmtDate = (iso) => { const d = new Date(iso + "T00:00:00"); return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", weekday: "short" }); };
const money = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const servicePrice = (service, tier) => !service ? 0 : service.tiered ? (service.tiers[tier] ?? Math.min(...Object.values(service.tiers))) : service.price;
const apptPrice = (appt) => appt.price ?? servicePrice(SERVICES.find((s) => s.id === appt.serviceId), appt.tier);

const MY_VEHICLES = [
  { id: "v1", brand: "Toyota", model: "Corolla", year: "2022", color: "Prata", plate: "ABC1D23", type: "Sedã", size: "Médio", notes: "" },
  { id: "v2", brand: "Honda", model: "CG 160", year: "2020", color: "Preta", plate: "XYZ4E56", type: "Moto", size: "Pequeno", notes: "Cuidado com o escapamento cromado." },
];

const EMPLOYEES = [
  { id: "e1", name: "Rafael Souza", phone: "(11) 98888-1234", role: "Administrador", status: "Ativo", since: "2023-02-10" },
  { id: "e2", name: "Bianca Lima", phone: "(11) 97777-5678", role: "Gerente", status: "Ativo", since: "2023-05-14" },
  { id: "e3", name: "Diego Alves", phone: "(11) 96666-9012", role: "Funcionário", status: "Ativo", since: "2024-01-08" },
  { id: "e4", name: "Kaique Ferreira", phone: "(11) 95555-3456", role: "Funcionário", status: "Folga", since: "2024-06-19" },
];

const CLIENTS_DB = [
  { id: "c1", name: "João Pedro Martins", phone: "(11) 91234-5678", email: "joao.martins@email.com", vehicles: ["Toyota Corolla - ABC1D23"], visits: 14, spent: 980, lastVisit: "2026-08-20" },
  { id: "c2", name: "Carla Nascimento", phone: "(11) 99876-1122", email: "carla.n@email.com", vehicles: ["Honda Civic - QWE2R34"], visits: 6, spent: 410, lastVisit: "2026-08-25" },
  { id: "c3", name: "Marcos Vinícius", phone: "(11) 98765-4321", email: "marcos.v@email.com", vehicles: ["VW Golf - ZXC9V88"], visits: 21, spent: 1870, lastVisit: "2026-08-27" },
  { id: "c4", name: "Fernanda Costa", phone: "(11) 92222-8899", email: "fer.costa@email.com", vehicles: ["Jeep Compass - LKJ3H21"], visits: 3, spent: 265, lastVisit: "2026-08-11" },
  { id: "you", name: "Você (cliente logado)", phone: "(11) 90000-0000", email: "voce@email.com", vehicles: ["Toyota Corolla - ABC1D23", "Honda CG 160 - XYZ4E56"], visits: 9, spent: 610, lastVisit: "2026-08-24" },
];

const seedAppointments = () => [
  { id: "a1", clientId: "c1", clientName: "João Pedro Martins", vehicle: "Toyota Corolla - ABC1D23", serviceId: "s2", date: todayISO(), time: "09:00", status: "lavagem", payment: { status: "pendente" }, rating: null, photos: null },
  { id: "a2", clientId: "c2", clientName: "Carla Nascimento", vehicle: "Honda Civic - QWE2R34", serviceId: "s1", date: todayISO(), time: "09:30", status: "aguardando", payment: { status: "pendente" }, rating: null, photos: null },
  { id: "a3", clientId: "c3", clientName: "Marcos Vinícius", vehicle: "VW Golf - ZXC9V88", serviceId: "s6", date: todayISO(), time: "10:00", status: "chegou", payment: { status: "pendente" }, rating: null, photos: null },
  { id: "a4", clientId: "c4", clientName: "Fernanda Costa", vehicle: "Jeep Compass - LKJ3H21", serviceId: "s3", date: todayISO(), time: "10:30", status: "agendado", payment: { status: "pendente" }, rating: null, photos: null },
  { id: "a5", clientId: "you", clientName: "Você (cliente logado)", vehicle: "Toyota Corolla - ABC1D23", serviceId: "s4", date: addDaysISO(1), time: "14:00", status: "agendado", payment: { status: "pendente" }, rating: null, photos: null },
  { id: "a6", clientId: "you", clientName: "Você (cliente logado)", vehicle: "Honda CG 160 - XYZ4E56", serviceId: "s1", date: addDaysISO(-3), time: "11:00", status: "entregue", payment: { status: "pago", method: "Pix", amount: 45, employee: "Diego Alves", datetime: addDaysISO(-3) + " 11:40" }, rating: 5, photos: { before: true, after: true } },
  { id: "a7", clientId: "you", clientName: "Você (cliente logado)", vehicle: "Toyota Corolla - ABC1D23", serviceId: "s3", date: addDaysISO(-10), time: "15:00", status: "entregue", payment: { status: "pago", method: "Cartão de Débito", amount: 60, employee: "Bianca Lima", datetime: addDaysISO(-10) + " 15:55" }, rating: 4, photos: { before: true, after: true } },
  { id: "a8", clientId: "c1", clientName: "João Pedro Martins", vehicle: "Toyota Corolla - ABC1D23", serviceId: "s10", tier: "Médio", price: 300, date: addDaysISO(-1), time: "13:00", status: "entregue", payment: { status: "pago", method: "Dinheiro", amount: 300, employee: "Diego Alves", datetime: addDaysISO(-1) + " 15:05" }, rating: 5, photos: { before: true, after: true } },
];

/* ---- Estoque / produtos ---- */
const seedProducts = () => [
  { id: "p1", name: "Shampoo Automotivo", unit: "ml", quantity: 8000, minStock: 2000, cost: 0.02 },
  { id: "p2", name: "Cera Básica", unit: "ml", quantity: 3000, minStock: 1000, cost: 0.05 },
  { id: "p3", name: "Cera Proteção 4 meses", unit: "ml", quantity: 1200, minStock: 800, cost: 0.09 },
  { id: "p4", name: "Cera Proteção 7 meses", unit: "ml", quantity: 900, minStock: 800, cost: 0.12 },
  { id: "p5", name: "Pretinho de Pneu", unit: "ml", quantity: 2500, minStock: 1000, cost: 0.03 },
  { id: "p6", name: "Silicone Automotivo", unit: "ml", quantity: 1800, minStock: 1000, cost: 0.04 },
  { id: "p7", name: "Desengraxante", unit: "ml", quantity: 1500, minStock: 1000, cost: 0.03 },
  { id: "p8", name: "Produto de Higienização", unit: "ml", quantity: 400, minStock: 1000, cost: 0.08 },
  { id: "p9", name: "Pano de Microfibra", unit: "un", quantity: 45, minStock: 20, cost: 8 },
  { id: "p10", name: "Perfume Automotivo", unit: "un", quantity: 6, minStock: 10, cost: 12 },
  { id: "p11", name: "Cera de Polimento", unit: "ml", quantity: 1600, minStock: 600, cost: 0.15 },
];

// Receita: quanto cada serviço consome de cada produto (deduzido automaticamente)
const SERVICE_RECIPES = {
  s1: [{ productId: "p1", qty: 150 }, { productId: "p9", qty: 2 }],
  s2: [{ productId: "p1", qty: 150 }, { productId: "p6", qty: 80 }, { productId: "p5", qty: 40 }, { productId: "p9", qty: 2 }],
  s3: [{ productId: "p1", qty: 150 }, { productId: "p6", qty: 80 }, { productId: "p2", qty: 60 }, { productId: "p5", qty: 40 }, { productId: "p9", qty: 2 }],
  s4: [{ productId: "p1", qty: 150 }, { productId: "p6", qty: 80 }, { productId: "p3", qty: 80 }, { productId: "p5", qty: 40 }, { productId: "p9", qty: 2 }],
  s5: [{ productId: "p1", qty: 150 }, { productId: "p6", qty: 80 }, { productId: "p4", qty: 100 }, { productId: "p5", qty: 40 }, { productId: "p9", qty: 2 }],
  s6: [{ productId: "p8", qty: 150 }],
  s7: [{ productId: "p8", qty: 250 }],
  s8: [{ productId: "p8", qty: 400 }],
  s9: [{ productId: "p7", qty: 120 }],
  s10: [{ productId: "p11", qty: 120 }, { productId: "p9", qty: 3 }],
};

const DEFAULT_SECURITY = {
  password: "",
  configured: false,
  recoveryEmail: "",
  twoFAEnabled: false,
  loginLog: [],
};

/* ============================== UI PRIMITIVES ============================== */

function StatusPill({ status }) {
  const map = {
    agendado: "bg-slate-700/60 text-slate-200",
    chegou: "bg-sky-500/15 text-sky-300",
    aguardando: "bg-amber-500/15 text-amber-300",
    lavagem: "bg-cyan-500/15 text-cyan-300",
    finalizacao: "bg-violet-500/15 text-violet-300",
    pronto: "bg-emerald-500/15 text-emerald-300",
    entregue: "bg-slate-500/15 text-slate-300",
    cancelado: "bg-rose-500/15 text-rose-300",
  };
  if (status === "cancelado") {
    return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-rose-500/15 text-rose-300"><X size={12} strokeWidth={2.5} /> Cancelado</span>;
  }
  const s = STATUS_FLOW.find((x) => x.key === status);
  const Icon = s?.icon || Clock;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${map[status]}`}>
      <Icon size={12} strokeWidth={2.5} />
      {s?.label || status}
    </span>
  );
}

function PaymentPill({ payment }) {
  if (!payment || payment.status === "pendente")
    return <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-medium text-rose-300"><AlertCircle size={12} /> Pendente</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300"><Check size={12} /> Pago · {payment.method}</span>;
}

function StockPill({ product }) {
  if (product.quantity <= 0) return <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-medium text-rose-300"><PackageMinus size={12} /> Esgotado</span>;
  if (product.quantity <= product.minStock) return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300"><AlertCircle size={12} /> Estoque baixo</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300"><Package size={12} /> Em estoque</span>;
}

function Stars({ value, size = 16 }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map((n) => (
        <Star key={n} size={size} className={n <= value ? "fill-amber-400 text-amber-400" : "text-slate-600"} />
      ))}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
            <Icon size={18} />
          </div>
        )}
        <div>
          <h2 className="font-display text-lg text-slate-50 leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function passwordStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Fraca", color: "bg-rose-500", pct: 25 };
  if (score <= 3) return { label: "Média", color: "bg-amber-400", pct: 60 };
  return { label: "Forte", color: "bg-emerald-400", pct: 100 };
}

/* ============================== STATUS STEPPER ============================== */

function StatusStepper({ status }) {
  const idx = statusIndex(status);
  return (
    <div className="flex items-center">
      {STATUS_FLOW.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        const Icon = s.icon;
        return (
          <React.Fragment key={s.key}>
            <div className="flex flex-col items-center gap-1.5 relative">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all
                ${active ? "bg-cyan-400 border-cyan-400 text-slate-950 shadow-[0_0_0_6px_rgba(34,211,238,0.15)]" :
                  done ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300" : "bg-slate-800 border-slate-700 text-slate-500"}`}>
                <Icon size={14} strokeWidth={2.5} />
              </div>
              <span className={`text-[9px] leading-tight text-center w-14 ${active ? "text-cyan-300 font-semibold" : done ? "text-slate-400" : "text-slate-600"}`}>{s.label}</span>
            </div>
            {i < STATUS_FLOW.length - 1 && (
              <div className={`h-0.5 flex-1 -mt-4 ${i < idx ? "bg-cyan-500/50" : "bg-slate-800"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ============================== CLIENT APP ============================== */

function ClientApp({ appointments, setAppointments, queue, notifications, pushNotification, myClientId, vehicleIdByPlate, services }) {
  const { vehicles } = React.useContext(VehiclesContext);
  const [tab, setTab] = useState("inicio");
  const [booking, setBooking] = useState(null);
  const [goingNowResult, setGoingNowResult] = useState(null);
  const [historyDetail, setHistoryDetail] = useState(null);
  const [ratingTarget, setRatingTarget] = useState(null);

  const myAppointments = appointments.filter((a) => a.clientId === myClientId);
  const nextAppointment = myAppointments
    .filter((a) => a.status !== "entregue" && a.status !== "cancelado" && a.date >= todayISO())
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  const inServiceNow = myAppointments.find((a) => ["chegou","aguardando","lavagem","finalizacao","pronto"].includes(a.status));
  const history = myAppointments.filter((a) => a.status === "entregue").sort((a,b) => b.date.localeCompare(a.date));

  const startBooking = () => setBooking({ step: 1, vehicleId: null, serviceId: null, tier: null, date: todayISO(), time: null });

  const confirmBooking = async () => {
    const veh = vehicles.find((v) => v.id === booking.vehicleId);
    const service = services.find((s) => s.id === booking.serviceId);
    const price = servicePrice(service, booking.tier);
    const vehicleLabel = `${veh.brand} ${veh.model} - ${veh.plate}`;

    if (supabaseEnabled) {
      try {
        const vehicleId = vehicleIdByPlate[veh.plate];
        const newId = await createAppointment({ clientId: myClientId, vehicleId, serviceId: booking.serviceId, tier: booking.tier, price, date: booking.date, time: booking.time });
        setAppointments((prev) => [...prev, { id: newId, clientId: myClientId, clientName: "Você (cliente logado)", vehicle: vehicleLabel, serviceId: booking.serviceId, tier: booking.tier || null, price, date: booking.date, time: booking.time, status: "agendado", payment: { status: "pendente" }, rating: null, photos: null }]);
      } catch (err) {
        pushNotification("Não foi possível confirmar o agendamento agora. Tente novamente.");
        return;
      }
    } else {
      const id = "a" + Math.random().toString(36).slice(2, 8);
      setAppointments((prev) => [...prev, { id, clientId: "you", clientName: "Você (cliente logado)", vehicle: vehicleLabel, serviceId: booking.serviceId, tier: booking.tier || null, price, date: booking.date, time: booking.time, status: "agendado", payment: { status: "pendente" }, rating: null, photos: null }]);
    }
    pushNotification(`Agendamento confirmado para ${fmtDate(booking.date)} às ${booking.time}.`);
    setBooking({ ...booking, step: 5 });
  };

  const submitGoingNow = async () => {
    const activeAhead = queue.filter((a) => ["chegou","aguardando","lavagem","finalizacao"].includes(a.status)).length;
    const position = activeAhead + 1;
    const estWait = activeAhead * 15;
    const veh = vehicles[0];
    const vehicleLabel = `${veh.brand} ${veh.model} - ${veh.plate}`;
    const price = services.find((s) => s.id === "s1").price;

    if (supabaseEnabled) {
      try {
        const vehicleId = vehicleIdByPlate[veh.plate];
        const newId = await createAppointment({ clientId: myClientId, vehicleId, serviceId: "s1", tier: null, price, date: todayISO(), time: "agora", status: "chegou" });
        setAppointments((prev) => [...prev, { id: newId, clientId: myClientId, clientName: "Você (cliente logado)", vehicle: vehicleLabel, serviceId: "s1", date: todayISO(), time: "agora", status: "chegou", payment: { status: "pendente" }, rating: null, photos: null }]);
      } catch (err) { /* segue mesmo se a gravação remota falhar */ }
    } else {
      const id = "a" + Math.random().toString(36).slice(2, 8);
      setAppointments((prev) => [...prev, { id, clientId: "you", clientName: "Você (cliente logado)", vehicle: vehicleLabel, serviceId: "s1", date: todayISO(), time: "agora", status: "chegou", payment: { status: "pendente" }, rating: null, photos: null }]);
    }
    setGoingNowResult({ position, ahead: activeAhead, wait: estWait });
    pushNotification(`Você entrou na fila — posição ${position}, espera estimada de ${estWait} min.`);
  };

  const submitRating = (stars, comment) => {
    setAppointments((prev) => prev.map((a) => a.id === ratingTarget.id ? { ...a, rating: stars, comment } : a));
    if (supabaseEnabled) rateAppointment(ratingTarget.id, myClientId, stars, comment).catch(() => {});
    setRatingTarget(null);
  };

  const handleCancelAppointment = async (id) => {
    setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, status: "cancelado" } : a));
    if (supabaseEnabled) {
      try { await cancelAppointment(id, myClientId); } catch (err) { /* status local já refletiu; tenta de novo na próxima sincronização */ }
    }
    pushNotification("Agendamento cancelado.");
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-body relative">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-400 to-sky-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Droplets size={20} className="text-slate-950" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-display text-base leading-tight text-slate-50">SM Lavacar</p>
            <p className="text-[11px] text-slate-400">Rua Frei Mont Alverne, 64 · Aberto agora</p>
          </div>
        </div>
        <button className="relative w-9 h-9 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300">
          <Bell size={16} />
          {notifications.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-[9px] font-bold text-slate-950 flex items-center justify-center">{notifications.length}</span>}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-24">
        {tab === "inicio" && (
          <ClientHome
            nextAppointment={nextAppointment}
            inServiceNow={inServiceNow}
            onAgendar={() => { startBooking(); setTab("agendar"); }}
            onGoingNow={() => { setGoingNowResult(null); setTab("fila"); }}
            onOpenHistorico={() => setTab("historico")}
            onOpenVeiculos={() => setTab("perfil")}
            queueCount={queue.length}
            onCancelAppointment={handleCancelAppointment}
          />
        )}
        {tab === "agendar" && (
          <BookingFlow booking={booking} setBooking={setBooking} onStart={startBooking} onConfirm={confirmBooking} onDone={() => { setBooking(null); setTab("inicio"); }} />
        )}
        {tab === "fila" && <QueueTab goingNowResult={goingNowResult} onGoingNow={submitGoingNow} queue={queue} inServiceNow={inServiceNow} />}
        {tab === "historico" && <HistoryTab history={history} onOpen={setHistoryDetail} onRate={setRatingTarget} />}
        {tab === "perfil" && <ProfileTab reviews={myAppointments.filter((a) => a.rating).map((a) => ({ id: a.id, stars: a.rating, comment: a.comment || "", date: a.date }))} />}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 px-2 py-2 flex justify-around">
        {[
          { key: "inicio", label: "Início", icon: Home },
          { key: "agendar", label: "Agendar", icon: CalendarClock },
          { key: "fila", label: "Fila", icon: ListOrdered },
          { key: "historico", label: "Histórico", icon: History },
          { key: "perfil", label: "Perfil", icon: User },
        ].map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); if (t.key === "agendar" && !booking) startBooking(); }}
            className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors ${tab === t.key ? "text-cyan-400" : "text-slate-500"}`}>
            <t.icon size={19} strokeWidth={tab === t.key ? 2.5 : 2} />
            <span className="text-[10px] font-medium">{t.label}</span>
          </button>
        ))}
      </div>

      {historyDetail && <ServiceDetailModal appt={historyDetail} onClose={() => setHistoryDetail(null)} />}
      {ratingTarget && <RatingModal appt={ratingTarget} onClose={() => setRatingTarget(null)} onSubmit={submitRating} />}
    </div>
  );
}

function ClientHome({ nextAppointment, inServiceNow, onAgendar, onGoingNow, onOpenHistorico, onOpenVeiculos, queueCount, onCancelAppointment }) {
  const services = React.useContext(ServicesContext);
  const { vehicles } = React.useContext(VehiclesContext);
  const [cancelling, setCancelling] = useState(false);
  return (
    <div className="space-y-5 pt-1">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950 border border-slate-800 p-5">
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-cyan-500/10 blur-2xl" />
        <div className="absolute -left-8 bottom-0 w-28 h-28 rounded-full bg-amber-500/10 blur-2xl" />
        <p className="font-display text-xl text-slate-50 relative">Carro limpo,<br/>atendimento rápido.</p>
        <p className="text-xs text-slate-400 mt-1 relative">O que você precisa hoje?</p>
        <div className="grid grid-cols-2 gap-3 mt-4 relative">
          <button onClick={onAgendar} className="group flex flex-col items-start gap-2 rounded-2xl bg-cyan-400 text-slate-950 p-4 shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-transform">
            <CalendarClock size={22} strokeWidth={2.5} />
            <span className="font-display text-sm leading-tight text-left">Agendar<br/>Lavagem</span>
          </button>
          <button onClick={onGoingNow} className="group flex flex-col items-start gap-2 rounded-2xl bg-slate-800 border border-slate-700 p-4 active:scale-[0.98] transition-transform">
            <Navigation size={22} strokeWidth={2.5} className="text-amber-400" />
            <span className="font-display text-sm leading-tight text-left text-slate-100">Estou Indo<br/>Agora</span>
          </button>
        </div>
      </div>

      {inServiceNow && (
        <div className="rounded-2xl bg-slate-900 border border-cyan-500/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-cyan-300 uppercase tracking-wide">Seu veículo agora</p>
            <StatusPill status={inServiceNow.status} />
          </div>
          <p className="text-sm text-slate-300 mb-3">{inServiceNow.vehicle}</p>
          <StatusStepper status={inServiceNow.status} />
        </div>
      )}

      {nextAppointment && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <SectionTitle icon={CalendarDays} title="Próximo agendamento" />
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-slate-100 font-medium">{services.find(s => s.id === nextAppointment.serviceId)?.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{nextAppointment.vehicle}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-display text-cyan-300">{fmtDate(nextAppointment.date)}</p>
              <p className="text-xs text-slate-400">{nextAppointment.time}</p>
            </div>
          </div>
          {nextAppointment.status === "agendado" && onCancelAppointment && (
            <button
              disabled={cancelling}
              onClick={async () => { setCancelling(true); await onCancelAppointment(nextAppointment.id); setCancelling(false); }}
              className="w-full text-center text-xs text-rose-400 disabled:opacity-50 py-1.5"
            >
              {cancelling ? "Cancelando..." : "Cancelar agendamento"}
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={onOpenVeiculos} className="rounded-2xl bg-slate-900 border border-slate-800 p-4 text-left active:scale-[0.98] transition-transform">
          <Car size={18} className="text-cyan-400 mb-2" />
          <p className="text-sm font-medium text-slate-100">Meus veículos</p>
          <p className="text-xs text-slate-500">{vehicles.length} cadastrados</p>
        </button>
        <button onClick={onOpenHistorico} className="rounded-2xl bg-slate-900 border border-slate-800 p-4 text-left active:scale-[0.98] transition-transform">
          <History size={18} className="text-cyan-400 mb-2" />
          <p className="text-sm font-medium text-slate-100">Histórico</p>
          <p className="text-xs text-slate-500">Ver serviços anteriores</p>
        </button>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <SectionTitle icon={MapPin} title="SM Lavacar" subtitle="Rua Frei Mont Alverne, 64 — Jardim Pitangueiras 2" />
        <div className="rounded-xl h-24 bg-gradient-to-br from-slate-800 to-slate-850 border border-slate-800 flex items-center justify-center mb-3 relative overflow-hidden">
          <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 200 100"><path d="M0 60 Q50 20 100 60 T 200 60" stroke="#22d3ee" fill="none" strokeWidth="2"/><path d="M0 80 Q50 40 100 80 T 200 80" stroke="#f59e0b" fill="none" strokeWidth="2"/></svg>
          <MapPin size={22} className="text-cyan-400 relative" />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
          <span className="flex items-center gap-1"><Clock size={12}/> Seg–Sáb, 08:00–18:00</span>
          <span className="flex items-center gap-1"><Phone size={12}/> (11) 99771-0479</span>
        </div>
        <button className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 py-2.5 text-sm font-medium text-cyan-300">
          <Navigation size={14}/> Como chegar
        </button>
        <div className="flex items-center justify-center gap-4 mt-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><Phone size={11}/> WhatsApp (11) 99771-0479</span>
          <span>@sm.lavarcar</span>
        </div>
      </div>

      <div className="text-center text-[11px] text-slate-600 pb-2">{queueCount} veículo(s) na fila agora</div>
    </div>
  );
}

function BookingFlow({ booking, setBooking, onStart, onConfirm, onDone }) {
  const services = React.useContext(ServicesContext);
  const { vehicles } = React.useContext(VehiclesContext);
  if (!booking) {
    return (
      <div className="pt-12 text-center">
        <Sparkles size={28} className="mx-auto text-cyan-400 mb-3" />
        <p className="text-slate-300 mb-4 text-sm">Vamos agendar sua lavagem.</p>
        <button onClick={onStart} className="rounded-xl bg-cyan-400 text-slate-950 font-medium px-5 py-2.5 text-sm">Começar agendamento</button>
      </div>
    );
  }

  const { step, vehicleId, serviceId, tier, date, time } = booking;
  const service = services.find((s) => s.id === serviceId);
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const set = (patch) => setBooking({ ...booking, ...patch });
  const isSlotFull = (t) => (t === "09:00" || t === "10:00") && date === todayISO();
  const price = servicePrice(service, tier);
  const categories = ["Lavagens","Higienizações","Extras"];

  if (step === 5) {
    return (
      <div className="pt-16 text-center flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mb-4">
          <CheckCircle2 size={30} className="text-emerald-400" />
        </div>
        <p className="font-display text-lg text-slate-50">Agendamento confirmado!</p>
        <p className="text-sm text-slate-400 mt-1 mb-6">{fmtDate(date)} às {time} — {service?.name}</p>
        <button onClick={onDone} className="rounded-xl bg-slate-800 text-slate-100 px-5 py-2.5 text-sm font-medium">Voltar ao início</button>
      </div>
    );
  }

  return (
    <div className="pt-1">
      <div className="flex items-center gap-1.5 mb-5">
        {[1,2,3,4].map((n) => <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= Math.floor(step) ? "bg-cyan-400" : "bg-slate-800"}`} />)}
      </div>

      {step === 1 && (
        <div className="space-y-3">
          <SectionTitle icon={Car} title="Escolha o veículo" subtitle="Passo 1 de 4" />
          {vehicles.map((v) => (
            <button key={v.id} onClick={() => set({ vehicleId: v.id, step: 2 })}
              className={`w-full flex items-center justify-between rounded-2xl border p-4 text-left ${vehicleId === v.id ? "border-cyan-400 bg-cyan-500/5" : "border-slate-800 bg-slate-900"}`}>
              <div>
                <p className="text-sm font-medium text-slate-100">{v.brand} {v.model} · {v.color}</p>
                <p className="text-xs text-slate-500 mt-0.5">{v.plate} · {v.type} · {v.year}</p>
              </div>
              <ChevronRight size={16} className="text-slate-500" />
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <SectionTitle icon={Sparkles} title="Escolha o serviço" subtitle="Passo 2 de 4" action={<button onClick={() => set({ step: 1 })} className="text-xs text-slate-400 flex items-center gap-1"><ChevronLeft size={14}/>voltar</button>} />
          {categories.map((cat) => (
            <div key={cat} className="space-y-2">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{cat}</p>
              {services.filter((s) => s.active && s.category === cat).map((s) => (
                <button key={s.id} onClick={() => set({ serviceId: s.id, tier: s.tiered ? (vehicle?.size || "Médio") : null, step: s.tiered ? 2.5 : 3 })}
                  className={`w-full flex items-center gap-3 rounded-2xl border p-3.5 text-left ${serviceId === s.id ? "border-cyan-400 bg-cyan-500/5" : "border-slate-800 bg-slate-900"}`}>
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-lg shrink-0">{s.img}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-slate-100">{s.name}</p>
                      {s.badge && <span className="text-[9px] bg-amber-400/15 text-amber-300 px-1.5 py-0.5 rounded-full font-semibold">{s.badge}</span>}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{s.desc}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-display text-cyan-300">{s.tiered ? `a partir de ${money(Math.min(...Object.values(s.tiers)))}` : money(s.price)}</p>
                    <p className="text-[10px] text-slate-500 flex items-center gap-0.5 justify-end"><Timer size={10}/>{s.duration}min</p>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {step === 2.5 && service?.tiered && (
        <div className="space-y-3">
          <SectionTitle icon={Gauge} title="Porte do veículo" subtitle="Passo 2 de 4 · define o valor do polimento" action={<button onClick={() => set({ step: 2 })} className="text-xs text-slate-400 flex items-center gap-1"><ChevronLeft size={14}/>voltar</button>} />
          {Object.entries(service.tiers).map(([size, val]) => (
            <button key={size} onClick={() => set({ tier: size, step: 3 })}
              className={`w-full flex items-center justify-between rounded-2xl border p-4 text-left ${tier === size ? "border-cyan-400 bg-cyan-500/5" : "border-slate-800 bg-slate-900"}`}>
              <span className="text-sm text-slate-100">{size}{vehicle?.size === size && <span className="text-[10px] text-cyan-300 ml-1.5">(seu veículo)</span>}</span>
              <span className="text-sm font-display text-cyan-300">{money(val)}</span>
            </button>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <SectionTitle icon={CalendarDays} title="Data e horário" subtitle="Passo 3 de 4" action={<button onClick={() => set({ step: service?.tiered ? 2.5 : 2 })} className="text-xs text-slate-400 flex items-center gap-1"><ChevronLeft size={14}/>voltar</button>} />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[0,1,2,3,4,5,6].map((n) => {
              const d = addDaysISO(n);
              const active = d === date;
              return (
                <button key={d} onClick={() => set({ date: d, time: null })}
                  className={`shrink-0 rounded-2xl px-3.5 py-2.5 border text-center min-w-[64px] ${active ? "bg-cyan-400 border-cyan-400 text-slate-950" : "bg-slate-900 border-slate-800 text-slate-300"}`}>
                  <p className="text-[10px] uppercase font-medium">{new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short" })}</p>
                  <p className="text-sm font-display">{new Date(d + "T00:00:00").getDate()}</p>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {TIME_SLOTS.map((t) => {
              const full = isSlotFull(t);
              return (
                <button key={t} disabled={full} onClick={() => set({ time: t })}
                  className={`rounded-xl py-2.5 text-sm border ${full ? "border-slate-850 bg-slate-900/50 text-slate-600 line-through cursor-not-allowed" :
                    time === t ? "bg-cyan-400 border-cyan-400 text-slate-950 font-medium" : "bg-slate-900 border-slate-800 text-slate-200"}`}>
                  {t}
                </button>
              );
            })}
          </div>
          {time && <button onClick={() => set({ step: 4 })} className="w-full rounded-xl bg-cyan-400 text-slate-950 font-medium py-3 text-sm mt-2">Continuar</button>}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <SectionTitle icon={ClipboardList} title="Resumo do agendamento" subtitle="Passo 4 de 4" action={<button onClick={() => set({ step: 3 })} className="text-xs text-slate-400 flex items-center gap-1"><ChevronLeft size={14}/>voltar</button>} />
          <div className="rounded-2xl bg-slate-900 border border-slate-800 divide-y divide-slate-800">
            <div className="p-4 flex justify-between"><span className="text-xs text-slate-500">Serviço</span><span className="text-sm text-slate-100 font-medium">{service?.name}</span></div>
            <div className="p-4 flex justify-between"><span className="text-xs text-slate-500">Descrição</span><span className="text-sm text-slate-300 text-right max-w-[60%]">{service?.desc}</span></div>
            {tier && <div className="p-4 flex justify-between"><span className="text-xs text-slate-500">Porte</span><span className="text-sm text-slate-300">{tier}</span></div>}
            <div className="p-4 flex justify-between"><span className="text-xs text-slate-500">Preço</span><span className="text-sm text-cyan-300 font-display">{money(price)}</span></div>
            <div className="p-4 flex justify-between"><span className="text-xs text-slate-500">Tempo estimado</span><span className="text-sm text-slate-300">{service?.duration} min</span></div>
            <div className="p-4 flex justify-between"><span className="text-xs text-slate-500">Veículo</span><span className="text-sm text-slate-300">{vehicle?.brand} {vehicle?.model} · {vehicle?.plate}</span></div>
            <div className="p-4 flex justify-between"><span className="text-xs text-slate-500">Data</span><span className="text-sm text-slate-300">{fmtDate(date)}</span></div>
            <div className="p-4 flex justify-between"><span className="text-xs text-slate-500">Horário</span><span className="text-sm text-slate-300">{time}</span></div>
          </div>
          <p className="text-[11px] text-slate-500 text-center">Pagamento realizado presencialmente no lava-rápido.</p>
          <button onClick={onConfirm} className="w-full rounded-xl bg-cyan-400 text-slate-950 font-medium py-3 text-sm">Confirmar agendamento</button>
        </div>
      )}
    </div>
  );
}

function QueueTab({ goingNowResult, onGoingNow, queue, inServiceNow }) {
  return (
    <div className="pt-1 space-y-5">
      <SectionTitle icon={ListOrdered} title="Fila virtual" subtitle="Chegue sem agendamento" />
      {!goingNowResult && !inServiceNow && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 text-center">
          <Navigation size={26} className="mx-auto text-amber-400 mb-3" />
          <p className="text-sm text-slate-300 mb-4">Estou indo agora — entre na fila e acompanhe sua posição em tempo real.</p>
          <button onClick={onGoingNow} className="rounded-xl bg-amber-400 text-slate-950 font-medium px-5 py-2.5 text-sm">Entrar na fila agora</button>
        </div>
      )}
      {goingNowResult && (
        <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-slate-900 border border-amber-500/30 p-5">
          <p className="text-xs text-amber-300 font-semibold uppercase tracking-wide mb-2">Você está na fila</p>
          <p className="font-display text-2xl text-slate-50">Posição {goingNowResult.position}</p>
          <p className="text-sm text-slate-400 mt-1">Há {goingNowResult.ahead} carro(s) à sua frente.</p>
          <p className="text-sm text-slate-400">Tempo estimado de espera: <span className="text-amber-300 font-medium">{goingNowResult.wait} minutos</span></p>
        </div>
      )}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Fila atual do lava-rápido</p>
        <div className="space-y-2">
          {queue.length === 0 && <p className="text-sm text-slate-500">Nenhum veículo na fila agora.</p>}
          {queue.map((a, i) => (
            <div key={a.id} className="flex items-center gap-3 rounded-xl bg-slate-900 border border-slate-800 p-3">
              <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs font-display text-cyan-300 shrink-0">{i+1}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate">{a.clientName === "Você (cliente logado)" ? "Você" : a.clientName.split(" ")[0]} · {a.vehicle.split(" - ")[0]}</p>
              </div>
              <StatusPill status={a.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HistoryTab({ history, onOpen, onRate }) {
  const services = React.useContext(ServicesContext);
  return (
    <div className="pt-1 space-y-3">
      <SectionTitle icon={History} title="Meu histórico" subtitle={`${history.length} atendimentos concluídos`} />
      {history.map((a) => {
        const s = services.find((x) => x.id === a.serviceId);
        return (
          <div key={a.id} className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-100">{s?.name}</p>
              <span className="text-xs text-slate-500">{fmtDate(a.date)}</span>
            </div>
            <p className="text-xs text-slate-500 mb-3">{a.vehicle}</p>
            <div className="flex items-center justify-between">
              <PaymentPill payment={a.payment} />
              <span className="text-sm font-display text-cyan-300">{money(apptPrice(a))}</span>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => onOpen(a)} className="flex-1 rounded-lg bg-slate-800 py-2 text-xs font-medium text-slate-200">Ver detalhes</button>
              {a.rating ? (
                <div className="flex-1 flex items-center justify-center gap-1"><Stars value={a.rating} size={13} /></div>
              ) : (
                <button onClick={() => onRate(a)} className="flex-1 rounded-lg bg-amber-400/10 text-amber-300 py-2 text-xs font-medium">Avaliar</button>
              )}
            </div>
          </div>
        );
      })}
      {history.length === 0 && <p className="text-sm text-slate-500 text-center pt-8">Nenhum serviço concluído ainda.</p>}
    </div>
  );
}

function ServiceDetailModal({ appt, onClose }) {
  const services = React.useContext(ServicesContext);
  const s = services.find((x) => x.id === appt.serviceId);
  return (
    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-end z-30" onClick={onClose}>
      <div className="w-full bg-slate-900 rounded-t-3xl border-t border-slate-800 p-5 max-h-[85%] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-4" />
        <p className="font-display text-lg text-slate-50">{s?.name}</p>
        <p className="text-xs text-slate-500 mb-4">{fmtDate(appt.date)} às {appt.time} · {appt.vehicle}</p>
        {appt.photos && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="rounded-xl bg-slate-800 aspect-square flex flex-col items-center justify-center text-slate-500 gap-1"><ImageIcon size={22}/><span className="text-[10px]">Foto antes</span></div>
            <div className="rounded-xl bg-slate-800 aspect-square flex flex-col items-center justify-center text-slate-500 gap-1"><ImageIcon size={22}/><span className="text-[10px]">Foto depois</span></div>
          </div>
        )}
        <div className="rounded-xl bg-slate-850 border border-slate-800 divide-y divide-slate-800 mb-4">
          <div className="p-3 flex justify-between text-sm"><span className="text-slate-500">Valor</span><span className="text-cyan-300 font-medium">{money(apptPrice(appt))}</span></div>
          <div className="p-3 flex justify-between text-sm"><span className="text-slate-500">Forma de pagamento</span><span className="text-slate-200">{appt.payment?.method || "—"}</span></div>
          <div className="p-3 flex justify-between text-sm"><span className="text-slate-500">Status</span><PaymentPill payment={appt.payment} /></div>
        </div>
        {appt.rating && <div className="flex items-center gap-2 mb-2"><Stars value={appt.rating} /><span className="text-xs text-slate-500">sua avaliação</span></div>}
        <button onClick={onClose} className="w-full rounded-xl bg-slate-800 py-2.5 text-sm font-medium text-slate-200 mt-2">Fechar</button>
      </div>
    </div>
  );
}

function RatingModal({ appt, onClose, onSubmit }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  return (
    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-end z-30" onClick={onClose}>
      <div className="w-full bg-slate-900 rounded-t-3xl border-t border-slate-800 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-4" />
        <p className="font-display text-lg text-slate-50 text-center">Como foi sua experiência?</p>
        <div className="flex justify-center gap-2 my-5">
          {[1,2,3,4,5].map((n) => (
            <button key={n} onClick={() => setStars(n)}>
              <Star size={30} className={n <= stars ? "fill-amber-400 text-amber-400" : "text-slate-700"} />
            </button>
          ))}
        </div>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Conte para nós como foi o atendimento (opcional)"
          className="w-full rounded-xl bg-slate-800 border border-slate-700 p-3 text-sm text-slate-100 placeholder-slate-500 mb-4 resize-none" rows={3} />
        <button disabled={!stars} onClick={() => onSubmit(stars, comment)} className="w-full rounded-xl bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-medium py-2.5 text-sm">Enviar avaliação</button>
      </div>
    </div>
  );
}

function ProfileTab({ reviews }) {
  const [subtab, setSubtab] = useState("dados");
  const { vehicles, addVehicle } = React.useContext(VehiclesContext);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ brand: "", model: "", year: "", color: "", plate: "", type: "Sedã", size: "Médio", notes: "" });

  const resetForm = () => { setForm({ brand: "", model: "", year: "", color: "", plate: "", type: "Sedã", size: "Médio", notes: "" }); setFormError(""); setAdding(false); };

  const submitVehicle = async () => {
    if (!form.brand.trim() || !form.model.trim() || !form.plate.trim()) { setFormError("Preencha ao menos marca, modelo e placa."); return; }
    setSaving(true);
    try {
      await addVehicle(form);
      resetForm();
    } catch (err) {
      setFormError("Não foi possível salvar o veículo. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pt-1">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-400 to-sky-600 flex items-center justify-center text-slate-950">
          <UserCircle2 size={30} />
        </div>
        <div>
          <p className="font-display text-base text-slate-50">Você</p>
          <p className="text-xs text-slate-500">Cliente desde fev 2023</p>
        </div>
      </div>
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {[["dados","Meus dados"],["veiculos","Veículos"],["notificacoes","Notificações"],["avaliacoes","Avaliações"]].map(([k,l]) => (
          <button key={k} onClick={() => setSubtab(k)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium border ${subtab===k ? "bg-cyan-400 text-slate-950 border-cyan-400" : "border-slate-800 text-slate-400"}`}>{l}</button>
        ))}
      </div>

      {subtab === "dados" && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 divide-y divide-slate-800">
          {[["Nome","Você"],["Telefone","(11) 90000-0000"],["E-mail","voce@email.com"]].map(([l,v]) => (
            <div key={l} className="p-4 flex justify-between text-sm"><span className="text-slate-500">{l}</span><span className="text-slate-200">{v}</span></div>
          ))}
        </div>
      )}

      {subtab === "veiculos" && (
        <div className="space-y-2">
          {vehicles.map((v) => (
            <div key={v.id} className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center"><Car size={18} className="text-cyan-400"/></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-100">{v.brand} {v.model} · {v.color}</p>
                <p className="text-xs text-slate-500">{v.plate} · {v.type} · {v.year}</p>
              </div>
            </div>
          ))}
          {!adding && <button onClick={() => setAdding(true)} className="w-full rounded-xl border border-dashed border-slate-700 py-3 text-sm text-slate-400 flex items-center justify-center gap-1.5"><Plus size={14}/> Adicionar veículo</button>}

          {adding && (
            <div className="rounded-2xl bg-slate-900 border border-cyan-500/30 p-4 space-y-2.5">
              <p className="text-sm font-medium text-slate-100 mb-1">Novo veículo</p>
              <div className="grid grid-cols-2 gap-2.5">
                <input placeholder="Marca" value={form.brand} onChange={(e)=>setForm({...form,brand:e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
                <input placeholder="Modelo" value={form.model} onChange={(e)=>setForm({...form,model:e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
                <input placeholder="Ano" value={form.year} onChange={(e)=>setForm({...form,year:e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
                <input placeholder="Cor" value={form.color} onChange={(e)=>setForm({...form,color:e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
                <input placeholder="Placa" value={form.plate} onChange={(e)=>setForm({...form,plate:e.target.value.toUpperCase()})} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
                <select value={form.type} onChange={(e)=>setForm({...form,type:e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100">
                  {["Sedã","Hatch","SUV","Caminhonete","Moto"].map((t)=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Porte (usado no preço do polimento)</label>
                <select value={form.size} onChange={(e)=>setForm({...form,size:e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1">
                  {["Pequeno","Médio","Grande","Caminhonete"].map((s)=><option key={s}>{s}</option>)}
                </select>
              </div>
              {formError && <p className="text-xs text-rose-400">{formError}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={resetForm} className="flex-1 rounded-lg bg-slate-800 text-slate-200 py-2 text-sm font-medium">Cancelar</button>
                <button onClick={submitVehicle} disabled={saving} className="flex-1 rounded-lg bg-cyan-400 disabled:opacity-60 text-slate-950 py-2 text-sm font-medium">{saving ? "Salvando..." : "Salvar veículo"}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {subtab === "notificacoes" && (
        <div className="space-y-2">
          {["Confirmação de agendamento","Lembrete do agendamento","Veículo em lavagem","Veículo pronto","Atualização da fila"].map((n) => (
            <div key={n} className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 flex items-center justify-between">
              <span className="text-sm text-slate-300">{n}</span>
              <div className="w-9 h-5 rounded-full bg-cyan-400 flex items-center px-0.5"><div className="w-4 h-4 rounded-full bg-slate-950 ml-auto" /></div>
            </div>
          ))}
        </div>
      )}

      {subtab === "avaliacoes" && (
        <div className="space-y-2">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl bg-slate-900 border border-slate-800 p-3.5">
              <div className="flex items-center justify-between mb-1"><Stars value={r.stars} size={13}/><span className="text-[10px] text-slate-500">{fmtDate(r.date)}</span></div>
              <p className="text-sm text-slate-300">{r.comment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================== ADMIN LOGIN / SEGURANÇA ============================== */

function AdminGate({ security, setSecurity, onSuccess, onResetDemo }) {
  const [mode, setMode] = useState(supabaseEnabled ? "login" : (security.configured ? "login" : "setup"));
  const [email, setEmail] = useState(security.recoveryEmail);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [twofaCode, setTwofaCode] = useState("");
  const [twofaInput, setTwofaInput] = useState("");

  const [setupName, setSetupName] = useState("");
  const [setupPw, setSetupPw] = useState("");
  const [setupConfirm, setSetupConfirm] = useState("");
  const [setupEmail, setSetupEmail] = useState("");
  const [setupError, setSetupError] = useState("");

  const [fStep, setFStep] = useState(1);
  const [fEmail, setFEmail] = useState(security.recoveryEmail);
  const [fSentCode, setFSentCode] = useState("");
  const [fCodeInput, setFCodeInput] = useState("");
  const [fNewPw, setFNewPw] = useState("");
  const [fConfirmPw, setFConfirmPw] = useState("");
  const [fError, setFError] = useState("");
  const [fDone, setFDone] = useState(false);

  useEffect(() => {
    if (!lockedUntil) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [lockedUntil]);

  const locked = lockedUntil && now < lockedUntil;
  const secondsLeft = locked ? Math.ceil((lockedUntil - now) / 1000) : 0;
  const setupStrength = passwordStrength(setupPw);

  const logAttempt = (ok) => setSecurity((s) => ({ ...s, loginLog: [{ id: Date.now(), date: new Date().toLocaleString("pt-BR"), ok }, ...(s.loginLog || [])].slice(0, 8) }));

  const ensureEmployeeRecord = async (user, name) => {
    try {
      const { data: existing } = await supabase.from("employees").select("id").eq("auth_user_id", user.id).maybeSingle();
      if (!existing) {
        await supabase.from("employees").insert({ auth_user_id: user.id, name: name || user.email, role: "administrador" });
      }
    } catch (err) {
      // segue mesmo se essa etapa falhar — o login já foi validado pelo Supabase Auth
    }
  };

  const submitSetup = async (e) => {
    e.preventDefault();
    setSetupError("");
    if (setupPw.trim().length < 8) { setSetupError("Use pelo menos 8 caracteres."); return; }
    if (setupPw !== setupConfirm) { setSetupError("As senhas não coincidem."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(setupEmail.trim())) { setSetupError("Informe um e-mail válido."); return; }

    if (supabaseEnabled) {
      setLoading(true);
      const { data, error: signUpError } = await supabase.auth.signUp({ email: setupEmail.trim(), password: setupPw.trim(), options: { emailRedirectTo: window.location.origin } });
      setLoading(false);
      if (signUpError) { setSetupError(signUpError.message); return; }
      if (data.session) {
        await ensureEmployeeRecord(data.user, setupName.trim());
        setSecurity((s) => ({ ...s, recoveryEmail: setupEmail.trim(), configured: true }));
        onSuccess();
      } else {
        // projeto configurado para exigir confirmação de e-mail
        setMode("login");
        setInfo("Conta criada! Verifique seu e-mail para confirmar o acesso e depois entre normalmente.");
      }
      return;
    }

    setSecurity((s) => ({ ...s, password: setupPw.trim(), recoveryEmail: setupEmail.trim(), configured: true, loginLog: [{ id: Date.now(), date: new Date().toLocaleString("pt-BR"), ok: true }] }));
    onSuccess();
  };

  const submitLogin = async (e) => {
    e.preventDefault();
    if (locked) return;
    setError(""); setInfo("");

    if (supabaseEnabled) {
      setLoading(true);
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setLoading(false);
      if (signInError) {
        const next = attempts + 1;
        setAttempts(next);
        if (next >= 5) { setLockedUntil(Date.now() + 30000); setError("Muitas tentativas incorretas. Aguarde 30 segundos."); }
        else setError("E-mail ou senha incorretos.");
        return;
      }
      setAttempts(0);
      await ensureEmployeeRecord(data.user, data.user.email);
      setSecurity((s) => ({ ...s, recoveryEmail: email.trim(), configured: true }));
      onSuccess();
      return;
    }

    if (password.trim() !== security.password) {
      const next = attempts + 1;
      setAttempts(next);
      logAttempt(false);
      if (next >= 5) {
        setLockedUntil(Date.now() + 30000);
        setError("Muitas tentativas incorretas. Acesso bloqueado por 30 segundos.");
      } else {
        setError(`Senha incorreta. Tentativa ${next} de 5.`);
      }
      return;
    }
    setError("");
    setAttempts(0);
    if (security.twoFAEnabled) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      setTwofaCode(code);
      setMode("twofa");
    } else {
      logAttempt(true);
      onSuccess();
    }
  };

  const submitTwofa = (e) => {
    e.preventDefault();
    if (twofaInput === twofaCode) {
      logAttempt(true);
      onSuccess();
    } else {
      setError("Código incorreto. Confira o código de demonstração exibido acima.");
    }
  };

  const sendRecoveryCode = async () => {
    if (supabaseEnabled) {
      setFError(""); setLoading(true);
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(fEmail.trim(), { redirectTo: window.location.origin });
      setLoading(false);
      if (resetError) { setFError(resetError.message); return; }
      setFDone(true);
      return;
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setFSentCode(code);
    setFStep(2);
    setFError("");
  };

  const confirmRecoveryCode = () => {
    if (fCodeInput !== fSentCode) { setFError("Código incorreto."); return; }
    setFError("");
    setFStep(3);
  };

  const saveNewPassword = () => {
    if (fNewPw.trim().length < 8) { setFError("A senha precisa ter pelo menos 8 caracteres."); return; }
    if (fNewPw !== fConfirmPw) { setFError("As senhas não coincidem."); return; }
    setSecurity((s) => ({ ...s, password: fNewPw.trim(), configured: true }));
    setFDone(true);
    setFError("");
  };

  const strength = passwordStrength(fNewPw);

  return (
    <div className="w-full h-full flex items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-sky-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 mb-3">
            <Lock size={24} className="text-slate-950" strokeWidth={2.5} />
          </div>
          <p className="font-display text-lg text-slate-50">Painel Administrativo</p>
          <p className="text-xs text-slate-500">SM Lavacar</p>
        </div>

        {mode === "setup" && (
          <form onSubmit={submitSetup} className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3.5">
            <div className="flex items-center gap-2 text-cyan-300 mb-1"><ShieldCheck size={16}/><p className="text-sm font-medium">{supabaseEnabled ? "Criar conta de administrador" : "Primeiro acesso — crie sua senha"}</p></div>
            <p className="text-xs text-slate-500">{supabaseEnabled ? "Sua conta fica protegida pela autenticação do Supabase (senha com hash criptográfico, nunca em texto puro)." : "Nenhuma senha padrão fica exposta no sistema. Defina a sua agora — só você (e quem você compartilhar) vai conhecê-la."}</p>
            {supabaseEnabled && (
              <div>
                <label className="text-xs text-slate-400">Seu nome</label>
                <input value={setupName} onChange={(e) => setSetupName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 mt-1" />
              </div>
            )}
            <div>
              <label className="text-xs text-slate-400">{supabaseEnabled ? "E-mail" : "Senha de acesso"}</label>
              {supabaseEnabled ? (
                <div className="relative mt-1">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="email" value={setupEmail} onChange={(e) => setSetupEmail(e.target.value)} placeholder="seuemail@exemplo.com" className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-100" />
                </div>
              ) : (
                <div className="relative mt-1">
                  <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type={showPw ? "text" : "password"} value={setupPw} onChange={(e) => setSetupPw(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-9 py-2.5 text-sm text-slate-100" />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  {setupPw && (
                    <div className="mt-1.5">
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className={`h-full ${setupStrength.color}`} style={{ width: `${setupStrength.pct}%` }} /></div>
                      <p className="text-[10px] text-slate-500 mt-0.5">Força da senha: {setupStrength.label}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            {supabaseEnabled && (
              <div>
                <label className="text-xs text-slate-400">Senha</label>
                <div className="relative mt-1">
                  <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type={showPw ? "text" : "password"} value={setupPw} onChange={(e) => setSetupPw(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-9 py-2.5 text-sm text-slate-100" />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {setupPw && (
                  <div className="mt-1.5">
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className={`h-full ${setupStrength.color}`} style={{ width: `${setupStrength.pct}%` }} /></div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Força da senha: {setupStrength.label}</p>
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="text-xs text-slate-400">Confirmar senha</label>
              <input type={showPw ? "text" : "password"} value={setupConfirm} onChange={(e) => setSetupConfirm(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 mt-1" />
            </div>
            {!supabaseEnabled && (
              <div>
                <label className="text-xs text-slate-400">E-mail de recuperação</label>
                <div className="relative mt-1">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="email" value={setupEmail} onChange={(e) => setSetupEmail(e.target.value)} placeholder="seuemail@exemplo.com" className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-100" />
                </div>
                <p className="text-[10px] text-slate-600 mt-1">Usado apenas se você precisar recuperar o acesso.</p>
              </div>
            )}
            {setupError && <p className="text-xs text-rose-400 flex items-center gap-1.5"><ShieldAlert size={13}/> {setupError}</p>}
            <button type="submit" disabled={loading} className="w-full rounded-xl bg-cyan-400 disabled:opacity-60 text-slate-950 font-medium py-2.5 text-sm">{loading ? "Criando conta..." : supabaseEnabled ? "Criar conta e entrar" : "Criar senha e entrar"}</button>
            {supabaseEnabled && <button type="button" onClick={() => { setMode("login"); setSetupError(""); }} className="w-full text-center text-xs text-slate-500">Já tenho conta — fazer login</button>}
          </form>
        )}

        {mode === "login" && (
          <form onSubmit={submitLogin} className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3.5">
            {info && <p className="text-xs text-emerald-400 flex items-center gap-1.5"><CheckCircle2 size={13}/> {info}</p>}
            <div>
              <label className="text-xs text-slate-400">E-mail</label>
              <div className="relative mt-1">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-100" />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400">Senha</label>
              <div className="relative mt-1">
                <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} disabled={locked}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-9 py-2.5 text-sm text-slate-100 disabled:opacity-50" />
                <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-rose-400 flex items-center gap-1.5"><ShieldAlert size={13}/> {error}</p>}
            {locked && <p className="text-xs text-amber-300">Tente novamente em {secondsLeft}s.</p>}
            <button type="submit" disabled={locked || loading} className="w-full rounded-xl bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-medium py-2.5 text-sm">{loading ? "Entrando..." : "Entrar"}</button>
            <button type="button" onClick={() => { setMode("forgot"); setFStep(1); setFDone(false); setFError(""); }} className="w-full text-center text-xs text-cyan-300">Esqueci minha senha</button>
            {supabaseEnabled && <button type="button" onClick={() => { setMode("setup"); setSetupError(""); setInfo(""); }} className="w-full text-center text-xs text-slate-500">Primeiro acesso — criar conta</button>}
            {onResetDemo && !supabaseEnabled && (
              <button type="button" onClick={() => { if (confirm("Isso apaga a senha atual e todos os dados salvos (agendamentos, estoque) e restaura o ambiente de demonstração. Continuar?")) onResetDemo(); }} className="w-full text-center text-[10px] text-slate-600 hover:text-slate-400 pt-1">Não consigo entrar — reiniciar ambiente</button>
            )}
          </form>
        )}

        {mode === "twofa" && (
          <form onSubmit={submitTwofa} className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3.5">
            <div className="flex items-center gap-2 text-cyan-300"><Smartphone size={16}/><p className="text-sm font-medium">Verificação em duas etapas</p></div>
            <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 p-3 text-center">
              <p className="text-[10px] text-slate-400 mb-1">Código de demonstração (simula SMS/e-mail)</p>
              <p className="font-display text-xl tracking-[0.3em] text-cyan-300">{twofaCode}</p>
            </div>
            <input value={twofaInput} onChange={(e) => setTwofaInput(e.target.value)} maxLength={6} placeholder="Digite o código de 6 dígitos"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 text-center tracking-[0.3em]" />
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <button type="submit" className="w-full rounded-xl bg-cyan-400 text-slate-950 font-medium py-2.5 text-sm">Confirmar código</button>
            <button type="button" onClick={() => setMode("login")} className="w-full text-center text-xs text-slate-500">Voltar</button>
          </form>
        )}

        {mode === "forgot" && (
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3.5">
            <div className="flex items-center gap-2 text-cyan-300"><RotateCcw size={15}/><p className="text-sm font-medium">Recuperar senha</p></div>

            {fStep === 1 && !fDone && (
              <>
                <p className="text-xs text-slate-400">{supabaseEnabled ? "Enviaremos um link de redefinição de senha para o seu e-mail." : "Enviaremos um código de verificação para o e-mail de recuperação cadastrado."}</p>
                <input value={fEmail} onChange={(e) => setFEmail(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100" />
                {fError && <p className="text-xs text-rose-400">{fError}</p>}
                <button onClick={sendRecoveryCode} disabled={loading} className="w-full rounded-xl bg-cyan-400 disabled:opacity-60 text-slate-950 font-medium py-2.5 text-sm">{loading ? "Enviando..." : supabaseEnabled ? "Enviar link de redefinição" : "Enviar código"}</button>
              </>
            )}

            {!supabaseEnabled && fStep === 2 && !fDone && (
              <>
                <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 p-3 text-center">
                  <p className="text-[10px] text-slate-400 mb-1">Código enviado (modo demonstração)</p>
                  <p className="font-display text-xl tracking-[0.3em] text-cyan-300">{fSentCode}</p>
                </div>
                <input value={fCodeInput} onChange={(e) => setFCodeInput(e.target.value)} maxLength={6} placeholder="Digite o código recebido"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 text-center tracking-[0.3em]" />
                {fError && <p className="text-xs text-rose-400">{fError}</p>}
                <button onClick={confirmRecoveryCode} className="w-full rounded-xl bg-cyan-400 text-slate-950 font-medium py-2.5 text-sm">Verificar código</button>
              </>
            )}

            {!supabaseEnabled && fStep === 3 && !fDone && (
              <>
                <div>
                  <label className="text-xs text-slate-400">Nova senha</label>
                  <input type="password" value={fNewPw} onChange={(e) => setFNewPw(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 mt-1" />
                  {fNewPw && (
                    <div className="mt-1.5">
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className={`h-full ${strength.color}`} style={{ width: `${strength.pct}%` }} /></div>
                      <p className="text-[10px] text-slate-500 mt-0.5">Força da senha: {strength.label}</p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs text-slate-400">Confirmar nova senha</label>
                  <input type="password" value={fConfirmPw} onChange={(e) => setFConfirmPw(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 mt-1" />
                </div>
                {fError && <p className="text-xs text-rose-400">{fError}</p>}
                <button onClick={saveNewPassword} className="w-full rounded-xl bg-cyan-400 text-slate-950 font-medium py-2.5 text-sm">Salvar nova senha</button>
              </>
            )}

            {fDone && (
              <div className="text-center py-2">
                <CheckCircle2 size={26} className="mx-auto text-emerald-400 mb-2" />
                <p className="text-sm text-slate-200 mb-3">{supabaseEnabled ? "Link enviado! Confira seu e-mail para definir a nova senha." : "Senha alterada com sucesso."}</p>
                <button onClick={() => { setMode("login"); setPassword(""); }} className="w-full rounded-xl bg-slate-800 text-slate-100 py-2.5 text-sm font-medium">Voltar para o login</button>
              </div>
            )}

            {!fDone && <button onClick={() => setMode("login")} className="w-full text-center text-xs text-slate-500">Cancelar</button>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================== ADMIN PANEL ============================== */

function AdminApp({ appointments, setAppointments, queue, employees, setEmployeesState, clientsDb, servicesState, setServicesState, products, setProducts, stockLog, addStockLog, security, setSecurity, onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const lowStock = products.filter((p) => p.quantity <= p.minStock);

  const navItems = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "agenda", label: "Agenda", icon: CalendarDays },
    { key: "fila", label: "Fila", icon: ListOrdered },
    { key: "atendimentos", label: "Atendimentos", icon: ClipboardList },
    { key: "clientes", label: "Clientes", icon: Users },
    { key: "veiculos", label: "Veículos", icon: Car },
    { key: "servicos", label: "Serviços", icon: Wrench },
    { key: "estoque", label: "Estoque", icon: PackageSearch, badge: lowStock.length || null },
    { key: "funcionarios", label: "Funcionários", icon: UserCircle2 },
    { key: "financeiro", label: "Financeiro", icon: Wallet },
    { key: "relatorios", label: "Relatórios", icon: BarChart3 },
    { key: "configuracoes", label: "Configurações", icon: Settings },
  ];

  const consumeStock = (serviceId) => {
    const recipe = SERVICE_RECIPES[serviceId] || [];
    if (!recipe.length) return;
    setProducts((prev) => prev.map((p) => {
      const use = recipe.find((r) => r.productId === p.id);
      if (!use) return p;
      return { ...p, quantity: Math.max(0, p.quantity - use.qty) };
    }));
    recipe.forEach((r) => addStockLog({ productId: r.productId, type: "saida", qty: r.qty, reason: "Consumo automático de serviço" }));
    if (supabaseEnabled) consumeStockRemote(recipe).catch(() => {});
  };

  const updateStatus = (id, status) => {
    setAppointments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target && status === "lavagem" && target.status !== "lavagem") {
        consumeStock(target.serviceId);
      }
      return prev.map((a) => a.id === id ? { ...a, status } : a);
    });
    if (supabaseEnabled) updateAppointmentStatus(id, status).catch(() => {});
  };
  const updatePayment = (id, payment) => {
    setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, payment } : a));
    if (supabaseEnabled) updateAppointmentPayment(id, payment).catch(() => {});
  };

  return (
    <div className="flex h-full bg-slate-950 text-slate-100 font-body">
      <div className="w-56 shrink-0 border-r border-slate-800 bg-slate-925 flex-col py-4 hidden md:flex">
        <div className="flex items-center gap-2.5 px-4 mb-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-sky-600 flex items-center justify-center shrink-0">
            <Droplets size={18} className="text-slate-950" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm text-slate-50 leading-tight truncate">SM Lavacar</p>
            <p className="text-[10px] text-slate-500">Painel Administrativo</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {navItems.map((n) => (
            <button key={n.key} onClick={() => setTab(n.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors relative ${tab === n.key ? "bg-cyan-500/10 text-cyan-300" : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"}`}>
              <n.icon size={16} />
              {n.label}
              {n.badge && <span className="ml-auto w-5 h-5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold flex items-center justify-center">{n.badge}</span>}
            </button>
          ))}
        </div>
        <div className="px-4 pt-3 border-t border-slate-850 mt-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center"><UserCircle2 size={16} className="text-slate-400"/></div>
            <div className="min-w-0">
              <p className="text-xs text-slate-200 truncate">Rafael Souza</p>
              <p className="text-[10px] text-slate-500">Administrador</p>
            </div>
          </div>
          <button onClick={onLogout} className="w-full flex items-center gap-2 text-xs text-slate-500 hover:text-rose-300 px-1"><LogOut size={13}/> Sair</button>
        </div>
      </div>

      <div className="md:hidden absolute top-0 left-0 right-0 z-20 bg-slate-925 border-b border-slate-800 flex overflow-x-auto px-2 py-2 gap-1">
        {navItems.map((n) => (
          <button key={n.key} onClick={() => setTab(n.key)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${tab === n.key ? "bg-cyan-400 text-slate-950" : "bg-slate-900 text-slate-400"}`}>
            <n.icon size={12} /> {n.label}{n.badge ? ` (${n.badge})` : ""}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5 md:p-6 pt-16 md:pt-6">
        {lowStock.length > 0 && tab !== "estoque" && (
          <button onClick={() => setTab("estoque")} className="w-full mb-4 flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 text-left">
            <AlertCircle size={15} className="text-amber-300 shrink-0" />
            <span className="text-xs text-amber-200">{lowStock.length} produto(s) com estoque baixo ou esgotado — clique para ver o estoque.</span>
          </button>
        )}
        {tab === "dashboard" && <AdminDashboard appointments={appointments} queue={queue} lowStock={lowStock} />}
        {tab === "agenda" && <AdminAgenda appointments={appointments} updateStatus={updateStatus} setAppointments={setAppointments} />}
        {tab === "fila" && <AdminQueue queue={queue} updateStatus={updateStatus} />}
        {tab === "atendimentos" && <AdminAtendimentos appointments={appointments} updateStatus={updateStatus} updatePayment={updatePayment} employees={employees} />}
        {tab === "clientes" && <AdminClientes clientsDb={clientsDb} appointments={appointments} />}
        {tab === "veiculos" && <AdminVeiculos appointments={appointments} />}
        {tab === "servicos" && <AdminServicos servicesState={servicesState} setServicesState={setServicesState} />}
        {tab === "estoque" && <AdminEstoque products={products} setProducts={setProducts} stockLog={stockLog} addStockLog={addStockLog} />}
        {tab === "funcionarios" && <AdminFuncionarios employees={employees} setEmployeesState={setEmployeesState} />}
        {tab === "financeiro" && <AdminFinanceiro appointments={appointments} />}
        {tab === "relatorios" && <AdminRelatorios appointments={appointments} />}
        {tab === "configuracoes" && <AdminConfiguracoes security={security} setSecurity={setSecurity} />}
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, accent = "cyan" }) {
  const colors = { cyan: "text-cyan-400 bg-cyan-500/10", amber: "text-amber-400 bg-amber-500/10", emerald: "text-emerald-400 bg-emerald-500/10", rose: "text-rose-400 bg-rose-500/10", violet: "text-violet-400 bg-violet-500/10" };
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colors[accent]}`}><Icon size={17}/></div>
      </div>
      <p className="font-display text-2xl text-slate-50">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-slate-600 mt-1">{sub}</p>}
    </div>
  );
}

function AdminDashboard({ appointments, queue, lowStock }) {
  const services = React.useContext(ServicesContext);
  const today = todayISO();
  const todays = appointments.filter((a) => a.date === today);
  const emLavagem = appointments.filter((a) => a.status === "lavagem").length;
  const prontos = appointments.filter((a) => a.status === "pronto").length;
  const concluidos = appointments.filter((a) => a.date === today && a.status === "entregue").length;
  const revenueToday = appointments.filter((a) => a.payment?.status === "pago" && a.payment?.datetime?.startsWith(today)).reduce((s,a)=>s+(a.payment.amount||0),0);
  const revenueMonth = appointments.filter((a) => a.payment?.status === "pago" && a.payment?.datetime?.slice(0,7) === today.slice(0,7)).reduce((s,a)=>s+(a.payment.amount||0),0);
  const rated = appointments.filter((a) => a.rating);
  const avgRating = rated.length ? (rated.reduce((s,a)=>s+a.rating,0) / rated.length).toFixed(1) : "—";
  const weekDates = [6,5,4,3,2,1,0].map((n) => addDaysISO(-n));
  const weekBars = weekDates.map((d) => appointments.filter((a) => a.date === d).length);
  const maxBar = Math.max(...weekBars, 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl text-slate-50">Dashboard</h1>
        <p className="text-sm text-slate-500">Visão geral de hoje, {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={CalendarDays} label="Agendamentos hoje" value={todays.length} accent="cyan" />
        <KpiCard icon={ListOrdered} label="Carros na fila" value={queue.length} accent="amber" />
        <KpiCard icon={Droplets} label="Em lavagem" value={emLavagem} accent="violet" />
        <KpiCard icon={CheckCircle2} label="Prontos" value={prontos} accent="emerald" />
        <KpiCard icon={ShieldCheck} label="Concluídos hoje" value={concluidos} accent="cyan" />
        <KpiCard icon={DollarSign} label="Faturamento do dia" value={money(revenueToday)} accent="emerald" />
        <KpiCard icon={Wallet} label="Faturamento do mês" value={money(revenueMonth)} accent="emerald" />
        <KpiCard icon={Star} label="Avaliação média" value={avgRating} sub={`${rated.length} avaliações`} accent="amber" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
          <SectionTitle icon={TrendingUp} title="Lavagens na semana" subtitle="Últimos 7 dias" />
          <div className="flex items-end gap-3 h-32 mt-2">
            {weekBars.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full rounded-t-md bg-gradient-to-t from-cyan-600 to-cyan-400" style={{ height: `${(v/maxBar)*100}%`, minHeight: v > 0 ? "4px" : 0 }} />
                <span className="text-[10px] text-slate-500">{new Date(weekDates[i]+"T00:00:00").toLocaleDateString("pt-BR",{weekday:"narrow"}).toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
          <SectionTitle icon={PackageSearch} title="Alertas de estoque" subtitle={`${lowStock.length} produto(s)`} />
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {lowStock.length === 0 && <p className="text-sm text-slate-500">Todos os produtos em nível saudável.</p>}
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{p.name}</span>
                <span className={p.quantity<=0 ? "text-rose-300" : "text-amber-300"}>{p.quantity}{p.unit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
        <SectionTitle icon={ClipboardList} title="Próximos agendamentos de hoje" />
        <div className="space-y-2">
          {todays.slice(0,5).map((a) => (
            <div key={a.id} className="flex items-center justify-between py-2 border-b border-slate-850 last:border-0 text-sm">
              <div className="flex items-center gap-3">
                <span className="font-display text-cyan-300 w-12">{a.time}</span>
                <span className="text-slate-300">{a.clientName}</span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-500">{services.find(s=>s.id===a.serviceId)?.name}</span>
              </div>
              <StatusPill status={a.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminAgenda({ appointments, updateStatus, setAppointments }) {
  const services = React.useContext(ServicesContext);
  const [view, setView] = useState("dia");
  const [date, setDate] = useState(todayISO());
  const dayAppts = appointments.filter((a) => a.date === date).sort((a,b)=>a.time.localeCompare(b.time));
  const weekDates = [0,1,2,3,4,5,6].map((n)=>addDaysISO(n));

  const [clients, setClients] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const blankForm = { clientId: "", vehicleId: "", serviceId: services[0]?.id || "", tier: "", date: date, time: TIME_SLOTS[0] };
  const [form, setForm] = useState(blankForm);

  useEffect(() => {
    if (!supabaseEnabled) return;
    Promise.all([fetchClients(), fetchVehiclesAdmin()]).then(([cs, vs]) => { setClients(cs); setVehicles(vs); });
  }, []);

  const openCreate = () => { setForm({ ...blankForm, date, serviceId: services[0]?.id || "" }); setFormError(""); setCreating(true); };
  const clientVehicles = vehicles.filter((v) => v.client_id === form.clientId);
  const selectedService = services.find((s) => s.id === form.serviceId);

  const submitAppointment = async () => {
    if (!form.clientId || !form.vehicleId || !form.serviceId || !form.time) { setFormError("Preencha todos os campos."); return; }
    if (selectedService?.tiered && !form.tier) { setFormError("Escolha o porte do veículo para o polimento."); return; }
    setSaving(true);
    try {
      const price = servicePrice(selectedService, form.tier);
      const client = clients.find((c) => c.id === form.clientId);
      const vehicle = vehicles.find((v) => v.id === form.vehicleId);
      if (supabaseEnabled) {
        const newId = await createAppointment({ clientId: form.clientId, vehicleId: form.vehicleId, serviceId: form.serviceId, tier: form.tier || null, price, date: form.date, time: form.time });
        setAppointments((prev) => [...prev, { id: newId, clientId: form.clientId, clientName: client?.name, vehicle: `${vehicle.brand} ${vehicle.model} - ${vehicle.plate}`, serviceId: form.serviceId, tier: form.tier || null, price, date: form.date, time: form.time, status: "agendado", payment: { status: "pendente" }, rating: null, photos: null }]);
      }
      setCreating(false);
    } catch (err) {
      setFormError("Não foi possível criar o agendamento. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl text-slate-50">Agenda</h1>
          <p className="text-sm text-slate-500">Gerencie os agendamentos do lava-rápido</p>
        </div>
        <div className="flex items-center gap-2">
          {supabaseEnabled && <button onClick={openCreate} className="flex items-center gap-1.5 rounded-xl bg-cyan-400 text-slate-950 text-sm font-medium px-3.5 py-2"><Plus size={14}/> Novo agendamento</button>}
          <div className="flex gap-1 bg-slate-900 rounded-xl p-1 border border-slate-800">
            {["dia","semana","mes"].map((v) => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${view===v ? "bg-cyan-400 text-slate-950":"text-slate-400"}`}>{v}</button>
            ))}
          </div>
        </div>
      </div>

      {creating && (
        <div className="rounded-2xl bg-slate-900 border border-cyan-500/30 p-4 space-y-3 max-w-lg">
          <p className="text-sm font-medium text-slate-100">Novo agendamento</p>
          <div>
            <label className="text-xs text-slate-400">Cliente</label>
            <select value={form.clientId} onChange={(e)=>setForm({...form, clientId: e.target.value, vehicleId: ""})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1">
              <option value="">Selecione...</option>
              {clients.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Veículo</label>
            <select value={form.vehicleId} onChange={(e)=>setForm({...form, vehicleId: e.target.value})} disabled={!form.clientId} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1 disabled:opacity-50">
              <option value="">{form.clientId ? (clientVehicles.length ? "Selecione..." : "Cliente sem veículos cadastrados") : "Escolha o cliente primeiro"}</option>
              {clientVehicles.map((v)=><option key={v.id} value={v.id}>{v.brand} {v.model} - {v.plate}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Serviço</label>
            <select value={form.serviceId} onChange={(e)=>setForm({...form, serviceId: e.target.value, tier: ""})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1">
              {services.filter((s)=>s.active).map((s)=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {selectedService?.tiered && (
            <div>
              <label className="text-xs text-slate-400">Porte do veículo</label>
              <select value={form.tier} onChange={(e)=>setForm({...form, tier: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1">
                <option value="">Selecione...</option>
                {Object.keys(selectedService.tiers || {}).map((size)=><option key={size} value={size}>{size} — {money(selectedService.tiers[size])}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">Data</label>
              <input type="date" value={form.date} onChange={(e)=>setForm({...form, date: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Horário</label>
              <select value={form.time} onChange={(e)=>setForm({...form, time: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1">
                {TIME_SLOTS.map((t)=><option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          {formError && <p className="text-xs text-rose-400">{formError}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={()=>setCreating(false)} className="flex-1 rounded-lg bg-slate-800 text-slate-200 py-2 text-sm font-medium">Cancelar</button>
            <button onClick={submitAppointment} disabled={saving} className="flex-1 rounded-lg bg-cyan-400 disabled:opacity-60 text-slate-950 py-2 text-sm font-medium">{saving ? "Salvando..." : "Criar agendamento"}</button>
          </div>
        </div>
      )}

      {view === "dia" && (
        <>
          <div className="flex gap-2 overflow-x-auto">
            {weekDates.map((d) => (
              <button key={d} onClick={() => setDate(d)} className={`shrink-0 rounded-xl px-4 py-2 border text-sm ${d===date ? "bg-cyan-400 border-cyan-400 text-slate-950 font-medium":"bg-slate-900 border-slate-800 text-slate-300"}`}>{fmtDate(d)}</button>
            ))}
          </div>
          <div className="rounded-2xl bg-slate-900 border border-slate-800 divide-y divide-slate-850">
            {dayAppts.length === 0 && <p className="text-sm text-slate-500 p-5">Nenhum agendamento nesta data.</p>}
            {dayAppts.map((a) => <AgendaRow key={a.id} a={a} updateStatus={updateStatus} />)}
          </div>
        </>
      )}

      {view === "semana" && (
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((d) => {
            const items = appointments.filter((a) => a.date === d);
            return (
              <div key={d} className="rounded-xl bg-slate-900 border border-slate-800 p-2 min-h-[140px]">
                <p className="text-[10px] text-slate-500 mb-1.5">{fmtDate(d)}</p>
                <div className="space-y-1">
                  {items.slice(0,4).map((a) => <div key={a.id} className="text-[10px] rounded-md bg-slate-800 px-1.5 py-1 truncate text-slate-300">{a.time} {a.clientName.split(" ")[0]}</div>)}
                  {items.length > 4 && <p className="text-[10px] text-slate-600">+{items.length-4} mais</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "mes" && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
          <p className="text-sm text-slate-400 mb-3">Total de agendamentos no mês: <span className="text-cyan-300 font-medium">{appointments.length}</span></p>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {Array.from({length: 30}).map((_, i) => {
              const d = addDaysISO(i - 10);
              const count = appointments.filter((a) => a.date === d).length;
              return (
                <div key={i} className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] border ${count>0?"border-cyan-500/30 bg-cyan-500/5 text-cyan-300":"border-slate-850 text-slate-600"}`}>
                  <span>{new Date(d+"T00:00:00").getDate()}</span>
                  {count>0 && <span className="text-[9px]">{count}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AgendaRow({ a, updateStatus }) {
  const services = React.useContext(ServicesContext);
  const s = services.find((x)=>x.id===a.serviceId);
  const isFinal = a.status === "entregue" || a.status === "cancelado";
  return (
    <div className="p-4 flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-4">
        <span className="font-display text-cyan-300 text-sm w-12">{a.time}</span>
        <div>
          <p className="text-sm text-slate-100">{a.clientName}</p>
          <p className="text-xs text-slate-500">{a.vehicle} · {s?.name}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <PaymentPill payment={a.payment} />
        {a.status === "cancelado" ? (
          <StatusPill status="cancelado" />
        ) : (
          <select value={a.status} onChange={(e)=>updateStatus(a.id, e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 px-2 py-1.5">
            {STATUS_FLOW.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
          </select>
        )}
        {!isFinal && (
          <button onClick={() => { if (confirm("Cancelar este agendamento?")) updateStatus(a.id, "cancelado"); }} className="text-xs text-rose-400 px-1">Cancelar</button>
        )}
      </div>
    </div>
  );
}

function AdminQueue({ queue, updateStatus }) {
  const services = React.useContext(ServicesContext);
  const advance = (a) => {
    const idx = statusIndex(a.status);
    if (idx < STATUS_FLOW.length - 1) updateStatus(a.id, STATUS_FLOW[idx+1].key);
  };
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl text-slate-50">Controle da fila</h1>
        <p className="text-sm text-slate-500">{queue.length} veículo(s) em atendimento agora</p>
      </div>
      <div className="space-y-3">
        {queue.length === 0 && <p className="text-sm text-slate-500">Nenhum veículo na fila.</p>}
        {queue.map((a, i) => {
          const s = services.find((x)=>x.id===a.serviceId);
          const idx = statusIndex(a.status);
          return (
            <div key={a.id} className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/10 text-cyan-300 flex items-center justify-center font-display text-sm">{i+1}</div>
                  <div>
                    <p className="text-sm font-medium text-slate-100">{a.clientName} — {a.vehicle}</p>
                    <p className="text-xs text-slate-500">{s?.name} · ~{s?.duration}min · tempo estimado de espera: {i*15}min</p>
                  </div>
                </div>
                <StatusPill status={a.status} />
              </div>
              <StatusStepper status={a.status} />
              <div className="flex gap-2 mt-4">
                <button onClick={() => advance(a)} disabled={idx>=STATUS_FLOW.length-1} className="flex-1 rounded-lg bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 text-xs font-medium py-2">
                  {idx===0?"Confirmar chegada":idx===1?"Colocar em espera":idx===2?"Iniciar lavagem":idx===3?"Iniciar finalização":idx===4?"Marcar como pronto":idx===5?"Entregar veículo":"Concluído"}
                </button>
                <select value={a.status} onChange={(e)=>updateStatus(a.id, e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 px-2">
                  {STATUS_FLOW.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminAtendimentos({ appointments, updateStatus, updatePayment, employees }) {
  const services = React.useContext(ServicesContext);
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [payModal, setPayModal] = useState(null);

  const filtered = appointments.filter((a) => {
    if (filter !== "todos" && a.status !== filter) return false;
    if (search && !(a.clientName.toLowerCase().includes(search.toLowerCase()) || a.vehicle.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  }).sort((a,b)=> (b.date+b.time).localeCompare(a.date+a.time));

  return (
    <div className="space-y-5">
      <div><h1 className="font-display text-xl text-slate-50">Atendimentos</h1><p className="text-sm text-slate-500">{appointments.length} registros no total</p></div>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar por cliente ou placa..." className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500" />
        </div>
        <select value={filter} onChange={(e)=>setFilter(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-300 px-3 py-2">
          <option value="todos">Todos os status</option>
          {STATUS_FLOW.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          <option value="cancelado">Cancelado</option>
        </select>
      </div>
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-850">
              <th className="p-3 font-medium">Cliente / Veículo</th>
              <th className="p-3 font-medium">Serviço</th>
              <th className="p-3 font-medium">Data</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Pagamento</th>
              <th className="p-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const s = services.find((x)=>x.id===a.serviceId);
              return (
                <tr key={a.id} className="border-b border-slate-850 last:border-0">
                  <td className="p-3"><p className="text-slate-100">{a.clientName}</p><p className="text-xs text-slate-500">{a.vehicle}</p></td>
                  <td className="p-3 text-slate-300">{s?.name}{a.tier ? ` (${a.tier})` : ""}</td>
                  <td className="p-3 text-slate-400 text-xs">{fmtDate(a.date)} {a.time}</td>
                  <td className="p-3"><StatusPill status={a.status} /></td>
                  <td className="p-3"><PaymentPill payment={a.payment} /></td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {a.payment?.status !== "pago" && a.status !== "cancelado" && <button onClick={() => setPayModal(a)} className="text-xs text-cyan-300 font-medium">Registrar pagamento</button>}
                      {a.status !== "entregue" && a.status !== "cancelado" && (
                        <button onClick={() => { if (confirm("Cancelar este agendamento?")) updateStatus(a.id, "cancelado"); }} className="text-xs text-rose-400">Cancelar</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {payModal && <PaymentModal appt={payModal} employees={employees} onClose={()=>setPayModal(null)} onSave={(p)=>{updatePayment(payModal.id,p);setPayModal(null);}} />}
    </div>
  );
}

function PaymentModal({ appt, employees, onClose, onSave }) {
  const [amount, setAmount] = useState(apptPrice(appt));
  const [method, setMethod] = useState("Pix");
  const [employeeId, setEmployeeId] = useState(employees[0]?.id);
  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5" onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-base text-slate-50">Registrar pagamento</p>
          <button onClick={onClose}><X size={16} className="text-slate-500"/></button>
        </div>
        <p className="text-xs text-slate-500 mb-4">{appt.clientName} · {appt.vehicle}</p>
        <label className="text-xs text-slate-400">Valor</label>
        <input type="number" value={amount} onChange={(e)=>setAmount(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mb-3 mt-1" />
        <label className="text-xs text-slate-400">Forma de pagamento</label>
        <select value={method} onChange={(e)=>setMethod(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mb-3 mt-1">
          {["Dinheiro","Pix","Cartão de Débito","Cartão de Crédito"].map((m)=><option key={m}>{m}</option>)}
        </select>
        <label className="text-xs text-slate-400">Funcionário responsável</label>
        <select value={employeeId} onChange={(e)=>setEmployeeId(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mb-4 mt-1">
          {employees.map((e)=><option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <button onClick={()=>{
          const emp = employees.find((e)=>e.id===employeeId);
          onSave({status:"pago", amount, method, employee: emp?.name, employeeId, datetime: todayISO()+" "+new Date().toTimeString().slice(0,5)});
        }} className="w-full rounded-xl bg-cyan-400 text-slate-950 font-medium py-2.5 text-sm">Confirmar pagamento</button>
      </div>
    </div>
  );
}

function AdminClientes({ clientsDb, appointments }) {
  const services = React.useContext(ServicesContext);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(null);
  const [realClients, setRealClients] = useState(null);
  const [realVehicles, setRealVehicles] = useState([]);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "" });

  const reload = () => {
    if (!supabaseEnabled) return;
    Promise.all([fetchClients(), fetchVehiclesAdmin()]).then(([cs, vs]) => { setRealClients(cs); setRealVehicles(vs); setLoading(false); });
  };
  useEffect(() => { reload(); }, []);

  const resetForm = () => { setForm({ name: "", phone: "", email: "" }); setFormError(""); setAdding(false); };

  const submitClient = async () => {
    if (!form.name.trim() || !form.phone.trim()) { setFormError("Preencha ao menos nome e telefone."); return; }
    setSaving(true);
    try {
      await createClientAdmin(form);
      reload();
      resetForm();
    } catch (err) {
      setFormError("Não foi possível salvar o cliente. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const list = supabaseEnabled && realClients ? realClients.map((c) => {
    const myVehicles = realVehicles.filter((v) => v.client_id === c.id).map((v) => `${v.brand} ${v.model} - ${v.plate}`);
    const myAppts = appointments.filter((a) => a.clientId === c.id);
    const spent = myAppts.filter((a) => a.payment?.status === "pago").reduce((s,a) => s + (a.payment.amount || 0), 0);
    const lastVisit = myAppts.reduce((max, a) => a.date > max ? a.date : max, "");
    return { id: c.id, name: c.name, phone: c.phone || "—", email: c.email || "—", vehicles: myVehicles, visits: myAppts.length, spent, lastVisit: lastVisit || c.created_at?.slice(0,10) };
  }) : clientsDb;

  const filtered = list.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone||"").includes(search) || c.vehicles.some(v=>v.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="font-display text-xl text-slate-50">Clientes</h1><p className="text-sm text-slate-500">{list.length} clientes cadastrados</p></div>
        {supabaseEnabled && <button onClick={()=>{resetForm(); setAdding(true);}} className="flex items-center gap-1.5 rounded-xl bg-cyan-400 text-slate-950 text-sm font-medium px-3.5 py-2"><Plus size={14}/> Novo cliente</button>}
      </div>
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar por nome, telefone ou placa..." className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500" />
      </div>
      {adding && (
        <div className="rounded-2xl bg-slate-900 border border-cyan-500/30 p-4 space-y-2.5 max-w-md">
          <p className="text-sm font-medium text-slate-100 mb-1">Novo cliente</p>
          <input placeholder="Nome completo" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
          <input placeholder="Telefone" value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
          <input placeholder="E-mail (opcional)" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
          {formError && <p className="text-xs text-rose-400">{formError}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={resetForm} className="flex-1 rounded-lg bg-slate-800 text-slate-200 py-2 text-sm font-medium">Cancelar</button>
            <button onClick={submitClient} disabled={saving} className="flex-1 rounded-lg bg-cyan-400 disabled:opacity-60 text-slate-950 py-2 text-sm font-medium">{saving ? "Salvando..." : "Salvar cliente"}</button>
          </div>
        </div>
      )}
      {loading ? (
        <p className="text-sm text-slate-500">Carregando clientes...</p>
      ) : (
      <div className="grid md:grid-cols-2 gap-3">
        {filtered.map((c) => (
          <button key={c.id} onClick={()=>setOpen(c)} className="text-left rounded-2xl bg-slate-900 border border-slate-800 p-4 hover:border-cyan-500/30 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-100">{c.name}</p>
              <span className="text-xs text-cyan-300 font-display">{money(c.spent)}</span>
            </div>
            <p className="text-xs text-slate-500">{c.phone} · {c.visits} visitas · última em {c.lastVisit ? fmtDate(c.lastVisit) : "—"}</p>
            <p className="text-xs text-slate-600 mt-1 truncate">{c.vehicles.join(", ") || "sem veículos"}</p>
          </button>
        ))}
        {filtered.length === 0 && <p className="text-sm text-slate-500">Nenhum cliente encontrado.</p>}
      </div>
      )}
      {open && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-40 p-4" onClick={()=>setOpen(null)}>
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-5 max-h-[80vh] overflow-y-auto" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-display text-base text-slate-50">{open.name}</p>
              <button onClick={()=>setOpen(null)}><X size={16} className="text-slate-500"/></button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mb-4">
              <p>Telefone: <span className="text-slate-200">{open.phone}</span></p>
              <p>E-mail: <span className="text-slate-200">{open.email}</span></p>
              <p>Visitas: <span className="text-slate-200">{open.visits}</span></p>
              <p>Total gasto: <span className="text-cyan-300">{money(open.spent)}</span></p>
            </div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Histórico de atendimentos</p>
            <div className="space-y-2">
              {appointments.filter(a=>a.clientId===open.id || a.clientName===open.name).map((a)=>(
                <div key={a.id} className="flex items-center justify-between text-sm rounded-lg bg-slate-850 border border-slate-800 p-2.5">
                  <span className="text-slate-300">{fmtDate(a.date)} · {services.find(s=>s.id===a.serviceId)?.name}</span>
                  <StatusPill status={a.status} />
                </div>
              ))}
              {appointments.filter(a=>a.clientId===open.id || a.clientName===open.name).length === 0 && <p className="text-xs text-slate-600">Nenhum atendimento ainda.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminVeiculos({ appointments }) {
  const [realVehicles, setRealVehicles] = useState(null);
  const [realClients, setRealClients] = useState([]);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ clientId: "", brand: "", model: "", year: "", color: "", plate: "", type: "Sedã", size: "Médio" });

  const reload = () => {
    if (!supabaseEnabled) return;
    Promise.all([fetchVehiclesAdmin(), fetchClients()]).then(([vs, cs]) => { setRealVehicles(vs); setRealClients(cs); setLoading(false); });
  };
  useEffect(() => { reload(); }, []);

  const resetForm = () => { setForm({ clientId: realClients[0]?.id || "", brand: "", model: "", year: "", color: "", plate: "", type: "Sedã", size: "Médio" }); setFormError(""); setAdding(false); };
  const openAdd = () => { setForm({ clientId: realClients[0]?.id || "", brand: "", model: "", year: "", color: "", plate: "", type: "Sedã", size: "Médio" }); setAdding(true); };

  const submitVehicle = async () => {
    if (!form.clientId) { setFormError("Selecione o cliente."); return; }
    if (!form.brand.trim() || !form.model.trim() || !form.plate.trim()) { setFormError("Preencha ao menos marca, modelo e placa."); return; }
    setSaving(true);
    try {
      await addVehicleAdmin(form.clientId, form);
      reload();
      resetForm();
    } catch (err) {
      setFormError("Não foi possível salvar o veículo. Verifique os dados e tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  let list;
  if (supabaseEnabled && realVehicles) {
    list = realVehicles.map((v) => {
      const owner = realClients.find((c) => c.id === v.client_id);
      const myAppts = appointments.filter((a) => a.vehicle === `${v.brand} ${v.model} - ${v.plate}`);
      const last = myAppts.reduce((max, a) => a.date > max ? a.date : max, "");
      return { plate: `${v.brand} ${v.model} - ${v.plate}`, owner: owner?.name || "—", count: myAppts.length, last };
    });
  } else {
    const vehicleMap = {};
    appointments.forEach((a) => {
      if (!vehicleMap[a.vehicle]) vehicleMap[a.vehicle] = { plate: a.vehicle, owner: a.clientName, count: 0, last: a.date };
      vehicleMap[a.vehicle].count++;
      if (a.date > vehicleMap[a.vehicle].last) vehicleMap[a.vehicle].last = a.date;
    });
    list = Object.values(vehicleMap);
  }

  const filtered = list.filter((v) => v.plate.toLowerCase().includes(search.toLowerCase()) || v.owner.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="font-display text-xl text-slate-50">Veículos</h1><p className="text-sm text-slate-500">{list.length} veículos cadastrados</p></div>
        {supabaseEnabled && <button onClick={openAdd} className="flex items-center gap-1.5 rounded-xl bg-cyan-400 text-slate-950 text-sm font-medium px-3.5 py-2"><Plus size={14}/> Novo veículo</button>}
      </div>
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar por placa ou proprietário..." className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500" />
      </div>
      {adding && (
        <div className="rounded-2xl bg-slate-900 border border-cyan-500/30 p-4 space-y-2.5 max-w-lg">
          <p className="text-sm font-medium text-slate-100 mb-1">Cadastrar veículo</p>
          <div>
            <label className="text-xs text-slate-400">Cliente</label>
            <select value={form.clientId} onChange={(e)=>setForm({...form,clientId:e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1">
              <option value="">Selecione...</option>
              {realClients.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <input placeholder="Marca" value={form.brand} onChange={(e)=>setForm({...form,brand:e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
            <input placeholder="Modelo" value={form.model} onChange={(e)=>setForm({...form,model:e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
            <input placeholder="Ano" value={form.year} onChange={(e)=>setForm({...form,year:e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
            <input placeholder="Cor" value={form.color} onChange={(e)=>setForm({...form,color:e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
            <input placeholder="Placa" value={form.plate} onChange={(e)=>setForm({...form,plate:e.target.value.toUpperCase()})} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
            <select value={form.type} onChange={(e)=>setForm({...form,type:e.target.value})} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100">
              {["Sedã","Hatch","SUV","Caminhonete","Moto"].map((t)=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Porte (usado no preço do polimento)</label>
            <select value={form.size} onChange={(e)=>setForm({...form,size:e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1">
              {["Pequeno","Médio","Grande","Caminhonete"].map((s)=><option key={s}>{s}</option>)}
            </select>
          </div>
          {formError && <p className="text-xs text-rose-400">{formError}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={resetForm} className="flex-1 rounded-lg bg-slate-800 text-slate-200 py-2 text-sm font-medium">Cancelar</button>
            <button onClick={submitVehicle} disabled={saving} className="flex-1 rounded-lg bg-cyan-400 disabled:opacity-60 text-slate-950 py-2 text-sm font-medium">{saving ? "Salvando..." : "Salvar veículo"}</button>
          </div>
        </div>
      )}
      {loading ? <p className="text-sm text-slate-500">Carregando veículos...</p> : (
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-850"><th className="p-3">Veículo / Placa</th><th className="p-3">Proprietário</th><th className="p-3">Lavagens</th><th className="p-3">Última visita</th></tr></thead>
          <tbody>
            {filtered.map((v,i)=>(
              <tr key={i} className="border-b border-slate-850 last:border-0">
                <td className="p-3 text-slate-100">{v.plate}</td>
                <td className="p-3 text-slate-400">{v.owner}</td>
                <td className="p-3 text-cyan-300">{v.count}</td>
                <td className="p-3 text-slate-400 text-xs">{v.last ? fmtDate(v.last) : "nunca"}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-500">Nenhum veículo encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

function AdminServicos({ servicesState, setServicesState }) {
  const [editing, setEditing] = useState(null);
  const toggle = (id) => {
    setServicesState((prev) => {
      const next = prev.map((s) => s.id === id ? { ...s, active: !s.active } : s);
      if (supabaseEnabled) { const s = next.find((x) => x.id === id); updateService(s).catch(() => {}); }
      return next;
    });
  };
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="font-display text-xl text-slate-50">Catálogo de serviços</h1><p className="text-sm text-slate-500">{servicesState.filter(s=>s.active).length} ativos de {servicesState.length}</p></div>
        <button onClick={()=>setEditing({ id: null, name:"", desc:"", price:0, duration:30, active:true, category:"Extras", img:"✨" })} className="flex items-center gap-1.5 rounded-xl bg-cyan-400 text-slate-950 text-sm font-medium px-3.5 py-2"><Plus size={14}/> Novo serviço</button>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {servicesState.map((s) => (
          <div key={s.id} className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center text-xl shrink-0">{s.img}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-100">{s.name}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.active?"bg-emerald-500/15 text-emerald-300":"bg-slate-700/40 text-slate-400"}`}>{s.active?"Ativo":"Inativo"}</span>
              </div>
              <p className="text-xs text-slate-500 truncate">{s.desc}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                <span className="text-cyan-300 font-display">{s.tiered ? `a partir de ${money(Math.min(...Object.values(s.tiers)))}` : money(s.price)}</span>
                <span className="flex items-center gap-1"><Timer size={11}/>{s.duration}min</span>
                <span className="text-slate-600">{s.category}</span>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={()=>setEditing(s)} className="text-xs text-cyan-300 flex items-center gap-1"><Edit3 size={12}/> Editar</button>
                <button onClick={()=>toggle(s.id)} className="text-xs text-slate-400">{s.active?"Desativar":"Ativar"}</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {editing && !editing.tiered && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-40 p-4" onClick={()=>setEditing(null)}>
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><p className="font-display text-base text-slate-50">{editing.id?"Editar serviço":"Novo serviço"}</p><button onClick={()=>setEditing(null)}><X size={16} className="text-slate-500"/></button></div>
            {[["Nome","name","text"],["Descrição","desc","text"],["Preço (R$)","price","number"],["Tempo estimado (min)","duration","number"]].map(([label,key,type])=>(
              <div key={key} className="mb-3">
                <label className="text-xs text-slate-400">{label}</label>
                <input type={type} value={editing[key]} onChange={(e)=>setEditing({...editing,[key]:type==="number"?Number(e.target.value):e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1" />
              </div>
            ))}
            <button onClick={()=>{
              setServicesState((prev)=> editing.id ? prev.map(s=>s.id===editing.id?editing:s) : [...prev, {...editing, id:"s"+Math.random().toString(36).slice(2,7)}]);
              if (supabaseEnabled && editing.id) updateService(editing).catch(() => {});
              setEditing(null);
            }} className="w-full rounded-xl bg-cyan-400 text-slate-950 font-medium py-2.5 text-sm mt-2">Salvar serviço</button>
          </div>
        </div>
      )}
      {editing && editing.tiered && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-40 p-4" onClick={()=>setEditing(null)}>
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><p className="font-display text-base text-slate-50">Editar {editing.name}</p><button onClick={()=>setEditing(null)}><X size={16} className="text-slate-500"/></button></div>
            <div className="mb-3">
              <label className="text-xs text-slate-400">Descrição</label>
              <input value={editing.desc} onChange={(e)=>setEditing({...editing,desc:e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1" />
            </div>
            <p className="text-xs text-slate-400 mb-2">Preço por porte do veículo (R$)</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              {Object.entries(editing.tiers).map(([size, val]) => (
                <div key={size}>
                  <label className="text-xs text-slate-500">{size}</label>
                  <input type="number" value={val} onChange={(e)=>setEditing({...editing, tiers: {...editing.tiers, [size]: Number(e.target.value)}})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1" />
                </div>
              ))}
            </div>
            <div className="mb-4">
              <label className="text-xs text-slate-400">Tempo estimado (min)</label>
              <input type="number" value={editing.duration} onChange={(e)=>setEditing({...editing,duration:Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1" />
            </div>
            <button onClick={()=>{ setServicesState((prev)=>prev.map(s=>s.id===editing.id?editing:s)); if (supabaseEnabled) updateService(editing).catch(() => {}); setEditing(null); }} className="w-full rounded-xl bg-cyan-400 text-slate-950 font-medium py-2.5 text-sm">Salvar serviço</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminEstoque({ products, setProducts, stockLog, addStockLog }) {
  const [editing, setEditing] = useState(null);
  const [entryModal, setEntryModal] = useState(null);
  const [entryQty, setEntryQty] = useState(0);
  const [entryReason, setEntryReason] = useState("Reposição de fornecedor");

  const esgotados = products.filter((p) => p.quantity <= 0).length;
  const baixos = products.filter((p) => p.quantity > 0 && p.quantity <= p.minStock).length;

  const saveEntry = () => {
    setProducts((prev) => prev.map((p) => p.id === entryModal.id ? { ...p, quantity: p.quantity + Number(entryQty) } : p));
    addStockLog({ productId: entryModal.id, type: "entrada", qty: Number(entryQty), reason: entryReason });
    if (supabaseEnabled) addStockEntry(entryModal.id, Number(entryQty), entryReason).catch(() => {});
    setEntryModal(null); setEntryQty(0); setEntryReason("Reposição de fornecedor");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="font-display text-xl text-slate-50">Estoque de produtos</h1><p className="text-sm text-slate-500">Baixa automática a cada serviço iniciado</p></div>
        <button onClick={()=>setEditing({ id:null, name:"", unit:"un", quantity:0, minStock:10, cost:0 })} className="flex items-center gap-1.5 rounded-xl bg-cyan-400 text-slate-950 text-sm font-medium px-3.5 py-2"><Plus size={14}/> Novo produto</button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <KpiCard icon={Package} label="Produtos cadastrados" value={products.length} accent="cyan" />
        <KpiCard icon={AlertCircle} label="Estoque baixo" value={baixos} accent="amber" />
        <KpiCard icon={PackageMinus} label="Esgotados" value={esgotados} accent="rose" />
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-850"><th className="p-3">Produto</th><th className="p-3">Estoque atual</th><th className="p-3">Mínimo</th><th className="p-3">Status</th><th className="p-3">Custo/un.</th><th className="p-3"></th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-slate-850 last:border-0">
                <td className="p-3 text-slate-100">{p.name}</td>
                <td className="p-3 text-slate-300">{p.quantity}{p.unit}</td>
                <td className="p-3 text-slate-500">{p.minStock}{p.unit}</td>
                <td className="p-3"><StockPill product={p} /></td>
                <td className="p-3 text-slate-400">{money(p.cost)}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button onClick={()=>setEntryModal(p)} className="text-xs text-cyan-300 flex items-center gap-1"><PackagePlus size={12}/> Entrada</button>
                    <button onClick={()=>setEditing(p)} className="text-xs text-slate-400 flex items-center gap-1"><Edit3 size={12}/> Editar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
        <SectionTitle icon={ClipboardList} title="Movimentações recentes" />
        <div className="space-y-2 max-h-56 overflow-y-auto">
          {stockLog.length === 0 && <p className="text-sm text-slate-500">Nenhuma movimentação registrada ainda.</p>}
          {stockLog.slice(0,15).map((m) => {
            const p = products.find((x) => x.id === m.productId);
            return (
              <div key={m.id} className="flex items-center justify-between text-sm border-b border-slate-850 pb-2 last:border-0">
                <div className="flex items-center gap-2">
                  {m.type === "saida" ? <PackageMinus size={13} className="text-rose-400"/> : <PackagePlus size={13} className="text-emerald-400"/>}
                  <span className="text-slate-300">{p?.name}</span>
                  <span className="text-slate-600 text-xs">· {m.reason}</span>
                </div>
                <span className={m.type === "saida" ? "text-rose-300" : "text-emerald-300"}>{m.type === "saida" ? "-" : "+"}{m.qty}{p?.unit}</span>
              </div>
            );
          })}
        </div>
      </div>

      {entryModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-40 p-4" onClick={()=>setEntryModal(null)}>
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><p className="font-display text-base text-slate-50">Entrada de estoque</p><button onClick={()=>setEntryModal(null)}><X size={16} className="text-slate-500"/></button></div>
            <p className="text-xs text-slate-500 mb-3">{entryModal.name} · estoque atual: {entryModal.quantity}{entryModal.unit}</p>
            <label className="text-xs text-slate-400">Quantidade a adicionar ({entryModal.unit})</label>
            <input type="number" value={entryQty} onChange={(e)=>setEntryQty(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mb-3 mt-1" />
            <label className="text-xs text-slate-400">Motivo</label>
            <input value={entryReason} onChange={(e)=>setEntryReason(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mb-4 mt-1" />
            <button onClick={saveEntry} className="w-full rounded-xl bg-cyan-400 text-slate-950 font-medium py-2.5 text-sm">Registrar entrada</button>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-40 p-4" onClick={()=>setEditing(null)}>
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><p className="font-display text-base text-slate-50">{editing.id?"Editar produto":"Novo produto"}</p><button onClick={()=>setEditing(null)}><X size={16} className="text-slate-500"/></button></div>
            <label className="text-xs text-slate-400">Nome</label>
            <input value={editing.name} onChange={(e)=>setEditing({...editing,name:e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mb-3 mt-1" />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="text-xs text-slate-400">Unidade</label>
                <select value={editing.unit} onChange={(e)=>setEditing({...editing,unit:e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1">
                  <option value="un">unidade (un)</option><option value="ml">mililitro (ml)</option><option value="l">litro (l)</option><option value="g">grama (g)</option>
                </select>
              </div>
              <div><label className="text-xs text-slate-400">Estoque atual</label><input type="number" value={editing.quantity} onChange={(e)=>setEditing({...editing,quantity:Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div><label className="text-xs text-slate-400">Estoque mínimo</label><input type="number" value={editing.minStock} onChange={(e)=>setEditing({...editing,minStock:Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1" /></div>
              <div><label className="text-xs text-slate-400">Custo por unidade</label><input type="number" step="0.01" value={editing.cost} onChange={(e)=>setEditing({...editing,cost:Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1" /></div>
            </div>
            <button onClick={()=>{
              setProducts((prev)=> editing.id ? prev.map(p=>p.id===editing.id?editing:p) : [...prev, {...editing, id:"p"+Math.random().toString(36).slice(2,7)}]);
              setEditing(null);
            }} className="w-full rounded-xl bg-cyan-400 text-slate-950 font-medium py-2.5 text-sm">Salvar produto</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminFuncionarios({ employees, setEmployeesState }) {
  const roleColor = { "Administrador":"bg-rose-500/15 text-rose-300","Gerente":"bg-amber-500/15 text-amber-300","Funcionário":"bg-cyan-500/15 text-cyan-300" };
  const roleDb = { "Administrador":"administrador","Gerente":"gerente","Funcionário":"funcionario" };
  const statusDb = { "Ativo":"ativo","Folga":"folga","Inativo":"inativo" };
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!editing.name.trim()) return;
    setSaving(true);
    try {
      if (supabaseEnabled) {
        if (editing.id) {
          await updateEmployee(editing.id, { name: editing.name, phone: editing.phone, role: roleDb[editing.role], status: statusDb[editing.status] });
          setEmployeesState((prev) => prev.map((e) => e.id === editing.id ? editing : e));
        } else {
          await createEmployee({ name: editing.name, phone: editing.phone, role: roleDb[editing.role], status: statusDb[editing.status] });
          const fresh = await fetchEmployees();
          setEmployeesState(fresh);
        }
      } else {
        setEmployeesState((prev) => editing.id ? prev.map((e) => e.id === editing.id ? editing : e) : [...prev, { ...editing, id: "e" + Math.random().toString(36).slice(2,7), since: todayISO() }]);
      }
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="font-display text-xl text-slate-50">Funcionários</h1><p className="text-sm text-slate-500">{employees.length} colaboradores</p></div>
        <button onClick={() => setEditing({ id: null, name: "", phone: "", role: "Funcionário", status: "Ativo" })} className="flex items-center gap-1.5 rounded-xl bg-cyan-400 text-slate-950 text-sm font-medium px-3.5 py-2"><Plus size={14}/> Novo funcionário</button>
      </div>
      <div className="rounded-2xl bg-slate-900 border border-slate-800 divide-y divide-slate-850">
        {employees.length === 0 && <p className="text-sm text-slate-500 p-5">Nenhum funcionário cadastrado ainda. O primeiro é criado automaticamente ao fazer login pela primeira vez.</p>}
        {employees.map((e) => (
          <button key={e.id} onClick={() => setEditing(e)} className="w-full p-4 flex items-center justify-between flex-wrap gap-2 text-left hover:bg-slate-850/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center"><UserCircle2 size={17} className="text-slate-400"/></div>
              <div>
                <p className="text-sm text-slate-100">{e.name}</p>
                <p className="text-xs text-slate-500">{e.phone || "sem telefone"} · desde {e.since ? fmtDate(e.since) : "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleColor[e.role]}`}>{e.role}</span>
              <span className={`text-xs px-2.5 py-1 rounded-full ${e.status==="Ativo"?"bg-emerald-500/15 text-emerald-300":"bg-slate-700/40 text-slate-400"}`}>{e.status}</span>
              <Edit3 size={13} className="text-slate-600" />
            </div>
          </button>
        ))}
      </div>
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
        <SectionTitle icon={ShieldCheck} title="Níveis de acesso" />
        <div className="grid md:grid-cols-3 gap-3">
          {[
            ["Administrador","Acesso completo a todas as áreas do sistema."],
            ["Gerente","Agenda, clientes, serviços, funcionários, financeiro e relatórios."],
            ["Funcionário","Fila, status dos veículos, serviços, pagamentos e fotos."],
          ].map(([r,d]) => (
            <div key={r} className="rounded-xl bg-slate-850 border border-slate-800 p-3.5">
              <p className={`text-xs font-semibold mb-1 ${r==="Administrador"?"text-rose-300":r==="Gerente"?"text-amber-300":"text-cyan-300"}`}>{r}</p>
              <p className="text-xs text-slate-400">{d}</p>
            </div>
          ))}
        </div>
      </div>
      {editing && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-40 p-4" onClick={()=>setEditing(null)}>
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><p className="font-display text-base text-slate-50">{editing.id ? "Editar funcionário" : "Novo funcionário"}</p><button onClick={()=>setEditing(null)}><X size={16} className="text-slate-500"/></button></div>
            <label className="text-xs text-slate-400">Nome</label>
            <input value={editing.name} onChange={(e)=>setEditing({...editing,name:e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mb-3 mt-1" />
            <label className="text-xs text-slate-400">Telefone</label>
            <input value={editing.phone} onChange={(e)=>setEditing({...editing,phone:e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mb-3 mt-1" />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div><label className="text-xs text-slate-400">Cargo</label>
                <select value={editing.role} onChange={(e)=>setEditing({...editing,role:e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1">
                  {["Administrador","Gerente","Funcionário"].map((r)=><option key={r}>{r}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-slate-400">Status</label>
                <select value={editing.status} onChange={(e)=>setEditing({...editing,status:e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1">
                  {["Ativo","Folga","Inativo"].map((s)=><option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <button onClick={save} disabled={saving} className="w-full rounded-xl bg-cyan-400 disabled:opacity-60 text-slate-950 font-medium py-2.5 text-sm">{saving ? "Salvando..." : "Salvar funcionário"}</button>
            {editing.id && <p className="text-[10px] text-slate-600 text-center mt-3">Este funcionário só terá acesso ao painel se também tiver uma conta de login criada na tela inicial.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminFinanceiro({ appointments }) {
  const services = React.useContext(ServicesContext);
  const paid = appointments.filter((a) => a.payment?.status === "pago");
  const pending = appointments.filter((a) => a.payment?.status !== "pago");
  const byMethod = {};
  paid.forEach((a) => { byMethod[a.payment.method] = (byMethod[a.payment.method]||0) + a.payment.amount; });
  const totalMonth = paid.reduce((s,a)=>s+a.payment.amount,0);
  const totalToday = paid.filter(a=>a.payment.datetime?.startsWith(todayISO())).reduce((s,a)=>s+a.payment.amount,0);
  const totalPending = pending.reduce((s,a)=>s + apptPrice(a),0);

  return (
    <div className="space-y-6">
      <div><h1 className="font-display text-xl text-slate-50">Financeiro</h1><p className="text-sm text-slate-500">Controle de pagamentos presenciais</p></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={DollarSign} label="Recebido hoje" value={money(totalToday)} accent="emerald" />
        <KpiCard icon={Wallet} label="Recebido no mês" value={money(totalMonth)} accent="emerald" />
        <KpiCard icon={AlertCircle} label="Pendente" value={money(totalPending)} accent="rose" />
        <KpiCard icon={ClipboardList} label="Transações pagas" value={paid.length} accent="cyan" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
          <SectionTitle icon={Wallet} title="Por forma de pagamento" />
          <div className="space-y-3">
            {["Dinheiro","Pix","Cartão de Débito","Cartão de Crédito"].map((m) => {
              const val = byMethod[m] || 0;
              const pct = totalMonth ? (val/totalMonth)*100 : 0;
              return (
                <div key={m}>
                  <div className="flex justify-between text-xs text-slate-400 mb-1"><span>{m}</span><span className="text-slate-200">{money(val)}</span></div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-cyan-400" style={{width:`${pct}%`}}/></div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
          <SectionTitle icon={AlertCircle} title="Pagamentos pendentes" subtitle={`${pending.length} registro(s)`} />
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {pending.map((a) => (
              <div key={a.id} className="flex justify-between text-sm">
                <span className="text-slate-300">{a.clientName.split(" ")[0]} · {services.find(s=>s.id===a.serviceId)?.name}</span>
                <span className="text-rose-300">{money(apptPrice(a))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-850"><th className="p-3">Cliente</th><th className="p-3">Serviço</th><th className="p-3">Valor</th><th className="p-3">Forma</th><th className="p-3">Funcionário</th><th className="p-3">Data</th></tr></thead>
          <tbody>
            {paid.map((a) => (
              <tr key={a.id} className="border-b border-slate-850 last:border-0">
                <td className="p-3 text-slate-100">{a.clientName}</td>
                <td className="p-3 text-slate-400">{services.find(s=>s.id===a.serviceId)?.name}</td>
                <td className="p-3 text-cyan-300">{money(a.payment.amount)}</td>
                <td className="p-3 text-slate-400">{a.payment.method}</td>
                <td className="p-3 text-slate-400">{a.payment.employee}</td>
                <td className="p-3 text-slate-500 text-xs">{a.payment.datetime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminRelatorios({ appointments }) {
  const services = React.useContext(ServicesContext);
  const [newClientsCount, setNewClientsCount] = useState(null);
  useEffect(() => {
    if (!supabaseEnabled) return;
    fetchClients().then((cs) => {
      const thisMonth = todayISO().slice(0,7);
      setNewClientsCount(cs.filter((c) => c.created_at?.slice(0,7) === thisMonth).length);
    });
  }, []);
  const serviceCounts = {};
  appointments.forEach((a) => { serviceCounts[a.serviceId] = (serviceCounts[a.serviceId]||0)+1; });
  const topServices = Object.entries(serviceCounts).sort((a,b)=>b[1]-a[1]).map(([id,count])=>({ s: services.find(x=>x.id===id), count }));
  const maxCount = Math.max(...topServices.map(t=>t.count), 1);

  const clientCounts = {};
  appointments.forEach((a) => { clientCounts[a.clientName] = (clientCounts[a.clientName]||0)+1; });
  const topClients = Object.entries(clientCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);

  const hourCounts = {};
  appointments.forEach((a) => { if (a.time !== "agora") hourCounts[a.time.slice(0,2)+":00"] = (hourCounts[a.time.slice(0,2)+":00"]||0)+1; });
  const busiestHours = Object.entries(hourCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const cancelados = appointments.filter((a) => a.status === "cancelado").length;

  return (
    <div className="space-y-6">
      <div><h1 className="font-display text-xl text-slate-50">Relatórios</h1><p className="text-sm text-slate-500">Análise de desempenho do lava-rápido</p></div>
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
        <SectionTitle icon={Wrench} title="Serviços mais vendidos" />
        <div className="space-y-2.5">
          {topServices.map(({s,count}) => (
            <div key={s.id}>
              <div className="flex justify-between text-xs text-slate-400 mb-1"><span>{s.name}</span><span className="text-slate-200">{count}</span></div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-gradient-to-r from-cyan-500 to-amber-400" style={{width:`${(count/maxCount)*100}%`}}/></div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
          <SectionTitle icon={Users} title="Clientes mais frequentes" />
          <div className="space-y-2">
            {topClients.map(([name,count]) => <div key={name} className="flex justify-between text-sm"><span className="text-slate-300">{name}</span><span className="text-cyan-300 font-medium">{count} visitas</span></div>)}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
          <SectionTitle icon={Clock} title="Horários de maior movimento" />
          <div className="space-y-2">
            {busiestHours.map(([hour,count]) => <div key={hour} className="flex justify-between text-sm"><span className="text-slate-300">{hour}</span><span className="text-amber-300 font-medium">{count} agendamentos</span></div>)}
          </div>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <KpiCard icon={Droplets} label="Total de lavagens" value={appointments.length} accent="cyan" />
        <KpiCard icon={AlertCircle} label="Cancelamentos" value={cancelados} accent="rose" />
        <KpiCard icon={Users} label="Clientes novos (mês)" value={newClientsCount ?? "—"} accent="emerald" />
      </div>
    </div>
  );
}

function AdminConfiguracoes({ security, setSecurity }) {
  const [maxCap, setMaxCap] = useState(MAX_CAPACITY);
  const [saved, setSaved] = useState(false);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const strength = passwordStrength(newPw);

  const [pwLoading, setPwLoading] = useState(false);
  const changePassword = async () => {
    setPwError(""); setPwSuccess(false);
    if (newPw.length < 8) { setPwError("A nova senha precisa ter pelo menos 8 caracteres."); return; }
    if (newPw !== confirmPw) { setPwError("As senhas não coincidem."); return; }
    if (supabaseEnabled) {
      setPwLoading(true);
      const { error } = await supabase.auth.updateUser({ password: newPw });
      setPwLoading(false);
      if (error) { setPwError(error.message); return; }
    } else {
      if (curPw !== security.password) { setPwError("Senha atual incorreta."); return; }
      setSecurity((s) => ({ ...s, password: newPw }));
    }
    setCurPw(""); setNewPw(""); setConfirmPw(""); setPwSuccess(true);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div><h1 className="font-display text-xl text-slate-50">Configurações</h1><p className="text-sm text-slate-500">Dados, regras e segurança do lava-rápido</p></div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
        <SectionTitle icon={Droplets} title="Dados do estabelecimento" />
        {[["Nome do estabelecimento","SM Lavacar"],["Endereço","Rua Frei Mont Alverne, 64 — Jardim Pitangueiras 2"],["Telefone","(11) 99771-0479"]].map(([l,v])=>(
          <div key={l}><label className="text-xs text-slate-400">{l}</label><input defaultValue={v} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1" /></div>
        ))}
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
        <SectionTitle icon={Clock} title="Funcionamento" />
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-slate-400">Abertura</label><input defaultValue="08:00" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1" /></div>
          <div><label className="text-xs text-slate-400">Fechamento</label><input defaultValue="18:00" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1" /></div>
        </div>
        <div><label className="text-xs text-slate-400">Dias de funcionamento</label>
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map((d,i) => <button key={d} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${i<6?"bg-cyan-400 text-slate-950":"bg-slate-800 text-slate-500"}`}>{d}</button>)}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
        <SectionTitle icon={Gauge} title="Capacidade e regras" />
        <div>
          <label className="text-xs text-slate-400">Capacidade máxima de veículos simultâneos</label>
          <input type="number" value={maxCap} onChange={(e)=>setMaxCap(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1" />
        </div>
        <div><label className="text-xs text-slate-400">Regra de cancelamento</label>
          <textarea defaultValue="Cancelamentos devem ser feitos com no mínimo 1 hora de antecedência." className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1 resize-none" rows={2} />
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
        <SectionTitle icon={ShieldCheck} title="Segurança do painel administrativo" />

        <div className="flex items-center justify-between rounded-xl bg-slate-850 border border-slate-800 p-3.5">
          <div className="flex items-center gap-2.5">
            <Smartphone size={16} className="text-cyan-400" />
            <div>
              <p className="text-sm text-slate-200">Verificação em duas etapas (2FA)</p>
              <p className="text-[11px] text-slate-500">Solicita um código extra a cada login</p>
            </div>
          </div>
          <button onClick={()=>setSecurity((s)=>({...s, twoFAEnabled: !s.twoFAEnabled}))} className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${security.twoFAEnabled?"bg-cyan-400 justify-end":"bg-slate-700 justify-start"}`}>
            <div className="w-5 h-5 rounded-full bg-slate-950" />
          </button>
        </div>

        <div>
          <label className="text-xs text-slate-400">E-mail de recuperação de senha</label>
          <input value={security.recoveryEmail} onChange={(e)=>setSecurity((s)=>({...s, recoveryEmail: e.target.value}))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1" />
        </div>

        <div className="border-t border-slate-850 pt-4">
          <p className="text-xs font-semibold text-slate-400 mb-3">Alterar senha</p>
          <div className="space-y-2.5">
            {!supabaseEnabled && <input type="password" placeholder="Senha atual" value={curPw} onChange={(e)=>setCurPw(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />}
            <input type="password" placeholder="Nova senha" value={newPw} onChange={(e)=>setNewPw(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
            {newPw && (
              <div>
                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className={`h-full ${strength.color}`} style={{ width: `${strength.pct}%` }} /></div>
                <p className="text-[10px] text-slate-500 mt-0.5">Força da senha: {strength.label}</p>
              </div>
            )}
            <input type="password" placeholder="Confirmar nova senha" value={confirmPw} onChange={(e)=>setConfirmPw(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
            {pwError && <p className="text-xs text-rose-400">{pwError}</p>}
            {pwSuccess && <p className="text-xs text-emerald-400">Senha alterada com sucesso.</p>}
            <button onClick={changePassword} disabled={pwLoading} className="rounded-xl bg-cyan-400 disabled:opacity-60 text-slate-950 font-medium px-4 py-2 text-sm">{pwLoading ? "Salvando..." : "Atualizar senha"}</button>
          </div>
        </div>

        <div className="border-t border-slate-850 pt-4">
          <p className="text-xs font-semibold text-slate-400 mb-2">Últimos acessos</p>
          <div className="space-y-1.5">
            {security.loginLog.length === 0 && <p className="text-xs text-slate-600">Nenhum acesso registrado ainda nesta sessão.</p>}
            {security.loginLog.map((l) => (
              <div key={l.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{l.date}</span>
                <span className={l.ok ? "text-emerald-400" : "text-rose-400"}>{l.ok ? "Sucesso" : "Falhou"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button onClick={()=>{setSaved(true);setTimeout(()=>setSaved(false),2000);}} className="rounded-xl bg-cyan-400 text-slate-950 font-medium px-5 py-2.5 text-sm">
        {saved ? "Configurações salvas ✓" : "Salvar configurações"}
      </button>
    </div>
  );
}

/* ============================== ROOT APP ============================== */

export default function LavaRapidoSystem() {
  const [dbLoading, setDbLoading] = useState(true);
  const [appMode, setAppMode] = useState("client");
  const [adminAuthed, setAdminAuthed] = useState(false);

  const [appointments, setAppointments] = useState(seedAppointments);
  const [servicesState, setServicesState] = useState(SERVICES);
  const [products, setProducts] = useState(seedProducts);
  const [stockLog, setStockLog] = useState([]);
  const [security, setSecurity] = useState(DEFAULT_SECURITY);
  const [notifications, setNotifications] = useState([{ id: 1, text: "Bem-vindo ao SM Lavacar!" }]);

  const [myClientId, setMyClientId] = useState("you");
  const [vehicleIdByPlate, setVehicleIdByPlate] = useState({});
  const [myVehicles, setMyVehicles] = useState(MY_VEHICLES);
  const [employeesState, setEmployeesState] = useState([]);

  const loadedRef = useRef(false);

  useEffect(() => {
    if (!supabaseEnabled) return;
    supabase.auth.getSession().then(({ data }) => { if (data.session) setAdminAuthed(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAdminAuthed(Boolean(session));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Bootstrap: assim que o Supabase estiver configurado, troca os dados de
  // demonstração pelos dados reais do banco (cliente, veículos, agendamentos,
  // estoque, funcionários) e mantém tudo sincronizado ao vivo.
  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;
    let pollTimer = null;

    const loadAppointments = async (clientId) => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        const appts = await fetchAppointments();
        if (!cancelled) setAppointments(appts);
      } else {
        const appts = await fetchPublicData(clientId);
        if (!cancelled) setAppointments(appts);
      }
    };

    (async () => {
      const ctx = await ensureClientAndVehicles(MY_VEHICLES);
      if (cancelled) return;
      if (ctx) {
        setMyClientId(ctx.clientId);
        setVehicleIdByPlate(ctx.vehicleIdByPlate);
        fetchMyVehiclesFull(ctx.clientId).then((vs) => { if (!cancelled && vs.length) setMyVehicles(vs); });
      }

      const [prods, log, emps, svcs] = await Promise.all([fetchProducts(), fetchStockLog(), fetchEmployees(), fetchServices()]);
      if (svcs && svcs.length) setServicesState(svcs);
      if (cancelled) return;
      if (prods.length) setProducts(prods);
      setStockLog(log);
      setEmployeesState(emps);
      await loadAppointments(ctx?.clientId);

      // Enquanto não há sessão de equipe autenticada, o Realtime não
      // entrega eventos (protegido por RLS) — então atualiza por polling.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        pollTimer = setInterval(() => loadAppointments(ctx?.clientId), 12000);
      }
    })();

    const channel = supabase.channel("sm-lavacar-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => { fetchAppointments().then((a) => !cancelled && a.length >= 0 && setAppointments(a)); })
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => { fetchProducts().then((p) => !cancelled && p.length && setProducts(p)); })
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_movements" }, () => { fetchStockLog().then((l) => !cancelled && setStockLog(l)); })
      .subscribe();

    return () => { cancelled = true; if (pollTimer) clearInterval(pollTimer); supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.appointments) setAppointments(data.appointments);
        if (data.products) setProducts(data.products);
        if (data.stockLog) setStockLog(data.stockLog);
        if (data.security) setSecurity({ ...DEFAULT_SECURITY, ...data.security, loginLog: data.security.loginLog || [] });
      }
    } catch (err) {
      // primeira vez usando o app — sem dados salvos ainda, segue com os padrões
    } finally {
      loadedRef.current = true;
      setDbLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabaseEnabled || !loadedRef.current) return;
    if (adminAuthed) {
      fetchAppointments().then(setAppointments);
      fetchEmployees().then(setEmployeesState);
    } else {
      fetchPublicData(myClientId).then(setAppointments);
    }
  }, [adminAuthed]);

  useEffect(() => {
    if (!loadedRef.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ appointments, products, stockLog, security }));
      } catch (err) {
        // armazenamento indisponível (ex: modo privado) — segue sem persistir
      }
    }, 400);
    return () => clearTimeout(t);
  }, [appointments, products, stockLog, security]);

  const pushNotification = (text) => setNotifications((prev) => [{ id: Date.now(), text }, ...prev]);

  const handleAddVehicle = async (v) => {
    if (supabaseEnabled) {
      const newId = await addVehicle(myClientId, v);
      const newVehicle = { id: newId, ...v };
      setMyVehicles((prev) => [...prev, newVehicle]);
      setVehicleIdByPlate((prev) => ({ ...prev, [v.plate]: newId }));
    } else {
      const newId = "v" + Math.random().toString(36).slice(2, 8);
      setMyVehicles((prev) => [...prev, { id: newId, ...v }]);
    }
  };
  const addStockLog = (entry) => setStockLog((prev) => [{ id: Date.now() + Math.random(), date: new Date().toLocaleString("pt-BR"), ...entry }, ...prev]);

  const resetDemo = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch (err) {}
    setAppointments(seedAppointments());
    setProducts(seedProducts());
    setStockLog([]);
    setSecurity(DEFAULT_SECURITY);
    setAdminAuthed(false);
  };

  const queue = useMemo(() => appointments
    .filter((a) => a.date === todayISO() && ["chegou","aguardando","lavagem","finalizacao","pronto"].includes(a.status))
    .sort((a,b) => statusIndex(b.status) - statusIndex(a.status)), [appointments]);

  return (
    <div className="w-full h-full min-h-[700px] flex items-center justify-center p-3" style={{ background: "#05070d" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Space Grotesk', sans-serif; font-weight: 600; }
        .font-body { font-family: 'Inter', sans-serif; }
        .bg-slate-925 { background-color: #0c1221; }
        .bg-slate-850 { background-color: #141d33; }
        * { scrollbar-width: thin; scrollbar-color: #1e293b transparent; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 999px; }
      `}</style>

      <div className="w-full max-w-6xl h-[760px] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col font-body" style={{ background: "#05070d" }}>
        <div className="shrink-0 flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Droplets size={13} className="text-cyan-400" /> Protótipo — Sistema SM Lavacar
          </div>
          <div className="flex gap-1 bg-slate-950 rounded-full p-1 border border-slate-800">
            <button onClick={() => setAppMode("client")} className={`px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${appMode==="client"?"bg-cyan-400 text-slate-950":"text-slate-400"}`}><User size={12}/> App do Cliente</button>
            <button onClick={() => setAppMode("admin")} className={`px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${appMode==="admin"?"bg-cyan-400 text-slate-950":"text-slate-400"}`}><LayoutDashboard size={12}/> Painel Admin</button>
          </div>
        </div>

        <div className="flex-1 min-h-0 relative">
          <ServicesContext.Provider value={servicesState}>
          <VehiclesContext.Provider value={{ vehicles: myVehicles, addVehicle: handleAddVehicle }}>
          {dbLoading ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 size={22} className="animate-spin text-cyan-400" />
              <p className="text-xs">Carregando dados salvos...</p>
            </div>
          ) : appMode === "client" ? (
            <div className="h-full max-w-[420px] mx-auto border-x border-slate-900">
              <ClientApp appointments={appointments} setAppointments={setAppointments} queue={queue} notifications={notifications} pushNotification={pushNotification} myClientId={myClientId} vehicleIdByPlate={vehicleIdByPlate} services={servicesState} />
            </div>
          ) : !adminAuthed ? (
            <AdminGate security={security} setSecurity={setSecurity} onSuccess={() => setAdminAuthed(true)} onResetDemo={resetDemo} />
          ) : (
            <AdminApp
              appointments={appointments}
              setAppointments={setAppointments}
              queue={queue}
              employees={employeesState.length ? employeesState : EMPLOYEES}
              setEmployeesState={setEmployeesState}
              clientsDb={CLIENTS_DB}
              servicesState={servicesState}
              setServicesState={setServicesState}
              products={products}
              setProducts={setProducts}
              stockLog={stockLog}
              addStockLog={addStockLog}
              security={security}
              setSecurity={setSecurity}
              onLogout={() => { if (supabaseEnabled) supabase.auth.signOut(); setAdminAuthed(false); }}
            />
          )}
          </VehiclesContext.Provider>
          </ServicesContext.Provider>
        </div>
      </div>
    </div>
  );
}
