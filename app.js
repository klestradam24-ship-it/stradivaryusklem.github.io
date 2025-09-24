/* app.js - Stradivaryus Tools (versión completa, segura y pulida; cliente SIN clave por defecto) */
(()=>{
/* ===== Helpers ===== */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const LS={get:(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}, set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};
const cur=n=>(Number(n)||0).toFixed(2);
const u = ()=>'id'+Math.random().toString(36).slice(2)+Date.now().toString(36);
const esc=s=>String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function track(event,params={}){(window.dataLayer=window.dataLayer||[]).push({event,...params});}

async function hashString(str){ const enc=new TextEncoder().encode(str); const buf=await crypto.subtle.digest('SHA-256',enc); return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
async function filesToDataURL(fileList){ if(!fileList||!fileList.length) return []; const arr=[...fileList]; const read=f=>new Promise(res=>{const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(f)}); return await Promise.all(arr.map(read)); }
async function makeThumb(dataURL,maxDim=1400,quality=.82){return new Promise(res=>{const img=new Image(); img.onload=()=>{const c=document.createElement('canvas'); const s=Math.min(1,maxDim/Math.max(img.naturalWidth,img.naturalHeight)); c.width=Math.max(1,Math.round(img.naturalWidth*s)); c.height=Math.max(1,Math.round(img.naturalHeight*s)); c.getContext('2d').drawImage(img,0,0,c.width,c.height); res(c.toDataURL('image/jpeg',quality));}; img.onerror=()=>res(dataURL); img.src=dataURL;});}
async function filesToDataURLCompressed(fileList,maxDim=1400,quality=.82){ if(!fileList||!fileList.length) return []; const datas=await filesToDataURL(fileList); const outs=[]; for(const d of datas){ outs.push(await makeThumb(d,maxDim,quality)); } return outs; }
function dataURLtoBlob(dataURL){ const p=dataURL.split(','); const b=atob(p[1]); const u8=new Uint8Array(b.length); for(let i=0;i<b.length;i++)u8[i]=b.charCodeAt(i); return new Blob([u8],{type:p[0].split(':')[1].split(';')[0]}); }
function toast(msg){ let box=$('#toastBox'); if(!box){ box=document.createElement('div'); box.id='toastBox'; Object.assign(box.style,{position:'fixed',left:'50%',bottom:'24px',transform:'translateX(-50%)',zIndex:'9999'}); document.body.appendChild(box);} const t=document.createElement('div'); t.className='toast'; t.textContent=msg; Object.assign(t.style,{opacity:'0',transition:'opacity .25s, transform .25s',background:'var(--card,#101826)',color:'var(--text,#e8eef8)',padding:'10px 14px',borderRadius:'10px',boxShadow:'0 6px 20px rgba(0,0,0,.35)',marginTop:'8px',transform:'translateY(6px)'}); box.appendChild(t); requestAnimationFrame(()=>{t.style.opacity='1';t.style.transform='translateY(0)'}); setTimeout(()=>{t.style.opacity='0';t.style.transform='translateY(6px)'; t.addEventListener('transitionend',()=>t.remove(),{once:true});},2600);}
function download(filename,data,mime='application/octet-stream'){ const blob=data instanceof Blob?data:new Blob([data],{type:mime}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
async function shareFile(name,blob,mime='application/octet-stream'){ try{ if(navigator.canShare&&navigator.canShare({files:[new File([blob],name,{type:mime})]})){ await navigator.share({files:[new File([blob],name,{type:mime})]}); return true; } }catch{} return false; }
function safeImg(img){ img.addEventListener('error',()=>{img.src=img.getAttribute('data-fallback')||'data:image/gif;base64,R0lGODlhAQABAAAAACw='},{once:true}); }
function imgToDataURL(url){ return new Promise(res=>{ try{ const img=new Image(); img.crossOrigin='anonymous'; img.onload=()=>{ try{ const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight; c.getContext('2d').drawImage(img,0,0); res(c.toDataURL('image/png')); }catch{res(null);} }; img.onerror=()=>res(null); img.src=url; }catch(e){res(null);} }); }

/* ===== Estado ===== */
const ST={
  authed: sessionStorage.getItem('st_admin_ok')==='1',
  clientAuthed: sessionStorage.getItem('st_client_ok')==='1',
  tax: Number(LS.get('taxRate',5.75)),
  productos: LS.get('productos',[]),
  proyectos: LS.get('proyectos',[]),
  hero: LS.get('hero',[]),
  clientes: LS.get('clientes',[]),
  carrito: LS.get('carrito',[]),
  ventas: LS.get('ventas',[]),
  presupuestos: LS.get('presupuestos',[]),
  folio: Number(LS.get('folio',1)),
  lb:{list:[],idx:0,zoom:1,open:false},
  slideIdx:0,
  search:{q:'',cat:''}
};

/* ===== Auth por defecto (solo ADMIN inicial “Control”) ===== */
async function ensureAuthDefaults(){
  if(!LS.get('adminHash',null)){
    LS.set('adminHash', await hashString('Control'));
    try{ toast('Admin inicializado con clave: Control'); }catch{}
  }
}

/* ===== Init ===== */
document.addEventListener('DOMContentLoaded', init);
async function init(){
  try{ const qs=new URLSearchParams(location.search); if(qs.get('resetadmin')==='1'){ LS.set('adminHash',null); sessionStorage.removeItem('st_admin_ok'); toast('Admin reseteado. Configura una nueva clave en Admin.'); } }catch{}
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}); }
  await ensureAuthDefaults();

  $('#btnLogin')?.addEventListener('click',()=>goView('admin'));

  bgAnimate();
  setupHeaderNav();
  setupTabbar();

  setupAdmin();
  setupCliente();         // <<< cliente no pide clave si no hay clientHash
  initHero();
  initProductos();
  initCarrito();
  initProyectos();
  initPresupuestoAdmin();
  lightboxInit();
  themeInit();
  setupThemeSwitch();
  setupDraggableFab();
  injectSEO();

  try{ initAesthetics?.(); }catch{}
}

/* ===== SEO JSON-LD ===== */
function injectSEO(){ try{ const head=document.head, add=(tag,attrs)=>{const el=document.createElement(tag); Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v)); head.appendChild(el);}; if(!document.querySelector('meta[name="description"]')) add('meta',{name:'description',content:'Herramientas, proyectos y servicios en Cincinnati. Ventas, instalación y presupuestos al instante.'}); if(!document.querySelector('meta[property="og:title"]')){ add('meta',{property:'og:title',content:'Stradivaryus Tools'}); add('meta',{property:'og:description',content:'Catálogo de herramientas y proyectos. Presupuestos en PDF. Contacto rápido.'}); add('meta',{property:'og:type',content:'website'}); } const base=location.origin+location.pathname.replace(/[^/]*$/,''); const ld={"@context":"https://schema.org","@type":"HardwareStore","name":"Stradivaryus Tools","image":base+"logoklem.png","telephone":"+1-513-379-0469","email":"info@stradivaryus.com","address":{"@type":"PostalAddress","addressLocality":"Cincinnati","addressRegion":"OH","addressCountry":"US"},"openingHours":"Mo-Fr 09:00-17:00"}; const s=document.createElement('script'); s.type='application/ld+json'; s.textContent=JSON.stringify(ld); head.appendChild(s);}catch{} }

