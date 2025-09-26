(()=>{

  /* ===== Helpers DOM & Storage ===== */
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const LS={get:(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}, set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};
  const cur = n => (Number(n)||0).toFixed(2);

  /* ===== Seguridad (hash) ===== */
  async function hashString(str){
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    const arr = Array.from(new Uint8Array(buf));
    return arr.map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  /* ===== Imagen: compresión y thumbs ===== */
  async function filesToDataURLCompressed(fileList, maxDim=1600, quality=0.85){
    if(!fileList || !fileList.length) return [];
    const arr = Array.from(fileList);
    const read = f => new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(f); });
    const datas = await Promise.all(arr.map(read));
    const outs = [];
    for(const d of datas){ outs.push(await makeThumb(d, maxDim, quality)); }
    return outs;
  }
  async function makeThumb(dataURL, maxDim=400, quality=0.8){
    return new Promise((res)=>{
      const img=new Image();
      img.onload=()=>{
        const cnv=document.createElement('canvas');
        const scale=Math.min(1, maxDim/Math.max(img.naturalWidth, img.naturalHeight));
        cnv.width = Math.max(1, Math.round(img.naturalWidth*scale));
        cnv.height= Math.max(1, Math.round(img.naturalHeight*scale));
        const ctx=cnv.getContext('2d');
        ctx.drawImage(img,0,0,cnv.width,cnv.height);
        res(cnv.toDataURL('image/jpeg', quality));
      };
      img.onerror=()=>res(dataURL);
      img.src=dataURL;
    });
  }

  /* ===== Analytics mock ===== */
  function track(eventName, params={}){ (window.dataLayer=window.dataLayer||[]).push({event:eventName,...params}); }

  /* ===== Toast ===== */
  function toast(msg){
    let box = $('#toastBox');
    if(!box){
      box = document.createElement('div');
      box.id='toastBox';
      Object.assign(box.style,{position:'fixed',left:'50%',bottom:'24px',transform:'translateX(-50%)',zIndex:'9999'});
      document.body.appendChild(box);
    }
    const t=document.createElement('div');
    t.className='toast'; t.textContent=msg;
    Object.assign(t.style,{
      opacity:'0',transition:'opacity .25s ease, transform .25s ease',
      background:'var(--card,#101826)',color:'var(--text,#e8eef8)',
      padding:'10px 14px',borderRadius:'10px',boxShadow:'0 6px 20px rgba(0,0,0,.35)',
      marginTop:'8px',transform:'translateY(6px)'
    });
    box.appendChild(t);
    requestAnimationFrame(()=>{ t.style.opacity='1'; t.style.transform='translateY(0)'; });
    setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateY(6px)'; t.addEventListener('transitionend',()=>t.remove(),{once:true}); },2600);
  }

  /* ===== Estado ===== */
  const ST = {
    // adminPass queda por compatibilidad (migramos a adminHash en init)
    adminPass: LS.get('adminPass','klem'),
    authed: sessionStorage.getItem('st_admin_ok')==='1',
    tax: Number(LS.get('taxRate',5.75)),

    productos: LS.get('productos', []),
    proyectos: LS.get('proyectos', []),
    hero: LS.get('hero', []),

    clientes: LS.get('clientes', []),
    carrito: LS.get('carrito', []),

    ventas: LS.get('ventas', []),
    presupuestos: LS.get('presupuestos', []),

    folio: Number(LS.get('folio', 1)),
    lb:{list:[],idx:0,zoom:1},
    slideIdx: 0,
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init(){
    // --- Migración de contraseña en claro a hash (una vez) ---
    try {
      const passPlano = LS.get('adminPass', null);
      const hashGuardado = LS.get('adminHash', null);
      if(passPlano && !hashGuardado){
        const h = await hashString(passPlano);
        LS.set('adminHash', h);
        LS.set('adminPass', null);
      }
    } catch{}

    // Si no hay adminHash aún, define 2630 por defecto
    try{
      if(!LS.get('adminHash', null)){
        const h = await hashString('2630');
        LS.set('adminHash', h);
      }
    }catch{}

    // Restaurar sesión cliente verificado (5536)
    if(sessionStorage.getItem('st_client_ok')==='1'){
      document.documentElement.classList.add('client-on');
    }

    // Registrar SW (PWA)
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('./sw.js').catch(()=>{});
    }

    // === Sincronización remota ===
    remoteInit();
    await remoteLoadOnce();   // trae último estado público
    remoteSubscribe();        // escucha cambios en tiempo real

    // UI
    bgAnimate();
    setupTabbar();
    setupAdmin();

    initHero();
    initProductos();
    initCarrito();
    initProyectos();

    initPresupuestoAdmin();

    lightboxInit();

    themeInit();
    setupThemeSwitch();

    // LEGAL y CONTACTAR
    const d=$('#legalDate'); if(d) d.textContent=new Date().toLocaleDateString();
    const btnLegal=$('#btnLegal'); if(btnLegal){ btnLegal.onclick=()=>goView('legal'); }
    const btnContactar=$('#btnContactar'); if(btnContactar){ btnContactar.onclick=()=>goView('contacto'); }

    // FAB arrastrable
    setupDraggableFab();

    // Inyectar SEO/OG/JSON-LD
    injectSEO();
  }

  /* ===== Inyección SEO/OG + JSON-LD ===== */
  function injectSEO(){
    try{
      const head = document.head;
      const add = (tag, attrs) => { const el=document.createElement(tag); Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v)); head.appendChild(el); };
      if(!document.querySelector('meta[name="description"]')){
        add('meta',{name:'description',content:'Herramientas, proyectos y servicios en Cincinnati. Ventas, instalación y presupuestos al instante.'});
      }
      if(!document.querySelector('meta[property="og:title"]')){
        add('meta',{property:'og:title',content:'Stradivaryus Tools'});
        add('meta',{property:'og:description',content:'Catálogo de herramientas y proyectos. Presupuestos en PDF. Contacto rápido.'});
        add('meta',{property:'og:type',content:'website'});
      }
      const ld = {
        "@context": "https://schema.org",
        "@type": "HardwareStore",
        "name": "Stradivaryus Tools",
        "image": location.origin + location.pathname.replace(/[^/]*$/,'') + "logoklem.png",
        "telephone": "+1-513-379-0469",
        "email": "info@stradivaryus.com",
        "address": { "@type": "PostalAddress", "addressLocality": "Cincinnati", "addressRegion": "OH", "addressCountry": "US" },
        "openingHours": "Mo-Fr 09:00-17:00"
      };
      const s=document.createElement('script');
      s.type='application/ld+json';
      s.textContent=JSON.stringify(ld);
      head.appendChild(s);
    }catch{}
  }

  /* ===== Fondo Canvas decorativo ===== */
  function bgAnimate(){
    const c = $('#bg'); if(!c) return;
    const g = c.getContext('2d'); let t=0; resize();
    window.addEventListener('resize', resize);
    function resize(){ c.width=innerWidth; c.height=innerHeight; }
    (function draw(){ t+=0.004; g.clearRect(0,0,c.width,c.height);
      for(let i=0;i<60;i++){
        const x=(Math.sin(t+i)*.5+.5)*c.width;
        const y=(Math.cos(t*1.3+i*.7)*.5+.5)*c.height;
        const r=60+40*Math.sin(t+i*2);
        const grd=g.createRadialGradient(x,y,0,x,y,r); grd.addColorStop(0,'#12234155'); grd.addColorStop(1,'#0000');
        g.fillStyle=grd; g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill();
      }
      requestAnimationFrame(draw);
    })();
  }

  /* ===== Navegación ===== */
  function setupTabbar(){ $$('.tabbar button').forEach(b=> b.addEventListener('click',()=>goView(b.dataset.go)) ); }
  function goView(id){
    if(id==='admin'){ $('#view-admin').classList.add('show'); }
    $$('.tabbar button').forEach(b=>b.classList.toggle('active', b.dataset.go===id));
    $$('.view').forEach(v=>v.classList.remove('show'));
    const target = $('#view-'+id);
    if(target) target.classList.add('show');
    window.scrollTo({top:0,behavior:'smooth'});
  }

  /* ===== Admin ===== */
  function setupAdmin(){
    $('#btnLogin').onclick=()=>{ goView('admin'); };

    // Login: cliente=5536, admin=2630(hasheado)
    $('#adminEnter').onclick=async ()=>{
      const p = $('#adminPass').value.trim();
      if(!p) return alert('Ingresa la contraseña');

      // Cliente: 5536
      if(p === '5536'){
        sessionStorage.setItem('st_client_ok','1');
        document.documentElement.classList.add('client-on');
        toast('Cliente verificado ✅');
        $('#adminPass').value = '';
        goView('productos');
        return;
      }

      // Admin: 2630 (hash)
      const ph = await hashString(p);
      if(!LS.get('adminHash', null)){
        const h = await hashString('2630'); LS.set('adminHash', h);
      }
      const ok = ph === LS.get('adminHash', null);
      if(ok){
        ST.authed=true; sessionStorage.setItem('st_admin_ok','1'); openPanel(); toast('Acceso ADMIN concedido ✅');
        $('#adminPass').value = '';
      }else{
        alert('Contraseña incorrecta');
      }
    };

    $('#taxSave').onclick=()=>{ 
      ST.tax = Number($('#taxInput').value||0); 
      LS.set('taxRate', ST.tax); 
      updateTotals(); 
      remoteSaveDebounced();                // sync nube
      toast('Sales Tax guardado'); 
    };

    // Cambiar contraseña (hash local)
    $('#passSave').onclick=async ()=>{
      const np=$('#passNew').value.trim(); if(np.length<3) return alert('Min 3 caracteres');
      const h = await hashString(np);
      LS.set('adminHash', h);
      $('#passNew').value='';
      toast('Contraseña actualizada (local)');
    };

    $('#clearVentas').onclick=()=>{ if(confirm('¿Eliminar ventas?')){ ST.ventas=[]; LS.set('ventas',[]); pintarVentas(); pintarClientes(); } };
    $('#clearClientes').onclick=()=>{ if(confirm('¿Eliminar clientes (incluye directorio)?')){ ST.clientes=[]; LS.set('clientes',[]); pintarClientes(); pintarClientesDir(); renderClientesSel(); } };
    $('#clearPres').onclick=()=>{ if(confirm('¿Eliminar presupuestos?')){ ST.presupuestos=[]; LS.set('presupuestos',[]); pintarPres(); } };

    $('#importHero').onchange = (e)=> filesToDataURL(e.target.files).then(imgs=>{ 
      ST.hero.push(...imgs); LS.set('hero', ST.hero); renderHero(); renderHeroAdmin(); 
      remoteSaveDebounced(); 
      toast('Imágenes añadidas al muro'); 
    });
    $('#clearHero').onclick = ()=>{ 
      if(confirm('¿Vaciar todas las imágenes del Muro?')){ 
        ST.hero=[]; LS.set('hero', ST.hero); renderHero(); renderHeroAdmin(); 
        remoteSaveDebounced(); 
        toast('Muro limpiado'); 
      } 
    };

    if(ST.authed){ openPanel(); }
  }

  function openPanel(){
    $('#adminGate').classList.add('hidden');
    $('#adminPanel').classList.remove('hidden');
    $('#taxInput').value = ST.tax;
    $('#tabAdmin').classList.remove('hidden');
    remoteSaveDebounced(); // 🔄 publica snapshot completo al entrar como admin

    // Botón logout (inyectado una vez)
    const row = $('#adminQuickRow');
    if(row && !$('#btnLogout')){
      const card = document.createElement('div');
      card.className='card mini';
      card.innerHTML = `
        <h3>Sesión</h3>
        <div class="row">
          <button id="btnLogout" class="btn danger">Cerrar sesión</button>
        </div>`;
      row.appendChild(card);
      $('#btnLogout').onclick=()=>{
        ST.authed=false; sessionStorage.removeItem('st_admin_ok');
        sessionStorage.removeItem('st_client_ok');
        document.documentElement.classList.remove('client-on');
        $('#adminPanel').classList.add('hidden');
        $('#adminGate').classList.remove('hidden');
        $('#tabAdmin').classList.add('hidden');
        toast('Sesión cerrada');
      };
    }

    renderHeroAdmin();
    renderProductosAdmin();
    renderProyectosAdmin();
    pintarVentas();
    pintarClientes();
    pintarClientesDir();
    pintarPres();

    // Cards extra
    ensureBackupCard();
    ensureCloudCard();     // Card de NUBE (Firebase)
  }

  /* ===== Backup/Restore JSON ===== */
  function ensureBackupCard(){
    const row = $('#adminQuickRow');
    if(!row || $('#backupCard')) return;
    const card = document.createElement('div');
    card.className='card mini';
    card.id='backupCard';
    card.innerHTML = `
      <h3>Respaldo</h3>
      <div class="row wrap">
        <button id="btnExport" class="btn">Exportar JSON</button>
        <label class="btn ghost">Importar JSON
          <input id="impJson" type="file" accept="application/json" hidden>
        </label>
      </div>`;
    row.appendChild(card);

    $('#btnExport').onclick = ()=>{
      const data = {
        tax: ST.tax,
        productos: ST.productos,
        proyectos: ST.proyectos,
        hero: ST.hero,
        clientes: ST.clientes,
        ventas: ST.ventas,
        presupuestos: ST.presupuestos,
        folio: ST.folio
      };
      download('stradivaryus_backup.json', JSON.stringify(data, null, 2), 'application/json');
      toast('Backup exportado');
    };
    $('#impJson').onchange = async (e)=>{
      try{
        const file = e.target.files?.[0]; if(!file) return;
        const txt = await file.text();
        const data = JSON.parse(txt);
        if(!data) return alert('JSON inválido');
        ST.tax = Number(data.tax||ST.tax); LS.set('taxRate', ST.tax);
        ST.productos = Array.isArray(data.productos)? data.productos : ST.productos; LS.set('productos', ST.productos);
        ST.proyectos = Array.isArray(data.proyectos)? data.proyectos : ST.proyectos; LS.set('proyectos', ST.proyectos);
        ST.hero = Array.isArray(data.hero)? data.hero : ST.hero; LS.set('hero', ST.hero);
        ST.clientes = Array.isArray(data.clientes)? data.clientes : ST.clientes; LS.set('clientes', ST.clientes);
        ST.ventas = Array.isArray(data.ventas)? data.ventas : ST.ventas; LS.set('ventas', ST.ventas);
        ST.presupuestos = Array.isArray(data.presupuestos)? data.presupuestos : ST.presupuestos; LS.set('presupuestos', ST.presupuestos);
        ST.folio = Number.isFinite(data.folio)? Number(data.folio) : ST.folio; LS.set('folio', ST.folio);
        renderHero(); renderHeroAdmin();
        renderProductosCliente(); renderProductosAdmin();
        renderProyectosCliente(); renderProyectosAdmin();
        pintarVentas(); pintarClientes(); pintarClientesDir(); pintarPres();
        renderClientesSel(); updateTotals();
        remoteSaveDebounced();
        toast('Backup importado');
      }catch(err){ console.error(err); alert('No se pudo importar el JSON'); }
    };
  }

  /* ===== Hero / Muro ===== */
  function initHero(){
    if(!ST.hero.length){
      ST.hero = ['muro/1.jpg','muro/2.jpg','muro/3.jpg'];
      LS.set('hero', ST.hero);
    }
    renderHero();
    setupHeroNav();
  }
  function renderHero(){
    const cont = $('#heroSlider'); if(!cont) return;
    cont.innerHTML = ST.hero
      .map((src,i)=>`<img class="hslide${i===0?' active':''}" data-ix="${i}" ${i>0?'loading="lazy"':''} src="${src}" alt="Muro ${i+1}">`)
      .join('');
    cont.querySelectorAll('img').forEach(img=> safeImg(img));
    const dots = $('#heroDots');
    if(dots){
      dots.innerHTML = ST.hero.map((_,i)=>`<button class="seg${i===0?' active':''}" data-goto="${i}" aria-label="Ir a imagen ${i+1}"></button>`).join('');
      dots.querySelectorAll('[data-goto]').forEach(b=> b.onclick = ()=>showSlide(Number(b.dataset.goto), true));
    }
  }
  let timerHero=null;
  function setupHeroNav(){
    const p=$('#hPrev'), n=$('#hNext');
    if(p) p.onclick=()=>{ showSlide(ST.slideIdx-1, true); };
    if(n) n.onclick=()=>{ showSlide(ST.slideIdx+1, true); };
    autoHero();
  }
  function autoHero(){ clearInterval(timerHero); timerHero=setInterval(()=>showSlide(ST.slideIdx+1,false), 7000); }
  function showSlide(n, user){
    const a=$$('#heroSlider .hslide'); if(!a.length) return;
    ST.slideIdx=(n+a.length)%a.length;
    a.forEach((s,ix)=>s.classList.toggle('active', ix===ST.slideIdx));
    const dots = $$('#heroDots .seg'); dots.forEach((d,ix)=>d.classList.toggle('active', ix===ST.slideIdx));
    if(user) autoHero();
  }
  function renderHeroAdmin(){
    const g=$('#gridHeroAdmin'); if(!g) return;
    g.innerHTML = ST.hero.map((src,ix)=>`
      <div class="thumb" draggable="true" data-ix="${ix}">
        <img loading="lazy" src="${src}" alt="Muro ${ix+1}">
        <button class="chip danger" data-delh="${ix}">Eliminar</button>
      </div>
    `).join('') || `<div class="muted">Sin imágenes aún</div>`;
    g.querySelectorAll('img').forEach(img=> safeImg(img));
    g.querySelectorAll('[data-delh]').forEach(b=> b.onclick=()=>{ ST.hero.splice(Number(b.dataset.delh),1); LS.set('hero', ST.hero); renderHero(); renderHeroAdmin(); remoteSaveDebounced(); toast('Imagen eliminada'); });
    enableThumbDnD(g);
  }
  function enableThumbDnD(container){
    let dragIx=null;
    container.querySelectorAll('.thumb').forEach(el=>{
      el.addEventListener('dragstart', ()=>{ dragIx = Number(el.dataset.ix); el.classList.add('dragging'); });
      el.addEventListener('dragend',   ()=>{ el.classList.remove('dragging'); });
      el.addEventListener('dragover',  e=>{ e.preventDefault(); el.style.outline='2px dashed var(--brand)'; });
      el.addEventListener('dragleave', ()=>{ el.style.outline=''; });
      el.addEventListener('drop',      e=>{
        e.preventDefault(); el.style.outline='';
        const dropIx = Number(el.dataset.ix);
        if(!Number.isInteger(dragIx) || !Number.isInteger(dropIx) || dragIx===dropIx) return;
        const arr = ST.hero.slice();
        const [moved] = arr.splice(dragIx,1);
        arr.splice(dropIx,0,moved);
        ST.hero = arr; LS.set('hero', ST.hero);
        renderHero(); renderHeroAdmin(); remoteSaveDebounced();
        toast('Orden actualizado');
      });
    });
  }

  /* ===== Productos ===== */
  function initProductos(){
    if(!ST.productos.length){
      ST.productos = [
        {id:u(), nombre:'Taladro Inalámbrico', precio:129.99, imgs:[], vendido:false},
        {id:u(), nombre:'Sierra Circular', precio:99.50, imgs:[], vendido:false},
        {id:u(), nombre:'Lijadora Orbital', precio:59.95, imgs:[], vendido:false},
      ];
    } else {
      ST.productos = ST.productos.map(p=>({vendido:false, ...p}));
    }
    LS.set('productos', ST.productos);
    renderProductosCliente();
    const addBtn=$('#addProducto'); if(addBtn) addBtn.onclick=()=>openFormProducto();
    const imp=$('#importProductos'); if(imp) imp.onchange=(e)=>bulkImportProductos(e.target.files);
  }
  function cardProdCliente(p){
    const img=p.imgs?.[0] || 'venta/1.jpg';
    const sold = p.vendido===true;
    return `<article class="item ${sold?'vendido':''}">
      <div class="img">
        ${sold?'<div class="badge-vendido">VENDIDO</div>':''}
        <img loading="lazy" src="${img}" alt="${esc(p.nombre)}">
      </div>
      <div class="body">
        <h3 class="title">${esc(p.nombre)}</h3>
        <div class="price">$${cur(p.precio)}</div>
        <div class="row">
          <button class="btn primary" data-add="${p.id}" ${sold?'disabled':''}>${sold?'No disponible':'Añadir'}</button>
          <button class="btn ghost" data-lb="${p.id}">Ver</button>
        </div>
      </div>
    </article>`;
  }
  function renderProductosCliente(){
    const grid=$('#gridProductos'); if(!grid) return;
    grid.innerHTML=ST.productos.map(p=>cardProdCliente(p)).join('');
    grid.querySelectorAll('img').forEach(img=> safeImg(img));
    grid.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>addCart(b.dataset.add));
    grid.querySelectorAll('[data-lb]').forEach(b=>{ b.onclick=()=>{ 
      const list = ST.productos.find(x=>x.id===b.dataset.lb)?.imgs || []; 
      openLB(list, 0); track('open_lightbox', {context:'producto', item_id:b.dataset.lb});
    }; });
  }
  function renderProductosAdmin(){
    const grid=$('#gridProductosAdmin'); if(!grid) return;
    grid.innerHTML = ST.productos.map(p=>cardProdAdmin(p)).join('');
    grid.querySelectorAll('img').forEach(img=> safeImg(img));
    grid.querySelectorAll('[data-addimg]').forEach(inp=> inp.onchange = (e)=> filesToDataURL(e.target.files).then(imgs=>{ addImgsProducto(inp.dataset.addimg, imgs); remoteSaveDebounced(); toast('Imágenes añadidas'); }));
    grid.querySelectorAll('[data-delimg]').forEach(btn=> btn.onclick = ()=> { delImgProducto(btn.dataset.delimg, Number(btn.dataset.idx)); remoteSaveDebounced(); toast('Imagen eliminada'); });
    grid.querySelectorAll('[data-delprod]').forEach(btn=> btn.onclick = ()=> { delProducto(btn.dataset.delprod); remoteSaveDebounced(); toast('Producto eliminado'); });
    grid.querySelectorAll('[data-view]').forEach(btn=> btn.onclick = ()=> openLB(ST.productos.find(x=>x.id===btn.dataset.view)?.imgs||[],0));
    grid.querySelectorAll('[data-togglevend]').forEach(btn=> btn.onclick = ()=> { toggleVendido(btn.dataset.togglevend); remoteSaveDebounced(); toast('Estado de venta actualizado'); });
  }
  function cardProdAdmin(p){
    const thumbs = (p.imgs||[]).map((src,ix)=>`
      <div class="thumb"><img loading="lazy" src="${src}" alt="${esc(p.nombre)} img ${ix+1}"><button class="chip danger" data-delimg="${p.id}" data-idx="${ix}">Eliminar</button></div>`).join('') || `<div class="muted">Sin imágenes aún</div>`;
    return `
      <article class="card">
        <div class="row wrap" style="justify-content:space-between;align-items:center">
          <strong>${esc(p.nombre)}</strong>
          <div class="row wrap">
            <button class="chip" data-view="${p.id}">Ver galería</button>
            <button class="chip ${p.vendido?'danger':''}" data-togglevend="${p.id}">${p.vendido?'Marcar disponible':'Marcar vendido'}</button>
          </div>
        </div>
        <div class="thumbs">${thumbs}</div>
        <div class="row wrap" style="margin-top:8px">
          <label class="btn ghost">➕ Añadir desde teléfono
            <input type="file" accept="image/*" multiple hidden data-addimg="${p.id}">
          </label>
          <button class="btn danger" data-delprod="${p.id}">Eliminar producto</button>
        </div>
      </article>`;
  }
  function toggleVendido(id){
  const p = ST.productos.find(x=>x.id===id); if(!p) return;
  p.vendido = !p.vendido;
  LS.set('productos', ST.productos);
  renderProductosCliente(); renderProductosAdmin();
  remoteSaveDebounced(); // 🔄 publicar a la nube
}

