import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";

const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const fmtDate = (d) => { if(!d) return "—"; const [y,m,day]=d.split("-"); return `${day}/${m}/${y}`; };

const UNITS = ["por visita","por hora","por m²","por día","por semana","por mes","por persona","por ítem"];
const CATEGORIES = ["Limpieza general","Limpieza profunda","Desinfección","Mantenimiento","Jardinería","Fumigación","Pintura","Plomería","Electricidad","Carpintería","Otro"];

export default function Servicios({ clients = [], config = {} }) {
  const fmt = (n) => `${config.moneda || "$"}${Number(n).toLocaleString("es-AR")}`;
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState(null);
  const [showAssign, setShowAssign] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("Todos");
  const [filterActive, setFilterActive] = useState("todos");

  useEffect(() => { loadServices(); }, []);

  const loadServices = async () => {
    setLoading(true);
    const { data } = await supabase.from("services").select("*").order("created_at", { ascending: false });
    setServices(data || []);
    setLoading(false);
  };

  const cats = ["Todos", ...Array.from(new Set(services.map(s => s.category).filter(Boolean)))];

  const filtered = services.filter(s => {
    const ms = s.name.toLowerCase().includes(search.toLowerCase()) || (s.description||"").toLowerCase().includes(search.toLowerCase());
    const mc = filterCat === "Todos" || s.category === filterCat;
    const ma = filterActive === "todos" || (filterActive === "activo" ? s.active : !s.active);
    return ms && mc && ma;
  });

  const toggleActive = async (s) => {
    await supabase.from("services").update({ active: !s.active }).eq("id", s.id);
    await loadServices();
  };

  const deleteService = async (id) => {
    await supabase.from("services").delete().eq("id", id);
    await loadServices();
    setShowEdit(null);
  };

  const stats = [
    { label: "Total servicios", value: services.length },
    { label: "Activos", value: services.filter(s => s.active).length, color: "#166534" },
    { label: "Inactivos", value: services.filter(s => !s.active).length, color: "#7f1d1d" },
    { label: "Precio promedio", value: fmt(services.length ? services.reduce((a,s) => a + Number(s.price), 0) / services.length : 0) },
  ];

  return (
    <div style={{ padding: 24, fontFamily: "'Instrument Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20, flexWrap:"wrap" }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, letterSpacing:"-0.02em" }}>
          🧹 Servicios
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:10 }}>
          <button className="btn btn-dark" onClick={() => setShowNew(true)}>+ Nuevo servicio</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"flex", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        {stats.map((s,i) => (
          <div key={i} className="stat">
            <div style={{ fontSize:10, color:"#aaa", fontWeight:700, textTransform:"uppercase", letterSpacing:".07em" }}>{s.label}</div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, color:s.color||"#18181b", marginTop:2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
        <input className="field" style={{ flex:1, minWidth:180 }} placeholder="🔍 Buscar servicio..." value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display:"flex", gap:4 }}>
          {[["todos","Todos"],["activo","Activos"],["inactivo","Inactivos"]].map(([v,l]) => (
            <button key={v} onClick={() => setFilterActive(v)} style={{ padding:"5px 12px", borderRadius:20, cursor:"pointer", fontSize:12, fontWeight:600, border:"1.5px solid", borderColor:filterActive===v?"#18181b":"#e2dfd8", background:filterActive===v?"#18181b":"#fff", color:filterActive===v?"#fff":"#555", fontFamily:"inherit" }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
        {cats.map(c => (
          <button key={c} onClick={() => setFilterCat(c)} style={{ padding:"3px 10px", borderRadius:20, cursor:"pointer", fontSize:12, fontWeight:600, border:"1.5px solid", borderColor:filterCat===c?"#18181b":"#e2dfd8", background:filterCat===c?"#18181b":"#fff", color:filterCat===c?"#fff":"#555", fontFamily:"inherit" }}>{c}</button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign:"center", padding:48, color:"#aaa" }}>Cargando...</div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:12 }}>
          {filtered.map(s => (
            <div key={s.id} className="card" style={{ padding:18, opacity:s.active?1:0.6 }}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:15, marginBottom:3 }}>{s.name}</div>
                  <div style={{ fontSize:11, color:"#888", marginBottom:6 }}>{s.category || "Sin categoría"}</div>
                  {s.description && <div style={{ fontSize:12, color:"#555", lineHeight:1.5, marginBottom:8 }}>{s.description}</div>}
                </div>
                <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:s.active?"#dcfce7":"#fee2e2", color:s.active?"#166534":"#7f1d1d", flexShrink:0, marginLeft:8 }}>{s.active?"Activo":"Inactivo"}</span>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
                {[
                  { label:"Precio", value:fmt(s.price||0) },
                  { label:"Duración", value:s.duration?`${s.duration} min`:"—" },
                  { label:"Unidad", value:s.unit||"—" },
                ].map((item,i) => (
                  <div key={i} style={{ background:"#f8f7f4", borderRadius:8, padding:"8px 10px" }}>
                    <div style={{ fontSize:9, color:"#aaa", fontWeight:700, textTransform:"uppercase", letterSpacing:".06em" }}>{item.label}</div>
                    <div style={{ fontSize:13, fontWeight:700, marginTop:2 }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display:"flex", gap:6 }}>
                <button className="btn btn-outline btn-sm" style={{ flex:1 }} onClick={() => setShowEdit(s)}>✏️ Editar</button>
                <button className="btn btn-outline btn-sm" style={{ flex:1 }} onClick={() => setShowAssign(s)}>📋 Asignar</button>
                <button className="btn btn-outline btn-sm" onClick={() => toggleActive(s)} style={{ color:s.active?"#7f1d1d":"#166534", borderColor:s.active?"#fecaca":"#86efac" }}>
                  {s.active?"Pausar":"Activar"}
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ gridColumn:"1/-1", textAlign:"center", padding:48, color:"#aaa" }}>
              <div style={{ fontSize:32, marginBottom:12 }}>🧹</div>
              <div style={{ fontSize:15, fontWeight:600 }}>Sin servicios</div>
              <div style={{ fontSize:13, marginTop:4 }}>Creá el primer servicio</div>
            </div>
          )}
        </div>
      )}

      {showNew && <ServiceModal onSave={async (form) => { await supabase.from("services").insert(form); await loadServices(); setShowNew(false); }} onClose={() => setShowNew(false)} />}
      {showEdit && <ServiceModal service={showEdit} onSave={async (form) => { await supabase.from("services").update(form).eq("id", showEdit.id); await loadServices(); setShowEdit(null); }} onDelete={() => deleteService(showEdit.id)} onClose={() => setShowEdit(null)} />}
      {showAssign && <AssignModal service={showAssign} clients={clients} config={config} fmt={fmt} onClose={() => setShowAssign(null)} />}
    </div>
  );
}