/* ===== Fondo Canvas ===== */
function bgAnimate(){ const c=$('#bg'); if(!c) return; const g=c.getContext('2d'); let t=0; function resize(){ c.width=innerWidth; c.height=innerHeight; } resize(); addEventListener('resize',resize); (function draw(){ t+=.004; g.clearRect(0,0,c.width,c.height); for(let i=0;i<60;i++){ const x=(Math.sin(t+i)*.5+.5)*c.width; const y=(Math.cos(t*1.3+i*.7)*.5+.5)*c.height; const r=60+40*Math.sin(t+i*2); const grd=g.createRadialGradient(x,y,0,x,y,r); grd.addColorStop(0,'#12234155'); grd.addColorStop(1,'#0000'); g.fillStyle=grd; g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill(); } requestAnimationFrame(draw); })(); }

/* ===== Navegación ===== */
function setupHeaderNav(){
  $$('[data-go],[data-subgo]').forEach(b=>b.addEventListener('click',()=>{
    const go=b.getAttribute('data-go'), sub=b.getAttribute('data-subgo');
    if(go==='cliente'){ goTopCliente(); if(ST.clientAuthed&&sub) subGo(sub); } else if(go){ goView(go); }
  }));
  $('#btnSearch')?.addEventListener('click',applySearch);
  $('#searchBox')?.addEventListener('keydown',e=>{ if(e.key==='Enter') applySearch(); });
  $('#searchCat')?.addEventListener('change',applySearch);
}
function applySearch(){ const q=($('#searchBox')?.value||'').trim().toLowerCase(); const cat=($('#searchCat')?.value||'').trim(); ST.search={q,cat}; if(typeof renderProductosCliente==='function') renderProductosCliente(q,cat); if(typeof renderProyectosCliente==='function') renderProyectosCliente(q,cat); }
function setupTabbar(){ $$('.tabbar button').forEach(b=>b.addEventListener('click',()=>{ const dest=b.dataset.go; if(dest==='cliente'){ goTopCliente(); if(ST.clientAuthed) subGo('productos'); } else goView(dest); })); }
function goView(id){ if(id==='admin') $('#view-admin')?.classList.add('show'); $$('.tabbar button').forEach(b=>b.classList.toggle('active',b.dataset.go===id)); $$('.view').forEach(v=>v.classList.remove('show')); $('#view-'+id)?.classList.add('show'); scrollTo({top:0,behavior:'smooth'}); }
function goTopCliente(){ $$('.tabbar button').forEach(b=>b.classList.toggle('active',b.dataset.go==='cliente')); $$('.view').forEach(v=>v.classList.remove('show')); $('#view-cliente')?.classList.add('show'); ensureClienteGate(); scrollTo({top:0,behavior:'smooth'}); }

/* ===== Cliente (NO pide clave por defecto) ===== */
function setupCliente(){
  const hasClientHash = !!LS.get('clientHash',null);
  // Si no hay clave definida, damos acceso directo (oculta gate)
  if(!hasClientHash && !ST.clientAuthed){ ST.clientAuthed=true; sessionStorage.setItem('st_client_ok','1'); }

  // Subtabs
  $('#subtabCliente')?.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{ if(!ST.clientAuthed){ ensureClienteGate(); return; } subGo(b.dataset.subgo); }));

  // Gate handlers (solo cuando exista clave)
  $('#clienteEnter')?.addEventListener('click', tryClienteLogin);
  $('#clientePass')?.addEventListener('keydown', e=>{ if(e.key==='Enter') tryClienteLogin(); });

  updateClienteGateUI();

  // Entrar directo a "Productos" si está autenticado o no hay clave definida
  if(ST.clientAuthed) subGo('productos');
}

/* Login cliente solo si hay clave configurada */
async function tryClienteLogin(){
  const storedClientHash=LS.get('clientHash',null);
  if(!storedClientHash){ // no debería mostrarse gate, pero por si acaso:
    ST.clientAuthed=true; sessionStorage.setItem('st_client_ok','1'); updateClienteGateUI(); subGo('productos'); toast('Acceso directo (sin clave de cliente)'); return;
  }
  const pass=($('#clientePass')?.value||'').trim(); if(!pass) return alert('Ingresa la contraseña.');
  const ph=await hashString(pass);
  if(ph===storedClientHash){ ST.clientAuthed=true; sessionStorage.setItem('st_client_ok','1'); updateClienteGateUI(); subGo('productos'); toast('Acceso de cliente concedido ✅'); }
  else alert('Contraseña incorrecta');
}

/* Gate visible solo cuando hay clave Y no está autenticado en la sesión */
function updateClienteGateUI(){
  const gate=$('#clienteGate'), subtab=$('#subtabCliente'), hasClientHash=!!LS.get('clientHash',null);
  if(!hasClientHash){ gate?.classList.add('hidden'); subtab?.classList.remove('hidden'); return; }
  if(ST.clientAuthed){ gate?.classList.add('hidden'); subtab?.classList.remove('hidden'); }
  else{ gate?.classList.remove('hidden'); subtab?.classList.add('hidden'); }
}
function ensureClienteGate(){ updateClienteGateUI(); }
function subGo(alias){ const id='view-'+alias; $$('#clienteViewsMount .view').forEach(v=>v.classList.remove('show')); $('#'+id)?.classList.add('show'); $('#subtabCliente')?.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.subgo===alias)); applySearch(); }

