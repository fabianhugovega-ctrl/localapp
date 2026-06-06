import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import { exportTransporte } from "./exportExcel.js";

const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const fmtDate = (d) => { if(!d) return "—"; const [y,m,day]=d.split("-"); return `${day}/${m}/${y}`; };
const fmtDateTime = (d) => { if(!d) return "—"; const dt=new Date(d); return `${pad(dt.getDate())}/${pad(dt.getMonth()+1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`; };
const nroViaje = () => `VJ-${Date.now().toString().slice(-6)}`;
const daysUntil = (dateStr) => { if(!dateStr) return null; return Math.ceil((new Date(dateStr)-new Date())/(1000*60*60*24)); };

const TRIP_STATUS = {
  pendiente:   { bg:"#fef9c3", text:"#854d0e", label:"Pendiente" },
  en_camino:   { bg:"#dbeafe", text:"#1d4ed8", label:"En camino" },
  entregado:   { bg:"#dcfce7", text:"#166534", label:"Entregado" },
  con_novedad: { bg:"#fee2e2", text:"#7f1d1d", label:"Con novedad" },
  cancelado:   { bg:"#f3f4f6", text:"#6b7280", label:"Cancelado" },
};

const EXPENSE_TYPES = ["Combustible","Peaje","Comida","Alojamiento","Reparación","Lavado","Multa","Otro"];

const TRUCK_BRANDS = ["Mercedes-Benz","Scania","Volvo","Iveco","Ford","Volkswagen","Renault","DAF","MAN","Fiat","Toyota","Chevrolet","Otro"];

const MAINTENANCE_TYPES = [
  "Cambio de aceite","Filtro de aceite","Filtro de aire","Filtro de combustible",
  "Correa de distribución","Pastillas de freno","Discos de freno","Neumáticos",
  "Batería","Bujías","Embrague","Revisión general","Service programado","Otro"
];

const CHECK_ITEMS = [
  { key:"check_neumaticos", label:"Neumáticos", icon:"🔵" },
  { key:"check_frenos", label:"Frenos", icon:"🔴" },
  { key:"check_luces", label:"Luces", icon:"💡" },
  { key:"check_agua", label:"Agua/Refrigerante", icon:"💧" },
  { key:"check_aceite", label:"Aceite", icon:"🛢️" },
  { key:"check_limpieza", label:"Limpieza", icon:"🧹" },
  { key:"check_documentacion", label:"Documentación", icon:"📋" },
];

const CHECK_OPTIONS = [
  { value:"ok", label:"OK", bg:"#dcfce7", text:"#166534" },
  { value:"regular", label:"Regular", bg:"#fef9c3", text:"#854d0e" },
  { value:"mal", label:"Mal", bg:"#fee2e2", text:"#7f1d1d" },
];

