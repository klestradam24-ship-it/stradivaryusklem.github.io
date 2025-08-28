// ======= Slider automático =======
let sliderIndex = 0;
function rotarSlider() {
  const slides = document.querySelectorAll(".slide");
  if (!slides.length) return;
  slides.forEach(s => s.classList.remove("active"));
  slides[sliderIndex].classList.add("active");
  sliderIndex = (sliderIndex + 1) % slides.length;
}
rotarSlider();
setInterval(rotarSlider, 10000);

// ======= Estado global =======
let carrito = [];
let total = 0;
let folio = 1;
const passwordAcceso = "klem"; // contraseña panel contable
let clientes = [];

// ======= Navegación entre secciones =======
function mostrarSeccion(id) {
  document.querySelectorAll(".seccion").forEach(s => s.style.display = "none");
  document.getElementById(id).style.display = "block";
  if (id === "contable") mostrarVentas();
}
document.addEventListener("DOMContentLoaded", () => {
  mostrarSeccion('productos');   // sección inicial
  cargarSugerencias();
});

// ======= Lightbox PRODUCTOS =======
let lightboxImages = []; // rutas del grupo actual
let lightboxIndex = 0;   // índice actual

function abrirLightboxItem(imgEl) {
  // Agrupa por data-group para navegar solo entre las thumbs del producto clicado
  const group = imgEl.dataset.group;
  const all = Array.from(document.querySelectorAll(`img[data-group="${group}"]`));
  lightboxImages = all.map(i => i.src);
  lightboxIndex = lightboxImages.indexOf(imgEl.src);

  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  img.src = lightboxImages[lightboxIndex];

  lb.setAttribute('aria-hidden', 'false');
}

function changeSlideItem(ev, step) {
  ev?.stopPropagation();
  if (!lightboxImages.length) return;
  lightboxIndex = (lightboxIndex + step + lightboxImages.length) % lightboxImages.length;
  document.getElementById('lightbox-img').src = lightboxImages[lightboxIndex];
}

function closeLightbox(ev) {
  ev?.stopPropagation();
  const lb = document.getElementById('lightbox');
  lb.setAttribute('aria-hidden', 'true');
}

// Cerrar al hacer click en fondo (área oscura)
document.getElementById('lightbox').addEventListener('click', (e) => {
  const content = document.getElementById('lightbox-img');
  const isClickInside = content.contains(e.target);
  const isButton = e.target.closest('.prev, .next, .close');
  if (!isClickInside && !isButton) closeLightbox();
});

// ======= Lightbox PROYECTOS (por proyecto) =======
const projectImages = {
  "2025": ["16.jpg","17.jpg","18.jpg"]
};
let currentIndex = { "2025": 0 };
let currentProject = null; // proyecto activo

function openLightbox(project, index) {
  currentProject = project;
  currentIndex[project] = index;
  document.getElementById("lightbox-" + project).setAttribute('aria-hidden', 'false');
  document.getElementById("lightbox-img-" + project).src = projectImages[project][index];
}
function closeLightboxProyecto(ev, project) {
  ev?.stopPropagation();
  document.getElementById("lightbox-" + project).setAttribute('aria-hidden', 'true');
  currentProject = null;
}
function changeSlideProyecto(ev, project, step) {
  ev?.stopPropagation();
  currentIndex[project] = (currentIndex[project] + step + projectImages[project].length) % projectImages[project].length;
  document.getElementById("lightbox-img-" + project).src = projectImages[project][currentIndex[project]];
}
// Cerrar por click en fondo del lightbox de proyectos
document.getElementById('lightbox-2025')?.addEventListener('click', (e) => {
  const content = document.getElementById('lightbox-img-2025');
  const isClickInside = content.contains(e.target);
  const isButton = e.target.closest('.prev, .next, .close');
  if (!isClickInside && !isButton) closeLightboxProyecto(null,'2025');
});

// ======= Control con teclado para ambos lightbox =======
document.addEventListener("keydown", function(event) {
  // PROYECTOS
  if (currentProject) {
    if (event.key === "ArrowLeft") changeSlideProyecto(null, currentProject, -1);
    else if (event.key === "ArrowRight") changeSlideProyecto(null, currentProject, 1);
    else if (event.key === "Escape") closeLightboxProyecto(null, currentProject);
    return;
  }
  // PRODUCTOS
  const lb = document.getElementById('lightbox');
  if (lb && lb.getAttribute('aria-hidden') === 'false') {
    if (event.key === "ArrowLeft") changeSlideItem(null, -1);
    else if (event.key === "ArrowRight") changeSlideItem(null, 1);
    else if (event.key === "Escape") closeLightbox();
  }
});