/* ===== Admin ===== */
function setupAdmin(){
  const adminHash=LS.get('adminHash',null), loginBox=$('#adminLoginBox'), firstSetup=$('#adminFirstSetup');
  if(!adminHash){ firstSetup?.classList.remove('hidden'); loginBox?.classList.add('hidden'); } else { firstSetup?.classList.add('hidden'); loginBox?.classList.remove('hidden'); }

  // Crear primera clave admin
  $('#adminSetFirst')?.addEventListener('click',async()=>{ const np=$('#adminNewFirst')?.value.trim(); if(!np||np.length<3) return alert('Mínimo 3 caracteres'); LS.set('adminHash',await hashString(np)); toast('Clave guardada. Ya puedes ingresar.'); firstSetup?.classList.add('hidden'); loginBox?.classList.remove('hidden'); $('#adminNewFirst').value=''; });

  // Login
  $('#adminEnter')?.addEventListener('click',adminLogin);
  $('#adminPass')?.addEventListener('keydown',e=>{ if(e.key==='Enter') adminLogin(); });

  // Ajustes rápidos
  $('#taxSave')?.addEventListener('click',()=>{ ST.tax=Number($('#taxInput')?.value||0); LS.set('taxRate',ST.tax); updateTotals(); toast('Sales Tax guardado'); });

  // Cambiar clave admin
  $('#passSave')?.addEventListener('click',async()=>{ const np=$('#passNew')?.value.trim(); if(!np||np.length<3) return alert('Mínimo 3 caracteres'); LS.set('adminHash',await hashString(np)); $('#passNew').value=''; toast('Contraseña ADMIN actualizada'); });

  // Clave cliente desde Admin
  $('#clientKeySave')?.addEventListener('click',async()=>{
    const np=$('#clientKeyNew')?.value.trim();
    if(!np){
      localStorage.removeItem('clientHash'); $('#clientKeyNew').value='';
      toast('Clave de cliente eliminada. Cliente entra sin contraseña.');
      ST.clientAuthed=true; sessionStorage.setItem('st_client_ok','1'); updateClienteGateUI();
      return;
    }
    LS.set('clientHash', await hashString(np));
    $('#clientKeyNew').value='';
    toast('Clave de cliente guardada. Se pedirá en nuevos dispositivos/sesiones.');
    ST.clientAuthed=false; sessionStorage.removeItem('st_client_ok'); updateClienteGateUI();
  });

  // Limpiezas
  $('#clearVentas')?.addEventListener('click',()=>{ if(confirm('¿Eliminar ventas?')){ ST.ventas=[]; LS.set('ventas',[]); pintarVentas(); pintarClientes(); }});
  $('#clearClientes')?.addEventListener('click',()=>{ if(confirm('¿Eliminar clientes (incluye directorio)?')){ ST.clientes=[]; LS.set('clientes',[]); pintarClientes(); pintarClientesDir(); renderClientesSel(); }});
  $('#clearPres')?.addEventListener('click',()=>{ if(confirm('¿Eliminar presupuestos?')){ ST.presupuestos=[]; LS.set('presupuestos',[]); pintarPres(); }});

  // Hero
  $('#importHero')?.addEventListener('change', e=>filesToDataURL(e.target.files).then(imgs=>{ ST.hero.push(...imgs); LS.set('hero',ST.hero); renderHero(); renderHeroAdmin(); toast('Imágenes añadidas al muro'); e.target.value=''; }));
  $('#clearHero')?.addEventListener('click',()=>{ if(confirm('¿Vaciar todas las imágenes del Muro?')){ ST.hero=[]; LS.set('hero',ST.hero); renderHero(); renderHeroAdmin(); toast('Muro limpiado'); }});

  if(ST.authed){ openPanel(); document.documentElement.classList.add('admin-on'); }
}
async function adminLogin(){ const p=$('#adminPass')?.value.trim(); if(!p) return alert('Ingresa la contraseña'); const ok=(await hashString(p))===LS.get('adminHash',null); if(ok){ ST.authed=true; sessionStorage.setItem('st_admin_ok','1'); openPanel(); toast('Acceso ADMIN concedido ✅'); document.documentElement.classList.add('admin-on'); } else alert('Contraseña incorrecta'); }
function openPanel(){
  $('#adminGate')?.classList.add('hidden');
  $('#adminPanel')?.classList.remove('hidden');
  $('#taxInput').value=ST.tax;
  $('#tabAdmin')?.classList.remove('hidden');

  // Logout dinámico
  const row=$('#adminQuickRow');
  if(row && !$('#btnLogout')){
    const card=document.createElement('div'); card.className='card mini';
    card.innerHTML=`<h3>Sesión</h3><div class="row"><button id="btnLogout" class="btn danger">Cerrar sesión</button></div>`;
    row.appendChild(card);
    $('#btnLogout').onclick=()=>{ ST.authed=false; sessionStorage.removeItem('st_admin_ok'); $('#adminPanel')?.classList.add('hidden'); $('#adminGate')?.classList.remove('hidden'); $('#tabAdmin')?.classList.add('hidden'); toast('Sesión cerrada'); document.documentElement.classList.remove('admin-on'); };
  }

  renderHeroAdmin();
  renderProductosAdmin();
  renderProyectosAdmin();
  pintarVentas(); pintarClientes(); pintarClientesDir(); pintarPres();
  ensureBackupCard();
}

/* ===== Backup/Restore ===== */
function ensureBackupCard(){
  const row=$('#adminQuickRow'); if(!row||$('#backupCard')) return;
  const card=document.createElement('div'); card.className='card mini'; card.id='backupCard';
  card.innerHTML=`<h3>Respaldo</h3><div class="row wrap"><button id="btnExport" class="btn">Exportar JSON</button><label class="btn ghost">Importar JSON<input id="impJson" type="file" accept="application/json" hidden></label></div>`;
  row.appendChild(card);

  $('#btnExport').onclick=()=>{ const data={tax:ST.tax,productos:ST.productos,proyectos:ST.proyectos,hero:ST.hero,clientes:ST.clientes,ventas:ST.ventas,presupuestos:ST.presupuestos,folio:ST.folio}; download('stradivaryus_backup.json',JSON.stringify(data,null,2),'application/json'); toast('Backup exportado'); };

  $('#impJson').onchange=async e=>{ try{ const f=e.target.files?.[0]; if(!f) return; const data=JSON.parse(await f.text());
    ST.tax=Number(data.tax??ST.tax); LS.set('taxRate',ST.tax);
    ST.productos=Array.isArray(data.productos)?data.productos:ST.productos; LS.set('productos',ST.productos);
    ST.proyectos=Array.isArray(data.proyectos)?data.proyectos:ST.proyectos; LS.set('proyectos',ST.proyectos);
    ST.hero=Array.isArray(data.hero)?data.hero:ST.hero; LS.set('hero',ST.hero);
    ST.clientes=Array.isArray(data.clientes)?data.clientes:ST.clientes; LS.set('clientes',ST.clientes);
    ST.ventas=Array.isArray(data.ventas)?data.ventas:ST.ventas; LS.set('ventas',ST.ventas);
    ST.presupuestos=Array.isArray(data.presupuestos)?data.presupuestos:ST.presupuestos; LS.set('presupuestos',ST.presupuestos);
    ST.folio=Number.isFinite(data.folio)?Number(data.folio):ST.folio; LS.set('folio',ST.folio);

    renderHero(); renderHeroAdmin();
    renderProductosCliente(); renderProductosAdmin();
    renderProyectosCliente(); renderProyectosAdmin();
    pintarVentas(); pintarClientes(); pintarClientesDir(); pintarPres();
    renderClientesSel(); updateTotals();
    toast('Backup importado');
  }catch(err){ console.error(err); alert('No se pudo importar el JSON'); } };
}

