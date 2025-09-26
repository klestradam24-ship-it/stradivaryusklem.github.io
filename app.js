(() => {
  /* ===== Helpers ===== */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const LS = {
    get: (k, f) => {
      try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; }
    },
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
  };
  const cur = n => (Number(n) || 0).toFixed(2);

  async function hashString(str) {
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    const arr = Array.from(new Uint8Array(buf));
    return arr.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function toast(msg) {
    let box = $('#toastBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toastBox';
      Object.assign(box.style, { position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)', zIndex: '9999' });
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    Object.assign(t.style, {
      opacity: '0',
      transition: 'opacity .25s ease, transform .25s ease',
      background: 'var(--card,#101826)',
      color: 'var(--text,#e8eef8)',
      padding: '10px 14px',
      borderRadius: '10px',
      boxShadow: '0 6px 20px rgba(0,0,0,.35)',
      marginTop: '8px',
      transform: 'translateY(6px)'
    });
    box.appendChild(t);
    requestAnimationFrame(() => {
      t.style.opacity = '1';
      t.style.transform = 'translateY(0)';
    });
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateY(6px)';
      t.addEventListener('transitionend', () => t.remove(), { once: true });
    }, 2600);
  }

  function esc(s = '') {
    return s.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
  function u() { return Math.random().toString(36).slice(2, 9); }

  /* ===== Estado ===== */
  const ST = {
    authed: sessionStorage.getItem('st_admin_ok') === '1',
    tax: Number(LS.get('taxRate', 5.75)),
    productos: LS.get('productos', []),
    proyectos: LS.get('proyectos', []),
    hero: LS.get('hero', []),
    clientes: LS.get('clientes', []),
    carrito: LS.get('carrito', []),
    ventas: LS.get('ventas', []),
    presupuestos: LS.get('presupuestos', []),
    folio: Number(LS.get('folio', 1)),
    lb: { list: [], idx: 0, zoom: 1 },
    slideIdx: 0,
    search: { q: '', cat: '' },
    paypalReady: false,
    paypalTxn: null
  };

  /* ===== Init ===== */
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    // Reset admin por URL
    try {
      const qs = new URLSearchParams(location.search);
      if (qs.get('resetadmin') === '1') {
        LS.set('adminHash', null);
        sessionStorage.removeItem('st_admin_ok');
        toast('Admin reseteado. Configura una nueva clave en Admin.');
      }
    } catch { }

    // SW
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => { });
    }

    bgAnimate();
    setupHeaderNav();
    setupTabbar();
    setupCliente();     // Cliente libre (sin gate)
    setupAdmin();       // Admin con login y primer-setup
    initHero();
    initProductos();
    initCarrito();
    initProyectos();
    initPresupuestoAdmin();
    lightboxInit();
    themeInit();
    setupThemeSwitch();

    const d = $('#legalDate');
    if (d) d.textContent = new Date().toLocaleDateString();

    $('#btnLegal')?.addEventListener('click', () => { goTopCliente(); subGo('legal'); });
    $('#btnContactar')?.addEventListener('click', () => { goTopCliente(); subGo('contacto'); });

    injectSEO();
  }

  /* ===== SEO JSON-LD ===== */
  function injectSEO() {
    try {
      const head = document.head;
      const add = (tag, attrs) => {
        const el = document.createElement(tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        head.appendChild(el);
      };
      if (!document.querySelector('meta[name="description"]')) {
        add('meta', { name: 'description', content: 'Herramientas, proyectos y servicios en Cincinnati. Ventas, instalación y presupuestos al instante.' });
      }
      if (!document.querySelector('meta[property="og:title"]')) {
        add('meta', { property: 'og:title', content: 'Stradivaryus Tools' });
        add('meta', { property: 'og:description', content: 'Catálogo de herramientas y proyectos. Presupuestos en PDF. Contacto rápido.' });
        add('meta', { property: 'og:type', content: 'website' });
      }
      const base = location.origin + location.pathname.replace(/[^/]*$/, '');
      const ld = {
        "@context": "https://schema.org",
        "@type": "HardwareStore",
        "name": "Stradivaryus Tools",
        "image": base + "logoklem.png",
        "telephone": "+1-513-379-0469",
        "email": "info@stradivaryus.com",
        "address": { "@type": "PostalAddress", "addressLocality": "Cincinnati", "addressRegion": "OH", "addressCountry": "US" },
        "openingHours": "Mo-Fr 09:00-17:00"
      };
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.textContent = JSON.stringify(ld);
      head.appendChild(s);
    } catch { }
  }

  /* ===== Fondo Canvas ===== */
  function bgAnimate() {
    const c = $('#bg');
    if (!c) return;
    const g = c.getContext('2d');
    let t = 0;
    resize();
    window.addEventListener('resize', resize);
    function resize() { c.width = innerWidth; c.height = innerHeight; }
    (function draw() {
      t += 0.004;
      g.clearRect(0, 0, c.width, c.height);
      for (let i = 0; i < 60; i++) {
        const x = (Math.sin(t + i) * .5 + .5) * c.width;
        const y = (Math.cos(t * 1.3 + i * .7) * .5 + .5) * c.height;
        const r = 60 + 40 * Math.sin(t + i * 2);
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, '#12234155');
        grd.addColorStop(1, '#0000');
        g.fillStyle = grd;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
      requestAnimationFrame(draw);
    })();
  }

  /* ===== Navegación ===== */
  function setupHeaderNav() {
    $$('[data-go], [data-subgo]').forEach(b => {
      b.addEventListener('click', () => {
        const go = b.getAttribute('data-go');
        const sub = b.getAttribute('data-subgo');
        if (go === 'cliente') {
          goTopCliente();
          if (sub) subGo(sub);
        } else if (go) {
          goView(go);
        }
      });
    });
    $('#btnSearch')?.addEventListener('click', applySearch);
    $('#searchBox')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') applySearch(); });
    $('#searchCat')?.addEventListener('change', applySearch);
  }
  function applySearch() {
    const q = ($('#searchBox')?.value || '').trim().toLowerCase();
    const cat = ($('#searchCat')?.value || '').trim();
    ST.search = { q, cat };
    if (typeof renderProductosCliente === 'function') renderProductosCliente(q, cat);
    if (typeof renderProyectosCliente === 'function') renderProyectosCliente(q, cat);
  }
  function setupTabbar() {
    $$('.tabbar button').forEach(b => {
      b.addEventListener('click', () => {
        const dest = b.dataset.go;
        goView(dest);
        if (dest === 'cliente') {
          goTopCliente();
          subGo('productos');
        }
      });
    });
  }
  function goView(id) {
    $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.go === id));
    $$('.view').forEach(v => v.classList.remove('show'));
    const target = $('#view-' + id);
    if (target) target.classList.add('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function goTopCliente() {
    $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.go === 'cliente'));
    $$('.view').forEach(v => v.classList.remove('show'));
    $('#view-cliente')?.classList.add('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function subGo(alias) {
    const viewId = 'view-' + alias;
    $$('#clienteViewsMount .view').forEach(v => v.classList.remove('show'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('show');
    $('#subtabCliente')?.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.subgo === alias));
    applySearch();
  }

  /* ===== Cliente: libre (sin gate) ===== */
  function setupCliente() {
    // libre por diseño
    subGo('productos');
  }

  /* ===== Admin ===== */
  function setupAdmin() {
    const adminHash = LS.get('adminHash', null);
    const loginBox = $('#adminLoginBox');
    const firstSetup = $('#adminFirstSetup');

    if (!adminHash) {
      firstSetup?.classList.remove('hidden');
      loginBox?.classList.add('hidden');
    } else {
      firstSetup?.classList.add('hidden');
      loginBox?.classList.remove('hidden');
    }

    // Crear primera clave
    $('#adminSetFirst')?.addEventListener('click', async () => {
      const np = $('#adminNewFirst')?.value.trim();
      if (!np || np.length < 3) return alert('Mínimo 3 caracteres');
      const h = await hashString(np);
      LS.set('adminHash', h);
      toast('Clave guardada. Ya puedes ingresar al Admin.');
      firstSetup?.classList.add('hidden');
      loginBox?.classList.remove('hidden');
      $('#adminNewFirst').value = '';
    });

    // Login
    $('#adminEnter')?.addEventListener('click', adminLogin);
    $('#adminPass')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') adminLogin(); });

    // Quick actions
    $('#taxSave')?.addEventListener('click', () => {
      ST.tax = Number($('#taxInput')?.value || 0);
      LS.set('taxRate', ST.tax);
      updateTotals();
      toast('Sales Tax guardado');
    });

    $('#passSave')?.addEventListener('click', async () => {
      const np = $('#passNew')?.value.trim();
      if (!np || np.length < 3) return alert('Mínimo 3 caracteres');
      const h = await hashString(np);
      LS.set('adminHash', h);
      $('#passNew').value = '';
      toast('Contraseña Admin actualizada');
    });

    $('#clearVentas')?.addEventListener('click', () => {
      if (confirm('¿Eliminar ventas?')) {
        ST.ventas = [];
        LS.set('ventas', []);
        pintarVentas();
        pintarClientes();
      }
    });
    $('#clearClientes')?.addEventListener('click', () => {
      if (confirm('¿Eliminar clientes (incluye directorio)?')) {
        ST.clientes = [];
        LS.set('clientes', []);
        pintarClientes();
        pintarClientesDir();
        renderClientesSel();
      }
    });
    $('#clearPres')?.addEventListener('click', () => {
      if (confirm('¿Eliminar presupuestos?')) {
        ST.presupuestos = [];
        LS.set('presupuestos', []);
        pintarPres();
      }
    });

    $('#importHero')?.addEventListener('change', (e) => filesToDataURL(e.target.files).then(imgs => {
      ST.hero.push(...imgs);
      LS.set('hero', ST.hero);
      renderHero();
      renderHeroAdmin();
      toast('Imágenes añadidas al muro');
      e.target.value = '';
    }));
    $('#clearHero')?.addEventListener('click', () => {
      if (confirm('¿Vaciar todas las imágenes del Muro?')) {
        ST.hero = [];
        LS.set('hero', ST.hero);
        renderHero();
        renderHeroAdmin();
        toast('Muro limpiado');
      }
    });

    if (ST.authed) {
      openPanel();
      document.documentElement.classList.add('admin-on');
    }
  }

  async function adminLogin() {
    const p = $('#adminPass')?.value.trim();
    if (!p) return alert('Ingresa la contraseña');
    const ph = await hashString(p);
    const ok = ph === LS.get('adminHash', null);
    if (ok) {
      ST.authed = true;
      sessionStorage.setItem('st_admin_ok', '1');
      openPanel();
      toast('Acceso concedido ✅');
      document.documentElement.classList.add('admin-on');
    } else alert('Contraseña incorrecta');
  }

  function openPanel() {
    $('#adminGate')?.classList.add('hidden');
    $('#adminPanel')?.classList.remove('hidden');
    $('#taxInput').value = ST.tax;
    $('#tabAdmin')?.classList.remove('hidden');

    // Logout card dinámico
    const row = $('#adminQuickRow');
    if (row && !$('#btnLogout')) {
      const card = document.createElement('div');
      card.className = 'card mini';
      card.innerHTML = `
        <h3>Sesión</h3>
        <div class="row">
          <button id="btnLogout" class="btn danger">Cerrar sesión</button>
        </div>`;
      row.appendChild(card);
      $('#btnLogout').onclick = () => {
        ST.authed = false;
        sessionStorage.removeItem('st_admin_ok');
        $('#adminPanel')?.classList.add('hidden');
        $('#adminGate')?.classList.remove('hidden');
        $('#tabAdmin')?.classList.add('hidden');
        toast('Sesión cerrada');
        document.documentElement.classList.remove('admin-on');
      };
    }

    renderHeroAdmin();
    renderProductosAdmin();
    renderProyectosAdmin();
    pintarVentas();
    pintarClientes();
    pintarClientesDir();
    pintarPres();
    ensureBackupCard();
  }

  /* ===== Backup/Restore ===== */
  function ensureBackupCard() {
    const row = $('#adminQuickRow');
    if (!row || $('#backupCard')) return;
    const card = document.createElement('div');
    card.className = 'card mini';
    card.id = 'backupCard';
    card.innerHTML = `
      <h3>Respaldo</h3>
      <div class="row wrap">
        <button id="btnExport" class="btn">Exportar JSON</button>
        <label class="btn ghost">Importar JSON
          <input id="impJson" type="file" accept="application/json" hidden>
        </label>
      </div>`;
    row.appendChild(card);

    $('#btnExport').onclick = () => {
      const data = {
        tax: ST.tax, productos: ST.productos, proyectos: ST.proyectos, hero: ST.hero,
        clientes: ST.clientes, ventas: ST.ventas, presupuestos: ST.presupuestos, folio: ST.folio
      };
      download('stradivaryus_backup.json', JSON.stringify(data, null, 2), 'application/json');
      toast('Backup exportado');
    };
    $('#impJson').onchange = async (e) => {
      try {
        const file = e.target.files?.[0];
        if (!file) return;
        const txt = await file.text();
        const data = JSON.parse(txt);
        if (!data) return alert('JSON inválido');
        ST.tax = Number(data.tax ?? ST.tax);            LS.set('taxRate', ST.tax);
        ST.productos = Array.isArray(data.productos) ? data.productos : ST.productos;  LS.set('productos', ST.productos);
        ST.proyectos = Array.isArray(data.proyectos) ? data.proyectos : ST.proyectos;  LS.set('proyectos', ST.proyectos);
        ST.hero = Array.isArray(data.hero) ? data.hero : ST.hero;                      LS.set('hero', ST.hero);
        ST.clientes = Array.isArray(data.clientes) ? data.clientes : ST.clientes;      LS.set('clientes', ST.clientes);
        ST.ventas = Array.isArray(data.ventas) ? data.ventas : ST.ventas;              LS.set('ventas', ST.ventas);
        ST.presupuestos = Array.isArray(data.presupuestos) ? data.presupuestos : ST.presupuestos; LS.set('presupuestos', ST.presupuestos);
        ST.folio = Number.isFinite(data.folio) ? Number(data.folio) : ST.folio;        LS.set('folio', ST.folio);

        renderHero(); renderHeroAdmin();
        renderProductosCliente(); renderProductosAdmin();
        renderProyectosCliente(); renderProyectosAdmin();
        pintarVentas(); pintarClientes(); pintarClientesDir(); pintarPres();
        renderClientesSel(); updateTotals();
        toast('Backup importado');
      } catch (err) {
        console.error(err);
        alert('No se pudo importar el JSON');
      }
    };
  }

  /* ===== Utilidades de archivos/imagenes ===== */
  async function filesToDataURL(fileList) {
    if (!fileList || !fileList.length) return [];
    const arr = Array.from(fileList);
    const read = f => new Promise(res => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(f);
    });
    return await Promise.all(arr.map(read));
  }
  async function filesToDataURLCompressed(fileList, maxDim = 1400, quality = 0.82) {
    if (!fileList || !fileList.length) return [];
    const datas = await filesToDataURL(fileList);
    const outs = [];
    for (const d of datas) outs.push(await makeThumb(d, maxDim, quality));
    return outs;
  }
  async function makeThumb(dataURL, maxDim = 1400, quality = 0.82) {
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const cnv = document.createElement('canvas');
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        cnv.width = Math.max(1, Math.round(img.naturalWidth * scale));
        cnv.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = cnv.getContext('2d');
        ctx.drawImage(img, 0, 0, cnv.width, cnv.height);
        res(cnv.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => res(dataURL);
      img.src = dataURL;
    });
  }
  function download(name, data, mime = 'application/octet-stream') {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  /* ===== Hero ===== */
  function initHero() {
    if (!ST.hero.length) {
      ST.hero = ['muro/1.jpg', 'muro/2.jpg', 'muro/3.jpg'];
      LS.set('hero', ST.hero);
    }
    renderHero();
    setupHeroNav();
  }
  function renderHero() {
    const cont = $('#heroSlider');
    if (!cont) return;
    cont.innerHTML = ST.hero.map((src, i) => `
      <img class="hslide${i === 0 ? ' active' : ''}" data-ix="${i}" ${i > 0 ? 'loading="lazy"' : ''} src="${src}" alt="Muro ${i + 1}">
    `).join('');
    const dots = $('#heroDots');
    if (dots) {
      dots.innerHTML = ST.hero.map((_, i) => `
        <button class="seg${i === 0 ? ' active' : ''}" data-goto="${i}" aria-label="Ir a imagen ${i + 1}"></button>
      `).join('');
      dots.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => showSlide(Number(b.dataset.goto), true));
    }
  }
  let timerHero = null;
  function setupHeroNav() {
    $('#hPrev')?.addEventListener('click', () => showSlide(ST.slideIdx - 1, true));
    $('#hNext')?.addEventListener('click', () => showSlide(ST.slideIdx + 1, true));
    autoHero();
  }
  function autoHero() {
    clearInterval(timerHero);
    timerHero = setInterval(() => showSlide(ST.slideIdx + 1, false), 7000);
  }
  function showSlide(n, user) {
    const a = $$('#heroSlider .hslide');
    if (!a.length) return;
    ST.slideIdx = (n + a.length) % a.length;
    a.forEach((s, ix) => s.classList.toggle('active', ix === ST.slideIdx));
    const dots = $$('#heroDots .seg');
    dots.forEach((d, ix) => d.classList.toggle('active', ix === ST.slideIdx));
    if (user) autoHero();
  }
  function renderHeroAdmin() {
    const g = $('#gridHeroAdmin');
    if (!g) return;
    g.innerHTML = ST.hero.map((src, ix) => `
      <div class="thumb" draggable="true" data-ix="${ix}">
        <img loading="lazy" src="${src}" alt="Muro ${ix + 1}">
        <button class="chip danger" data-delh="${ix}">Eliminar</button>
      </div>
    `).join('') || `<div class="muted">Sin imágenes aún</div>`;
    g.querySelectorAll('[data-delh]').forEach(b => b.onclick = () => {
      ST.hero.splice(Number(b.dataset.delh), 1);
      LS.set('hero', ST.hero);
      renderHero(); renderHeroAdmin();
      toast('Imagen eliminada');
    });
    enableThumbDnD(g);
  }
  function enableThumbDnD(container) {
    let dragIx = null;
    container.querySelectorAll('.thumb').forEach(el => {
      el.addEventListener('dragstart', () => { dragIx = Number(el.dataset.ix); el.classList.add('dragging'); });
      el.addEventListener('dragend', () => { el.classList.remove('dragging'); });
      el.addEventListener('dragover', e => { e.preventDefault(); el.style.outline = '2px dashed var(--brand)'; });
      el.addEventListener('dragleave', () => { el.style.outline = ''; });
      el.addEventListener('drop', e => {
        e.preventDefault(); el.style.outline = '';
        const dropIx = Number(el.dataset.ix);
        if (!Number.isInteger(dragIx) || !Number.isInteger(dropIx) || dragIx === dropIx) return;
        const arr = ST.hero.slice();
        const [moved] = arr.splice(dragIx, 1);
        arr.splice(dropIx, 0, moved);
        ST.hero = arr; LS.set('hero', ST.hero);
        renderHero(); renderHeroAdmin();
        toast('Orden actualizado');
      });
    });
  }

  /* ===== Productos ===== */
  function initProductos() {
    if (!ST.productos.length) {
      ST.productos = [
        { id: u(), nombre: 'Taladro Inalámbrico', precio: 129.99, imgs: ['venta/1.jpg'], vendido: false },
        { id: u(), nombre: 'Sierra Circular', precio: 99.50, imgs: ['venta/1.jpg'], vendido: false },
        { id: u(), nombre: 'Lijadora Orbital', precio: 59.95, imgs: ['venta/1.jpg'], vendido: false },
      ];
      LS.set('productos', ST.productos);
    } else {
      ST.productos = ST.productos.map(p => ({ vendido: false, imgs: [], ...p }));
      LS.set('productos', ST.productos);
    }
    renderProductosCliente();
    $('#addProducto')?.addEventListener('click', openFormProducto);
    $('#importProductos')?.addEventListener('change', async (e) => {
      const files = e.target.files || [];
      if (!files.length) return;
      const imgs = await filesToDataURLCompressed(files, 1400, 0.82);
      imgs.forEach((src, i) => ST.productos.push({ id: u(), nombre: `Imagen ${i + 1}`, precio: Math.round(Math.random() * 90 + 10), imgs: [src], vendido: false }));
      LS.set('productos', ST.productos);
      renderProductosCliente();
      renderProductosAdmin();
      toast(`Se añadieron ${imgs.length} imagen(es)`);
      e.target.value = '';
    });
    renderProductosAdmin();
  }
  function cardProdCliente(p) {
    const img = p.imgs?.[0] || 'venta/1.jpg';
    const sold = p.vendido === true;
    const count = (p.imgs?.length || 0);
    const minis = (p.imgs || []).slice(0, 4);
    return `
      <article class="item ${sold ? 'vendido' : ''}">
        <div class="img">
          ${sold ? '<div class="badge-vendido">VENDIDO</div>' : ''}
          ${count ? `<div class="badge-count">${count} foto${count > 1 ? 's' : ''}</div>` : ''}
          <img loading="lazy" src="${img}" alt="${esc(p.nombre)}">
        </div>
        ${minis.length ? `
          <div class="mini-thumbs">
            ${minis.map(s => `<img loading="lazy" src="${s}" alt="thumb ${esc(p.nombre)}">`).join('')}
          </div>` : ''
        }
        <div class="body">
          <h3 class="title">${esc(p.nombre)}</h3>
          <div class="price">$${cur(p.precio)}</div>
          <div class="row">
            <button class="btn primary" data-add="${p.id}" ${sold ? 'disabled' : ''}>${sold ? 'No disponible' : 'Añadir'}</button>
            <button class="btn ghost" data-lb="${p.id}">Ver</button>
          </div>
        </div>
      </article>`;
  }
  function renderProductosCliente(q = '', cat = '') {
    const grid = $('#gridProductos');
    if (!grid) return;
    let list = ST.productos.slice();
    if (q) list = list.filter(p => p.nombre.toLowerCase().includes(q));
    grid.innerHTML = list.map(p => cardProdCliente(p)).join('');
    grid.querySelectorAll('[data-add]').forEach(b => b.onclick = () => addCart(b.dataset.add));
    grid.querySelectorAll('[data-lb]').forEach(b => {
      b.onclick = () => {
        const list = ST.productos.find(x => x.id === b.dataset.lb)?.imgs || [];
        openLB(list, 0);
      };
    });
  }
  function cardProdAdmin(p) {
    const thumbs = (p.imgs || []).map((src, ix) => `
      <div class="thumb">
        <img loading="lazy" src="${src}" alt="${esc(p.nombre)} img ${ix + 1}">
        <button class="chip danger" data-delimg="${p.id}" data-idx="${ix}">Eliminar</button>
      </div>`).join('') || `<div class="muted">Sin imágenes aún</div>`;
    return `
      <article class="card">
        <div class="row wrap" style="justify-content:space-between;align-items:center">
          <strong>${esc(p.nombre)}</strong>
          <div class="row wrap">
            <button class="chip" data-view="${p.id}">Ver galería</button>
            <button class="chip ${p.vendido ? 'danger' : ''}" data-togglevend="${p.id}">${p.vendido ? 'Marcar disponible' : 'Marcar vendido'}</button>
          </div>
        </div>
        <div class="thumbs">${thumbs}</div>
        <div class="row wrap" style="margin-top:8px">
          <label class="btn ghost">📥 Añadir imágenes
            <input type="file" accept="image/*" multiple hidden data-addimg="${p.id}">
          </label>
          <button class="btn danger" data-delprod="${p.id}">Eliminar producto</button>
        </div>
      </article>`;
  }
  function renderProductosAdmin() {
    const grid = $('#gridProductosAdmin');
    if (!grid) return;
    grid.innerHTML = ST.productos.map(p => cardProdAdmin(p)).join('');
    grid.querySelectorAll('[data-addimg]').forEach(inp => inp.onchange = async (e) => {
      const imgs = await filesToDataURLCompressed(e.target.files, 1400, 0.82);
      addImgsProducto(inp.dataset.addimg, imgs);
      toast('Imágenes añadidas');
      e.target.value = '';
    });
    grid.querySelectorAll('[data-delimg]').forEach(btn => btn.onclick = () => { delImgProducto(btn.dataset.delimg, Number(btn.dataset.idx)); toast('Imagen eliminada'); });
    grid.querySelectorAll('[data-delprod]').forEach(btn => btn.onclick = () => { delProducto(btn.dataset.delprod); toast('Producto eliminado'); });
    grid.querySelectorAll('[data-view]').forEach(btn => btn.onclick = () => openLB(ST.productos.find(x => x.id === btn.dataset.view)?.imgs || [], 0));
    grid.querySelectorAll('[data-togglevend]').forEach(btn => btn.onclick = () => { toggleVendido(btn.dataset.togglevend); toast('Estado de venta actualizado'); });
  }
  function toggleVendido(id) {
    const p = ST.productos.find(x => x.id === id);
    if (!p) return;
    p.vendido = !p.vendido;
    LS.set('productos', ST.productos);
    renderProductosCliente();
    renderProductosAdmin();
  }
  function openFormProducto() {
    openModal('Nuevo producto', `
      <form id="fProd" class="form">
        <div class="row wrap">
          <label class="muted" style="min-width:120px">Nombre</label>
          <input class="input" id="pNombre" placeholder="Nombre" required>
        </div>
        <div class="row wrap">
          <label class="muted" style="min-width:120px">Precio</label>
          <input class="input" id="pPrecio" type="number" min="0" step="0.01" placeholder="Precio" required>
        </div>
        <div class="row wrap" style="align-items:center; gap:8px">
          <label class="btn ghost">📷 Imágenes
            <input id="pImgs" type="file" accept="image/*" multiple hidden>
          </label>
          <span id="pCount" class="muted">0 seleccionadas</span>
        </div>
        <div id="pPrev" class="thumbs" style="margin-top:8px"></div>
        <div class="row" style="margin-top:10px"><button class="btn primary" type="submit">Guardar</button></div>
      </form>
    `);
    const inp = $('#pImgs'), cnt = $('#pCount'), prev = $('#pPrev');
    inp.onchange = async (e) => {
      const files = e.target.files || [];
      cnt.textContent = `${files.length} seleccionadas`;
      prev.innerHTML = '';
      if (!files.length) return;
      const datas = await filesToDataURL(files);
      datas.forEach((src, ix) => {
        const d = document.createElement('div');
        d.className = 'thumb';
        d.innerHTML = `<img loading="lazy" src="${src}" alt="img ${ix + 1}">`;
        prev.appendChild(d);
      });
    };
    $('#fProd').onsubmit = async (e) => {
      e.preventDefault();
      const nombre = $('#pNombre').value.trim();
      const precio = Number($('#pPrecio').value || 0);
      const imgs = await filesToDataURLCompressed($('#pImgs').files, 1400, 0.82);
      ST.productos.push({ id: u(), nombre, precio, imgs, vendido: false });
      LS.set('productos', ST.productos);
      closeModal();
      renderProductosCliente();
      renderProductosAdmin();
      toast('Producto creado con imágenes');
    };
  }
  function addImgsProducto(id, imgs) {
    const p = ST.productos.find(x => x.id === id);
    if (!p) return;
    p.imgs = [...(p.imgs || []), ...imgs];
    LS.set('productos', ST.productos);
    renderProductosCliente();
    renderProductosAdmin();
  }
  function delImgProducto(id, idx) {
    const p = ST.productos.find(x => x.id === id);
    if (!p) return;
    p.imgs.splice(idx, 1);
    LS.set('productos', ST.productos);
    renderProductosCliente();
    renderProductosAdmin();
  }
  function delProducto(id) {
    if (!confirm('¿Eliminar producto completo?')) return;
    ST.productos = ST.productos.filter(x => x.id !== id);
    LS.set('productos', ST.productos);
    renderProductosCliente();
    renderProductosAdmin();
  }

  /* ===== Proyectos ===== */
  function initProyectos() {
    if (!ST.proyectos.length) {
      ST.proyectos = [{ id: u(), titulo: 'Deck 19×22', desc: 'Composite', imgs: ['proyect1/1.jpg'] }];
      LS.set('proyectos', ST.proyectos);
    }
    renderProyectosCliente();
    renderProyectosAdmin();
    $('#addProyecto')?.addEventListener('click', openFormProyecto);
    $('#importProyectos')?.addEventListener('change', async (e) => {
      const files = e.target.files || [];
      if (!files.length) return;
      const imgs = await filesToDataURLCompressed(files, 1400, 0.82);
      ST.proyectos.push({ id: u(), titulo: 'Proyecto', desc: '', imgs });
      LS.set('proyectos', ST.proyectos);
      renderProyectosCliente();
      renderProyectosAdmin();
      toast(`Se añadieron ${imgs.length} imagen(es)`);
      e.target.value = '';
    });
  }
  function cardProyectoCliente(p) {
    const img = p.imgs?.[0] || 'proyect1/1.jpg';
    const count = (p.imgs?.length || 0);
    return `
      <article class="item">
        <div class="img">
          <img loading="lazy" src="${img}" alt="${esc(p.titulo)}">
          ${count ? `<div class="badge-count">${count} foto${count > 1 ? 's' : ''}</div>` : ''}
        </div>
        <div class="body">
          <h3 class="title">${esc(p.titulo)}</h3>
          <p class="muted">${esc(p.desc || '')}</p>
          <div class="row"><button class="btn ghost" data-view="${p.id}">Ver</button></div>
        </div>
      </article>`;
  }
  function renderProyectosCliente(q = '', cat = '') {
    const g = $('#gridProyectos'); if (!g) return;
    let list = ST.proyectos.slice();
    if (q) list = list.filter(p => (p.titulo + ' ' + (p.desc || '')).toLowerCase().includes(q));
    g.innerHTML = list.map(p => cardProyectoCliente(p)).join('');
    g.querySelectorAll('[data-view]').forEach(b => b.onclick = () => {
      const list = ST.proyectos.find(x => x.id === b.dataset.view)?.imgs || [];
      openLB(list, 0);
    });
  }
  function cardProyectoAdmin(p) {
    const thumbs = (p.imgs || []).map((src, ix) => `
      <div class="thumb"><img loading="lazy" src="${src}" alt="${esc(p.titulo)} img ${ix + 1}">
        <button class="chip danger" data-delimgp="${p.id}" data-idx="${ix}">Eliminar</button>
      </div>`).join('') || `<div class="muted">Sin imágenes aún</div>`;
    return `
      <article class="card">
        <div class="row wrap" style="justify-content:space-between;align-items:center">
          <strong>${esc(p.titulo)}</strong>
          <button class="chip" data-viewp="${p.id}">Ver galería</button>
        </div>
        <div class="thumbs">${thumbs}</div>
        <div class="row wrap" style="margin-top:8px;align-items:center;gap:8px">
          <label class="btn ghost">📥 Añadir imágenes
            <input type="file" accept="image/*" multiple hidden data-addimgp="${p.id}">
          </label>
          <span class="muted">${(p.imgs?.length || 0)} foto(s)</span>
          <button class="btn danger" data-delproj="${p.id}">Eliminar proyecto</button>
        </div>
      </article>`;
  }
  function renderProyectosAdmin() {
    const grid = $('#gridProyectosAdmin'); if (!grid) return;
    grid.innerHTML = ST.proyectos.map(p => cardProyectoAdmin(p)).join('');
    grid.querySelectorAll('[data-addimgp]').forEach(inp => {
      const pid = inp.dataset.addimgp;
      inp.onchange = async (e) => {
        const imgs = await filesToDataURLCompressed(e.target.files, 1400, 0.82);
        addImgsProyecto(pid, imgs);
        toast(`Se añadieron ${imgs.length} imagen(es)`);
        e.target.value = '';
      };
    });
    grid.querySelectorAll('[data-delimgp]').forEach(btn => btn.onclick = () => { delImgProyecto(btn.dataset.delimgp, Number(btn.dataset.idx)); toast('Imagen eliminada'); });
    grid.querySelectorAll('[data-delproj]').forEach(btn => btn.onclick = () => { delProyecto(btn.dataset.delproj); toast('Proyecto eliminado'); });
    grid.querySelectorAll('[data-viewp]').forEach(btn => btn.onclick = () => openLB(ST.proyectos.find(x => x.id === btn.dataset.viewp)?.imgs || [], 0));
  }
  function openFormProyecto() {
    openModal('Nuevo proyecto', `
      <form id="fProj" class="form">
        <div class="row wrap">
          <label class="muted" style="min-width:120px">Título</label>
          <input class="input" id="jTitulo" placeholder="Título" required>
        </div>
        <div class="row wrap">
          <label class="muted" style="min-width:120px">Descripción</label>
          <input class="input" id="jDesc" placeholder="Descripción">
        </div>
        <div class="row wrap" style="align-items:center; gap:8px">
          <label class="btn ghost">📷 Imágenes
            <input id="jImgs" type="file" accept="image/*" multiple hidden>
          </label>
          <span id="jCount" class="muted">0 seleccionadas</span>
        </div>
        <div id="jPrev" class="thumbs" style="margin-top:8px"></div>
        <div class="row" style="margin-top:10px"><button class="btn primary" type="submit">Guardar</button></div>
      </form>
    `);
    const inp = $('#jImgs'), cnt = $('#jCount'), prev = $('#jPrev');
    inp.onchange = async (e) => {
      const files = e.target.files || [];
      cnt.textContent = `${files.length} seleccionadas`;
      prev.innerHTML = '';
      if (!files.length) return;
      const datas = await filesToDataURL(files);
      datas.forEach((src, ix) => {
        const d = document.createElement('div');
        d.className = 'thumb';
        d.innerHTML = `<img loading="lazy" src="${src}" alt="img ${ix + 1}">`;
        prev.appendChild(d);
      });
    };
    $('#fProj').onsubmit = async (e) => {
      e.preventDefault();
      const titulo = $('#jTitulo').value.trim();
      const desc = $('#jDesc').value.trim();
      const imgs = await filesToDataURLCompressed($('#jImgs').files, 1400, 0.82);
      ST.proyectos.push({ id: u(), titulo, desc, imgs });
      LS.set('proyectos', ST.proyectos);
      closeModal();
      renderProyectosCliente();
      renderProyectosAdmin();
      toast('Proyecto creado con imágenes');
    };
  }
  function addImgsProyecto(id, imgs) {
    const p = ST.proyectos.find(x => x.id === id);
    if (!p) return;
    p.imgs = [...(p.imgs || []), ...imgs];
    LS.set('proyectos', ST.proyectos);
    renderProyectosCliente();
    renderProyectosAdmin();
  }
  function delImgProyecto(id, idx) {
    const p = ST.proyectos.find(x => x.id === id);
    if (!p) return;
    p.imgs.splice(idx, 1);
    LS.set('proyectos', ST.proyectos);
    renderProyectosCliente();
    renderProyectosAdmin();
  }
  function delProyecto(id) {
    if (!confirm('¿Eliminar proyecto completo?')) return;
    ST.proyectos = ST.proyectos.filter(x => x.id !== id);
    LS.set('proyectos', ST.proyectos);
    renderProyectosCliente();
    renderProyectosAdmin();
  }

  /* ===== Carrito / Ventas ===== */
  function initCarrito() {
    renderClientesSel();
    renderCarrito();
    $('#btnAddCliente')?.addEventListener('click', () => openFormCliente(true));
    $('#metodoPago')?.addEventListener('change', onMetodoPagoChange);
    $('#btnPagar')?.addEventListener('click', pagar);
  }
  function onMetodoPagoChange() {
    const v = $('#metodoPago').value;
    $('#montoEfectivo')?.classList.toggle('hidden', v !== 'efectivo');
    $('#qrBox')?.classList.toggle('hidden', v !== 'zelle');

    // PayPal
    const paypalBox = $('#paypalBox');
    paypalBox?.classList.toggle('hidden', v !== 'paypal');
    if (v === 'paypal') renderPayPalButtons();
  }
  function renderClientesSel() {
    if (!ST.clientes.length) {
      ST.clientes = [{ id: 'general', nombre: 'Cliente General', email: '', empresa: '', telefono: '', direccion: '', compras: 0, total: 0, ultima: '', createdAt: '' }];
      LS.set('clientes', ST.clientes);
    }
    const sel = $('#clienteSel'); if (!sel) return;
    sel.innerHTML = `<option value="general">— Regístrate para comprar —</option>` +
      ST.clientes.filter(c => c.id !== 'general').map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
  }
  function openFormCliente(required = false) {
    openModal(required ? 'Registro de cliente (requerido)' : 'Nuevo cliente', `
      <form id="fCli" class="form">
        <div class="row wrap">
          <label class="muted" style="min-width:120px">Nombre *</label>
          <input class="input" id="cNombre" placeholder="Nombre *" required>
        </div>
        <div class="row wrap">
          <label class="muted" style="min-width:120px">Teléfono *</label>
          <input class="input" id="cTel" placeholder="+1 513..." required pattern="^[0-9+\\-()\\s]{7,}$" title="Teléfono válido">
        </div>
        <div class="row wrap">
          <label class="muted" style="min-width:120px">Dirección</label>
          <input class="input" id="cDir" placeholder="Calle, ciudad (para entregas/instalación)">
        </div>
        <div class="row wrap">
          <label class="muted" style="min-width:120px">Empresa</label>
          <input class="input" id="cEmpresa" placeholder="Empresa (opcional)">
        </div>
        <div class="row wrap">
          <label class="muted" style="min-width:120px">Correo</label>
          <input class="input" id="cEmail" type="email" placeholder="Correo (opcional)">
        </div>
        <div class="row" style="margin-top:10px"><button class="btn primary" type="submit">Guardar</button></div>
      </form>
    `);
    $('#fCli').onsubmit = (e) => {
      e.preventDefault();
      const c = {
        id: u(),
        nombre: $('#cNombre').value.trim(),
        telefono: $('#cTel').value.trim(),
        direccion: $('#cDir').value.trim(),
        empresa: $('#cEmpresa').value.trim(),
        email: $('#cEmail').value.trim(),
        compras: 0, total: 0, ultima: '', createdAt: new Date().toLocaleString()
      };
      if (!c.nombre || !c.telefono) return alert('Nombre y teléfono son obligatorios');
      ST.clientes.push(c); LS.set('clientes', ST.clientes);
      renderClientesSel(); $('#clienteSel').value = c.id;
      pintarClientes(); pintarClientesDir();
      closeModal(); toast('Cliente registrado');
    };
  }

  function addCart(id) {
    const p = ST.productos.find(x => x.id === id);
    if (!p) return;
    if (p.vendido) { alert('Este producto ya fue vendido'); return; }
    const it = ST.carrito.find(i => i.id === id);
    const img = p.imgs?.[0] || 'venta/1.jpg';
    if (it) it.cant += 1; else ST.carrito.push({ id: p.id, nombre: p.nombre, precio: p.precio, cant: 1, img });
    LS.set('carrito', ST.carrito);
    renderCarrito();
  }
  function renderCarrito() {
    const ul = $('#listaCarrito'); if (!ul) return;
    ul.innerHTML = ST.carrito.map((i, k) => `
      <li>
        <div class="left">
          <img class="thumb-cart" src="${i.img || 'venta/1.jpg'}" alt="Imagen de ${esc(i.nombre)}">
          <div>${esc(i.nombre)} <span class="muted">x${i.cant}</span></div>
        </div>
        <div class="row">
          <button class="chip" data-less="${k}">−</button>
          <button class="chip" data-plus="${k}">＋</button>
          <button class="chip" data-del="${k}">✕</button>
        </div>
      </li>`).join('');
    ul.querySelectorAll('[data-less]').forEach(b => b.onclick = () => qty(b.dataset.less, -1));
    ul.querySelectorAll('[data-plus]').forEach(b => b.onclick = () => qty(b.dataset.plus, 1));
    ul.querySelectorAll('[data-del]').forEach(b => b.onclick = () => delCart(b.dataset.del));
    updateTotals();
  }
  function qty(ix, d) {
    ix = Number(ix);
    ST.carrito[ix].cant += d;
    if (ST.carrito[ix].cant <= 0) ST.carrito.splice(ix, 1);
    LS.set('carrito', ST.carrito);
    renderCarrito();
  }
  function delCart(ix) {
    ST.carrito.splice(Number(ix), 1);
    LS.set('carrito', ST.carrito);
    renderCarrito();
  }
  function updateTotals() {
    const sub = ST.carrito.reduce((s, i) => s + i.precio * i.cant, 0);
    const imp = sub * (ST.tax / 100);
    const tot = sub + imp;
    $('#subTxt')?.textContent = cur(sub);
    $('#taxRateTxt')?.textContent = cur(ST.tax);
    $('#taxTxt')?.textContent = cur(imp);
    $('#totTxt')?.textContent = cur(tot);
  }

  // ===== PayPal =====
  function renderPayPalButtons() {
    if (typeof paypal === 'undefined') {
      toast('Cargando PayPal…');
      setTimeout(renderPayPalButtons, 600);
      return;
    }
    const box = $('#paypalButtons');
    if (!box) return;
    box.innerHTML = ''; // limpiar si renderiza de nuevo

    const total = Number($('#totTxt').textContent || '0');
    if (total <= 0) {
      box.innerHTML = `<div class="muted">Agrega productos al carrito para habilitar PayPal.</div>`;
      return;
    }

    paypal.Buttons({
      createOrder: (data, actions) => {
        return actions.order.create({
          purchase_units: [{ amount: { value: total.toFixed(2) } }]
        });
      },
      onApprove: async (data, actions) => {
        try {
          const details = await actions.order.capture();
          ST.paypalTxn = details?.id || 'PAYPAL';
          pagar(true); // finalizar venta con bandera de que ya se pagó por PayPal
        } catch (e) {
          console.error(e);
          alert('No se pudo capturar el pago de PayPal.');
        }
      },
      onError: (err) => {
        console.error(err);
        alert('Error en PayPal.');
      }
    }).render('#paypalButtons');
  }

  async function pagar(alreadyPaidByPayPal = false) {
    if (!ST.carrito.length) return alert('Carrito vacío');
    const cliId = $('#clienteSel').value;
    const cli = ST.clientes.find(c => c.id === cliId);
    if (!cli || cli.id === 'general' || !cli.telefono) {
      alert('Para comprar debes registrarte con Nombre y Teléfono.');
      return openFormCliente(true);
    }
    const metodo = $('#metodoPago').value;
    if (!metodo) return alert('Selecciona método');

    const sub = Number($('#subTxt').textContent);
    const imp = Number($('#taxTxt').textContent);
    const tot = Number($('#totTxt').textContent);

    let zelleId = null;

    if (metodo === 'paypal') {
      if (!alreadyPaidByPayPal) {
        renderPayPalButtons();
        $('#paypalBox')?.classList.remove('hidden');
        toast('Completa el pago en los botones de PayPal ↘');
        return;
      }
    } else if (metodo === 'zelle') {
      zelleId = prompt('Ingresa el ID/Referencia de Zelle');
      if (!zelleId) return alert('Pago cancelado');
    } else if (metodo === 'efectivo') {
      const ent = Number($('#montoEfectivo').value || 0);
      if (ent < tot) return alert('Efectivo insuficiente');
    }

    // Registrar venta
    const venta = {
      id: 'V' + String(ST.folio).padStart(5, '0'),
      fecha: new Date().toLocaleString(),
      cliente: cli.nombre,
      direccion: cli.direccion || '',
      items: ST.carrito.map(i => ({ n: i.nombre, c: i.cant, p: i.precio, id: i.id })),
      subtotal: sub,
      impuesto: imp,
      total: tot,
      metodo,
      zelle: zelleId ? { id: zelleId, proof: null } : null,
      paypal: metodo === 'paypal' ? { id: ST.paypalTxn || 'PAYPAL' } : null
    };

    ST.ventas.unshift(venta);
    ST.folio++; LS.set('folio', ST.folio);
    LS.set('ventas', ST.ventas);

    cli.compras = (cli.compras || 0) + 1;
    cli.total = Number(cli.total || 0) + tot;
    cli.ultima = venta.fecha;
    LS.set('clientes', ST.clientes);

    venta.items.forEach(it => {
      const p = ST.productos.find(x => x.id === it.id);
      if (p) p.vendido = true;
    });
    LS.set('productos', ST.productos);

    ST.carrito = []; LS.set('carrito', ST.carrito);

    renderCarrito();
    pintarRecibo(venta);
    pintarVentas(); pintarClientes();
    renderProductosCliente(); renderProductosAdmin();

    $('#paypalBox')?.classList.add('hidden');
    ST.paypalTxn = null;

    toast('Compra registrada');
  }

  function pintarRecibo(v) {
    const box = $('#reciboBox'); if (!box) return;
    box.classList.remove('hidden');
    box.innerHTML = `
      <h3>Recibo #${v.id}</h3>
      <p class="muted">${v.fecha} · <em>haz clic para imprimir</em></p>
      <div id="receiptArea" class="table-wrap" style="cursor:pointer">
        <table>
          <thead><tr><th>Producto</th><th>Cant</th><th>Precio</th><th>Importe</th></tr></thead>
          <tbody>
            ${v.items.map(it => `
              <tr>
                <td>${esc(it.n)}</td>
                <td>${it.c}</td>
                <td>$${cur(it.p)}</td>
                <td>$${cur(it.p * it.c)}</td>
              </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr><td colspan="3" style="text-align:right">Subtotal</td><td>$${cur(v.subtotal)}</td></tr>
            <tr><td colspan="3" style="text-align:right">Impuesto</td><td>$${cur(v.impuesto)}</td></tr>
            <tr><td colspan="3" style="text-align:right"><strong>Total</strong></td><td><strong>$${cur(v.total)}</strong></td></tr>
            <tr><td colspan="3" style="text-align:right">Método</td><td>
              ${v.metodo}${v.zelle && v.zelle.id ? ' · ID: ' + esc(v.zelle.id) : ''}${v.paypal?.id ? ' · PAYPAL: ' + esc(v.paypal.id) : ''}
            </td></tr>
          </tfoot>
        </table>
      </div>`;
    $('#receiptArea')?.addEventListener('click', () => printRecibo(v));
  }

  function printRecibo(v) {
    const w = window.open('', '_blank');
    if (!w) { alert('Habilita ventanas emergentes para imprimir.'); return; }
    const html = `
      <html><head><title>Recibo ${v.id}</title>
      <style>
        body{font-family:Arial, sans-serif; padding:16px}
        table{width:100%; border-collapse:collapse}
        th,td{border:1px solid #ccc; padding:8px; font-size:12px}
        thead th{background:#eee}
        tfoot td{font-weight:bold}
      </style>
      </head>
      <body>
      <h2>Recibo #${v.id}</h2>
      <p>${v.fecha} · ${esc(v.cliente)}</p>
      <table>
        <thead><tr><th>Producto</th><th>Cant</th><th>Precio</th><th>Importe</th></tr></thead>
        <tbody>
          ${v.items.map(it => `<tr><td>${esc(it.n)}</td><td>${it.c}</td><td>$${cur(it.p)}</td><td>$${cur(it.p * it.c)}</td></tr>`).join('')}
        </tbody>
        <tfoot>
          <tr><td colspan="3" style="text-align:right">Subtotal</td><td>$${cur(v.subtotal)}</td></tr>
          <tr><td colspan="3" style="text-align:right">Impuesto</td><td>$${cur(v.impuesto)}</td></tr>
          <tr><td colspan="3" style="text-align:right">Total</td><td>$${cur(v.total)}</td></tr>
          <tr><td colspan="3" style="text-align:right">Método</td><td>
            ${v.metodo}${v.zelle && v.zelle.id ? ' · ID: ' + esc(v.zelle.id) : ''}${v.paypal?.id ? ' · PAYPAL: ' + esc(v.paypal.id) : ''}
          </td></tr>
        </tfoot>
      </table>
      <script>setTimeout(()=>window.print(), 150);<\/script>
      </body></html>`;
    w.document.open(); w.document.write(html); w.document.close();
  }

  /* ===== Presupuesto (ADMIN) ===== */
  function initPresupuestoAdmin() {
    const tBody = $('#presTable tbody'); if (!tBody) return;
    $('#rowAdd')?.addEventListener('click', () => rowAdd(tBody, '#presTotal'));
    $('#presCSV')?.addEventListener('click', () => presCSV('#presTable', '#presTotal'));
    $('#presPDF')?.addEventListener('click', () => presPDF('#presCliente', '#presProyecto', '#presTable', '#presTotal', true, $('#presFormat')?.value || 'a4'));
    if (!tBody.children.length) rowAdd(tBody, '#presTotal');
  }
  function rowAdd(tBody, totalSel) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="input" placeholder="Material"></td>
      <td><input class="input" type="number" min="0" step="1" value="1"></td>
      <td><input class="input" type="number" min="0" step="0.01" value="0.00"></td>
      <td class="sub">$0.00</td>
      <td><button class="chip danger">✕</button></td>`;
    tBody.appendChild(tr);
    const [m, c, p] = $$('input', tr);
    [c, p].forEach(i => i.addEventListener('input', () => calcPres(tBody, totalSel)));
    tr.querySelector('button').onclick = () => { tr.remove(); calcPres(tBody, totalSel); };
    calcPres(tBody, totalSel);
  }
  function calcPres(tBody, totalSel) {
    let total = 0;
    [...tBody.children].forEach(tr => {
      const [m, c, p] = $$('input', tr);
      const sub = (Number(c.value) || 0) * (Number(p.value) || 0);
      tr.querySelector('.sub').textContent = '$' + cur(sub);
      total += sub;
    });
    $(totalSel).textContent = '$' + cur(total);
  }
  function buildRows(tableSel) {
    return $$(tableSel + ' tbody tr').map(tr => {
      const [m, c, p] = $$('input', tr);
      const sub = (Number(c.value) || 0) * (Number(p.value) || 0);
      return [m.value, c.value, '$' + cur(p.value), '$' + cur(sub)];
    });
  }
  function presCSV(tableSel, totalSel) {
    const rows = buildRows(tableSel);
    const total = rows.reduce((a, r) => a + Number(String(r[3]).replace(/[^0-9.]/g, '')), 0);
    const csv = [['Material', 'Cantidad', 'Precio', 'Subtotal'], ...rows, ['', '', 'Total', cur(total)]]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    download('presupuesto.csv', csv, 'text/csv');
  }
  async function ensurePDFLibs() {
    const ok = (window.jspdf && window.jspdf.jsPDF);
    const ok2 = (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable);
    if (!ok || !ok2) throw new Error('jsPDF/autoTable no disponibles aún');
    try {
      const { jsPDF } = window.jspdf;
      const test = new jsPDF(); test.text('', 10, 10);
    } catch { throw new Error('jsPDF no está disponible'); }
  }
  async function presPDF(cliSel, proySel, tableSel, totalSel, saveAdmin, paper = 'a4') {
    try {
      await ensurePDFLibs();
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ format: paper, orientation: 'p', unit: 'mm' });
      const W = doc.internal.pageSize.getWidth();

      // Header
      doc.setFillColor(15, 20, 32); doc.rect(0, 0, W, 18, 'F');
      doc.setFillColor(59, 100, 255); doc.rect(0, 18, W, 2, 'F');
      try {
        const logo = await imgToDataURL('logoklem.png');
        if (logo) doc.addImage(logo, 'PNG', 10, 6, 10, 10);
      } catch { }
      doc.setTextColor(255, 255, 255); doc.setFontSize(12); doc.text('Stradivaryus Tools', 24, 13);
      doc.setTextColor(180); doc.setFontSize(9); doc.text('Orden / Presupuesto', 24, 17);

      // Datos
      doc.setTextColor(20); doc.setFontSize(10);
      const cliente = $(cliSel).value.trim();
      const proyecto = $(proySel).value.trim();
      doc.text(`Cliente: ${cliente || '-'}`, 12, 30);
      doc.text(`Proyecto: ${proyecto || '-'}`, 120, 30);

      // Tabla
      const rows = buildRows(tableSel);
      doc.autoTable({
        head: [['Material', 'Cant', 'Precio', 'Subtotal']], body: rows, startY: 36,
        styles: { fontSize: 9, halign: 'left' },
        headStyles: { fillColor: [59, 100, 255], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 255] },
        theme: 'grid',
        columnStyles: { 1: { halign: 'center', cellWidth: 18 }, 2: { halign: 'right', cellWidth: 24 }, 3: { halign: 'right', cellWidth: 28 } }
      });
      const total = Number($(totalSel).textContent.replace(/[^0-9.]/g, ''));
      let y = doc.lastAutoTable.finalY + 6;
      doc.setDrawColor(59, 100, 255); doc.setLineWidth(0.3);
      doc.roundedRect(W - 70, y - 4, 60, 16, 2, 2);
      doc.setFontSize(10); doc.text('Total', W - 64, y + 2);
      doc.setFontSize(12); doc.setTextColor(0);
      doc.text(`$${cur(total)}`, W - 30, y + 2, { align: 'right' });

      if (saveAdmin) {
        ST.presupuestos.unshift({ fecha: new Date().toLocaleString(), cliente, proyecto, monto: total, rows });
        LS.set('presupuestos', ST.presupuestos);
        pintarPres();
      }

      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      openPrintPDF(url);
    } catch (err) {
      console.error(err);
      alert('Se guardó el archivo localmente. Si no ves la vista de impresión, habilita ventanas emergentes.');
    }
  }
  async function imgToDataURL(src) {
    try {
      const resp = await fetch(src, { mode: 'cors' });
      const blob = await resp.blob();
      return await new Promise(res => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.readAsDataURL(blob);
      });
    } catch { return null; }
  }
  function openPrintPDF(url) {
    const w = window.open('', '_blank');
    if (!w) {
      alert('El PDF se generó y guardó. Para imprimir, habilita ventanas emergentes o abre el archivo desde Descargas.');
      return;
    }
    const html = `
      <html><head><title>Imprimir Presupuesto</title></head>
      <body style="margin:0">
        <iframe src="${url}" style="border:0;width:100vw;height:100vh" onload="setTimeout(()=>this.contentWindow.print(), 200)"></iframe>
      </body></html>`;
    w.document.open(); w.document.write(html); w.document.close();
  }
  function pintarVentas() {
    const tb = $('#tbVentas'); if (!tb) return;
    tb.innerHTML = ST.ventas.map((v, ix) => `
      <tr>
        <td>${v.fecha}</td>
        <td>${v.id}</td>
        <td>${esc(v.cliente)}</td>
        <td>${v.items.map(i => esc(i.n) + ' x' + i.c).join(', ')}</td>
        <td>$${cur(v.subtotal)}</td>
        <td>$${cur(v.impuesto)}</td>
        <td>$${cur(v.total)}</td>
        <td>${v.metodo}${v.zelle && v.zelle.id ? ' · ' + esc(v.zelle.id) : ''}${v.paypal?.id ? ' · ' + esc(v.paypal.id) : ''}</td>
        <td><button class="chip" data-print="${ix}">🖨️</button></td>
        <td><button class="chip danger" data-delv="${ix}">✕</button></td>
      </tr>`).join('');
    tb.querySelectorAll('[data-delv]').forEach(b => b.onclick = () => {
      ST.ventas.splice(Number(b.dataset.delv), 1);
      LS.set('ventas', ST.ventas);
      pintarVentas();
    });
    tb.querySelectorAll('[data-print]').forEach(b => b.onclick = () => {
      const v = ST.ventas[Number(b.dataset.print)];
      if (v) printRecibo(v);
    });
  }
  function pintarClientes() {
    const tb = $('#tbClientes'); if (!tb) return;
    tb.innerHTML = ST.clientes.filter(c => c.id !== 'general').map((c, ix) => `
      <tr>
        <td>${esc(c.nombre)}</td><td>${c.compras || 0}</td><td>$${cur(c.total || 0)}</td><td>${c.ultima || ''}</td>
        <td><button class="chip danger" data-delc="${ix}">✕</button></td>
      </tr>`).join('');
    tb.querySelectorAll('[data-delc]').forEach(b => b.onclick = () => {
      ST.clientes.splice(Number(b.dataset.delc) + 1, 1);
      LS.set('clientes', ST.clientes);
      pintarClientes(); pintarClientesDir(); renderClientesSel();
    });
  }
  function pintarClientesDir() {
    const tb = $('#tbClientesDir'); if (!tb) return;
    tb.innerHTML = ST.clientes.filter(c => c.id !== 'general').map((c, ix) => `
      <tr>
        <td>${esc(c.nombre)}</td>
        <td>${esc(c.telefono || '')}</td>
        <td>${esc(c.empresa || '')}</td>
        <td>${esc(c.email || '')}</td>
        <td>${esc(c.createdAt || '')}</td>
        <td><button class="chip danger" data-delcd="${ix}">✕</button></td>
      </tr>`).join('');
    tb.querySelectorAll('[data-delcd]').forEach(b => b.onclick = () => {
      ST.clientes.splice(Number(b.dataset.delcd) + 1, 1);
      LS.set('clientes', ST.clientes);
      pintarClientesDir(); pintarClientes(); renderClientesSel();
    });
  }
  function pintarPres() {
    const tb = $('#tbPres'); if (!tb) return;
    tb.innerHTML = ST.presupuestos.map((p, ix) => `
      <tr>
        <td>${p.fecha}</td><td>${esc(p.cliente || '-')}</td><td>${esc(p.proyecto || '-')}</td><td>$${cur(p.monto || 0)}</td>
        <td><button class="chip" data-printp="${ix}">🖨️</button></td>
        <td><button class="chip danger" data-delp="${ix}">✕</button></td>
      </tr>`).join('');
    tb.querySelectorAll('[data-delp]').forEach(b => b.onclick = () => {
      ST.presupuestos.splice(Number(b.dataset.delp), 1);
      LS.set('presupuestos', ST.presupuestos);
      pintarPres();
    });
    tb.querySelectorAll('[data-printp]').forEach(b => b.onclick = () => presReprint(Number(b.dataset.printp)));
  }
  async function presReprint(ix) {
    const p = ST.presupuestos[ix];
    if (!p) return;
    if (!p.rows || !p.rows.length) {
      alert('Este presupuesto no tiene detalle guardado. Crea uno nuevo para habilitar reimpresión.');
      return;
    }
    try {
      await ensurePDFLibs();
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ format: 'a4', orientation: 'p', unit: 'mm' });
      const W = doc.internal.pageSize.getWidth();
      doc.setFillColor(15, 20, 32); doc.rect(0, 0, W, 18, 'F');
      doc.setFillColor(59, 100, 255); doc.rect(0, 18, W, 2, 'F');
      try {
        const logo = await imgToDataURL('logoklem.png');
        if (logo) doc.addImage(logo, 'PNG', 10, 6, 10, 10);
      } catch { }
      doc.setTextColor(255, 255, 255); doc.setFontSize(12); doc.text('Stradivaryus Tools', 24, 13);
      doc.setTextColor(180); doc.setFontSize(9); doc.text('Orden / Presupuesto (reimpresión)', 24, 17);
      doc.setTextColor(20); doc.setFontSize(10);
      doc.text(`Cliente: ${p.cliente || '-'}`, 12, 30);
      doc.text(`Proyecto: ${p.proyecto || '-'}`, 120, 30);
      doc.text(`Fecha original: ${p.fecha || '-'}`, 12, 36);
      doc.autoTable({
        head: [['Material', 'Cant', 'Precio', 'Subtotal']], body: p.rows, startY: 42,
        styles: { fontSize: 9, halign: 'left' },
        headStyles: { fillColor: [59, 100, 255], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 255] },
        theme: 'grid',
        columnStyles: { 1: { halign: 'center', cellWidth: 18 }, 2: { halign: 'right', cellWidth: 24 }, 3: { halign: 'right', cellWidth: 28 } }
      });
      let y = doc.lastAutoTable.finalY + 6;
      doc.setDrawColor(59, 100, 255); doc.setLineWidth(0.3);
      doc.roundedRect(W - 70, y - 4, 60, 16, 2, 2);
      doc.setFontSize(10); doc.text('Total', W - 64, y + 2);
      doc.setFontSize(12); doc.setTextColor(0);
      doc.text(`$${cur(p.monto || 0)}`, W - 30, y + 2, { align: 'right' });
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      openPrintPDF(url);
    } catch (e) {
      console.error(e);
      alert('Se guardó el archivo. Si no se abrió la impresión, habilita ventanas emergentes y vuelve a intentarlo.');
    }
  }

  /* ===== Lightbox ===== */
  function lightboxInit() {
    $('#lbClose')?.addEventListener('click', closeLB);
    $('#lbPrev')?.addEventListener('click', () => navLB(-1));
    $('#lbNext')?.addEventListener('click', () => navLB(1));
    $('#zIn')?.addEventListener('click', () => zoom(0.15));
    $('#zOut')?.addEventListener('click', () => zoom(-0.15));
    $('#zReset')?.addEventListener('click', () => { ST.lb.zoom = 1; applyZoom(); });
    $('#openNew')?.addEventListener('click', () => {
      const s = $('#lbImg')?.src; if (s) open(s, '_blank');
    });
    document.addEventListener('keydown', e => {
      if ($('#lightbox')?.classList.contains('hidden')) return;
      if (e.key === 'Escape') closeLB();
      if (e.key === 'ArrowLeft') navLB(-1);
      if (e.key === 'ArrowRight') navLB(1);
    });
  }
  function openLB(list, start) {
    ST.lb.list = list || [];
    ST.lb.idx = start || 0;
    ST.lb.zoom = 1;
    const img = $('#lbImg');
    if (img) img.src = ST.lb.list[start] || '';
    $('#lightbox')?.classList.remove('hidden');
    applyZoom();
  }
  function closeLB() { $('#lightbox')?.classList.add('hidden'); }
  function navLB(d) {
    if (!ST.lb.list.length) return;
    ST.lb.idx = (ST.lb.idx + d + ST.lb.list.length) % ST.lb.list.length;
    const img = $('#lbImg');
    if (img) img.src = ST.lb.list[ST.lb.idx];
    ST.lb.zoom = 1;
    applyZoom();
  }
  function zoom(d) { ST.lb.zoom = Math.max(.4, Math.min(3, ST.lb.zoom + d)); applyZoom(); }
  function applyZoom() {
    const img = $('#lbImg');
    if (img) { img.style.transform = `scale(${ST.lb.zoom})`; img.style.transformOrigin = 'center'; }
  }

  /* ===== Tema ===== */
  function themeInit() {
    const pref = localStorage.getItem("st_theme3") || 'auto';
    applyTheme(pref);
  }
  function applyTheme(mode) {
    if (mode === 'auto') document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", mode);
    localStorage.setItem("st_theme3", mode);
    updateThemeButton();
  }
  function setupThemeSwitch() {
    $('#btnTheme')?.addEventListener('click', () => {
      const cur = localStorage.getItem("st_theme3") || 'auto';
      const next = cur === 'auto' ? 'light' : cur === 'light' ? 'dark' : 'auto';
      applyTheme(next);
    });
    updateThemeButton();
  }
  function updateThemeButton() {
    const t = localStorage.getItem("st_theme3") || 'auto';
    const btn = $('#btnTheme');
    if (!btn) return;
    if (t === 'auto') { btn.textContent = '🖥️'; btn.title = 'Tema automático'; }
    else if (t === 'light') { btn.textContent = '🌙'; btn.title = 'Cambiar a oscuro'; }
    else { btn.textContent = '🌞'; btn.title = 'Cambiar a claro'; }
  }

  /* ===== Modal ===== */
  function openModal(title, html) {
    const m = $('#modal'); if (!m) return;
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = html;
    m.classList.remove('hidden');
    $('#modalClose').onclick = closeModal;
    m.addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); }, { once: true });
  }
  function closeModal() { $('#modal')?.classList.add('hidden'); }

  /* ===== Utils extra ===== */
  function shareFile() { return false; } // no-op en esta versión
})();