// ======= Carrito =======
function agregarCarrito(producto, precio) {
  const idx = carrito.findIndex(p => p.producto === producto);
  if (idx >= 0) carrito[idx].cantidad += 1;
  else carrito.push({ producto, precio, cantidad: 1 });

  total += precio;
  mostrarCarrito();
  alert(`✅ ${producto} agregado al carrito`);
}

function mostrarCarrito() {
  const lista = document.getElementById("listaCarrito");
  lista.innerHTML = "";
  carrito.forEach((item, i) => {
    const li = document.createElement("li");
    const parcial = (item.precio * item.cantidad);
    li.innerHTML = `
      <span>${item.producto} (x${item.cantidad}) - $${parcial.toFixed(2)}</span>
      <span>
        <button class="btn-sm" onclick="cambiarCantidad(${i}, 1)">+</button>
        <button class="btn-sm" onclick="cambiarCantidad(${i}, -1)">-</button>
        <button class="btn-sm btn-danger" onclick="eliminarDelCarrito(${i})">x</button>
      </span>
      
    `;
    
    lista.appendChild(li);
  });
  document.getElementById("total").textContent = total.toFixed(2);
}

function cambiarCantidad(i, delta) {
  const item = carrito[i];
  if (!item) return;
  if (delta > 0) { item.cantidad += 1; total += item.precio; }
  else {
    if (item.cantidad > 1) { item.cantidad -= 1; total -= item.precio; }
    else { total -= item.precio; carrito.splice(i, 1); }
  }
  if (total < 0) total = 0;
  mostrarCarrito();
}

function eliminarDelCarrito(i) {
  if (!carrito[i]) return;
  total -= carrito[i].precio * carrito[i].cantidad;
  carrito.splice(i, 1);
  if (total < 0) total = 0;
  mostrarCarrito();
}

function mostrarQR() {
  const metodo = document.getElementById("metodoPago").value;
  const qr = document.getElementById("qrPago");
  qr.style.display = metodo === "zelle" ? "block" : "none";
}

// Guardar ventas en localStorage
function registrarVenta(producto, precio) {
  let ventas = JSON.parse(localStorage.getItem("ventas")) || [];
  ventas.push({ producto, precio, fecha: new Date().toLocaleString() });
  localStorage.setItem("ventas", JSON.stringify(ventas));
}

function mostrarVentas() {
  let ventas = JSON.parse(localStorage.getItem("ventas")) || [];
  let tabla = document.getElementById("tablaVentas");
  tabla.innerHTML = "";
  ventas.forEach(v => {
    let fila = document.createElement("tr");
    fila.innerHTML = `<td>${v.producto}</td><td>$${Number(v.precio).toFixed(2)}</td><td>${v.fecha}</td>`;
    tabla.appendChild(fila);
  });
}

function accederContable() {
  const pass = document.getElementById("passwordContable").value;
  if (pass === passwordAcceso) {
    document.getElementById("loginContable").style.display = "none";
    document.getElementById("panelContable").style.display = "block";
    mostrarVentas();
  } else {
    alert("Contraseña incorrecta ❌");
  }
}