/* ===== Hero ===== */
let timerHero=null;
function initHero(){ if(!ST.hero.length){ ST.hero=['muro/1.jpg','muro/2.jpg','muro/3.jpg']; LS.set('hero',ST.hero); } renderHero(); setupHeroNav(); }
function renderHero(){
  const cont=$('#heroSlider'); if(!cont) return;
  cont.innerHTML=ST.hero.map((src,i)=>`<img class="hslide${i===0?' active':''}" data-ix="${i}" ${i>0?'loading="lazy"':''} src="${src}" alt="Muro ${i+1}">`).join('');
  cont.querySelectorAll('img').forEach(safeImg);

  const dots=$('#heroDots');
  if(dots){
    dots.innerHTML=ST.hero.map((_,i)=>`<button class="seg${i===0?' active':''}" data-goto="${i}" aria-label="Ir a imagen ${i+1}"></button>`).join('');
    dots.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>showSlide(Number(b.dataset.goto),true));
  }
}
function setupHeroNav(){ $('#hPrev')?.addEventListener('click',()=>showSlide(ST.slideIdx-1,true)); $('#hNext')?.addEventListener('click',()=>showSlide(ST.slideIdx+1,true)); autoHero(); }
function autoHero(){ clearInterval(timerHero); timerHero=setInterval(()=>showSlide(ST.slideIdx+1,false),7000); }
function showSlide(n,user){ const a=$$('#heroSlider .hslide'); if(!a.length) return; ST.slideIdx=(n+a.length)%a.length; a.forEach((s,ix)=>s.classList.toggle('active',ix===ST.slideIdx)); const dots=$$('#heroDots .seg'); dots.forEach((d,ix)=>d.classList.toggle('active',ix===ST.slideIdx)); if(user) autoHero(); }
function renderHeroAdmin(){
  const g=$('#gridHeroAdmin'); if(!g) return;
  g.innerHTML=ST.hero.map((src,ix)=>`
    <div class="thumb" draggable="true" data-ix="${ix}">
      <img loading="lazy" src="${src}" alt="Muro ${ix+1}">
      <button class="chip danger" data-delh="${ix}">Eliminar</button>
    </div>`).join('') || `<div class="muted">Sin imágenes aún</div>`;
  g.querySelectorAll('img').forEach(safeImg);
  g.querySelectorAll('[data-delh]').forEach(b=>b.onclick=()=>{ ST.hero.splice(Number(b.dataset.delh),1); LS.set('hero',ST.hero); renderHero(); renderHeroAdmin(); toast('Imagen eliminada'); });
  enableThumbDnD(g);
}
function enableThumbDnD(container){
  let dragIx=null;
  container.querySelectorAll('.thumb').forEach(el=>{
    el.addEventListener('dragstart',()=>{ dragIx=Number(el.dataset.ix); el.classList.add('dragging'); });
    el.addEventListener('dragend',()=>{ el.classList.remove('dragging'); });
    el.addEventListener('dragover',e=>{ e.preventDefault(); el.style.outline='2px dashed var(--brand)'; });
    el.addEventListener('dragleave',()=>{ el.style.outline=''; });
    el.addEventListener('drop',e=>{
      e.preventDefault(); el.style.outline='';
      const dropIx=Number(el.dataset.ix);
      if(!Number.isInteger(dragIx)||!Number.isInteger(dropIx)||dragIx===dropIx) return;
      const arr=ST.hero.slice(); const [moved]=arr.splice(dragIx,1); arr.splice(dropIx,0,moved);
      ST.hero=arr; LS.set('hero',ST.hero); renderHero(); renderHeroAdmin(); toast('Orden actualizado');
    });
  });
}

