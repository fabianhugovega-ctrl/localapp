import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";

const TIPOS = ["mañana", "tarde", "noche", "personalizado"];
const ESTADOS = ["programado", "confirmado", "ausente", "reemplazado"];

const ESTADO_STYLES = {
  programado:  { bg: "#e0f0ff", color: "#1565c0", label: "Programado" },
  confirmado:  { bg: "#e6f4ea", color: "#2e7d32", label: "Confirmado" },
  ausente:     { bg: "#fee2e2", color: "#7f1d1d", label: "Ausente" },
  reemplazado: { bg: "#fff3e0", color: "#e65100", label: "Reemplazado" },
};

const TIPO_HORARIOS = {
  "mañana":       { inicio: "06:00", fin: "14:00" },
  "tarde":        { inicio: "14:00", fin: "22:00" },
  "noche":        { inicio: "22:00", fin: "06:00" },
  "personalizado":{ inicio: "", fin: "" },
};

const pad = (n) => String(n).padStart(2, "0");
const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const fmtDate = (d) => { if (!d) return "—"; const [y,m,day] = d.split("-"); return `${day}/${m}/${y}`; };

function calcHoras(inicio, fin) {
  if (!inicio || !fin) return 0;
  const [h1, m1] = inicio.split(":").map(Number);
  const [h2, m2] = fin.split(":").map(Number);
  let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

const emptyTurno = {
  guardia_id: "",
  puesto_id: "",
  fecha: hoy(),
  tipo: "mañana",
  hora_inicio: "06:00",
  hora_fin: "14:00",
  estado: "programado",
  notas: "",
};

const emptyAsistencia = {
  hora_real_inicio: "",
  hora_real_fin: "",
  observaciones: "",
};

export default function Turnos() {
  const [turnos, setTurnos] = useState([]);
  const [guardias, setGuardias] = useState([]);
  const [puestos, setPuestos] = useState([]);
  const [asistencias, setAsistencias] = useState({});
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyTurno);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [modalAsist, setModalAsist] = useState(false);
  const [turnoSelec, setTurnoSelec] = useState(null);
  const [formAsist, setFormAsist] = useState(emptyAsistencia);
  const [savingAsist, setSavingAsist] = useState(false);
  const [errorAsist, setErrorAsist] = useState("");

  const [filtroGuardia, setFiltroGuardia] = useState("");
  const [filtroPuesto, setFiltroPuesto] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroDesde, setFiltroDesde] = useState(hoy());
  const [filtroHasta, setFiltroHasta] = useState("");

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [t, g, p, a] = await Promise.all([
      supabase.from("turnos").select("*, guardias(nombre), puestos(nombre, empresa_custodiada)").order("fecha").order("hora_inicio"),
      supabase.from("guardias").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("puestos").select("id, nombre, empresa_custodiada").eq("activo", true).order("nombre"),
      supabase.from("asistencia").select("*"),
    ]);
    setTurnos(t.data || []);
    setGuardias(g.data || []);
    setPuestos(p.data || []);
    const asistMap = {};
    (a.data || []).forEach((a) => { asistMap[a.turno_id] = a; });
    setAsistencias(asistMap);
    setLoading(false);
  }

  function abrirAlta() { setForm(emptyTurno); setEditId(null); setError(""); setModal(true); }

  function abrirEdicion(t) {
    setForm({ guardia_id: t.guardia_id, puesto_id: t.puesto_id, fecha: t.fecha, tipo: t.tipo, hora_inicio: t.hora_inicio, hora_fin: t.hora_fin, estado: t.estado, notas: t.notas || "" });
    setEditId(t.id); setError(""); setModal(true);
  }

  function cerrarModal() { setModal(false); setEditId(null); setForm(emptyTurno); setError(""); }

  function handleChange(e) {
    const { name, value } = e.target;
    if (name === "tipo" && value !== "personalizado") {
      setForm((f) => ({ ...f, tipo: value, hora_inicio: TIPO_HORARIOS[value].inicio, hora_fin: TIPO_HORARIOS[value].fin }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  }

  async function guardarTurno() {
    if (!form.guardia_id) return setError("Seleccioná un guardia.");
    if (!form.puesto_id) return setError("Seleccioná un puesto.");
    if (!form.fecha) return setError("La fecha es obligatoria.");
    if (!form.hora_inicio || !form.hora_fin) return setError("Los horarios son obligatorios.");
    setSaving(true); setError("");
    const payload = { guardia_id: form.guardia_id, puesto_id: form.puesto_id, fecha: form.fecha, tipo: form.tipo, hora_inicio: form.hora_inicio, hora_fin: form.hora_fin, estado: form.estado, notas: form.notas.trim() || null };
    let err;
    if (editId) {
      ({ error: err } = await supabase.from("turnos").update(payload).eq("id", editId));
    } else {
      const { data: userData } = await supabase.auth.getUser();
      payload.empresa_id = userData.user.id;
      ({ error: err } = await supabase.from("turnos").insert(payload));
    }
    setSaving(false);
    if (err) return setError(err.message);
    cerrarModal(); fetchAll();
  }

  async function cambiarEstado(id, estado) {
    await supabase.from("turnos").update({ estado }).eq("id", id);
    fetchAll();
  }

  async function eliminarTurno(id) {
    if (!confirm("¿Eliminar este turno?")) return;
    await supabase.from("turnos").delete().eq("id", id);
    fetchAll();
  }

  function abrirAsistencia(turno) {
    setTurnoSelec(turno);
    const existing = asistencias[turno.id];
    if (existing) {
      setFormAsist({ hora_real_inicio: existing.hora_real_inicio || "", hora_real_fin: existing.hora_real_fin || "", observaciones: existing.observaciones || "" });
    } else {
      setFormAsist({ hora_real_inicio: turno.hora_inicio, hora_real_fin: turno.hora_fin, observaciones: "" });
    }
    setErrorAsist(""); setModalAsist(true);
  }

  function cerrarAsistencia() { setModalAsist(false); setTurnoSelec(null); setFormAsist(emptyAsistencia); setErrorAsist(""); }

  async function guardarAsistencia() {
    if (!formAsist.hora_real_inicio || !formAsist.hora_real_fin) return setErrorAsist("Ingresá los horarios reales.");
    setSavingAsist(true); setErrorAsist("");
    const horas = calcHoras(formAsist.hora_real_inicio, formAsist.hora_real_fin);
    const existing = asistencias[turnoSelec.id];
    const { data: userData } = await supabase.auth.getUser();
    const payload = { hora_real_inicio: formAsist.hora_real_inicio, hora_real_fin: formAsist.hora_real_fin, horas_trabajadas: horas, observaciones: formAsist.observaciones.trim() || null };
    let err;
    if (existing) {
      ({ error: err } = await supabase.from("asistencia").update(payload).eq("id", existing.id));
    } else {
      payload.turno_id = turnoSelec.id;
      payload.empresa_id = userData.user.id;
      ({ error: err } = await supabase.from("asistencia").insert(payload));
      await supabase.from("turnos").update({ estado: "confirmado" }).eq("id", turnoSelec.id);
    }
    setSavingAsist(false);
    if (err) return setErrorAsist(err.message);
    cerrarAsistencia(); fetchAll();
  }

  const filtrados = turnos.filter((t) => {
    if (filtroGuardia && t.guardia_id !== filtroGuardia) return false;
    if (filtroPuesto && t.puesto_id !== filtroPuesto) return false;
    if (filtroEstado && t.estado !== filtroEstado) return false;
    if (filtroDesde && t.fecha < filtroDesde) return false;
    if (filtroHasta && t.fecha > filtroHasta) return false;
    return true;
  });

  const porFecha = filtrados.reduce((acc, t) => { if (!acc[t.fecha]) acc[t.fecha] = []; acc[t.fecha].push(t); return acc; }, {});
  const fechas = Object.keys(porFecha).sort();

  return (
    <div className="page">
      <div className="row-h" style={{ marginBottom: 16 }}>
        <div>
          <div className="sec">Seguridad</div>
          <h2 style={{ margin: 0 }}>Turnos</h2>
        </div>
        <button className="btn btn-dark" onClick={abrirAlta}>+ Nuevo turno</button>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label style={labelS}>Guardia</label>
            <select className="field" value={filtroGuardia} onChange={(e) => setFiltroGuardia(e.target.value)}>
              <option value="">Todos</option>
              {guardias.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label style={labelS}>Puesto</label>
            <select className="field" value={filtroPuesto} onChange={(e) => setFiltroPuesto(e.target.value)}>
              <option value="">Todos</option>
              {puestos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <label style={labelS}>Estado</label>
            <select className="field" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="">Todos</option>
              {ESTADOS.map((e) => <option key={e} value={e}>{ESTADO_STYLES[e].label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <label style={labelS}>Desde</label>
            <input className="field" type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <label style={labelS}>Hasta</label>
            <input className="field" type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} />
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => { setFiltroGuardia(""); setFiltroPuesto(""); setFiltroEstado(""); setFiltroDesde(hoy()); setFiltroHasta(""); }}>
            Limpiar
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {Object.entries(ESTADO_STYLES).map(([k, v]) => (
          <div key={k} style={{ background: v.bg, borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, color: v.color }}>
            {v.label}: {filtrados.filter((t) => t.estado === k).length}
          </div>
        ))}
        <div style={{ background: "#f5f5f5", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "#555" }}>
          Total: {filtrados.length}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 32, color: "#888" }}>Cargando...</div>
      ) : fechas.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "#888" }}>No hay turnos para los filtros seleccionados.</div>
      ) : (
        fechas.map((fecha) => (
          <div key={fecha} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
              {fmtDate(fecha)}{fecha === hoy() ? " — Hoy" : ""}
            </div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f5f5f5", fontSize: 12, color: "#666" }}>
                    <th style={th}>Guardia</th>
                    <th style={th}>Puesto</th>
                    <th style={th}>Turno</th>
                    <th style={th}>Horario</th>
                    <th style={th}>Asistencia</th>
                    <th style={{ ...th, textAlign: "center" }}>Estado</th>
                    <th style={{ ...th, textAlign: "center" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {porFecha[fecha].map((t, i) => {
                    const est = ESTADO_STYLES[t.estado];
                    const asist = asistencias[t.id];
                    return (
                      <tr key={t.id} style={{ borderTop: "1px solid #eee", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <td style={{ ...td, fontWeight: 600 }}>{t.guardias?.nombre || "—"}</td>
                        <td style={td}>
                          <div>{t.puestos?.nombre || "—"}</div>
                          {t.puestos?.empresa_custodiada && <div style={{ fontSize: 11, color: "#aaa" }}>{t.puestos.empresa_custodiada}</div>}
                        </td>
                        <td style={td}>
                          <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 10, background: "#f5f5f5", color: "#555", fontWeight: 500, textTransform: "capitalize" }}>{t.tipo}</span>
                        </td>
                        <td style={td}>{t.hora_inicio} → {t.hora_fin}</td>
                        <td style={td}>
                          {asist ? (
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#2e7d32" }}>{asist.hora_real_inicio} → {asist.hora_real_fin}</div>
                              <div style={{ fontSize: 11, color: "#888" }}>{asist.horas_trabajadas}hs</div>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: "#aaa" }}>Sin registrar</span>
                          )}
                        </td>
                        <td style={{ ...td, textAlign: "center" }}>
                          <select value={t.estado} onChange={(e) => cambiarEstado(t.id, e.target.value)}
                            style={{ fontSize: 12, padding: "3px 8px", borderRadius: 10, border: "none", background: est.bg, color: est.color, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                            {ESTADOS.map((e) => <option key={e} value={e}>{ESTADO_STYLES[e].label}</option>)}
                          </select>
                        </td>
                        <td style={{ ...td, textAlign: "center" }}>
                          <button className="btn btn-sm btn-outline" style={{ marginRight: 4, background: asist ? "#e6f4ea" : "transparent", borderColor: asist ? "#81c784" : undefined, color: asist ? "#2e7d32" : undefined }}
                            onClick={() => abrirAsistencia(t)}>
                            {asist ? "✓ Asist." : "Asistencia"}
                          </button>
                          <button className="btn btn-sm btn-outline" style={{ marginRight: 4 }} onClick={() => abrirEdicion(t)}>Editar</button>
                          <button className="btn btn-sm btn-outline" style={{ color: "#ef4444", borderColor: "#fecaca" }} onClick={() => eliminarTurno(t.id)}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {/* Modal turno */}
      {modal && (
        <div className="modal-bg" onClick={cerrarModal}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="row-h" style={{ marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>{editId ? "Editar turno" : "Nuevo turno"}</h3>
              <button className="btn btn-sm btn-outline" onClick={cerrarModal}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelS}>Guardia *</label>
                  <select className="field" name="guardia_id" value={form.guardia_id} onChange={handleChange}>
                    <option value="">— Seleccioná —</option>
                    {guardias.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelS}>Puesto *</label>
                  <select className="field" name="puesto_id" value={form.puesto_id} onChange={handleChange}>
                    <option value="">— Seleccioná —</option>
                    {puestos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelS}>Fecha *</label>
                  <input className="field" type="date" name="fecha" value={form.fecha} onChange={handleChange} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelS}>Tipo de turno</label>
                  <select className="field" name="tipo" value={form.tipo} onChange={handleChange}>
                    {TIPOS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelS}>Hora inicio</label>
                  <input className="field" type="time" name="hora_inicio" value={form.hora_inicio} onChange={handleChange} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelS}>Hora fin</label>
                  <input className="field" type="time" name="hora_fin" value={form.hora_fin} onChange={handleChange} />
                </div>
              </div>
              <div>
                <label style={labelS}>Estado</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {ESTADOS.map((e) => {
                    const s = ESTADO_STYLES[e];
                    return (
                      <button key={e} onClick={() => setForm((f) => ({ ...f, estado: e }))}
                        style={{ padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 600, border: "1.5px solid", fontFamily: "inherit", borderColor: form.estado === e ? s.color : "#e2dfd8", background: form.estado === e ? s.bg : "#fff", color: form.estado === e ? s.color : "#888" }}>
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={labelS}>Notas</label>
                <textarea className="field" name="notas" rows={2} value={form.notas} onChange={handleChange} placeholder="Opcional..." style={{ resize: "none" }} />
              </div>
              {error && <div style={{ color: "#c0392b", fontSize: 13, background: "#fdf0ed", padding: "8px 12px", borderRadius: 6 }}>{error}</div>}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
              <button className="btn btn-outline" onClick={cerrarModal}>Cancelar</button>
              <button className="btn btn-dark" onClick={guardarTurno} disabled={saving}>
                {saving ? "Guardando..." : editId ? "Guardar cambios" : "Crear turno"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal asistencia */}
      {modalAsist && turnoSelec && (
        <div className="modal-bg" onClick={cerrarAsistencia}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="row-h" style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Registrar asistencia</h3>
              <button className="btn btn-sm btn-outline" onClick={cerrarAsistencia}>✕</button>
            </div>
            <div style={{ background: "#f8f7f4", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>{turnoSelec.guardias?.nombre}</div>
              <div style={{ color: "#888", marginTop: 2 }}>{turnoSelec.puestos?.nombre} · {fmtDate(turnoSelec.fecha)} · {turnoSelec.hora_inicio} → {turnoSelec.hora_fin}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelS}>Hora real de entrada</label>
                  <input className="field" type="time" value={formAsist.hora_real_inicio} onChange={(e) => setFormAsist((f) => ({ ...f, hora_real_inicio: e.target.value }))} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelS}>Hora real de salida</label>
                  <input className="field" type="time" value={formAsist.hora_real_fin} onChange={(e) => setFormAsist((f) => ({ ...f, hora_real_fin: e.target.value }))} />
                </div>
              </div>
              {formAsist.hora_real_inicio && formAsist.hora_real_fin && (
                <div style={{ background: "#e6f4ea", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, color: "#2e7d32" }}>
                  Horas trabajadas: {calcHoras(formAsist.hora_real_inicio, formAsist.hora_real_fin)}hs
                </div>
              )}
              <div>
                <label style={labelS}>Observaciones</label>
                <textarea className="field" rows={2} value={formAsist.observaciones} onChange={(e) => setFormAsist((f) => ({ ...f, observaciones: e.target.value }))} placeholder="Opcional..." style={{ resize: "none" }} />
              </div>
              {errorAsist && <div style={{ color: "#c0392b", fontSize: 13, background: "#fdf0ed", padding: "8px 12px", borderRadius: 6 }}>{errorAsist}</div>}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
              <button className="btn btn-outline" onClick={cerrarAsistencia}>Cancelar</button>
              <button className="btn btn-dark" onClick={guardarAsistencia} disabled={savingAsist}>
                {savingAsist ? "Guardando..." : asistencias[turnoSelec?.id] ? "Actualizar" : "Confirmar asistencia"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th = { padding: "10px 14px", textAlign: "left", fontWeight: 600 };
const td = { padding: "10px 14px", fontSize: 14 };
const labelS = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "#555" };
