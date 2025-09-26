(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const LS={get:(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}, set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};
  const cur = n => (Number(n)||0).toFixed(2);

  const ST = {
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

  function init(){
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
  }

  /* ===== Fondo Canvas decorativo ===== */
  function bgAnimate(){
    const c = $('#bg'); const g = c.getContext('2d'); let t=0; resize();
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

  /* ===== Navegación entre vistas ===== */
  function setupTabbar(){
    $$('.tabbar button').forEach(b=> b.addEventListener('click',()=>goView(b.dataset.go)) );
  }
  function goView(id){
    if(id==='admin'){ $('#view-admin').classList.add('show'); }
    $$('.tabbar button').forEach(b=>b.classList.toggle('active', b.dataset.go===id));
    $$('.view').forEach(v=>v.classList.remove('show'));
    $('#view-'+id).classList.add('show');
    window.scrollTo({top:0,behavior:'smooth'});
  }

  /* ===== Admin ===== */
  function setupAdmin(){
    $('#btnLogin').onclick=()=>{ goView('admin'); };
    $('#adminEnter').onclick=()=>login($('#adminPass').value.trim());
    $('#taxSave').onclick=()=>{ ST.tax = Number($('#taxInput').value||0); LS.set('taxRate', ST.tax); updateTotals(); alert('Sales Tax guardado'); };
    $('#passSave').onclick=()=>{ const np=$('#passNew').value.trim(); if(np.length<3) return alert('Min 3 caracteres'); ST.adminPass=np; LS.set('adminPass',np); alert('Contraseña actualizada'); };

    $('#clearVentas').onclick=()=>{ if(confirm('¿Eliminar ventas?')){ ST.ventas=[]; LS.set('ventas',[]); pintarVentas(); pintarClientes(); } };
    $('#clearClientes').onclick=()=>{ if(confirm('¿Eliminar clientes (incluye directorio)?')){ ST.clientes=[]; LS.set('clientes',[]); pintarClientes(); pintarClientesDir(); renderClientesSel(); } };
    $('#clearPres').onclick=()=>{ if(confirm('¿Eliminar presupuestos?')){ ST.presupuestos=[]; LS.set('presupuestos',[]); pintarPres(); } };

    $('#importHero').onchange = (e)=> filesToDataURL(e.target.files).then(imgs=>{ ST.hero.push(...imgs); LS.set('hero', ST.hero); renderHero(); renderHeroAdmin(); });
    $('#clearHero').onclick = ()=>{ if(confirm('¿Vaciar todas las imágenes del Muro?')){ ST.hero=[]; LS.set('hero', ST.hero); renderHero(); renderHeroAdmin(); } };

    if(ST.authed){ openPanel(); }
  }
  function login(p){
    if(p===ST.adminPass){
      ST.authed=true; sessionStorage.setItem('st_admin_ok','1'); openPanel(); alert('Acceso concedido ✅');
    } else alert('Contraseña incorrecta');
  }
  function openPanel(){
    $('#adminGate').classList.add('hidden');
    $('#adminPanel').classList.remove('hidden');
    $('#taxInput').value = ST.tax;
    $('#tabAdmin').classList.remove('hidden');

    renderHeroAdmin();
    renderProductosAdmin();
    renderProyectosAdmin();
    pintarVentas();
    pintarClientes();
    pintarClientesDir();
    pintarPres();
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
    const cont = $('#heroSlider');
    cont.innerHTML = ST.hero
      .map((src,i)=>`<img class="hslide${i===0?' active':''}" data-ix="${i}" src="${src}" alt="Muro ${i+1}">`)
      .join('');
    // Fallback seguro
    $('#heroSlider').querySelectorAll('img').forEach(img=> safeImg(img));

    const dots = $('#heroDots');
    dots.innerHTML = ST.hero
      .map((_,i)=>`<button class="seg${i===0?' active':''}" data-goto="${i}" aria-label="Ir a imagen ${i+1}"></button>`)
      .join('');
    dots.querySelectorAll('[data-goto]').forEach(b=> b.onclick = ()=>showSlide(Number(b.dataset.goto), true));
  }
  let timerHero=null;
  function setupHeroNav(){
    $('#hPrev').onclick=()=>{ showSlide(ST.slideIdx-1, true); };
    $('#hNext').onclick=()=>{ showSlide(ST.slideIdx+1, true); };
    autoHero();
  }
  function autoHero(){
    clearInterval(timerHero);
    timerHero=setInterval(()=>showSlide(ST.slideIdx+1,false), 7000);
  }
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
        <img src="${src}" alt="">
        <button class="chip danger" data-delh="${ix}">Eliminar</button>
      </div>
    `).join('') || `<div class="muted">Sin imágenes aún</div>`;
    g.querySelectorAll('img').forEach(img=> safeImg(img));
    g.querySelectorAll('[data-delh]').forEach(b=> b.onclick=()=>{ ST.hero.splice(Number(b.dataset.delh),1); LS.set('hero', ST.hero); renderHero(); renderHeroAdmin(); });
    enableThumbDnD(g);
  }
  function enableThumbDnD(container){
    let dragIx=null;
    container.querySelectorAll('.thumb').forEach(el=>{
      el.addEventListener('dragstart', e=>{ dragIx = Number(el.dataset.ix); el.classList.add('dragging'); });
      el.addEventListener('dragend',   e=>{ el.classList.remove('dragging'); });
      el.addEventListener('dragover',  e=>{ e.preventDefault(); el.style.outline='2px dashed var(--brand)'; });
      el.addEventListener('dragleave', e=>{ el.style.outline=''; });
      el.addEventListener('drop',      e=>{
        e.preventDefault(); el.style.outline='';
        const dropIx = Number(el.dataset.ix);
        if(!Number.isInteger(dragIx) || !Number.isInteger(dropIx) || dragIx===dropIx) return;
        const arr = ST.hero.slice();
        const [moved] = arr.splice(dragIx,1);
        arr.splice(dropIx,0,moved);
        ST.hero = arr;
        LS.set('hero', ST.hero);
        renderHero(); renderHeroAdmin();
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
      // Migración suave: asegura la propiedad 'vendido' en productos existentes
      ST.productos = ST.productos.map(p=>({vendido:false, ...p}));
    }
    LS.set('productos', ST.productos);
    renderProductosCliente();
    $('#addProducto').onclick=()=>openFormProducto();
    $('#importProductos').onchange=(e)=>bulkImportProductos(e.target.files);
  }
  function cardProdCliente(p){
    const img=p.imgs?.[0] || 'venta/1.jpg';
    const sold = p.vendido===true;
    return `<article class="item ${sold?'vendido':''}">
      <div class="img">
        ${sold?'<div class="badge-vendido">VENDIDO</div>':''}
        <img src="${img}" alt="${esc(p.nombre)}">
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
    const grid=$('#gridProductos'); 
    grid.innerHTML=ST.productos.map(p=>cardProdCliente(p)).join('');
    grid.querySelectorAll('img').forEach(img=> safeImg(img));
    grid.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>addCart(b.dataset.add));
    grid.querySelectorAll('[data-lb]').forEach(b=>{ b.onclick=()=>openLB( ST.productos.find(x=>x.id===b.dataset.lb)?.imgs || [], 0 ); });
  }
  function renderProductosAdmin(){
    const grid=$('#gridProductosAdmin'); if(!grid) return;
    grid.innerHTML = ST.productos.map(p=>cardProdAdmin(p)).join('');
    grid.querySelectorAll('img').forEach(img=> safeImg(img));
    grid.querySelectorAll('[data-addimg]').forEach(inp=> inp.onchange = (e)=> filesToDataURL(e.target.files).then(imgs=>{ addImgsProducto(inp.dataset.addimg, imgs); }));
    grid.querySelectorAll('[data-delimg]').forEach(btn=> btn.onclick = ()=> delImgProducto(btn.dataset.delimg, Number(btn.dataset.idx)));
    grid.querySelectorAll('[data-delprod]').forEach(btn=> btn.onclick = ()=> delProducto(btn.dataset.delprod));
    grid.querySelectorAll('[data-view]').forEach(btn=> btn.onclick = ()=> openLB(ST.productos.find(x=>x.id===btn.dataset.view)?.imgs||[],0));
    // Toggle vendido (admin)
    grid.querySelectorAll('[data-togglevend]').forEach(btn=> btn.onclick = ()=> toggleVendido(btn.dataset.togglevend));
  }
  function cardProdAdmin(p){
    const thumbs = (p.imgs||[]).map((src,ix)=>`
      <div class="thumb"><img src="${src}" alt=""><button class="chip danger" data-delimg="${p.id}" data-idx="${ix}">Eliminar</button></div>`).join('') || `<div class="muted">Sin imágenes aún</div>`;
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
    renderProductosCliente();
    renderProductosAdmin();
  }
  function openFormProducto(){
    openModal('Nuevo producto', `
      <form id="fProd" class="form">
        <div class="row wrap">
          <input class="input" id="pNombre" placeholder="Nombre" required>
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
    };
  }
  function bulkImportProductos(files){
    if(!files?.length) return;
    filesToDataURL(files).then(imgs=>{
      imgs.forEach((src,i)=> ST.productos.push({id:u(), nombre:'Imagen '+(i+1), precio:Math.round(Math.random()*90+10), imgs:[src], vendido:false}));
      LS.set('productos', ST.productos);
      renderProductosCliente(); renderProductosAdmin();
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
    $('#addProyecto').onclick=()=>openFormProyecto();
    $('#importProyectos').onchange=(e)=>bulkImportProyectos(e.target.files);
  }
  function cardProyectoCliente(p){
    const img=p.imgs?.[0] || 'proyect1/1.jpg';
    return `<article class="item"><div class="img"><img src="${img}" alt="${esc(p.titulo)}"></div><div class="body"><h3 class="title">${esc(p.titulo)}</h3><p class="muted">${esc(p.desc||'')}</p><div class="row"><button class="btn ghost" data-view="${p.id}">Ver</button></div></div></article>`;
  }
  function renderProyectosCliente(){
    const g=$('#gridProyectos'); g.innerHTML = ST.proyectos.map(p=>cardProyectoCliente(p)).join('');
    g.querySelectorAll('img').forEach(img=> safeImg(img));
    g.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>openLB( ST.proyectos.find(x=>x.id===b.dataset.view)?.imgs || [], 0 ));
  }
  function renderProyectosAdmin(){
    const grid=$('#gridProyectosAdmin'); if(!grid) return;
    grid.innerHTML = ST.proyectos.map(p=>cardProyectoAdmin(p)).join('');
    grid.querySelectorAll('img').forEach(img=> safeImg(img));
    grid.querySelectorAll('[data-addimgp]').forEach(inp=> inp.onchange = (e)=> filesToDataURL(e.target.files).then(imgs=>{ addImgsProyecto(inp.dataset.addimgp, imgs); }));
    grid.querySelectorAll('[data-delimgp]').forEach(btn=> btn.onclick = ()=> delImgProyecto(btn.dataset.delimgp, Number(btn.dataset.idx)));
    grid.querySelectorAll('[data-delproj]').forEach(btn=> btn.onclick = ()=> delProyecto(btn.dataset.delproj));
    grid.querySelectorAll('[data-viewp]').forEach(btn=> btn.onclick = ()=> openLB(ST.proyectos.find(x=>x.id===btn.dataset.viewp)?.imgs||[],0));
  }
  function cardProyectoAdmin(p){
    const thumbs = (p.imgs||[]).map((src,ix)=>`
      <div class="thumb"><img src="${src}" alt=""><button class="chip danger" data-delimgp="${p.id}" data-idx="${ix}">Eliminar</button></div>`).join('') || `<div class="muted">Sin imágenes aún</div>`;
    return `
      <article class="card">
        <div class="row wrap" style="justify-content:space-between;align-items:center">
          <strong>${esc(p.titulo)}</strong>
          <button class="chip" data-viewp="${p.id}">Ver galería</button>
        </div>
        <div class="thumbs">${thumbs}</div>
        <div class="row wrap" style="margin-top:8px">
          <label class="btn ghost">➕ Añadir desde teléfono
            <input type="file" accept="image/*" multiple hidden data-addimgp="${p.id}">
          </label>
          <button class="btn danger" data-delproj="${p.id}">Eliminar proyecto</button>
        </div>
      </article>`;
  }
  function openFormProyecto(){
    openModal('Nuevo proyecto', `
      <form id="fProj" class="form">
        <div class="row wrap">
          <input class="input" id="jTitulo" placeholder="Título" required>
          <input class="input" id="jDesc" placeholder="Descripción">
        </div>
        <label class="btn ghost" style="display:inline-flex;gap:8px;align-items:center">📷 Imágenes
          <input id="jImgs" type="file" accept="image/*" multiple hidden>
        </label>
        <div class="row" style="margin-top:10px"><button class="btn primary" type="submit">Guardar</button></div>
      </form>
    `);
    $('#fProj').onsubmit = async (e)=>{
      e.preventDefault();
      const titulo=$('#jTitulo').value.trim(); const desc=$('#jDesc').value.trim();
      const imgs = await filesToDataURL($('#jImgs').files);
      ST.proyectos.push({id:u(), titulo, desc, imgs}); LS.set('proyectos', ST.proyectos);
      closeModal(); renderProyectosCliente(); renderProyectosAdmin();
    };
  }
  function bulkImportProyectos(files){
    if(!files?.length) return;
    filesToDataURL(files).then(imgs=>{
      ST.proyectos.push({id:u(), titulo:'Proyecto nuevo', desc:'', imgs});
      LS.set('proyectos', ST.proyectos); renderProyectosCliente(); renderProyectosAdmin();
    });
  }
  function addImgsProyecto(id, imgs){ const p = ST.proyectos.find(x=>x.id===id); if(!p) return; p.imgs = [...(p.imgs||[]), ...imgs]; LS.set('proyectos', ST.proyectos); renderProyectosCliente(); renderProyectosAdmin(); }
  function delImgProyecto(id, idx){ const p = ST.proyectos.find(x=>x.id===id); if(!p) return; p.imgs.splice(idx,1); LS.set('proyectos', ST.proyectos); renderProyectosCliente(); renderProyectosAdmin(); }
  function delProyecto(id){ if(!confirm('¿Eliminar proyecto completo?')) return; ST.proyectos = ST.proyectos.filter(x=>x.id!==id); LS.set('proyectos', ST.proyectos); renderProyectosCliente(); renderProyectosAdmin(); }

  /* ===== Carrito ===== */
  function initCarrito(){
    renderClientesSel(); renderCarrito();
    $('#btnAddCliente').onclick=()=>openFormCliente(true);
    $('#metodoPago').onchange=()=>{ const v=$('#metodoPago').value; $('#montoEfectivo').classList.toggle('hidden', v!=='efectivo'); $('#qrBox').classList.toggle('hidden', v!=='zelle'); };
    $('#btnPagar').onclick= pagar;
  }
  function renderClientesSel(){
    if(!ST.clientes.length){
      ST.clientes=[{id:'general',nombre:'Cliente General',email:'',empresa:'',telefono:'',compras:0,total:0,ultima:'',createdAt:''}];
      LS.set('clientes',ST.clientes);
    }
    const sel=$('#clienteSel');
    sel.innerHTML=`<option value="general">— Regístrate para comprar —</option>` + ST.clientes.filter(c=>c.id!=='general').map(c=>`<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
  }
  function openFormCliente(required=false){
    openModal(required?'Registro de cliente (requerido)':'Nuevo cliente', `
      <form id="fCli" class="form">
        <div class="row wrap">
          <input class="input" id="cNombre" placeholder="Nombre *" required>
          <input class="input" id="cTel" placeholder="Teléfono *" required>
        </div>
        <div class="row wrap">
          <input class="input" id="cEmpresa" placeholder="Empresa (opcional)">
          <input class="input" id="cEmail" type="email" placeholder="Correo (opcional)">
        </div>
        <div class="row" style="margin-top:10px"><button class="btn primary" type="submit">Guardar</button></div>
      </form>
    `);
    $('#fCli').onsubmit=(e)=>{
      e.preventDefault();
      const c={id:u(), nombre:$('#cNombre').value.trim(), telefono:$('#cTel').value.trim(), empresa:$('#cEmpresa').value.trim(), email:$('#cEmail').value.trim(), compras:0,total:0,ultima:'', createdAt:new Date().toLocaleString()};
      if(!c.nombre || !c.telefono) return alert('Nombre y teléfono son obligatorios');
      ST.clientes.push(c); LS.set('clientes',ST.clientes);
      renderClientesSel(); $('#clienteSel').value=c.id; pintarClientes(); pintarClientesDir(); closeModal();
    };
  }
  function addCart(id){
    const p=ST.productos.find(x=>x.id===id); if(!p) return;
    if(p.vendido){ alert('Este producto ya fue vendido'); return; }
    const it=ST.carrito.find(i=>i.id===id);
    const img = p.imgs?.[0] || 'venta/1.jpg';
    if(it) it.cant+=1; else ST.carrito.push({id:p.id,nombre:p.nombre,precio:p.precio,cant:1,img});
    LS.set('carrito', ST.carrito); renderCarrito();
  }
  function renderCarrito(){
    const ul=$('#listaCarrito');
    ul.innerHTML=ST.carrito.map((i,k)=>`
      <li>
        <div class="left">
          <img class="thumb-cart" src="${i.img||'venta/1.jpg'}" alt="">
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

  function pagar(){
    if(!ST.carrito.length) return alert('Carrito vacío');
    const cliId=$('#clienteSel').value;
    const cli=ST.clientes.find(c=>c.id===cliId);
    if(!cli || cli.id==='general' || !cli.telefono){
      alert('Para comprar debes registrarte con Nombre y Teléfono.');
      return openFormCliente(true);
    }
    const metodo=$('#metodoPago').value; if(!metodo) return alert('Selecciona método');
    const sub=Number($('#subTxt').textContent), imp=Number($('#taxTxt').textContent), tot=Number($('#totTxt').textContent);
    if(metodo==='efectivo'){ const ent=Number($('#montoEfectivo').value||0); if(ent<tot) return alert('Efectivo insuficiente'); }

    // Registrar venta
    const venta={ id:'V'+String(ST.folio).padStart(5,'0'), fecha:new Date().toLocaleString(), cliente:cli.nombre, items:ST.carrito.map(i=>({n:i.nombre,c:i.c,p:i.precio,id:i.id})), subtotal:sub, impuesto:imp, total:tot, metodo };
    ST.ventas.unshift(venta); ST.folio++; LS.set('ventas',ST.ventas); LS.set('folio',ST.folio);

    // Actualizar resumen cliente
    cli.compras=(cli.compras||0)+1; cli.total=Number(cli.total||0)+tot; cli.ultima=venta.fecha; LS.set('clientes',ST.clientes);

    // ===== Marcar productos como vendidos =====
    venta.items.forEach(it=>{
      const p = ST.productos.find(x=>x.id===it.id);
      if(p) p.vendido = true;
    });
    LS.set('productos', ST.productos);

    // Limpiar carrito y refrescar vistas
    ST.carrito=[]; LS.set('carrito',ST.carrito); renderCarrito();
    pintarRecibo(venta); pintarVentas(); pintarClientes(); pintarClientesDir();
    renderProductosCliente(); renderProductosAdmin();
  }

  /* ===== Recibo ===== */
  function pintarRecibo(v){
    const box=$('#reciboBox'); box.classList.remove('hidden');
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
            <tr><td colspan="3" style="text-align:right">Método</td><td>${v.metodo}</td></tr>
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

  /* ===== Recibo bonito (canvas → PNG, imprimir sólo recibo) ===== */
  async function reciboPrettyPrint(v){
    const fmtSel = $('#receiptFormat')?.value || 'a5';
    let W, H, pageCSS;
    if(fmtSel==='a4'){ W=1654; H=2339; pageCSS='@page { size: A4 portrait; margin: 10mm; }'; }
    else if(fmtSel==='ticket80'){
      W=640; const base=480, per=64; H = base + v.items.length*per + 320;
      pageCSS='@page { size: 80mm auto; margin: 5mm; } body{background:#0f1420;}';
    } else { W=1200; H=1700; pageCSS='@page { size: A5 portrait; margin: 10mm; }'; }

    const c=document.createElement('canvas'); c.width=W; c.height=H; const ctx=c.getContext('2d');
    ctx.fillStyle='#0f1420'; ctx.fillRect(0,0,W,H);

    const isTicket = fmtSel==='ticket80';
    const pad = isTicket ? 28 : Math.round(W*0.05);
    const cardR = isTicket ? 16 : 24;
    const cardW = W - pad*2;
    const cardH = H - pad*2;

    roundRect(ctx, pad, pad, cardW, cardH, cardR, '#0b111d', true, '#223352');

    const logo = await loadImage('logoklem.png'); // si falla, seguimos
    const logoSize = isTicket ? 80 : Math.round(W*0.08);
    if(logo) ctx.drawImage(logo, pad+40, pad+40, logoSize, logoSize);

    ctx.fillStyle='#e8eef8';
    ctx.font= (isTicket?'bold 26px Inter':'bold 42px Inter');
    ctx.fillText('Stradivaryus Tools', pad+40+logoSize+20, pad+40+Math.round(logoSize*0.6));
    ctx.font= (isTicket?'16px Inter':'20px Inter'); ctx.fillStyle='#a7b3c9';
    ctx.fillText('Recibo de compra', pad+40+logoSize+20, pad+40+Math.round(logoSize*0.6)+ (isTicket?22:35));

    ctx.fillStyle='#e8eef8'; ctx.font=(isTicket?'15px Inter':'18px Inter');
    let baseY = pad + logoSize + (isTicket?80:120);
    ctx.fillText(`Número: ${v.id}`, pad+40, baseY);
    ctx.fillText(`Fecha: ${v.fecha}`, pad+40, baseY+(isTicket?24:30));
    ctx.fillText(`Cliente: ${v.cliente}`, pad+40, baseY+(isTicket?48:60));

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

    y += (isTicket?14:18); line(ctx, pad+30, y, W-(pad+30), y, '#1a2440'); y += (isTicket?22:26);
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

    y += (isTicket?6:10); line(ctx, pad+30, y, W-(pad+30), y, '#1a2440'); 
    y += (isTicket?20:30); ctx.font=(isTicket?'15px Inter':'18px Inter');
    ctx.fillText(`Subtotal: $${cur(v.subtotal)}`, colPrecioX, y); y+= (isTicket?18:26);
    ctx.fillText(`Impuesto: $${cur(v.impuesto)}`, colPrecioX, y); y+= (isTicket?20:28);
    ctx.font=(isTicket?'bold 18px Inter':'bold 22px Inter'); ctx.fillText(`Total: $${cur(v.total)}`, colPrecioX, y);

    const dataURL = c.toDataURL('image/png');
    const blob = dataURLtoBlob(dataURL);
    const shared = await shareFile(`Recibo_${v.id}.png`, blob, 'image/png');
    if(!shared){ download(`Recibo_${v.id}.png`, blob, 'image/png'); }

    const url = URL.createObjectURL(blob);
    openPrintWindowWithImage(url, (fmtSel==='ticket80')?'@page { size: 80mm auto; margin: 5mm; } body{background:#0f1420;}': (fmtSel==='a4')?'@page { size: A4 portrait; margin: 10mm; }':'@page { size: A5 portrait; margin: 10mm; }');
  }
  function openPrintWindowWithImage(imgURL, pageCSS){
    const w = window.open('', '_blank');
    if(!w){
      alert('Se guardó el archivo. Para imprimir, habilita ventanas emergentes o abre el archivo desde tu galería/descargas.');
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

  /* ===== Presupuesto ADMIN ===== */
  function initPresupuestoAdmin(){
    const tBody = $('#presTable tbody');
    $('#rowAdd').onclick=()=>rowAdd(tBody, '#presTotal');
    $('#presCSV').onclick=()=>presCSV('#presTable','#presTotal');
    $('#presPDF').onclick=()=>presPDF('#presCliente','#presProyecto','#presTable','#presTotal', true, $('#presFormat')?.value||'a4');
    if(!tBody.children.length) rowAdd(tBody, '#presTotal');
  }
  function rowAdd(tBody, totalSel){
    const tr=document.createElement('tr');
    tr.innerHTML=`<td><input class="input" placeholder="Material"></td><td><input class="input" type="number" min="0" step="1" value="1"></td><td><input class="input" type="number" min="0" step="0.01" value="0.00"></td><td class="sub">$0.00</td><td><button class="chip danger">✕</button></td>`;
    tBody.appendChild(tr);
    const [m,c,p]= $$('input',tr); [c,p].forEach(i=>i.addEventListener('input',()=>calcPres(tBody,totalSel)));
    tr.querySelector('button').onclick=()=>{ tr.remove(); calcPres(tBody,totalSel); };
    calcPres(tBody,totalSel);
  }
  function calcPres(tBody, totalSel){
    let total=0; [...tBody.children].forEach(tr=>{ const [m,c,p]=$$('input',tr); const sub=(Number(c.value)||0)*(Number(p.value)||0); tr.querySelector('.sub').textContent='$'+cur(sub); total+=sub; });
    $(totalSel).textContent='$'+cur(total);
  }
  function buildRows(tableSel){
    return $$(tableSel+' tbody tr').map(tr=>{ const [m,c,p]=$$('input',tr); const sub=(Number(c.value)||0)*(Number(p.value)||0); return [m.value,c.value,'$'+cur(p.value), '$'+cur(sub)]; });
  }
  function presCSV(tableSel,totalSel){
    const rows = buildRows(tableSel);
    const total = rows.reduce((a,r)=>a+Number(String(r[3]).replace(/[^0-9.]/g,'')),0);
    const csv = [['Material','Cantidad','Precio','Subtotal'],...rows,['','','Total',cur(total)]].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    download('presupuesto.csv', csv, 'text/csv');
  }

  /* ===== Robustez PDF ===== */
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

  // ==== PDF elegante + guardar/compartir + imprimir (solo admin)
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

  /* ===== Contable ===== */
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
        <td>${v.metodo}</td>
        <td><button class="chip" data-print="${ix}">🖨️</button></td>
        <td><button class="chip danger" data-delv="${ix}">✕</button></td>
      </tr>`).join('');
    tb.querySelectorAll('[data-delv]').forEach(b=> b.onclick=()=>{ ST.ventas.splice(Number(b.dataset.delv),1); LS.set('ventas',ST.ventas); pintarVentas(); });
    tb.querySelectorAll('[data-print]').forEach(b=> b.onclick=()=>{ const v = ST.ventas[Number(b.dataset.print)]; if(v) reciboPrettyPrint(v); });
  }
  function pintarClientes(){
    const tb=$('#tbClientes'); if(!tb) return;
    tb.innerHTML = ST.clientes.filter(c=>c.id!=='general').map((c,ix)=>`
      <tr>
        <td>${esc(c.nombre)}</td><td>${c.compras||0}</td><td>$${cur(c.total||0)}</td><td>${c.ultima||''}</td>
        <td><button class="chip danger" data-delc="${ix}">✕</button></td>
      </tr>`).join('');
    tb.querySelectorAll('[data-delc]').forEach(b=> b.onclick=()=>{ ST.clientes.splice(Number(b.dataset.delc)+1,1); LS.set('clientes',ST.clientes); pintarClientes(); pintarClientesDir(); renderClientesSel(); });
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
    tb.querySelectorAll('[data-delcd]').forEach(b=> b.onclick=()=>{ ST.clientes.splice(Number(b.dataset.delcd)+1,1); LS.set('clientes',ST.clientes); pintarClientesDir(); pintarClientes(); renderClientesSel(); });
  }
  function pintarPres(){
    const tb=$('#tbPres'); if(!tb) return;
    tb.innerHTML = ST.presupuestos.map((p,ix)=>`
      <tr>
        <td>${p.fecha}</td><td>${esc(p.cliente||'-')}</td><td>${esc(p.proyecto||'-')}</td><td>$${cur(p.monto||0)}</td>
        <td><button class="chip" data-printp="${ix}">🖨️</button></td>
        <td><button class="chip danger" data-delp="${ix}">✕</button></td>
      </tr>`).join('');
    tb.querySelectorAll('[data-delp]').forEach(b=> b.onclick=()=>{ ST.presupuestos.splice(Number(b.dataset.delp),1); LS.set('presupuestos',ST.presupuestos); pintarPres(); });
    tb.querySelectorAll('[data-printp]').forEach(b=> b.onclick=()=> presReprint(Number(b.dataset.printp)));
  }
  async function presReprint(ix){
    const p = ST.presupuestos[ix];
    if(!p){ return; }
    if(!p.rows || !p.rows.length){
      alert('Este presupuesto no tiene detalle guardado (fue generado antes). Crea uno nuevo para habilitar reimpresión.');
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

  /* ===== Lightbox ===== */
  function lightboxInit(){
    $('#lbClose').onclick=closeLB; $('#lbPrev').onclick=()=>navLB(-1); $('#lbNext').onclick=()=>navLB(1);
    $('#zIn').onclick=()=>zoom(0.15); $('#zOut').onclick=()=>zoom(-0.15); $('#zReset').onclick=()=>{ST.lb.zoom=1;applyZoom()}; $('#openNew').onclick=()=>{ const s=$('#lbImg').src; if(s) open(s,'_blank'); };
    document.addEventListener('keydown',e=>{ if($('#lightbox').classList.contains('hidden')) return; if(e.key==='Escape') closeLB(); if(e.key==='ArrowLeft') navLB(-1); if(e.key==='ArrowRight') navLB(1); });
  }
  function openLB(list,start){ ST.lb.list=list; ST.lb.idx=start; ST.lb.zoom=1; $('#lbImg').src=list[start]||''; $('#lightbox').classList.remove('hidden'); applyZoom(); }
  function closeLB(){ $('#lightbox').classList.add('hidden'); }
  function navLB(d){ if(!ST.lb.list.length) return; ST.lb.idx=(ST.lb.idx+d+ST.lb.list.length)%ST.lb.list.length; $('#lbImg').src=ST.lb.list[ST.lb.idx]; ST.lb.zoom=1; applyZoom(); }
  function zoom(d){ ST.lb.zoom=Math.max(.4, Math.min(3, ST.lb.zoom+d)); applyZoom(); }
  function applyZoom(){ $('#lbImg').style.transform=`scale(${ST.lb.zoom})`; $('#lbImg').style.transformOrigin='center'; }

  /* ===== Tema ===== */
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
    $('#btnTheme').onclick = ()=>{
      const cur = localStorage.getItem("st_theme3") || 'auto';
      const next = cur==='auto' ? 'light' : cur==='light' ? 'dark' : 'auto';
      applyTheme(next);
    };
    updateThemeButton();
  }
  function updateThemeButton(){
    const t = localStorage.getItem("st_theme3") || 'auto';
    const btn = $('#btnTheme'); if(!btn) return;
    if(t==='auto'){ btn.textContent='🖥️'; btn.title='Tema automático'; }
    else if(t==='light'){ btn.textContent='🌙'; btn.title='Cambiar a oscuro'; }
    else { btn.textContent='🌞'; btn.title='Cambiar a claro'; }
  }

  /* ===== Compartir (móvil) ===== */
  async function shareFile(filename, blob, mime){
    try{
      if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: mime })] })) {
        await navigator.share({ title: "Stradivaryus Tools", text: filename, files: [new File([blob], filename, { type: mime })] });
        return true;
      }
    }catch(e){}
    return false;
  }

  /* ===== Modal ===== */
  function openModal(title, html){
    $('#modalTitle').textContent=title;
    $('#modalBody').innerHTML=html;
    $('#modal').classList.remove('hidden');
    $('#modalClose').onclick=closeModal;
    $('#modal').addEventListener('click',e=>{ if(e.target.id==='modal') closeModal(); }, {once:true});
  }
  function closeModal(){ $('#modal').classList.add('hidden'); }

  /* ===== Utils ===== */
  function esc(s=''){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function u(){return Math.random().toString(36).slice(2,9)}
  function download(name, data, mime='application/octet-stream'){ const blob = data instanceof Blob ? data : new Blob([data], {type:mime}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),3000); }
  function dataURLtoBlob(dataURL){ const parts=dataURL.split(','); const bstr=atob(parts[1]); let n=bstr.length; const u8=new Uint8Array(n); while(n--){u8[n]=bstr.charCodeAt(n)}; return new Blob([u8], {type: parts[0].split(':')[1].split(';')[0]}); }
  async function filesToDataURL(fileList){ if(!fileList || !fileList.length) return []; const arr = Array.from(fileList); const read = f => new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(f); }); return await Promise.all(arr.map(read)); }
  function loadImage(src){ return new Promise(r=>{ const img=new Image(); img.crossOrigin='anonymous'; img.onload=()=>r(img); img.onerror=()=>r(null); img.src=src; }); }
  async function imgToDataURL(src){ try{ const resp = await fetch(src, {mode:'cors'}); const blob = await resp.blob(); return await new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(blob); }); }catch{ return null; } }
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

  /* ===== Imagen segura (fallback) ===== */
  function safeImg(imgEl, placeholder='data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width=\"600\" height=\"400\"><rect width=\"100%\" height=\"100%\" fill=\"%230b1018\"/><text x=\"50%\" y=\"50%\" dominant-baseline=\"middle\" text-anchor=\"middle\" fill=\"%23a7b3c9\" font-family=\"Inter,Arial\" font-size=\"18\">Imagen no disponible</text></svg>'){
    if(!imgEl) return;
    imgEl.setAttribute('data-fallback','1');
    imgEl.onerror = ()=>{ if(imgEl.src!==placeholder) imgEl.src = placeholder; };
  }

  /* ===== FAB arrastrable ===== */
  function setupDraggableFab(){
    const fab = document.querySelector('.fab');
    if(!fab) return;

    const k = 'fab_pos_v1';
    // Restaurar posición guardada
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
(()=>{

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const LS={
    get:(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}},
    set:(k,v)=>{
      try{
        localStorage.setItem(k,JSON.stringify(v));
      }catch(e){
        console.error('LocalStorage error', e);
        alert('⚠️ Sin espacio para guardar imágenes en este navegador. Te recomiendo: 1) reducir el tamaño de las fotos, 2) eliminar algunas desde Admin, 3) importar menos a la vez.');
        throw e;
      }
    }
  };
  const cur = n => (Number(n)||0).toFixed(2);

  const ST = {
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

  function init(){
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
  }

  /* ===== Fondo Canvas decorativo ===== */
  function bgAnimate(){
    const c = $('#bg'); const g = c.getContext('2d'); let t=0; resize();
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

  /* ===== Navegación entre vistas ===== */
  function setupTabbar(){
    $$('.tabbar button').forEach(b=> b.addEventListener('click',()=>goView(b.dataset.go)) );
  }
  function goView(id){
    if(id==='admin'){ $('#view-admin').classList.add('show'); }
    $$('.tabbar button').forEach(b=>b.classList.toggle('active', b.dataset.go===id));
    $$('.view').forEach(v=>v.classList.remove('show'));
    $('#view-'+id).classList.add('show');
    window.scrollTo({top:0,behavior:'smooth'});
  }

  /* ===== Admin ===== */
  function setupAdmin(){
    $('#btnLogin').onclick=()=>{ goView('admin'); };
    $('#adminEnter').onclick=()=>login($('#adminPass').value.trim());
    $('#taxSave').onclick=()=>{ ST.tax = Number($('#taxInput').value||0); LS.set('taxRate', ST.tax); updateTotals(); alert('Sales Tax guardado'); };
    $('#passSave').onclick=()=>{ const np=$('#passNew').value.trim(); if(np.length<3) return alert('Min 3 caracteres'); ST.adminPass=np; LS.set('adminPass',np); alert('Contraseña actualizada'); };

    $('#clearVentas').onclick=()=>{ if(confirm('¿Eliminar ventas?')){ ST.ventas=[]; LS.set('ventas',[]); pintarVentas(); pintarClientes(); } };
    $('#clearClientes').onclick=()=>{ if(confirm('¿Eliminar clientes (incluye directorio)?')){ ST.clientes=[]; LS.set('clientes',[]); pintarClientes(); pintarClientesDir(); renderClientesSel(); } };
    $('#clearPres').onclick=()=>{ if(confirm('¿Eliminar presupuestos?')){ ST.presupuestos=[]; LS.set('presupuestos',[]); pintarPres(); } };

    // PATCH: importación robusta (comprimida)
    $('#importHero').onchange = async (e)=>{
      const imgs = await filesToDataURLCompressed(e.target.files);
      if(!imgs.length) return;
      ST.hero.push(...imgs); LS.set('hero', ST.hero); renderHero(); renderHeroAdmin();
      e.target.value='';
    };
    $('#clearHero').onclick = ()=>{ if(confirm('¿Vaciar todas las imágenes del Muro?')){ ST.hero=[]; LS.set('hero', ST.hero); renderHero(); renderHeroAdmin(); } };

    if(ST.authed){ openPanel(); }
  }
  function login(p){
    if(p===ST.adminPass){
      ST.authed=true; sessionStorage.setItem('st_admin_ok','1'); openPanel(); alert('Acceso concedido ✅');
    } else alert('Contraseña incorrecta');
  }
  function openPanel(){
    $('#adminGate').classList.add('hidden');
    $('#adminPanel').classList.remove('hidden');
    $('#taxInput').value = ST.tax;
    $('#tabAdmin').classList.remove('hidden');

    renderHeroAdmin();
    renderProductosAdmin();
    renderProyectosAdmin();
    pintarVentas();
    pintarClientes();
    pintarClientesDir();
    pintarPres();
  }

  /* ===== Hero / Muro ===== */
  function initHero(){
    if(!ST.hero.length){
      ST.hero = ['muro/1.jpg','muro/2.jpg','muro/3.jpg']; // rutas del repo (recuerda <base href="./">)
      LS.set('hero', ST.hero);
    }
    renderHero();
    setupHeroNav();
  }
  function renderHero(){
    const cont = $('#heroSlider');
    cont.innerHTML = ST.hero
      .map((src,i)=>`<img class="hslide${i===0?' active':''}" data-ix="${i}" src="${src}" alt="Muro ${i+1}">`)
      .join('');
    // Fallback seguro
    $('#heroSlider').querySelectorAll('img').forEach(img=> safeImg(img));

    const dots = $('#heroDots');
    dots.innerHTML = ST.hero
      .map((_,i)=>`<button class="seg${i===0?' active':''}" data-goto="${i}" aria-label="Ir a imagen ${i+1}"></button>`)
      .join('');
    dots.querySelectorAll('[data-goto]').forEach(b=> b.onclick = ()=>showSlide(Number(b.dataset.goto), true));
  }
  let timerHero=null;
  function setupHeroNav(){
    $('#hPrev').onclick=()=>{ showSlide(ST.slideIdx-1, true); };
    $('#hNext').onclick=()=>{ showSlide(ST.slideIdx+1, true); };
    autoHero();
  }
  function autoHero(){
    clearInterval(timerHero);
    timerHero=setInterval(()=>showSlide(ST.slideIdx+1,false), 7000);
  }
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
        <img src="${src}" alt="">
        <button class="chip danger" data-delh="${ix}">Eliminar</button>
      </div>
    `).join('') || `<div class="muted">Sin imágenes aún</div>`;
    g.querySelectorAll('img').forEach(img=> safeImg(img));
    g.querySelectorAll('[data-delh]').forEach(b=> b.onclick=()=>{ ST.hero.splice(Number(b.dataset.delh),1); LS.set('hero', ST.hero); renderHero(); renderHeroAdmin(); });
    enableThumbDnD(g);
  }
  function enableThumbDnD(container){
    let dragIx=null;
    container.querySelectorAll('.thumb').forEach(el=>{
      el.addEventListener('dragstart', e=>{ dragIx = Number(el.dataset.ix); el.classList.add('dragging'); });
      el.addEventListener('dragend',   e=>{ el.classList.remove('dragging'); });
      el.addEventListener('dragover',  e=>{ e.preventDefault(); el.style.outline='2px dashed var(--brand)'; });
      el.addEventListener('dragleave', e=>{ el.style.outline=''; });
      el.addEventListener('drop',      e=>{
        e.preventDefault(); el.style.outline='';
        const dropIx = Number(el.dataset.ix);
        if(!Number.isInteger(dragIx) || !Number.isInteger(dropIx) || dragIx===dropIx) return;
        const arr = ST.hero.slice();
        const [moved] = arr.splice(dragIx,1);
        arr.splice(dropIx,0,moved);
        ST.hero = arr;
        LS.set('hero', ST.hero);
        renderHero(); renderHeroAdmin();
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
      // Migración suave: asegura la propiedad 'vendido' en productos existentes
      ST.productos = ST.productos.map(p=>({vendido:false, ...p}));
    }
    LS.set('productos', ST.productos);
    renderProductosCliente();
    $('#addProducto').onclick=()=>openFormProducto();
    // PATCH: usa compresión en importación masiva
    $('#importProductos').onchange=async (e)=>{
      await bulkImportProductos(e.target.files);
      e.target.value='';
    };
  }
  function cardProdCliente(p){
    const img=p.imgs?.[0] || 'venta/1.jpg';
    const sold = p.vendido===true;
    return `<article class="item ${sold?'vendido':''}">
      <div class="img">
        ${sold?'<div class="badge-vendido">VENDIDO</div>':''}
        <img src="${img}" alt="${esc(p.nombre)}">
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
    const grid=$('#gridProductos'); 
    grid.innerHTML=ST.productos.map(p=>cardProdCliente(p)).join('');
    grid.querySelectorAll('img').forEach(img=> safeImg(img));
    grid.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>addCart(b.dataset.add));
    grid.querySelectorAll('[data-lb]').forEach(b=>{ b.onclick=()=>openLB( ST.productos.find(x=>x.id===b.dataset.lb)?.imgs || [], 0 ); });
  }
  function renderProductosAdmin(){
    const grid=$('#gridProductosAdmin'); if(!grid) return;
    grid.innerHTML = ST.productos.map(p=>cardProdAdmin(p)).join('');
    grid.querySelectorAll('img').forEach(img=> safeImg(img));
    grid.querySelectorAll('[data-addimg]').forEach(inp=> inp.onchange = async (e)=>{
      const imgs = await filesToDataURLCompressed(e.target.files);
      addImgsProducto(inp.dataset.addimg, imgs);
      e.target.value='';
    });
    grid.querySelectorAll('[data-delimg]').forEach(btn=> btn.onclick = ()=> delImgProducto(btn.dataset.delimg, Number(btn.dataset.idx)));
    grid.querySelectorAll('[data-delprod]').forEach(btn=> btn.onclick = ()=> delProducto(btn.dataset.delprod));
    grid.querySelectorAll('[data-view]').forEach(btn=> btn.onclick = ()=> openLB(ST.productos.find(x=>x.id===btn.dataset.view)?.imgs||[],0));
    // Toggle vendido (admin)
    grid.querySelectorAll('[data-togglevend]').forEach(btn=> btn.onclick = ()=> toggleVendido(btn.dataset.togglevend));
  }
  function cardProdAdmin(p){
    const thumbs = (p.imgs||[]).map((src,ix)=>`
      <div class="thumb"><img src="${src}" alt=""><button class="chip danger" data-delimg="${p.id}" data-idx="${ix}">Eliminar</button></div>`).join('') || `<div class="muted">Sin imágenes aún</div>`;
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
    renderProductosCliente();
    renderProductosAdmin();
  }
  function openFormProducto(){
    openModal('Nuevo producto', `
      <form id="fProd" class="form">
        <div class="row wrap">
          <input class="input" id="pNombre" placeholder="Nombre" required>
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
      const imgs = await filesToDataURLCompressed($('#pImgs').files);
      ST.productos.push({id:u(), nombre, precio, imgs, vendido:false});
      LS.set('productos', ST.productos);
      closeModal(); renderProductosCliente(); renderProductosAdmin();
    };
  }
  async function bulkImportProductos(files){
    if(!files?.length) return;
    const imgs = await filesToDataURLCompressed(files);
    imgs.forEach((src,i)=> ST.productos.push({id:u(), nombre:'Imagen '+(i+1), precio:Math.round(Math.random()*90+10), imgs:[src], vendido:false}));
    LS.set('productos', ST.productos);
    renderProductosCliente(); renderProductosAdmin();
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
    $('#addProyecto').onclick=()=>openFormProyecto();
    // PATCH: usa compresión en importación masiva
    $('#importProyectos').onchange=async (e)=>{
      await bulkImportProyectos(e.target.files);
      e.target.value='';
    };
  }
  function cardProyectoCliente(p){
    const img=p.imgs?.[0] || 'proyect1/1.jpg';
    return `<article class="item"><div class="img"><img src="${img}" alt="${esc(p.titulo)}"></div><div class="body"><h3 class="title">${esc(p.titulo)}</h3><p class="muted">${esc(p.desc||'')}</p><div class="row"><button class="btn ghost" data-view="${p.id}">Ver</button></div></div></article>`;
  }
  function renderProyectosCliente(){
    const g=$('#gridProyectos'); g.innerHTML = ST.proyectos.map(p=>cardProyectoCliente(p)).join('');
    g.querySelectorAll('img').forEach(img=> safeImg(img));
    g.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>openLB( ST.proyectos.find(x=>x.id===b.dataset.view)?.imgs || [], 0 ));
  }
  function renderProyectosAdmin(){
    const grid=$('#gridProyectosAdmin'); if(!grid) return;
    grid.innerHTML = ST.proyectos.map(p=>cardProyectoAdmin(p)).join('');
    grid.querySelectorAll('img').forEach(img=> safeImg(img));
    grid.querySelectorAll('[data-addimgp]').forEach(inp=> inp.onchange = async (e)=>{
      const imgs = await filesToDataURLCompressed(e.target.files);
      addImgsProyecto(inp.dataset.addimgp, imgs);
      e.target.value='';
    });
    grid.querySelectorAll('[data-delimgp]').forEach(btn=> btn.onclick = ()=> delImgProyecto(btn.dataset.delimgp, Number(btn.dataset.idx)));
    grid.querySelectorAll('[data-delproj]').forEach(btn=> btn.onclick = ()=> delProyecto(btn.dataset.delproj));
    grid.querySelectorAll('[data-viewp]').forEach(btn=> btn.onclick = ()=> openLB(ST.proyectos.find(x=>x.id===btn.dataset.viewp)?.imgs||[],0));
  }
  function cardProyectoAdmin(p){
    const thumbs = (p.imgs||[]).map((src,ix)=>`
      <div class="thumb"><img src="${src}" alt=""><button class="chip danger" data-delimgp="${p.id}" data-idx="${ix}">Eliminar</button></div>`).join('') || `<div class="muted">Sin imágenes aún</div>`;
    return `
      <article class="card">
        <div class="row wrap" style="justify-content:space-between;align-items:center">
          <strong>${esc(p.titulo)}</strong>
          <button class="chip" data-viewp="${p.id}">Ver galería</button>
        </div>
        <div class="thumbs">${thumbs}</div>
        <div class="row wrap" style="margin-top:8px">
          <label class="btn ghost">➕ Añadir desde teléfono
            <input type="file" accept="image/*" multiple hidden data-addimgp="${p.id}">
          </label>
          <button class="btn danger" data-delproj="${p.id}">Eliminar proyecto</button>
        </div>
      </article>`;
  }
  function openFormProyecto(){
    openModal('Nuevo proyecto', `
      <form id="fProj" class="form">
        <div class="row wrap">
          <input class="input" id="jTitulo" placeholder="Título" required>
          <input class="input" id="jDesc" placeholder="Descripción">
        </div>
        <label class="btn ghost" style="display:inline-flex;gap:8px;align-items:center">📷 Imágenes
          <input id="jImgs" type="file" accept="image/*" multiple hidden>
        </label>
        <div class="row" style="margin-top:10px"><button class="btn primary" type="submit">Guardar</button></div>
      </form>
    `);
    $('#fProj').onsubmit = async (e)=>{
      e.preventDefault();
      const titulo=$('#jTitulo').value.trim(); const desc=$('#jDesc').value.trim();
      const imgs = await filesToDataURLCompressed($('#jImgs').files);
      ST.proyectos.push({id:u(), titulo, desc, imgs}); LS.set('proyectos', ST.proyectos);
      closeModal(); renderProyectosCliente(); renderProyectosAdmin();
    };
  }
  async function bulkImportProyectos(files){
    if(!files?.length) return;
    const imgs = await filesToDataURLCompressed(files);
    ST.proyectos.push({id:u(), titulo:'Proyecto nuevo', desc:'', imgs});
    LS.set('proyectos', ST.proyectos); renderProyectosCliente(); renderProyectosAdmin();
  }
  function addImgsProyecto(id, imgs){ const p = ST.proyectos.find(x=>x.id===id); if(!p) return; p.imgs = [...(p.imgs||[]), ...imgs]; LS.set('proyectos', ST.proyectos); renderProyectosCliente(); renderProyectosAdmin(); }
  function delImgProyecto(id, idx){ const p = ST.proyectos.find(x=>x.id===id); if(!p) return; p.imgs.splice(idx,1); LS.set('proyectos', ST.proyectos); renderProyectosCliente(); renderProyectosAdmin(); }
  function delProyecto(id){ if(!confirm('¿Eliminar proyecto completo?')) return; ST.proyectos = ST.proyectos.filter(x=>x.id!==id); LS.set('proyectos', ST.proyectos); renderProyectosCliente(); renderProyectosAdmin(); }

  /* ===== Carrito ===== */
  function initCarrito(){
    renderClientesSel(); renderCarrito();
    $('#btnAddCliente').onclick=()=>openFormCliente(true);
    $('#metodoPago').onchange=()=>{ const v=$('#metodoPago').value; $('#montoEfectivo').classList.toggle('hidden', v!=='efectivo'); $('#qrBox').classList.toggle('hidden', v!=='zelle'); };
    $('#btnPagar').onclick= pagar;
  }
  function renderClientesSel(){
    if(!ST.clientes.length){
      ST.clientes=[{id:'general',nombre:'Cliente General',email:'',empresa:'',telefono:'',compras:0,total:0,ultima:'',createdAt:''}];
      LS.set('clientes',ST.clientes);
    }
    const sel=$('#clienteSel');
    sel.innerHTML=`<option value="general">— Regístrate para comprar —</option>` + ST.clientes.filter(c=>c.id!=='general').map(c=>`<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
  }
  function openFormCliente(required=false){
    openModal(required?'Registro de cliente (requerido)':'Nuevo cliente', `
      <form id="fCli" class="form">
        <div class="row wrap">
          <input class="input" id="cNombre" placeholder="Nombre *" required>
          <input class="input" id="cTel" placeholder="Teléfono *" required>
        </div>
        <div class="row wrap">
          <input class="input" id="cEmpresa" placeholder="Empresa (opcional)">
          <input class="input" id="cEmail" type="email" placeholder="Correo (opcional)">
        </div>
        <div class="row" style="margin-top:10px"><button class="btn primary" type="submit">Guardar</button></div>
      </form>
    `);
    $('#fCli').onsubmit=(e)=>{
      e.preventDefault();
      const c={id:u(), nombre:$('#cNombre').value.trim(), telefono:$('#cTel').value.trim(), empresa:$('#cEmpresa').value.trim(), email:$('#cEmail').value.trim(), compras:0,total:0,ultima:'', createdAt:new Date().toLocaleString()};
      if(!c.nombre || !c.telefono) return alert('Nombre y teléfono son obligatorios');
      ST.clientes.push(c); LS.set('clientes',ST.clientes);
      renderClientesSel(); $('#clienteSel').value=c.id; pintarClientes(); pintarClientesDir(); closeModal();
    };
  }
  function addCart(id){
    const p=ST.productos.find(x=>x.id===id); if(!p) return;
    if(p.vendido){ alert('Este producto ya fue vendido'); return; }
    const it=ST.carrito.find(i=>i.id===id);
    const img = p.imgs?.[0] || 'venta/1.jpg';
    if(it) it.cant+=1; else ST.carrito.push({id:p.id,nombre:p.nombre,precio:p.precio,cant:1,img});
    LS.set('carrito', ST.carrito); renderCarrito();
  }
  function renderCarrito(){
    const ul=$('#listaCarrito');
    ul.innerHTML=ST.carrito.map((i,k)=>`
      <li>
        <div class="left">
          <img class="thumb-cart" src="${i.img||'venta/1.jpg'}" alt="">
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

  function pagar(){
    if(!ST.carrito.length) return alert('Carrito vacío');
    const cliId=$('#clienteSel').value;
    const cli=ST.clientes.find(c=>c.id===cliId);
    if(!cli || cli.id==='general' || !cli.telefono){
      alert('Para comprar debes registrarte con Nombre y Teléfono.');
      return openFormCliente(true);
    }
    const metodo=$('#metodoPago').value; if(!metodo) return alert('Selecciona método');
    const sub=Number($('#subTxt').textContent), imp=Number($('#taxTxt').textContent), tot=Number($('#totTxt').textContent);
    if(metodo==='efectivo'){ const ent=Number($('#montoEfectivo').value||0); if(ent<tot) return alert('Efectivo insuficiente'); }

    // Registrar venta
    const venta={ id:'V'+String(ST.folio).padStart(5,'0'), fecha:new Date().toLocaleString(), cliente:cli.nombre, items:ST.carrito.map(i=>({n:i.nombre,c:i.c,p:i.precio,id:i.id})), subtotal:sub, impuesto:imp, total:tot, metodo };
    ST.ventas.unshift(venta); ST.folio++; LS.set('ventas',ST.ventas); LS.set('folio',ST.folio);

    // Actualizar resumen cliente
    cli.compras=(cli.compras||0)+1; cli.total=Number(cli.total||0)+tot; cli.ultima=venta.fecha; LS.set('clientes',ST.clientes);

    // ===== Marcar productos como vendidos =====
    venta.items.forEach(it=>{
      const p = ST.productos.find(x=>x.id===it.id);
      if(p) p.vendido = true;
    });
    LS.set('productos', ST.productos);

    // Limpiar carrito y refrescar vistas
    ST.carrito=[]; LS.set('carrito',ST.carrito); renderCarrito();
    pintarRecibo(venta); pintarVentas(); pintarClientes(); pintarClientesDir();
    renderProductosCliente(); renderProductosAdmin();
  }

  /* ===== Recibo ===== */
  function pintarRecibo(v){
    const box=$('#reciboBox'); box.classList.remove('hidden');
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
            <tr><td colspan="3" style="text-align:right">Método</td><td>${v.metodo}</td></tr>
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

  /* ===== Recibo bonito (canvas → PNG, imprimir sólo recibo) ===== */
  async function reciboPrettyPrint(v){
    const fmtSel = $('#receiptFormat')?.value || 'a5';
    let W, H, pageCSS;
    if(fmtSel==='a4'){ W=1654; H=2339; pageCSS='@page { size: A4 portrait; margin: 10mm; }'; }
    else if(fmtSel==='ticket80'){
      W=640; const base=480, per=64; H = base + v.items.length*per + 320;
      pageCSS='@page { size: 80mm auto; margin: 5mm; } body{background:#0f1420;}';
    } else { W=1200; H=1700; pageCSS='@page { size: A5 portrait; margin: 10mm; }'; }

    const c=document.createElement('canvas'); c.width=W; c.height=H; const ctx=c.getContext('2d');
    ctx.fillStyle='#0f1420'; ctx.fillRect(0,0,W,H);

    const isTicket = fmtSel==='ticket80';
    const pad = isTicket ? 28 : Math.round(W*0.05);
    const cardR = isTicket ? 16 : 24;
    const cardW = W - pad*2;
    const cardH = H - pad*2;

    roundRect(ctx, pad, pad, cardW, cardH, cardR, '#0b111d', true, '#223352');

    const logo = await loadImage('logoklem.png'); // si falla, seguimos
    const logoSize = isTicket ? 80 : Math.round(W*0.08);
    if(logo) ctx.drawImage(logo, pad+40, pad+40, logoSize, logoSize);

    ctx.fillStyle='#e8eef8';
    ctx.font= (isTicket?'bold 26px Inter':'bold 42px Inter');
    ctx.fillText('Stradivaryus Tools', pad+40+logoSize+20, pad+40+Math.round(logoSize*0.6));
    ctx.font= (isTicket?'16px Inter':'20px Inter'); ctx.fillStyle='#a7b3c9';
    ctx.fillText('Recibo de compra', pad+40+logoSize+20, pad+40+Math.round(logoSize*0.6)+ (isTicket?22:35));

    ctx.fillStyle='#e8eef8'; ctx.font=(isTicket?'15px Inter':'18px Inter');
    let baseY = pad + logoSize + (isTicket?80:120);
    ctx.fillText(`Número: ${v.id}`, pad+40, baseY);
    ctx.fillText(`Fecha: ${v.fecha}`, pad+40, baseY+(isTicket?24:30));
    ctx.fillText(`Cliente: ${v.cliente}`, pad+40, baseY+(isTicket?48:60));

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

    y += (isTicket?14:18); line(ctx, pad+30, y, W-(pad+30), y, '#1a2440'); y += (isTicket?22:26);
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

    y += (isTicket?6:10); line(ctx, pad+30, y, W-(pad+30), y, '#1a2440'); 
    y += (isTicket?20:30); ctx.font=(isTicket?'15px Inter':'18px Inter');
    ctx.fillText(`Subtotal: $${cur(v.subtotal)}`, colPrecioX, y); y+= (isTicket?18:26);
    ctx.fillText(`Impuesto: $${cur(v.impuesto)}`, colPrecioX, y); y+= (isTicket?20:28);
    ctx.font=(isTicket?'bold 18px Inter':'bold 22px Inter'); ctx.fillText(`Total: $${cur(v.total)}`, colPrecioX, y);

    const dataURL = c.toDataURL('image/png');
    const blob = dataURLtoBlob(dataURL);
    const shared = await shareFile(`Recibo_${v.id}.png`, blob, 'image/png');
    if(!shared){ download(`Recibo_${v.id}.png`, blob, 'image/png'); }

    const url = URL.createObjectURL(blob);
    openPrintWindowWithImage(url, (fmtSel==='ticket80')?'@page { size: 80mm auto; margin: 5mm; } body{background:#0f1420;}': (fmtSel==='a4')?'@page { size: A4 portrait; margin: 10mm; }':'@page { size: A5 portrait; margin: 10mm; }');
  }
  function openPrintWindowWithImage(imgURL, pageCSS){
    const w = window.open('', '_blank');
    if(!w){
      alert('Se guardó el archivo. Para imprimir, habilita ventanas emergentes o abre el archivo desde tu galería/descargas.');
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

  /* ===== Presupuesto ADMIN ===== */
  function initPresupuestoAdmin(){
    const tBody = $('#presTable tbody');
    $('#rowAdd').onclick=()=>rowAdd(tBody, '#presTotal');
    $('#presCSV').onclick=()=>presCSV('#presTable','#presTotal');
    $('#presPDF').onclick=()=>presPDF('#presCliente','#presProyecto','#presTable','#presTotal', true, $('#presFormat')?.value||'a4');
    if(!tBody.children.length) rowAdd(tBody, '#presTotal');
  }
  function rowAdd(tBody, totalSel){
    const tr=document.createElement('tr');
    tr.innerHTML=`<td><input class="input" placeholder="Material"></td><td><input class="input" type="number" min="0" step="1" value="1"></td><td><input class="input" type="number" min="0" step="0.01" value="0.00"></td><td class="sub">$0.00</td><td><button class="chip danger">✕</button></td>`;
    tBody.appendChild(tr);
    const [m,c,p]= $$('input',tr); [c,p].forEach(i=>i.addEventListener('input',()=>calcPres(tBody,totalSel)));
    tr.querySelector('button').onclick=()=>{ tr.remove(); calcPres(tBody,totalSel); };
    calcPres(tBody,totalSel);
  }
  function calcPres(tBody, totalSel){
    let total=0; [...tBody.children].forEach(tr=>{ const [m,c,p]=$$('input',tr); const sub=(Number(c.value)||0)*(Number(p.value)||0); tr.querySelector('.sub').textContent='$'+cur(sub); total+=sub; });
    $(totalSel).textContent='$'+cur(total);
  }
  function buildRows(tableSel){
    return $$(tableSel+' tbody tr').map(tr=>{ const [m,c,p]=$$('input',tr); const sub=(Number(c.value)||0)*(Number(p.value)||0); return [m.value,c.value,'$'+cur(p.value), '$'+cur(sub)]; });
  }
  function presCSV(tableSel,totalSel){
    const rows = buildRows(tableSel);
    const total = rows.reduce((a,r)=>a+Number(String(r[3]).replace(/[^0-9.]/g,'')),0);
    const csv = [['Material','Cantidad','Precio','Subtotal'],...rows,['','','Total',cur(total)]].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    download('presupuesto.csv', csv, 'text/csv');
  }

  /* ===== Robustez PDF ===== */
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

  // ==== PDF elegante + guardar/compartir + imprimir (solo admin)
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

  /* ===== Contable ===== */
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
        <td>${v.metodo}</td>
        <td><button class="chip" data-print="${ix}">🖨️</button></td>
        <td><button class="chip danger" data-delv="${ix}">✕</button></td>
      </tr>`).join('');
    tb.querySelectorAll('[data-delv]').forEach(b=> b.onclick=()=>{ ST.ventas.splice(Number(b.dataset.delv),1); LS.set('ventas',ST.ventas); pintarVentas(); });
    tb.querySelectorAll('[data-print]').forEach(b=> b.onclick=()=>{ const v = ST.ventas[Number(b.dataset.print)]; if(v) reciboPrettyPrint(v); });
  }
  function pintarClientes(){
    const tb=$('#tbClientes'); if(!tb) return;
    tb.innerHTML = ST.clientes.filter(c=>c.id!=='general').map((c,ix)=>`
      <tr>
        <td>${esc(c.nombre)}</td><td>${c.compras||0}</td><td>$${cur(c.total||0)}</td><td>${c.ultima||''}</td>
        <td><button class="chip danger" data-delc="${ix}">✕</button></td>
      </tr>`).join('');
    tb.querySelectorAll('[data-delc]').forEach(b=> b.onclick=()=>{ ST.clientes.splice(Number(b.dataset.delc)+1,1); LS.set('clientes',ST.clientes); pintarClientes(); pintarClientesDir(); renderClientesSel(); });
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
    tb.querySelectorAll('[data-delcd]').forEach(b=> b.onclick=()=>{ ST.clientes.splice(Number(b.dataset.delcd)+1,1); LS.set('clientes',ST.clientes); pintarClientesDir(); pintarClientes(); renderClientesSel(); });
  }
  function pintarPres(){
    const tb=$('#tbPres'); if(!tb) return;
    tb.innerHTML = ST.presupuestos.map((p,ix)=>`
      <tr>
        <td>${p.fecha}</td><td>${esc(p.cliente||'-')}</td><td>${esc(p.proyecto||'-')}</td><td>$${cur(p.monto||0)}</td>
        <td><button class="chip" data-printp="${ix}">🖨️</button></td>
        <td><button class="chip danger" data-delp="${ix}">✕</button></td>
      </tr>`).join('');
    tb.querySelectorAll('[data-delp]').forEach(b=> b.onclick=()=>{ ST.presupuestos.splice(Number(b.dataset.delp),1); LS.set('presupuestos',ST.presupuestos); pintarPres(); });
    tb.querySelectorAll('[data-printp]').forEach(b=> b.onclick=()=> presReprint(Number(b.dataset.printp)));
  }
  async function presReprint(ix){
    const p = ST.presupuestos[ix];
    if(!p){ return; }
    if(!p.rows || !p.rows.length){
      alert('Este presupuesto no tiene detalle guardado (fue generado antes). Crea uno nuevo para habilitar reimpresión.');
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

  /* ===== Lightbox ===== */
  function lightboxInit(){
    $('#lbClose').onclick=closeLB; $('#lbPrev').onclick=()=>navLB(-1); $('#lbNext').onclick=()=>navLB(1);
    $('#zIn').onclick=()=>zoom(0.15); $('#zOut').onclick=()=>zoom(-0.15); $('#zReset').onclick=()=>{ST.lb.zoom=1;applyZoom()}; $('#openNew').onclick=()=>{ const s=$('#lbImg').src; if(s) open(s,'_blank'); };
    document.addEventListener('keydown',e=>{ if($('#lightbox').classList.contains('hidden')) return; if(e.key==='Escape') closeLB(); if(e.key==='ArrowLeft') navLB(-1); if(e.key==='ArrowRight') navLB(1); });
  }
  function openLB(list,start){ ST.lb.list=list; ST.lb.idx=start; ST.lb.zoom=1; $('#lbImg').src=list[start]||''; $('#lightbox').classList.remove('hidden'); applyZoom(); }
  function closeLB(){ $('#lightbox').classList.add('hidden'); }
  function navLB(d){ if(!ST.lb.list.length) return; ST.lb.idx=(ST.lb.idx+d+ST.lb.list.length)%ST.lb.list.length; $('#lbImg').src=ST.lb.list[ST.lb.idx]; ST.lb.zoom=1; applyZoom(); }
  function zoom(d){ ST.lb.zoom=Math.max(.4, Math.min(3, ST.lb.zoom+d)); applyZoom(); }
  function applyZoom(){ $('#lbImg').style.transform=`scale(${ST.lb.zoom})`; $('#lbImg').style.transformOrigin='center'; }

  /* ===== Tema ===== */
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
    $('#btnTheme').onclick = ()=>{
      const cur = localStorage.getItem("st_theme3") || 'auto';
      const next = cur==='auto' ? 'light' : cur==='light' ? 'dark' : 'auto';
      applyTheme(next);
    };
    updateThemeButton();
  }
  function updateThemeButton(){
    const t = localStorage.getItem("st_theme3") || 'auto';
    const btn = $('#btnTheme'); if(!btn) return;
    if(t==='auto'){ btn.textContent='🖥️'; btn.title='Tema automático'; }
    else if(t==='light'){ btn.textContent='🌙'; btn.title='Cambiar a oscuro'; }
    else { btn.textContent='🌞'; btn.title='Cambiar a claro'; }
  }

  /* ===== Compartir (móvil) ===== */
  async function shareFile(filename, blob, mime){
    try{
      if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: mime })] })) {
        await navigator.share({ title: "Stradivaryus Tools", text: filename, files: [new File([blob], filename, { type: mime })] });
        return true;
      }
    }catch(e){}
    return false;
  }

  /* ===== Modal ===== */
  function openModal(title, html){
    $('#modalTitle').textContent=title;
    $('#modalBody').innerHTML=html;
    $('#modal').classList.remove('hidden');
    $('#modalClose').onclick=closeModal;
    $('#modal').addEventListener('click',e=>{ if(e.target.id==='modal') closeModal(); }, {once:true});
  }
  function closeModal(){ $('#modal').classList.add('hidden'); }

  /* ===== Utils ===== */
  function esc(s=''){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function u(){return Math.random().toString(36).slice(2,9)}
  function download(name, data, mime='application/octet-stream'){ const blob = data instanceof Blob ? data : new Blob([data], {type:mime}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),3000); }
  function dataURLtoBlob(dataURL){ const parts=dataURL.split(','); const bstr=atob(parts[1]); let n=bstr.length; const u8=new Uint8Array(n); while(n--){u8[n]=bstr.charCodeAt(n)}; return new Blob([u8], {type: parts[0].split(':')[1].split(';')[0]}); }
  // 🔧 PATCH: reemplaza filesToDataURL por versión comprimida
  async function filesToDataURLCompressed(fileList){
    if(!fileList || !fileList.length) return [];
    const arr = Array.from(fileList);
    const outs = [];
    for(const f of arr){
      const out = await readAndCompress(f, 1600, 0.82); // máx 1600px, 82% quality
      if(out === null){
        alert(`⚠️ Formato no soportado por el navegador para: ${f.name}. Conviértela a JPG/PNG antes de importar.`);
        continue;
      }
      outs.push(out);
    }
    return outs;
  }
  // Lectura + compresión segura (maneja errores y HEIC no compatible)
  async function readAndCompress(file, maxDim=1600, quality=0.82){
    // Intentar decodificar con createImageBitmap (más robusto)
    let bmp=null;
    try{
      const blob = file;
      bmp = await createImageBitmap(blob);
    }catch{
      // Fallback: usar Image + FileReader
      try{
        const dataURL = await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); });
        const img = await new Promise((res)=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=()=>res(null); im.src=dataURL; });
        if(!img) return null;
        // Pintar en canvas
        return await canvasCompress(img, maxDim, quality);
      }catch{
        return null;
      }
    }
    // Con bitmap: pintar en canvas
    const cnv = document.createElement('canvas');
    const ctx = cnv.getContext('2d');
    const { width:W, height:H } = bmp;
    const scale = Math.min(1, maxDim/Math.max(W,H));
    cnv.width = Math.max(1, Math.round(W*scale));
    cnv.height= Math.max(1, Math.round(H*scale));
    ctx.drawImage(bmp, 0, 0, cnv.width, cnv.height);
    // Exportar JPEG (más compacto que PNG en fotos)
    const dataURL = cnv.toDataURL('image/jpeg', quality);
    try{ bmp.close?.(); }catch{}
    return dataURL;
  }
  async function canvasCompress(img, maxDim, quality){
    const W=img.naturalWidth||img.width, H=img.naturalHeight||img.height;
    const scale = Math.min(1, maxDim/Math.max(W,H));
    const cnv=document.createElement('canvas');
    cnv.width = Math.max(1, Math.round(W*scale));
    cnv.height= Math.max(1, Math.round(H*scale));
    const ctx = cnv.getContext('2d');
    ctx.drawImage(img,0,0,cnv.width,cnv.height);
    return cnv.toDataURL('image/jpeg', quality);
  }

  // (Mantengo tu función original con nombre distinto por compatibilidad interna)
  async function imgToDataURL(src){ try{ const resp = await fetch(src, {mode:'cors'}); const blob = await resp.blob(); return await new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(blob); }); }catch{ return null; } }
  function loadImage(src){ return new Promise(r=>{ const img=new Image(); img.crossOrigin='anonymous'; img.onload=()=>r(img); img.onerror=()=>r(null); img.src=src; }); }
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

  /* ===== Imagen segura (fallback) ===== */
  function safeImg(imgEl, placeholder='data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="%230b1018"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23a7b3c9" font-family="Inter,Arial" font-size="18">Imagen no disponible</text></svg>'){
    if(!imgEl) return;
    imgEl.setAttribute('data-fallback','1');
    imgEl.onerror = ()=>{ if(imgEl.src!==placeholder) imgEl.src = placeholder; };
  }

  /* ===== FAB arrastrable ===== */
  function setupDraggableFab(){
    const fab = document.querySelector('.fab');
    if(!fab) return;

    const k = 'fab_pos_v1';
    // Restaurar posición guardada
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

})();

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
})();
// Eliminar proyecto por nombre (Admin)
const btnDelProjByName = $('#btnDelProjByName');
if(btnDelProjByName){
  btnDelProjByName.onclick = ()=>{
    const name = $('#projNameDel').value.trim();
    if(!name) return alert("Escribe el nombre exacto del proyecto");

    const before = ST.proyectos.length;
    ST.proyectos = ST.proyectos.filter(p => p.titulo !== name);
    if(ST.proyectos.length === before){
      alert(`No se encontró el proyecto "${name}"`);
      return;
    }

    LS.set('proyectos', ST.proyectos);
    renderProyectosCliente();
    renderProyectosAdmin();
    alert(`Proyecto "${name}" eliminado correctamente ✅`);
  };
}
