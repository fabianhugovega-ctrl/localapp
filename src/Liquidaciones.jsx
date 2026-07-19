import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => { if (!d) return "—"; const [y,m,day] = d.split("-"); return `${day}/${m}/${y}`; };
const fmtMonto = (n) => `$${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;

export default function Liquidaciones() {
  const hoyDate = new Date();
  const [mes, setMes] = useState(hoyDate.getMonth() + 1);
  const [anio, setAnio] = useState(hoyDate.getFullYear());
  const [guardias, setGuardias] = useState([]);
  const [resumen, setResumen] = useState([]);
  const [loading, setLoading] = useState(false);
  const [liquidaciones, setLiquidaciones] = useState({});
  const [saving, setSaving] = useState(null);

  useEffect(() => { fetchGuardias(); }, []);
  useEffect(() => { if (guardias.length > 0) calcular(); }, [mes, anio, guardias]);

  async function fetchGuardias() {
    const { data } = await supabase.from("guardias").select("*").eq("activo", true).order("nombre");
    setGuardias(data || []);
  }

  async function calcular() {
    setLoading(true);

    const desde = `${anio}-${pad(mes)}-01`;
    const hasta = `${anio}-${pad(mes)}-31`;

    // Traer turnos del mes con asistencia
    const { data: turnos } = await supabase
      .from("turnos")
      .select("*, guardias(nombre, valor_hora), puestos(nombre), asistencia(*)")
      .gte("fecha", desde)
      .lte("fecha", hasta);

    // Traer liquidaciones existentes del mes
    const { data: liqs } = await supabase
      .from("liquidaciones")
      .select("*")
      .eq("mes", mes)
      .eq("anio", anio);

    const liqMap = {};
    (liqs || []).forEach((l) => { liqMap[l.guardia_id] = l; });
    setLiquidaciones(liqMap);

    // Calcular por guardia (cálculo EN VIVO, refleja los turnos actuales)
    const porGuardia = {};
    guardias.forEach((g) => {
      porGuardia[g.id] = {
        guardia: g,
        turnos: [],
        total_horas: 0,
        total_monto: 0,
      };
    });

    (turnos || []).forEach((t) => {
      if (!porGuardia[t.guardia_id]) return;
      const asist = (t.asistencia || [])[0];
      const horas = asist?.horas_trabajadas || 0;
      const valor_hora = t.guardias?.valor_hora || porGuardia[t.guardia_id]?.guardia?.valor_hora || 0;
      const monto = horas * valor_hora;
      porGuardia[t.guardia_id].turnos.push({ ...t, asist, horas, monto });
      porGuardia[t.guardia_id].total_horas += horas;
      porGuardia[t.guardia_id].total_monto += monto;
    });

    setResumen(Object.values(porGuardia).filter((r) => r.turnos.length > 0));
    setLoading(false);
  }

  // Arma el snapshot del detalle de turnos para congelar al cerrar
  function armarDetalle(item) {
    return item.turnos.map((t) => ({
      fecha: t.fecha,
      puesto: t.puestos?.nombre || null,
      tipo: t.tipo,
      hora_inicio: t.hora_inicio,
      hora_fin: t.hora_fin,
      hora_real_inicio: t.asist?.hora_real_inicio || null,
      hora_real_fin: t.asist?.hora_real_fin || null,
      horas: t.horas,
      monto: t.monto,
    }));
  }

  async function cerrarLiquidacion(item) {
    setSaving(item.guardia.id);
    const { data: userData } = await supabase.auth.getUser();
    const existing = liquidaciones[item.guardia.id];
    const payload = {
      guardia_id: item.guardia.id,
      mes,
      anio,
      total_horas: item.total_horas,
      total_a_cobrar: item.total_monto,
      detalle: armarDetalle(item),   // snapshot congelado
      estado: "cerrada",
    };
    if (existing) {
      await supabase.from("liquidaciones").update(payload).eq("id", existing.id);
    } else {
      payload.empresa_id = userData.user.id;
      await supabase.from("liquidaciones").insert(payload);
    }
    setSaving(null);
    calcular();
  }

  async function reabrirLiquidacion(guardia_id) {
    const existing = liquidaciones[guardia_id];
    if (!existing) return;
    await supabase.from("liquidaciones").update({ estado: "borrador" }).eq("id", existing.id);
    calcular();
  }

  function exportarPDF(item) {
    const doc = new jsPDF();
    const liq = liquidaciones[item.guardia.id];
    const cerrada = liq?.estado === "cerrada";

    // Si está cerrada, usar el SNAPSHOT guardado; si no, el cálculo en vivo
    const detalle = cerrada && Array.isArray(liq.detalle) ? liq.detalle : item.turnos.map((t) => ({
      fecha: t.fecha,
      puesto: t.puestos?.nombre || null,
      tipo: t.tipo,
      hora_real_inicio: t.asist?.hora_real_inicio || null,
      hora_real_fin: t.asist?.hora_real_fin || null,
      horas: t.horas,
      monto: t.monto,
    }));
    const totalHoras = cerrada ? liq.total_horas : item.total_horas;
    const totalMonto = cerrada ? liq.total_a_cobrar : item.total_monto;

    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Liquidación de Haberes", 20, 25);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(`Período: ${MESES[mes - 1]} ${anio}`, 20, 34);
    doc.text(`Generado: ${fmtDate(new Date().toISOString().slice(0, 10))}`, 20, 41);

    doc.setDrawColor(200);
    doc.line(20, 46, 190, 46);

    // Datos del guardia
    doc.setTextColor(0);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(item.guardia.nombre, 20, 56);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    if (item.guardia.dni) doc.text(`DNI: ${item.guardia.dni}`, 20, 63);
    if (item.guardia.legajo) doc.text(`Legajo: ${item.guardia.legajo}`, 20, 70);
    if (item.guardia.categoria) doc.text(`Categoría: ${item.guardia.categoria}`, 20, 77);
    doc.text(`Valor hora: ${fmtMonto(item.guardia.valor_hora)}`, 20, 84);

    doc.setDrawColor(220);
    doc.line(20, 90, 190, 90);

    // Tabla de turnos (desde snapshot o en vivo)
    autoTable(doc, {
      startY: 95,
      head: [["Fecha", "Puesto", "Turno", "Horario real", "Horas", "Monto"]],
      body: detalle.map((t) => [
        fmtDate(t.fecha),
        t.puesto || "—",
        t.tipo || "—",
        (t.hora_real_inicio && t.hora_real_fin) ? `${t.hora_real_inicio} → ${t.hora_real_fin}` : "Sin registrar",
        t.horas > 0 ? `${t.horas}hs` : "—",
        t.monto > 0 ? fmtMonto(t.monto) : "—",
      ]),
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [24, 24, 27], textColor: 255 },
      columnStyles: { 5: { halign: "right" } },
    });

    const finalY = doc.lastAutoTable.finalY + 10;

    // Totales
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(`Total horas trabajadas: ${totalHoras}hs`, 20, finalY);
    doc.setFontSize(14);
    doc.setTextColor(22, 101, 52);
    doc.text(`TOTAL A COBRAR: ${fmtMonto(totalMonto)}`, 20, finalY + 10);

    if (cerrada) {
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text("Liquidación cerrada", 20, finalY + 22);
    }

    doc.save(`liquidacion-${item.guardia.nombre.replace(/\s/g, "-")}-${MESES[mes-1]}-${anio}.pdf`);
  }

  const anios = [anio - 1, anio, anio + 1];

  return (
    <div className="page">
      <div className="row-h" style={{ marginBottom: 16 }}>
        <div>
          <div className="sec">Seguridad</div>
          <h2 style={{ margin: 0 }}>Liquidaciones</h2>
        </div>
      </div>

      {/* Selector de período */}
      <div className="card" style={{ padding: 14, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={labelS}>Mes</label>
            <select className="field" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={labelS}>Año</label>
            <select className="field" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
              {anios.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 13, color: "#888", paddingBottom: 10 }}>
            Mostrando: <strong>{MESES[mes - 1]} {anio}</strong>
          </div>
        </div>
      </div>

      {/* Resumen */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 32, color: "#888" }}>Calculando...</div>
      ) : resumen.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "#888" }}>
          No hay turnos con asistencia registrada para {MESES[mes - 1]} {anio}.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {resumen.map((item) => {
            const liq = liquidaciones[item.guardia.id];
            const cerrada = liq?.estado === "cerrada";

            // Cuando está cerrada, se muestran los valores del SNAPSHOT (congelados),
            // no el cálculo en vivo.
            const detalleMostrar = cerrada && Array.isArray(liq.detalle) ? liq.detalle : item.turnos.map((t) => ({
              id: t.id,
              fecha: t.fecha,
              puesto: t.puestos?.nombre || null,
              tipo: t.tipo,
              hora_real_inicio: t.asist?.hora_real_inicio || null,
              hora_real_fin: t.asist?.hora_real_fin || null,
              horas: t.horas,
              monto: t.monto,
            }));
            const totalHorasMostrar = cerrada ? Number(liq.total_horas) : item.total_horas;
            const totalMontoMostrar = cerrada ? Number(liq.total_a_cobrar) : item.total_monto;

            // Detectar horas nuevas cargadas DESPUÉS del cierre
            const hayCambios = cerrada && (
              Math.abs(item.total_horas - Number(liq.total_horas)) > 0.001 ||
              Math.abs(item.total_monto - Number(liq.total_a_cobrar)) > 0.001
            );
            const horasNuevas = hayCambios ? (item.total_horas - Number(liq.total_horas)) : 0;
            const montoNuevo = hayCambios ? (item.total_monto - Number(liq.total_a_cobrar)) : 0;

            return (
              <div key={item.guardia.id} className="card" style={{ padding: 0, overflow: "hidden", opacity: cerrada ? 0.95 : 1 }}>
                {/* Header guardia */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: cerrada ? "#f0fdf4" : "#fafaf8", borderBottom: "1px solid #eee" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{item.guardia.nombre}</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                      {item.guardia.categoria && `${item.guardia.categoria} · `}
                      Valor hora: {fmtMonto(item.guardia.valor_hora)}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {cerrada && (
                      <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: "#dcfce7", color: "#166534", fontWeight: 600 }}>
                        ✓ Cerrada
                      </span>
                    )}
                    <button className="btn btn-outline btn-sm" onClick={() => exportarPDF(item)}>
                      📄 PDF
                    </button>
                    {cerrada ? (
                      <button className="btn btn-outline btn-sm" onClick={() => reabrirLiquidacion(item.guardia.id)}>
                        Reabrir
                      </button>
                    ) : (
                      <button className="btn btn-dark btn-sm" onClick={() => cerrarLiquidacion(item)} disabled={saving === item.guardia.id}>
                        {saving === item.guardia.id ? "Guardando..." : "Cerrar liquidación"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Aviso de horas nuevas sin liquidar */}
                {hayCambios && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "#fff7ed", borderBottom: "1px solid #fed7aa" }}>
                    <span style={{ fontSize: 16 }}>⚠️</span>
                    <div style={{ fontSize: 13, color: "#9a3412", flex: 1 }}>
                      Se cargaron <strong>{horasNuevas > 0 ? `${horasNuevas.toFixed(2)}hs nuevas` : "cambios"}</strong>
                      {montoNuevo > 0 && <> (<strong>{fmtMonto(montoNuevo)}</strong>)</>} después de cerrar esta liquidación. No están incluidas en el total cerrado.
                    </div>
                    <button className="btn btn-outline btn-sm" onClick={() => reabrirLiquidacion(item.guardia.id)}>
                      Reabrir para incluir
                    </button>
                  </div>
                )}

                {/* Tabla turnos (snapshot si está cerrada, en vivo si no) */}
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f5f5f5", fontSize: 12, color: "#666" }}>
                      <th style={th}>Fecha</th>
                      <th style={th}>Puesto</th>
                      <th style={th}>Turno</th>
                      <th style={th}>Horario real</th>
                      <th style={{ ...th, textAlign: "right" }}>Horas</th>
                      <th style={{ ...th, textAlign: "right" }}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalleMostrar.map((t, i) => (
                      <tr key={t.id || i} style={{ borderTop: "1px solid #eee", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <td style={td}>{fmtDate(t.fecha)}</td>
                        <td style={td}>{t.puesto || "—"}</td>
                        <td style={td}>
                          <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 8, background: "#f0f0f0", textTransform: "capitalize" }}>{t.tipo}</span>
                        </td>
                        <td style={td}>
                          {(t.hora_real_inicio && t.hora_real_fin) ? (
                            <span style={{ color: "#2e7d32", fontWeight: 500 }}>{t.hora_real_inicio} → {t.hora_real_fin}</span>
                          ) : (
                            <span style={{ color: "#aaa", fontSize: 12 }}>Sin asistencia</span>
                          )}
                        </td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>
                          {t.horas > 0 ? `${t.horas}hs` : "—"}
                        </td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 600, color: t.monto > 0 ? "#166534" : "#aaa" }}>
                          {t.monto > 0 ? fmtMonto(t.monto) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totales */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 24, padding: "12px 16px", borderTop: "1.5px solid #eee", background: "#fafaf8" }}>
                  <div style={{ fontSize: 13, color: "#555" }}>
                    Total horas: <strong>{totalHorasMostrar}hs</strong>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#166534" }}>
                    Total: {fmtMonto(totalMontoMostrar)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const th = { padding: "10px 14px", textAlign: "left", fontWeight: 600 };
const td = { padding: "10px 14px", fontSize: 14 };
const labelS = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "#555" };
