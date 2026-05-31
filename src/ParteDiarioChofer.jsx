import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";

const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const fmtDate = (d) => { if(!d) return "—"; const [y,m,day]=d.split("-"); return `${day}/${m}/${y}`; };

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

export default function ParteDiarioChofer({ user, empresaId, driverInfo, config = {}, onLogout }) {
  const [trips, setTrips] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [partes, setPartes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("nuevo");

  const [selTripId, setSelTripId] = useState("");
  const [selVehicle, setSelVehicle] = useState("");
  const [fecha, setFecha] = useState(todayStr());
  const [form, setForm] = useState({
    km_inicio:"", km_fin:"",
    combustible_litros:"", combustible_precio:"",
    check_neumaticos:"ok", check_frenos:"ok", check_luces:"ok",
    check_agua:"ok", check_aceite:"ok", check_limpieza:"ok", check_documentacion:"ok",
    observaciones:"", novedad:"",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selParte, setSelParte] = useState(null);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  useEffect(() => { if(empresaId && driverInfo) loadData(); }, [empresaId, driverInfo]);

  const loadData = async () => {
    setLoading(true);
    const [t, v, p] = await Promise.all([
      supabase.from("trips").select("*").eq("empresa_id", empresaId).in("status",["pendiente","en_camino"]).order("date",{ascending:false}),
      supabase.from("vehicles").select("*").eq("empresa_id", empresaId).eq("active", true),
      supabase.from("trip_partes").select("*").eq("empresa_id", empresaId).eq("driver_id", driverInfo.id).order("fecha",{ascending:false}).limit(20),
    ]);
    setTrips((t.data||[]).filter(tr=>!tr.driver_id||tr.driver_id===driverInfo.id));
    setVehicles(v.data||[]);
    setPartes(p.data||[]);
    if(driverInfo.vehicle_id) setSelVehicle(String(driverInfo.vehicle_id));
    setLoading(false);
  };

  const km_rec = form.km_fin&&form.km_inicio ? Number(form.km_fin)-Number(form.km_inicio) : 0;
  const comb_total = form.combustible_litros&&form.combustible_precio ? Number(form.combustible_litros)*Number(form.combustible_precio) : 0;
  const hasAlert = CHECK_ITEMS.some(item=>form[item.key]==="mal");

  const guardarParte = async () => {
    setSaving(true);
    await supabase.from("trip_partes").insert({
      empresa_id: empresaId,
      trip_id: selTripId?Number(selTripId):null,
      driver_id: driverInfo.id,
      vehicle_id: selVehicle?Number(selVehicle):null,
      fecha,
      km_inicio: Number(form.km_inicio)||null,
      km_fin: Number(form.km_fin)||null,
      km_recorridos: km_rec||null,
      combustible_litros: Number(form.combustible_litros)||null,
      combustible_precio: Number(form.combustible_precio)||null,
      combustible_total: comb_total||null,
      check_neumaticos: form.check_neumaticos,
      check_frenos: form.check_frenos,
      check_luces: form.check_luces,
      check_agua: form.check_agua,
      check_aceite: form.check_aceite,
      check_limpieza: form.check_limpieza,
      check_documentacion: form.check_documentacion,
      observaciones: form.observaciones||null,
    });

    // Si hay novedad, registrarla
    if(form.novedad.trim() && selTripId) {
      await supabase.from("trip_novedades").insert({
        empresa_id: empresaId,
        trip_id: Number(selTripId),
        texto: form.novedad,
      });
      if(selTripId) await supabase.from("trips").update({status:"con_novedad"}).eq("id",Number(selTripId));
    }

    // Actualizar KM en el viaje
    if(selTripId && km_rec>0) {
      await supabase.from("trips").update({km_recorridos:km_rec}).eq("id",Number(selTripId));
    }

    await loadData();
    setSaving(false);
    setSaved(true);
    // Reset form
    setForm({km_inicio:"",km_fin:"",combustible_litros:"",combustible_precio:"",check_neumaticos:"ok",check_frenos:"ok",check_luces:"ok",check_agua:"ok",check_aceite:"ok",check_limpieza:"ok",check_documentacion:"ok",observaciones:"",novedad:""});
    setSelTripId("");
    setTimeout(()=>setSaved(false),4000);
  };

  const fmt = (n) => `${config.moneda||"$"}${Number(n).toLocaleString("es-AR")}`;

  return (
    <div style={{minHeight:"100vh",background:"#f5f3ef",fontFamily:"'Instrument Sans',sans-serif"}}>
      {/* Header */}
      <div style={{background:"#18181b",padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,background:config.accentColor||"#6366f1",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{config.appIcon||"🚛"}</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:15,color:"#fff"}}>{config.appName||"LocalApp"}</div>
            <div style={{fontSize:11,color:"#aaa"}}>Hola, {driverInfo?.name||"Chofer"}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{background:"none",border:"1px solid #444",borderRadius:8,color:"#aaa",cursor:"pointer",fontSize:12,padding:"5px 10px",fontFamily:"inherit"}}>Salir</button>
      </div>

      {/* Tabs */}
      <div style={{background:"#fff",borderBottom:"1px solid #e8e4dc",display:"flex",padding:"0 16px"}}>
        {[["nuevo","📋 Nuevo parte"],["historial","📂 Mi historial"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{padding:"12px 16px",border:"none",borderBottom:`2px solid ${tab===k?"#18181b":"transparent"}`,background:"transparent",cursor:"pointer",fontSize:13,fontWeight:600,color:tab===k?"#18181b":"#888",fontFamily:"inherit"}}>{l}</button>
        ))}
      </div>

      <div style={{padding:16,maxWidth:600,margin:"0 auto"}}>
        {tab==="nuevo"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {saved&&(
              <div style={{background:"#dcfce7",border:"1.5px solid #86efac",borderRadius:12,padding:"14px 16px",textAlign:"center",fontSize:14,fontWeight:700,color:"#166534"}}>
                ✅ Parte guardado correctamente
              </div>
            )}

            {/* Info básica */}
            <div style={{background:"#fff",borderRadius:14,border:"1px solid #e8e4dc",padding:16}}>
              <div style={{fontSize:10,fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:".07em",marginBottom:12}}>Información del parte</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Fecha</label>
                  <input style={{background:"#f8f7f4",border:"1.5px solid #e2dfd8",borderRadius:9,padding:"10px 13px",fontSize:14,color:"#18181b",width:"100%",outline:"none",fontFamily:"inherit",boxSizing:"border-box"}} type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Unidad / Vehículo</label>
                  <select style={{background:"#f8f7f4",border:"1.5px solid #e2dfd8",borderRadius:9,padding:"10px 13px",fontSize:14,color:"#18181b",width:"100%",outline:"none",fontFamily:"inherit"}} value={selVehicle} onChange={e=>setSelVehicle(e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    {vehicles.map(v=><option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Viaje (opcional)</label>
                  <select style={{background:"#f8f7f4",border:"1.5px solid #e2dfd8",borderRadius:9,padding:"10px 13px",fontSize:14,color:"#18181b",width:"100%",outline:"none",fontFamily:"inherit"}} value={selTripId} onChange={e=>setSelTripId(e.target.value)}>
                    <option value="">— Sin viaje —</option>
                    {trips.map(t=><option key={t.id} value={t.id}>{t.nro} — {t.origin} → {t.destination}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* KM */}
            <div style={{background:"#fff",borderRadius:14,border:"1px solid #e8e4dc",padding:16}}>
              <div style={{fontSize:10,fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:".07em",marginBottom:12}}>🛣️ Kilómetros</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>KM inicio</label>
                  <input style={{background:"#f8f7f4",border:"1.5px solid #e2dfd8",borderRadius:9,padding:"10px 13px",fontSize:14,color:"#18181b",width:"100%",outline:"none",fontFamily:"inherit",boxSizing:"border-box"}} type="number" inputMode="numeric" placeholder="150000" value={form.km_inicio} onChange={e=>set("km_inicio",e.target.value)}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>KM fin</label>
                  <input style={{background:"#f8f7f4",border:"1.5px solid #e2dfd8",borderRadius:9,padding:"10px 13px",fontSize:14,color:"#18181b",width:"100%",outline:"none",fontFamily:"inherit",boxSizing:"border-box"}} type="number" inputMode="numeric" placeholder="151500" value={form.km_fin} onChange={e=>set("km_fin",e.target.value)}/>
                </div>
              </div>
              {km_rec>0&&(
                <div style={{background:"#eff6ff",border:"1.5px solid #93c5fd",borderRadius:10,padding:"10px 14px",marginTop:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:13,color:"#555"}}>KM recorridos</span>
                  <span style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,color:"#1d4ed8"}}>{km_rec.toLocaleString("es-AR")} km</span>
                </div>
              )}
            </div>

            {/* Combustible */}
            <div style={{background:"#fff",borderRadius:14,border:"1px solid #e8e4dc",padding:16}}>
              <div style={{fontSize:10,fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:".07em",marginBottom:12}}>⛽ Combustible</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Litros cargados</label>
                  <input style={{background:"#f8f7f4",border:"1.5px solid #e2dfd8",borderRadius:9,padding:"10px 13px",fontSize:14,color:"#18181b",width:"100%",outline:"none",fontFamily:"inherit",boxSizing:"border-box"}} type="number" inputMode="decimal" placeholder="0" value={form.combustible_litros} onChange={e=>set("combustible_litros",e.target.value)}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Precio por litro</label>
                  <input style={{background:"#f8f7f4",border:"1.5px solid #e2dfd8",borderRadius:9,padding:"10px 13px",fontSize:14,color:"#18181b",width:"100%",outline:"none",fontFamily:"inherit",boxSizing:"border-box"}} type="number" inputMode="decimal" placeholder="0" value={form.combustible_precio} onChange={e=>set("combustible_precio",e.target.value)}/>
                </div>
              </div>
              {comb_total>0&&(
                <div style={{background:"#fff7ed",border:"1.5px solid #fed7aa",borderRadius:10,padding:"10px 14px",marginTop:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:13,color:"#555"}}>Total combustible</span>
                  <span style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,color:"#854d0e"}}>{fmt(comb_total)}</span>
                </div>
              )}
            </div>

            {/* Checklist */}
            <div style={{background:"#fff",borderRadius:14,border:"1px solid #e8e4dc",padding:16}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                <div style={{fontSize:10,fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:".07em"}}>✅ Checklist de la unidad</div>
                {hasAlert&&<span style={{background:"#fee2e2",color:"#7f1d1d",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20}}>⚠️ Ítems en mal estado</span>}
              </div>
              {CHECK_ITEMS.map(item=>(
                <div key={item.key} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid #f5f3ef"}}>
                  <span style={{fontSize:20,flexShrink:0}}>{item.icon}</span>
                  <span style={{fontSize:14,fontWeight:600,flex:1}}>{item.label}</span>
                  <div style={{display:"flex",gap:6}}>
                    {CHECK_OPTIONS.map(opt=>(
                      <button key={opt.value} onClick={()=>set(item.key,opt.value)} style={{padding:"6px 12px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:700,border:`1.5px solid ${form[item.key]===opt.value?opt.text:"#e2dfd8"}`,background:form[item.key]===opt.value?opt.bg:"#fff",color:form[item.key]===opt.value?opt.text:"#888",fontFamily:"inherit"}}>{opt.label}</button>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{marginTop:12}}>
                <label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Observaciones de la unidad</label>
                <textarea style={{background:"#f8f7f4",border:"1.5px solid #e2dfd8",borderRadius:9,padding:"10px 13px",fontSize:14,color:"#18181b",width:"100%",outline:"none",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}} rows={3} placeholder="Estado general, algo para reportar..." value={form.observaciones} onChange={e=>set("observaciones",e.target.value)}/>
              </div>
            </div>

            {/* Novedad */}
            <div style={{background:"#fefce8",borderRadius:14,border:"1.5px solid #fde047",padding:16}}>
              <div style={{fontSize:10,fontWeight:700,color:"#854d0e",textTransform:"uppercase",letterSpacing:".07em",marginBottom:8}}>📋 Novedad del viaje (opcional)</div>
              <textarea style={{background:"#fff",border:"1.5px solid #fde047",borderRadius:9,padding:"10px 13px",fontSize:14,color:"#18181b",width:"100%",outline:"none",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}} rows={3} placeholder="Ej: Demora por obras en ruta 9, se avisó al cliente..." value={form.novedad} onChange={e=>set("novedad",e.target.value)}/>
            </div>

            {/* Botón guardar */}
            <button onClick={guardarParte} disabled={saving} style={{background:"#18181b",color:"#fff",border:"none",borderRadius:12,padding:"16px",fontSize:16,fontWeight:700,cursor:saving?"not-allowed":"pointer",fontFamily:"inherit",opacity:saving?.7:1,width:"100%"}}>
              {saving?"Guardando...":"Guardar parte diario ✅"}
            </button>
          </div>
        )}

        {tab==="historial"&&(
          <div>
            <div style={{fontSize:13,color:"#888",marginBottom:12}}>Tus últimos {partes.length} partes registrados</div>
            {partes.length===0&&<div style={{textAlign:"center",padding:48,color:"#aaa"}}>Sin partes registrados</div>}
            {partes.map(p=>{
              const vehicle=vehicles.find(v=>v.id===p.vehicle_id);
              const tieneAlerta=CHECK_ITEMS.some(item=>p[item.key]==="mal");
              return (
                <div key={p.id} onClick={()=>setSelParte(p)} style={{background:"#fff",borderRadius:14,border:`1.5px solid ${tieneAlerta?"#fecaca":"#e8e4dc"}`,padding:14,marginBottom:10,cursor:"pointer"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                    <div style={{fontWeight:700,fontSize:14}}>{fmtDate(p.fecha)}</div>
                    {tieneAlerta&&<span style={{background:"#fee2e2",color:"#7f1d1d",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20}}>⚠️ Alerta</span>}
                  </div>
                  <div style={{fontSize:12,color:"#888"}}>{vehicle?.plate||"Sin unidad"}</div>
                  {p.km_recorridos>0&&<div style={{fontSize:12,color:"#555",marginTop:4}}>🛣️ {Number(p.km_recorridos).toLocaleString("es-AR")} km</div>}
                  {p.combustible_litros>0&&<div style={{fontSize:12,color:"#555"}}>⛽ {p.combustible_litros}L — {fmt(p.combustible_total||0)}</div>}
                  <div style={{fontSize:11,color:"#aaa",marginTop:4}}>Tocá para ver detalle →</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal detalle parte */}
      {selParte&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200}} onClick={()=>setSelParte(null)}>
          <div style={{background:"#fff",borderRadius:"20px 20px 0 0",padding:20,width:"100%",maxWidth:600,maxHeight:"85vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:800,marginBottom:4}}>Parte del {fmtDate(selParte.fecha)}</div>
            <div style={{fontSize:12,color:"#888",marginBottom:14}}>{vehicles.find(v=>v.id===selParte.vehicle_id)?.plate||"Sin unidad"}</div>
            {selParte.km_recorridos>0&&(
              <div style={{background:"#eff6ff",borderRadius:10,padding:"10px 14px",marginBottom:10,display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:13,color:"#555"}}>KM recorridos</span>
                <span style={{fontWeight:700,color:"#1d4ed8"}}>{Number(selParte.km_recorridos).toLocaleString("es-AR")} km</span>
              </div>
            )}
            {selParte.combustible_litros>0&&(
              <div style={{background:"#fff7ed",borderRadius:10,padding:"10px 14px",marginBottom:10,display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:13,color:"#555"}}>Combustible</span>
                <span style={{fontWeight:700,color:"#854d0e"}}>{selParte.combustible_litros}L — {fmt(selParte.combustible_total||0)}</span>
              </div>
            )}
            <div style={{fontSize:10,fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:".07em",marginBottom:8,marginTop:12}}>Checklist</div>
            {CHECK_ITEMS.map(item=>{
              const val=selParte[item.key];
              const opt=CHECK_OPTIONS.find(o=>o.value===val)||CHECK_OPTIONS[0];
              return (
                <div key={item.key} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:"1px solid #f5f3ef"}}>
                  <span style={{fontSize:18}}>{item.icon}</span>
                  <span style={{fontSize:13,flex:1}}>{item.label}</span>
                  <span style={{fontSize:11,fontWeight:700,padding:"3px 12px",borderRadius:20,background:opt.bg,color:opt.text}}>{opt.label}</span>
                </div>
              );
            })}
            {selParte.observaciones&&(
              <div style={{marginTop:12,background:"#f8f7f4",borderRadius:8,padding:"10px 12px",fontSize:13,color:"#555"}}>{selParte.observaciones}</div>
            )}
            <button style={{width:"100%",marginTop:16,padding:"12px",borderRadius:10,border:"1.5px solid #e2dfd8",background:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:14,fontWeight:600}} onClick={()=>setSelParte(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
