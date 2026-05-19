import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";

const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const fmtDate = (d) => { if(!d) return "—"; const [y,m,day]=d.split("-"); return `${day}/${m}/${y}`; };
const nroViaje = () => `VJ-${Date.now().toString().slice(-6)}`;

const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const TRIP_STATUS = {
  pendiente:  { bg:"#fef9c3", text:"#854d0e", label:"Pendiente" },
  en_camino:  { bg:"#dbeafe", text:"#1d4ed8", label:"En camino" },
  entregado:  { bg:"#dcfce7", text:"#166534", label:"Entregado" },
  con_novedad:{ bg:"#fee2e2", text:"#7f1d1d", label:"Con novedad" },
  cancelado:  { bg:"#f3f4f6", text:"#6b7280", label:"Cancelado" },
};

const EXPENSE_TYPES = ["Combustible","Peaje","Comida","Alojamiento","Reparación","Lavado","Multa","Otro"];

export default function Transporte({ clients = [], config = {}, userId }) {
  const fmt = (n) => `${config.moneda || "$"}${Number(n).toLocaleString("es-AR")}`;
  const [tab, setTab] = useState("viajes");
  const [trips, setTrips] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selTrip, setSelTrip] = useState(null);
  const [showNewTrip, setShowNewTrip] = useState(false);
  const [showNewDriver, setShowNewDriver] = useState(false);
  const [showNewVehicle, setShowNewVehicle] = useState(false);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [search, setSearch] = useState("");

  useEffect(() => { if (userId) loadAll(); }, [userId]);

  const loadAll = async () => {
    setLoading(true);
    const [t, d, v] = await Promise.all([
      supabase.from("trips").select("*").eq("empresa_id", userId).order("date", { ascending: false }),
      supabase.from("drivers").select("*").eq("empresa_id", userId).order("name"),
      supabase.from("vehicles").select("*").eq("empresa_id", userId).order("plate"),
    ]);
    const tripIds = (t.data || []).map(tr => tr.id);
    let expenses = [];
    if (tripIds.length > 0) {
      const { data: exp } = await supabase.from("trip_expenses").select("*").in("trip_id", tripIds);
      expenses = exp || [];
    }
    setTrips((t.data || []).map(tr => ({ ...tr, expenses: expenses.filter(e => e.trip_id === tr.id) })));
    setDrivers(d.data || []);
    setVehicles(v.data || []);
    setLoading(false);
  };

  // Alertas de vencimientos
  const alertas = [
    ...vehicles.flatMap(v => [
      v.insurance_expiry && daysUntil(v.insurance_expiry) <= 30 ? { msg: `Seguro de ${v.plate} vence en ${daysUntil(v.insurance_expiry)} días`, color: "#854d0e" } : null,
      v.vtv_expiry && daysUntil(v.vtv_expiry) <= 30 ? { msg: `VTV de ${v.plate} vence en ${daysUntil(v.vtv_expiry)} días`, color: "#854d0e" } : null,
      v.habilitacion_expiry && daysUntil(v.habilitacion_expiry) <= 30 ? { msg: `Habilitación de ${v.plate} vence en ${daysUntil(v.habilitacion_expiry)} días`, color: "#7f1d1d" } : null,
    ].filter(Boolean)),
    ...drivers.flatMap(d => [
      d.license_expiry && daysUntil(d.license_expiry) <= 30 ? { msg: `Licencia de ${d.name} vence en ${daysUntil(d.license_expiry)} días`, color: "#7f1d1d" } : null,
    ].filter(Boolean)),
  ];

  const filteredTrips = trips.filter(t => {
    const ms = (t.origin||"").toLowerCase().includes(search.toLowerCase()) ||
      (t.destination||"").toLowerCase().includes(search.toLowerCase()) ||
      (t.client_name||"").toLowerCase().includes(search.toLowerCase()) ||
      (t.nro||"").toLowerCase().includes(search.toLowerCase());
    const mf = filterStatus === "todos" || t.status === filterStatus;
    return ms && mf;
  });

  const totalFacturado = trips.reduce((a, t) => a + Number(t.rate || 0), 0);
  const totalGastos = trips.reduce((a, t) => a + (t.expenses||[]).reduce((b, e) => b + Number(e.amount||0), 0), 0);
  const enCamino = trips.filter(t => t.status === "en_camino").length;

  if (selTrip) {
    const updated = trips.find(t => t.id === selTrip.id) || selTrip;
    return <TripDetail trip={updated} drivers={drivers} vehicles={vehicles} clients={clients} config={config} fmt={fmt} userId={userId} onBack={() => setSelTrip(null)} reload={loadAll} />;
  }

  return (
    <div style={{ padding: 24, fontFamily: "'Instrument Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:16, flexWrap:"wrap" }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800 }}>🚛 Transporte</div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          {tab === "viajes" && <button className="btn btn-dark" onClick={() => setShowNewTrip(true)}>+ Nuevo viaje</button>}
          {tab === "choferes" && <button className="btn btn-dark" onClick={() => setShowNewDriver(true)}>+ Nuevo chofer</button>}
          {tab === "vehiculos" && <button className="btn btn-dark" onClick={() => setShowNewVehicle(true)}>+ Nuevo vehículo</button>}
        </div>
      </div>

      {/* Alertas */}
      {alertas.map((a, i) => (
        <div key={i} style={{ background:"#fff7ed", border:"1.5px solid #fed7aa", borderRadius:10, padding:"8px 14px", fontSize:12, color:a.color, fontWeight:600, marginBottom:8, display:"flex", gap:8 }}>
          ⚠️ {a.msg}
        </div>
      ))}

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }}>
        {[
          { label:"Viajes totales", value:trips.length },
          { label:"En camino", value:enCamino, color:enCamino>0?"#1d4ed8":"#18181b" },
          { label:"Facturado", value:fmt(totalFacturado), color:"#166534" },
          { label:"Ganancia neta", value:fmt(totalFacturado-totalGastos), color:totalFacturado-totalGastos>=0?"#166534":"#7f1d1d" },
        ].map((s,i) => (
          <div key={i} className="stat" style={{ padding:"12px 14px" }}>
            <div style={{ fontSize:9, color:"#aaa", fontWeight:700, textTransform:"uppercase", letterSpacing:".07em" }}>{s.label}</div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, color:s.color||"#18181b", marginTop:2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, background:"#f5f3ef", borderRadius:10, padding:4, marginBottom:16, width:"fit-content" }}>
        {[["viajes","🚛 Viajes"],["choferes","👤 Choferes"],["vehiculos","🚚 Vehículos"]].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding:"6px 16px", borderRadius:7, cursor:"pointer", fontSize:13, fontWeight:600, border:"none", background:tab===k?"#fff":"transparent", color:tab===k?"#18181b":"#888", fontFamily:"inherit", boxShadow:tab===k?"0 1px 4px rgba(0,0,0,.08)":"none" }}>{l}</button>
        ))}
      </div>

      {/* Viajes */}
      {tab === "viajes" && (
        <>
          <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
            <input className="field" style={{ flex:1, minWidth:180 }} placeholder="🔍 Buscar viaje, cliente, origen..." value={search} onChange={e => setSearch(e.target.value)} />
            <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
              {[["todos","Todos"],...Object.entries(TRIP_STATUS).map(([k,v])=>[k,v.label])].map(([k,l]) => (
                <button key={k} onClick={() => setFilterStatus(k)} style={{ padding:"4px 10px", borderRadius:20, cursor:"pointer", fontSize:11, fontWeight:600, border:"1.5px solid", borderColor:filterStatus===k?"#18181b":"#e2dfd8", background:filterStatus===k?"#18181b":"#fff", color:filterStatus===k?"#fff":"#555", fontFamily:"inherit" }}>{l}</button>
              ))}
            </div>
          </div>
          {loading ? <div style={{ textAlign:"center", padding:48, color:"#aaa" }}>Cargando...</div> : (
            <div className="card" style={{ padding:6 }}>
              {filteredTrips.map(t => {
                const st = TRIP_STATUS[t.status] || TRIP_STATUS.pendiente;
                const driver = drivers.find(d => d.id === t.driver_id);
                const vehicle = vehicles.find(v => v.id === t.vehicle_id);
                const gastos = (t.expenses||[]).reduce((a,e) => a+Number(e.amount||0), 0);
                return (
                  <div key={t.id} className="row-h" style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px" }} onClick={() => setSelTrip(t)}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:3 }}>
                        <div style={{ fontWeight:700, fontSize:14 }}>{t.origin} → {t.destination}</div>
                        <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:st.bg, color:st.text }}>{st.label}</span>
                      </div>
                      <div style={{ fontSize:11, color:"#888" }}>
                        {fmtDate(t.date)} · {t.client_name||"Sin cliente"} · {driver?.name||"Sin chofer"} · {vehicle?.plate||"Sin vehículo"}
                      </div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:"#166534" }}>{fmt(t.rate||0)}</div>
                      {gastos > 0 && <div style={{ fontSize:11, color:"#ef4444" }}>-{fmt(gastos)} gastos</div>}
                    </div>
                  </div>
                );
              })}
              {filteredTrips.length === 0 && <div style={{ textAlign:"center", padding:28, color:"#aaa" }}>Sin viajes</div>}
            </div>
          )}
        </>
      )}

      {/* Choferes */}
      {tab === "choferes" && (
        <div className="card" style={{ padding:6 }}>
          {drivers.map(d => {
            const licDays = daysUntil(d.license_expiry);
            const vencida = licDays !== null && licDays <= 0;
            const porVencer = licDays !== null && licDays > 0 && licDays <= 30;
            return (
              <div key={d.id} className="row-h" style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px" }}>
                <div style={{ width:42, height:42, borderRadius:"50%", background:`hsl(${d.id*67%360},55%,88%)`, color:`hsl(${d.id*67%360},55%,32%)`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:16, flexShrink:0 }}>{d.name[0]}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <div style={{ fontWeight:700, fontSize:14 }}>{d.name}</div>
                    {vencida && <span style={{ background:"#fee2e2", color:"#7f1d1d", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>🚫 Licencia vencida</span>}
                    {porVencer && <span style={{ background:"#fef9c3", color:"#854d0e", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>⚠️ Licencia por vencer</span>}
                    {!d.active && <span style={{ background:"#f3f4f6", color:"#6b7280", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>Inactivo</span>}
                  </div>
                  <div style={{ fontSize:11, color:"#888", marginTop:2 }}>
                    DNI: {d.dni||"—"} · Tel: {d.phone||"—"} · Lic: {d.license_number||"—"} · Vence: {fmtDate(d.license_expiry)}
                  </div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontWeight:700, fontSize:13 }}>{fmt(d.salary||0)}/mes</div>
                  <div style={{ fontSize:11, color:"#aaa" }}>{trips.filter(t => t.driver_id === d.id).length} viajes</div>
                </div>
              </div>
            );
          })}
          {drivers.length === 0 && <div style={{ textAlign:"center", padding:28, color:"#aaa" }}>Sin choferes</div>}
        </div>
      )}

      {/* Vehículos */}
      {tab === "vehiculos" && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px,1fr))", gap:12 }}>
          {vehicles.map(v => {
            const alerts = [
              v.insurance_expiry && daysUntil(v.insurance_expiry) <= 30 ? `Seguro vence ${fmtDate(v.insurance_expiry)}` : null,
              v.vtv_expiry && daysUntil(v.vtv_expiry) <= 30 ? `VTV vence ${fmtDate(v.vtv_expiry)}` : null,
              v.habilitacion_expiry && daysUntil(v.habilitacion_expiry) <= 30 ? `Habilitación vence ${fmtDate(v.habilitacion_expiry)}` : null,
            ].filter(Boolean);
            return (
              <div key={v.id} className="card" style={{ padding:16 }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:10 }}>
                  <div>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800 }}>{v.plate}</div>
                    <div style={{ fontSize:13, color:"#555", marginTop:2 }}>{v.brand} {v.model} {v.year||""}</div>
                  </div>
                  <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:v.active?"#dcfce7":"#fee2e2", color:v.active?"#166534":"#7f1d1d" }}>{v.active?"Activo":"Inactivo"}</span>
                </div>
                {[
                  ["🛡️","Seguro",fmtDate(v.insurance_expiry)],
                  ["🔧","VTV",fmtDate(v.vtv_expiry)],
                  ["📋","Habilitación",fmtDate(v.habilitacion_expiry)],
                ].map(([ic,l,val],i) => (
                  <div key={i} style={{ display:"flex", gap:8, fontSize:12, padding:"4px 0", borderBottom:"1px solid #f5f3ef" }}>
                    <span>{ic}</span><span style={{ color:"#888", flex:1 }}>{l}</span><span style={{ fontWeight:600 }}>{val}</span>
                  </div>
                ))}
                {alerts.length > 0 && alerts.map((a,i) => (
                  <div key={i} style={{ marginTop:6, fontSize:11, color:"#854d0e", fontWeight:600, background:"#fff7ed", borderRadius:6, padding:"4px 8px" }}>⚠️ {a}</div>
                ))}
                <div style={{ marginTop:10, fontSize:11, color:"#aaa" }}>{trips.filter(t => t.vehicle_id === v.id).length} viajes realizados</div>
              </div>
            );
          })}
          {vehicles.length === 0 && <div style={{ gridColumn:"1/-1", textAlign:"center", padding:28, color:"#aaa" }}>Sin vehículos</div>}
        </div>
      )}

      {showNewTrip && <TripModal drivers={drivers} vehicles={vehicles} clients={clients} onSave={async (form) => { await supabase.from("trips").insert({ ...form, empresa_id: userId, nro: nroViaje() }); await loadAll(); setShowNewTrip(false); }} onClose={() => setShowNewTrip(false)} />}
      {showNewDriver && <DriverModal onSave={async (form) => { await supabase.from("drivers").insert({ ...form, empresa_id: userId }); await loadAll(); setShowNewDriver(false); }} onClose={() => setShowNewDriver(false)} />}
      {showNewVehicle && <VehicleModal onSave={async (form) => { await supabase.from("vehicles").insert({ ...form, empresa_id: userId }); await loadAll(); setShowNewVehicle(false); }} onClose={() => setShowNewVehicle(false)} />}
    </div>
  );
}

