import { useState, useEffect } from "react";
import Barcode from "react-barcode";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "./supabase.js";

const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const fmtDate = (d) => { if(!d) return "—"; const [y,m,day]=d.split("-"); return `${day}/${m}/${y}`; };
const nroProforma = () => `PRO-${Date.now().toString().slice(-6)}`;

const G = `
.proforma-table { width:100%; border-collapse:collapse; }
.proforma-table th { background:#f8f7f4; padding:10px 13px; text-align:left; font-size:11px; font-weight:700; color:#888; text-transform:uppercase; letter-spacing:.06em; border-bottom:1.5px solid #e8e4dc; }
.proforma-table td { padding:10px 13px; font-size:14px; border-bottom:1px solid #f0ede6; }
.proforma-table tr:last-child td { border-bottom:none; }
.proforma-table tr:hover td { background:#fafaf8; }
.btn{cursor:pointer;border:none;border-radius:9px;font-family:'Instrument Sans',sans-serif;font-weight:600;transition:all .14s}
.btn:hover{filter:brightness(0.88);transform:translateY(-1px)}
.btn-dark{background:#18181b;color:#fff;padding:9px 18px;font-size:13px}
.btn-outline{background:transparent;color:#444;padding:8px 14px;font-size:13px;border:1.5px solid #e2dfd8}
.btn-outline:hover{background:#f5f3ef;filter:none}
.btn-green{background:#166534;color:#fff;padding:9px 18px;font-size:13px}
.btn-red{background:#7f1d1d;color:#fff;padding:7px 12px;font-size:12px}
.btn-sm{padding:5px 11px;font-size:12px}
.field{background:#f8f7f4;border:1.5px solid #e2dfd8;border-radius:9px;padding:9px 13px;font-size:14px;color:#18181b;width:100%;outline:none;transition:border .14s}
.field:focus{border-color:#18181b;background:#fff}
.card{background:#fff;border-radius:16px;border:1px solid #e8e4dc}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:200;backdrop-filter:blur(3px)}
.modal{background:#fff;border-radius:20px;padding:26px;width:100%;max-width:560px;box-shadow:0 24px 64px rgba(0,0,0,.2);max-height:92vh;overflow-y:auto}
.sec{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#aaa;margin-bottom:10px}
.stat{background:#fff;border-radius:14px;padding:16px 18px;border:1px solid #e8e4dc;flex:1;min-width:0}
`;