// Recibo + PDF + registro de ventas
function generarRecibo() {
  if (carrito.length === 0) { alert("El carrito está vacío."); return; }
  const pago = document.getElementById("metodoPago").value;
  if (!pago) { alert("Seleccione un método de pago."); return; }

  const recibo = document.getElementById("recibo");
  recibo.style.display = "block";
  const fecha = new Date().toLocaleDateString();
  const hora = new Date().toLocaleTimeString();

  recibo.innerHTML = `
    <h3>🧾 Tienda Profesional</h3>
    <p><strong>Recibo #${folio}</strong></p>
    <p>Fecha: ${fecha} - ${hora}</p>
    <hr>
    <h4>Detalle de compra:</h4>
  `;
  carrito.forEach(item => {
    recibo.innerHTML += `<p>${item.producto} (x${item.cantidad}) - $${(item.precio * item.cantidad).toFixed(2)}</p>`;
  });
  recibo.innerHTML += `
    <hr>
    <p><strong>Total: $${total.toFixed(2)}</strong></p>
    <p>Método de Pago: ${pago}</p>
    <p>Gracias por su compra 🙌</p>
  `;

  // PDF con jsPDF
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("Tienda Profesional", 10, 20);
  doc.setFontSize(12);
  doc.text(`Recibo #${folio}`, 10, 30);
  doc.text(`Fecha: ${fecha} ${hora}`, 10, 40);
  doc.line(10, 45, 200, 45);
// DETALLE DE RECIBO DE COMPRA 
  let y = 55;
  doc.setFontSize(14);
  doc.text("Detalle de compra:", 10, y); y += 10;
  doc.setFontSize(12);
  carrito.forEach(item => {
    doc.text(`${item.producto} (x${item.cantidad}) - $${(item.precio * item.cantidad).toFixed(2)}`, 10, y);
    y += 8;
    if (y > 280) { doc.addPage(); y = 20; }
  });
  doc.line(10, y, 200, y); y += 10;
  doc.text(`Total: $${total.toFixed(2)}`, 10, y); y += 8;
  doc.text(`Método de Pago: ${pago}`, 10, y); y += 12;
  doc.text("Gracias por su compra, Lo espero Pronto", 10, y);
  doc.save(`recibo_${folio}.pdf`);

  // Registrar venta y limpiar
  carrito.forEach(item => registrarVenta(item.producto, (item.precio * item.cantidad)));
  folio++;
  carrito = [];
  total = 0;
  mostrarCarrito();
  alert("✅ Pago realizado con éxito. Recibo generado.");
}

// ======= Clientes =======
function abrirRegistroCliente() {
  document.getElementById("modalRegistro").style.display = "grid";
}
function cerrarRegistroCliente() {
  document.getElementById("modalRegistro").style.display = "none";
}
document.getElementById("formCliente").addEventListener("submit", function(e) {
  e.preventDefault();
  let cliente = {
    nombre: document.getElementById("nombreCliente").value,
    empresa: document.getElementById("empresaCliente").value,
    email: document.getElementById("emailCliente").value,
    telefono: document.getElementById("telefonoCliente").value
  };
  clientes.push(cliente);
  alert("Cliente registrado correctamente ✅");
  e.target.reset();
  cerrarRegistroCliente();
});

function abrirListaClientes() {
  let pass = prompt("Ingrese la contraseña de administrador:");
  if (pass === passwordAcceso) {
    document.getElementById("modalClientes").style.display = "grid";
    mostrarClientes();
  } else {
    alert("Contraseña incorrecta ❌");
  }
}
function cerrarListaClientes() {
  document.getElementById("modalClientes").style.display = "none";
}
function mostrarClientes() {
  let lista = document.getElementById("listaClientes");
  lista.innerHTML = "";
  clientes.forEach((c) => {
    let li = document.createElement("li");
    li.textContent = `${c.nombre} (${c.email}) - ${c.telefono}`;
    lista.appendChild(li);
  });
}