export default function Transporte({ clients=[], config={}, userId }) {
  const fmt = (n) => `${config.moneda||"$"}${Number(n).toLocaleString("es-AR")}`;
  const [tab, setTab] = useState("viajes");
  const [trips, setTrips] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [partes, setPartes] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selTrip, setSelTrip] = useState(null);
  const [showNewTrip, setShowNewTrip] = useState(false);
  const [showNewDriver, setShowNewDriver] = useState(false);
  const [showNewVehicle, setShowNewVehicle] = useState(false);
  const [editDriver, setEditDriver] = useState(null);
  const [editVehicle, setEditVehicle] = useState(null);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  useEffect(() => { if(userId) loadAll(); }, [userId]);

  const loadAll = async () => {
    setLoading(true);
    const [t, d, v, p, m] = await Promise.all([
      supabase.from("trips").select("*").eq("empresa_id",userId).order("date",{ascending:false}),
      supabase.from("drivers").select("*").eq("empresa_id",userId).order("name"),
      supabase.from("vehicles").select("*").eq("empresa_id",userId).order("plate"),
      supabase.from("trip_partes").select("*").eq("empresa_id",userId).order("fecha",{ascending:false}),
      supabase.from("vehicle_maintenance").select("*").eq("empresa_id",userId).order("date",{ascending:false}),
    ]);
    const tripIds = (t.data||[]).map(tr=>tr.id);
    let expenses=[], novedades=[];
    if(tripIds.length>0) {
      const [exp,nov] = await Promise.all([
        supabase.from("trip_expenses").select("*").in("trip_id",tripIds),
        supabase.from("trip_novedades").select("*").in("trip_id",tripIds).order("fecha",{ascending:false}),
      ]);
      expenses=exp.data||[]; novedades=nov.data||[];
    }
    setTrips((t.data||[]).map(tr=>({...tr, expenses:expenses.filter(e=>e.trip_id===tr.id), novedades:novedades.filter(n=>n.trip_id===tr.id)})));
    setDrivers(d.data||[]); setVehicles(v.data||[]); setPartes(p.data||[]); setMaintenance(m.data||[]);
    setLoading(false);
  };

  const alertas = [
    ...vehicles.flatMap(v=>[
      v.insurance_expiry&&daysUntil(v.insurance_expiry)<=30?{msg:`Seguro de ${v.plate} vence en ${daysUntil(v.insurance_expiry)} días`,color:"#854d0e"}:null,
      v.vtv_expiry&&daysUntil(v.vtv_expiry)<=30?{msg:`VTV de ${v.plate} vence en ${daysUntil(v.vtv_expiry)} días`,color:"#854d0e"}:null,
      v.habilitacion_expiry&&daysUntil(v.habilitacion_expiry)<=30?{msg:`Habilitación de ${v.plate} vence en ${daysUntil(v.habilitacion_expiry)} días`,color:"#7f1d1d"}:null,
    ].filter(Boolean)),
    ...drivers.flatMap(d=>[
      d.license_expiry&&daysUntil(d.license_expiry)<=30?{msg:`Licencia de ${d.name} vence en ${daysUntil(d.license_expiry)} días`,color:"#7f1d1d"}:null,
    ].filter(Boolean)),
    ...maintenance.filter(m=>m.next_service_date&&daysUntil(m.next_service_date)<=30).map(m=>{
      const veh=vehicles.find(v=>v.id===m.vehicle_id);
      return {msg:`${m.type} de ${veh?.plate||"vehículo"} vence en ${daysUntil(m.next_service_date)} días`,color:"#854d0e"};
    }),
  ];

  const filteredTrips = trips.filter(t=>{
    const ms=(t.origin||"").toLowerCase().includes(search.toLowerCase())||(t.destination||"").toLowerCase().includes(search.toLowerCase())||(t.client_name||"").toLowerCase().includes(search.toLowerCase())||(t.nro||"").toLowerCase().includes(search.toLowerCase());
    const mf=filterStatus==="todos"||t.status===filterStatus;
    const mfd=desde?t.date>=desde:true;
    const mfh=hasta?t.date<=hasta:true;
    return ms&&mf&&mfd&&mfh;
  });

  const totalFacturado=trips.reduce((a,t)=>a+Number(t.rate||0),0);
  const totalGastos=trips.reduce((a,t)=>a+(t.expenses||[]).reduce((b,e)=>b+Number(e.amount||0),0),0);
  const enCamino=trips.filter(t=>t.status==="en_camino").length;
  const totalKm=partes.reduce((a,p)=>a+Number(p.km_recorridos||0),0);

  if(selTrip) {
    const updated=trips.find(t=>t.id===selTrip.id)||selTrip;
    return <TripDetail trip={updated} drivers={drivers} vehicles={vehicles} clients={clients} config={config} fmt={fmt} userId={userId} onBack={()=>setSelTrip(null)} reload={loadAll}/>;
  }

  return (
    <div style={{padding:24,fontFamily:"'Instrument Sans',sans-serif"}}>
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16,flexWrap:"wrap"}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800}}>🚛 Transporte</div>
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          {tab==="viajes"&&<button className="btn btn-dark" onClick={()=>setShowNewTrip(true)}>+ Nuevo viaje</button>}
          {tab==="choferes"&&<button className="btn btn-dark" onClick={()=>setShowNewDriver(true)}>+ Nuevo chofer</button>}
          {tab==="vehiculos"&&<button className="btn btn-dark" onClick={()=>setShowNewVehicle(true)}>+ Nuevo vehículo</button>}
        </div>
      </div>

      {alertas.map((a,i)=>(
        <div key={i} style={{background:"#fff7ed",border:"1.5px solid #fed7aa",borderRadius:10,padding:"8px 14px",fontSize:12,color:a.color,fontWeight:600,marginBottom:8,display:"flex",gap:8}}>⚠️ {a.msg}</div>
      ))}

      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:16}}>
        {[
          {label:"Viajes totales",value:trips.length},
          {label:"En camino",value:enCamino,color:enCamino>0?"#1d4ed8":"#18181b"},
          {label:"KM totales",value:totalKm>0?`${totalKm.toLocaleString("es-AR")} km`:"—"},
          {label:"Facturado",value:fmt(totalFacturado),color:"#166534"},
          {label:"Ganancia neta",value:fmt(totalFacturado-totalGastos),color:totalFacturado-totalGastos>=0?"#166534":"#7f1d1d"},
        ].map((s,i)=>(
          <div key={i} className="stat" style={{padding:"12px 14px"}}>
            <div style={{fontSize:9,color:"#aaa",fontWeight:700,textTransform:"uppercase",letterSpacing:".07em"}}>{s.label}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,color:s.color||"#18181b",marginTop:2}}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:4,background:"#f5f3ef",borderRadius:10,padding:4,marginBottom:16,width:"fit-content",flexWrap:"wrap"}}>
        {[["viajes","🚛 Viajes"],["parte","📋 Parte diario"],["choferes","👤 Choferes"],["vehiculos","🚚 Vehículos"],["mantenimiento","🔧 Mantenimiento"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{padding:"6px 14px",borderRadius:7,cursor:"pointer",fontSize:12,fontWeight:600,border:"none",background:tab===k?"#fff":"transparent",color:tab===k?"#18181b":"#888",fontFamily:"inherit",boxShadow:tab===k?"0 1px 4px rgba(0,0,0,.08)":"none"}}>{l}</button>
        ))}
      </div>

      {tab==="viajes"&&(
        <>
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
            <input className="field" style={{flex:1,minWidth:180}} placeholder="🔍 Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
            <input type="date" className="field" style={{width:130,padding:"5px 8px",fontSize:12}} value={desde} onChange={e=>setDesde(e.target.value)}/>
            <input type="date" className="field" style={{width:130,padding:"5px 8px",fontSize:12}} value={hasta} onChange={e=>setHasta(e.target.value)}/>
            <button className="btn btn-outline btn-sm" onClick={()=>exportTransporte(filteredTrips,drivers,vehicles,config.moneda,desde,hasta)}>📊 Excel</button>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {[["todos","Todos"],...Object.entries(TRIP_STATUS).map(([k,v])=>[k,v.label])].map(([k,l])=>(
                <button key={k} onClick={()=>setFilterStatus(k)} style={{padding:"4px 10px",borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:600,border:"1.5px solid",borderColor:filterStatus===k?"#18181b":"#e2dfd8",background:filterStatus===k?"#18181b":"#fff",color:filterStatus===k?"#fff":"#555",fontFamily:"inherit"}}>{l}</button>
              ))}
            </div>
          </div>
          {loading?<div style={{textAlign:"center",padding:48,color:"#aaa"}}>Cargando...</div>:(
            <div className="card" style={{padding:6}}>
              {filteredTrips.map(t=>{
                const st=TRIP_STATUS[t.status]||TRIP_STATUS.pendiente;
                const driver=drivers.find(d=>d.id===t.driver_id);
                const vehicle=vehicles.find(v=>v.id===t.vehicle_id);
                const gastos=(t.expenses||[]).reduce((a,e)=>a+Number(e.amount||0),0);
                const novCount=(t.novedades||[]).length;
                const kmViaje=partes.filter(p=>p.trip_id===t.id).reduce((a,p)=>a+Number(p.km_recorridos||0),0);
                return (
                  <div key={t.id} className="row-h" style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px"}} onClick={()=>setSelTrip(t)}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:3}}>
                        <div style={{fontWeight:700,fontSize:14}}>{t.origin} → {t.destination}</div>
                        <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:st.bg,color:st.text}}>{st.label}</span>
                        {novCount>0&&<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:"#fef9c3",color:"#854d0e"}}>📋 {novCount} novedad{novCount>1?"es":""}</span>}
                      </div>
                      <div style={{fontSize:11,color:"#888"}}>{fmtDate(t.date)} · {t.client_name||"Sin cliente"} · {driver?.name||"Sin chofer"} · {vehicle?.plate||"Sin vehículo"}{kmViaje>0?` · ${kmViaje.toLocaleString("es-AR")} km`:""}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontWeight:700,fontSize:14,color:"#166534"}}>{fmt(t.rate||0)}</div>
                      {gastos>0&&<div style={{fontSize:11,color:"#ef4444"}}>-{fmt(gastos)}</div>}
                    </div>
                  </div>
                );
              })}
              {filteredTrips.length===0&&<div style={{textAlign:"center",padding:28,color:"#aaa"}}>Sin viajes</div>}
            </div>
          )}
        </>
      )}

      {tab==="parte"&&<ParteDiario trips={trips} drivers={drivers} vehicles={vehicles} partes={partes} userId={userId} fmt={fmt} reload={loadAll}/>}

      {tab==="choferes"&&(
        <div className="card" style={{padding:6}}>
          {drivers.map(d=>{
            const licDays=daysUntil(d.license_expiry);
            const vencida=licDays!==null&&licDays<=0;
            const porVencer=licDays!==null&&licDays>0&&licDays<=30;
            const kmChofer=partes.filter(p=>p.driver_id===d.id).reduce((a,p)=>a+Number(p.km_recorridos||0),0);
            return (
              <div key={d.id} className="row-h" style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px"}}>
                <div style={{width:42,height:42,borderRadius:"50%",background:`hsl(${d.id*67%360},55%,88%)`,color:`hsl(${d.id*67%360},55%,32%)`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:16,flexShrink:0}}>{d.name[0]}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <div style={{fontWeight:700,fontSize:14}}>{d.name}</div>
                    {vencida&&<span style={{background:"#fee2e2",color:"#7f1d1d",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20}}>🚫 Licencia vencida</span>}
                    {porVencer&&<span style={{background:"#fef9c3",color:"#854d0e",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20}}>⚠️ Por vencer</span>}
                  </div>
                  <div style={{fontSize:11,color:"#888",marginTop:2}}>DNI: {d.dni||"—"} · Tel: {d.phone||"—"} · Lic: {fmtDate(d.license_expiry)}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontWeight:700,fontSize:13}}>{trips.filter(t=>t.driver_id===d.id).length} viajes</div>
                  {kmChofer>0&&<div style={{fontSize:11,color:"#888"}}>{kmChofer.toLocaleString("es-AR")} km</div>}
                </div>
                <button className="btn btn-outline btn-sm" onClick={e=>{e.stopPropagation();setEditDriver(d);}}>✏️</button>
                <button className="btn btn-outline btn-sm" style={{color:"#ef4444",borderColor:"#fecaca"}} onClick={async e=>{e.stopPropagation();if(!window.confirm("¿Eliminar chofer?"))return;await supabase.from("drivers").delete().eq("id",d.id);loadAll();}}>🗑</button>
              </div>
            );
          })}
          {drivers.length===0&&<div style={{textAlign:"center",padding:28,color:"#aaa"}}>Sin choferes</div>}
        </div>
      )}

      {tab==="vehiculos"&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(300px,1fr))",gap:12}}>
          {vehicles.map(v=>{
            const alerts=[
              v.insurance_expiry&&daysUntil(v.insurance_expiry)<=30?`Seguro vence ${fmtDate(v.insurance_expiry)}`:null,
              v.vtv_expiry&&daysUntil(v.vtv_expiry)<=30?`VTV vence ${fmtDate(v.vtv_expiry)}`:null,
              v.habilitacion_expiry&&daysUntil(v.habilitacion_expiry)<=30?`Habilitación vence ${fmtDate(v.habilitacion_expiry)}`:null,
            ].filter(Boolean);
            const kmVehiculo=partes.filter(p=>p.vehicle_id===v.id).reduce((a,p)=>a+Number(p.km_recorridos||0),0);
            return (
              <div key={v.id} className="card" style={{padding:16}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
                  <div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800}}>{v.plate}</div>
                    <div style={{fontSize:13,color:"#555",marginTop:2}}>{v.brand} {v.model} {v.year||""}</div>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:v.active?"#dcfce7":"#fee2e2",color:v.active?"#166534":"#7f1d1d"}}>{v.active?"Activo":"Inactivo"}</span>
                    <button className="btn btn-outline btn-sm" onClick={()=>setEditVehicle(v)}>✏️</button>
                  </div>
                </div>
                {[["🛡️","Seguro",fmtDate(v.insurance_expiry)],["🔧","VTV",fmtDate(v.vtv_expiry)],["📋","Habilitación",fmtDate(v.habilitacion_expiry)]].map(([ic,l,val],i)=>(
                  <div key={i} style={{display:"flex",gap:8,fontSize:12,padding:"4px 0",borderBottom:"1px solid #f5f3ef"}}>
                    <span>{ic}</span><span style={{color:"#888",flex:1}}>{l}</span><span style={{fontWeight:600}}>{val}</span>
                  </div>
                ))}
                {kmVehiculo>0&&<div style={{marginTop:8,fontSize:12,color:"#555"}}>🛣️ {kmVehiculo.toLocaleString("es-AR")} km recorridos</div>}
                {alerts.map((a,i)=><div key={i} style={{marginTop:6,fontSize:11,color:"#854d0e",fontWeight:600,background:"#fff7ed",borderRadius:6,padding:"4px 8px"}}>⚠️ {a}</div>)}
              </div>
            );
          })}
          {vehicles.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:28,color:"#aaa"}}>Sin vehículos</div>}
        </div>
      )}

      {tab==="mantenimiento"&&<Mantenimiento vehicles={vehicles} maintenance={maintenance} userId={userId} fmt={fmt} reload={loadAll}/>}

      {showNewTrip&&<TripModal drivers={drivers} vehicles={vehicles} clients={clients} onSave={async(form)=>{await supabase.from("trips").insert({...form,empresa_id:userId,nro:nroViaje()});await loadAll();setShowNewTrip(false);}} onClose={()=>setShowNewTrip(false)}/>}
      {showNewDriver&&<DriverModal onSave={async(form)=>{await supabase.from("drivers").insert({...form,empresa_id:userId});await loadAll();setShowNewDriver(false);}} onClose={()=>setShowNewDriver(false)}/>}
      {showNewVehicle&&<VehicleModal onSave={async(form)=>{await supabase.from("vehicles").insert({...form,empresa_id:userId});await loadAll();setShowNewVehicle(false);}} onClose={()=>setShowNewVehicle(false)}/>}
      {editDriver&&<DriverModal driver={editDriver} onSave={async(form)=>{await supabase.from("drivers").update(form).eq("id",editDriver.id);await loadAll();setEditDriver(null);}} onClose={()=>setEditDriver(null)}/>}
      {editVehicle&&<VehicleModal vehicle={editVehicle} onSave={async(form)=>{await supabase.from("vehicles").update(form).eq("id",editVehicle.id);await loadAll();setEditVehicle(null);}} onClose={()=>setEditVehicle(null)}/>}
    </div>
  );
}

