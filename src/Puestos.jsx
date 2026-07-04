import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";

const empty = {
  nombre: "",
  empresa_custodiada: "",
  direccion: "",
  modalidad_cobro: "por_hora",
  valor_contrato: "",
  activo: true,
};

export default function Puestos() {
  const [puestos, setPuestos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [soloActivos, setSoloActivos] = useState(true);

  useEffect(() => { fetchPuestos(); }, []);

  async function fetchPuestos() {
    setLoading(true);
    const { data, error } = await supabase
      .from("puestos")
      .select("*")
      .order("nombre");
    if (!error) setPuestos(data || []);
    setLoading(false);
  }

  function abrirAlta() {
    setForm(empty);
    setEditId(null);
    setError("");
    setModal(true);
  }

  function abrirEdicion(p) {
    setForm({
      nombre: p.nombre,
      empresa_custodiada: p.empresa_custodiada || "",
      direccion: p.direccion || "",
      modalidad_cobro: p.modalidad_cobro,
      valor_contrato: p.valor_contrato ?? "",
      activo: p.activo,
    });
    setEditId(p.id);
    setError("");
    setModal(true);
  }

  function cerrarModal() {
    setModal(false);
    setEditId(null);
    setForm(empty);
    setError("");
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  }

  async function guardar() {
    if (!form.nombre.trim()) return setError("El nombre es obligatorio.");
    setSaving(true);
    setError("");

    const payload = {
      nombre: form.nombre.trim(),
      empresa_custodiada: form.empresa_custodiada.trim() || null,
      direccion: form.direccion.trim() || null,
      modalidad_cobro: form.modalidad_cobro,
      valor_contrato: form.valor_contrato === "" ? 0 : parseFloat(form.valor_contrato),
      activo: form.activo,
    };

    let err;
    if (editId) {
      ({ error: err } = await supabase.from("puestos").update(payload).eq("id", editId));
    } else {
      const { data: userData } = await supabase.auth.getUser();
      payload.empresa_id = userData.user.id;
      ({ error: err } = await supabase.from("puestos").insert(payload));
    }

    setSaving(false);
    if (err) return setError(err.message);
    cerrarModal();
    fetchPuestos();
  }

  async function toggleActivo(p) {
    await supabase.from("puestos").update({ activo: !p.activo }).eq("id", p.id);
    fetchPuestos();
  }

  const filtrados = puestos.filter((p) => {
    const matchSearch =
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (p.empresa_custodiada || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.direccion || "").toLowerCase().includes(search.toLowerCase());
    const matchActivo = soloActivos ? p.activo : true;
    return matchSearch && matchActivo;
  });

  return (
    <div className="page">
      <div className="row-h" style={{ marginBottom: 16 }}>
        <div>
          <div className="sec">Seguridad</div>
          <h2 style={{ margin: 0 }}>Puestos</h2>
        </div>
        <button className="btn btn-dark" onClick={abrirAlta}>+ Nuevo puesto</button>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          className="field"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Buscar por nombre, empresa o dirección..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={soloActivos}
            onChange={(e) => setSoloActivos(e.target.checked)}
          />
          Solo activos
        </label>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "#888" }}>Cargando...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#888" }}>
            {search ? "Sin resultados para esa búsqueda." : "Todavía no hay puestos cargados."}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f5f5f5", fontSize: 13, color: "#555" }}>
                <th style={th}>Puesto</th>
                <th style={th}>Empresa custodiada</th>
                <th style={th}>Dirección</th>
                <th style={th}>Modalidad</th>
                <th style={{ ...th, textAlign: "right" }}>Valor contrato</th>
                <th style={{ ...th, textAlign: "center" }}>Estado</th>
                <th style={{ ...th, textAlign: "center" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p, i) => (
                <tr
                  key={p.id}
                  style={{
                    borderTop: "1px solid #eee",
                    background: i % 2 === 0 ? "#fff" : "#fafafa",
                    opacity: p.activo ? 1 : 0.55,
                  }}
                >
                  <td style={{ ...td, fontWeight: 600 }}>{p.nombre}</td>
                  <td style={td}>{p.empresa_custodiada || "—"}</td>
                  <td style={td}>{p.direccion || "—"}</td>
                  <td style={td}>
                    <span style={{
                      fontSize: 12,
                      padding: "2px 10px",
                      borderRadius: 12,
                      background: p.modalidad_cobro === "por_hora" ? "#e0f0ff" : "#f0e8ff",
                      color: p.modalidad_cobro === "por_hora" ? "#1565c0" : "#6a1b9a",
                      fontWeight: 500,
                    }}>
                      {p.modalidad_cobro === "por_hora" ? "Por hora" : "Fijo mensual"}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    {p.valor_contrato > 0
                      ? `$${Number(p.valor_contrato).toLocaleString("es-AR")}`
                      : "—"}
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <span style={{
                      fontSize: 12,
                      padding: "2px 10px",
                      borderRadius: 12,
                      background: p.activo ? "#e6f4ea" : "#f5f5f5",
                      color: p.activo ? "#2e7d32" : "#888",
                      fontWeight: 500,
                    }}>
                      {p.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <button className="btn btn-sm btn-outline" style={{ marginRight: 6 }} onClick={() => abrirEdicion(p)}>
                      Editar
                    </button>
                    <button className="btn btn-sm btn-outline" onClick={() => toggleActivo(p)}>
                      {p.activo ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: 8, fontSize: 13, color: "#888" }}>
        {filtrados.length} puesto{filtrados.length !== 1 ? "s" : ""}
      </div>

      {modal && (
        <div className="modal-bg" onClick={cerrarModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="row-h" style={{ marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>{editId ? "Editar puesto" : "Nuevo puesto"}</h3>
              <button className="btn btn-sm btn-outline" onClick={cerrarModal}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={label}>Nombre del puesto *</label>
                <input className="field" name="nombre" value={form.nombre} onChange={handleChange} placeholder="Ej: Portería norte" />
              </div>

              <div>
                <label style={label}>Empresa custodiada</label>
                <input className="field" name="empresa_custodiada" value={form.empresa_custodiada} onChange={handleChange} placeholder="Ej: Supermercado Día" />
              </div>

              <div>
                <label style={label}>Dirección</label>
                <input className="field" name="direccion" value={form.direccion} onChange={handleChange} placeholder="Ej: Av. Corrientes 1234, CABA" />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={label}>Modalidad de cobro</label>
                  <select className="field" name="modalidad_cobro" value={form.modalidad_cobro} onChange={handleChange}>
                    <option value="por_hora">Por hora</option>
                    <option value="fijo_mensual">Fijo mensual</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>
                    {form.modalidad_cobro === "por_hora" ? "Valor por hora ($)" : "Valor mensual ($)"}
                  </label>
                  <input
                    className="field"
                    name="valor_contrato"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.valor_contrato}
                    onChange={handleChange}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {editId && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                  <input type="checkbox" name="activo" checked={form.activo} onChange={handleChange} />
                  Puesto activo
                </label>
              )}

              {error && (
                <div style={{ color: "#c0392b", fontSize: 13, background: "#fdf0ed", padding: "8px 12px", borderRadius: 6 }}>
                  {error}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
              <button className="btn btn-outline" onClick={cerrarModal}>Cancelar</button>
              <button className="btn btn-dark" onClick={guardar} disabled={saving}>
                {saving ? "Guardando..." : editId ? "Guardar cambios" : "Crear puesto"}
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
const label = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "#555" };