// ======= Sugerencias =======
function cargarSugerencias() {
  const s = JSON.parse(localStorage.getItem("sugerencias") || "[]");
  const ul = document.getElementById("listaSugerencias");
  ul.innerHTML = "";
  s.forEach((it) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${it.nombre}</strong>: ${it.mensaje} <span class="muted">(${it.fecha})</span>`;
    ul.appendChild(li);
  });
}
document.getElementById("formSugerencia").addEventListener("submit", (e) => {
  e.preventDefault();
  const nombre = document.getElementById("sugNombre").value.trim();
  const mensaje = document.getElementById("sugMensaje").value.trim();
  if (!nombre || !mensaje) return;
  const s = JSON.parse(localStorage.getItem("sugerencias") || "[]");
  s.push({ nombre, mensaje, fecha: new Date().toLocaleString() });
  localStorage.setItem("sugerencias", JSON.stringify(s));
  e.target.reset();
  cargarSugerencias();
  alert("✅ ¡Gracias por tu sugerencia!");
});

// ======= Cerrar modales al hacer click en fondo =======
document.getElementById('modalRegistro').addEventListener('click', (e)=>{
  if (e.target.id === 'modalRegistro') cerrarRegistroCliente();
});
document.getElementById('modalClientes').addEventListener('click', (e)=>{
  if (e.target.id === 'modalClientes') cerrarListaClientes();
});


// ============================
// 🔹 PRESUPUESTO DE MATERIALES
// ============================
function agregarMaterial() {
  const tabla = document.querySelector("#tablaPresupuesto tbody");

  const fila = document.createElement("tr");

  fila.innerHTML = `
    <td><input type="text" placeholder="Material"></td>
    <td><input type="number" value="1" min="1" onchange="actualizarPresupuesto()"></td>
    <td><input type="number" value="0" min="0" onchange="actualizarPresupuesto()"></td>
    <td class="subtotal">$0</td>
    <td><button onclick="this.closest('tr').remove(); actualizarPresupuesto()">🗑️</button></td>
  `;

  tabla.appendChild(fila);
  actualizarPresupuesto();
}
// ============================
// 🔹 PRESUPUESTO DE MATERIALES
// ============================
function actualizarPresupuesto() {
  let total = 0;
  document.querySelectorAll("#tablaPresupuesto tbody tr").forEach(fila => {
    const cantidad = parseFloat(fila.children[1].querySelector("input").value) || 0;
    const precio = parseFloat(fila.children[2].querySelector("input").value) || 0;
    const subtotal = cantidad * precio;
    fila.querySelector(".subtotal").textContent = `$${subtotal.toFixed(2)}`;
    total += subtotal;
  });
  document.getElementById("totalPresupuesto").textContent = `$${total.toFixed(2)}`;
}

function imprimirPresupuesto() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const cliente = document.getElementById("presCliente").value;
  const proyecto = document.getElementById("presProyecto").value;
  const fecha = new Date().toLocaleDateString();

  let y = 20;

  doc.setFontSize(16);
  doc.text("Presupuesto de Materiales", 14, y); y += 10;
  doc.setFontSize(12);
  doc.text(`Cliente: ${cliente}`, 14, y); y += 6;
  doc.text(`Proyecto: ${proyecto}`, 14, y); y += 6;
  doc.text(`Fecha: ${fecha}`, 14, y); y += 10;

  doc.text("Materiales:", 14, y); y += 8;

  document.querySelectorAll("#tablaPresupuesto tbody tr").forEach(fila => {
    const material = fila.children[0].querySelector("input").value;
    const cantidad = fila.children[1].querySelector("input").value;
    const precio = fila.children[2].querySelector("input").value;
    const subtotal = fila.querySelector(".subtotal").textContent;
    doc.text(`${material} | Cant: ${cantidad} | Precio: $${precio} | Subtotal: ${subtotal}`, 14, y);
    y += 6;
  });

  y += 10;
  const total = document.getElementById("totalPresupuesto").textContent;
  doc.setFontSize(14);
  doc.text(`TOTAL: ${total}`, 14, y);

  doc.save("presupuesto.pdf");
}


function imprimirPresupuesto() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // 🔹 Logo (ejemplo cuadrado azul, cámbialo por tu logo en Base64 si quieres)
  doc.setFillColor(79, 140, 255);
  doc.rect(15, 10, 20, 20, "F");

  // 🔹 Nombre de la página
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Stradivaryus Tool", 40, 20);

  // Línea separadora
  doc.setDrawColor(200);
  doc.line(15, 35, 195, 35);

  // 🔹 Datos Cliente y Proyecto
  let cliente = document.getElementById("presCliente").value || "No especificado";
  let proyecto = document.getElementById("presProyecto").value || "No especificado";

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Cliente: ${cliente}`, 15, 45);
  doc.text(`Proyecto: ${proyecto}`, 15, 52);
  doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 15, 59);

  // 🔹 Tabla de materiales
  const filas = [];
  document.querySelectorAll("#tablaPresupuesto tbody tr").forEach(tr => {
    let material = tr.querySelector("input[name='material']").value;
    let cantidad = tr.querySelector("input[name='cantidad']").value;
    let precio = tr.querySelector("input[name='precio']").value;
    let subtotal = tr.cells[3].innerText;
    filas.push([material, cantidad, precio, subtotal]);
  });

  doc.autoTable({
    startY: 70,
    head: [["Material", "Cantidad", "Precio Unit.", "Subtotal"]],
    body: filas,
    styles: {
      halign: "center",
      valign: "middle",
    },
    headStyles: {
      fillColor: [79, 140, 255],
      textColor: 255,
      fontSize: 11,
    },
    bodyStyles: {
      fontSize: 10,
    },
    theme: "grid"
  });

  // 🔹 Total destacado
  let finalY = doc.lastAutoTable.finalY + 10;
  let total = document.getElementById("totalPresupuesto").innerText;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`Total: ${total}`, 150, finalY);

  // Línea separadora final
  doc.setDrawColor(200);
  doc.line(15, finalY + 10, 195, finalY + 10);

  // 🔹 Pie de página
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.text("Gracias por confiar en Stradivaryus Tool", 105, finalY + 20, { align: "center" });

  // 🔹 Guardar PDF
  doc.save(`Presupuesto_${cliente}_${new Date().toISOString().slice(0,10)}.pdf`);
}