function ParteDiario({ trips, drivers, vehicles, partes, userId, fmt, reload }) {
  const [selDriver, setSelDriver] = useState("");
  const [selVehicle, setSelVehicle] = useState("");
  const [selTripId, setSelTripId] = useState("");
  const [fecha, setFecha] = useState(todayStr());
  const [form, setForm] = useState({
    km_inicio:"", km_fin:"",
    combustible_litros:"", combustible_precio:"",
    check_neumaticos:"ok", check_frenos:"ok", check_luces:"ok",
    check_agua:"ok", check_aceite:"ok", check_limpieza:"ok", check_documentacion:"ok",
    observaciones:"",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selParte, setSelParte] = useState(null);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const km_rec = form.km_fin&&form.km_inicio ? Number(form.km_fin)-Number(form.km_inicio) : 0;
  const comb_total = form.combustible_litros&&form.combustible_precio ? Number(form.combustible_litros)*Number(form.combustible_precio) : 0;

  const viajesDisponibles = trips.filter(t=>
    t.date<=fecha&&(t.status==="en_camino"||t.status==="pendiente")&&
    (selDriver===""||String(t.driver_id)===String(selDriver))
  );

  const guardarParte = async () => {
    if(!selDriver) return;
    setSaving(true);
    await supabase.from("trip_partes").insert({
      empresa_id:userId, trip_id:selTripId?Number(selTripId):null,
      driver_id:Number(selDriver), vehicle_id:selVehicle?Number(selVehicle):null,
      fecha, km_inicio:Number(form.km_inicio)||null, km_fin:Number(form.km_fin)||null,
      km_recorridos:km_rec||null, combustible_litros:Number(form.combustible_litros)||null,
      combustible_precio:Number(form.combustible_precio)||null, combustible_total:comb_total||null,
      check_neumaticos:form.check_neumaticos, check_frenos:form.check_frenos,
      check_luces:form.check_luces, check_agua:form.check_agua, check_aceite:form.check_aceite,
      check_limpieza:form.check_limpieza, check_documentacion:form.check_documentacion,
      observaciones:form.observaciones||null,
    });
    if(selTripId&&km_rec>0) await supabase.from("trips").update({km_recorridos:km_rec}).eq("id",Number(selTripId));
    await reload();
    setSaving(false); setSaved(true);
    setTimeout(()=>setSaved(false),3000);
  };

  const historial = [...partes].sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||"")).slice(0,10);
  const hasAlert = CHECK_ITEMS.some(item=>form[item.key]==="mal");

  return (
    <>
      <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:16,alignItems:"start"}}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div className="card" style={{padding:16}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:800,marginBottom:14}}>📋 Parte diario</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Fecha</label><input className="field" type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></div>
              <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Chofer *</label>
                <select className="field" value={selDriver} onChange={e=>setSelDriver(e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  {drivers.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Unidad / Vehículo</label>
                <select className="field" value={selVehicle} onChange={e=>setSelVehicle(e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  {vehicles.map(v=><option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>)}
                </select>
              </div>
              <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Viaje (opcional)</label>
                <select className="field" value={selTripId} onChange={e=>setSelTripId(e.target.value)}>
                  <option value="">— Sin viaje —</option>
                  {viajesDisponibles.map(t=><option key={t.id} value={t.id}>{t.nro} — {t.origin} → {t.destination}</option>)}
                </select>
              </div>
            </div>
            <div className="sec">🛣️ Kilómetros</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>KM inicio</label><input className="field" type="number" placeholder="Ej: 150000" value={form.km_inicio} onChange={e=>set("km_inicio",e.target.value)}/></div>
              <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>KM fin</label><input className="field" type="number" placeholder="Ej: 151500" value={form.km_fin} onChange={e=>set("km_fin",e.target.value)}/></div>
            </div>
            {km_rec>0&&<div style={{background:"#eff6ff",border:"1.5px solid #93c5fd",borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:12,color:"#555"}}>KM recorridos</span><span style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,color:"#1d4ed8"}}>{km_rec.toLocaleString("es-AR")} km</span></div>}
            <div className="sec">⛽ Combustible</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Litros cargados</label><input className="field" type="number" placeholder="0" value={form.combustible_litros} onChange={e=>set("combustible_litros",e.target.value)}/></div>
              <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Precio por litro</label><input className="field" type="number" placeholder="0" value={form.combustible_precio} onChange={e=>set("combustible_precio",e.target.value)}/></div>
            </div>
            {comb_total>0&&<div style={{background:"#fff7ed",border:"1.5px solid #fed7aa",borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:12,color:"#555"}}>Total combustible</span><span style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,color:"#854d0e"}}>{fmt(comb_total)}</span></div>}
          </div>
          <div className="card" style={{padding:16}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
              <div className="sec" style={{marginBottom:0}}>✅ Checklist pre-viaje</div>
              {hasAlert&&<span style={{background:"#fee2e2",color:"#7f1d1d",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20}}>⚠️ Ítems en mal estado</span>}
            </div>
            {CHECK_ITEMS.map(item=>(
              <div key={item.key} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:"1px solid #f5f3ef"}}>
                <span style={{fontSize:18,flexShrink:0}}>{item.icon}</span>
                <span style={{fontSize:13,fontWeight:600,flex:1}}>{item.label}</span>
                <div style={{display:"flex",gap:4}}>
                  {CHECK_OPTIONS.map(opt=>(
                    <button key={opt.value} onClick={()=>set(item.key,opt.value)} style={{padding:"4px 10px",borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:700,border:`1.5px solid ${form[item.key]===opt.value?opt.text:"#e2dfd8"}`,background:form[item.key]===opt.value?opt.bg:"#fff",color:form[item.key]===opt.value?opt.text:"#888",fontFamily:"inherit"}}>{opt.label}</button>
                  ))}
                </div>
              </div>
            ))}
            <div style={{marginTop:12}}><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Observaciones</label><textarea className="field" rows={3} placeholder="Notas adicionales..." value={form.observaciones} onChange={e=>set("observaciones",e.target.value)} style={{resize:"none"}}/></div>
            <button className="btn btn-dark" style={{width:"100%",marginTop:14,padding:"12px"}} disabled={saving||!selDriver} onClick={guardarParte}>
              {saving?"Guardando...":saved?"✅ Parte guardado":"Guardar parte diario"}
            </button>
          </div>
        </div>
        <div className="card" style={{padding:16}}>
          <div className="sec">Historial de partes</div>
          {historial.length===0&&<div style={{textAlign:"center",padding:24,color:"#aaa"}}>Sin partes registrados</div>}
          {historial.map(p=>{
            const driver=drivers.find(d=>d.id===p.driver_id);
            const vehicle=vehicles.find(v=>v.id===p.vehicle_id);
            const tieneAlerta=CHECK_ITEMS.some(item=>p[item.key]==="mal");
            return (
              <div key={p.id} onClick={()=>setSelParte(p)} style={{padding:"10px 12px",borderRadius:10,border:`1.5px solid ${tieneAlerta?"#fecaca":"#ede9e3"}`,marginBottom:8,background:tieneAlerta?"#fff5f5":"#fafaf8",cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div style={{fontWeight:600,fontSize:13}}>{driver?.name||"—"}</div>
                  <div style={{fontSize:11,color:"#888"}}>{fmtDate(p.fecha)}</div>
                </div>
                <div style={{fontSize:11,color:"#888"}}>{vehicle?.plate||"Sin unidad"}</div>
                {p.km_recorridos>0&&<div style={{fontSize:11,color:"#555",marginTop:4}}>🛣️ {Number(p.km_recorridos).toLocaleString("es-AR")} km</div>}
                {p.combustible_litros>0&&<div style={{fontSize:11,color:"#555"}}>⛽ {p.combustible_litros}L — {fmt(p.combustible_total||0)}</div>}
                {tieneAlerta&&<div style={{fontSize:11,color:"#7f1d1d",fontWeight:600,marginTop:4}}>⚠️ Ítems en mal estado</div>}
              </div>
            );
          })}
        </div>
      </div>
      {selParte&&(
        <div className="modal-bg" onClick={()=>setSelParte(null)}>
          <div className="modal" style={{maxWidth:500}} onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:800,marginBottom:4}}>Parte — {drivers.find(d=>d.id===selParte.driver_id)?.name||"—"}</div>
            <div style={{fontSize:12,color:"#888",marginBottom:14}}>{fmtDate(selParte.fecha)} · {vehicles.find(v=>v.id===selParte.vehicle_id)?.plate||"Sin unidad"}</div>
            {selParte.km_recorridos>0&&<div style={{background:"#eff6ff",borderRadius:10,padding:"10px 14px",marginBottom:10,display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13,color:"#555"}}>KM recorridos</span><span style={{fontWeight:700,color:"#1d4ed8"}}>{Number(selParte.km_recorridos).toLocaleString("es-AR")} km</span></div>}
            {selParte.combustible_litros>0&&<div style={{background:"#fff7ed",borderRadius:10,padding:"10px 14px",marginBottom:10,display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13,color:"#555"}}>Combustible</span><span style={{fontWeight:700,color:"#854d0e"}}>{selParte.combustible_litros}L — {fmt(selParte.combustible_total||0)}</span></div>}
            <div className="sec" style={{marginTop:10}}>Checklist</div>
            {CHECK_ITEMS.map(item=>{
              const val=selParte[item.key];
              const opt=CHECK_OPTIONS.find(o=>o.value===val)||CHECK_OPTIONS[0];
              return (
                <div key={item.key} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:"1px solid #f5f3ef"}}>
                  <span style={{fontSize:16}}>{item.icon}</span>
                  <span style={{fontSize:13,flex:1}}>{item.label}</span>
                  <span style={{fontSize:11,fontWeight:700,padding:"2px 10px",borderRadius:20,background:opt.bg,color:opt.text}}>{opt.label}</span>
                </div>
              );
            })}
            {selParte.observaciones&&<div style={{marginTop:12,background:"#f8f7f4",borderRadius:8,padding:"10px 12px",fontSize:13,color:"#555",fontStyle:"italic"}}>{selParte.observaciones}</div>}
            <button className="btn btn-outline" style={{width:"100%",marginTop:16}} onClick={()=>setSelParte(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </>
  );
}

