import { useState, useEffect } from "react";
import { supabase } from './supabase.js';

const pad=(n)=>String(n).padStart(2,"0");
const todayStr=()=>{const d=new Date();return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
const fmtDate=(d)=>{if(!d)return"—";const[y,mo,day]=d.split("-");return`${day}/${mo}/${y}`;};

const ESTADOS={
  pendiente:{bg:"#fef9c3",text:"#854d0e",label:"Pendiente"},
  realizado:{bg:"#dcfce7",text:"#166534",label:"Realizado"},
};

export default function Visitas({config,userId}){
  const fmt=(n)=>!n||Number(n)===0?"—":`${config.moneda}${Number(n).toLocaleString("es-AR")}`;
  const [visitas,setVisitas]=useState([]);
  const [puestos,setPuestos]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showModal,setShowModal]=useState(false);
  const [editV,setEditV]=useState(null);
  const [saving,setSaving]=useState(false);
  const [filterPuesto,setFilterPuesto]=useState("Todos");
  const [filterEstado,setFilterEstado]=useState("Todos");
  const [form,setForm]=useState({puestoId:"",proveedor:"",motivo:"",fecha:todayStr(),costo:"",estado:"pendiente"});

  useEffect(()=>{load();},[]);

  const load=async()=>{
    setLoading(true);
    const [v,p]=await Promise.all([
      supabase.from('visitas_proveedores').select('*').eq('empresa_id',userId).order('fecha',{ascending:false}),
      supabase.from('puestos').select('*').eq('empresa_id',userId).order('nombre',{ascending:true}),
    ]);
    setVisitas(v.data||[]);
    setPuestos(p.data||[]);
    setLoading(false);
  };

  const puestoName=(id)=>{const p=puestos.find(x=>String(x.id)===String(id));return p?p.nombre:"Sin puesto";};

  const openNew=()=>{setEditV(null);setForm({puestoId:puestos[0]?.id||"",proveedor:"",motivo:"",fecha:todayStr(),costo:"",estado:"pendiente"});setShowModal(true);};
  const openEdit=(v)=>{setEditV(v);setForm({puestoId:v.puesto_id||"",proveedor:v.proveedor,motivo:v.motivo||"",fecha:v.fecha,costo:v.costo||"",estado:v.estado});setShowModal(true);};

  const save=async()=>{
    if(!form.proveedor||!form.fecha)return;
    setSaving(true);
    const payload={
      puesto_id:form.puestoId||null,
      proveedor:form.proveedor,
      motivo:form.motivo,
      fecha:form.fecha,
      costo:Number(form.costo)||0,
      estado:form.estado,
    };
    if(editV){await supabase.from('visitas_proveedores').update(payload).eq('id',editV.id);}
    else{await supabase.from('visitas_proveedores').insert({empresa_id:userId,...payload});}
    await load();setSaving(false);setShowModal(false);
  };

  const del=async(id)=>{await supabase.from('visitas_proveedores').delete().eq('id',id);await load();};
  const toggleEstado=async(v)=>{await supabase.from('visitas_proveedores').update({estado:v.estado==="pendiente"?"realizado":"pendiente"}).eq('id',v.id);await load();};

  const filtered=visitas.filter(v=>{
    if(filterPuesto!=="Todos"&&String(v.puesto_id)!==String(filterPuesto))return false;
    if(filterEstado!=="Todos"&&v.estado!==filterEstado)return false;
    return true;
  });

  // Agrupar por fecha
  const grouped=filtered.reduce((acc,v)=>{(acc[v.fecha]=acc[v.fecha]||[]).push(v);return acc;},{});
  const fechas=Object.keys(grouped).sort((a,b)=>b.localeCompare(a));

  const pendientes=visitas.filter(v=>v.estado==="pendiente").length;
  const costoTotal=visitas.filter(v=>v.estado==="realizado").reduce((a,v)=>a+Number(v.costo||0),0);

  if(loading)return<div className="page"><div style={{textAlign:"center",color:"#aaa",padding:40}}>Cargando visitas...</div></div>;

  return(
    <div className="page">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800}}>Visitas de proveedores</div>
        <button className="btn btn-dark btn-sm" style={{marginLeft:"auto"}} onClick={openNew}>+ Registrar visita</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
        {[{l:"Total visitas",v:visitas.length},{l:"Pendientes",v:pendientes,c:pendientes>0?"#854d0e":"#18181b"},{l:"Costo realizado",v:fmt(costoTotal)}].map((s,i)=>(
          <div key={i} className="stat" style={{textAlign:"center",padding:"12px 10px"}}>
            <div style={{fontSize:9,color:"#aaa",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>{s.l}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,color:s.c||"#18181b"}}>{s.v}</div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        <select className="field" style={{width:"auto",minWidth:160}} value={filterPuesto} onChange={e=>setFilterPuesto(e.target.value)}>
          <option value="Todos">Todos los puestos</option>
          {puestos.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        {[["Todos","Todos"],["pendiente","Pendientes"],["realizado","Realizados"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilterEstado(v)} style={{padding:"3px 12px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:600,border:"1.5px solid",borderColor:filterEstado===v?"#18181b":"#e2dfd8",background:filterEstado===v?"#18181b":"#fff",color:filterEstado===v?"#fff":"#555",fontFamily:"inherit"}}>{l}</button>
        ))}
      </div>

      {fechas.length===0&&<div className="card" style={{padding:28,textAlign:"center",color:"#aaa"}}>Sin visitas registradas</div>}

      {fechas.map(fecha=>(
        <div key={fecha} style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:".06em",marginBottom:6,paddingLeft:2}}>{fmtDate(fecha)}</div>
          <div className="card" style={{padding:6}}>
            {grouped[fecha].map(v=>{
              const est=ESTADOS[v.estado]||ESTADOS.pendiente;
              return(
                <div key={v.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderBottom:"1px solid #f5f3ef"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <div style={{fontWeight:600,fontSize:14}}>{v.proveedor}</div>
                      <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:"#f0ede8",color:"#666"}}>📍 {puestoName(v.puesto_id)}</span>
                    </div>
                    {v.motivo&&<div style={{fontSize:12,color:"#888",marginTop:2}}>{v.motivo}</div>}
                  </div>
                  {Number(v.costo)>0&&<div style={{fontWeight:700,fontSize:13,flexShrink:0}}>{fmt(v.costo)}</div>}
                  <button onClick={()=>toggleEstado(v)} title="Cambiar estado" style={{fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:10,background:est.bg,color:est.text,border:"none",cursor:"pointer",flexShrink:0,fontFamily:"inherit"}}>{est.label}</button>
                  <button className="btn btn-outline btn-sm" onClick={()=>openEdit(v)}>✏️</button>
                  <button className="btn btn-outline btn-sm" style={{color:"#ef4444",borderColor:"#fecaca"}} onClick={()=>del(v.id)}>🗑</button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {showModal&&(
        <div className="modal-bg" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:800,marginBottom:14}}>{editV?"Editar visita":"Registrar visita"}</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:3}}>Puesto</label>
                <select className="field" value={form.puestoId} onChange={e=>setForm(p=>({...p,puestoId:e.target.value}))}>
                  <option value="">— Sin puesto —</option>
                  {puestos.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:3}}>Proveedor *</label>
                <input className="field" placeholder="Ej: Empresa de cámaras, Satelital..." value={form.proveedor} onChange={e=>setForm(p=>({...p,proveedor:e.target.value}))} autoFocus/>
              </div>
              <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:3}}>Motivo</label>
                <textarea className="field" rows={2} placeholder="Mantenimiento, reparación, revisión..." value={form.motivo} onChange={e=>setForm(p=>({...p,motivo:e.target.value}))} style={{resize:"vertical"}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:3}}>Fecha *</label>
                  <input className="field" type="date" value={form.fecha} onChange={e=>setForm(p=>({...p,fecha:e.target.value}))}/>
                </div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:3}}>Costo</label>
                  <input className="field" type="number" placeholder="0" value={form.costo} onChange={e=>setForm(p=>({...p,costo:e.target.value}))}/>
                </div>
              </div>
              <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:3}}>Estado</label>
                <div style={{display:"flex",gap:6}}>
                  {Object.entries(ESTADOS).map(([k,v])=>(
                    <button key={k} onClick={()=>setForm(p=>({...p,estado:k}))} style={{flex:1,padding:"7px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,border:"1.5px solid",borderColor:form.estado===k?v.text:"#e2dfd8",background:form.estado===k?v.bg:"#fff",color:form.estado===k?v.text:"#888",fontFamily:"inherit"}}>{v.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:14,justifyContent:"flex-end"}}>
              <button className="btn btn-outline" onClick={()=>setShowModal(false)}>Cancelar</button>
              <button className="btn btn-dark" onClick={save} disabled={saving||!form.proveedor}>{saving?"Guardando...":editV?"Guardar":"Registrar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
