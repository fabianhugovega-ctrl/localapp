import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const fmtDate = (d) => { if(!d) return "—"; const [y,m,day]=d.split("-"); return `${day}/${m}/${y}`; };

const addDays = (dateStr, days) => {
  const d = new Date(dateStr + "T12:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};

const addMonths = (dateStr, months) => {
  const d = new Date(dateStr + "T12:00");
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};

const getNextDueDate = (startDate, installmentIndex, frequency) => {
  switch(frequency) {
    case "semanal":    return addDays(startDate, (installmentIndex + 1) * 7);
    case "quincenal":  return addDays(startDate, (installmentIndex + 1) * 15);
    case "mensual":    return addMonths(startDate, installmentIndex + 1);
    default:           return addMonths(startDate, installmentIndex + 1);
  }
};

const FREQUENCY_LABELS = {
  semanal:   "Semanal",
  quincenal: "Quincenal",
  mensual:   "Mensual",
};

const LOAN_STATUS = {
  al_dia:    { bg:"#dcfce7", text:"#166534", label:"Al día" },
  en_mora:   { bg:"#fee2e2", text:"#7f1d1d", label:"En mora" },
  cancelado: { bg:"#f3f4f6", text:"#6b7280", label:"Cancelado" },
};

export default function Prestamos({ clients = [], config = {}, userId }) {
  const fmt = (n) => `${config.moneda || "$"}${Number(n).toLocaleString("es-AR")}`;
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selLoan, setSelLoan] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");

  useEffect(() => { if (userId) loadLoans(); }, [userId]);

  const loadLoans = async () => {
    setLoading(true);
    const { data: loansData } = await supabase.from("loans").select("*").eq("empresa_id", userId).order("created_at", { ascending: false });
    const loanIds = (loansData || []).map(l => l.id);
    let payments = [];
    if (loanIds.length > 0) {
      const { data: p } = await supabase.from("loan_payments").select("*").in("loan_id", loanIds).order("installment_number");
      payments = p || [];
    }
    const enriched = (loansData || []).map(l => {
      const lPayments = payments.filter(p => p.loan_id === l.id);
      const today = todayStr();
      const vencidas = lPayments.filter(p => !p.paid && p.due_date < today).length;
      const allPaid = lPayments.length > 0 && lPayments.every(p => p.paid);
      const computedStatus = l.status === "cancelado" ? "cancelado" : vencidas > 0 ? "en_mora" : "al_dia";
      return { ...l, payments: lPayments, vencidas, computedStatus, allPaid };
    });
    setLoans(enriched);
    setLoading(false);
  };

  const filtered = loans.filter(l => {
    const ms = (l.client_name||"").toLowerCase().includes(search.toLowerCase());
    const mf = filterStatus === "todos" || l.computedStatus === filterStatus;
    return ms && mf;
  });

  // Stats — solo préstamos activos (no cancelados)
  const activosLoans = loans.filter(l => l.status !== "cancelado");
  const totalPrestado = activosLoans.reduce((a,l) => a + Number(l.amount), 0);
  const totalCobrado = activosLoans.reduce((a,l) => a + (l.payments||[]).filter(p=>p.paid).reduce((b,p) => b + Number(p.amount), 0), 0);
  const totalPendiente = activosLoans.reduce((a,l) => a + (l.payments||[]).filter(p=>!p.paid).reduce((b,p) => b + Number(p.amount), 0), 0);
  const enMora = loans.filter(l => l.computedStatus === "en_mora").length;

  if (selLoan) {
    const updated = loans.find(l => l.id === selLoan.id) || selLoan;
    return <LoanDetail loan={updated} clients={clients} config={config} fmt={fmt} userId={userId} onBack={() => setSelLoan(null)} reload={loadLoans} />;
  }

  return (
    <div style={{ padding:24, fontFamily:"'Instrument Sans', sans-serif" }}>
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20, flexWrap:"wrap" }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800 }}>💰 Préstamos</div>
        <button className="btn btn-dark" style={{ marginLeft:"auto" }} onClick={() => setShowNew(true)}>+ Nuevo préstamo</button>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
        {[
          { label:"Total prestado", value:fmt(totalPrestado) },
          { label:"Total cobrado", value:fmt(totalCobrado), color:"#166534" },
          { label:"Pendiente de cobro", value:fmt(totalPendiente), color:"#1d4ed8" },
          { label:"En mora", value:enMora, color:enMora>0?"#7f1d1d":"#18181b" },
        ].map((s,i) => (
          <div key={i} className="stat" style={{ padding:"12px 14px" }}>
            <div style={{ fontSize:9, color:"#aaa", fontWeight:700, textTransform:"uppercase", letterSpacing:".07em" }}>{s.label}</div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, color:s.color||"#18181b", marginTop:2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
        <input className="field" style={{ flex:1, minWidth:180 }} placeholder="🔍 Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {[["todos","Todos"],["al_dia","Al día"],["en_mora","En mora"],["cancelado","Cancelado"]].map(([v,l]) => (
            <button key={v} onClick={() => setFilterStatus(v)} style={{ padding:"4px 10px", borderRadius:20, cursor:"pointer", fontSize:11, fontWeight:600, border:"1.5px solid", borderColor:filterStatus===v?"#18181b":"#e2dfd8", background:filterStatus===v?"#18181b":"#fff", color:filterStatus===v?"#fff":"#555", fontFamily:"inherit" }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign:"center", padding:48, color:"#aaa" }}>Cargando...</div>
      ) : (
        <div className="card" style={{ padding:6 }}>
          {filtered.map(l => {
            const st = LOAN_STATUS[l.computedStatus] || LOAN_STATUS.al_dia;
            const pagadas = (l.payments||[]).filter(p=>p.paid).length;
            const total = (l.payments||[]).length;
            return (
              <div key={l.id} className="row-h" style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px" }} onClick={() => setSelLoan(l)}>
                <div style={{ width:42, height:42, borderRadius:"50%", background:"#dbeafe", color:"#1d4ed8", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>💰</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:3 }}>
                    <div style={{ fontWeight:700, fontSize:14 }}>{l.client_name || "Sin cliente"}</div>
                    <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:st.bg, color:st.text }}>{st.label}</span>
                    {l.vencidas > 0 && <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:"#fee2e2", color:"#7f1d1d" }}>⚠️ {l.vencidas} cuota{l.vencidas>1?"s":""} vencida{l.vencidas>1?"s":""}</span>}
                  </div>
                  <div style={{ fontSize:11, color:"#888" }}>
                    {fmt(l.amount)} · {l.installments} cuotas {FREQUENCY_LABELS[l.frequency]?.toLowerCase()||"mensual"}es de {fmt(l.installment_amount)} · {l.interest_rate}% interés
                  </div>
                  <div style={{ marginTop:6, display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ flex:1, height:4, borderRadius:2, background:"#f0ede6", overflow:"hidden" }}>
                      <div style={{ height:"100%", borderRadius:2, background:pagadas===total&&total>0?"#166534":"#6366f1", width:total>0?`${Math.round(pagadas/total*100)}%`:"0%", transition:"width .5s" }}/>
                    </div>
                    <span style={{ fontSize:10, color:"#888", flexShrink:0 }}>{pagadas}/{total}</span>
                  </div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontWeight:700, fontSize:14 }}>{fmt(l.amount)}</div>
                  <div style={{ fontSize:11, color:"#aaa" }}>{fmtDate(l.start_date)}</div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div style={{ textAlign:"center", padding:28, color:"#aaa" }}>Sin préstamos</div>}
        </div>
      )}

      {showNew && (
        <LoanModal
          clients={clients}
          onSave={async (form) => {
            const { data: loan } = await supabase.from("loans").insert({
              empresa_id: userId,
              client_id: form.clientId || null,
              client_name: form.clientName,
              amount: Number(form.amount),
              interest_rate: Number(form.interestRate),
              installments: Number(form.installments),
              installment_amount: Number(form.installmentAmount),
              frequency: form.frequency,
              start_date: form.startDate,
              status: "activo",
              notes: form.notes,
            }).select().single();

            if (loan) {
              const cuotas = Array.from({ length: Number(form.installments) }, (_, i) => ({
                empresa_id: userId,
                loan_id: loan.id,
                installment_number: i + 1,
                due_date: getNextDueDate(form.startDate, i, form.frequency),
                amount: Number(form.installmentAmount),
                paid: false,
              }));
              await supabase.from("loan_payments").insert(cuotas);
            }
            await loadLoans();
            setShowNew(false);
          }}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

function LoanDetail({ loan: l, clients, config, fmt, userId, onBack, reload }) {
  const st = LOAN_STATUS[l.computedStatus] || LOAN_STATUS.al_dia;
  const pagadas = (l.payments||[]).filter(p=>p.paid).length;
  const totalCuotas = (l.payments||[]).length;
  const totalPagado = (l.payments||[]).filter(p=>p.paid).reduce((a,p)=>a+Number(p.amount),0);
  const totalPendiente = (l.payments||[]).filter(p=>!p.paid).reduce((a,p)=>a+Number(p.amount),0);
  const today = todayStr();

  const pagarCuota = async (payment) => {
    await supabase.from("loan_payments").update({ paid: true, paid_date: today }).eq("id", payment.id);
    await supabase.from("movements").insert({
      empresa_id: userId,
      type: "ingreso",
      category: "Cobro cuota",
      description: `Cuota ${payment.installment_number}/${totalCuotas} — ${l.client_name}`,
      amount: Number(payment.amount),
      date: today,
      client_id: l.client_id || null,
    });
    await reload();
  };

  const cancelarPrestamo = async () => {
    if (!window.confirm("¿Marcar préstamo como cancelado?")) return;
    await supabase.from("loans").update({ status: "cancelado" }).eq("id", l.id);
    await reload(); onBack();
  };

  const deleteLoan = async () => {
    if (!window.confirm("¿Eliminar préstamo? Se eliminan todas las cuotas.")) return;
    await supabase.from("loans").delete().eq("id", l.id);
    await reload(); onBack();
  };

  const generarPDF = () => {
    const doc = new jsPDF();
    const appName = config.appName || "LocalApp";
    const moneda = config.moneda || "$";

    doc.setFillColor(24,24,27);
    doc.rect(0,0,210,35,"F");
    doc.setTextColor(255);
    doc.setFontSize(18); doc.setFont("helvetica","bold");
    doc.text(appName, 20, 18);
    doc.setFontSize(10); doc.setFont("helvetica","normal");
    doc.text("PLAN DE CUOTAS — PRÉSTAMO PERSONAL", 20, 27);

    doc.setTextColor(0);
    doc.setFillColor(248,247,244);
    doc.rect(0,35,210,28,"F");
    doc.setFontSize(13); doc.setFont("helvetica","bold");
    doc.text(l.client_name || "Sin cliente", 20, 47);
    doc.setFontSize(10); doc.setFont("helvetica","normal"); doc.setTextColor(100);
    doc.text(`Monto: ${moneda}${Number(l.amount).toLocaleString("es-AR")} · Tasa: ${l.interest_rate}% · Cuotas: ${l.installments} (${FREQUENCY_LABELS[l.frequency]||"Mensual"})`, 20, 55);
    doc.text(`Inicio: ${fmtDate(l.start_date)} · Cuota: ${moneda}${Number(l.installment_amount).toLocaleString("es-AR")}`, 20, 62);

    autoTable(doc, {
      startY: 70,
      head: [["N°", "Vencimiento", `Monto (${moneda})`, "Estado", "Fecha pago"]],
      body: (l.payments||[]).map(p => [
        `${p.installment_number}/${totalCuotas}`,
        fmtDate(p.due_date),
        Number(p.amount).toLocaleString("es-AR"),
        p.paid ? "✓ Pagada" : p.due_date < today ? "⚠ Vencida" : "Pendiente",
        p.paid ? fmtDate(p.paid_date) : "—",
      ]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [24,24,27], textColor: 255 },
      alternateRowStyles: { fillColor: [248,247,244] },
    });

    const fy = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10); doc.setFont("helvetica","bold");
    doc.setTextColor(22,101,52); doc.text(`Total pagado: ${moneda}${totalPagado.toLocaleString("es-AR")}`, 20, fy);
    doc.setTextColor(29,78,216); doc.text(`Total pendiente: ${moneda}${totalPendiente.toLocaleString("es-AR")}`, 20, fy+8);
    doc.setFontSize(8); doc.setTextColor(160);
    doc.text(`Generado por ${appName} · ${fmtDate(today)}`, 20, 285);
    doc.save(`prestamo-${(l.client_name||"cliente").replace(/\s/g,"-")}.pdf`);
  };

  return (
    <div style={{ padding:24, fontFamily:"'Instrument Sans', sans-serif" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        <button className="btn btn-outline btn-sm" onClick={onBack}>← Volver</button>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800 }}>{l.client_name || "Sin cliente"}</div>
            <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, background:st.bg, color:st.text }}>{st.label}</span>
          </div>
          <div style={{ fontSize:12, color:"#888", marginTop:2 }}>
            {fmt(l.amount)} · {l.installments} cuotas {FREQUENCY_LABELS[l.frequency]?.toLowerCase()||"mensual"}es · {l.interest_rate}% interés
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={generarPDF}>📄 PDF</button>
        {l.status !== "cancelado" && <button className="btn btn-outline btn-sm" onClick={cancelarPrestamo}>✓ Cancelar</button>}
        <button className="btn btn-outline btn-sm" style={{ color:"#ef4444", borderColor:"#fecaca" }} onClick={deleteLoan}>🗑</button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:16, alignItems:"start" }}>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div className="card" style={{ padding:16 }}>
            <div className="sec">Detalle del préstamo</div>
            {[
              ["💵","Monto",fmt(l.amount)],
              ["📊","Tasa de interés",`${l.interest_rate}%`],
              ["🗓️","Frecuencia",FREQUENCY_LABELS[l.frequency]||"Mensual"],
              ["🔢","Cuotas",`${l.installments} cuotas`],
              ["💳","Valor cuota",fmt(l.installment_amount)],
              ["📅","Inicio",fmtDate(l.start_date)],
              ["📅","Último vencimiento",fmtDate((l.payments||[]).slice(-1)[0]?.due_date)],
            ].map(([ic,label,val],i) => (
              <div key={i} style={{ display:"flex", gap:10, padding:"7px 0", borderBottom:"1px solid #f5f3ef", alignItems:"center" }}>
                <span style={{ fontSize:14, flexShrink:0 }}>{ic}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:"#aaa", fontWeight:600, textTransform:"uppercase" }}>{label}</div>
                  <div style={{ fontSize:13, marginTop:1 }}>{val}</div>
                </div>
              </div>
            ))}
            {l.notes && <div style={{ marginTop:10, fontSize:13, color:"#555", background:"#f8f7f4", borderRadius:8, padding:"8px 10px" }}>{l.notes}</div>}
          </div>

          <div className="card" style={{ padding:16 }}>
            <div className="sec">Resumen financiero</div>
            {[
              ["Cuotas pagadas", `${pagadas}/${totalCuotas}`, "#166534"],
              ["Total cobrado", fmt(totalPagado), "#166534"],
              ["Total pendiente", fmt(totalPendiente), "#1d4ed8"],
              ...(l.vencidas > 0 ? [["En mora", `${l.vencidas} cuota${l.vencidas>1?"s":""}`, "#7f1d1d"]] : []),
            ].map(([label,val,color],i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #f5f3ef" }}>
                <span style={{ fontSize:13, color:"#555" }}>{label}</span>
                <span style={{ fontWeight:700, fontSize:14, color }}>{val}</span>
              </div>
            ))}
            <div style={{ marginTop:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#888", marginBottom:4 }}>
                <span>Progreso</span>
                <span>{totalCuotas>0?Math.round(pagadas/totalCuotas*100):0}%</span>
              </div>
              <div style={{ height:8, borderRadius:4, background:"#f0ede6", overflow:"hidden" }}>
                <div style={{ height:"100%", borderRadius:4, background:pagadas===totalCuotas&&totalCuotas>0?"#166534":"#6366f1", width:totalCuotas>0?`${Math.round(pagadas/totalCuotas*100)}%`:"0%", transition:"width .5s" }}/>
              </div>
            </div>
          </div>
        </div>

        {/* Cuotas */}
        <div className="card" style={{ padding:16 }}>
          <div className="sec">Plan de cuotas ({pagadas}/{totalCuotas} pagadas)</div>
          {(l.payments||[]).map(p => {
            const vencida = !p.paid && p.due_date < today;
            const proxima = !p.paid && !vencida && (l.payments||[]).filter(x=>!x.paid)[0]?.id === p.id;
            return (
              <div key={p.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", borderRadius:10, border:`1.5px solid ${vencida?"#fecaca":proxima?"#93c5fd":"#ede9e3"}`, marginBottom:8, background:vencida?"#fff5f5":proxima?"#eff6ff":"#fafaf8", opacity:p.paid?0.7:1 }}>
                <div style={{ width:32, height:32, borderRadius:"50%", background:p.paid?"#dcfce7":vencida?"#fee2e2":proxima?"#dbeafe":"#f0ede6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:p.paid?"#166534":vencida?"#7f1d1d":proxima?"#1d4ed8":"#888", flexShrink:0 }}>
                  {p.paid ? "✓" : p.installment_number}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                    <div style={{ fontWeight:600, fontSize:13 }}>Cuota {p.installment_number}</div>
                    {vencida && <span style={{ fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:20, background:"#fee2e2", color:"#7f1d1d" }}>Vencida</span>}
                    {proxima && <span style={{ fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:20, background:"#dbeafe", color:"#1d4ed8" }}>Próxima</span>}
                  </div>
                  <div style={{ fontSize:11, color:"#888", marginTop:1 }}>
                    Vence: {fmtDate(p.due_date)}{p.paid ? ` · Pagada: ${fmtDate(p.paid_date)}` : ""}
                  </div>
                </div>
                <div style={{ fontWeight:700, fontSize:14, flexShrink:0 }}>{fmt(p.amount)}</div>
                {!p.paid && l.status !== "cancelado" && (
                  <button className="btn btn-green btn-sm" onClick={() => pagarCuota(p)}>Cobrar</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LoanModal({ clients, onSave, onClose }) {
  const [form, setForm] = useState({
    clientId: "", clientName: "", amount: "", interestRate: "0",
    installments: "12", frequency: "mensual", startDate: todayStr(), notes: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p => ({ ...p, [k]: v }));

  const handleClient = (id) => {
    const c = clients.find(c => String(c.id) === String(id));
    set("clientId", id); set("clientName", c ? c.name : "");
  };

  const calcInstallment = () => {
    const P = Number(form.amount);
    const n = Number(form.installments);
    const r = Number(form.interestRate) / 100;
    if (!P || !n) return 0;
    if (r === 0) return P / n;
    return (P * r * Math.pow(1+r, n)) / (Math.pow(1+r, n) - 1);
  };

  const installmentAmount = Math.round(calcInstallment() * 100) / 100;
  const totalAPagar = installmentAmount * Number(form.installments);
  const totalIntereses = totalAPagar - Number(form.amount || 0);

  const fmtN = (n) => Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth:540 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800, marginBottom:18 }}>Nuevo préstamo</div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Cliente *</label>
            <select className="field" value={form.clientId} onChange={e => handleClient(e.target.value)}>
              <option value="">— Seleccionar cliente —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Monto del préstamo *</label>
              <input className="field" type="number" placeholder="0" value={form.amount} onChange={e => set("amount", e.target.value)} autoFocus />
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Tasa de interés (%)</label>
              <input className="field" type="number" placeholder="0" value={form.interestRate} onChange={e => set("interestRate", e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Frecuencia de cuotas</label>
              <select className="field" value={form.frequency} onChange={e => set("frequency", e.target.value)}>
                <option value="semanal">Semanal</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Cantidad de cuotas</label>
              <input className="field" type="number" placeholder="12" value={form.installments} onChange={e => set("installments", e.target.value)} />
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Fecha de inicio</label>
              <input className="field" type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} />
            </div>
          </div>

          {/* Preview */}
          {form.amount && form.installments && (
            <div style={{ background:"#eff6ff", border:"1.5px solid #93c5fd", borderRadius:12, padding:"14px 16px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:".06em", marginBottom:10 }}>Resumen del préstamo</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                {[
                  ["Cuota", `$${fmtN(installmentAmount)}`, "#1d4ed8"],
                  ["Total a pagar", `$${fmtN(totalAPagar)}`, "#18181b"],
                  ["Intereses", `$${fmtN(totalIntereses)}`, "#854d0e"],
                ].map(([l,v,c],i) => (
                  <div key={i} style={{ textAlign:"center" }}>
                    <div style={{ fontSize:9, color:"#888", fontWeight:700, textTransform:"uppercase", marginBottom:3 }}>{l}</div>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:800, color:c }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Notas</label>
            <textarea className="field" rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} style={{ resize:"none" }} placeholder="Condiciones, garantías, etc." />
          </div>
        </div>
        <div style={{ display:"flex", gap:8, marginTop:18, justifyContent:"flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-dark" disabled={saving || !form.clientId || !form.amount} onClick={async () => {
            setSaving(true);
            await onSave({ ...form, installmentAmount });
            setSaving(false);
          }}>{saving ? "Guardando..." : "Crear préstamo"}</button>
        </div>
      </div>
    </div>
  );
}