function TripDetail({ trip: t, drivers, vehicles, clients, config, fmt, userId, onBack, reload }) {
  const [showExpense, setShowExpense] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const st = TRIP_STATUS[t.status] || TRIP_STATUS.pendiente;
  const driver = drivers.find(d => d.id === t.driver_id);
  const vehicle = vehicles.find(v => v.id === t.vehicle_id);
  const totalGastos = (t.expenses||[]).reduce((a,e) => a+Number(e.amount||0), 0);
  const ganancia = Number(t.rate||0) - totalGastos;

  const changeStatus = async (status) => {
    await supabase.from("trips").update({ status }).eq("id", t.id);
    await reload();
  };

  const deleteTrip = async () => {
    if (!window.confirm("¿Eliminar viaje?")) return;
    await supabase.from("trips").delete().eq("id", t.id);
    onBack(); reload();
  };

  const deleteExpense = async (id) => {
    await supabase.from("trip_expenses").delete().eq("id", id);
    await reload();
  };

  return (
    <div style={{ padding:24, fontFamily:"'Instrument Sans', sans-serif" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        <button className="btn btn-outline btn-sm" onClick={onBack}>← Volver</button>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800 }}>{t.origin} → {t.destination}</div>
            <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, background:st.bg, color:st.text }}>{st.label}</span>
          </div>
          <div style={{ fontSize:12, color:"#888", marginTop:2 }}>{t.nro} · {fmtDate(t.date)}</div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => setShowEdit(true)}>✏️ Editar</button>
        <button className="btn btn-outline btn-sm" style={{ color:"#ef4444", borderColor:"#fecaca" }} onClick={deleteTrip}>🗑</button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"320px 1fr", gap:16, alignItems:"start" }}>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {/* Info viaje */}
          <div className="card" style={{ padding:16 }}>
            <div className="sec">Detalle del viaje</div>
            {[
              ["📍","Origen",t.origin||"—"],
              ["🏁","Destino",t.destination||"—"],
              ["📅","Fecha salida",fmtDate(t.date)],
              ["📅","Retorno est.",fmtDate(t.estimated_return)],
              ["👤","Cliente",t.client_name||"—"],
              ["🚛","Carga",t.cargo||"—"],
              t.cargo_weight ? ["⚖️","Peso",`${t.cargo_weight} kg`] : null,
              ["👨‍✈️","Chofer",driver?.name||"—"],
              ["🚚","Vehículo",vehicle?.plate||"—"],
            ].filter(Boolean).map(([ic,label,val],i) => (
              <div key={i} style={{ display:"flex", gap:10, padding:"6px 0", borderBottom:"1px solid #f5f3ef", alignItems:"center" }}>
                <span style={{ fontSize:14, flexShrink:0 }}>{ic}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:"#aaa", fontWeight:600, textTransform:"uppercase" }}>{label}</div>
                  <div style={{ fontSize:13, marginTop:1 }}>{val}</div>
                </div>
              </div>
            ))}
            {t.notes && <div style={{ marginTop:10, fontSize:13, color:"#555", background:"#f8f7f4", borderRadius:8, padding:"8px 10px" }}>{t.notes}</div>}
          </div>

          {/* Resumen financiero */}
          <div className="card" style={{ padding:16 }}>
            <div className="sec">Resumen financiero</div>
            {[
              ["Tarifa cobrada", fmt(t.rate||0), "#166534"],
              ["Total gastos", `-${fmt(totalGastos)}`, "#ef4444"],
              ["Ganancia neta", fmt(ganancia), ganancia>=0?"#166534":"#7f1d1d"],
            ].map(([l,v,c],i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #f5f3ef" }}>
                <span style={{ fontSize:13, color:"#555" }}>{l}</span>
                <span style={{ fontWeight:700, fontSize:14, color:c }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Cambiar estado */}
          <div className="card" style={{ padding:16 }}>
            <div className="sec">Estado del viaje</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {Object.entries(TRIP_STATUS).map(([k,v]) => (
                <button key={k} onClick={() => changeStatus(k)} style={{ padding:"8px 12px", borderRadius:9, cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, border:`1.5px solid ${t.status===k?v.text:"#e2dfd8"}`, background:t.status===k?v.bg:"#fff", color:t.status===k?v.text:"#555", textAlign:"left" }}>{v.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Gastos */}
        <div className="card" style={{ padding:16 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <div className="sec" style={{ marginBottom:0 }}>💸 Gastos del viaje ({(t.expenses||[]).length})</div>
            <button className="btn btn-dark btn-sm" onClick={() => setShowExpense(true)}>+ Gasto</button>
          </div>
          {(t.expenses||[]).length === 0 && <div style={{ textAlign:"center", padding:24, color:"#aaa" }}>Sin gastos registrados</div>}
          {(t.expenses||[]).map(e => (
            <div key={e.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", borderRadius:10, border:"1.5px solid #ede9e3", marginBottom:8, background:"#fafaf8" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:13 }}>{e.type}</div>
                <div style={{ fontSize:11, color:"#888", marginTop:1 }}>{e.description||"—"} · {fmtDate(e.date)}</div>
              </div>
              <div style={{ fontWeight:700, fontSize:14, color:"#ef4444" }}>{fmt(e.amount)}</div>
              <button className="btn btn-outline btn-sm" style={{ color:"#ef4444", borderColor:"#fecaca", padding:"3px 8px" }} onClick={() => deleteExpense(e.id)}>✕</button>
            </div>
          ))}
          {(t.expenses||[]).length > 0 && (
            <div style={{ marginTop:12, background:"#fef2f2", border:"1.5px solid #fca5a5", borderRadius:10, padding:"10px 14px", display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontWeight:600, color:"#7f1d1d" }}>Total gastos</span>
              <span style={{ fontWeight:800, fontSize:16, color:"#7f1d1d" }}>{fmt(totalGastos)}</span>
            </div>
          )}
        </div>
      </div>

      {showExpense && (
        <ExpenseModal
          onSave={async (form) => {
            await supabase.from("trip_expenses").insert({ ...form, trip_id: t.id, empresa_id: userId });
            await reload();
            setShowExpense(false);
          }}
          onClose={() => setShowExpense(false)}
        />
      )}
      {showEdit && (
        <TripModal
          trip={t}
          drivers={drivers}
          vehicles={vehicles}
          clients={clients}
          onSave={async (form) => {
            await supabase.from("trips").update(form).eq("id", t.id);
            await reload();
            setShowEdit(false);
          }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  );
}

function TripModal({ trip, drivers, vehicles, clients, onSave, onClose }) {
  const [form, setForm] = useState({
    origin: trip?.origin||"", destination: trip?.destination||"",
    date: trip?.date||todayStr(), estimated_return: trip?.estimated_return||"",
    driver_id: trip?.driver_id||"", vehicle_id: trip?.vehicle_id||"",
    client_id: trip?.client_id||"", client_name: trip?.client_name||"",
    cargo: trip?.cargo||"", cargo_weight: trip?.cargo_weight||"",
    rate: trip?.rate||"", status: trip?.status||"pendiente", notes: trip?.notes||"",
  });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const handleClient = (id) => {
    const c = clients.find(c => String(c.id) === String(id));
    set("client_id", id); set("client_name", c ? c.name : "");
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth:580 }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800, marginBottom:18 }}>{trip?"Editar viaje":"Nuevo viaje"}</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Origen *</label>
            <input className="field" placeholder="Ciudad de origen" value={form.origin} onChange={e=>set("origin",e.target.value)} autoFocus />
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Destino *</label>
            <input className="field" placeholder="Ciudad de destino" value={form.destination} onChange={e=>set("destination",e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Fecha de salida</label>
            <input className="field" type="date" value={form.date} onChange={e=>set("date",e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Retorno estimado</label>
            <input className="field" type="date" value={form.estimated_return} onChange={e=>set("estimated_return",e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Chofer</label>
            <select className="field" value={form.driver_id} onChange={e=>set("driver_id",e.target.value)}>
              <option value="">— Sin chofer —</option>
              {drivers.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Vehículo</label>
            <select className="field" value={form.vehicle_id} onChange={e=>set("vehicle_id",e.target.value)}>
              <option value="">— Sin vehículo —</option>
              {vehicles.map(v=><option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Cliente</label>
            <select className="field" value={form.client_id} onChange={e=>handleClient(e.target.value)}>
              <option value="">— Sin cliente —</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Descripción de carga</label>
            <input className="field" placeholder="Ej: Pallets de cerámica" value={form.cargo} onChange={e=>set("cargo",e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Peso (kg)</label>
            <input className="field" type="number" placeholder="0" value={form.cargo_weight} onChange={e=>set("cargo_weight",e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Tarifa / Flete</label>
            <input className="field" type="number" placeholder="0" value={form.rate} onChange={e=>set("rate",e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Estado</label>
            <select className="field" value={form.status} onChange={e=>set("status",e.target.value)}>
              {Object.entries(TRIP_STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Notas</label>
            <textarea className="field" rows={2} value={form.notes} onChange={e=>set("notes",e.target.value)} style={{ resize:"none" }} />
          </div>
        </div>
        <div style={{ display:"flex", gap:8, marginTop:18, justifyContent:"flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-dark" disabled={saving} onClick={async()=>{
            if(!form.origin||!form.destination)return;
            setSaving(true);
            await onSave({...form, driver_id:form.driver_id||null, vehicle_id:form.vehicle_id||null, client_id:form.client_id||null, rate:Number(form.rate)||0, cargo_weight:Number(form.cargo_weight)||null, estimated_return:form.estimated_return||null});
            setSaving(false);
          }}>{saving?"Guardando...":"Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

function DriverModal({ driver, onSave, onClose }) {
  const [form, setForm] = useState({
    name:driver?.name||"", dni:driver?.dni||"", phone:driver?.phone||"", email:driver?.email||"",
    license_number:driver?.license_number||"", license_expiry:driver?.license_expiry||"",
    hire_date:driver?.hire_date||"", salary:driver?.salary||"", notes:driver?.notes||"", active:driver?.active!==false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth:520 }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800, marginBottom:18 }}>{driver?"Editar chofer":"Nuevo chofer"}</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Nombre completo *</label>
            <input className="field" placeholder="Juan Pérez" value={form.name} onChange={e=>set("name",e.target.value)} autoFocus />
          </div>
          <div><label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>DNI</label><input className="field" value={form.dni} onChange={e=>set("dni",e.target.value)} /></div>
          <div><label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Teléfono</label><input className="field" value={form.phone} onChange={e=>set("phone",e.target.value)} /></div>
          <div><label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>N° Licencia</label><input className="field" value={form.license_number} onChange={e=>set("license_number",e.target.value)} /></div>
          <div><label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Vencimiento licencia</label><input className="field" type="date" value={form.license_expiry} onChange={e=>set("license_expiry",e.target.value)} /></div>
          <div><label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Fecha de ingreso</label><input className="field" type="date" value={form.hire_date} onChange={e=>set("hire_date",e.target.value)} /></div>
          <div><label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Sueldo mensual</label><input className="field" type="number" value={form.salary} onChange={e=>set("salary",e.target.value)} /></div>
          <div style={{ gridColumn:"1/-1" }}><label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Notas</label><textarea className="field" rows={2} value={form.notes} onChange={e=>set("notes",e.target.value)} style={{ resize:"none" }} /></div>
        </div>
        <div style={{ display:"flex", gap:8, marginTop:18, justifyContent:"flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-dark" disabled={saving} onClick={async()=>{
            if(!form.name)return; setSaving(true);
            await onSave({...form, salary:Number(form.salary)||0, license_expiry:form.license_expiry||null, hire_date:form.hire_date||null});
            setSaving(false);
          }}>{saving?"Guardando...":"Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

function VehicleModal({ vehicle, onSave, onClose }) {
  const [form, setForm] = useState({
    plate:vehicle?.plate||"", brand:vehicle?.brand||"", model:vehicle?.model||"", year:vehicle?.year||"",
    insurance_expiry:vehicle?.insurance_expiry||"", vtv_expiry:vehicle?.vtv_expiry||"",
    habilitacion_expiry:vehicle?.habilitacion_expiry||"", notes:vehicle?.notes||"", active:vehicle?.active!==false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth:520 }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800, marginBottom:18 }}>{vehicle?"Editar vehículo":"Nuevo vehículo"}</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div><label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Patente *</label><input className="field" placeholder="ABC 123" value={form.plate} onChange={e=>set("plate",e.target.value)} autoFocus /></div>
          <div><label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Marca</label><input className="field" placeholder="Mercedes" value={form.brand} onChange={e=>set("brand",e.target.value)} /></div>
          <div><label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Modelo</label><input className="field" placeholder="Actros" value={form.model} onChange={e=>set("model",e.target.value)} /></div>
          <div><label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Año</label><input className="field" type="number" placeholder="2020" value={form.year} onChange={e=>set("year",e.target.value)} /></div>
          <div><label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Venc. seguro</label><input className="field" type="date" value={form.insurance_expiry} onChange={e=>set("insurance_expiry",e.target.value)} /></div>
          <div><label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Venc. VTV</label><input className="field" type="date" value={form.vtv_expiry} onChange={e=>set("vtv_expiry",e.target.value)} /></div>
          <div><label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Venc. habilitación</label><input className="field" type="date" value={form.habilitacion_expiry} onChange={e=>set("habilitacion_expiry",e.target.value)} /></div>
          <div style={{ gridColumn:"1/-1" }}><label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Notas</label><textarea className="field" rows={2} value={form.notes} onChange={e=>set("notes",e.target.value)} style={{ resize:"none" }} /></div>
        </div>
        <div style={{ display:"flex", gap:8, marginTop:18, justifyContent:"flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-dark" disabled={saving} onClick={async()=>{
            if(!form.plate)return; setSaving(true);
            await onSave({...form, year:Number(form.year)||null, insurance_expiry:form.insurance_expiry||null, vtv_expiry:form.vtv_expiry||null, habilitacion_expiry:form.habilitacion_expiry||null});
            setSaving(false);
          }}>{saving?"Guardando...":"Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

function ExpenseModal({ onSave, onClose }) {
  const [form, setForm] = useState({ type:"Combustible", description:"", amount:"", date:todayStr() });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth:380 }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:17, fontWeight:800, marginBottom:14 }}>💸 Nuevo gasto</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div><label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Tipo</label>
            <select className="field" value={form.type} onChange={e=>set("type",e.target.value)}>
              {EXPENSE_TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <input className="field" placeholder="Descripción" value={form.description} onChange={e=>set("description",e.target.value)} />
          <input className="field" type="number" placeholder="Monto *" value={form.amount} onChange={e=>set("amount",e.target.value)} />
          <input className="field" type="date" value={form.date} onChange={e=>set("date",e.target.value)} />
        </div>
        <div style={{ display:"flex", gap:8, marginTop:14, justifyContent:"flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-red" disabled={saving} onClick={async()=>{
            if(!form.amount)return; setSaving(true);
            await onSave({...form, amount:Number(form.amount)});
            setSaving(false);
          }}>{saving?"Guardando...":"Registrar"}</button>
        </div>
      </div>
    </div>
  );
}
