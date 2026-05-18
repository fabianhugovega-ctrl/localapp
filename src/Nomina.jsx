import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";

const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const fmtDate = (d) => { if(!d) return "—"; const [y,m,day]=d.split("-"); return `${day}/${m}/${y}`; };

const isPrueba = (hireDate) => {
  if (!hireDate) return false;
  const hire = new Date(hireDate);
  const now = new Date();
  const months = (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth());
  return months <= 6;
};

const monthsSince = (hireDate) => {
  if (!hireDate) return 0;
  const hire = new Date(hireDate);
  const now = new Date();
  return (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth());
};

const TRAINING_TYPES = ["Seguridad e higiene","Primeros auxilios","Uso de equipos","Manejo de productos químicos","Protocolo de emergencias","Atención al cliente","Capacitación técnica","Otro"];
const EQUIPMENT_TYPES = ["Casco","Guantes","Botas de seguridad","Chaleco reflectante","Arnés","Gafas de protección","Tapones auditivos","Mascarilla/Respirador","Uniforme","Ropa de trabajo","Kit de limpieza","Extintor","Linterna","Otro"];

export default function Nomina({ config = {}, userId }) {
  const fmt = (n) => `${config.moneda || "$"}${Number(n).toLocaleString("es-AR")}`;
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selEmployee, setSelEmployee] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => { if (userId) loadEmployees(); }, [userId]);

  const loadEmployees = async () => {
    setLoading(true);
    const { data: emps } = await supabase.from("employees").select("*").eq("empresa_id", userId).order("created_at", { ascending: false });
    const empIds = (emps || []).map(e => e.id);
    let payments = [], trainings = [], equipment = [];
    if (empIds.length > 0) {
      const [p, t, eq] = await Promise.all([
        supabase.from("employee_payments").select("*").in("employee_id", empIds),
        supabase.from("employee_trainings").select("*").in("employee_id", empIds),
        supabase.from("employee_equipment").select("*").in("employee_id", empIds),
      ]);
      payments = p.data || [];
      trainings = t.data || [];
      equipment = eq.data || [];
    }
    const enriched = (emps || []).map(e => ({
      ...e,
      payments: payments.filter(p => p.employee_id === e.id),
      trainings: trainings.filter(t => t.employee_id === e.id),
      equipment: equipment.filter(eq => eq.employee_id === e.id),
    }));
    setEmployees(enriched);
    setLoading(false);
  };

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.position||"").toLowerCase().includes(search.toLowerCase()) ||
    (e.dni||"").includes(search)
  );

  const prueba = employees.filter(e => isPrueba(e.hire_date)).length;

  useEffect(() => {
    if (selEmployee) {
      const updated = employees.find(e => e.id === selEmployee.id);
      if (updated) setSelEmployee(updated);
    }
  }, [employees]);

  if (selEmployee) {
    return <EmployeeDetail employee={selEmployee} fmt={fmt} config={config} userId={userId} onBack={() => setSelEmployee(null)} reload={loadEmployees} />;
  }

  return (
    <div style={{ padding:24, fontFamily:"'Instrument Sans', sans-serif" }}>
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20, flexWrap:"wrap" }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800 }}>👷 Nómina</div>
        <button className="btn btn-dark" style={{ marginLeft:"auto" }} onClick={() => setShowNew(true)}>+ Nuevo empleado</button>
      </div>

      <div style={{ display:"flex", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        {[
          { label:"Total empleados", value:employees.length },
          { label:"En período de prueba", value:prueba, color:prueba>0?"#854d0e":"#18181b" },
          { label:"Masa salarial", value:fmt(employees.reduce((a,e)=>a+Number(e.salary||0),0)), color:"#166534" },
        ].map((s,i) => (
          <div key={i} className="stat">
            <div style={{ fontSize:10, color:"#aaa", fontWeight:700, textTransform:"uppercase", letterSpacing:".07em" }}>{s.label}</div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, color:s.color||"#18181b", marginTop:2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <input className="field" style={{ marginBottom:14 }} placeholder="🔍 Buscar por nombre, puesto o DNI..." value={search} onChange={e => setSearch(e.target.value)} />

      {loading ? (
        <div style={{ textAlign:"center", padding:48, color:"#aaa" }}>Cargando...</div>
      ) : (
        <div className="card" style={{ padding:6 }}>
          {filtered.map(e => {
            const enPrueba = isPrueba(e.hire_date);
            const meses = monthsSince(e.hire_date);
            const pendTrainings = e.trainings.filter(t => t.expiry_date && new Date(t.expiry_date) < new Date()).length;
            const pendEquipment = e.equipment.filter(eq => eq.next_renewal && new Date(eq.next_renewal) < new Date()).length;
            return (
              <div key={e.id} className="row-h" style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px" }} onClick={() => setSelEmployee(e)}>
                <div style={{ width:42, height:42, borderRadius:"50%", background:`hsl(${e.id*67%360},55%,88%)`, color:`hsl(${e.id*67%360},55%,32%)`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:16, flexShrink:0 }}>{e.name[0]}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <div style={{ fontWeight:700, fontSize:14 }}>{e.name}</div>
                    {enPrueba && <span style={{ background:"#fef9c3", color:"#854d0e", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, border:"1px solid #fde047" }}>⏱ Período de prueba</span>}
                    {pendTrainings > 0 && <span style={{ background:"#fee2e2", color:"#7f1d1d", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>⚠️ Cap. vencida</span>}
                    {pendEquipment > 0 && <span style={{ background:"#fff7ed", color:"#c2410c", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>🔧 Equipo por renovar</span>}
                  </div>
                  <div style={{ fontSize:12, color:"#888", marginTop:2 }}>
                    {e.position || "Sin puesto"} · DNI: {e.dni || "—"} · {meses} {meses===1?"mes":"meses"} en la empresa
                  </div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontWeight:700, fontSize:14 }}>{fmt(e.salary||0)}</div>
                  <div style={{ fontSize:11, color:"#aaa" }}>por mes</div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div style={{ textAlign:"center", padding:28, color:"#aaa" }}>Sin empleados</div>}
        </div>
      )}

      {showNew && (
        <EmployeeModal
          onSave={async (form) => {
            await supabase.from("employees").insert({ ...form, empresa_id: userId });
            await loadEmployees();
            setShowNew(false);
          }}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

function EmployeeDetail({ employee: e, fmt, config, userId, onBack, reload }) {
  const [showEdit, setShowEdit] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showTraining, setShowTraining] = useState(false);
  const [showEquipment, setShowEquipment] = useState(false);
  const enPrueba = isPrueba(e.hire_date);
  const meses = monthsSince(e.hire_date);

  const deleteEmployee = async () => {
    if (!window.confirm("¿Eliminar empleado?")) return;
    await supabase.from("employees").delete().eq("id", e.id);
    onBack();
    reload();
  };

  return (
    <div style={{ padding:24, fontFamily:"'Instrument Sans', sans-serif" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        <button className="btn btn-outline btn-sm" onClick={onBack}>← Volver</button>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800 }}>{e.name}</div>
            {enPrueba && <span style={{ background:"#fef9c3", color:"#854d0e", fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, border:"1px solid #fde047" }}>⏱ Período de prueba ({meses} {meses===1?"mes":"meses"})</span>}
          </div>
          <div style={{ fontSize:13, color:"#888", marginTop:2 }}>{e.position || "Sin puesto"}</div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => setShowEdit(true)}>✏️ Editar</button>
        <button className="btn btn-outline btn-sm" style={{ color:"#ef4444", borderColor:"#fecaca" }} onClick={deleteEmployee}>🗑</button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"320px 1fr", gap:16, alignItems:"start" }}>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div className="card" style={{ padding:16 }}>
            <div className="sec">Datos personales</div>
            {[
              ["👤","DNI",e.dni||"—"],
              ["📱","Teléfono",e.phone||"—"],
              ["✉️","Email",e.email||"—"],
              ["📅","Ingreso",fmtDate(e.hire_date)],
              ["⏱","Antigüedad",`${meses} ${meses===1?"mes":"meses"}`],
              ["💰","Sueldo",fmt(e.salary||0)],
            ].map(([ic,label,val],i) => (
              <div key={i} style={{ display:"flex", gap:10, padding:"7px 0", borderBottom:"1px solid #f5f3ef", alignItems:"center" }}>
                <span style={{ fontSize:14, flexShrink:0 }}>{ic}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:"#aaa", fontWeight:600, textTransform:"uppercase" }}>{label}</div>
                  <div style={{ fontSize:13, marginTop:1 }}>{val}</div>
                </div>
              </div>
            ))}
            {e.notes && <div style={{ marginTop:10, fontSize:13, color:"#555", background:"#f8f7f4", borderRadius:8, padding:"8px 10px" }}>{e.notes}</div>}
          </div>

          <div className="card" style={{ padding:16 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <div className="sec" style={{ marginBottom:0 }}>Pagos ({e.payments.length})</div>
              <button className="btn btn-outline btn-sm" onClick={() => setShowPayment(true)}>+ Pago</button>
            </div>
            {e.payments.length === 0 && <div style={{ color:"#aaa", fontSize:13, textAlign:"center", padding:8 }}>Sin pagos</div>}
            {[...e.payments].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,5).map(p => (
              <div key={p.id} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid #f5f3ef", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{p.description||"Pago"}</div>
                  <div style={{ fontSize:11, color:"#aaa" }}>{fmtDate(p.date)}</div>
                </div>
                <div style={{ fontWeight:700, color:"#166534" }}>{fmt(p.amount)}</div>
              </div>
            ))}
            {e.payments.length > 0 && (
              <div style={{ marginTop:10, background:"#f0fdf4", borderRadius:8, padding:"8px 12px", display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:12, fontWeight:600, color:"#166534" }}>Total pagado</span>
                <span style={{ fontWeight:700, color:"#166534" }}>{fmt(e.payments.reduce((a,p)=>a+Number(p.amount),0))}</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div className="card" style={{ padding:16 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <div className="sec" style={{ marginBottom:0 }}>📚 Capacitaciones ({e.trainings.length})</div>
              <button className="btn btn-outline btn-sm" onClick={() => setShowTraining(true)}>+ Agregar</button>
            </div>
            {e.trainings.length === 0 && <div style={{ color:"#aaa", fontSize:13, textAlign:"center", padding:8 }}>Sin capacitaciones</div>}
            {e.trainings.map(t => {
              const vencida = t.expiry_date && new Date(t.expiry_date) < new Date();
              return (
                <div key={t.id} style={{ padding:"10px 12px", borderRadius:10, border:`1.5px solid ${vencida?"#fecaca":"#ede9e3"}`, marginBottom:8, background:vencida?"#fff5f5":"#fafaf8" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:13 }}>{t.type}</div>
                      <div style={{ fontSize:11, color:"#888", marginTop:2 }}>📅 Realizada: {fmtDate(t.date)}</div>
                      {t.expiry_date && <div style={{ fontSize:11, color:vencida?"#ef4444":"#888", marginTop:1 }}>⏰ Vence: {fmtDate(t.expiry_date)}</div>}
                      {t.notes && <div style={{ fontSize:11, color:"#666", marginTop:4, fontStyle:"italic" }}>{t.notes}</div>}
                    </div>
                    {vencida && <span style={{ background:"#fee2e2", color:"#7f1d1d", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>Vencida</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card" style={{ padding:16 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <div className="sec" style={{ marginBottom:0 }}>🦺 Elementos de seguridad ({e.equipment.length})</div>
              <button className="btn btn-outline btn-sm" onClick={() => setShowEquipment(true)}>+ Agregar</button>
            </div>
            {e.equipment.length === 0 && <div style={{ color:"#aaa", fontSize:13, textAlign:"center", padding:8 }}>Sin elementos registrados</div>}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {e.equipment.map(eq => {
                const vence = eq.next_renewal && new Date(eq.next_renewal) < new Date();
                return (
                  <div key={eq.id} style={{ padding:"10px 12px", borderRadius:10, border:`1.5px solid ${vence?"#fecaca":"#ede9e3"}`, background:vence?"#fff5f5":"#fafaf8" }}>
                    <div style={{ fontWeight:600, fontSize:13, marginBottom:4 }}>{eq.item}</div>
                    <div style={{ fontSize:11, color:"#888" }}>Entrega: {fmtDate(eq.delivery_date)}</div>
                    {eq.next_renewal && <div style={{ fontSize:11, color:vence?"#ef4444":"#888", marginTop:1 }}>Renovar: {fmtDate(eq.next_renewal)}</div>}
                    {vence && <span style={{ background:"#fee2e2", color:"#7f1d1d", fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:20, marginTop:4, display:"inline-block" }}>Por renovar</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showEdit && (
        <EmployeeModal
          employee={e}
          onSave={async (form) => {
            await supabase.from("employees").update(form).eq("id", e.id);
            await reload();
            setShowEdit(false);
          }}
          onClose={() => setShowEdit(false)}
        />
      )}
      {showPayment && (
        <PaymentModal
          onSave={async (form) => {
            await supabase.from("employee_payments").insert({ ...form, employee_id: e.id, empresa_id: userId });
            await reload();
            setShowPayment(false);
          }}
          onClose={() => setShowPayment(false)}
        />
      )}
      {showTraining && (
        <TrainingModal
          onSave={async (form) => {
            await supabase.from("employee_trainings").insert({ ...form, employee_id: e.id, empresa_id: userId });
            await reload();
            setShowTraining(false);
          }}
          onClose={() => setShowTraining(false)}
        />
      )}
      {showEquipment && (
        <EquipmentModal
          onSave={async (form) => {
            await supabase.from("employee_equipment").insert({ ...form, employee_id: e.id, empresa_id: userId });
            await reload();
            setShowEquipment(false);
          }}
          onClose={() => setShowEquipment(false)}
        />
      )}
    </div>
  );
}

function EmployeeModal({ employee, onSave, onClose }) {
  const [form, setForm] = useState({
    name: employee?.name || "", dni: employee?.dni || "", position: employee?.position || "",
    hire_date: employee?.hire_date || "", salary: employee?.salary || "",
    phone: employee?.phone || "", email: employee?.email || "", notes: employee?.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const enPrueba = isPrueba(form.hire_date);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth:520 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800, marginBottom:18 }}>
          {employee ? "Editar empleado" : "Nuevo empleado"}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Nombre completo *</label>
            <input className="field" placeholder="Juan Pérez" value={form.name} onChange={e => set("name", e.target.value)} autoFocus />
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>DNI</label>
            <input className="field" placeholder="12345678" value={form.dni} onChange={e => set("dni", e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Puesto / Cargo</label>
            <input className="field" placeholder="Operario" value={form.position} onChange={e => set("position", e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Fecha de ingreso</label>
            <input className="field" type="date" value={form.hire_date} onChange={e => set("hire_date", e.target.value)} />
            {enPrueba && <div style={{ fontSize:11, color:"#854d0e", fontWeight:600, marginTop:4 }}>⏱ En período de prueba</div>}
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Sueldo mensual</label>
            <input className="field" type="number" placeholder="0" value={form.salary} onChange={e => set("salary", e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Teléfono</label>
            <input className="field" placeholder="11 1234-5678" value={form.phone} onChange={e => set("phone", e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Email</label>
            <input className="field" type="email" placeholder="juan@email.com" value={form.email} onChange={e => set("email", e.target.value)} />
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Notas</label>
            <textarea className="field" rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} style={{ resize:"none" }} />
          </div>
        </div>
        <div style={{ display:"flex", gap:8, marginTop:18, justifyContent:"flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-dark" disabled={saving} onClick={async () => {
            if (!form.name) return;
            setSaving(true);
            await onSave({ ...form, salary: Number(form.salary)||0 });
            setSaving(false);
          }}>{saving?"Guardando...":"Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

function PaymentModal({ onSave, onClose }) {
  const [form, setForm] = useState({ amount:"", date:todayStr(), description:"Sueldo mensual" });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth:380 }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:17, fontWeight:800, marginBottom:14 }}>Registrar pago</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <input className="field" placeholder="Descripción" value={form.description} onChange={e=>set("description",e.target.value)} />
          <input className="field" type="number" placeholder="Monto *" value={form.amount} onChange={e=>set("amount",e.target.value)} />
          <input className="field" type="date" value={form.date} onChange={e=>set("date",e.target.value)} />
        </div>
        <div style={{ display:"flex", gap:8, marginTop:14, justifyContent:"flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-green" disabled={saving} onClick={async()=>{
            if(!form.amount)return;
            setSaving(true);
            await onSave({...form, amount:Number(form.amount)});
            setSaving(false);
          }}>{saving?"Guardando...":"Registrar"}</button>
        </div>
      </div>
    </div>
  );
}

function TrainingModal({ onSave, onClose }) {
  const [form, setForm] = useState({ type:"", date:todayStr(), expiry_date:"", notes:"" });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth:420 }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:17, fontWeight:800, marginBottom:14 }}>📚 Nueva capacitación</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Tipo *</label>
            <select className="field" value={form.type} onChange={e=>set("type",e.target.value)}>
              <option value="">— Seleccionar —</option>
              {TRAINING_TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Fecha realizada</label>
              <input className="field" type="date" value={form.date} onChange={e=>set("date",e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Fecha de vencimiento</label>
              <input className="field" type="date" value={form.expiry_date} onChange={e=>set("expiry_date",e.target.value)} />
            </div>
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Notas</label>
            <textarea className="field" rows={2} value={form.notes} onChange={e=>set("notes",e.target.value)} style={{ resize:"none" }} />
          </div>
        </div>
        <div style={{ display:"flex", gap:8, marginTop:14, justifyContent:"flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-dark" disabled={saving} onClick={async()=>{
            if(!form.type)return;
            setSaving(true);
            await onSave({...form, expiry_date:form.expiry_date||null});
            setSaving(false);
          }}>{saving?"Guardando...":"Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

function EquipmentModal({ onSave, onClose }) {
  const [form, setForm] = useState({ item:"", delivery_date:todayStr(), next_renewal:"", notes:"" });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth:420 }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:17, fontWeight:800, marginBottom:14 }}>🦺 Elemento de seguridad</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Elemento *</label>
            <select className="field" value={form.item} onChange={e=>set("item",e.target.value)}>
              <option value="">— Seleccionar —</option>
              {EQUIPMENT_TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Fecha de entrega</label>
              <input className="field" type="date" value={form.delivery_date} onChange={e=>set("delivery_date",e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Próxima renovación</label>
              <input className="field" type="date" value={form.next_renewal} onChange={e=>set("next_renewal",e.target.value)} />
            </div>
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Notas</label>
            <textarea className="field" rows={2} value={form.notes} onChange={e=>set("notes",e.target.value)} style={{ resize:"none" }} />
          </div>
        </div>
        <div style={{ display:"flex", gap:8, marginTop:14, justifyContent:"flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-dark" disabled={saving} onClick={async()=>{
            if(!form.item)return;
            setSaving(true);
            await onSave({...form, next_renewal:form.next_renewal||null});
            setSaving(false);
          }}>{saving?"Guardando...":"Guardar"}</button>
        </div>
      </div>
    </div>
  );
}