function addImgsProducto(id, imgs){
  const p = ST.productos.find(x=>x.id===id); if(!p) return;
  p.imgs = [...(p.imgs||[]), ...imgs];
  LS.set('productos', ST.productos);
  renderProductosCliente(); renderProductosAdmin();
  remoteSaveDebounced(); // 🔄 publicar
}

function delImgProducto(id, idx){
  const p = ST.productos.find(x=>x.id===id); if(!p) return;
  p.imgs.splice(idx,1);
  LS.set('productos', ST.productos);
  renderProductosCliente(); renderProductosAdmin();
  remoteSaveDebounced(); // 🔄 publicar
}

function delProducto(id){
  if(!confirm('¿Eliminar producto completo?')) return;
  ST.productos = ST.productos.filter(x=>x.id!==id);
  LS.set('productos', ST.productos);
  renderProductosCliente(); renderProductosAdmin();
  remoteSaveDebounced(); // 🔄 publicar
}

  function openFormProducto(){
    openModal('Nuevo producto', `
      <form id="fProd" class="form">
        <div class="row wrap">
          <label for="pNombre" class="muted" style="min-width:120px">Nombre</label>
          <input class="input" id="pNombre" placeholder="Nombre" required>
        </div>
        <div class="row wrap">
          <label for="pPrecio" class="muted" style="min-width:120px">Precio</label>
          <input class="input" id="pPrecio" type="number" min="0" step="0.01" placeholder="Precio" required>
        </div>
        <label class="btn ghost" style="display:inline-flex;gap:8px;align-items:center">📷 Imágenes
          <input id="pImgs" type="file" accept="image/*" multiple hidden>
        </label>
        <div class="row" style="margin-top:10px"><button class="btn primary" type="submit">Guardar</button></div>
      </form>
    `);
    $('#fProd').onsubmit = async (e)=>{
      e.preventDefault();
      const nombre=$('#pNombre').value.trim();
      const precio=Number($('#pPrecio').value||0);
      const imgs = await filesToDataURL($('#pImgs').files);
      ST.productos.push({id:u(), nombre, precio, imgs, vendido:false});
      LS.set('productos', ST.productos);
      closeModal(); renderProductosCliente(); renderProductosAdmin();
      remoteSaveDebounced();
      track('create_product', {name: nombre, price: precio});
    };
  }
  function bulkImportProductos(files){
    if(!files?.length) return;
    filesToDataURL(files).then(imgs=>{
      imgs.forEach((src,i)=> ST.productos.push({id:u(), nombre:'Imagen '+(i+1), precio:Math.round(Math.random()*90+10), imgs:[src], vendido:false}));
      LS.set('productos', ST.productos);
      renderProductosCliente(); renderProductosAdmin();
      remoteSaveDebounced();
    });
  }
  function addImgsProducto(id, imgs){ const p = ST.productos.find(x=>x.id===id); if(!p) return; p.imgs = [...(p.imgs||[]), ...imgs]; LS.set('productos', ST.productos); renderProductosCliente(); renderProductosAdmin(); }
  function delImgProducto(id, idx){ const p = ST.productos.find(x=>x.id===id); if(!p) return; p.imgs.splice(idx,1); LS.set('productos', ST.productos); renderProductosCliente(); renderProductosAdmin(); }
  function delProducto(id){ if(!confirm('¿Eliminar producto completo?')) return; ST.productos = ST.productos.filter(x=>x.id!==id); LS.set('productos', ST.productos); renderProductosCliente(); renderProductosAdmin(); }

  /* ===== Proyectos ===== */
  function initProyectos(){
    if(!ST.proyectos.length){
      ST.proyectos = [{id:u(), titulo:'Deck 19×22', desc:'Composite', imgs:[]}];
      LS.set('proyectos', ST.proyectos);
    }
    renderProyectosCliente();
    const add=$('#addProyecto'); if(add) add.onclick=()=>openFormProyecto();
    const imp=$('#importProyectos'); if(imp) imp.onchange=(e)=>bulkImportProyectos(e.target.files);
  }
  function cardProyectoCliente(p){
    const img=p.imgs?.[0] || 'proyect1/1.jpg';
    const count = (p.imgs?.length||0);
    return `<article class="item">
      <div class="img">
        <img loading="lazy" src="${img}" alt="${esc(p.titulo)}">
        ${count? `<div class="badge-count">${count} foto${count>1?'s':''}</div>`:''}
      </div>
      <div class="body">
        <h3 class="title">${esc(p.titulo)}</h3>
        <p class="muted">${esc(p.desc||'')}</p>
        <div class="row"><button class="btn ghost" data-view="${p.id}">Ver</button></div>
      </div>
    </article>`;
  }
  function renderProyectosCliente(){
    const g=$('#gridProyectos'); if(!g) return;
    g.innerHTML = ST.proyectos.map(p=>cardProyectoCliente(p)).join('');
    g.querySelectorAll('img').forEach(img=> safeImg(img));
    g.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{ openLB( ST.proyectos.find(x=>x.id===b.dataset.view)?.imgs || [], 0 ); track('open_lightbox', {context:'proyecto', item_id:b.dataset.view}); });
  }
  function renderProyectosAdmin(){
    const grid=$('#gridProyectosAdmin'); if(!grid) return;
    grid.innerHTML = ST.proyectos.map(p=>cardProyectoAdmin(p)).join('');
    grid.querySelectorAll('img').forEach(img=> safeImg(img));

    grid.querySelectorAll('[data-addimgp]').forEach(inp=>{
      const pid = inp.dataset.addimgp;
      inp.onchange = async (e)=>{
        const files = e.target.files || [];
        if(!files.length){ toast('No seleccionaste imágenes'); return; }
        toast(`${files.length} imagen(es) seleccionada(s). Subiendo…`);
        const imgs = await filesToDataURLCompressed(files, 1400, 0.82);
        addImgsProyecto(pid, imgs);
        remoteSaveDebounced();
        toast(`Se añadieron ${imgs.length} imagen(es)`);
        e.target.value = '';
      };
    });

    grid.querySelectorAll('[data-delimgp]').forEach(btn=> btn.onclick = ()=> { delImgProyecto(btn.dataset.delimgp, Number(btn.dataset.idx)); remoteSaveDebounced(); toast('Imagen eliminada'); });
    grid.querySelectorAll('[data-delproj]').forEach(btn=> btn.onclick = ()=> { delProyecto(btn.dataset.delproj); remoteSaveDebounced(); toast('Proyecto eliminado'); });
    grid.querySelectorAll('[data-viewp]').forEach(btn=> btn.onclick = ()=> openLB(ST.proyectos.find(x=>x.id===btn.dataset.viewp)?.imgs||[],0));
  }
  function cardProyectoAdmin(p){
    const thumbs = (p.imgs||[]).map((src,ix)=>`
      <div class="thumb"><img loading="lazy" src="${src}" alt="${esc(p.titulo)} img ${ix+1}"><button class="chip danger" data-delimgp="${p.id}" data-idx="${ix}">Eliminar</button></div>`).join('') || `<div class="muted">Sin imágenes aún</div>`;
    return `
      <article class="card">
        <div class="row wrap" style="justify-content:space-between;align-items:center">
          <strong>${esc(p.titulo)}</strong>
          <button class="chip" data-viewp="${p.id}">Ver galería</button>
        </div>
        <div class="thumbs">${thumbs}</div>
        <div class="row wrap" style="margin-top:8px;align-items:center;gap:8px">
          <label class="btn ghost">➕ Añadir desde teléfono
            <input type="file" accept="image/*" multiple hidden data-addimgp="${p.id}">
          </label>
          <span class="muted">${(p.imgs?.length||0)} foto(s)</span>
          <button class="btn danger" data-delproj="${p.id}">Eliminar proyecto</button>
        </div>
      </article>`;
  }
  function openFormProyecto(){
    openModal('Nuevo proyecto', `
      <form id="fProj" class="form">
        <div class="row wrap">
          <label for="jTitulo" class="muted" style="min-width:120px">Título</label>
          <input class="input" id="jTitulo" placeholder="Título" required>
        </div>
        <div class="row wrap">
          <label for="jDesc" class="muted" style="min-width:120px">Descripción</label>
          <input class="input" id="jDesc" placeholder="Descripción">
        </div>
        <div class="row wrap" style="align-items:center; gap:8px">
          <label class="btn ghost" style="display:inline-flex;gap:8px;align-items:center">📷 Imágenes
            <input id="jImgs" type="file" accept="image/*" multiple hidden>
          </label>
          <span id="jCount" class="muted">0 seleccionadas</span>
        </div>
        <div id="jPrev" class="thumbs" style="margin-top:8px"></div>
        <div class="row" style="margin-top:10px"><button class="btn primary" type="submit">Guardar</button></div>
      </form>
    `);

    const inp = $('#jImgs'), cnt = $('#jCount'), prev = $('#jPrev');
    inp.onchange = async (e)=>{
      const files = e.target.files || [];
      cnt.textContent = `${files.length} seleccionadas`;
      prev.innerHTML = '';
      if(!files.length) return;
      const datas = await filesToDataURL(files);
      datas.forEach((src,ix)=>{ const div=document.createElement('div'); div.className='thumb'; div.innerHTML=`<img loading="lazy" src="${src}" alt="img ${ix+1}">`; prev.appendChild(div); });
    };

    $('#fProj').onsubmit = async (e)=>{
      e.preventDefault();
      const titulo=$('#jTitulo').value.trim(); const desc=$('#jDesc').value.trim();
      const rawFiles = $('#jImgs').files;
      const imgs = await filesToDataURLCompressed(rawFiles, 1400, 0.82);
      ST.proyectos.push({id:u(), titulo, desc, imgs}); LS.set('proyectos', ST.proyectos);
      closeModal(); renderProyectosCliente(); renderProyectosAdmin();
      remoteSaveDebounced();
      toast('Proyecto creado con imágenes');
      track('create_project', {title: titulo, images: imgs.length});
    };
  }
  function bulkImportProyectos(files){
    if(!files?.length) return;
    filesToDataURL(files).then(imgs=>{
      ST.proyectos.push({id:u(), titulo:'Proyecto nuevo', desc:'', imgs});
      LS.set('proyectos', ST.proyectos); renderProyectosCliente(); renderProyectosAdmin();
      remoteSaveDebounced();
    });
  }
  function addImgsProyecto(id, imgs){
  const p = ST.proyectos.find(x=>x.id===id); if(!p) return;
  p.imgs = [...(p.imgs||[]), ...imgs];
  LS.set('proyectos', ST.proyectos);
  renderProyectosCliente(); renderProyectosAdmin();
  remoteSaveDebounced(); // 🔄 publicar
}