function Mantenimiento({ vehicles, maintenance, userId, fmt, reload }) {
  const [showNew, setShowNew] = useState(false);
  const [filterVehicle, setFilterVehicle] = useState("todos");
  const filtered = maintenance.filter(m=>filterVehicle==="todos"||String(m.vehicle_id)===String(filterVehicle));
  const proximos = maintenance.filter(m=>(m.next_service_date&&daysUntil(m.next_service_date)<=60)||(m.next_service_km));
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <button onClick={()=>setFilterVehicle("todos")} style={{padding:"4px 10px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:600,border:"1.5px solid",borderColor:filterVehicle==="todos"?"#18181b":"#e2dfd8",background:filterVehicle==="todos"?"#18181b":"#fff",color:filterVehicle==="todos"?"#fff":"#555",fontFamily:"inherit"}}>Todos</button>
          {vehicles.map(v=><button key={v.id} onClick={()=>setFilterVehicle(String(v.id))} style={{padding:"4px 10px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:600,border:"1.5px solid",borderColor:filterVehicle===String(v.id)?"#18181b":"#e2dfd8",background:filterVehicle===String(v.id)?"#18181b":"#fff",color:filterVehicle===String(v.id)?"#fff":"#555",fontFamily:"inherit"}}>{v.plate}</button>)}
        </div>
        <button className="btn btn-dark btn-sm" style={{marginLeft:"auto"}} onClick={()=>setShowNew(true)}>+ Registrar service</button>
      </div>
      {proximos.length>0&&<div style={{marginBottom:14}}><div className="sec">Próximos mantenimientos</div>
        {proximos.map(m=>{const v=vehicles.find(v=>v.id===m.vehicle_id);return(
          <div key={m.id} style={{background:"#fff7ed",border:"1.5px solid #fed7aa",borderRadius:10,padding:"10px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontWeight:600,fontSize:13}}>{m.type} — {v?.plate||"—"}</div>
            {m.next_service_date&&<div style={{fontSize:11,color:"#854d0e"}}>📅 Próximo: {fmtDate(m.next_service_date)} ({daysUntil(m.next_service_date)} días)</div>}
            {m.next_service_km&&<div style={{fontSize:11,color:"#854d0e"}}>🛣️ Próximo: {Number(m.next_service_km).toLocaleString("es-AR")} km</div>}</div>
            <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:"#fee2e2",color:"#7f1d1d"}}>⚠️ Próximo</span>
          </div>
        );})}
      </div>}
      <div className="card" style={{overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{background:"#f8f7f4",borderBottom:"1.5px solid #e8e4dc"}}>{["Vehículo","Tipo","Fecha","KM","Próx. KM","Próx. fecha","Taller","Costo",""].map((h,i)=><th key={i} style={{padding:"9px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:".06em"}}>{h}</th>)}</tr></thead>
          <tbody>{filtered.map(m=>{const v=vehicles.find(v=>v.id===m.vehicle_id);return(
            <tr key={m.id} style={{borderBottom:"1px solid #f0ede6"}}>
              <td style={{padding:"10px 12px",fontWeight:600,fontSize:13}}>{v?.plate||"—"}</td>
              <td style={{padding:"10px 12px",fontSize:13}}>{m.type}</td>
              <td style={{padding:"10px 12px",fontSize:12,color:"#555"}}>{fmtDate(m.date)}</td>
              <td style={{padding:"10px 12px",fontSize:12,color:"#555"}}>{m.km_at_service?`${Number(m.km_at_service).toLocaleString("es-AR")} km`:"—"}</td>
              <td style={{padding:"10px 12px",fontSize:12,color:"#555"}}>{m.next_service_km?`${Number(m.next_service_km).toLocaleString("es-AR")} km`:"—"}</td>
              <td style={{padding:"10px 12px",fontSize:12,color:"#555"}}>{fmtDate(m.next_service_date)}</td>
              <td style={{padding:"10px 12px",fontSize:12,color:"#555"}}>{m.workshop||"—"}</td>
              <td style={{padding:"10px 12px",fontWeight:600,fontSize:13}}>{m.cost?fmt(m.cost):"—"}</td>
              <td style={{padding:"10px 12px"}}><button className="btn btn-outline btn-sm" style={{color:"#ef4444",borderColor:"#fecaca",padding:"3px 8px"}} onClick={async()=>{await supabase.from("vehicle_maintenance").delete().eq("id",m.id);await reload();}}>✕</button></td>
            </tr>
          );})}
          </tbody>
        </table>
        {filtered.length===0&&<div style={{textAlign:"center",padding:28,color:"#aaa"}}>Sin registros de mantenimiento</div>}
      </div>
      {showNew&&<MaintenanceModal vehicles={vehicles} onSave={async(form)=>{await supabase.from("vehicle_maintenance").insert({...form,empresa_id:userId});await reload();setShowNew(false);}} onClose={()=>setShowNew(false)}/>}
    </div>
  );
}

function MaintenanceModal({ vehicles, onSave, onClose }) {
  const [form, setForm] = useState({vehicle_id:"",type:"",date:todayStr(),km_at_service:"",next_service_km:"",next_service_date:"",cost:"",workshop:"",notes:""});
  const [saving, setSaving] = useState(false);
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  return (
    <div className="modal-bg" onClick={onClose}><div className="modal" style={{maxWidth:520}} onClick={e=>e.stopPropagation()}>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,marginBottom:18}}>🔧 Registrar service</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Vehículo *</label><select className="field" value={form.vehicle_id} onChange={e=>set("vehicle_id",e.target.value)}><option value="">— Seleccionar —</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>)}</select></div>
        <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Tipo *</label><select className="field" value={form.type} onChange={e=>set("type",e.target.value)}><option value="">— Seleccionar —</option>{MAINTENANCE_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Fecha</label><input className="field" type="date" value={form.date} onChange={e=>set("date",e.target.value)}/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>KM al momento</label><input className="field" type="number" value={form.km_at_service} onChange={e=>set("km_at_service",e.target.value)}/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Próximo KM</label><input className="field" type="number" value={form.next_service_km} onChange={e=>set("next_service_km",e.target.value)}/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Próxima fecha</label><input className="field" type="date" value={form.next_service_date} onChange={e=>set("next_service_date",e.target.value)}/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Costo</label><input className="field" type="number" value={form.cost} onChange={e=>set("cost",e.target.value)}/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Taller</label><input className="field" value={form.workshop} onChange={e=>set("workshop",e.target.value)}/></div>
        <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Notas</label><textarea className="field" rows={2} value={form.notes} onChange={e=>set("notes",e.target.value)} style={{resize:"none"}}/></div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:18,justifyContent:"flex-end"}}>
        <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
        <button className="btn btn-dark" disabled={saving||!form.vehicle_id||!form.type} onClick={async()=>{setSaving(true);await onSave({...form,vehicle_id:Number(form.vehicle_id),km_at_service:Number(form.km_at_service)||null,next_service_km:Number(form.next_service_km)||null,cost:Number(form.cost)||0,next_service_date:form.next_service_date||null});setSaving(false);}}>{saving?"Guardando...":"Guardar"}</button>
      </div>
    </div></div>
  );
}

function TripDetail({ trip:t, drivers, vehicles, clients, config, fmt, userId, onBack, reload }) {
  const [showExpense, setShowExpense] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showNovedad, setShowNovedad] = useState(false);
  const [showKm, setShowKm] = useState(false);
  const [nuevaNovedad, setNuevaNovedad] = useState("");
  const [kmInicio, setKmInicio] = useState(t.km_inicio||"");
  const [kmFin, setKmFin] = useState(t.km_fin||"");
  const st=TRIP_STATUS[t.status]||TRIP_STATUS.pendiente;
  const driver=drivers.find(d=>d.id===t.driver_id);
  const vehicle=vehicles.find(v=>v.id===t.vehicle_id);
  const totalGastos=(t.expenses||[]).reduce((a,e)=>a+Number(e.amount||0),0);
  const ganancia=Number(t.rate||0)-totalGastos;
  const kmRecorridos=t.km_fin&&t.km_inicio?Number(t.km_fin)-Number(t.km_inicio):Number(t.km_recorridos||0);
  const gastosComb=(t.expenses||[]).filter(e=>e.type==="Combustible");
  const totalLitros=gastosComb.reduce((a,e)=>a+Number(e.litros||0),0);
  const rendimiento=totalLitros>0&&kmRecorridos>0?(kmRecorridos/totalLitros).toFixed(1):null;
  const changeStatus=async(status)=>{await supabase.from("trips").update({status}).eq("id",t.id);await reload();};
  const deleteTrip=async()=>{if(!window.confirm("¿Eliminar viaje?"))return;await supabase.from("trips").delete().eq("id",t.id);onBack();reload();};
  const deleteExpense=async(id)=>{await supabase.from("trip_expenses").delete().eq("id",id);await reload();};
  const deleteNovedad=async(id)=>{await supabase.from("trip_novedades").delete().eq("id",id);await reload();};
  const guardarNovedad=async()=>{if(!nuevaNovedad.trim())return;await supabase.from("trip_novedades").insert({empresa_id:userId,trip_id:t.id,texto:nuevaNovedad});if(t.status==="en_camino")await supabase.from("trips").update({status:"con_novedad"}).eq("id",t.id);await reload();setNuevaNovedad("");setShowNovedad(false);};
  const guardarKm=async()=>{const km_i=Number(kmInicio)||null;const km_f=Number(kmFin)||null;const km_rec=km_i&&km_f?km_f-km_i:null;await supabase.from("trips").update({km_inicio:km_i,km_fin:km_f,km_recorridos:km_rec}).eq("id",t.id);await reload();setShowKm(false);};
  return (
    <div style={{padding:24,fontFamily:"'Instrument Sans',sans-serif"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <button className="btn btn-outline btn-sm" onClick={onBack}>← Volver</button>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800}}>{t.origin} → {t.destination}</div>
            <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,background:st.bg,color:st.text}}>{st.label}</span>
          </div>
          <div style={{fontSize:12,color:"#888",marginTop:2}}>{t.nro} · {fmtDate(t.date)}</div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={()=>setShowKm(true)}>🛣️ KM</button>
        <button className="btn btn-outline btn-sm" onClick={()=>setShowNovedad(true)}>📋 Novedad</button>
        <button className="btn btn-outline btn-sm" onClick={()=>setShowEdit(true)}>✏️ Editar</button>
        <button className="btn btn-outline btn-sm" style={{color:"#ef4444",borderColor:"#fecaca"}} onClick={deleteTrip}>🗑</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"320px 1fr",gap:16,alignItems:"start"}}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div className="card" style={{padding:16}}>
            <div className="sec">Detalle</div>
            {[["📍","Origen",t.origin||"—"],["🏁","Destino",t.destination||"—"],["📅","Salida",fmtDate(t.date)],["📅","Retorno",fmtDate(t.estimated_return)],["👤","Cliente",t.client_name||"—"],["🚛","Carga",t.cargo||"—"],["👨‍✈️","Chofer",driver?.name||"—"],["🚚","Vehículo",vehicle?.plate||"—"]].map(([ic,label,val],i)=>(
              <div key={i} style={{display:"flex",gap:10,padding:"6px 0",borderBottom:"1px solid #f5f3ef",alignItems:"center"}}>
                <span style={{fontSize:14,flexShrink:0}}>{ic}</span>
                <div style={{flex:1}}><div style={{fontSize:10,color:"#aaa",fontWeight:600,textTransform:"uppercase"}}>{label}</div><div style={{fontSize:13,marginTop:1}}>{val}</div></div>
              </div>
            ))}
          </div>
          <div className="card" style={{padding:16}}>
            <div className="sec">🛣️ KM</div>
            {[["KM inicio",t.km_inicio?t.km_inicio.toLocaleString("es-AR"):"—"],["KM fin",t.km_fin?t.km_fin.toLocaleString("es-AR"):"—"],["Recorridos",kmRecorridos>0?`${kmRecorridos.toLocaleString("es-AR")} km`:"—"],...(rendimiento?[["Rendimiento",`${rendimiento} km/L`]]:[]),(totalLitros>0?[["Total combustible",`${totalLitros.toLocaleString("es-AR")} L`]]:[])].map(([label,val],i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f5f3ef"}}><span style={{fontSize:12,color:"#555"}}>{label}</span><span style={{fontWeight:600,fontSize:13}}>{val}</span></div>
            ))}
            <button className="btn btn-outline btn-sm" style={{marginTop:10,width:"100%"}} onClick={()=>setShowKm(true)}>Editar KM</button>
          </div>
          <div className="card" style={{padding:16}}>
            <div className="sec">Financiero</div>
            {[["Tarifa",fmt(t.rate||0),"#166534"],["Gastos",`-${fmt(totalGastos)}`,"#ef4444"],["Ganancia",fmt(ganancia),ganancia>=0?"#166534":"#7f1d1d"]].map(([l,v,c],i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f5f3ef"}}><span style={{fontSize:13,color:"#555"}}>{l}</span><span style={{fontWeight:700,fontSize:14,color:c}}>{v}</span></div>
            ))}
          </div>
          <div className="card" style={{padding:16}}>
            <div className="sec">Estado</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {Object.entries(TRIP_STATUS).map(([k,v])=>(
                <button key={k} onClick={()=>changeStatus(k)} style={{padding:"8px 12px",borderRadius:9,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600,border:`1.5px solid ${t.status===k?v.text:"#e2dfd8"}`,background:t.status===k?v.bg:"#fff",color:t.status===k?v.text:"#555",textAlign:"left"}}>{v.label}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div className="card" style={{padding:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <div className="sec" style={{marginBottom:0}}>💸 Gastos ({(t.expenses||[]).length})</div>
              <button className="btn btn-dark btn-sm" onClick={()=>setShowExpense(true)}>+ Gasto</button>
            </div>
            {(t.expenses||[]).length===0&&<div style={{textAlign:"center",padding:24,color:"#aaa"}}>Sin gastos</div>}
            {(t.expenses||[]).map(e=>(
              <div key={e.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:10,border:"1.5px solid #ede9e3",marginBottom:8,background:"#fafaf8"}}>
                <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13}}>{e.type}</div><div style={{fontSize:11,color:"#888",marginTop:1}}>{e.description||"—"} · {fmtDate(e.date)}{e.litros?` · ${e.litros}L`:""}{e.precio_litro?` · ${fmt(e.precio_litro)}/L`:""}</div></div>
                <div style={{fontWeight:700,fontSize:14,color:"#ef4444"}}>{fmt(e.amount)}</div>
                <button className="btn btn-outline btn-sm" style={{color:"#ef4444",borderColor:"#fecaca",padding:"3px 8px"}} onClick={()=>deleteExpense(e.id)}>✕</button>
              </div>
            ))}
          </div>
          <div className="card" style={{padding:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <div className="sec" style={{marginBottom:0}}>📋 Novedades ({(t.novedades||[]).length})</div>
              <button className="btn btn-outline btn-sm" onClick={()=>setShowNovedad(true)}>+ Agregar</button>
            </div>
            {(t.novedades||[]).length===0&&<div style={{textAlign:"center",padding:24,color:"#aaa"}}>Sin novedades</div>}
            {(t.novedades||[]).map(n=>(
              <div key={n.id} style={{padding:"10px 12px",borderRadius:10,border:"1.5px solid #fde047",marginBottom:8,background:"#fefce8"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"#854d0e"}}>{n.texto}</div><div style={{fontSize:11,color:"#aaa",marginTop:4}}>🕐 {fmtDateTime(n.fecha)}</div></div>
                  <button className="btn btn-outline btn-sm" style={{color:"#ef4444",borderColor:"#fecaca",padding:"3px 8px",marginLeft:8}} onClick={()=>deleteNovedad(n.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {showKm&&<div className="modal-bg" onClick={()=>setShowKm(false)}><div className="modal" style={{maxWidth:380}} onClick={e=>e.stopPropagation()}>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:800,marginBottom:14}}>🛣️ Registrar KM</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>KM inicio</label><input className="field" type="number" value={kmInicio} onChange={e=>setKmInicio(e.target.value)} autoFocus/></div>
          <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>KM fin</label><input className="field" type="number" value={kmFin} onChange={e=>setKmFin(e.target.value)}/></div>
          {kmInicio&&kmFin&&Number(kmFin)>Number(kmInicio)&&<div style={{background:"#eff6ff",border:"1.5px solid #93c5fd",borderRadius:10,padding:"10px 14px",textAlign:"center"}}><div style={{fontSize:11,color:"#888",marginBottom:2}}>KM recorridos</div><div style={{fontFamily:"'Syne',sans-serif",fontSize:24,fontWeight:800,color:"#1d4ed8"}}>{(Number(kmFin)-Number(kmInicio)).toLocaleString("es-AR")} km</div></div>}
        </div>
        <div style={{display:"flex",gap:8,marginTop:14,justifyContent:"flex-end"}}><button className="btn btn-outline" onClick={()=>setShowKm(false)}>Cancelar</button><button className="btn btn-dark" onClick={guardarKm}>Guardar</button></div>
      </div></div>}
      {showNovedad&&<div className="modal-bg" onClick={()=>setShowNovedad(false)}><div className="modal" style={{maxWidth:420}} onClick={e=>e.stopPropagation()}>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:800,marginBottom:14}}>📋 Nueva novedad</div>
        <textarea className="field" rows={4} value={nuevaNovedad} onChange={e=>setNuevaNovedad(e.target.value)} style={{resize:"vertical"}} autoFocus/>
        <div style={{display:"flex",gap:8,marginTop:14,justifyContent:"flex-end"}}><button className="btn btn-outline" onClick={()=>setShowNovedad(false)}>Cancelar</button><button className="btn btn-dark" onClick={guardarNovedad}>Registrar</button></div>
      </div></div>}
      {showExpense&&<ExpenseModal onSave={async(form)=>{await supabase.from("trip_expenses").insert({...form,trip_id:t.id,empresa_id:userId});await reload();setShowExpense(false);}} onClose={()=>setShowExpense(false)}/>}
      {showEdit&&<TripModal trip={t} drivers={drivers} vehicles={vehicles} clients={clients} onSave={async(form)=>{await supabase.from("trips").update(form).eq("id",t.id);await reload();setShowEdit(false);}} onClose={()=>setShowEdit(false)}/>}
    </div>
  );
}

function TripModal({ trip, drivers, vehicles, clients, onSave, onClose }) {
  const [form, setForm] = useState({origin:trip?.origin||"",destination:trip?.destination||"",date:trip?.date||todayStr(),estimated_return:trip?.estimated_return||"",driver_id:trip?.driver_id||"",vehicle_id:trip?.vehicle_id||"",client_id:trip?.client_id||"",client_name:trip?.client_name||"",cargo:trip?.cargo||"",cargo_weight:trip?.cargo_weight||"",rate:trip?.rate||"",status:trip?.status||"pendiente",notes:trip?.notes||""});
  const [saving, setSaving] = useState(false);
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const handleClient=(id)=>{const c=clients.find(c=>String(c.id)===String(id));set("client_id",id);set("client_name",c?c.name:"");};
  return (
    <div className="modal-bg" onClick={onClose}><div className="modal" style={{maxWidth:580}} onClick={e=>e.stopPropagation()}>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,marginBottom:18}}>{trip?"Editar viaje":"Nuevo viaje"}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Origen *</label><input className="field" value={form.origin} onChange={e=>set("origin",e.target.value)} autoFocus/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Destino *</label><input className="field" value={form.destination} onChange={e=>set("destination",e.target.value)}/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Fecha salida</label><input className="field" type="date" value={form.date} onChange={e=>set("date",e.target.value)}/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Retorno estimado</label><input className="field" type="date" value={form.estimated_return} onChange={e=>set("estimated_return",e.target.value)}/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Chofer</label><select className="field" value={form.driver_id} onChange={e=>set("driver_id",e.target.value)}><option value="">— Sin chofer —</option>{drivers.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Vehículo</label><select className="field" value={form.vehicle_id} onChange={e=>set("vehicle_id",e.target.value)}><option value="">— Sin vehículo —</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>)}</select></div>
        <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Cliente</label><select className="field" value={form.client_id} onChange={e=>handleClient(e.target.value)}><option value="">— Sin cliente —</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Carga</label><input className="field" value={form.cargo} onChange={e=>set("cargo",e.target.value)}/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Peso (kg)</label><input className="field" type="number" value={form.cargo_weight} onChange={e=>set("cargo_weight",e.target.value)}/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Tarifa</label><input className="field" type="number" value={form.rate} onChange={e=>set("rate",e.target.value)}/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Estado</label><select className="field" value={form.status} onChange={e=>set("status",e.target.value)}>{Object.entries(TRIP_STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
        <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Notas</label><textarea className="field" rows={2} value={form.notes} onChange={e=>set("notes",e.target.value)} style={{resize:"none"}}/></div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:18,justifyContent:"flex-end"}}>
        <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
        <button className="btn btn-dark" disabled={saving} onClick={async()=>{if(!form.origin||!form.destination)return;setSaving(true);await onSave({...form,driver_id:form.driver_id||null,vehicle_id:form.vehicle_id||null,client_id:form.client_id||null,rate:Number(form.rate)||0,cargo_weight:Number(form.cargo_weight)||null,estimated_return:form.estimated_return||null});setSaving(false);}}>{saving?"Guardando...":"Guardar"}</button>
      </div>
    </div></div>
  );
}

function DriverModal({ driver, onSave, onClose }) {
  const [form, setForm] = useState({name:driver?.name||"",dni:driver?.dni||"",phone:driver?.phone||"",email:driver?.email||"",license_number:driver?.license_number||"",license_expiry:driver?.license_expiry||"",hire_date:driver?.hire_date||"",salary:driver?.salary||"",notes:driver?.notes||"",active:driver?.active!==false});
  const [saving, setSaving] = useState(false);
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  return (
    <div className="modal-bg" onClick={onClose}><div className="modal" style={{maxWidth:520}} onClick={e=>e.stopPropagation()}>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,marginBottom:18}}>{driver?"Editar chofer":"Nuevo chofer"}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Nombre *</label><input className="field" value={form.name} onChange={e=>set("name",e.target.value)} autoFocus/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>DNI</label><input className="field" value={form.dni} onChange={e=>set("dni",e.target.value)}/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Teléfono</label><input className="field" value={form.phone} onChange={e=>set("phone",e.target.value)}/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>N° Licencia</label><input className="field" value={form.license_number} onChange={e=>set("license_number",e.target.value)}/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Venc. licencia</label><input className="field" type="date" value={form.license_expiry} onChange={e=>set("license_expiry",e.target.value)}/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Fecha ingreso</label><input className="field" type="date" value={form.hire_date} onChange={e=>set("hire_date",e.target.value)}/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Sueldo mensual</label><input className="field" type="number" value={form.salary} onChange={e=>set("salary",e.target.value)}/></div>
        <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Notas</label><textarea className="field" rows={2} value={form.notes} onChange={e=>set("notes",e.target.value)} style={{resize:"none"}}/></div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:18,justifyContent:"flex-end"}}>
        <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
        <button className="btn btn-dark" disabled={saving} onClick={async()=>{if(!form.name)return;setSaving(true);await onSave({...form,salary:Number(form.salary)||0,license_expiry:form.license_expiry||null,hire_date:form.hire_date||null});setSaving(false);}}>{saving?"Guardando...":"Guardar"}</button>
      </div>
    </div></div>
  );
}