/* ===== Productos ===== */
function initProductos(){
  if(!ST.productos.length){
    ST.productos=[
      {id:u(), nombre:'Taladro Inalámbrico', precio:129.99, imgs:['venta/1.jpg'], vendido:false},
      {id:u(), nombre:'Sierra Circular', precio:99.50, imgs:['venta/1.jpg'], vendido:false},
      {id:u(), nombre:'Lijadora Orbital', precio:59.95, imgs:['venta/1.jpg'], vendido:false},
    ];
  }else{
    ST.productos=ST.productos.map(p=>({vendido:false,imgs:[],...p}));
  }
  LS.set('productos',ST.productos);
  renderProductosCliente();

  $('#addProducto')?.addEventListener('click',openFormProducto);
  $('#importProductos')?.addEventListener('change',async e=>{
    const files=e.target.files||[]; if(!files.length) return;
    const imgs=await filesToDataURLCompressed(files,1400,.82);
    imgs.forEach((src,i)=>ST.productos.push({id:u(),nombre:`Imagen ${i+1}`,precio:Math.round(Math.random()*90+10),imgs:[src],vendido:false}));
    LS.set('productos',ST.productos); renderProductosCliente(); renderProductosAdmin(); toast(`Se añadieron ${imgs.length} imagen(es)`); e.target.value='';
  });

  renderProductosAdmin();
}
function cardProdCliente(p){
  const img=p.imgs?.[0]||'venta/1.jpg';
  const sold=p.vendido===true;
  const count=(p.imgs?.length||0);
  const minis=(p.imgs||[]).slice(0,4);
  return `
  <article class="item ${sold?'vendido':''}">
    <div class="img">
      ${count? `<div class="badge-count">${count} foto${count>1?'s':''}</div>`:''}
      <img loading="lazy" src="${img}" alt="${esc(p.nombre)}">
    </div>
    ${minis.length? `<div class="mini-thumbs">${minis.map(s=>`<img loading="lazy" src="${s}" alt="thumb ${esc(p.nombre)}">`).join('')}</div>`:''}
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
function renderProductosCliente(q='',cat=''){
  const grid=$('#gridProductos'); if(!grid) return;
  let list=ST.productos.slice(); if(q) list=list.filter(p=>p.nombre.toLowerCase().includes(q));
  grid.innerHTML=list.map(cardProdCliente).join('');
  grid.querySelectorAll('img').forEach(safeImg);
  grid.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>addCart(b.dataset.add));
  grid.querySelectorAll('[data-lb]').forEach(b=>b.onclick=()=>{ const list=ST.productos.find(x=>x.id===b.dataset.lb)?.imgs||[]; openLB(list,0); track('open_lightbox',{context:'producto',item_id:b.dataset.lb}); });
}
function cardProdAdmin(p){
  const thumbs=(p.imgs||[]).map((src,ix)=>`
    <div class="thumb">
      <img loading="lazy" src="${src}" alt="${esc(p.nombre)} img ${ix+1}">
      <button class="chip danger" data-delimg="${p.id}" data-idx="${ix}">Eliminar</button>
    </div>`).join('') || `<div class="muted">Sin imágenes aún</div>`;
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
      <label class="btn ghost">📥 Añadir imágenes
        <input type="file" accept="image/*" multiple hidden data-addimg="${p.id}">
      </label>
      <button class="btn danger" data-delprod="${p.id}">Eliminar producto</button>
    </div>
  </article>`;
}
function renderProductosAdmin(){
  const grid=$('#gridProductosAdmin'); if(!grid) return;
  grid.innerHTML=ST.productos.map(cardProdAdmin).join('');
  grid.querySelectorAll('img').forEach(safeImg);
  grid.querySelectorAll('[data-addimg]').forEach(inp=> inp.onchange=async e=>{ const imgs=await filesToDataURLCompressed(e.target.files,1400,.82); addImgsProducto(inp.dataset.addimg,imgs); toast('Imágenes añadidas'); e.target.value=''; });
  grid.querySelectorAll('[data-delimg]').forEach(btn=> btn.onclick=()=> { delImgProducto(btn.dataset.delimg, Number(btn.dataset.idx)); toast('Imagen eliminada'); });
  grid.querySelectorAll('[data-delprod]').forEach(btn=> btn.onclick=()=> { delProducto(btn.dataset.delprod); toast('Producto eliminado'); });
  grid.querySelectorAll('[data-view]').forEach(btn=> btn.onclick=()=> openLB(ST.productos.find(x=>x.id===btn.dataset.view)?.imgs||[],0));
  grid.querySelectorAll('[data-togglevend]').forEach(btn=> btn.onclick=()=> { toggleVendido(btn.dataset.togglevend); toast('Estado de venta actualizado'); });
}
function toggleVendido(id){ const p=ST.productos.find(x=>x.id===id); if(!p) return; p.vendido=!p.vendido; LS.set('productos',ST.productos); renderProductosCliente(); renderProductosAdmin(); }
function openFormProducto(){
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
  const inp=$('#pImgs'), cnt=$('#pCount'), prev=$('#pPrev');
  inp.onchange=async e=>{ const files=e.target.files||[]; cnt.textContent=`${files.length} seleccionadas`; prev.innerHTML=''; if(!files.length) return; const datas=await filesToDataURL(files); datas.forEach((src,ix)=>{ const d=document.createElement('div'); d.className='thumb'; d.innerHTML = `<img loading="lazy" src="${src}" alt="img ${ix+1}">`; prev.appendChild(d); }); };
  $('#fProd').onsubmit=async e=>{ e.preventDefault(); const nombre=$('#pNombre').value.trim(); const precio=Number($('#pPrecio').value||0); const imgs=await filesToDataURLCompressed($('#pImgs').files,1400,.82); ST.productos.push({id:u(), nombre, precio, imgs, vendido:false}); LS.set('productos',ST.productos); closeModal(); renderProductosCliente(); renderProductosAdmin(); toast('Producto creado con imágenes'); };
}
function addImgsProducto(id, imgs){ const p=ST.productos.find(x=>x.id===id); if(!p) return; p.imgs=[...(p.imgs||[]), ...imgs]; LS.set('productos',ST.productos); renderProductosCliente(); renderProductosAdmin(); }
function delImgProducto(id, idx){ const p=ST.productos.find(x=>x.id===id); if(!p) return; p.imgs.splice(idx,1); LS.set('productos',ST.productos); renderProductosCliente(); renderProductosAdmin(); }
function delProducto(id){ if(!confirm('¿Eliminar producto completo?')) return; ST.productos=ST.productos.filter(x=>x.id!==id); LS.set('productos',ST.productos); renderProductosCliente(); renderProductosAdmin(); }

