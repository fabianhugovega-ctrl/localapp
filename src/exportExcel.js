import * as XLSX from "xlsx";

const fmtDate = (d) => { if(!d) return "—"; const [y,m,day]=d.split("-"); return `${day}/${m}/${y}`; };

export const exportToExcel = (data, filename = "export") => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

// ── CAJA ──────────────────────────────────────────────────────────
export const exportCaja = (movements, clients, moneda = "$", desde = "", hasta = "") => {
  const filtered = movements.filter(m => {
    if (desde && m.date < desde) return false;
    if (hasta && m.date > hasta) return false;
    return true;
  });
  const data = filtered.map(m => {
    const cl = m.client_id ? clients.find(c => c.id === m.client_id) : null;
    return {
      "Fecha": fmtDate(m.date),
      "Tipo": m.type === "ingreso" ? "Ingreso" : "Egreso",
      "Categoría": m.category || "—",
      "Descripción": m.description || "—",
      "Cliente": cl?.name || "—",
      [`Monto (${moneda})`]: Number(m.amount),
    };
  });
  // Totales al final
  const totalIng = filtered.filter(m=>m.type==="ingreso").reduce((a,m)=>a+Number(m.amount),0);
  const totalEg = filtered.filter(m=>m.type==="egreso").reduce((a,m)=>a+Number(m.amount),0);
  data.push({});
  data.push({ "Descripción": "TOTAL INGRESOS", [`Monto (${moneda})`]: totalIng });
  data.push({ "Descripción": "TOTAL EGRESOS", [`Monto (${moneda})`]: totalEg });
  data.push({ "Descripción": "SALDO", [`Monto (${moneda})`]: totalIng - totalEg });
  const label = desde || hasta ? `caja_${desde||"inicio"}_${hasta||"hoy"}` : "caja";
  exportToExcel(data, label);
};

// ── CLIENTES ──────────────────────────────────────────────────────
export const exportClientes = (clients, moneda = "$") => {
  const data = clients.map(c => ({
    "Nombre": c.name,
    "Teléfono": c.phone || "—",
    "Email": c.email || "—",
    "Etiquetas": (c.tags||[]).join(", ") || "—",
    "Visitas": (c.visits||[]).length,
    [`Total gastado (${moneda})`]: Number(c.totalSpent || 0),
    "Última visita": fmtDate(c.lastVisit),
    "Notas": c.notes || "—",
  }));
  exportToExcel(data, "clientes");
};

// ── STOCK ─────────────────────────────────────────────────────────
export const exportStock = (products, moneda = "$") => {
  const data = products.map(p => ({
    "Nombre": p.name,
    "SKU": p.sku || "—",
    "Categoría": p.category || "—",
    [`Precio (${moneda})`]: Number(p.price || 0),
    [`Costo (${moneda})`]: Number(p.cost || 0),
    "Stock actual": p.stock,
    "Stock mínimo": p.min_stock,
    "Estado": p.stock === 0 ? "Sin stock" : p.stock <= p.min_stock ? "Stock bajo" : "OK",
    [`Valor inventario (${moneda})`]: Number(p.stock * (p.cost || 0)),
  }));
  exportToExcel(data, "stock");
};

// ── AGENDA ────────────────────────────────────────────────────────
export const exportAgenda = (appointments, desde = "", hasta = "") => {
  const filtered = appointments.filter(a => {
    if (desde && a.date < desde) return false;
    if (hasta && a.date > hasta) return false;
    return true;
  });
  const data = filtered.map(a => ({
    "Fecha": fmtDate(a.date),
    "Hora": `${String(a.hour).padStart(2,"0")}:${String(a.minute||0).padStart(2,"0")}`,
    "Cliente": a.client_name || "—",
    "Servicio": a.service || "—",
    "Duración (min)": a.duration,
    "Estado": { confirmado:"Confirmado", pendiente:"Pendiente", cancelado:"Cancelado", completado:"Completado" }[a.status] || a.status,
    "Notas": a.notes || "—",
  }));
  const label = desde || hasta ? `agenda_${desde||"inicio"}_${hasta||"hoy"}` : "agenda";
  exportToExcel(data, label);
};

// ── TRANSPORTE ────────────────────────────────────────────────────
export const exportTransporte = (trips, drivers, vehicles, moneda = "$", desde = "", hasta = "") => {
  const filtered = trips.filter(t => {
    if (desde && t.date < desde) return false;
    if (hasta && t.date > hasta) return false;
    return true;
  });
  const data = filtered.map(t => {
    const driver = drivers.find(d => d.id === t.driver_id);
    const vehicle = vehicles.find(v => v.id === t.vehicle_id);
    const gastos = (t.expenses||[]).reduce((a,e)=>a+Number(e.amount||0),0);
    return {
      "Nro": t.nro || "—",
      "Fecha": fmtDate(t.date),
      "Origen": t.origin || "—",
      "Destino": t.destination || "—",
      "Cliente": t.client_name || "—",
      "Chofer": driver?.name || "—",
      "Vehículo": vehicle?.plate || "—",
      "Carga": t.cargo || "—",
      "Peso (kg)": t.cargo_weight || "—",
      [`Tarifa (${moneda})`]: Number(t.rate || 0),
      [`Gastos (${moneda})`]: gastos,
      [`Ganancia (${moneda})`]: Number(t.rate||0) - gastos,
      "Estado": { pendiente:"Pendiente", en_camino:"En camino", entregado:"Entregado", con_novedad:"Con novedad", cancelado:"Cancelado" }[t.status] || t.status,
    };
  });
  const label = desde || hasta ? `viajes_${desde||"inicio"}_${hasta||"hoy"}` : "viajes";
  exportToExcel(data, label);
};

// ── NÓMINA ────────────────────────────────────────────────────────
export const exportNomina = (employees, moneda = "$") => {
  const data = employees.map(e => ({
    "Nombre": e.name,
    "DNI": e.dni || "—",
    "Puesto": e.position || "—",
    "Teléfono": e.phone || "—",
    "Fecha ingreso": fmtDate(e.hire_date),
    [`Sueldo (${moneda})`]: Number(e.salary || 0),
    [`Total pagado (${moneda})`]: (e.payments||[]).reduce((a,p)=>a+Number(p.amount||0),0),
    "Capacitaciones": (e.trainings||[]).length,
    "Cap. vencidas": (e.trainings||[]).filter(t=>t.expiry_date&&new Date(t.expiry_date)<new Date()).length,
  }));
  exportToExcel(data, "nomina");
};

// ── PROFORMAS ─────────────────────────────────────────────────────
export const exportProformas = (proformas, moneda = "$") => {
  const data = proformas.map(p => ({
    "Número": p.nro || "—",
    "Fecha": fmtDate(p.fecha),
    "Vencimiento": fmtDate(p.vencimiento),
    "Cliente": p.client_name || "—",
    "Items": (p.items||[]).length,
    [`Total (${moneda})`]: Number(p.total || 0),
    "Estado": { borrador:"Borrador", enviado:"Enviado", aceptado:"Aceptado", rechazado:"Rechazado" }[p.estado] || p.estado,
    "Notas": p.nota || "—",
  }));
  exportToExcel(data, "proformas");
};