function VehicleModal({ vehicle, onSave, onClose }) {
  const [form, setForm] = useState({plate:vehicle?.plate||"",brand:vehicle?.brand||"",model:vehicle?.model||"",year:vehicle?.year||"",insurance_expiry:vehicle?.insurance_expiry||"",vtv_expiry:vehicle?.vtv_expiry||"",habilitacion_expiry:vehicle?.habilitacion_expiry||"",notes:vehicle?.notes||"",active:vehicle?.active!==false});
  const [saving, setSaving] = useState(false);
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  return (
    <div className="modal-bg" onClick={onClose}><div className="modal" style={{maxWidth:520}} onClick={e=>e.stopPropagation()}>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,marginBottom:18}}>{vehicle?"Editar vehículo":"Nuevo vehículo"}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Patente *</label><input className="field" value={form.plate} onChange={e=>set("plate",e.target.value)} autoFocus/></div>
        <div>
          <label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Marca</label>
          <select className="field" value={form.brand} onChange={e=>set("brand",e.target.value)}>
            <option value="">— Seleccionar —</option>
            {TRUCK_BRANDS.map(b=><option key={b}>{b}</option>)}
          </select>
        </div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Modelo</label><input className="field" value={form.model} onChange={e=>set("model",e.target.value)}/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Año</label><input className="field" type="number" value={form.year} onChange={e=>set("year",e.target.value)}/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Venc. seguro</label><input className="field" type="date" value={form.insurance_expiry} onChange={e=>set("insurance_expiry",e.target.value)}/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Venc. VTV</label><input className="field" type="date" value={form.vtv_expiry} onChange={e=>set("vtv_expiry",e.target.value)}/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Venc. habilitación</label><input className="field" type="date" value={form.habilitacion_expiry} onChange={e=>set("habilitacion_expiry",e.target.value)}/></div>
        <div style={{display:"flex",alignItems:"center",gap:8,paddingTop:20}}>
          <label style={{fontSize:12,fontWeight:600,color:"#555"}}>Activo</label>
          <button onClick={()=>set("active",!form.active)} style={{width:40,height:22,borderRadius:11,background:form.active?"#18181b":"#e2dfd8",border:"none",cursor:"pointer",position:"relative",transition:"background .2s"}}>
            <div style={{width:16,height:16,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:form.active?21:3,transition:"left .2s"}}/>
          </button>
        </div>
        <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Notas</label><textarea className="field" rows={2} value={form.notes} onChange={e=>set("notes",e.target.value)} style={{resize:"none"}}/></div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:18,justifyContent:"flex-end"}}>
        <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
        <button className="btn btn-dark" disabled={saving} onClick={async()=>{if(!form.plate)return;setSaving(true);await onSave({...form,year:Number(form.year)||null,insurance_expiry:form.insurance_expiry||null,vtv_expiry:form.vtv_expiry||null,habilitacion_expiry:form.habilitacion_expiry||null});setSaving(false);}}>{saving?"Guardando...":"Guardar"}</button>
      </div>
    </div></div>
  );
}

