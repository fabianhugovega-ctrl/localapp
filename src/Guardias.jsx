import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";

const CATEGORIAS = ["Oficial", "Suboficial", "Cabo", "Agente", "Otro"];

const empty = {
  nombre: "",
  dni: "",
  legajo: "",
  categoria: "",
  valor_hora: "",
  activo: true,
};

export default function Guardias() {
  const [guardias, setGuardias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [soloActivos, setSoloActivos] = useState(true);
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => {
    fetchGuardias();
  }, []);

  async function fetchGuardias() {
    setLoading(true);
    const { data, error } = await supabase
      .from("guardias")
      .select("*")
      .order("nombre");
    if (!error) setGuardias(data || []);
    setLoading(false);
  }

  function abrirAlta() {
    setForm(empty);
    setEditId(null);
    setError("");
    setModal(true);
  }

  function abrirEdicion(g) {
    setForm({
      nombre: g.nombre,
      dni: g.dni,
      legajo: g.legajo || "",
      categoria: g.categoria || "",
      valor_hora: g.valor_hora ?? "",
      activo: g.activo,
    });
    setEditId(g.id);
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
    if (!form.dni.trim()) return setError("El DNI es obligatorio.");
    setSaving(true);
    setError("");

    const payload = {
      nombre: form.nombre.trim(),
      dni: form.dni.trim(),
      legajo: form.legajo.trim() || null,
      categoria: form.categoria || null,
      valor_hora: form.valor_hora === "" ? 0 : parseFloat(form.valor_hora),
      activo: form.activo,
    };

    let err;
    if (editId) {
      ({ error: err } = await supabase
        .from("guardias")
        .update(payload)
        .eq("id", editId));
    } else {
      const { data: userData } = await supabase.auth.getUser();
      payload.empresa_id = userData.user.id;
      ({ error: err } = await supabase.from("guardias").insert(payload));
    }

    setSaving(false);
    if (err) return setError(err.message);
    cerrarModal();
    fetchGuardias();
  }

  async function toggleActivo(g) {
    await supabase
      .from("guardias")
      .update({ activo: !g.activo })
      .eq("id", g.id);
    fetchGuardias();
  }

  const filtrados = guardias.filter((g) => {
    const matchSearch =
      g.nombre.toLowerCase().includes(search.toLowerCase()) ||
      g.dni.includes(search) ||
      (g.legajo || "").toLowerCase().includes(search.toLowerCase());
    const matchActivo = soloActivos ? g.activo : true;
    return matchSearch && matchActivo;
  });

  return (
    <div className="page">
      {/* Header */}
      <div className="row-h">
        <div>
          <div className="sec">Seguridad</div>
          <h2 style={{ margin: 0 }}>Guardias</h2>
        </div>
        <button className="btn btn-dark" onClick={abrirAlta}>
          + Nuevo guardia
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          className="field"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Buscar por nombre, DNI o legajo..."
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

      {/* Tabla */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "#888" }}>
            Cargando...
          </div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#888" }}>
            {search ? "Sin resultados para esa búsqueda." : "Todavía no hay guardias cargados."}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f5f5f5", fontSize: 13, color: "#555" }}>
                <th style={th}>Nombre</th>
                <th style={th}>DNI</th>
                <th style={th}>Legajo</th>
                <th style={th}>Categoría</th>
                <th style={{ ...th, textAlign: "right" }}>Valor/hora</th>
                <th style={{ ...th, textAlign: "center" }}>Estado</th>
                <th style={{ ...th, textAlign: "center" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((g, i) => (
                <tr
                  key={g.id}
                  style={{
                    borderTop: "1px solid #eee",
                    background: i % 2 === 0 ? "#fff" : "#fafafa",
                    opacity: g.activo ? 1 : 0.55,
                  }}
                >
                  <td style={td}>{g.nombre}</td>
                  <td style={td}>{g.dni}</td>
                  <td style={td}>{g.legajo || "—"}</td>
                  <td style={td}>{g.categoria || "—"}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    {g.valor_hora > 0
                      ? `$${Number(g.valor_hora).toLocaleString("es-AR")}`
                      : "—"}
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <span
                      style={{
                        fontSize: 12,
                        padding: "2px 10px",
                        borderRadius: 12,
                        background: g.activo ? "#e6f4ea" : "#f5f5f5",
                        color: g.activo ? "#2e7d32" : "#888",
                        fontWeight: 500,
                      }}
                    >
                      {g.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <button
                      className="btn btn-sm btn-outline"
                      style={{ marginRight: 6 }}
                      onClick={() => abrirEdicion(g)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => toggleActivo(g)}
                    >
                      {g.activo ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Contador */}
      <div style={{ marginTop: 8, fontSize: 13, color: "#888" }}>
        {filtrados.length} guardia{filtrados.length !== 1 ? "s" : ""}
        {soloActivos ? " activo" : ""}
        {filtrados.length !== 1 && soloActivos ? "s" : ""}
      </div>

      {/* Modal alta/edición */}
      {modal && (
        <div className="modal-bg" onClick={cerrarModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="row-h" style={{ marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>
                {editId ? "Editar guardia" : "Nuevo guardia"}
              </h3>
              <button
                className="btn btn-sm btn-outline"
                onClick={cerrarModal}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 2 }}>
                  <label style={label}>Nombre completo *</label>
                  <input
                    className="field"
                    name="nombre"
                    value={form.nombre}
                    onChange={handleChange}
                    placeholder="Ej: García, Juan Carlos"
                    style={{ width: "100%" }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>DNI *</label>
                  <input
                    className="field"
                    name="dni"
                    value={form.dni}
                    onChange={handleChange}
                    placeholder="12345678"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={label}>Legajo</label>
                  <input
                    className="field"
                    name="legajo"
                    value={form.legajo}
                    onChange={handleChange}
                    placeholder="Opcional"
                    style={{ width: "100%" }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Categoría</label>
                  <select
                    className="field"
                    name="categoria"
                    value={form.categoria}
                    onChange={handleChange}
                    style={{ width: "100%" }}
                  >
                    <option value="">Sin categoría</option>
                    {CATEGORIAS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Valor por hora ($)</label>
                  <input
                    className="field"
                    name="valor_hora"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.valor_hora}
                    onChange={handleChange}
                    placeholder="0.00"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              {editId && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                  <input
                    type="checkbox"
                    name="activo"
                    checked={form.activo}
                    onChange={handleChange}
                  />
                  Guardia activo
                </label>
              )}

              {error && (
                <div style={{ color: "#c0392b", fontSize: 13, background: "#fdf0ed", padding: "8px 12px", borderRadius: 6 }}>
                  {error}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
              <button className="btn btn-outline" onClick={cerrarModal}>
                Cancelar
              </button>
              <button
                className="btn btn-dark"
                onClick={guardar}
                disabled={saving}
              >
                {saving ? "Guardando..." : editId ? "Guardar cambios" : "Crear guardia"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th = {
  padding: "10px 14px",
  textAlign: "left",
  fontWeight: 600,
};

const td = {
  padding: "10px 14px",
  fontSize: 14,
};

const label = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 4,
  color: "#555",
};