function delImgProyecto(id, idx){
  const p = ST.proyectos.find(x=>x.id===id); if(!p) return;
  p.imgs.splice(idx,1);
  LS.set('proyectos', ST.proyectos);
  renderProyectosCliente(); renderProyectosAdmin();
  remoteSaveDebounced(); // 🔄 publicar
}

function delProyecto(id){
  if(!confirm('¿Eliminar proyecto completo?')) return;
  ST.proyectos = ST.proyectos.filter(x=>x.id!==id);
  LS.set('proyectos', ST.proyectos);
  renderProyectosCliente(); renderProyectosAdmin();
  remoteSaveDebounced(); // 🔄 publicar
}

 

  /* ===== Carrito ===== */
  function initCarrito(){
    renderClientesSel(); renderCarrito();
    const addC=$('#btnAddCliente'); if(addC) addC.onclick=()=>openFormCliente(true);
    const mp=$('#metodoPago');
    if(mp) mp.onchange=()=>{ 
      const v=$('#metodoPago').value; 
      $('#montoEfectivo')?.classList.toggle('hidden', v!=='efectivo'); 
      $('#qrBox')?.classList.toggle('hidden', v!=='zelle'); 
      track('begin_checkout', {method: v||'n/a'});
    };
    const bp=$('#btnPagar'); if(bp) bp.onclick= pagar;
  }
  function renderClientesSel(){
    if(!ST.clientes.length){
      ST.clientes=[{id:'general',nombre:'Cliente General',email:'',empresa:'',telefono:'',direccion:'',compras:0,total:0,ultima:'',createdAt:''}];
      LS.set('clientes',ST.clientes);
    }
    const sel=$('#clienteSel'); if(!sel) return;
    sel.innerHTML=`<option value="general">— Regístrate para comprar —</option>` + ST.clientes.filter(c=>c.id!=='general').map(c=>`<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
  }
  function openFormCliente(required=false){
    openModal(required?'Registro de cliente (requerido)':'Nuevo cliente', `
      <form id="fCli" class="form">
        <div class="row wrap">
          <label for="cNombre" class="muted" style="min-width:120px">Nombre *</label>
          <input class="input" id="cNombre" placeholder="Nombre *" required>
        </div>
        <div class="row wrap">
          <label for="cTel" class="muted" style="min-width:120px">Teléfono *</label>
          <input class="input" id="cTel" placeholder="+1 513..." required pattern="^[0-9+\\-()\\s]{7,}$" title="Teléfono válido">
        </div>
        <div class="row wrap">
          <label for="cDir" class="muted" style="min-width:120px">Dirección</label>
          <input class="input" id="cDir" placeholder="Calle, ciudad (para entregas/instalación)">
        </div>
        <div class="row wrap">
          <label for="cEmpresa" class="muted" style="min-width:120px">Empresa</label>
          <input class="input" id="cEmpresa" placeholder="Empresa (opcional)">
        </div>
        <div class="row wrap">
          <label for="cEmail" class="muted" style="min-width:120px">Correo</label>
          <input class="input" id="cEmail" type="email" placeholder="Correo (opcional)">
        </div>
        <div class="row" style="margin-top:10px"><button class="btn primary" type="submit">Guardar</button></div>
      </form>
    `);
    $('#fCli').onsubmit=(e)=>{
      e.preventDefault();
      const c={
        id:u(),
        nombre:$('#cNombre').value.trim(),
        telefono:$('#cTel').value.trim(),
        direccion:$('#cDir').value.trim(),
        empresa:$('#cEmpresa').value.trim(),
        email:$('#cEmail').value.trim(),
        compras:0,total:0,ultima:'', createdAt:new Date().toLocaleString()
      };
      if(!c.nombre || !c.telefono) return alert('Nombre y teléfono son obligatorios');
      ST.clientes.push(c); LS.set('clientes',ST.clientes);
      renderClientesSel(); $('#clienteSel').value=c.id; pintarClientes(); pintarClientesDir(); closeModal();
      toast('Cliente registrado');
    };
  }
  function addCart(id){
    const p=ST.productos.find(x=>x.id===id); if(!p) return;
    if(p.vendido){ alert('Este producto ya fue vendido'); return; }
    const it=ST.carrito.find(i=>i.id===id);
    const img = p.imgs?.[0] || 'venta/1.jpg';
    if(it) it.cant+=1; else ST.carrito.push({id:p.id,nombre:p.nombre,precio:p.precio,cant:1,img});
    LS.set('carrito', ST.carrito); renderCarrito();
    track('add_to_cart', {item_id: id, value: p.precio, item_name: p.nombre});
  }
  function renderCarrito(){
    const ul=$('#listaCarrito'); if(!ul) return;
    ul.innerHTML=ST.carrito.map((i,k)=>`
      <li>
        <div class="left">
          <img class="thumb-cart" src="${i.img||'venta/1.jpg'}" alt="Imagen de ${esc(i.nombre)}">
          <div>${esc(i.nombre)} <span class="muted">x${i.cant}</span></div>
        </div>
        <div class="row">
          <button class="chip" data-less="${k}">−</button>
          <button class="chip" data-plus="${k}">＋</button>
          <button class="chip" data-del="${k}">✕</button>
        </div>
      </li>`).join('');
    ul.querySelectorAll('img').forEach(img=> safeImg(img));
    ul.querySelectorAll('[data-less]').forEach(b=>b.onclick=()=>qty(b.dataset.less,-1));
    ul.querySelectorAll('[data-plus]').forEach(b=>b.onclick=()=>qty(b.dataset.plus,1));
    ul.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>delCart(b.dataset.del));
    updateTotals();
  }
  function qty(ix, d){ ix=Number(ix); ST.carrito[ix].cant+=d; if(ST.carrito[ix].cant<=0) ST.carrito.splice(ix,1); LS.set('carrito',ST.carrito); renderCarrito(); }
  function delCart(ix){ ST.carrito.splice(Number(ix),1); LS.set('carrito',ST.carrito); renderCarrito(); }
  function updateTotals(){ const sub=ST.carrito.reduce((s,i)=>s+i.precio*i.cant,0); const imp=sub*(ST.tax/100); const tot=sub+imp; $('#subTxt').textContent=cur(sub); $('#taxRateTxt').textContent=cur(ST.tax); $('#taxTxt').textContent=cur(imp); $('#totTxt').textContent=cur(tot); }

  // ======= Pago =======
  async function pagar(){
    if(!ST.carrito.length) return alert('Carrito vacío');
    const cliId=$('#clienteSel').value;
    const cli=ST.clientes.find(c=>c.id===cliId);
    if(!cli || cli.id==='general' || !cli.telefono){
      alert('Para comprar debes registrarte con Nombre y Teléfono.');
      return openFormCliente(true);
    }
    const metodo=$('#metodoPago').value; if(!metodo) return alert('Selecciona método');
    const sub=Number($('#subTxt').textContent), imp=Number($('#taxTxt').textContent), tot=Number($('#totTxt').textContent);

    let zelleConf = null;
    if(metodo==='zelle'){
      await new Promise((resolve)=>{
        openModal('Confirmar pago Zelle', `
          <form id="fZelle" class="form">
            <div class="row wrap">
              <label for="zId" class="muted" style="min-width:140px">ID/Referencia *</label>
              <input class="input" id="zId" placeholder="Ej: A1B2C3..." required>
            </div>
            <div class="row wrap">
              <label class="btn ghost">📎 Comprobante (imagen)
                <input id="zFile" type="file" accept="image/*" hidden>
              </label>
              <span id="zName" class="muted">Ningún archivo</span>
            </div>
            <div class="row" style="margin-top:10px">
              <button class="btn" type="button" id="zCancel">Cancelar</button>
              <button class="btn primary" type="submit">Confirmar</button>
            </div>
          </form>
        `);
        let proofData = null;
        $('#zFile').onchange = async (e)=>{
          const arr = await filesToDataURLCompressed(e.target.files, 1400, 0.82);
          proofData = arr[0] || null;
          $('#zName').textContent = e.target.files?.[0]?.name || 'Ningún archivo';
        };
        $('#fZelle').onsubmit = (ev)=>{
          ev.preventDefault();
          const id = $('#zId').value.trim();
          if(!id){ alert('Ingresa el ID de transacción'); return; }
          zelleConf = { id, proof: proofData||null };
          closeModal(); resolve();
        };
        $('#zCancel').onclick = ()=>{ closeModal(); resolve(); };
      });
      if(!zelleConf){ return alert('Pago cancelado'); }
    } else if(metodo==='efectivo'){
      const ent=Number($('#montoEfectivo').value||0);
      if(ent<tot) return alert('Efectivo insuficiente');
    }

    // Registrar venta
    const venta={
      id:'V'+String(ST.folio).padStart(5,'0'),
      fecha:new Date().toLocaleString(),
      cliente:cli.nombre,
      direccion: cli.direccion || '',
      items:ST.carrito.map(i=>({n:i.nombre,c:i.cant,p:i.precio,id:i.id})),
      subtotal:sub, impuesto:imp, total:tot, metodo,
      zelle: zelleConf
    };
    ST.ventas.unshift(venta); ST.folio++; LS.set('ventas',ST.ventas); LS.set('folio',ST.folio);

    // Actualizar resumen cliente
    cli.compras=(cli.compras||0)+1; cli.total=Number(cli.total||0)+tot; cli.ultima=venta.fecha; LS.set('clientes',ST.clientes);

    // Marcar productos vendidos
    venta.items.forEach(it=>{ const p = ST.productos.find(x=>x.id===it.id); if(p) p.vendido = true; });
    LS.set('productos', ST.productos);

    // Limpiar carrito y refrescar vistas
    ST.carrito=[]; LS.set('carrito',ST.carrito); renderCarrito();
    pintarRecibo(venta); pintarVentas(); pintarClientes(); pintarClientesDir();
    renderProductosCliente(); renderProductosAdmin();
    remoteSaveDebounced(); // 🔄 publica productos vendidos

    track('purchase', {value: tot, tax: imp, currency: 'USD', items: venta.items.map(i=>({id:i.id,name:i.n,price:i.p,quantity:i.c}))});
    toast('Compra registrada');
  }

  /* ===== Recibo ===== */
  function pintarRecibo(v){
    const box=$('#reciboBox'); if(!box) return;
    box.classList.remove('hidden');
    box.innerHTML = `
      <h3>Recibo #${v.id}</h3>
      <p class="muted">${v.fecha} · <em>toca el recibo para reimprimir</em></p>
      <div id="receiptArea" class="table-wrap">
        <table>
          <thead><tr><th>Producto</th><th>Cant</th><th>Precio</th><th>Importe</th></tr></thead>
          <tbody>${v.items.map(it=>`<tr><td>${esc(it.n)}</td><td>${it.c}</td><td>$${cur(it.p)}</td><td>$${cur(it.p*it.c)}</td></tr>`).join('')}</tbody>
          <tfoot>
            <tr><td colspan="3" style="text-align:right">Subtotal</td><td>$${cur(v.subtotal)}</td></tr>
            <tr><td colspan="3" style="text-align:right">Impuesto</td><td>$${cur(v.impuesto)}</td></tr>
            <tr><td colspan="3" style="text-align:right"><strong>Total</strong></td><td><strong>$${cur(v.total)}</strong></td></tr>
            <tr><td colspan="3" style="text-align:right">Método</td><td>${v.metodo}${v.zelle&&v.zelle.id? ' · ID: '+esc(v.zelle.id) : ''}</td></tr>
          </tfoot>
        </table>
      </div>
      <div class="row" style="margin-top:8px;align-items:center">
        <select id="receiptFormat" class="input" style="max-width:170px">
          <option value="a5" selected>A5</option>
          <option value="a4">A4</option>
          <option value="ticket80">Ticket 80mm</option>
        </select>
        <button id="recPrint" class="btn primary">🖨️ Imprimir / Guardar</button>
      </div>`;
    $('#recPrint').onclick=()=>reciboPrettyPrint(v);
    $('#receiptArea').addEventListener('click', ()=>reciboPrettyPrint(v));
  }

  /* ===== Recibo bonito ===== */
  async function reciboPrettyPrint(v){
    const fmtSel = $('#receiptFormat')?.value || 'a5';
    let W, H, pageCSS;
    if(fmtSel==='a4'){ W=1654; H=2339; pageCSS='@page { size: A4 portrait; margin: 10mm; }'; }
    else if(fmtSel==='ticket80'){ W=640; const base=480, per=64; H = base + v.items.length*per + 320; pageCSS='@page { size: 80mm auto; margin: 5mm; } body{background:#0f1420;}'; }
    else { W=1200; H=1700; pageCSS='@page { size: A5 portrait; margin: 10mm; }'; }

    // ...
const c=document.createElement('canvas'); c.width=W; c.height=H; const ctx=c.get
Context('2d');

// Fondo
ctx.fillStyle='#0f1420';
ctx.fillRect(0,0,W,H);

const isTicket = fmtSel==='ticket80';
const pad = isTicket ? 28 : Math.round(W*0.05);
const cardR = isTicket ? 16 : 24;
const cardW = W - pad*2;
const cardH = H - pad*2;

roundRect(ctx, pad, pad, cardW, cardH, cardR, '#0b111d', true, '#223352');

// Logo
let logo=null;
try{ logo = await loadImage('logoklem.png'); }catch{}
const logoSize = isTicket ? 80 : Math.round(W*0.08);
if(logo) ctx.drawImage(logo, pad+40, pad+40, logoSize, logoSize);

// Títulos
ctx.fillStyle='#e8eef8';
ctx.font= (isTicket?'bold 26px Inter':'bold 42px Inter');
ctx.fillText('Stradivaryus Tools', pad+40+logoSize+20, pad+40+Math.round(logoSize*0.6));
ctx.font= (isTicket?'16px Inter':'20px Inter'); ctx.fillStyle='#a7b3c9';
ctx.fillText('Recibo de compra', pad+40+logoSize+20, pad+40+Math.round(logoSize*0.6)+ (isTicket?22:35));

// Datos
ctx.fillStyle='#e8eef8'; ctx.font=(isTicket?'15px Inter':'18px Inter');
let baseY = pad + logoSize + (isTicket?80:120);
ctx.fillText(`Número: ${v.id}`, pad+40, baseY);
ctx.fillText(`Fecha: ${v.fecha}`, pad+40, baseY+(isTicket?24:30));
ctx.fillText(`Cliente: ${v.cliente}`, pad+40, baseY+(isTicket?48:60));
if(v.direccion) ctx.fillText(`Dirección: ${v.direccion}`, pad+40, baseY+(isTicket?72:90));

// Encabezados de tabla
let y = baseY + (isTicket?80:120);
ctx.fillStyle='#cfe1ff'; ctx.font=(isTicket?'bold 15px Inter':'bold 18px Inter');

const colNombreX = pad+40;
const colCantX   = isTicket ? Math.round(W*0.62) : Math.round(W*0.65);
const colPrecioX = isTicket ? Math.round(W*0.75) : Math.round(W*0.73);
const colImpX    = isTicket ? Math.round(W*0.86) : Math.round(W*0.85);

ctx.fillText('Producto', colNombreX, y);
ctx.fillText('Cant', colCantX, y);
ctx.fillText('Precio', colPrecioX, y);
ctx.fillText('Importe', colImpX, y);

// Separador
y += (isTicket?14:18); line(ctx, pad+30, y, W-(pad+30), y, '#1a2440'); y += (isTicket?22:26);

// Items
ctx.font=(isTicket?'14px Inter':'16px Inter'); ctx.fillStyle='#e8eef8';
const lineH = isTicket ? 20 : 22;
const wrapW = Math.round(cardW*0.6);

v.items.forEach(it=>{
  wrapText(ctx, it.n, colNombreX, y, wrapW, lineH);
  const rows = Math.max(1, Math.ceil(ctx.measureText(it.n).width / wrapW));
  ctx.fillText(String(it.c), colCantX, y);
  ctx.fillText(`$${cur(it.p)}`, colPrecioX, y);
  ctx.fillText(`$${cur(it.p*it.c)}`, colImpX, y);
  y += lineH*rows + (isTicket?6:8);
});

// Totales
y += (isTicket?6:10); line(ctx, pad+30, y, W-(pad+30), y, '#1a2440'); 
y += (isTicket?20:30); ctx.font=(isTicket?'15px Inter':'18px Inter');
ctx.fillText(`Subtotal: $${cur(v.subtotal)}`, colPrecioX, y); y+= (isTicket?18:26);
ctx.fillText(`Impuesto: $${cur(v.impuesto)}`, colPrecioX, y); y+= (isTicket?20:28);
ctx.font=(isTicket?'bold 18px Inter':'bold 22px Inter'); ctx.fillText(`Total: $${cur(v.total)}`, colPrecioX, y);

// Exportar/Compartir/Imprimir
const dataURL = c.toDataURL('image/png');
const blob = dataURLtoBlob(dataURL);
const shared = await shareFile(`Recibo_${v.id}.png`, blob, 'image/png');
if(!shared){ download(`Recibo_${v.id}.png`, blob, 'image/png'); }

const url = URL.createObjectURL(blob);
openPrintWindowWithImage(url, (fmtSel==='ticket80')
  ? '@page { size: 80mm auto; margin: 5mm; } body{background:#0f1420;}'
  : (fmtSel==='a4') ? '@page { size: A4 portrait; margin: 10mm; }'
  : '@page { size: A5 portrait; margin: 10mm; }'
);
}

/* ===== Ventana de impresión (imagen) ===== */
function openPrintWindowWithImage(imgURL, pageCSS){
  const w = window.open('', '_blank');
  if(!w){
    alert('Se guardó el archivo. Para imprimir, habilita ventanas emergentes o abre el archivo desde tus descargas.');
    return;
  }
  const html = `
    <html><head><title>Imprimir Recibo</title>
    <style>
      ${pageCSS}
      html,body{height:100%}
      body{ margin:0; background:#0f1420; }
      .wrap{ display:flex; align-items:center; justify-content:center; width:100vw; height:100vh; }
      img{ max-width:100%; max-height:100%; display:block; }
    </style></head>
    <body>
      <div class="wrap"><img src="${imgURL}" onload="setTimeout(()=>window.print(), 100)"></div>
    </body></html>`;
  w.document.open(); w.document.write(html); w.document.close();
}

/* =======================
   PRESUPUESTO (ADMIN)
======================= */
function initPresupuestoAdmin(){
  const tBody = $('#presTable tbody'); if(!tBody) return;
  $('#rowAdd')?.addEventListener('click',()=>rowAdd(tBody, '#presTotal'));
  $('#presCSV')?.addEventListener('click',()=>presCSV('#presTable','#presTotal'));
  $('#presPDF')?.addEventListener('click',()=>presPDF('#presCliente','#presProyecto','#presTable','#presTotal', true, $('#presFormat')?.value||'a4'));
  if(!tBody.children.length) rowAdd(tBody, '#presTotal');
}
function rowAdd(tBody, totalSel){
  const tr=document.createElement('tr');
  tr.innerHTML=`<td><input class="input" placeholder="Material"></td><td><input class="input" type="number" min="0" step="1" value="1"></td><td><input class="input" type="number" min="0" step="0.01" value="0.00"></td><td class="sub">$0.00</td><td><button class="chip danger">✕</button></td>`;
  tBody.appendChild(tr);
  const [m,c,p]= $$('input',tr);
  [c,p].forEach(i=>i.addEventListener('input',()=>calcPres(tBody,totalSel)));
  tr.querySelector('button').onclick=()=>{ tr.remove(); calcPres(tBody,totalSel); };
  calcPres(tBody,totalSel);
}
function calcPres(tBody, totalSel){
  let total=0; [...tBody.children].forEach(tr=>{
    const [m,c,p]=$$('input',tr);
    const sub=(Number(c.value)||0)*(Number(p.value)||0);
    tr.querySelector('.sub').textContent='$'+cur(sub);
    total+=sub;
  });
  $(totalSel).textContent='$'+cur(total);
}
function buildRows(tableSel){
  return $$(tableSel+' tbody tr').map(tr=>{
    const [m,c,p]=$$('input',tr);
    const sub=(Number(c.value)||0)*(Number(p.value)||0);
    return [m.value,c.value,'$'+cur(p.value), '$'+cur(sub)];
  });
}
function presCSV(tableSel,totalSel){
  const rows = buildRows(tableSel);
  const total = rows.reduce((a,r)=>a+Number(String(r[3]).replace(/[^0-9.]/g,'')),0);
  const csv = [['Material','Cantidad','Precio','Subtotal'],...rows,['','','Total',cur(total)]].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  download('presupuesto.csv', csv, 'text/csv');
}

/* ===== Carga segura de jsPDF ===== */
function loadScript(src){
  return new Promise((resolve, reject)=>{
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = ()=>resolve();
    s.onerror = ()=>reject(new Error('No se pudo cargar: '+src));
    document.head.appendChild(s);
  });
}
async function ensurePDFLibs(){
  if(!(window.jspdf && window.jspdf.jsPDF)){
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  }
  if(!(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable)){
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js');
  }
  try{
    const { jsPDF } = window.jspdf;
    const test = new jsPDF();
    test.text('',10,10);
  }catch{
    throw new Error('jsPDF no está disponible');
  }
}

/* ===== PDF elegante + guardar/compartir + imprimir (solo admin) ===== */
async function presPDF(cliSel, proySel, tableSel, totalSel, saveAdmin, paper='a4'){
  try{
    await ensurePDFLibs();
    const { jsPDF } = window.jspdf;
    const doc=new jsPDF({format: paper, orientation:'p', unit:'mm'});

    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(15,20,32); doc.rect(0,0,W,18,'F');
    doc.setFillColor(59,100,255); doc.rect(0,18,W,2,'F');

    try{
      const logo = await imgToDataURL('logoklem.png');
      if(logo) doc.addImage(logo,'PNG',10,6,10,10);
    }catch{}

    doc.setTextColor(255,255,255); doc.setFontSize(12); doc.text('Stradivaryus Tools', 24, 13);
    doc.setTextColor(180); doc.setFontSize(9); doc.text('Orden / Presupuesto', 24, 17);

    doc.setTextColor(20); doc.setFontSize(10);
    const cliente=$(cliSel).value.trim(); const proyecto=$(proySel).value.trim();
    doc.text(`Cliente: ${cliente||'-'}`, 12, 30);
    doc.text(`Proyecto: ${proyecto||'-'}`, 120, 30);

    const rows = buildRows(tableSel);
    doc.autoTable({
      head:[['Material','Cant','Precio','Subtotal']],
      body:rows,
      startY: 36,
      styles:{fontSize:9, halign:'left'},
      headStyles:{fillColor: [59,100,255], textColor:255},
      alternateRowStyles:{fillColor:[245,247,255]},
      theme:'grid',
      columnStyles:{1:{halign:'center',cellWidth:18},2:{halign:'right',cellWidth:24},3:{halign:'right',cellWidth:28}}
    });

    const total = Number($(totalSel).textContent.replace(/[^0-9.]/g,''));
    let y = doc.lastAutoTable.finalY + 6;
    doc.setDrawColor(59,100,255); doc.setLineWidth(0.3);
    doc.roundedRect(W-70, y-4, 60, 16, 2, 2); 
    doc.setFontSize(10); doc.text('Total', W-64, y+2);
    doc.setFontSize(12); doc.setTextColor(0); doc.text(`$${cur(total)}`, W-30, y+2, {align:'right'});

    if(saveAdmin){
      ST.presupuestos.unshift({fecha:new Date().toLocaleString(), cliente, proyecto, monto: total, rows});
      LS.set('presupuestos', ST.presupuestos); pintarPres();
      remoteSaveDebounced();
    }

    const pdfBlob = doc.output('blob');
    const shared = await shareFile(`Presupuesto_${Date.now()}.pdf`, pdfBlob, 'application/pdf');
    if(!shared){ download(`Presupuesto_${Date.now()}.pdf`, pdfBlob, 'application/pdf'); }
    const url = URL.createObjectURL(pdfBlob);
    openPrintPDF(url);
  }catch(err){
    console.error(err);
    alert('Se guardó el archivo localmente. Si no ves la vista de impresión, habilita ventanas emergentes para este sitio e inténtalo de nuevo.');
  }
}
function openPrintPDF(url){
  const w = window.open('', '_blank');
  if(!w){
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

/* ===== Tablas Admin (Ventas/Clientes/Presupuestos) ===== */
function pintarVentas(){
  const tb=$('#tbVentas'); if(!tb) return;
  tb.innerHTML = ST.ventas.map((v,ix)=>`
    <tr>
      <td>${v.fecha}</td>
      <td>${v.id}</td>
      <td>${esc(v.cliente)}</td>
      <td>${v.items.map(i=>esc(i.n)+' x'+i.c).join(', ')}</td>
      <td>$${cur(v.subtotal)}</td>
      <td>$${cur(v.impuesto)}</td>
      <td>$${cur(v.total)}</td>
      <td>${v.metodo}${v.zelle&&v.zelle.id? ' · '+esc(v.zelle.id):''}</td>
      <td><button class="chip" data-print="${ix}">🖨️</button></td>
      <td><button class="chip danger" data-delv="${ix}">✕</button></td>
    </tr>`).join('');
  tb.querySelectorAll('[data-delv]').forEach(b=> b.onclick=()=>{ ST.ventas.splice(Number(b.dataset.delv),1); LS.set('ventas',ST.ventas); pintarVentas(); remoteSaveDebounced(); });
  tb.querySelectorAll('[data-print]').forEach(b=> b.onclick=()=>{ const v = ST.ventas[Number(b.dataset.print)]; if(v) reciboPrettyPrint(v); });
}
function pintarClientes(){
  const tb=$('#tbClientes'); if(!tb) return;
  tb.innerHTML = ST.clientes.filter(c=>c.id!=='general').map((c,ix)=>`
    <tr>
      <td>${esc(c.nombre)}</td><td>${c.compras||0}</td><td>$${cur(c.total||0)}</td><td>${c.ultima||''}</td>
      <td><button class="chip danger" data-delc="${ix}">✕</button></td>
    </tr>`).join('');
  tb.querySelectorAll('[data-delc]').forEach(b=> b.onclick=()=>{ ST.clientes.splice(Number(b.dataset.delc)+1,1); LS.set('clientes',ST.clientes); pintarClientes(); pintarClientesDir(); renderClientesSel(); remoteSaveDebounced(); });
}
function pintarClientesDir(){
  const tb=$('#tbClientesDir'); if(!tb) return;
  tb.innerHTML = ST.clientes.filter(c=>c.id!=='general').map((c,ix)=>`
    <tr>
      <td>${esc(c.nombre)}</td>
      <td>${esc(c.telefono||'')}</td>
      <td>${esc(c.empresa||'')}</td>
      <td>${esc(c.email||'')}</td>
      <td>${esc(c.createdAt||'')}</td>
      <td><button class="chip danger" data-delcd="${ix}">✕</button></td>
    </tr>`).join('');
  tb.querySelectorAll('[data-delcd]').forEach(b=> b.onclick=()=>{ ST.clientes.splice(Number(b.dataset.delcd)+1,1); LS.set('clientes',ST.clientes); pintarClientesDir(); pintarClientes(); renderClientesSel(); remoteSaveDebounced(); });
}
function pintarPres(){
  const tb=$('#tbPres'); if(!tb) return;
  tb.innerHTML = ST.presupuestos.map((p,ix)=>`
    <tr>
      <td>${p.fecha}</td><td>${esc(p.cliente||'-')}</td><td>${esc(p.proyecto||'-')}</td><td>$${cur(p.monto||0)}</td>
      <td><button class="chip" data-printp="${ix}">🖨️</button></td>
      <td><button class="chip danger" data-delp="${ix}">✕</button></td>
    </tr>`).join('');
  tb.querySelectorAll('[data-delp]').forEach(b=> b.onclick=()=>{ ST.presupuestos.splice(Number(b.dataset.delp),1); LS.set('presupuestos',ST.presupuestos); pintarPres(); remoteSaveDebounced(); });
  tb.querySelectorAll('[data-printp]').forEach(b=> b.onclick=()=> presReprint(Number(b.dataset.printp)));
}
async function presReprint(ix){
  const p = ST.presupuestos[ix];
  if(!p){ return; }
  if(!p.rows || !p.rows.length){
    alert('Este presupuesto no tiene detalle guardado. Crea uno nuevo para habilitar reimpresión.');
    return;
  }
  try{
    await ensurePDFLibs();
    const { jsPDF } = window.jspdf;
    const doc=new jsPDF({format:'a4', orientation:'p', unit:'mm'});

    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(15,20,32); doc.rect(0,0,W,18,'F');
    doc.setFillColor(59,100,255); doc.rect(0,18,W,2,'F');
    try{
      const logo = await imgToDataURL('logoklem.png');
      if(logo) doc.addImage(logo,'PNG',10,6,10,10);
    }catch{}
    doc.setTextColor(255,255,255); doc.setFontSize(12); doc.text('Stradivaryus Tools', 24, 13);
    doc.setTextColor(180); doc.setFontSize(9); doc.text('Orden / Presupuesto (reimpresión)', 24, 17);

    doc.setTextColor(20); doc.setFontSize(10);
    doc.text(`Cliente: ${p.cliente||'-'}`, 12, 30);
    doc.text(`Proyecto: ${p.proyecto||'-'}`, 120, 30);
    doc.text(`Fecha original: ${p.fecha||'-'}`, 12, 36);

    doc.autoTable({
      head:[['Material','Cant','Precio','Subtotal']],
      body:p.rows,
      startY: 42,
      styles:{fontSize:9, halign:'left'},
      headStyles:{fillColor: [59,100,255], textColor:255},
      alternateRowStyles:{fillColor:[245,247,255]},
      theme:'grid',
      columnStyles:{1:{halign:'center',cellWidth:18},2:{halign:'right',cellWidth:24},3:{halign:'right',cellWidth:28}}
    });

    let y = doc.lastAutoTable.finalY + 6;
    doc.setDrawColor(59,100,255); doc.setLineWidth(0.3);
    doc.roundedRect(W-70, y-4, 60, 16, 2, 2); 
    doc.setFontSize(10); doc.text('Total', W-64, y+2);
    doc.setFontSize(12); doc.setTextColor(0); doc.text(`$${cur(p.monto||0)}`, W-30, y+2, {align:'right'});

    const pdfBlob = doc.output('blob');
    const shared = await shareFile(`Presupuesto_${Date.now()}.pdf`, pdfBlob, 'application/pdf');
    if(!shared){ download(`Presupuesto_${Date.now()}.pdf`, pdfBlob, 'application/pdf'); }
    const url = URL.createObjectURL(pdfBlob);
    openPrintPDF(url);
  }catch(e){
    console.error(e);
    alert('Se guardó el archivo. Si no se abrió la impresión, habilita ventanas emergentes y vuelve a intentarlo.');
  }
}
/* =======================
   LIGHTBOX / GALERÍA
======================= */
function lightboxInit(){
  $('#lbClose')?.addEventListener('click', closeLB);
  $('#lbPrev')?.addEventListener('click', ()=>navLB(-1));
  $('#lbNext')?.addEventListener('click', ()=>navLB(1));
  $('#zIn')?.addEventListener('click', ()=>zoom(0.15));
  $('#zOut')?.addEventListener('click', ()=>zoom(-0.15));
  $('#zReset')?.addEventListener('click', ()=>{ST.lb.zoom=1;applyZoom()});
  $('#openNew')?.addEventListener('click', ()=>{ const s=$('#lbImg')?.src; if(s) open(s,'_blank'); });
  document.addEventListener('keydown',e=>{
    if($('#lightbox')?.classList.contains('hidden')) return;
    if(e.key==='Escape') closeLB();
    if(e.key==='ArrowLeft') navLB(-1);
    if(e.key==='ArrowRight') navLB(1);
  });
}
function openLB(list,start){ ST.lb.list=list||[]; ST.lb.idx=start||0; ST.lb.zoom=1; const img=$('#lbImg'); if(img) img.src=ST.lb.list[start]||''; $('#lightbox')?.classList.remove('hidden'); applyZoom(); }
function closeLB(){ $('#lightbox')?.classList.add('hidden'); }
function navLB(d){ if(!ST.lb.list.length) return; ST.lb.idx=(ST.lb.idx+d+ST.lb.list.length)%ST.lb.list.length; const img=$('#lbImg'); if(img) img.src=ST.lb.list[ST.lb.idx]; ST.lb.zoom=1; applyZoom(); }
function zoom(d){ ST.lb.zoom=Math.max(.4, Math.min(3, ST.lb.zoom+d)); applyZoom(); }
function applyZoom(){ const img=$('#lbImg'); if(img){ img.style.transform=`scale(${ST.lb.zoom})`; img.style.transformOrigin='center'; } }

/* =======================
   TEMA (claro/oscuro/auto)
======================= */
function themeInit(){
  const pref = localStorage.getItem("st_theme3") || 'auto';
  applyTheme(pref);
}
function applyTheme(mode){
  if(mode==='auto') document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", mode);
  localStorage.setItem("st_theme3", mode);
  updateThemeButton();
}
function setupThemeSwitch(){
  $('#btnTheme')?.addEventListener('click', ()=>{
    const cur = localStorage.getItem("st_theme3") || 'auto';
    const next = cur==='auto' ? 'light' : cur==='light' ? 'dark' : 'auto';
    applyTheme(next);
  });
  updateThemeButton();
}
function updateThemeButton(){
  const t = localStorage.getItem("st_theme3") || 'auto';
  const btn = $('#btnTheme'); if(!btn) return;
  if(t==='auto'){ btn.textContent='🖥️'; btn.title='Tema automático'; }
  else if(t==='light'){ btn.textContent='🌙'; btn.title='Cambiar a oscuro'; }
  else { btn.textContent='🌞'; btn.title='Cambiar a claro'; }
}

/* =======================
   COMPARTIR (móvil)
======================= */
async function shareFile(filename, blob, mime){
  try{
    if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: mime })] })) {
      await navigator.share({ title: "Stradivaryus Tools", text: filename, files: [new File([blob], filename, { type: mime })] });
      return true;
    }
  }catch(e){}
  return false;
}

/* =======================
   MODAL
======================= */
function openModal(title, html){
  const m=$('#modal'); if(!m) return;
  $('#modalTitle').textContent=title;
  $('#modalBody').innerHTML=html;
  m.classList.remove('hidden');
  $('#modalClose').onclick=closeModal;
  m.addEventListener('click',e=>{ if(e.target.id==='modal') closeModal(); }, {once:true});
}
function closeModal(){ $('#modal')?.classList.add('hidden'); }

/* =======================
   UTILS
======================= */
function esc(s=''){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function u(){return Math.random().toString(36).slice(2,9)}
function download(name, data, mime='application/octet-stream'){
  const blob = data instanceof Blob ? data : new Blob([data], {type:mime});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),3000);
}
function dataURLtoBlob(dataURL){
  const parts=dataURL.split(',');
  const bstr=atob(parts[1]);
  let n=bstr.length; const u8=new Uint8Array(n);
  while(n--){u8[n]=bstr.charCodeAt(n)}
  return new Blob([u8], {type: parts[0].split(':')[1].split(';')[0]});
}
async function filesToDataURL(fileList){
  if(!fileList || !fileList.length) return [];
  const arr = Array.from(fileList);
  const read = f => new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(f); });
  return await Promise.all(arr.map(read));
}
function loadImage(src){
  return new Promise(r=>{
    const img=new Image(); img.crossOrigin='anonymous';
    img.onload = ()=>r(img);
    img.onerror = ()=>r(null);
    img.src = src;
  });
}
async function imgToDataURL(src){
  try{
    const resp = await fetch(src, {mode:'cors'});
    const blob = await resp.blob();
    return await new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(blob); });
  }catch{ return null; }
}
function line(ctx,x1,y1,x2,y2,color='#223352'){ ctx.strokeStyle=color; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); }
function roundRect(ctx, x, y, w, h, r, fill='#fff', doFill=true, stroke=null){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  if(doFill){ ctx.fillStyle=fill; ctx.fill(); }
  if(stroke){ ctx.strokeStyle=stroke; ctx.lineWidth=1; ctx.stroke(); }
}
function wrapText(ctx, text, x, y, maxWidth, lineHeight){
  const words = String(text).split(' '); let line=''; let yy=y;
  for(let n=0;n<words.length;n++){
    const test=line+words[n]+' '; const m=ctx.measureText(test).width;
    if(m>maxWidth && n>0){ ctx.fillText(line, x, yy); line=words[n]+' '; yy+=lineHeight; }
    else line=test;
  }
  ctx.fillText(line, x, yy);
}
function safeImg(imgEl, placeholder='data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width=\"600\" height=\"400\"><rect width=\"100%\" height=\"100%\" fill=\"%230b1018\"/><text x=\"50%\" y=\"50%\" dominant-baseline=\"middle\" text-anchor=\"middle\" fill=\"%23a7b3c9\" font-family=\"Inter,Arial\" font-size=\"18\">Imagen no disponible</text></svg>'){
  if(!imgEl) return;
  imgEl.setAttribute('data-fallback','1');
  imgEl.onerror = ()=>{ if(imgEl.src!==placeholder) imgEl.src = placeholder; };
}

/* =======================
   FAB arrastrable
======================= */
function setupDraggableFab(){
  const fab = document.querySelector('.fab');
  if(!fab) return;

  const k = 'fab_pos_v1';
  try{
    const pos = JSON.parse(localStorage.getItem(k));
    if(pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)){
      fab.style.position = 'fixed';
      fab.style.left = pos.x + 'px';
      fab.style.top  = pos.y + 'px';
      fab.style.right = 'auto';
      fab.style.bottom = 'auto';
    }
  }catch{}

  let sx=0, sy=0, ox=0, oy=0, dragging=false;

  const start = (e)=>{
    const p = pointer(e);
    const rect = fab.getBoundingClientRect();
    sx = p.x; sy = p.y;
    ox = rect.left; oy = rect.top;
    dragging = true;
    fab.classList.add('dragging');
    e.preventDefault();
  };
  const move = (e)=>{
    if(!dragging) return;
    const p = pointer(e);
    const dx = p.x - sx;
    const dy = p.y - sy;
    const vw = window.innerWidth, vh = window.innerHeight;
    const fr = fab.getBoundingClientRect();
    const w = fr.width, h = fr.height;
    let nx = clamp(ox + dx, 6, vw - w - 6);
    let ny = clamp(oy + dy, 6, vh - h - 6);
    fab.style.position = 'fixed';
    fab.style.left = nx + 'px';
    fab.style.top  = ny + 'px';
    fab.style.right = 'auto'; fab.style.bottom = 'auto';
  };
  const end = ()=>{
    if(!dragging) return;
    dragging = false;
    fab.classList.remove('dragging');
    const fr = fab.getBoundingClientRect();
    localStorage.setItem(k, JSON.stringify({x: fr.left, y: fr.top}));
  };

  fab.addEventListener('mousedown', start, {passive:false});
  window.addEventListener('mousemove', move, {passive:false});
  window.addEventListener('mouseup', end, {passive:false});

  fab.addEventListener('touchstart', start, {passive:false});
  window.addEventListener('touchmove', move, {passive:false});
  window.addEventListener('touchend', end, {passive:false});
  window.addEventListener('touchcancel', end, {passive:false});

  function pointer(e){
    if(e.touches && e.touches[0]) return {x:e.touches[0].clientX, y:e.touches[0].clientY};
    return {x:e.clientX, y:e.clientY};
  }
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
}
/* =======================
   NUBE: Firestore Sync
======================= */

// 🧩 Configura tus claves aquí
const FIREBASE_CFG = {
  apiKey:        "TU_API_KEY",
  authDomain:    "TU_AUTH_DOMAIN",
  projectId:     "TU_PROJECT_ID",
  storageBucket: "TU_BUCKET",
  messagingSenderId: "TU_SENDER_ID",
  appId:         "TU_APP_ID",
};

// Estado de la nube
let FB = {
  app: null,
  db: null,
  docRef: null,
  ready: false,
  unsub: null,
  lastRemoteStamp: 0,
  saving: false,
};

// Documento compartido (público) donde el admin publica el “estado”
const CLOUD_DOC_PATH = 'public/state';

// Throttle/debounce para no saturar
let _saveTimer=null;
function remoteSaveDebounced(ms=600){
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(()=>remoteSave().catch(console.error), ms);
}

// Tarjeta en Admin para mostrar estado de la nube
function ensureCloudCard(){
  const row = $('#adminQuickRow');
  if(!row || $('#cloudCard')) return;
  const card = document.createElement('div');
  card.className='card mini';
  card.id='cloudCard';
  card.innerHTML = `
    <h3>Nube</h3>
    <div class="row wrap">
      <button id="cloudConnect" class="btn">Conectar</button>
      <button id="cloudSave" class="btn">Forzar guardado</button>
      <span id="cloudStat" class="muted">Desconectado</span>
    </div>`;
  row.appendChild(card);

  $('#cloudConnect').onclick = async ()=>{
    await remoteInit();
    await remoteLoadOnce();
    remoteSubscribe();
    toast('Conectado a la nube');
  };
  $('#cloudSave').onclick = async ()=>{
    await remoteSave();
    toast('Guardado remoto enviado');
  };
  updateCloudBadge();
}
function updateCloudBadge(text){
  const el = $('#cloudStat');
  if(!el) return;
  if(text){ el.textContent = text; return; }
  el.textContent = FB.ready ? 'Conectado' : 'Desconectado';
}

/* ===== Inicializar Firebase ===== */
async function remoteInit(){
  if(FB.ready) return;
  if(!FIREBASE_CFG.projectId || FIREBASE_CFG.projectId==='TU_PROJECT_ID'){
    console.warn('[NUBE] Config Firebase pendiente.');
    return;
  }
  // Importa SDK modular desde CDN
  const [{ initializeApp }, { getFirestore, doc, getDoc, setDoc, onSnapshot, serverTimestamp }] =
    await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'),
    ]);

  FB.initializeApp = initializeApp;
  FB.getFirestore = getFirestore;
  FB.doc = doc; FB.getDoc = getDoc; FB.setDoc = setDoc; FB.onSnapshot = onSnapshot; FB.serverTimestamp = serverTimestamp;

  FB.app = initializeApp(FIREBASE_CFG);
  FB.db  = getFirestore(FB.app);
  FB.docRef = doc(FB.db, CLOUD_DOC_PATH);

  FB.ready = true;
  updateCloudBadge();
}

/* ===== Empaquetar / Desempaquetar estado público ===== */
function packState(){
  // Solo lo que es público / necesario para el cliente
  return {
    stamp: Date.now(),
    tax: ST.tax,
    hero: ST.hero,
    productos: ST.productos,
    proyectos: ST.proyectos,
    // puedes agregar más campos públicos si hace falta
  };
}
function unpackState(data){
  // Merge NO destructivo (admin local gana si es más nuevo)
  if(!data) return;
  const remoteStamp = Number(data.stamp||0);
  if(remoteStamp <= FB.lastRemoteStamp) return; // ya aplicado
  FB.lastRemoteStamp = remoteStamp;

  // Aplicar al estado local
  if(Array.isArray(data.hero))       { ST.hero = data.hero;       LS.set('hero', ST.hero); }
  if(Array.isArray(data.productos))  { ST.productos = data.productos; LS.set('productos', ST.productos); }
  if(Array.isArray(data.proyectos))  { ST.proyectos = data.proyectos; LS.set('proyectos', ST.proyectos); }
  if(Number.isFinite(data.tax))      { ST.tax = Number(data.tax); LS.set('taxRate', ST.tax); }

  // Refrescar vistas
  renderHero(); renderHeroAdmin?.();
  renderProductosCliente(); renderProductosAdmin?.();
  renderProyectosCliente(); renderProyectosAdmin?.();
  updateTotals();
}

/* ===== Cargar una vez (al inicio) ===== */
async function remoteLoadOnce(){
  try{
    if(!FB.ready) await remoteInit();
    if(!FB.ready) return;
    const snap = await FB.getDoc(FB.docRef);
    if(snap.exists()){
      unpackState(snap.data());
      updateCloudBadge('Cargado');
    }else{
      // Si no existe, crearlo con el estado actual local (solo si admin)
      if(ST.authed){
        await remoteSave();
      }
    }
  }catch(e){
    console.warn('[NUBE] loadOnce error', e);
    updateCloudBadge('Error de carga');
  }
}

/* ===== Guardar (publicar) ===== */
async function remoteSave(){
  if(!FB.ready){ await remoteInit(); }
  if(!FB.ready) return;

  try{
    FB.saving = true; updateCloudBadge('Guardando…');
    const payload = packState();
    await FB.setDoc(FB.docRef, payload, { merge: true });
    FB.lastRemoteStamp = payload.stamp;
    updateCloudBadge('Guardado');
  }catch(e){
    console.error('[NUBE] save error', e);
    updateCloudBadge('Error al guardar');
  }finally{
    FB.saving = false;
    setTimeout(()=>updateCloudBadge(),600);
  }
}

/* ===== Suscribirse a cambios (tiempo real) ===== */
function remoteSubscribe(){
  if(!FB.ready || FB.unsub) return;
  FB.unsub = FB.onSnapshot(FB.docRef, (snap)=>{
    if(!snap.exists()) return;
    const data = snap.data();
    // Evitar aplicar inmediatamente después de guardar propio
    if(FB.saving) return;
    unpackState(data);
    updateCloudBadge('Actualizado');
  }, (err)=>{
    console.warn('[NUBE] snapshot error', err);
    updateCloudBadge('Sin escucha');
  });
}

// ===== FIN IIFE =====
})();