function ExpenseModal({ onSave, onClose }) {
  const [form, setForm] = useState({type:"Combustible",description:"",amount:"",date:todayStr(),litros:"",precio_litro:""});
  const [saving, setSaving] = useState(false);
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const isCombustible=form.type==="Combustible";
  useEffect(()=>{if(isCombustible&&form.litros&&form.precio_litro)set("amount",(Number(form.litros)*Number(form.precio_litro)).toFixed(2));},[form.litros,form.precio_litro]);
  return (
    <div className="modal-bg" onClick={onClose}><div className="modal" style={{maxWidth:420}} onClick={e=>e.stopPropagation()}>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:800,marginBottom:14}}>💸 Nuevo gasto</div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Tipo</label><select className="field" value={form.type} onChange={e=>set("type",e.target.value)}>{EXPENSE_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
        {isCombustible&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Litros</label><input className="field" type="number" placeholder="0" value={form.litros} onChange={e=>set("litros",e.target.value)}/></div>
          <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Precio/litro</label><input className="field" type="number" placeholder="0" value={form.precio_litro} onChange={e=>set("precio_litro",e.target.value)}/></div>
        </div>}
        <input className="field" placeholder="Descripción" value={form.description} onChange={e=>set("description",e.target.value)}/>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Monto *</label><input className="field" type="number" placeholder="0" value={form.amount} onChange={e=>set("amount",e.target.value)}/></div>
        <input className="field" type="date" value={form.date} onChange={e=>set("date",e.target.value)}/>
      </div>
      <div style={{display:"flex",gap:8,marginTop:14,justifyContent:"flex-end"}}>
        <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
        <button className="btn btn-red" disabled={saving} onClick={async()=>{if(!form.amount)return;setSaving(true);await onSave({...form,amount:Number(form.amount),litros:Number(form.litros)||null,precio_litro:Number(form.precio_litro)||null});setSaving(false);}}>{saving?"Guardando...":"Registrar"}</button>
      </div>
    </div></div>
  );
}