export default function Proformas({ clients = [], products = [], config = {}, userId }) {
  const fmt = (n) => `${config.moneda || "$"}${Number(n).toLocaleString("es-AR")}`;
  const [proformas, setProformas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [showBarcodes, setShowBarcodes] = useState(false);

  useEffect(() => { if (userId) loadProformas(); }, [userId]);

  const loadProformas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("proformas")
      .select("*")
      .eq("empresa_id", userId)
      .order("created_at", { ascending: false });
    if (!error) setProformas(data || []);
    setLoading(false);
  };

  const addProforma = async (p) => {
    const { error } = await supabase.from("proformas").insert({
      empresa_id: userId,
      nro: nroProforma(),
      fecha: todayStr(),
      vencimiento: p.vencimiento || null,
      client_id: p.clientId || null,
      client_name: p.clientName || null,
      items: p.items,
      total: p.total,
      nota: p.nota || null,
      estado: "borrador",
    });
    if (!error) await loadProformas();
    setShowNew(false);
  };

  const changeEstado = async (id, estado) => {
    await supabase.from("proformas").update({ estado }).eq("id", id);
    await loadProformas();
    if (showDetail?.id === id) setShowDetail(prev => ({ ...prev, estado }));
  };

  const deleteProforma = async (id) => {
    await supabase.from("proformas").delete().eq("id", id);
    await loadProformas();
    setShowDetail(null);
  };

  const estadoStyle = {
    borrador:  { bg:"#f3f4f6", text:"#6b7280", label:"Borrador" },
    enviado:   { bg:"#dbeafe", text:"#1d4ed8", label:"Enviado" },
    aceptado:  { bg:"#dcfce7", text:"#166534", label:"Aceptado" },
    rechazado: { bg:"#fee2e2", text:"#7f1d1d", label:"Rechazado" },
  };

  const totalProformas = proformas.reduce((a, p) => a + Number(p.total), 0);
  const aceptadas = proformas.filter(p => p.estado === "aceptado").length;

  return (
    <div style={{ padding: 24, fontFamily: "'Instrument Sans', sans-serif" }}>
      <style>{G}</style>

      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:800, letterSpacing:"-0.02em" }}>
          🧾 Proformas & Remitos
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:10 }}>
          <button className="btn btn-outline" onClick={() => setShowBarcodes(true)}>
            📊 Códigos de barra
          </button>
          <button className="btn btn-dark" onClick={() => setShowNew(true)}>
            + Nueva proforma
          </button>
        </div>
      </div>

      <div style={{ display:"flex", gap:12, marginBottom:20 }}>
        {[
          { label:"Total proformas", value: proformas.length },
          { label:"Aceptadas", value: aceptadas, color:"#166534" },
          { label:"Valor total", value: fmt(totalProformas) },
          { label:"Valor aceptado", value: fmt(proformas.filter(p=>p.estado==="aceptado").reduce((a,p)=>a+Number(p.total),0)), color:"#166534" },
        ].map((s,i) => (
          <div key={i} className="stat">
            <div style={{ fontSize:10, color:"#aaa", fontWeight:700, textTransform:"uppercase", letterSpacing:".07em" }}>{s.label}</div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:800, color:s.color||"#18181b", marginTop:2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ overflow:"hidden" }}>
        {loading ? (
          <div style={{ textAlign:"center", padding:48, color:"#aaa" }}>Cargando...</div>
        ) : proformas.length === 0 ? (
          <div style={{ textAlign:"center", padding:48, color:"#aaa" }}>
            <div style={{ fontSize:32, marginBottom:12 }}>🧾</div>
            <div style={{ fontSize:15, fontWeight:600, marginBottom:6 }}>Sin proformas todavía</div>
            <div style={{ fontSize:13 }}>Creá la primera proforma para un cliente</div>
          </div>
        ) : (
          <table className="proforma-table">
            <thead>
              <tr>
                {["Número","Fecha","Cliente","Items","Total","Estado",""].map((h,i) =>
                  <th key={i}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {proformas.map(p => {
                const st = estadoStyle[p.estado] || estadoStyle.borrador;
                return (
                  <tr key={p.id} style={{ cursor:"pointer" }} onClick={() => setShowDetail(p)}>
                    <td style={{ fontWeight:700, fontFamily:"monospace", fontSize:13 }}>{p.nro}</td>
                    <td style={{ color:"#555" }}>{fmtDate(p.fecha)}</td>
                    <td style={{ fontWeight:600 }}>{p.client_name || "Sin cliente"}</td>
                    <td style={{ color:"#888" }}>{(p.items||[]).length} ítem{(p.items||[]).length !== 1 ? "s" : ""}</td>
                    <td style={{ fontWeight:700, color:"#18181b" }}>{fmt(p.total)}</td>
                    <td>
                      <span style={{ background:st.bg, color:st.text, padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>
                        {st.label}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setShowDetail(p); }}>
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showNew && (
        <NuevaProformaModal
          clients={clients}
          products={products}
          config={config}
          fmt={fmt}
          onSave={addProforma}
          onClose={() => setShowNew(false)}
        />
      )}

      {showDetail && (
        <DetalleProformaModal
          proforma={showDetail}
          config={config}
          fmt={fmt}
          estadoStyle={estadoStyle}
          onChangeEstado={(estado) => changeEstado(showDetail.id, estado)}
          onDelete={() => deleteProforma(showDetail.id)}
          onClose={() => setShowDetail(null)}
        />
      )}

      {showBarcodes && (
        <BarcodesModal products={products} onClose={() => setShowBarcodes(false)} />
      )}
    </div>
  );
}

function NuevaProformaModal({ clients, products, config, fmt, onSave, onClose }) {
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [items, setItems] = useState([{ productId: "", qty: 1, desc: "", price: 0 }]);
  const [nota, setNota] = useState("");
  const [vencimiento, setVencimiento] = useState("");

  const handleClient = (id) => {
    setClientId(id);
    const c = clients.find(c => String(c.id) === String(id));
    setClientName(c ? c.name : "");
  };

  const handleProduct = (idx, productId) => {
    const p = products.find(p => String(p.id) === String(productId));
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, productId, desc: p ? p.name : "", price: p ? p.price : 0 } : it));
  };

  const updateItem = (idx, key, val) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it));
  };

  const total = items.reduce((a, it) => a + (Number(it.price) * Number(it.qty)), 0);

  const handleSave = () => {
    const validItems = items.filter(it => it.desc && it.qty > 0);
    if (!validItems.length) return;
    onSave({ clientId, clientName, items: validItems, total, nota, vencimiento });
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth:580 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:19, fontWeight:800, marginBottom:18 }}>Nueva proforma</div>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Cliente</label>
            <select className="field" value={clientId} onChange={e => handleClient(e.target.value)}>
              <option value="">— Sin cliente —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Vencimiento (opcional)</label>
            <input className="field" type="date" value={vencimiento} onChange={e => setVencimiento(e.target.value)} />
          </div>

          <div>
            <div className="sec" style={{ marginBottom:8 }}>Productos / Servicios</div>
            {items.map((it, idx) => (
              <div key={idx} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr auto", gap:8, marginBottom:8 }}>
                <select className="field" value={it.productId} onChange={e => handleProduct(idx, e.target.value)}>
                  <option value="">— Producto o escribí —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input className="field" placeholder="Cant." type="number" min={1} value={it.qty}
                  onChange={e => updateItem(idx, "qty", e.target.value)} />
                <input className="field" placeholder="Precio" type="number" value={it.price}
                  onChange={e => updateItem(idx, "price", e.target.value)} />
                {items.length > 1 &&
                  <button className="btn btn-red btn-sm" onClick={() => setItems(p => p.filter((_, i) => i !== idx))}>✕</button>
                }
              </div>
            ))}
            <button className="btn btn-outline btn-sm" onClick={() => setItems(p => [...p, { productId:"", qty:1, desc:"", price:0 }])}>
              + Agregar ítem
            </button>
          </div>

          {total > 0 && (
            <div style={{ background:"#f0fdf4", border:"1.5px solid #86efac", borderRadius:10, padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontWeight:600, color:"#166534" }}>Total</span>
              <span style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, color:"#166534" }}>{fmt(total)}</span>
            </div>
          )}

          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>Notas / Condiciones</label>
            <textarea className="field" rows={2} placeholder="Ej: Válido por 15 días. No incluye IVA." value={nota}
              onChange={e => setNota(e.target.value)} style={{ resize:"none" }} />
          </div>
        </div>

        <div style={{ display:"flex", gap:8, marginTop:18, justifyContent:"flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-green" onClick={handleSave}>Crear proforma</button>
        </div>
      </div>
    </div>
  );
}

