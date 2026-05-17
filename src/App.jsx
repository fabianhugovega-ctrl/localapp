import { useState, useEffect } from "react";
import { supabase } from './supabase.js';
import Proformas from './Proformas.jsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// ══════════════════════════════════════════════════════════════════
// CONFIG & CONSTANTS
// ══════════════════════════════════════════════════════════════════
const DEFAULT_CONFIG = {
  appName: "LocalApp", appIcon: "🏪", moneda: "$", accentColor: "#18181b",
  clientTags: ["VIP","frecuente","nuevo","mayorista","ocasional"],
  catIngreso: ["Venta","Otro ingreso"],
  catEgreso: ["Proveedor","Servicios","Alquiler","Personal","Otro gasto"],
  services: ["Corte","Coloración","Consulta","Servicio general","Entrega"],
};
const ACCENT_OPTIONS = [
  {label:"Carbón",value:"#18181b"},{label:"Índigo",value:"#312e81"},
  {label:"Esmeralda",value:"#064e3b"},{label:"Bordo",value:"#4c0519"},
  {label:"Azul marino",value:"#1e3a5f"},{label:"Cobre",value:"#7c2d12"},
];
const ICON_OPTIONS = ["🏪","🛍️","✂️","🍕","🔧","💇","👗","📦","🏋️","🌿","💅","🥐","🛒","🎨","🏥"];
const TAG_PALETTE = [
  {bg:"#fff8e1",text:"#b8860b",border:"#f0c040"},{bg:"#e8f5e9",text:"#2e7d32",border:"#81c784"},
  {bg:"#e3f2fd",text:"#1565c0",border:"#64b5f6"},{bg:"#f3e5f5",text:"#7b1fa2",border:"#ce93d8"},
  {bg:"#fce4ec",text:"#c62828",border:"#ef9a9a"},{bg:"#e0f7fa",text:"#00695c",border:"#80cbc4"},
  {bg:"#fff3e0",text:"#e65100",border:"#ffb74d"},{bg:"#f1f8e9",text:"#558b2f",border:"#aed581"},
];
const APPT_COLORS = [
  {label:"Índigo",value:"#6366f1"},{label:"Cian",value:"#0891b2"},
  {label:"Ámbar",value:"#d97706"},{label:"Verde",value:"#16a34a"},
  {label:"Rosa",value:"#db2777"},{label:"Violeta",value:"#7c3aed"},
  {label:"Naranja",value:"#ea580c"},{label:"Pizarra",value:"#475569"},
];
const STATUS_STYLES = {
  confirmado:{bg:"#dcfce7",text:"#166534",label:"Confirmado"},
  pendiente:{bg:"#fef9c3",text:"#854d0e",label:"Pendiente"},
  cancelado:{bg:"#fee2e2",text:"#7f1d1d",label:"Cancelado"},
  completado:{bg:"#e0e7ff",text:"#3730a3",label:"Completado"},
};
const DAYS=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const DAYS_FULL=["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const MONTHS=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const HOURS=Array.from({length:14},(_,i)=>i+8);

// ══════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════
const pad=(n)=>String(n).padStart(2,"0");
const fmtHour=(h,m=0)=>`${pad(h)}:${pad(m)}`;
const fmtDate=(d)=>{if(!d)return"—";const[y,mo,day]=d.split("-");return`${day}/${mo}/${y}`;};
const todayStr=()=>{const d=new Date();return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
const todayDate=()=>new Date();
const dateKey=(d)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const isSameDay=(a,b)=>dateKey(a)===dateKey(b);
const mkId=()=>Date.now()+Math.random();
const avatarBg=(id)=>`hsl(${id*67%360},55%,88%)`;
const avatarTxt=(id)=>`hsl(${id*67%360},55%,32%)`;
const tagColor=(tag,allTags)=>TAG_PALETTE[Math.max(0,allTags.indexOf(tag))%TAG_PALETTE.length];
const getWeekDates=(base)=>{const d=new Date(base);const day=d.getDay();const mon=new Date(d);mon.setDate(d.getDate()-(day===0?6:day-1));return Array.from({length:7},(_,i)=>{const dd=new Date(mon);dd.setDate(mon.getDate()+i);return dd;});};
const useIsMobile=()=>window.innerWidth<768;

// ══════════════════════════════════════════════════════════════════
// GLOBAL STYLES
// ══════════════════════════════════════════════════════════════════
const makeStyles=(accent)=>`

*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Instrument Sans',sans-serif;overflow-x:hidden}
::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:#d4d0c8;border-radius:3px}
input,textarea,select{font-family:'Instrument Sans',sans-serif}
.btn{cursor:pointer;border:none;border-radius:9px;font-family:'Instrument Sans',sans-serif;font-weight:600;transition:all .14s}
.btn:hover{filter:brightness(0.88);transform:translateY(-1px)}
.btn:active{transform:translateY(0)}
.btn-dark{background:${accent};color:#fff;padding:9px 18px;font-size:13px}
.btn-outline{background:transparent;color:#444;padding:8px 14px;font-size:13px;border:1.5px solid #e2dfd8}
.btn-outline:hover{background:#f5f3ef;filter:none}
.btn-green{background:#166534;color:#fff;padding:9px 18px;font-size:13px}
.btn-red{background:#7f1d1d;color:#fff;padding:7px 12px;font-size:12px}
.btn-sm{padding:5px 11px;font-size:12px}
.btn-icon{width:30px;height:30px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;background:#f5f3ef;border:1.5px solid #e2dfd8;cursor:pointer;font-size:15px;transition:all .14s;flex-shrink:0}
.btn-icon:hover{background:#e8e4dc}
.field{background:#f8f7f4;border:1.5px solid #e2dfd8;border-radius:9px;padding:9px 13px;font-size:14px;color:#18181b;width:100%;outline:none;transition:border .14s}
.field:focus{border-color:${accent};background:#fff}
.card{background:#fff;border-radius:16px;border:1px solid #e8e4dc}
.nav-btn{display:flex;align-items:center;gap:9px;padding:9px 12px;border-radius:9px;cursor:pointer;font-size:13px;font-weight:600;transition:all .14s;color:#666;border:none;background:transparent;width:100%;text-align:left}
.nav-btn:hover{background:#f0ede6;color:#18181b}
.nav-btn.on{background:${accent};color:#fff}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:200;backdrop-filter:blur(3px)}
.modal{background:#fff;border-radius:20px;padding:20px;width:calc(100% - 32px);max-width:460px;box-shadow:0 24px 64px rgba(0,0,0,.2);max-height:90vh;overflow-y:auto}
.sec{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#aaa;margin-bottom:10px}
.stat{background:#fff;border-radius:12px;padding:12px 14px;border:1px solid #e8e4dc;flex:1;min-width:0}
.pill{padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700;display:inline-flex;align-items:center}
.pill-green{background:#dcfce7;color:#166534}
.pill-red{background:#fee2e2;color:#7f1d1d}
.pill-yellow{background:#fef9c3;color:#854d0e}
.tag{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;border:1px solid}
.tag-chip{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;border:1.5px solid #e2dfd8;background:#fff;margin:3px}
.alert-banner{background:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;padding:10px 14px;display:flex;align-items:center;gap:10px;margin-bottom:14px}
.row-h{border-radius:11px;cursor:pointer;transition:all .14s;border:1.5px solid transparent}
.row-h:hover{background:#f8f7f4;border-color:#e2dfd8}
.hour-cell{border-top:1px solid #f0ede6;position:relative}
.appt-block{border-radius:8px;padding:5px 8px;cursor:pointer;transition:all .14s;overflow:hidden;border-left:3px solid;position:absolute}
.appt-block:hover{filter:brightness(0.92);z-index:10}
.settings-section{background:#fafaf8;border:1.5px solid #e8e4dc;border-radius:14px;padding:16px;margin-bottom:14px}
.mobile-nav{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e8e4dc;display:flex;z-index:100;padding-bottom:env(safe-area-inset-bottom,8px)}
.mobile-nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;padding:8px 2px 6px;border:none;background:transparent;cursor:pointer;font-family:inherit;font-size:10px;font-weight:600;gap:2px;position:relative;transition:all .12s}
.page{padding:16px;overflow:auto}
@media(min-width:768px){.page{padding:24px}}
`;

// ══════════════════════════════════════════════════════════════════
// ROOT APP
// ══════════════════════════════════════════════════════════════════
export default function App() {
  const isMobile = useIsMobile();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [tab, setTab] = useState("dashboard");
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selClient, setSelClient] = useState(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [c, p, m, a, r, v] = await Promise.all([
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('movements').select('*').order('date', { ascending: false }),
        supabase.from('appointments').select('*').order('date', { ascending: true }),
        supabase.from('reminders').select('*'),
        supabase.from('visits').select('*').order('date', { ascending: false }),
      ]);
      const remindersData = r.data || [];
      const visitsData = v.data || [];
      const clientsWithData = (c.data || []).map(cl => ({
        ...cl, tags: cl.tags || [],
        reminders: remindersData.filter(rem => rem.client_id === cl.id),
        visits: visitsData.filter(vis => vis.client_id === cl.id),
        totalSpent: cl.total_spent || 0, lastVisit: cl.last_visit,
      }));
      setClients(clientsWithData);
      setProducts(p.data || []);
      setMovements(m.data || []);
      setAppointments((a.data || []).map(ap => ({ ...ap, clientName: ap.client_name })));
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const fmt=(n)=>n===0?"—":`${config.moneda}${Number(n).toLocaleString("es-AR")}`;
  const tColor=(t)=>tagColor(t,config.clientTags);
  const lowStock=products.filter(p=>p.stock<=p.min_stock);
  const totalRem=clients.reduce((a,c)=>a+(c.reminders||[]).filter(r=>!r.done).length,0);
  const todayAppts=appointments.filter(a=>a.date===todayStr()&&a.status!=="cancelado").length;
  const totalIngresos=movements.filter(m=>m.type==="ingreso").reduce((a,m)=>a+Number(m.amount),0);
  const totalEgresos=movements.filter(m=>m.type==="egreso").reduce((a,m)=>a+Number(m.amount),0);
  const saldo=totalIngresos-totalEgresos;

  const NAV=[
    {key:"dashboard",icon:"◈",label:"Panel"},
    {key:"clientes",icon:"◉",label:"Clientes"},
    {key:"agenda",icon:"◷",label:"Agenda",badge:todayAppts},
    {key:"stock",icon:"▦",label:"Stock",badge:lowStock.length},
    {key:"caja",icon:"◎",label:"Caja"},
    {key:"proformas",icon:"🧾",label:"Proformas"},
  ];
  const NAV2=[
    {key:"config",icon:"⚙",label:"Config"},
  ];

  const changeTab=(k)=>{setTab(k);setSelClient(null);};

  if(loading) return (
    <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f5f3ef",fontFamily:"'Instrument Sans',sans-serif"}}>
      <style>{makeStyles(config.accentColor)}</style>
      <div style={{textAlign:"center"}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,marginBottom:8}}>{config.appIcon} {config.appName}</div>
        <div style={{color:"#aaa",fontSize:14}}>Cargando...</div>
      </div>
    </div>
  );

  return (
    <div style={{display:"flex",height:"100vh",background:"#f5f3ef",fontFamily:"'Instrument Sans',sans-serif",overflow:"hidden"}}>
      <style>{makeStyles(config.accentColor)}</style>

      {/* SIDEBAR — solo desktop */}
      {!isMobile && (
        <div style={{width:210,flexShrink:0,background:"#fff",borderRight:"1px solid #e8e4dc",display:"flex",flexDirection:"column",padding:"18px 10px"}}>
          <div style={{paddingLeft:6,marginBottom:24,display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,background:config.accentColor,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{config.appIcon}</div>
            <div>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,color:"#18181b",letterSpacing:"-0.03em",lineHeight:1}}>{config.appName}</div>
              <div style={{fontSize:11,color:"#aaa",marginTop:2}}>gestión integral</div>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:3}}>
            {[...NAV,...NAV2].map(({key,icon,label,badge})=>(
              <button key={key} className={`nav-btn${tab===key?" on":""}`} onClick={()=>changeTab(key)}>
                <span style={{fontSize:16,fontFamily:"monospace",flexShrink:0}}>{icon}</span>
                <span style={{flex:1}}>{label}</span>
                {badge>0&&<span style={{background:tab===key?"rgba(255,255,255,0.25)":"#ef4444",color:"#fff",borderRadius:20,fontSize:10,fontWeight:700,padding:"1px 6px"}}>{badge}</span>}
              </button>
            ))}
          </div>
          <div style={{marginTop:"auto",padding:"10px 2px"}}>
            {totalRem>0&&<div style={{background:"#fef9c3",border:"1.5px solid #fde047",borderRadius:10,padding:"9px 12px",fontSize:12,color:"#854d0e",fontWeight:600,cursor:"pointer",marginBottom:8}} onClick={()=>changeTab("clientes")}>🔔 {totalRem} recordatorio{totalRem>1?"s":""}</div>}
            <div style={{fontSize:11,color:"#ccc",textAlign:"center"}}>v1.0 — {config.appName}</div>
          </div>
        </div>
      )}

      {/* CONTENT */}
      <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column",paddingBottom:isMobile?64:0}}>
        {/* Header mobile */}
        {isMobile && (
          <div style={{background:"#fff",borderBottom:"1px solid #e8e4dc",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,position:"sticky",top:0,zIndex:50}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:30,height:30,background:config.accentColor,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{config.appIcon}</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,color:"#18181b"}}>{config.appName}</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {totalRem>0&&<span style={{background:"#ef4444",color:"#fff",borderRadius:20,fontSize:10,fontWeight:700,padding:"2px 7px"}}>🔔{totalRem}</span>}
              {lowStock.length>0&&<span style={{background:"#d97706",color:"#fff",borderRadius:20,fontSize:10,fontWeight:700,padding:"2px 7px"}}>⚠️{lowStock.length}</span>}
            </div>
          </div>
        )}

        {tab==="dashboard" && <Dashboard clients={clients} products={products} movements={movements} appointments={appointments} saldo={saldo} totalIngresos={totalIngresos} totalEgresos={totalEgresos} lowStock={lowStock} setTab={changeTab} fmt={fmt} config={config} tColor={tColor} isMobile={isMobile}/>}
        {tab==="clientes" && <Clientes clients={clients} setClients={setClients} products={products} setMovements={setMovements} movements={movements} selClient={selClient} setSelClient={setSelClient} config={config} fmt={fmt} tColor={tColor} reload={loadAll} isMobile={isMobile}/>}
        {tab==="agenda" && <Agenda appointments={appointments} setAppointments={setAppointments} clients={clients} config={config} reload={loadAll} isMobile={isMobile}/>}
        {tab==="stock" && <Stock products={products} setProducts={setProducts} lowStock={lowStock} fmt={fmt} reload={loadAll} isMobile={isMobile}/>}
        {tab==="caja" && <Caja movements={movements} setMovements={setMovements} clients={clients} saldo={saldo} totalIngresos={totalIngresos} totalEgresos={totalEgresos} config={config} fmt={fmt} reload={loadAll} isMobile={isMobile}/>}
        {tab==="proformas" && <Proformas clients={clients} products={products} config={config}/>}
        {tab==="config" && <Config config={config} setConfig={setConfig} reload={loadAll}/>}
      </div>

      {/* NAV MOBILE — barra inferior */}
      {isMobile && (
        <div className="mobile-nav">
          {NAV.map(({key,icon,label,badge})=>(
            <button key={key} className="mobile-nav-btn" onClick={()=>changeTab(key)}
              style={{color:tab===key?config.accentColor:"#888"}}>
              <span style={{fontSize:22,lineHeight:1}}>{icon}</span>
              <span>{label}</span>
              {badge>0&&<span style={{position:"absolute",top:4,right:"10%",background:"#ef4444",color:"#fff",borderRadius:20,fontSize:9,fontWeight:700,padding:"1px 4px"}}>{badge}</span>}
            </button>
          ))}
          <button className="mobile-nav-btn" onClick={()=>changeTab(tab==="config"?"dashboard":"config")}
            style={{color:tab==="config"?config.accentColor:"#888"}}>
            <span style={{fontSize:22,lineHeight:1}}>⚙</span>
            <span>Config</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════
function Dashboard({clients,products,movements,appointments,saldo,totalIngresos,totalEgresos,lowStock,setTab,fmt,config,tColor,isMobile}){
  const recentMovs=[...movements].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,5);
  const topClients=[...clients].sort((a,b)=>b.totalSpent-a.totalSpent).slice(0,4);
  const todayAppts=appointments.filter(a=>a.date===todayStr()).sort((a,b)=>a.hour-b.hour);
  const pendingRem=clients.flatMap(c=>(c.reminders||[]).filter(r=>!r.done).map(r=>({...r,clientName:c.name}))).slice(0,4);

  // Gráfico últimos 6 meses
  const chartData=Array.from({length:6},(_,i)=>{
    const d=new Date();d.setMonth(d.getMonth()-5+i);
    const key=`${d.getFullYear()}-${pad(d.getMonth()+1)}`;
    const label=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][d.getMonth()];
    const ing=movements.filter(m=>m.type==="ingreso"&&(m.date||"").startsWith(key)).reduce((a,m)=>a+Number(m.amount),0);
    const eg=movements.filter(m=>m.type==="egreso"&&(m.date||"").startsWith(key)).reduce((a,m)=>a+Number(m.amount),0);
    return{label,Ingresos:ing,Egresos:eg};
  });

  const stats=[
    {label:"Saldo",value:fmt(saldo),color:saldo>=0?"#166534":"#7f1d1d"},
    {label:"Ingresos",value:fmt(totalIngresos),color:"#166534"},
    {label:"Egresos",value:fmt(totalEgresos),color:"#7f1d1d"},
    {label:"Clientes",value:clients.length,color:"#18181b"},
    {label:"Turnos hoy",value:todayAppts.length,color:"#6366f1"},
    {label:"Stock bajo",value:lowStock.length,color:lowStock.length>0?"#d97706":"#18181b"},
  ];

  return(
    <div className="page">
      {!isMobile && <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,letterSpacing:"-0.03em",marginBottom:4}}>Dashboard</div>}
      {!isMobile && <div style={{color:"#888",fontSize:13,marginBottom:16}}>Bienvenido a {config.appName}</div>}

      {lowStock.length>0&&<div className="alert-banner"><span>⚠️</span><span style={{fontWeight:700,fontSize:13}}>Stock bajo: {lowStock.map(p=>p.name).join(", ")}</span><button className="btn btn-outline btn-sm" style={{marginLeft:"auto"}} onClick={()=>setTab("stock")}>Ver</button></div>}

      {/* Stats grid — 3 columnas en mobile, 6 en desktop */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(3,1fr)":"repeat(6,1fr)",gap:8,marginBottom:16}}>
        {stats.map((s,i)=>(
          <div key={i} className="stat" style={{textAlign:"center",padding:isMobile?"10px 6px":"12px 14px"}}>
            <div style={{fontSize:9,color:"#aaa",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:3,lineHeight:1.2}}>{s.label}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:isMobile?15:20,fontWeight:800,color:s.color,lineHeight:1}}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Gráfico */}
      <div className="card" style={{padding:16,marginBottom:16}}>
        <div className="sec">Ingresos vs Egresos — últimos 6 meses</div>
        <ResponsiveContainer width="100%" height={isMobile?150:200}>
          <BarChart data={chartData} margin={{top:0,right:0,left:-20,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ede6"/>
            <XAxis dataKey="label" tick={{fontSize:11,fill:"#aaa"}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:10,fill:"#aaa"}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
            <Tooltip formatter={(v)=>[fmt(v)]} contentStyle={{borderRadius:10,border:"1px solid #e8e4dc",fontSize:12}}/>
            <Bar dataKey="Ingresos" fill="#86efac" radius={[4,4,0,0]}/>
            <Bar dataKey="Egresos" fill="#fca5a5" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12,marginBottom:12}}>
        {/* Movimientos */}
        <div className="card" style={{padding:16}}>
          <div className="sec">Últimos movimientos</div>
          {recentMovs.map(m=>(
            <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid #f5f3ef"}}>
              <span className={`pill ${m.type==="ingreso"?"pill-green":"pill-red"}`}>{m.type==="ingreso"?"↑":"↓"}</span>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.description}</div><div style={{fontSize:11,color:"#aaa"}}>{fmtDate(m.date)}</div></div>
              <div style={{fontWeight:700,fontSize:13,color:m.type==="ingreso"?"#166534":"#7f1d1d",flexShrink:0,whiteSpace:"nowrap"}}>{m.type==="ingreso"?"+":"-"}{fmt(m.amount)}</div>
            </div>
          ))}
          {recentMovs.length===0&&<div style={{color:"#aaa",fontSize:13,textAlign:"center",padding:12}}>Sin movimientos</div>}
        </div>

        {/* Turnos hoy */}
        <div className="card" style={{padding:16}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div className="sec" style={{marginBottom:0}}>Turnos de hoy</div>
            <button className="btn btn-outline btn-sm" onClick={()=>setTab("agenda")}>Ver</button>
          </div>
          {todayAppts.map(a=>(
            <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid #f5f3ef"}}>
              <div style={{width:4,height:32,borderRadius:2,background:a.color,flexShrink:0}}/>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{a.client_name||a.clientName}</div><div style={{fontSize:11,color:"#aaa"}}>{fmtHour(a.hour,a.minute||0)} · {a.service}</div></div>
              <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:10,background:STATUS_STYLES[a.status]?.bg,color:STATUS_STYLES[a.status]?.text,flexShrink:0}}>{STATUS_STYLES[a.status]?.label}</span>
            </div>
          ))}
          {todayAppts.length===0&&<div style={{color:"#aaa",fontSize:13,textAlign:"center",padding:12}}>Sin turnos hoy</div>}
        </div>
      </div>

      {!isMobile && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div className="card" style={{padding:16}}>
            <div className="sec">Top clientes</div>
            {topClients.map((c,i)=>(
              <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid #f5f3ef"}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:800,color:"#d4d0c8",width:20}}>{i+1}</div>
                <div style={{width:32,height:32,borderRadius:"50%",background:avatarBg(c.id),color:avatarTxt(c.id),display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:13,flexShrink:0}}>{c.name[0]}</div>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{c.name}</div><div style={{fontSize:11,color:"#aaa"}}>{(c.visits||[]).length} visitas</div></div>
                <div style={{fontWeight:700,fontSize:13}}>{fmt(c.totalSpent||0)}</div>
              </div>
            ))}
            {topClients.length===0&&<div style={{color:"#aaa",fontSize:13,textAlign:"center",padding:12}}>Sin clientes</div>}
          </div>
          <div className="card" style={{padding:16}}>
            <div className="sec">Recordatorios pendientes</div>
            {pendingRem.map(r=>(
              <div key={r.id} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:"1px solid #f5f3ef",alignItems:"flex-start"}}>
                <span style={{fontSize:14}}>🔔</span>
                <div><div style={{fontSize:13,fontWeight:600}}>{r.text}</div><div style={{fontSize:11,color:"#aaa"}}>{r.clientName} · {fmtDate(r.date)}</div></div>
              </div>
            ))}
            {pendingRem.length===0&&<div style={{color:"#aaa",fontSize:13,textAlign:"center",padding:12}}>Sin recordatorios 🎉</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// CLIENTES
// ══════════════════════════════════════════════════════════════════
function Clientes({clients,setClients,products,setMovements,movements,selClient,setSelClient,config,fmt,tColor,reload,isMobile}){
  const [search,setSearch]=useState("");
  const [filterTag,setFilterTag]=useState("Todos");
  const [showNew,setShowNew]=useState(false);
  const [showSale,setShowSale]=useState(false);
  const [showRem,setShowRem]=useState(false);
  const [newC,setNewC]=useState({name:"",phone:"",email:"",tags:"",notes:""});
  const [saleItems,setSaleItems]=useState([{productId:"",qty:1}]);
  const [saleDate,setSaleDate]=useState(todayStr());
  const [saleDesc,setSaleDesc]=useState("");
  const [newRem,setNewRem]=useState({text:"",date:""});
  const [editNote,setEditNote]=useState(false);
  const [noteVal,setNoteVal]=useState("");
  const [saving,setSaving]=useState(false);

  useEffect(()=>{if(selClient){setNoteVal(selClient.notes||"");setEditNote(false);}},[selClient]);

  const allTags=["Todos",...config.clientTags];
  const filtered=clients.filter(c=>{
    const ms=c.name.toLowerCase().includes(search.toLowerCase())||(c.phone||"").includes(search);
    const mt=filterTag==="Todos"||(c.tags||[]).includes(filterTag);
    return ms&&mt;
  });

  const addClient=async()=>{
    if(!newC.name)return;setSaving(true);
    const tags=newC.tags?newC.tags.split(",").map(t=>t.trim()):[];
    const{data,error}=await supabase.from('clients').insert({name:newC.name,phone:newC.phone,email:newC.email,tags,notes:newC.notes,total_spent:0}).select().single();
    if(!error&&data){await reload();}
    setSaving(false);setShowNew(false);setNewC({name:"",phone:"",email:"",tags:"",notes:""});
  };

  const saveNote=async()=>{
    if(!selClient)return;
    await supabase.from('clients').update({notes:noteVal}).eq('id',selClient.id);
    await reload();setEditNote(false);
  };

  const addRem=async()=>{
    if(!newRem.text||!newRem.date||!selClient)return;
    await supabase.from('reminders').insert({client_id:selClient.id,text:newRem.text,date:newRem.date,done:false});
    await reload();setNewRem({text:"",date:""});setShowRem(false);
  };

  const toggleRem=async(rem)=>{
    await supabase.from('reminders').update({done:!rem.done}).eq('id',rem.id);await reload();
  };
  const deleteRem=async(remId)=>{
    await supabase.from('reminders').delete().eq('id',remId);await reload();
  };

  const saleTotal=saleItems.reduce((a,si)=>{const p=products.find(p=>p.id===Number(si.productId));return a+(p?p.price*si.qty:0);},0);

  const addSale=async()=>{
    const valid=saleItems.filter(si=>si.productId&&si.qty>0);if(!valid.length||!selClient)return;
    setSaving(true);
    const desc=saleDesc||`Venta a ${selClient.name}`;
    await supabase.from('visits').insert({client_id:selClient.id,date:saleDate,description:desc,amount:saleTotal});
    await supabase.from('clients').update({total_spent:(selClient.totalSpent||0)+saleTotal,last_visit:saleDate}).eq('id',selClient.id);
    await supabase.from('movements').insert({type:'ingreso',category:config.catIngreso[0],description:desc,amount:saleTotal,date:saleDate,client_id:selClient.id});
    await reload();setSaleItems([{productId:"",qty:1}]);setSaleDesc("");setSaleDate(todayStr());setShowSale(false);setSaving(false);
  };

  useEffect(()=>{if(selClient){const updated=clients.find(c=>c.id===selClient.id);if(updated)setSelClient(updated);}},[clients]);

  if(selClient){
    const sc=clients.find(c=>c.id===selClient.id)||selClient;
    return(
      <div className="page">
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          <button className="btn btn-outline btn-sm" onClick={()=>setSelClient(null)}>← Volver</button>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:isMobile?18:22,fontWeight:800}}>{sc.name}</div>
            <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}>{(sc.tags||[]).map(t=>{const tc=tColor(t);return<span key={t} className="tag" style={{background:tc.bg,color:tc.text,borderColor:tc.border}}>{t}</span>;})}</div>
          </div>
          <button className="btn btn-green btn-sm" onClick={()=>setShowSale(true)}>+ Venta</button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"320px 1fr",gap:12,alignItems:"start"}}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div className="card" style={{padding:16}}>
              <div className="sec">Contacto</div>
              {[["📱",sc.phone||"—"],["✉️",sc.email||"Sin email"],["💰",fmt(sc.totalSpent||0)+" total"]].map(([ic,v],i)=>(
                <div key={i} style={{display:"flex",gap:10,alignItems:"center",padding:"6px 0",borderBottom:"1px solid #f5f3ef"}}><span style={{fontSize:15}}>{ic}</span><span style={{fontSize:13.5}}>{v}</span></div>
              ))}
              {sc.phone&&sc.phone!=="—"&&<a href={`https://wa.me/54${sc.phone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"#dcfce7",borderRadius:10,color:"#166534",fontWeight:700,fontSize:13.5,textDecoration:"none",marginTop:8,border:"1.5px solid #86efac"}}><span style={{fontSize:20}}>💬</span> Abrir WhatsApp</a>}
            </div>

            <div className="card" style={{padding:16}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}><div className="sec" style={{marginBottom:0}}>Notas</div>{!editNote&&<button className="btn btn-outline btn-sm" onClick={()=>setEditNote(true)}>Editar</button>}</div>
              {editNote?<><textarea className="field" rows={3} value={noteVal} onChange={e=>setNoteVal(e.target.value)} style={{resize:"vertical"}} autoFocus/><div style={{display:"flex",gap:8,marginTop:8,justifyContent:"flex-end"}}><button className="btn btn-outline btn-sm" onClick={()=>setEditNote(false)}>Cancelar</button><button className="btn btn-dark btn-sm" onClick={saveNote}>Guardar</button></div></>
              :<div style={{fontSize:13.5,color:noteVal?"#18181b":"#aaa",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{noteVal||"Sin notas."}</div>}
            </div>

            <div className="card" style={{padding:16}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}><div className="sec" style={{marginBottom:0}}>Recordatorios</div><button className="btn btn-outline btn-sm" onClick={()=>setShowRem(true)}>+ Agregar</button></div>
              {(sc.reminders||[]).length===0&&<div style={{color:"#aaa",fontSize:13,textAlign:"center",padding:"8px 0"}}>Sin recordatorios</div>}
              {(sc.reminders||[]).map(r=>(
                <div key={r.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"9px 11px",borderRadius:10,border:"1.5px solid #ede9e3",marginBottom:7,background:"#fafaf8",opacity:r.done?.55:1}}>
                  <input type="checkbox" checked={r.done} onChange={()=>toggleRem(r)} style={{marginTop:3,accentColor:"#18181b",cursor:"pointer"}}/>
                  <div style={{flex:1}}><div style={{fontSize:13.5,textDecoration:r.done?"line-through":"none"}}>{r.text}</div><div style={{fontSize:11.5,color:"#aaa",marginTop:2}}>📅 {fmtDate(r.date)}</div></div>
                  <button className="btn btn-red btn-sm" onClick={()=>deleteRem(r.id)}>✕</button>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{padding:16}}>
            <div className="sec">Historial ({(sc.visits||[]).length})</div>
            {(sc.visits||[]).length===0&&<div style={{color:"#aaa",fontSize:13,textAlign:"center",padding:"20px 0"}}>Sin visitas</div>}
            {(sc.visits||[]).map((v,i)=>(
              <div key={i} style={{padding:"10px 12px",borderRadius:11,border:"1.5px solid #ede9e3",marginBottom:8,background:"#fafaf8"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div><div style={{fontSize:14,fontWeight:600}}>{v.description}</div><div style={{fontSize:12,color:"#aaa",marginTop:2}}>📅 {fmtDate(v.date)}</div></div>
                  <div style={{fontWeight:700,fontSize:14,color:v.amount>0?"#166534":"#aaa",flexShrink:0}}>{v.amount>0?fmt(v.amount):"Sin venta"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {showSale&&<div className="modal-bg" onClick={()=>setShowSale(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:800,marginBottom:14}}>Registrar venta — {sc.name}</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <input className="field" placeholder="Descripción" value={saleDesc} onChange={e=>setSaleDesc(e.target.value)}/>
            <input className="field" type="date" value={saleDate} onChange={e=>setSaleDate(e.target.value)}/>
            <div className="sec" style={{marginBottom:2}}>Productos</div>
            {saleItems.map((si,i)=>(
              <div key={i} style={{display:"flex",gap:8}}>
                <select className="field" style={{flex:2}} value={si.productId} onChange={e=>setSaleItems(p=>p.map((x,j)=>j===i?{...x,productId:e.target.value}:x))}><option value="">— Producto —</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} — {fmt(p.price)}</option>)}</select>
                <input className="field" style={{flex:1,width:60}} type="number" min={1} value={si.qty} onChange={e=>setSaleItems(p=>p.map((x,j)=>j===i?{...x,qty:Number(e.target.value)}:x))}/>
                {saleItems.length>1&&<button className="btn btn-red" onClick={()=>setSaleItems(p=>p.filter((_,j)=>j!==i))}>✕</button>}
              </div>
            ))}
            <button className="btn btn-outline btn-sm" style={{alignSelf:"flex-start"}} onClick={()=>setSaleItems(p=>[...p,{productId:"",qty:1}])}>+ Producto</button>
            {saleTotal>0&&<div style={{background:"#f0fdf4",border:"1.5px solid #86efac",borderRadius:10,padding:"9px 13px",fontWeight:700,fontSize:14,color:"#166534"}}>Total: {fmt(saleTotal)}</div>}
          </div>
          <div style={{display:"flex",gap:8,marginTop:14,justifyContent:"flex-end"}}><button className="btn btn-outline" onClick={()=>setShowSale(false)}>Cancelar</button><button className="btn btn-green" onClick={addSale} disabled={saving}>{saving?"Guardando...":"Confirmar"}</button></div>
        </div></div>}

        {showRem&&<div className="modal-bg" onClick={()=>setShowRem(false)}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:360}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:800,marginBottom:14}}>Nuevo recordatorio</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <input className="field" placeholder="¿Qué tenés que hacer? *" value={newRem.text} onChange={e=>setNewRem(p=>({...p,text:e.target.value}))} autoFocus/>
            <input className="field" type="date" value={newRem.date} onChange={e=>setNewRem(p=>({...p,date:e.target.value}))}/>
          </div>
          <div style={{display:"flex",gap:8,marginTop:14,justifyContent:"flex-end"}}><button className="btn btn-outline" onClick={()=>setShowRem(false)}>Cancelar</button><button className="btn btn-dark" onClick={addRem}>Guardar</button></div>
        </div></div>}
      </div>
    );
  }

  return(
    <div className="page">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        {!isMobile&&<div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800}}>Clientes</div>}
        <input className="field" style={{flex:1,minWidth:150}} placeholder="🔍 Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <button className="btn btn-dark btn-sm" onClick={()=>setShowNew(true)}>+ Nuevo</button>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        {allTags.map(t=>{const tc=t==="Todos"?null:tColor(t);return<button key={t} onClick={()=>setFilterTag(t)} style={{padding:"3px 10px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:600,border:"1.5px solid",borderColor:filterTag===t?(tc?.border||"#18181b"):"#e2dfd8",background:filterTag===t?(tc?.bg||"#18181b"):"#fff",color:filterTag===t?(tc?.text||"#fff"):"#555",fontFamily:"inherit"}}>{t}</button>;})}
      </div>
      <div className="card" style={{padding:6}}>
        {filtered.map(c=>(
          <div key={c.id} className="row-h" style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px"}} onClick={()=>setSelClient(c)}>
            <div style={{width:36,height:36,borderRadius:"50%",background:avatarBg(c.id),color:avatarTxt(c.id),display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,flexShrink:0}}>{c.name[0]}</div>
            <div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:14}}>{c.name}</div><div style={{fontSize:11,color:"#888",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.phone}{c.email?` · ${c.email}`:""}</div></div>
            {!isMobile&&<div style={{display:"flex",gap:4}}>{(c.tags||[]).slice(0,2).map(t=>{const tc=tColor(t);return<span key={t} className="tag" style={{background:tc.bg,color:tc.text,borderColor:tc.border}}>{t}</span>;})}</div>}
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontWeight:700,fontSize:13}}>{fmt(c.totalSpent||0)}</div>
              {!isMobile&&<div style={{fontSize:11,color:"#aaa"}}>{c.lastVisit?`Última: ${fmtDate(c.lastVisit)}`:"Sin visitas"}</div>}
            </div>
            {(c.reminders||[]).filter(r=>!r.done).length>0&&<span style={{background:"#ef4444",color:"#fff",borderRadius:20,fontSize:10,fontWeight:700,padding:"1px 6px"}}>{c.reminders.filter(r=>!r.done).length}</span>}
          </div>
        ))}
        {filtered.length===0&&<div style={{textAlign:"center",padding:28,color:"#aaa"}}>Sin clientes</div>}
      </div>
      {showNew&&<div className="modal-bg" onClick={()=>setShowNew(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:800,marginBottom:14}}>Nuevo cliente</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[["Nombre completo *","name","text"],["Teléfono","phone","text"],["Email","email","email"],["Etiquetas (ej: VIP, frecuente)","tags","text"]].map(([pl,key,type])=><input key={key} className="field" placeholder={pl} type={type} value={newC[key]} onChange={e=>setNewC(p=>({...p,[key]:e.target.value}))}/>)}
          <textarea className="field" placeholder="Notas" rows={2} value={newC.notes} onChange={e=>setNewC(p=>({...p,notes:e.target.value}))}/>
        </div>
        <div style={{display:"flex",gap:8,marginTop:14,justifyContent:"flex-end"}}><button className="btn btn-outline" onClick={()=>setShowNew(false)}>Cancelar</button><button className="btn btn-dark" onClick={addClient} disabled={saving}>{saving?"Guardando...":"Agregar"}</button></div>
      </div></div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// AGENDA
// ══════════════════════════════════════════════════════════════════
function Agenda({appointments,setAppointments,clients,config,reload,isMobile}){
  const [viewMode,setViewMode]=useState(isMobile?"list":"week");
  const [curDate,setCurDate]=useState(todayDate());
  const [showModal,setShowModal]=useState(false);
  const [editAppt,setEditAppt]=useState(null);
  const [selAppt,setSelAppt]=useState(null);
  const [qDate,setQDate]=useState(null);
  const [qHour,setQHour]=useState(null);

  const weekDates=getWeekDates(curDate);
  const go=(dir)=>{const d=new Date(curDate);if(viewMode==="week")d.setDate(d.getDate()+dir*7);else d.setDate(d.getDate()+dir);setCurDate(d);};
  const apptsByDate=(d)=>appointments.filter(a=>a.date===dateKey(d));
  const openNew=(date,hour)=>{setEditAppt(null);setQDate(date||todayStr());setQHour(hour||9);setShowModal(true);};
  const openEdit=(a)=>{setEditAppt(a);setSelAppt(null);setShowModal(true);};

  const saveAppt=async(form)=>{
    if(form.id){await supabase.from('appointments').update({client_id:form.clientId||null,client_name:form.clientName,service:form.service,date:form.date,hour:form.hour,minute:form.minute||0,duration:form.duration,color:form.color,notes:form.notes,status:form.status}).eq('id',form.id);}
    else{await supabase.from('appointments').insert({client_id:form.clientId||null,client_name:form.clientName,service:form.service,date:form.date,hour:form.hour,minute:form.minute||0,duration:form.duration,color:form.color,notes:form.notes,status:form.status||'confirmado'});}
    await reload();setShowModal(false);
  };

  const delAppt=async(id)=>{await supabase.from('appointments').delete().eq('id',id);await reload();setSelAppt(null);setShowModal(false);};
  const completeAppt=async(id)=>{await supabase.from('appointments').update({status:'completado'}).eq('id',id);await reload();setSelAppt(null);};

  const titleStr=viewMode==="week"?`${MONTHS[weekDates[0].getMonth()].slice(0,3)} ${weekDates[0].getFullYear()}`:`${DAYS[curDate.getDay()]} ${curDate.getDate()} ${MONTHS[curDate.getMonth()].slice(0,3)}`;
  const todayAppts=appointments.filter(a=>a.date===todayStr()).sort((a,b)=>a.hour-b.hour);
  const upcoming=appointments.filter(a=>a.date>=todayStr()&&a.status!=="cancelado").sort((a,b)=>(a.date||"").localeCompare(b.date||"")||a.hour-b.hour);

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      {/* Top bar */}
      <div style={{background:"#fff",borderBottom:"1px solid #e8e4dc",padding:"10px 16px",display:"flex",alignItems:"center",gap:8,flexShrink:0,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button className="btn-icon" onClick={()=>go(-1)}>‹</button>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,minWidth:120,textAlign:"center"}}>{titleStr}</div>
          <button className="btn-icon" onClick={()=>go(1)}>›</button>
        </div>
        <button className="btn btn-outline btn-sm" onClick={()=>setCurDate(todayDate())}>Hoy</button>
        <div style={{display:"flex",gap:2,background:"#f5f3ef",borderRadius:8,padding:3}}>
          {(isMobile?[["list","Lista"],["day","Día"]]:[["week","Semana"],["day","Día"],["list","Lista"]]).map(([v,l])=>(
            <button key={v} onClick={()=>setViewMode(v)} style={{padding:"4px 10px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:600,border:"none",background:viewMode===v?"#fff":"transparent",color:viewMode===v?"#18181b":"#888",fontFamily:"inherit"}}>{l}</button>
          ))}
        </div>
        <button className="btn btn-dark btn-sm" style={{marginLeft:"auto"}} onClick={()=>openNew()}>+ Turno</button>
      </div>

      <div style={{flex:1,overflow:"hidden",display:"flex"}}>
        {/* WEEK VIEW */}
        {viewMode==="week"&&!isMobile&&(
          <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column"}}>
            <div style={{display:"grid",gridTemplateColumns:"48px repeat(7,1fr)",background:"#fff",borderBottom:"1.5px solid #e8e4dc",flexShrink:0,position:"sticky",top:0,zIndex:10}}>
              <div/>
              {weekDates.map((d,i)=>{const isT=isSameDay(d,todayDate());const cnt=apptsByDate(d).length;return(
                <div key={i} onClick={()=>{setCurDate(d);setViewMode("day");}} style={{padding:"8px 4px",textAlign:"center",cursor:"pointer",borderLeft:"1px solid #f0ede6",background:isT?"#fafafe":"transparent"}}>
                  <div style={{fontSize:10,fontWeight:600,color:"#aaa",textTransform:"uppercase"}}>{DAYS[d.getDay()]}</div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:isT?"#6366f1":"#18181b"}}>{d.getDate()}</div>
                  {cnt>0&&<div style={{fontSize:9,color:isT?"#6366f1":"#aaa",fontWeight:600}}>{cnt}t</div>}
                </div>
              );})}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"48px repeat(7,1fr)",flex:1}}>
              <div>{HOURS.map(h=><div key={h} className="hour-cell" style={{height:52,display:"flex",alignItems:"flex-start",justifyContent:"flex-end",paddingRight:4,paddingTop:3}}><span style={{fontSize:9.5,color:"#bbb"}}>{fmtHour(h)}</span></div>)}</div>
              {weekDates.map((d,di)=>{
                const isT=isSameDay(d,todayDate());
                return(
                  <div key={di} style={{borderLeft:"1px solid #f0ede6",position:"relative",background:isT?"#fafafe":"transparent"}}>
                    {HOURS.map(h=><div key={h} className="hour-cell" style={{height:52,cursor:"pointer"}} onClick={()=>openNew(dateKey(d),h)} onMouseEnter={e=>e.currentTarget.style.background="rgba(99,102,241,.04)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}/>)}
                    {apptsByDate(d).map(a=>{
                      const top=((a.hour-8)*60+(a.minute||0))*52/60;
                      const ht=Math.max(a.duration*52/60-3,18);
                      const isCan=a.status==="cancelado";
                      return<div key={a.id} className="appt-block" style={{top,left:2,right:2,height:ht,background:isCan?"#f5f5f5":a.color+"22",borderLeftColor:isCan?"#ccc":a.color,opacity:isCan?.55:1}} onClick={e=>{e.stopPropagation();setSelAppt(a);}}>
                        <div style={{fontSize:9,fontWeight:700,color:isCan?"#aaa":a.color}}>{fmtHour(a.hour,a.minute||0)}</div>
                        <div style={{fontSize:10,fontWeight:600,color:"#18181b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.client_name||a.clientName}</div>
                      </div>;
                    })}
                    {isT&&(()=>{const now=new Date();const mins=((now.getHours()-8)*60+now.getMinutes())*52/60;if(mins<0)return null;return<div style={{position:"absolute",top:mins,left:0,right:0,height:2,background:"#6366f1",zIndex:5,pointerEvents:"none"}}><div style={{width:6,height:6,borderRadius:"50%",background:"#6366f1",position:"absolute",left:-3,top:-2}}/></div>;})()}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* DAY VIEW */}
        {viewMode==="day"&&(
          <div style={{flex:1,overflow:"auto"}}>
            <div style={{display:"grid",gridTemplateColumns:"48px 1fr"}}>
              <div>{HOURS.map(h=><div key={h} className="hour-cell" style={{height:isMobile?56:70,display:"flex",alignItems:"flex-start",justifyContent:"flex-end",paddingRight:6,paddingTop:3}}><span style={{fontSize:10,color:"#bbb"}}>{fmtHour(h)}</span></div>)}</div>
              <div style={{position:"relative",borderLeft:"1px solid #f0ede6"}}>
                {HOURS.map(h=><div key={h} className="hour-cell" style={{height:isMobile?56:70,cursor:"pointer"}} onClick={()=>openNew(dateKey(curDate),h)} onMouseEnter={e=>e.currentTarget.style.background="rgba(99,102,241,.04)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}/>)}
                {apptsByDate(curDate).map(a=>{
                  const hPx=isMobile?56:70;
                  const top=((a.hour-8)*60+(a.minute||0))*hPx/60;
                  const ht=Math.max(a.duration*hPx/60-4,28);
                  const isCan=a.status==="cancelado";
                  return<div key={a.id} className="appt-block" style={{top,left:6,right:6,height:ht,background:isCan?"#f5f5f5":a.color+"22",borderLeftColor:isCan?"#ccc":a.color,opacity:isCan?.55:1}} onClick={e=>{e.stopPropagation();setSelAppt(a);}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{fontSize:11,fontWeight:700,color:isCan?"#aaa":a.color}}>{fmtHour(a.hour,a.minute||0)}</div><span style={{fontSize:9.5,fontWeight:700,padding:"1px 6px",borderRadius:10,background:STATUS_STYLES[a.status]?.bg,color:STATUS_STYLES[a.status]?.text}}>{STATUS_STYLES[a.status]?.label}</span></div>
                    <div style={{fontSize:13,fontWeight:700,color:"#18181b",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.client_name||a.clientName}</div>
                    {ht>40&&<div style={{fontSize:11,color:"#666",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.service}</div>}
                  </div>;
                })}
                {isSameDay(curDate,todayDate())&&(()=>{const hPx=isMobile?56:70;const now=new Date();const mins=((now.getHours()-8)*60+now.getMinutes())*hPx/60;if(mins<0)return null;return<div style={{position:"absolute",top:mins,left:0,right:0,height:2,background:"#6366f1",zIndex:5,pointerEvents:"none"}}><div style={{width:6,height:6,borderRadius:"50%",background:"#6366f1",position:"absolute",left:-3,top:-2}}/></div>;})()}
              </div>
            </div>
          </div>
        )}

        {/* LIST VIEW */}
        {viewMode==="list"&&(
          <div style={{flex:1,overflow:"auto",padding:isMobile?12:20}}>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
              <div className="card" style={{padding:16}}>
                <div className="sec">Hoy</div>
                {todayAppts.length===0&&<div style={{color:"#aaa",fontSize:13,textAlign:"center",padding:12}}>Sin turnos hoy</div>}
                {todayAppts.map(a=><ApptRow key={a.id} a={a} onClick={()=>setSelAppt(a)}/>)}
              </div>
              <div className="card" style={{padding:16}}>
                <div className="sec">Próximos</div>
                {upcoming.slice(0,10).length===0&&<div style={{color:"#aaa",fontSize:13,textAlign:"center",padding:12}}>Sin turnos</div>}
                {upcoming.slice(0,10).map(a=><ApptRow key={a.id} a={a} showDate onClick={()=>setSelAppt(a)}/>)}
              </div>
            </div>
          </div>
        )}

        {/* Sidebar mini cal — solo desktop */}
        {!isMobile&&(
          <div style={{width:190,background:"#fff",borderLeft:"1px solid #e8e4dc",padding:14,flexShrink:0,overflow:"auto"}}>
            <MiniCal curDate={curDate} setCurDate={(d)=>{setCurDate(d);setViewMode("day");}} appointments={appointments}/>
            <div style={{marginTop:16}}>
              <div className="sec">Stats</div>
              {[["Hoy",todayAppts.length,"#6366f1"],["Pendientes",appointments.filter(a=>a.status==="pendiente").length,"#d97706"],["Cancelados",appointments.filter(a=>a.status==="cancelado").length,"#ef4444"]].map(([l,v,c])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid #f5f3ef"}}>
                  <span style={{fontSize:12,color:"#555"}}>{l}</span>
                  <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:15,color:c}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selAppt&&<div className="modal-bg" onClick={()=>setSelAppt(null)}><div className="modal" style={{maxWidth:360}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <div style={{width:10,height:10,borderRadius:2,background:selAppt.color,flexShrink:0}}/>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:800,flex:1}}>{selAppt.client_name||selAppt.clientName}</div>
          <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:STATUS_STYLES[selAppt.status]?.bg,color:STATUS_STYLES[selAppt.status]?.text}}>{STATUS_STYLES[selAppt.status]?.label}</span>
        </div>
        {[["📅","Fecha",`${(selAppt.date||"").split("-").reverse().join("/")} — ${DAYS_FULL[new Date((selAppt.date||"")+"T12:00").getDay()]}`],["🕐","Horario",`${fmtHour(selAppt.hour,selAppt.minute||0)} (${selAppt.duration} min)`],["✂️","Servicio",selAppt.service||"—"],["📝","Notas",selAppt.notes||"—"]].map(([ic,l,v])=>(
          <div key={l} style={{display:"flex",gap:10,padding:"6px 0",borderBottom:"1px solid #f5f3ef"}}><span style={{fontSize:14,flexShrink:0}}>{ic}</span><div><div style={{fontSize:10,color:"#aaa",fontWeight:600,textTransform:"uppercase"}}>{l}</div><div style={{fontSize:13,marginTop:1}}>{v}</div></div></div>
        ))}
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button className="btn btn-outline btn-sm" style={{flex:1}} onClick={()=>openEdit(selAppt)}>✏️ Editar</button>
          <button className="btn btn-dark btn-sm" style={{flex:1}} onClick={()=>completeAppt(selAppt.id)}>✓ Listo</button>
          <button className="btn btn-outline btn-sm" style={{color:"#ef4444",borderColor:"#fecaca"}} onClick={()=>delAppt(selAppt.id)}>🗑</button>
        </div>
      </div></div>}

      {showModal&&<ApptModal appt={editAppt} clients={clients} services={config.services} defaultDate={qDate||todayStr()} defaultHour={qHour||9} onSave={saveAppt} onDelete={delAppt} onClose={()=>setShowModal(false)}/>}
    </div>
  );
}

function ApptRow({a,showDate=false,onClick}){
  const st=STATUS_STYLES[a.status];
  return<div onClick={onClick} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 8px",borderRadius:9,cursor:"pointer",border:"1.5px solid transparent",marginBottom:4,transition:"all .12s"}} onMouseEnter={e=>{e.currentTarget.style.background="#f8f7f4";e.currentTarget.style.borderColor="#e2dfd8";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="transparent";}}>
    <div style={{width:4,height:32,borderRadius:2,background:a.color,flexShrink:0}}/>
    <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.client_name||a.clientName}</div><div style={{fontSize:11,color:"#888"}}>{showDate?`${(a.date||"").split("-").reverse().join("/")} · `:""}{fmtHour(a.hour,a.minute||0)} · {a.service}</div></div>
    <span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:10,background:st?.bg,color:st?.text,flexShrink:0}}>{st?.label}</span>
  </div>;
}

function MiniCal({curDate,setCurDate,appointments}){
  const [vm,setVm]=useState(new Date(curDate));
  const y=vm.getFullYear(),m=vm.getMonth();
  const first=new Date(y,m,1).getDay();
  const dim=new Date(y,m+1,0).getDate();
  const off=first===0?6:first-1;
  const cells=Array.from({length:off+dim},(_,i)=>i<off?null:i-off+1);
  const has=(day)=>appointments.some(a=>a.date===`${y}-${pad(m+1)}-${pad(day)}`);
  return<div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
      <button className="btn btn-outline btn-sm" style={{padding:"3px 7px"}} onClick={()=>setVm(new Date(y,m-1))}>‹</button>
      <div style={{fontSize:12,fontWeight:700}}>{MONTHS[m].slice(0,3)} {y}</div>
      <button className="btn btn-outline btn-sm" style={{padding:"3px 7px"}} onClick={()=>setVm(new Date(y,m+1))}>›</button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,marginBottom:2}}>{["L","M","X","J","V","S","D"].map(d=><div key={d} style={{textAlign:"center",fontSize:9,color:"#aaa",fontWeight:700}}>{d}</div>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1}}>
      {cells.map((day,i)=>{if(!day)return<div key={i}/>;const d=new Date(y,m,day);const isT=isSameDay(d,todayDate());const isSel=isSameDay(d,curDate);const h=has(day);return<div key={i} onClick={()=>setCurDate(d)} style={{textAlign:"center",padding:"3px 1px",borderRadius:4,cursor:"pointer",fontSize:11,fontWeight:isSel||isT?700:400,background:isSel?"#18181b":isT?"#e0e7ff":"transparent",color:isSel?"#fff":isT?"#6366f1":"#333",position:"relative"}} onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background="#f0ede8";}} onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background=isT?"#e0e7ff":"transparent";}}>
        {day}{h&&!isSel&&<div style={{width:3,height:3,borderRadius:"50%",background:isT?"#6366f1":"#d97706",position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)"}}/>}
      </div>;})}
    </div>
  </div>;
}

function ApptModal({appt,clients,services,defaultDate,defaultHour,onSave,onDelete,onClose}){
  const [form,setForm]=useState(appt?{...appt,clientId:appt.client_id,clientName:appt.client_name}:{clientId:"",clientName:"",service:services[0]||"",date:defaultDate,hour:defaultHour,minute:0,duration:60,color:APPT_COLORS[0].value,notes:"",status:"confirmado"});
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const handleClient=(id)=>{const c=clients.find(c=>String(c.id)===String(id));set("clientId",id);set("clientName",c?c.name:"Sin cliente");};
  return<div className="modal-bg" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
    <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:800,marginBottom:14}}>{appt?"Editar turno":"Nuevo turno"}</div>
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:3}}>Cliente</label>
      <select className="field" value={form.clientId} onChange={e=>handleClient(e.target.value)}><option value="">— Sin cliente —</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:3}}>Servicio</label>
      <select className="field" value={form.service} onChange={e=>set("service",e.target.value)}>{services.map(s=><option key={s}>{s}</option>)}</select></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:3}}>Fecha</label><input className="field" type="date" value={form.date} onChange={e=>set("date",e.target.value)}/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:3}}>Hora</label><select className="field" value={form.hour} onChange={e=>set("hour",Number(e.target.value))}>{HOURS.map(h=><option key={h} value={h}>{fmtHour(h)}</option>)}</select></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:3}}>Duración</label><select className="field" value={form.duration} onChange={e=>set("duration",Number(e.target.value))}>{[15,30,45,60,75,90,120].map(d=><option key={d} value={d}>{d}m</option>)}</select></div>
      </div>
      <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:3}}>Estado</label>
      <div style={{display:"flex",gap:4}}>{Object.entries(STATUS_STYLES).map(([k,v])=><button key={k} onClick={()=>set("status",k)} style={{flex:1,padding:"5px 2px",borderRadius:8,cursor:"pointer",fontSize:10.5,fontWeight:700,border:"1.5px solid",borderColor:form.status===k?v.text:"#e2dfd8",background:form.status===k?v.bg:"#fff",color:form.status===k?v.text:"#888",fontFamily:"inherit"}}>{v.label}</button>)}</div></div>
      <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:3}}>Color</label>
      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{APPT_COLORS.map(c=><button key={c.value} onClick={()=>set("color",c.value)} style={{width:24,height:24,borderRadius:6,background:c.value,border:`3px solid ${form.color===c.value?"#18181b":"transparent"}`,cursor:"pointer"}}/>)}</div></div>
      <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:3}}>Notas</label><textarea className="field" rows={2} value={form.notes} onChange={e=>set("notes",e.target.value)} style={{resize:"none"}}/></div>
    </div>
    <div style={{display:"flex",gap:8,marginTop:14,justifyContent:"flex-end",alignItems:"center"}}>
      {appt&&<button className="btn btn-outline btn-sm" style={{color:"#ef4444",borderColor:"#fecaca",marginRight:"auto"}} onClick={()=>onDelete(appt.id)}>🗑</button>}
      <button className="btn btn-outline btn-sm" onClick={onClose}>Cancelar</button>
      <button className="btn btn-dark btn-sm" onClick={()=>onSave(form)}>{appt?"Guardar":"Crear"}</button>
    </div>
  </div></div>;
}

// ══════════════════════════════════════════════════════════════════
// STOCK
// ══════════════════════════════════════════════════════════════════
function Stock({products,setProducts,lowStock,fmt,reload,isMobile}){
  const [showNew,setShowNew]=useState(false);
  const [showAdj,setShowAdj]=useState(null);
  const [search,setSearch]=useState("");
  const [filterCat,setFilterCat]=useState("Todos");
  const [newP,setNewP]=useState({name:"",sku:"",category:"",price:"",cost:"",stock:"",minStock:""});
  const [adjQty,setAdjQty]=useState("");
  const [adjType,setAdjType]=useState("add");
  const [saving,setSaving]=useState(false);

  const cats=["Todos",...Array.from(new Set(products.map(p=>p.category).filter(Boolean)))];
  const filtered=products.filter(p=>(p.name.toLowerCase().includes(search.toLowerCase())||(p.sku||"").toLowerCase().includes(search.toLowerCase()))&&(filterCat==="Todos"||p.category===filterCat));

  const addP=async()=>{if(!newP.name||!newP.price)return;setSaving(true);await supabase.from('products').insert({name:newP.name,sku:newP.sku,category:newP.category,price:Number(newP.price),cost:Number(newP.cost)||0,stock:Number(newP.stock)||0,min_stock:Number(newP.minStock)||5});await reload();setSaving(false);setNewP({name:"",sku:"",category:"",price:"",cost:"",stock:"",minStock:""});setShowNew(false);};
  const applyAdj=async()=>{const q=Number(adjQty);if(!q||!showAdj)return;const newStock=Math.max(0,adjType==="add"?showAdj.stock+q:showAdj.stock-q);await supabase.from('products').update({stock:newStock}).eq('id',showAdj.id);await reload();setShowAdj(null);setAdjQty("");setAdjType("add");};
  const st=(p)=>p.stock===0?{label:"Sin stock",cls:"pill-red"}:p.stock<=p.min_stock?{label:"Bajo",cls:"pill-yellow"}:{label:"OK",cls:"pill-green"};

  return(
    <div className="page">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
        {!isMobile&&<div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800}}>Stock</div>}
        <input className="field" style={{flex:1,minWidth:140}} placeholder="🔍 Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <button className="btn btn-dark btn-sm" onClick={()=>setShowNew(true)}>+ Producto</button>
      </div>
      {lowStock.length>0&&<div className="alert-banner"><span>⚠️</span><span style={{fontWeight:700,fontSize:12}}>{lowStock.length} con stock bajo</span></div>}

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:14}}>
        {[{l:"Productos",v:products.length},{l:"Stock bajo",v:lowStock.length,red:true},{l:"Valor costo",v:fmt(products.reduce((a,p)=>a+p.stock*(p.cost||0),0))},{l:"Valor venta",v:fmt(products.reduce((a,p)=>a+p.stock*(p.price||0),0))}].map((s,i)=>(
          <div key={i} className="stat" style={{padding:"10px 12px"}}>
            <div style={{fontSize:9,color:"#aaa",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>{s.l}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:isMobile?16:20,fontWeight:800,color:s.red&&s.v>0?"#7f1d1d":"#18181b",marginTop:2}}>{s.v}</div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>{cats.map(c=><button key={c} onClick={()=>setFilterCat(c)} style={{padding:"3px 10px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:600,border:"1.5px solid",borderColor:filterCat===c?"#18181b":"#e2dfd8",background:filterCat===c?"#18181b":"#fff",color:filterCat===c?"#fff":"#555",fontFamily:"inherit"}}>{c}</button>)}</div>

      {isMobile?(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(p=>{const s=st(p);return(
            <div key={p.id} className="card" style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:12}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:14}}>{p.name}</div>
                <div style={{fontSize:12,color:"#888",marginTop:2}}>{p.sku||"Sin SKU"} · {p.category||"Sin cat."}</div>
                <div style={{fontSize:13,fontWeight:700,color:"#18181b",marginTop:4}}>{fmt(p.price||0)}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,color:p.stock===0?"#7f1d1d":p.stock<=p.min_stock?"#854d0e":"#18181b"}}>{p.stock}</div>
                <span className={`pill ${s.cls}`} style={{fontSize:10}}>{s.label}</span>
                <div style={{marginTop:6}}><button className="btn btn-outline btn-sm" onClick={()=>setShowAdj(p)}>Ajustar</button></div>
              </div>
            </div>
          );})}
          {filtered.length===0&&<div style={{textAlign:"center",padding:28,color:"#aaa"}}>Sin productos</div>}
        </div>
      ):(
        <div className="card" style={{overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:"#f8f7f4",borderBottom:"1.5px solid #e8e4dc"}}>{["Producto","SKU","Cat.","Precio","Costo","Stock","Mín.","Estado",""].map((h,i)=><th key={i} style={{padding:"9px 13px",textAlign:"left",fontSize:10.5,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:".06em"}}>{h}</th>)}</tr></thead>
            <tbody>{filtered.map(p=>{const s=st(p);return<tr key={p.id} style={{borderBottom:"1px solid #f0ede6"}}>
              <td style={{padding:"10px 13px",fontWeight:600,fontSize:13.5}}>{p.name}</td>
              <td style={{padding:"10px 13px",fontSize:12,color:"#888",fontFamily:"monospace"}}>{p.sku||"—"}</td>
              <td style={{padding:"10px 13px",fontSize:12,color:"#555"}}>{p.category||"—"}</td>
              <td style={{padding:"10px 13px",fontWeight:600,fontSize:13.5}}>{fmt(p.price||0)}</td>
              <td style={{padding:"10px 13px",fontSize:12,color:"#888"}}>{p.cost?fmt(p.cost):"—"}</td>
              <td style={{padding:"10px 13px",fontWeight:700,fontSize:14,color:p.stock===0?"#7f1d1d":p.stock<=p.min_stock?"#854d0e":"#18181b"}}>{p.stock}</td>
              <td style={{padding:"10px 13px",fontSize:12,color:"#888"}}>{p.min_stock}</td>
              <td style={{padding:"10px 13px"}}><span className={`pill ${s.cls}`}>{s.label}</span></td>
              <td style={{padding:"10px 13px"}}><button className="btn btn-outline btn-sm" onClick={()=>setShowAdj(p)}>Ajustar</button></td>
            </tr>;})}
            </tbody>
          </table>
          {filtered.length===0&&<div style={{textAlign:"center",padding:28,color:"#aaa"}}>Sin productos</div>}
        </div>
      )}

      {showNew&&<div className="modal-bg" onClick={()=>setShowNew(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:800,marginBottom:14}}>Nuevo producto</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <input className="field" style={{gridColumn:"1/-1"}} placeholder="Nombre *" value={newP.name} onChange={e=>setNewP(p=>({...p,name:e.target.value}))}/>
          <input className="field" placeholder="SKU" value={newP.sku} onChange={e=>setNewP(p=>({...p,sku:e.target.value}))}/>
          <input className="field" placeholder="Categoría" value={newP.category} onChange={e=>setNewP(p=>({...p,category:e.target.value}))}/>
          <input className="field" placeholder="Precio *" type="number" value={newP.price} onChange={e=>setNewP(p=>({...p,price:e.target.value}))}/>
          <input className="field" placeholder="Costo" type="number" value={newP.cost} onChange={e=>setNewP(p=>({...p,cost:e.target.value}))}/>
          <input className="field" placeholder="Stock inicial" type="number" value={newP.stock} onChange={e=>setNewP(p=>({...p,stock:e.target.value}))}/>
          <input className="field" placeholder="Stock mínimo" type="number" value={newP.minStock} onChange={e=>setNewP(p=>({...p,minStock:e.target.value}))}/>
        </div>
        <div style={{display:"flex",gap:8,marginTop:14,justifyContent:"flex-end"}}><button className="btn btn-outline" onClick={()=>setShowNew(false)}>Cancelar</button><button className="btn btn-dark" onClick={addP} disabled={saving}>{saving?"Guardando...":"Agregar"}</button></div>
      </div></div>}

      {showAdj&&<div className="modal-bg" onClick={()=>setShowAdj(null)}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:320}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:800,marginBottom:6}}>Ajustar stock</div>
        <div style={{fontSize:13,color:"#888",marginBottom:14}}>{showAdj.name} — actual: <strong>{showAdj.stock}</strong></div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>{[["add","➕ Agregar"],["sub","➖ Quitar"]].map(([v,l])=><button key={v} onClick={()=>setAdjType(v)} style={{flex:1,padding:"8px",borderRadius:9,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600,border:"1.5px solid",borderColor:adjType===v?"#18181b":"#e2dfd8",background:adjType===v?"#18181b":"#fff",color:adjType===v?"#fff":"#555"}}>{l}</button>)}</div>
        <input className="field" type="number" min={1} placeholder="Cantidad" value={adjQty} onChange={e=>setAdjQty(e.target.value)} autoFocus/>
        {adjQty&&<div style={{marginTop:8,fontSize:13,color:"#555"}}>Resultado: <strong>{adjType==="add"?showAdj.stock+Number(adjQty):Math.max(0,showAdj.stock-Number(adjQty))}</strong></div>}
        <div style={{display:"flex",gap:8,marginTop:14,justifyContent:"flex-end"}}><button className="btn btn-outline" onClick={()=>setShowAdj(null)}>Cancelar</button><button className="btn btn-dark" onClick={applyAdj}>Confirmar</button></div>
      </div></div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// CAJA
// ══════════════════════════════════════════════════════════════════
function Caja({movements,setMovements,clients,saldo,totalIngresos,totalEgresos,config,fmt,reload,isMobile}){
  const [showNew,setShowNew]=useState(false);
  const [filterType,setFilterType]=useState("todos");
  const [filterCat,setFilterCat]=useState("Todos");
  const [newM,setNewM]=useState({type:"ingreso",category:config.catIngreso[0],description:"",amount:"",date:todayStr(),clientId:""});
  const [saving,setSaving]=useState(false);

  const allCats=["Todos",...config.catIngreso,...config.catEgreso];
  const filtered=[...movements].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).filter(m=>(filterType==="todos"||m.type===filterType)&&(filterCat==="Todos"||m.category===filterCat));

  const addM=async()=>{if(!newM.description||!newM.amount||!newM.date)return;setSaving(true);await supabase.from('movements').insert({type:newM.type,category:newM.category,description:newM.description,amount:Number(newM.amount),date:newM.date,client_id:newM.clientId?Number(newM.clientId):null});await reload();setSaving(false);setNewM({type:"ingreso",category:config.catIngreso[0],description:"",amount:"",date:todayStr(),clientId:""});setShowNew(false);};
  const deleteM=async(id)=>{await supabase.from('movements').delete().eq('id',id);await reload();};

  const byMonth=filtered.reduce((acc,m)=>{const k=(m.date||"").slice(0,7);if(!acc[k])acc[k]={label:k,ing:0,eg:0};if(m.type==="ingreso")acc[k].ing+=Number(m.amount);else acc[k].eg+=Number(m.amount);return acc;},{});
  const months=Object.values(byMonth).sort((a,b)=>b.label.localeCompare(a.label)).slice(0,4);

  return(
    <div className="page">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
        {!isMobile&&<div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800}}>Caja</div>}
        <button className="btn btn-dark btn-sm" style={{marginLeft:"auto"}} onClick={()=>setShowNew(true)}>+ Movimiento</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:14}}>
        {[{l:"Saldo",v:fmt(saldo),c:saldo>=0?"#166534":"#7f1d1d"},{l:"Ingresos",v:fmt(totalIngresos),c:"#166534"},{l:"Egresos",v:fmt(totalEgresos),c:"#7f1d1d"},{l:"Movimientos",v:movements.length,c:"#18181b"}].map((s,i)=>(
          <div key={i} className="stat" style={{padding:"10px 12px"}}>
            <div style={{fontSize:9,color:"#aaa",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>{s.l}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:isMobile?16:20,fontWeight:800,color:s.c,marginTop:2}}>{s.v}</div>
          </div>
        ))}
      </div>

      {months.length>0&&<div className="card" style={{padding:14,marginBottom:14}}>
        <div className="sec">Por mes</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {months.map(m=><div key={m.label} style={{background:"#f8f7f4",border:"1.5px solid #e8e4dc",borderRadius:10,padding:"10px 12px",minWidth:120,flex:1}}>
            <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:6}}>{m.label}</div>
            <div style={{fontSize:12,color:"#166534",fontWeight:600}}>↑ {fmt(m.ing)}</div>
            <div style={{fontSize:12,color:"#7f1d1d",fontWeight:600}}>↓ {fmt(m.eg)}</div>
            <div style={{fontSize:12,fontWeight:700,marginTop:4,borderTop:"1px solid #e8e4dc",paddingTop:4,color:m.ing-m.eg>=0?"#166534":"#7f1d1d"}}>{fmt(m.ing-m.eg)}</div>
          </div>)}
        </div>
      </div>}

      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
        {[["todos","Todos"],["ingreso","Ingresos"],["egreso","Egresos"]].map(([v,l])=><button key={v} onClick={()=>setFilterType(v)} style={{padding:"3px 10px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:600,border:"1.5px solid",borderColor:filterType===v?"#18181b":"#e2dfd8",background:filterType===v?"#18181b":"#fff",color:filterType===v?"#fff":"#555",fontFamily:"inherit"}}>{l}</button>)}
        {!isMobile&&<><div style={{width:1,height:16,background:"#e2dfd8"}}/>{allCats.map(c=><button key={c} onClick={()=>setFilterCat(c)} style={{padding:"3px 10px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:600,border:"1.5px solid",borderColor:filterCat===c?"#555":"#e2dfd8",background:filterCat===c?"#555":"#fff",color:filterCat===c?"#fff":"#555",fontFamily:"inherit"}}>{c}</button>)}</>}
      </div>

      <div className="card" style={{padding:6}}>
        {filtered.map(m=>{const cl=m.client_id?clients.find(c=>c.id===m.client_id):null;return<div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderBottom:"1px solid #f5f3ef"}}>
          <div style={{width:32,height:32,borderRadius:"50%",background:m.type==="ingreso"?"#dcfce7":"#fee2e2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{m.type==="ingreso"?"↑":"↓"}</div>
          <div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.description}</div><div style={{fontSize:11,color:"#aaa",marginTop:1}}>{fmtDate(m.date)} · {m.category}{cl?` · ${cl.name}`:""}</div></div>
          <div style={{fontWeight:700,fontSize:13,color:m.type==="ingreso"?"#166534":"#7f1d1d",flexShrink:0,whiteSpace:"nowrap"}}>{m.type==="ingreso"?"+":"-"}{fmt(m.amount)}</div>
          <button className="btn btn-outline btn-sm" style={{color:"#ef4444",borderColor:"#fecaca",padding:"3px 8px"}} onClick={()=>deleteM(m.id)}>✕</button>
        </div>;})}
        {filtered.length===0&&<div style={{textAlign:"center",padding:28,color:"#aaa"}}>Sin movimientos</div>}
      </div>

      {showNew&&<div className="modal-bg" onClick={()=>setShowNew(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:800,marginBottom:14}}>Nuevo movimiento</div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>{[["ingreso","↑ Ingreso"],["egreso","↓ Egreso"]].map(([v,l])=><button key={v} onClick={()=>setNewM(p=>({...p,type:v,category:(v==="ingreso"?config.catIngreso:config.catEgreso)[0]}))} style={{flex:1,padding:"9px",borderRadius:9,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:700,border:"2px solid",borderColor:newM.type===v?(v==="ingreso"?"#166534":"#7f1d1d"):"#e2dfd8",background:newM.type===v?(v==="ingreso"?"#f0fdf4":"#fef2f2"):"#fff",color:newM.type===v?(v==="ingreso"?"#166534":"#7f1d1d"):"#555"}}>{l}</button>)}</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <select className="field" value={newM.category} onChange={e=>setNewM(p=>({...p,category:e.target.value}))}>{(newM.type==="ingreso"?config.catIngreso:config.catEgreso).map(c=><option key={c}>{c}</option>)}</select>
          <input className="field" placeholder="Descripción *" value={newM.description} onChange={e=>setNewM(p=>({...p,description:e.target.value}))}/>
          <input className="field" type="number" placeholder="Monto *" value={newM.amount} onChange={e=>setNewM(p=>({...p,amount:e.target.value}))}/>
          <input className="field" type="date" value={newM.date} onChange={e=>setNewM(p=>({...p,date:e.target.value}))}/>
          {newM.type==="ingreso"&&<select className="field" value={newM.clientId} onChange={e=>setNewM(p=>({...p,clientId:e.target.value}))}><option value="">— Cliente (opcional) —</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}
        </div>
        <div style={{display:"flex",gap:8,marginTop:14,justifyContent:"flex-end"}}><button className="btn btn-outline" onClick={()=>setShowNew(false)}>Cancelar</button><button className={`btn ${newM.type==="ingreso"?"btn-green":"btn-red"}`} onClick={addM} disabled={saving}>{saving?"Guardando...":"Registrar"}</button></div>
      </div></div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════════════════════════
function Config({config,setConfig,reload}){
  const [draft,setDraft]=useState({...config});
  const [saved,setSaved]=useState(false);
  const [newTag,setNewTag]=useState("");
  const [newCI,setNewCI]=useState("");
  const [newCE,setNewCE]=useState("");
  const [newSvc,setNewSvc]=useState("");
  const save=()=>{setConfig(draft);setSaved(true);setTimeout(()=>setSaved(false),2500);};
  const addTag=()=>{if(!newTag.trim()||draft.clientTags.includes(newTag.trim()))return;setDraft(p=>({...p,clientTags:[...p.clientTags,newTag.trim()]}));setNewTag("");};
  const addCI=()=>{if(!newCI.trim()||draft.catIngreso.includes(newCI.trim()))return;setDraft(p=>({...p,catIngreso:[...p.catIngreso,newCI.trim()]}));setNewCI("");};
  const addCE=()=>{if(!newCE.trim()||draft.catEgreso.includes(newCE.trim()))return;setDraft(p=>({...p,catEgreso:[...p.catEgreso,newCE.trim()]}));setNewCE("");};
  const addSvc=()=>{if(!newSvc.trim()||draft.services.includes(newSvc.trim()))return;setDraft(p=>({...p,services:[...p.services,newSvc.trim()]}));setNewSvc("");};
  return(
    <div className="page" style={{maxWidth:680}}>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,marginBottom:4}}>Configuración</div>
      <div style={{color:"#888",fontSize:13,marginBottom:18}}>Personalizá la app para cada negocio</div>

      <div className="settings-section">
        <div className="sec">Identidad</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Nombre</label><input className="field" value={draft.appName} onChange={e=>setDraft(p=>({...p,appName:e.target.value}))}/></div>
          <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:6}}>Ícono</label><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{ICON_OPTIONS.map(ic=><button key={ic} onClick={()=>setDraft(p=>({...p,appIcon:ic}))} style={{width:36,height:36,borderRadius:8,border:`2px solid ${draft.appIcon===ic?"#18181b":"#e2dfd8"}`,background:draft.appIcon===ic?"#18181b":"#fff",fontSize:18,cursor:"pointer"}}>{ic}</button>)}</div></div>
          <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:6}}>Color</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
              {ACCENT_OPTIONS.map(o=><button key={o.value} onClick={()=>setDraft(p=>({...p,accentColor:o.value}))} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:20,border:`2px solid ${draft.accentColor===o.value?"#18181b":"#e2dfd8"}`,background:draft.accentColor===o.value?"#f0ede8":"#fff",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit",color:"#18181b"}}><div style={{width:10,height:10,borderRadius:"50%",background:o.value}}/>{o.label}</button>)}
              <input type="color" value={draft.accentColor} onChange={e=>setDraft(p=>({...p,accentColor:e.target.value}))} style={{width:28,height:28,border:"1.5px solid #e2dfd8",borderRadius:8,cursor:"pointer",padding:2}}/>
            </div>
          </div>
          <div><label style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:4}}>Moneda</label><input className="field" style={{width:90}} value={draft.moneda} onChange={e=>setDraft(p=>({...p,moneda:e.target.value}))}/></div>
        </div>
      </div>

      {[
        {title:"Etiquetas de clientes",key:"clientTags",newVal:newTag,setNew:setNewTag,add:addTag,cs:{},rmv:(t)=>setDraft(p=>({...p,clientTags:p.clientTags.filter(x=>x!==t)}))},
        {title:"Categorías de ingresos",key:"catIngreso",newVal:newCI,setNew:setNewCI,add:addCI,cs:{background:"#f0fdf4",borderColor:"#86efac",color:"#166534"},rmv:(t)=>setDraft(p=>({...p,catIngreso:p.catIngreso.filter(x=>x!==t)}))},
        {title:"Categorías de egresos",key:"catEgreso",newVal:newCE,setNew:setNewCE,add:addCE,cs:{background:"#fef2f2",borderColor:"#fca5a5",color:"#7f1d1d"},rmv:(t)=>setDraft(p=>({...p,catEgreso:p.catEgreso.filter(x=>x!==t)}))},
        {title:"Servicios de agenda",key:"services",newVal:newSvc,setNew:setNewSvc,add:addSvc,cs:{background:"#eff6ff",borderColor:"#93c5fd",color:"#1e40af"},rmv:(t)=>setDraft(p=>({...p,services:p.services.filter(x=>x!==t)}))},
      ].map(({title,key,newVal,setNew,add,cs,rmv})=>(
        <div key={key} className="settings-section">
          <div className="sec">{title}</div>
          <div style={{marginBottom:8}}>{draft[key].map(t=><span key={t} className="tag-chip" style={cs}>{t}<button onClick={()=>rmv(t)} style={{background:"none",border:"none",cursor:"pointer",color:"#999",fontSize:13,padding:0,lineHeight:1}}>✕</button></span>)}</div>
          <div style={{display:"flex",gap:8}}><input className="field" placeholder="Nueva..." value={newVal} onChange={e=>setNew(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}/><button className="btn btn-outline btn-sm" style={{whiteSpace:"nowrap"}} onClick={add}>+ Agregar</button></div>
        </div>
      ))}

      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <button className="btn btn-dark" onClick={save} style={{padding:"10px 24px"}}>{saved?"✓ Guardado":"Guardar cambios"}</button>
        {saved&&<span style={{fontSize:13,color:"#166534",fontWeight:600}}>¡Aplicado!</span>}
      </div>
    </div>
  );
}