/* ===== Proyectos ===== */
function initProyectos(){
  if(!ST.proyectos.length){
    ST.proyectos = [{id:u(), titulo:'Deck 19×22', desc:'Composite', imgs:['proyect1/1.jpg']}];
    LS.set('proyectos', ST.proyectos);
  }
  renderProyectosCliente(); renderProyectosAdmin();

  $('#addProyecto')?.addEventListener('click', openFormProyecto);
  $('#importProyectos')?.addEventListener('change', async e=>{
    const files=e.target.files||[]; if(!files.length) return;
    const imgs = await filesToDataURLCompressed(files, 1400, 0.82);
    ST.proyectos.push({id:u(), titulo:'Proyecto', desc:'', imgs});
    LS.set('proyectos', ST.proyectos);
    renderProyectosCliente(); renderProyectosAdmin();
    toast(`Se añadieron ${imgs.length} imagen(es)`); e.target.value='';
  });
}
function cardProyectoCliente(p){
  const img=p.imgs?.[0] || 'proyect1/1.jpg';
  const count=(p.imgs?.length||0);
  return `
  <article class="item">
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
function renderProyectosCliente(q='',cat=''){
  const g=$('#gridProyectos'); if(!g) return;
  let list=ST.proyectos.slice();
  if(q){ list=list.filter(p=> (p.titulo+' '+(p.desc||'')).toLowerCase().includes(q)); }
  g.innerHTML = list.map(cardProyectoCliente).join('');
  g.querySelectorAll('img').forEach(safeImg);
  g.querySelectorAll('[data-view]').forEach(b=> b.onclick = ()=> {
    const list = ST.proyectos.find(x=>x.id===b.dataset.view)?.imgs || [];
    openLB(list, 0);
    track('open_lightbox', {context:'proyecto', item_id:b.dataset.view});
  });
}
function cardProyectoAdmin(p){
  const thumbs=(p.imgs||[]).map((src,ix)=>`
    <div class="thumb"><img loading="lazy" src="${src}" alt="${esc(p.titulo)} img ${ix+1}">
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
      <span class="muted">${(p.imgs?.length||0)} foto(s)</span>
      <button class="btn danger" data-delproj="${p.id}">Eliminar proyecto</button>
    </div>
  </article>`;
}
function renderProyectosAdmin(){
  const grid=$('#gridProyectosAdmin'); if(!grid) return;
  grid.innerHTML = ST.proyectos.map(cardProyectoAdmin).join('');
  grid.querySelectorAll('img').forEach(safeImg);
  grid.querySelectorAll('[data-addimgp]').forEach(inp=>{
    const pid=inp.dataset.addimgp;
    inp.onchange = async e=>{
      const imgs = await filesToDataURLCompressed(e.target.files, 1400, 0.82);
      addImgsProyecto(pid, imgs);
      toast(`Se añadieron ${imgs.length} imagen(es)`); e.target.value='';
    };
  });
  grid.querySelectorAll('[data-delimgp]').forEach(btn=> btn.onclick = ()=> { delImgProyecto(btn.dataset.delimgp, Number(btn.dataset.idx)); toast('Imagen eliminada'); });
  grid.querySelectorAll('[data-delproj]').forEach(btn=> btn.onclick = ()=> { delProyecto(btn.dataset.delproj); toast('Proyecto eliminado'); });
  grid.querySelectorAll('[data-viewp]').forEach(btn=> btn.onclick = ()=> openLB(ST.proyectos.find(x=>x.id===btn.dataset.viewp)?.imgs||[],0));
}
function openFormProyecto(){
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

  const inp=$('#jImgs'), cnt=$('#jCount'), prev=$('#jPrev');
  inp.onchange = async e=>{
    const files=e.target.files||[];
    cnt.textContent=`${files.length} seleccionadas`;
    prev.innerHTML='';
    if(!files.length) return;
    const datas = await filesToDataURL(files);
    datas.forEach((src,ix)=>{
      const d=document.createElement('div'); d.className='thumb';
      d.innerHTML = `<img loading="lazy" src="${src}" alt="img ${ix+1}">`;
      prev.appendChild(d);
    });
  };

  $('#fProj').onsubmit = async e=>{
    e.preventDefault();
    const titulo=$('#jTitulo').value.trim();
    const desc=$('#jDesc').value.trim();
    const imgs = await filesToDataURLCompressed($('#jImgs').files, 1400, 0.82);
    ST.proyectos.push({id:u(), titulo, desc, imgs});
    LS.set('proyectos', ST.proyectos);
    closeModal();
    renderProyectosCliente(); renderProyectosAdmin();
    toast('Proyecto creado con imágenes');
  };
}
function addImgsProyecto(id, imgs){ const p=ST.proyectos.find(x=>x.id===id); if(!p) return; p.imgs=[...(p.imgs||[]), ...imgs]; LS.set('proyectos', ST.proyectos); renderProyectosCliente(); renderProyectosAdmin(); }
function delImgProyecto(id, idx){ const p=ST.proyectos.find(x=>x.id===id); if(!p) return; p.imgs.splice(idx,1); LS.set('proyectos',ST.proyectos); renderProyectosCliente(); renderProyectosAdmin(); }
function delProyecto(id){ if(!confirm('¿Eliminar proyecto completo?')) return; ST.proyectos=ST.proyectos.filter(x=>x.id!==id); LS.set('proyectos',ST.proyectos); renderProyectosCliente(); renderProyectosAdmin(); }

/* ===== Carrito / Ventas ===== */
function initCarrito(){
  renderClientesSel(); renderCarrito();
  $('#btnAddCliente')?.addEventListener('click',()=>openFormCliente(true));
  $('#metodoPago')?.addEventListener('change',()=>{ const v=$('#metodoPago').value; $('#montoEfectivo')?.classList.toggle('hidden', v!=='efectivo'); $('#qrBox')?.classList.toggle('hidden', v!=='zelle'); track('begin_checkout', {method: v||'n/a'}); });
  $('#btnPagar')?.addEventListener('click', pagar);
}
function renderClientesSel(){
  if(!ST.clientes.length){
    ST.clientes=[{id:'general',nombre:'Cliente General',email:'',empresa:'',telefono:'',direccion:'',compras:0,total:0,ultima:'',createdAt:''}];
    LS.set('clientes',ST.clientes);
  }
  const sel=$('#clienteSel'); if(!sel) return;
  sel.innerHTML=`<option value="general">— Regístrate para comprar —</option>`+
    ST.clientes.filter(c=>c.id!=='general').map(c=>`<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
}
function openFormCliente(required=false){
  openModal(required?'Registro de cliente (requerido)':'Nuevo cliente', `
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

  $('#fCli').onsubmit=(e)=>{
    e.preventDefault();
    const c={
      id:u(),
      nombre:$('#cNombre').value.trim(),
      telefono:$('#cTel').value.trim(),
      direccion:$('#cDir').value.trim(),
      empresa:$('#cEmpresa').value.trim(),
      email:$('#cEmail').value.trim(),
      compras:0,total:0,ultima:'',createdAt:new Date().toLocaleString()
    };
    if(!c.nombre || !c.telefono) return alert('Nombre y teléfono son obligatorios');
    ST.clientes.push(c); LS.set('clientes',ST.clientes);
    renderClientesSel(); $('#clienteSel').value=c.id;
    pintarClientes(); pintarClientesDir(); closeModal(); toast('Cliente registrado');
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
  ul.querySelectorAll('img').forEach(safeImg);
  ul.querySelectorAll('[data-less]').forEach(b=>b.onclick=()=>qty(b.dataset.less,-1));
  ul.querySelectorAll('[data-plus]').forEach(b=>b.onclick=()=>qty(b.dataset.plus,1));
  ul.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>delCart(b.dataset.del));
  updateTotals();
}
function qty(ix, d){ ix=Number(ix); ST.carrito[ix].cant+=d; if(ST.carrito[ix].cant<=0) ST.carrito.splice(ix,1); LS.set('carrito',ST.carrito); renderCarrito(); }
function delCart(ix){ ST.carrito.splice(Number(ix),1); LS.set('carrito',ST.carrito); renderCarrito(); }
function updateTotals(){ const sub=ST.carrito.reduce((s,i)=>s+i.precio*i.cant,0); const imp=sub*(ST.tax/100); const tot=sub+imp; $('#subTxt')?.textContent=cur(sub); $('#taxRateTxt')?.textContent=cur(ST.tax); $('#taxTxt')?.textContent=cur(imp); $('#totTxt')?.textContent=cur(tot); }
async function pagar(){
  if(!ST.carrito.length) return alert('Carrito vacío');
  const cliId=$('#clienteSel').value; const cli=ST.clientes.find(c=>c.id===cliId);
  if(!cli || cli.id==='general' || !cli.telefono){ alert('Para comprar debes registrarte con Nombre y Teléfono.'); return openFormCliente(true); }
  const metodo=$('#metodoPago').value; if(!metodo) return alert('Selecciona método');
  const sub=Number($('#subTxt').textContent), imp=Number($('#taxTxt').textContent), tot=Number($('#totTxt').textContent);
  let zelleId=null;
  if(metodo==='zelle'){
    zelleId = prompt('Ingresa el ID/Referencia de Zelle');
    if(!zelleId) return alert('Pago cancelado');
  } else if(metodo==='efectivo'){
    const ent=Number($('#montoEfectivo').value||0); if(ent<tot) return alert('Efectivo insuficiente');
  }
  const venta={
    id:'V'+String(ST.folio).padStart(5,'0'),
    fecha:new Date().toLocaleString(), cliente:cli.nombre, direccion: cli.direccion || '',
    items:ST.carrito.map(i=>({n:i.nombre,c:i.cant,p:i.precio,id:i.id})),
    subtotal:sub, impuesto:imp, total:tot, metodo, zelle: zelleId ? {id:zelleId, proof:null} : null
  };
  ST.ventas.unshift(venta); ST.folio++; LS.set('ventas',ST.ventas); LS.set('folio',ST.folio);
  cli.compras=(cli.compras||0)+1; cli.total=Number(cli.total||0)+tot; cli.ultima=venta.fecha; LS.set('clientes',ST.clientes);
  venta.items.forEach(it=>{ const p = ST.productos.find(x=>x.id===it.id); if(p) p.vendido = true; });
  LS.set('productos', ST.productos);
  ST.carrito=[]; LS.set('carrito',ST.carrito);
  renderCarrito(); pintarRecibo(venta); pintarVentas(); pintarClientes(); pintarClientesDir(); renderProductosCliente(); renderProductosAdmin();
  track('purchase', {value: tot, tax: imp, currency: 'USD', items: venta.items.map(i=>({id:i.id,name:i.n,price:i.p,quantity:i.c}))});
  toast('Compra registrada');
}
function pintarRecibo(v){
  const box=$('#reciboBox'); if(!box) return;
  box.classList.remove('hidden');
  box.innerHTML = `
    <h3>Recibo #${v.id}</h3>
    <p class="muted">${v.fecha} · <em>haz clic para imprimir</em></p>
    <div id="receiptArea" class="table-wrap" style="cursor:pointer">
      <table>
        <thead><tr><th>Producto</th><th>Cant</th><th>Precio</th><th>Importe</th></tr></thead>
        <tbody>${v.items.map(it=>`
          <tr>
            <td>${esc(it.n)}</td>
            <td>${it.c}</td>
            <td>$${cur(it.p)}</td>
            <td>$${cur(it.p*it.c)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr><td colspan="3" style="text-align:right">Subtotal</td><td>$${cur(v.subtotal)}</td></tr>
          <tr><td colspan="3" style="text-align:right">Impuesto</td><td>$${cur(v.impuesto)}</td></tr>
          <tr><td colspan="3" style="text-align:right"><strong>Total</strong></td><td><strong>$${cur(v.total)}</strong></td></tr>
          <tr><td colspan="3" style="text-align:right">Método</td><td>${v.metodo}${v.zelle&&v.zelle.id? ' · ID: '+esc(v.zelle.id) : ''}</td></tr>
        </tfoot>
      </table>
    </div>`;
  $('#receiptArea')?.addEventListener('click',()=>printRecibo(v));
}
function printRecibo(v){
  const w=window.open('','_blank'); if(!w) return;
  const rows=v.items.map(it=>`<tr><td>${esc(it.n)}</td><td>${it.c}</td><td>$${cur(it.p)}</td><td>$${cur(it.p*it.c)}</td></tr>`).join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Recibo ${v.id}</title>
  <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto; padding:16px;} table{width:100%; border-collapse:collapse} th,td{border:1px solid #ccc; padding:8px; text-align:left} tfoot td{text-align:right}</style>
  </head><body>
  <h2>Stradivaryus Tools</h2>
  <h3>Recibo #${v.id}</h3>
  <p>${v.fecha}</p>
  <table><thead><tr><th>Producto</th><th>Cant</th><th>Precio</th><th>Importe</th></tr></thead><tbody>${rows}</tbody>
  <tfoot>
  <tr><td colspan="3">Subtotal</td><td>$${cur(v.subtotal)}</td></tr>
  <tr><td colspan="3">Impuesto</td><td>$${cur(v.impuesto)}</td></tr>
  <tr><td colspan="3"><strong>Total</strong></td><td><strong>$${cur(v.total)}</strong></td></tr>
  <tr><td colspan="3">Método</td><td>${v.metodo}${v.zelle&&v.zelle.id?' · ID: '+esc(v.zelle.id):''}</td></tr>
  </tfoot></table>
  <script>window.onload=()=>{window.print(); setTimeout(()=>window.close(),250);}</script>
  </body></html>`);
  w.document.close();
}

/* ===== Ventas / Clientes (admin) ===== */
function pintarVentas(){
  const cont=$('#ventasTbl'); if(!cont) return;
  cont.innerHTML=`
  <div class="table-wrap"><table>
    <thead><tr><th>Folio</th><th>Fecha</th><th>Cliente</th><th class="num">Total</th><th>Método</th></tr></thead>
    <tbody>${ST.ventas.map(v=>`<tr><td>${v.id}</td><td>${v.fecha}</td><td>${esc(v.cliente)}</td><td class="num">$${cur(v.total)}</td><td>${v.metodo}</td></tr>`).join('')}</tbody>
  </table></div>`;
}
function pintarClientes(){
  const cont=$('#clientesTbl'); if(!cont) return;
  cont.innerHTML=`
  <div class="table-wrap"><table>
    <thead><tr><th>Cliente</th><th>Teléfono</th><th>Empresa</th><th>Compras</th><th class="num">Total</th><th>Última</th></tr></thead>
    <tbody>${ST.clientes.filter(c=>c.id!=='general').map(c=>`<tr><td>${esc(c.nombre)}</td><td>${esc(c.telefono||'')}</td><td>${esc(c.empresa||'')}</td><td>${c.compras||0}</td><td class="num">$${cur(c.total||0)}</td><td>${esc(c.ultima||'')}</td></tr>`).join('')}</tbody>
  </table></div>`;
}
function pintarClientesDir(){
  const col=$('#clientesDir'); if(!col) return;
  col.innerHTML=ST.clientes.filter(c=>c.id!=='general').map(c=>`
    <div class="card mini">
      <strong>${esc(c.nombre)}</strong>
      <div class="muted">${esc(c.telefono||'')}</div>
      <div class="muted">${esc(c.email||'')}</div>
      <div class="muted">${esc(c.direccion||'')}</div>
    </div>`).join('') || `<div class="muted">Sin clientes</div>`;
}

/* ===== Presupuestos (admin básico) ===== */
function initPresupuestoAdmin(){
  $('#btnNewPres')?.addEventListener('click',()=>{
    const p={ id:'P'+u().slice(-5), fecha:new Date().toLocaleDateString(), cliente:'Cliente', concepto:'Servicio', monto:100, notas:'' };
    ST.presupuestos.unshift(p); LS.set('presupuestos',ST.presupuestos); pintarPres(); toast('Presupuesto creado');
  });
  pintarPres();
}
function pintarPres(){
  const cont=$('#presTbl'); if(!cont) return;
  cont.innerHTML=`<div class="table-wrap"><table>
    <thead><tr><th>Folio</th><th>Fecha</th><th>Cliente</th><th>Concepto</th><th class="num">Monto</th></tr></thead>
    <tbody>${(ST.presupuestos||[]).map(p=>`<tr><td>${p.id}</td><td>${p.fecha}</td><td>${esc(p.cliente)}</td><td>${esc(p.concepto)}</td><td class="num">$${cur(p.monto)}</td></tr>`).join('')}</tbody>
  </table></div>`;
}

/* ===== Lightbox ===== */
function lightboxInit(){
  const lb=document.createElement('div'); lb.id='lb'; lb.innerHTML=`
  <div id="lbMask"></div>
  <div id="lbBox">
    <img id="lbImg" alt="">
    <button id="lbPrev">‹</button>
    <button id="lbNext">›</button>
    <button id="lbClose">✕</button>
    <div id="lbZoom"><button id="zOut">−</button><span id="zVal">100%</span><button id="zIn">＋</button></div>
  </div>`; document.body.appendChild(lb);
  $('#lbMask').onclick=$('#lbClose').onclick=()=>lb.classList.remove('show');
  $('#lbPrev').onclick=()=>lbGo(-1); $('#lbNext').onclick=()=>lbGo(1);
  $('#zIn').onclick=()=>lbZoom(1.2); $('#zOut').onclick=()=>lbZoom(1/1.2);
}
function openLB(list=[],idx=0){ ST.lb={list,idx,zoom:1,open:true}; $('#lbImg').src=list[idx]||''; $('#zVal').textContent='100%'; $('#lb').classList.add('show'); }
function lbGo(d){ if(!ST.lb.list.length) return; ST.lb.idx=(ST.lb.idx+d+ST.lb.list.length)%ST.lb.list.length; $('#lbImg').src=ST.lb.list[ST.lb.idx]; }
function lbZoom(f){ ST.lb.zoom=Math.min(5,Math.max(.5,ST.lb.zoom*f)); $('#lbImg').style.transform=`scale(${ST.lb.zoom})`; $('#zVal').textContent=Math.round(ST.lb.zoom*100)+'%'; }

/* ===== Modal ===== */
function openModal(title,html){ let m=$('#modal'); if(!m){ m=document.createElement('div'); m.id='modal'; m.innerHTML=`<div class="mask"></div><div class="box"><div class="head"><strong id="mTitle"></strong><button id="mClose" class="chip">✕</button></div><div class="body" id="mBody"></div></div>`; document.body.appendChild(m); $('#mClose').onclick=closeModal; $('.mask',m).onclick=closeModal; } $('#mTitle').textContent=title||''; $('#mBody').innerHTML=html||''; m.style.display='block'; }
function closeModal(){ $('#modal')?.style.setProperty('display','none'); }

/* ===== Theme ===== */
function themeInit(){ const t=LS.get('theme',null); if(t) document.documentElement.setAttribute('data-theme',t); }
function setupThemeSwitch(){ $('#themeToggle')?.addEventListener('click',()=>{ const cur=document.documentElement.getAttribute('data-theme')==='light'?'dark':'light'; document.documentElement.setAttribute('data-theme',cur); LS.set('theme',cur); }); }

/* ===== FAB ===== */
function setupDraggableFab(){
  const fab=$('#fab'); if(!fab) return; let dx=0,dy=0,drag=false;
  fab.addEventListener('pointerdown',e=>{ drag=true; fab.setPointerCapture(e.pointerId); dx=e.clientX-fab.offsetLeft; dy=e.clientY-fab.offsetTop; });
  fab.addEventListener('pointermove',e=>{ if(!drag) return; fab.style.left=(e.clientX-dx)+'px'; fab.style.top=(e.clientY-dy)+'px'; });
  fab.addEventListener('pointerup',()=>drag=false);
}

/* ===== Estética opcional: scroll, reveal, tilt, ripple ===== */
function initAesthetics(){
  const header=$('.header'); const onScroll=()=>header?.classList.toggle('is-scrolled',scrollY>4); onScroll(); addEventListener('scroll',onScroll,{passive:true});
  const els=[...document.querySelectorAll('.card,.item,.reveal')]; els.forEach(el=>el.classList.add('reveal')); const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }),{threshold:.12}); els.forEach(el=>io.observe(el));
  const clicky=ev=>{ const el=ev.currentTarget, r=el.getBoundingClientRect(); const x=ev.clientX-r.left, y=ev.clientY-r.top; el.style.setProperty('--rx',`${x}px`); el.style.setProperty('--ry',`${y}px`); el.classList.add('is-anim'); clearTimeout(el.__rt); el.__rt=setTimeout(()=>el.classList.remove('is-anim'),550); };
  document.querySelectorAll('.btn,.chip').forEach(b=>{ b.classList.add('ripple'); b.addEventListener('click',clicky); });
  document.querySelectorAll('.item,.card').forEach(el=>{ let raf=null; el.classList.add('tilt-3d'); const onMove=e=>{ const r=el.getBoundingClientRect(); const cx=(e.clientX-r.left)/r.width-.5, cy=(e.clientY-r.top)/r.height-.5; const rx=cy*6, ry=-cx*6; cancelAnimationFrame(raf); raf=requestAnimationFrame(()=>el.style.transform=`perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`); }; const reset=()=>{ cancelAnimationFrame(raf); el.style.transform=''; }; el.addEventListener('mousemove',onMove); el.addEventListener('mouseleave',reset); });
}

})(); 