function DetalleProformaModal({ proforma, config, fmt, estadoStyle, onChangeEstado, onDelete, onClose }) {
  const st = estadoStyle[proforma.estado] || estadoStyle.borrador;

  const generarPDF = () => {
    const doc = new jsPDF();
    const appName = config.appName || "LocalApp";
    const moneda = config.moneda || "$";

    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(appName, 20, 25);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text("PROFORMA / PRESUPUESTO", 20, 33);

    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`N° ${proforma.nro}`, 150, 25);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Fecha: ${fmtDate(proforma.fecha)}`, 150, 32);
    if (proforma.vencimiento) {
      doc.text(`Vence: ${fmtDate(proforma.vencimiento)}`, 150, 38);
    }

    doc.setDrawColor(200);
    doc.line(20, 42, 190, 42);

    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("CLIENTE:", 20, 52);
    doc.setFont("helvetica", "normal");
    doc.text(proforma.client_name || "Sin especificar", 20, 59);

    autoTable(doc, {
      startY: 68,
      head: [["Descripción", "Cant.", `Precio unit. (${moneda})`, `Total (${moneda})`]],
      body: (proforma.items || []).map(it => [
        it.desc,
        it.qty,
        Number(it.price).toLocaleString("es-AR"),
        (Number(it.price) * Number(it.qty)).toLocaleString("es-AR"),
      ]),
      foot: [[
        { content: "TOTAL", colSpan: 3, styles: { halign: "right", fontStyle: "bold" } },
        { content: `${moneda}${Number(proforma.total).toLocaleString("es-AR")}`, styles: { fontStyle: "bold" } }
      ]],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [24, 24, 27], textColor: 255 },
      footStyles: { fillColor: [240, 253, 244], textColor: [22, 101, 52] },
    });

    if (proforma.nota) {
      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text("Notas y condiciones:", 20, finalY);
      doc.setTextColor(0);
      doc.text(proforma.nota, 20, finalY + 6, { maxWidth: 170 });
    }

    doc.setFontSize(8);
    doc.setTextColor(160);
    doc.text(`Generado por ${appName} · ${fmtDate(proforma.fecha)}`, 20, 285);
    doc.save(`${proforma.nro}-${proforma.client_name || "proforma"}.pdf`);
  };

  const compartirWhatsApp = () => {
    const texto = `Hola! Te adjunto la proforma *${proforma.nro}* por un total de *${fmt(proforma.total)}*. Quedamos a disposición para cualquier consulta.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth:560 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800 }}>{proforma.nro}</div>
            <div style={{ fontSize:12, color:"#888", marginTop:2 }}>
              {fmtDate(proforma.fecha)}
              {proforma.vencimiento ? ` · Vence: ${fmtDate(proforma.vencimiento)}` : ""}
            </div>
          </div>
          <span style={{ marginLeft:"auto", background:st.bg, color:st.text, padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:700 }}>
            {st.label}
          </span>
        </div>

        <div style={{ background:"#f8f7f4", borderRadius:10, padding:"10px 14px", marginBottom:14 }}>
          <div style={{ fontSize:11, color:"#aaa", fontWeight:600, textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>Cliente</div>
          <div style={{ fontWeight:600, fontSize:15 }}>{proforma.client_name || "Sin especificar"}</div>
        </div>

        <table className="proforma-table" style={{ marginBottom:12 }}>
          <thead>
            <tr><th>Descripción</th><th>Cant.</th><th>Precio</th><th>Total</th></tr>
          </thead>
          <tbody>
            {(proforma.items || []).map((it, i) => (
              <tr key={i}>
                <td>{it.desc}</td>
                <td>{it.qty}</td>
                <td>{fmt(it.price)}</td>
                <td style={{ fontWeight:700 }}>{fmt(Number(it.price)*Number(it.qty))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"#f0fdf4", border:"1.5px solid #86efac", borderRadius:10, padding:"12px 16px", marginBottom:14 }}>
          <span style={{ fontWeight:600, color:"#166534" }}>Total</span>
          <span style={{ fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:800, color:"#166534" }}>{fmt(proforma.total)}</span>
        </div>

        {proforma.nota && (
          <div style={{ fontSize:12, color:"#666", background:"#fafaf8", borderRadius:8, padding:"8px 12px", marginBottom:14, fontStyle:"italic" }}>
            {proforma.nota}
          </div>
        )}

        <div style={{ marginBottom:14 }}>
          <div className="sec">Cambiar estado</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {Object.entries({ borrador:"Borrador", enviado:"Enviado", aceptado:"Aceptado", rechazado:"Rechazado" }).map(([k,l]) => {
              const s = { borrador:"#6b7280", enviado:"#1d4ed8", aceptado:"#166534", rechazado:"#7f1d1d" }[k];
              return (
                <button key={k} onClick={() => onChangeEstado(k)}
                  style={{ padding:"6px 14px", borderRadius:20, cursor:"pointer", fontSize:12, fontWeight:700, border:`2px solid ${proforma.estado===k?s:"#e2dfd8"}`, background:proforma.estado===k?s:"#fff", color:proforma.estado===k?"#fff":"#555", fontFamily:"inherit", transition:"all .14s" }}>
                  {l}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button className="btn btn-dark" onClick={generarPDF} style={{ flex:1 }}>📄 Descargar PDF</button>
          <button className="btn btn-green" onClick={compartirWhatsApp} style={{ flex:1 }}>💬 Compartir WhatsApp</button>
          <button className="btn btn-outline btn-sm" style={{ color:"#ef4444", borderColor:"#fecaca" }} onClick={onDelete}>🗑</button>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function BarcodesModal({ products, onClose }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku||"").toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const selectAll = () => setSelected(filtered.map(p => p.id));
  const clearAll = () => setSelected([]);
  const toShow = selected.length > 0 ? products.filter(p => selected.includes(p.id)) : filtered;

  const printBarcodes = () => {
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>Códigos de barra</title>
      <style>
        body { font-family: sans-serif; margin: 20px; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .item { border: 1px solid #eee; border-radius: 8px; padding: 12px; text-align: center; page-break-inside: avoid; }
        .name { font-weight: 700; font-size: 13px; margin-bottom: 4px; }
        .sku { font-size: 11px; color: #888; margin-bottom: 8px; }
        .price { font-size: 14px; font-weight: 700; color: #166534; margin-top: 6px; }
        @media print { body { margin: 0; } }
      </style></head><body>
      <h2 style="margin-bottom:16px">Códigos de barra — ${new Date().toLocaleDateString()}</h2>
      <div class="grid">
        ${toShow.map(p => `
          <div class="item">
            <div class="name">${p.name}</div>
            <div class="sku">SKU: ${p.sku || p.id}</div>
            <svg id="bc-${p.id}"></svg>
            <div class="price">$${Number(p.price).toLocaleString("es-AR")}</div>
          </div>
        `).join("")}
      </div>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
      <script>
        window.onload = function() {
          ${toShow.map(p => `JsBarcode("#bc-${p.id}", "${p.sku || p.id}", { width:2, height:60, displayValue:true, fontSize:12 });`).join("\n")}
          setTimeout(() => window.print(), 500);
        }
      </script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth:620 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:19, fontWeight:800, marginBottom:16 }}>
          📊 Códigos de barra
        </div>

        <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center" }}>
          <input className="field" placeholder="🔍 Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex:1 }} />
          <button className="btn btn-outline btn-sm" onClick={selectAll}>Seleccionar todo</button>
          {selected.length > 0 && <button className="btn btn-outline btn-sm" onClick={clearAll}>Limpiar</button>}
        </div>

        {selected.length > 0 && (
          <div style={{ background:"#eff6ff", border:"1.5px solid #93c5fd", borderRadius:10, padding:"8px 14px", fontSize:13, color:"#1e40af", fontWeight:600, marginBottom:12 }}>
            {selected.length} producto{selected.length > 1 ? "s" : ""} seleccionado{selected.length > 1 ? "s" : ""}
          </div>
        )}

        <div style={{ maxHeight:320, overflowY:"auto", marginBottom:14 }}>
          {filtered.map(p => (
            <div key={p.id} onClick={() => toggleSelect(p.id)}
              style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", borderRadius:10, cursor:"pointer", border:`1.5px solid ${selected.includes(p.id)?"#93c5fd":"transparent"}`, background:selected.includes(p.id)?"#eff6ff":"transparent", marginBottom:4, transition:"all .14s" }}>
              <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggleSelect(p.id)} style={{ accentColor:"#18181b", cursor:"pointer" }} />
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:14 }}>{p.name}</div>
                <div style={{ fontSize:12, color:"#888" }}>SKU: {p.sku || p.id}</div>
              </div>
              <div style={{ flexShrink:0 }}>
                <Barcode value={String(p.sku || p.id)} width={1} height={35} displayValue={false} />
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ textAlign:"center", padding:24, color:"#aaa" }}>Sin productos</div>}
        </div>

        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-dark" onClick={printBarcodes}>
            🖨️ Imprimir {selected.length > 0 ? `(${selected.length})` : "todos"}
          </button>
        </div>
      </div>
    </div>
  );
}