// ==============================
// PRESUPUESTO: Fix imprimir + total
// ==============================
(() => {
  const TBODY = document.querySelector('#tablaPresupuesto tbody');
  const TOTAL_EL = document.getElementById('totalPresupuesto');

  // ——— Añadir material (sin cambiar tu HTML)
  function agregarMaterial() {
    const material = prompt('Material:');
    if (!material) return;

    const cantStr = prompt('Cantidad:', '1');
    const cantidad = parseFloat(cantStr);
    if (isNaN(cantidad) || cantidad <= 0) return;

    const precStr = prompt('Precio unitario:', '0');
    const precio = parseFloat(precStr);
    if (isNaN(precio) || precio < 0) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="pres-inp" value="${material}"></td>
      <td><input type="number" class="pres-inp pres-cant" min="1" step="1" value="${cantidad}"></td>
      <td><input type="number" class="pres-inp pres-precio" min="0" step="0.01" value="${precio.toFixed(2)}"></td>
      <td class="pres-sub">$${(cantidad * precio).toFixed(2)}</td>
      <td><button type="button" class="pres-del">🗑️</button></td>
    `;
    TBODY.appendChild(tr);
    actualizarFila(tr);
    actualizarTotal();
  }

  function actualizarFila(tr) {
    const cant = parseFloat(tr.querySelector('.pres-cant')?.value) || 0;
    const precio = parseFloat(tr.querySelector('.pres-precio')?.value) || 0;
    tr.querySelector('.pres-sub').textContent = '$' + (cant * precio).toFixed(2);
  }

  function actualizarTotal() {
    let total = 0;
    TBODY.querySelectorAll('tr').forEach(tr => {
      const subTxt = tr.querySelector('.pres-sub')?.textContent?.replace('$', '').trim() || '0';
      total += parseFloat(subTxt) || 0;
    });
    TOTAL_EL.textContent = '$' + total.toFixed(2);
  }

  // Delegación de eventos para inputs y borrar
  TBODY.addEventListener('input', (e) => {
    if (e.target.classList.contains('pres-cant') || e.target.classList.contains('pres-precio')) {
      const tr = e.target.closest('tr');
      actualizarFila(tr);
      actualizarTotal();
    }
  });

  TBODY.addEventListener('click', (e) => {
    if (e.target.classList.contains('pres-del')) {
      e.target.closest('tr')?.remove();
      actualizarTotal();
    }
  });

  // ——— Imprimir presupuesto (robusto)
  function imprimirPresupuesto() {
    // 1) Recolectar datos (funciona con <input> dinámicos)
    const rows = [];
    TBODY.querySelectorAll('tr').forEach(tr => {
      const mat = tr.querySelector('td:nth-child(1) input')?.value?.trim() || '';
      const cant = tr.querySelector('.pres-cant')?.value || '0';
      const precio = tr.querySelector('.pres-precio')?.value || '0';
      const sub = (parseFloat(cant) || 0) * (parseFloat(precio) || 0);
      rows.push([mat, cant, Number(precio).toFixed(2), sub.toFixed(2)]);
    });

    if (!rows.length) {
      alert('Agrega al menos un material antes de imprimir.');
      return;
    }

    const cliente = document.getElementById('presCliente')?.value?.trim() || '—';
    const proyecto = document.getElementById('presProyecto')?.value?.trim() || '—';
    const totalTexto = (TOTAL_EL.textContent || '$0').replace('$', '').trim();
    const totalNum = Number(totalTexto) || 0;

    
    // 2) jsPDF + AutoTable
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF || !window.jspdf?.jsPDF) {
      alert('No se cargó jsPDF. Verifica que la librería esté incluida antes de AutoTable.');
      return;
    }

    const doc = new jsPDF('p', 'pt', 'a4');

    // — Encabezado profesional
    doc.setFillColor(79, 140, 255);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 70, 'F');

    doc.setTextColor(255, 255, 250);
    doc.setFontSize(20);
    doc.text('Stradivaryus Klem', 40, 35);
    

    doc.setFontSize(12);
    doc.text('Presupuesto de Materiales', 40, 55);

    // Datos proyecto/cliente
    doc.setTextColor(0, 0, 0);
    let y = 100;
    doc.setFontSize(11);
    doc.text(`Cliente: ${cliente}`, 40, y); y += 16;
    doc.text(`Proyecto: ${proyecto}`, 40, y); y += 16;
    doc.text(`Fecha: ${new Date().toLocaleString()}`, 40, y); y += 10;

    // — Tabla
    doc.autoTable({
      startY: y + 10,
      head: [['Material', 'Cantidad', 'P. Unit', 'Subtotal']],
      body: rows,
      styles: { halign: 'center', cellPadding: 6 },
      headStyles: { fillColor: [79, 140, 255], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { halign: 'left' } }
    });

    const afterTableY = doc.lastAutoTable.finalY + 20;

    // — Total
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`TOTAL: $${totalNum.toFixed(2)}`, 40, afterTableY);

    // Pie de página
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text('Stradivaryus Klem • El Rincón de tus Herramientas', 40, pageH - 30);

    doc.save(`presupuesto_${Date.now()}.pdf`);
  }

  // Exponer funciones al ámbito global para que funcionen los onclick del HTML
  window.agregarMaterial = agregarMaterial;
  window.imprimirPresupuesto = imprimirPresupuesto;
})();


//guardar clientes
function registrarCliente() {
  const nombre = document.getElementById('nombreCliente').value.trim();
  const email = document.getElementById('emailCliente').value.trim();
  const telefono = document.getElementById('telefonoCliente').value.trim();

  if (!nombre || !email) {
    alert("Por favor completa los campos obligatorios.");
    return;
  }

  const cliente = { nombre, email, telefono };

  // Guardar en memoria/localStorage
  localStorage.setItem("clienteActual", JSON.stringify(cliente));

  alert(`Cliente ${nombre} registrado correctamente.`);
  document.getElementById('modalRegistro').style.display = "none";
}

// === CLIENTES ===
function cargarClientes() {
  const clientes = JSON.parse(localStorage.getItem("clientes") || "[]");
  const tbody = document.querySelector("#tablaClientes tbody");
  tbody.innerHTML = "";

  clientes.forEach((c, index) => {
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${c.nombre}</td>
      <td>${c.email}</td>
      <td>${c.telefono}</td>
      <td>
        <button onclick="borrarCliente(${index})">❌ Borrar</button>
      </td>
    `;
    tbody.appendChild(fila);
  });
}