function ServiceModal({ service, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    name: service?.name || "",
    category: service?.category || "",
    description: service?.description || "",
    price: service?.price || "",
    duration: service?.duration || "",
    unit: service?.unit || "por visita",
    active: service?.active !== undefined ? service.active : true,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    await onSave({ ...form, price: Number(form.price)||0, duration: Number(form.duration)||0 });
    setSaving(false);
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth:520 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800, marginBottom:18 }}>
          {service ? "Editar servicio" : "Nuevo servicio"}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Nombre *</label>
            <input className="field" placeholder="Ej: Limpieza profunda de oficinas" value={form.name} onChange={e => set("name", e.target.value)} autoFocus />
          </div>

          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Categoría</label>
            <select className="field" value={form.category} onChange={e => set("category", e.target.value)}>
              <option value="">— Sin categoría —</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Descripción</label>
            <textarea className="field" rows={3} placeholder="Detallá en qué consiste el servicio..." value={form.description} onChange={e => set("description", e.target.value)} style={{ resize:"vertical" }} />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Precio</label>
              <input className="field" type="number" placeholder="0" value={form.price} onChange={e => set("price", e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Duración (min)</label>
              <input className="field" type="number" placeholder="60" value={form.duration} onChange={e => set("duration", e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Unidad</label>
              <select className="field" value={form.unit} onChange={e => set("unit", e.target.value)}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:6 }}>Estado</label>
            <div style={{ display:"flex", gap:8 }}>
              {[["true","✅ Activo"],["false","⏸ Inactivo"]].map(([v,l]) => (
                <button key={v} onClick={() => set("active", v==="true")} style={{ flex:1, padding:"8px", borderRadius:9, cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, border:"1.5px solid", borderColor:String(form.active)===v?"#18181b":"#e2dfd8", background:String(form.active)===v?"#18181b":"#fff", color:String(form.active)===v?"#fff":"#555" }}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display:"flex", gap:8, marginTop:18, justifyContent:"flex-end", alignItems:"center" }}>
          {service && <button className="btn btn-outline btn-sm" style={{ color:"#ef4444", borderColor:"#fecaca", marginRight:"auto" }} onClick={onDelete}>🗑 Eliminar</button>}
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-dark" onClick={handleSave} disabled={saving}>{saving?"Guardando...":"Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

function AssignModal({ service, clients, fmt, onClose }) {
  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; });
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const total = Number(service.price) * Number(qty);

  const handleSave = async () => {
    setSaving(true);
    const cl = clients.find(c => String(c.id) === String(clientId));
    await supabase.from("movements").insert({
      type: "ingreso",
      category: "Venta",
      description: `${service.name}${cl ? ` — ${cl.name}` : ""}${notes ? ` (${notes})` : ""}`,
      amount: total,
      date,
      client_id: clientId ? Number(clientId) : null,
    });
    if (clientId) {
      await supabase.from("visits").insert({
        client_id: Number(clientId),
        date,
        description: service.name,
        amount: total,
      });
    }
    setSaving(false);
    setDone(true);
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth:420 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800, marginBottom:6 }}>📋 Asignar servicio</div>
        <div style={{ fontSize:13, color:"#888", marginBottom:18 }}>{service.name}</div>

        {done ? (
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <div style={{ fontSize:36, marginBottom:10 }}>✅</div>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:6 }}>Servicio registrado</div>
            <div style={{ fontSize:13, color:"#888", marginBottom:18 }}>Se registró el ingreso en Caja</div>
            <button className="btn btn-dark" onClick={onClose}>Cerrar</button>
          </div>
        ) : (
          <>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Cliente (opcional)</label>
                <select className="field" value={clientId} onChange={e => setClientId(e.target.value)}>
                  <option value="">— Sin cliente —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Fecha</label>
                  <input className="field" type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Cantidad</label>
                  <input className="field" type="number" min={1} value={qty} onChange={e => setQty(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Notas</label>
                <input className="field" placeholder="Observaciones del servicio..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              {total > 0 && (
                <div style={{ background:"#f0fdf4", border:"1.5px solid #86efac", borderRadius:10, padding:"12px 16px", display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontWeight:600, color:"#166534" }}>Total</span>
                  <span style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, color:"#166534" }}>{fmt(total)}</span>
                </div>
              )}
            </div>
            <div style={{ display:"flex", gap:8, marginTop:18, justifyContent:"flex-end" }}>
              <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
              <button className="btn btn-green" onClick={handleSave} disabled={saving}>{saving?"Guardando...":"Confirmar"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