function registrarCliente(nombre, email, telefono) {
  const clientes = JSON.parse(localStorage.getItem("clientes") || "[]");
  clientes.push({ nombre, email, telefono });
  localStorage.setItem("clientes", JSON.stringify(clientes));
  cargarClientes();
}

function borrarCliente(index) {
  const clientes = JSON.parse(localStorage.getItem("clientes") || "[]");
  clientes.splice(index, 1);
  localStorage.setItem("clientes", JSON.stringify(clientes));
  cargarClientes();
}

// Manejar formulario de 
document.getElementById("formCliente").addEventListener("submit", function(e){
  e.preventDefault();
  const nombre = document.getElementById("nombreCliente").value.trim();
  const email = document.getElementById("emailCliente").value.trim();
  const telefono = document.getElementById("telefonoCliente").value.trim();

  if(!nombre || !email){
    alert("muchas gracias por registrarse, esta informacion sera usada para base de datos de clientes.");
    return;
  }

  registrarCliente(nombre, email, telefono);

  this.reset(); // limpiar formulario
});

// Cargar al abrir
window.addEventListener("load", cargarClientes);

// Ejemplo dentro de tu script.js al generar recibo:
const reciboHTML = generarReciboTraducido(
  "Juan Pérez",                // nombre del cliente
  document.getElementById("metodoPago").value, // método
  ["DEWALT Taladro 20V - $40"], // lista de items
  40.00                         // total
);
document.getElementById("recibo").innerHTML = reciboHTML;

