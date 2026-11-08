let state = { width:1080, height:1080, elements:[], activeId:null, zoom:0.5, drag:null, idCounter:0, history:[], historyIdx:-1 };
const cv = document.getElementById('mainCanvas');
const ctx = cv.getContext('2d');

const PRESETS = [{n:'IG Post',w:1080,h:1080},{n:'Story',w:1080,h:1920},{n:'YT Thumb',w:1280,h:720},{n:'Poster',w:1080,h:1350}];
const SHAPES = ['rect','circle','triangle','star','line','diamond','hexagon','pentagon'];
const ICONS = ['★','♥','✦','☀','☁','⚡','✓','✗','→','←','↑','↓'];

// --- HISTORY ---
function saveHistory(){
  if (state.historyIdx < state.history.length - 1) state.history = state.history.slice(0, state.historyIdx + 1);
  state.history.push(JSON.stringify({...state, drag:null}));
  if (state.history.length > 50) state.history.shift();
  state.historyIdx = state.history.length - 1;
  updateUndoRedo();
}
function undo(){ if(state.historyIdx>0){ state.historyIdx--; loadState(state.history[state.historyIdx]); updateUndoRedo(); } }
function redo(){ if(state.historyIdx<state.history.length-1){ state.historyIdx++; loadState(state.history[state.historyIdx]); updateUndoRedo(); } }
function loadState(snap){
  const d = JSON.parse(snap); state.width=d.width; state.height=d.height; state.elements=d.elements; state.activeId=d.activeId; state.idCounter=d.idCounter;
  render(); renderLayers(); renderProps();
}
function updateUndoRedo(){
  const u = document.getElementById('undoBtn'), r = document.getElementById('redoBtn');
  if(u) u.disabled = state.historyIdx <= 0;
  if(r) r.disabled = state.historyIdx >= state.history.length - 1;
}

// --- RENDER ---
function render(){
  cv.width = state.width; cv.height = state.height;
  cv.style.width = (state.width*state.zoom)+'px'; cv.style.height = (state.height*state.zoom)+'px';
  ctx.clearRect(0,0,cv.width,cv.height);
  ctx.save(); ctx.scale(state.zoom, state.zoom);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,state.width,state.height);
  state.elements.forEach(e => drawEl(e));
  ctx.restore();
  document.getElementById('zoomVal').textContent = Math.round(state.zoom*100)+'%';
  document.getElementById('docSize').textContent = `${state.width} × ${state.height}`;
}

function drawEl(e){
  if (e.hidden) return;
  ctx.save(); ctx.globalAlpha = e.opacity ?? 1;
  const cx = e.x+e.w/2, cy = e.y+e.h/2;
  ctx.translate(cx, cy); if(e.rot) ctx.rotate(e.rot*Math.PI/180); ctx.translate(-cx, -cy);

  if(e.type==='text'){
    const lines = (e.text||'').split('\n'); ctx.font = `${e.bold?'bold ':''}${e.size}px ${e.font}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    lines.forEach((l,i)=>{ ctx.fillStyle = e.color; ctx.fillText(l, e.x, e.y + i*(e.size*1.2)); });
    e.w = Math.max(...lines.map(l=>ctx.measureText(l).width), 20); e.h = lines.length*e.size*1.2;
  } else if(e.type==='shape'){
    const r = Math.min(e.w,e.h)/2; ctx.beginPath();
    if(e.shape==='rect') ctx.rect(e.x,e.y,e.w,e.h);
    else if(e.shape==='circle') ctx.arc(cx,cy,r,0,Math.PI*2);
    else if(e.shape==='triangle'){ ctx.moveTo(cx,e.y); ctx.lineTo(e.x+e.w,e.y+e.h); ctx.lineTo(e.x,e.y+e.h); ctx.closePath(); }
    else if(e.shape==='star'){ for(let i=0;i<10;i++){ const r2=i%2===0?r:r*0.45; const a=-Math.PI/2+i*Math.PI/5; const x=cx+r2*Math.cos(a),y=cy+r2*Math.sin(a); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); } ctx.closePath(); }
    else if(e.shape==='line'){ ctx.moveTo(e.x,e.y); ctx.lineTo(e.x+e.w,e.y+e.h); }
    ctx.fillStyle = e.fill; ctx.fill();
    if(e.stroke){ ctx.lineWidth = e.strokeW; ctx.strokeStyle = e.stroke; ctx.stroke(); }
  } else if(e.type==='icon'){
    ctx.font = `${e.size}px Arial`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=e.color; ctx.fillText(e.char, cx, cy);
  } else if(e.type==='image' && e.img){
    ctx.drawImage(e.img, e.x, e.y, e.w, e.h);
  }
  
  if(e.id === state.activeId){ ctx.strokeStyle='#0000ff'; ctx.lineWidth=2/state.zoom; ctx.setLineDash([5/state.zoom, 5/state.zoom]); ctx.strokeRect(e.x,e.y,e.w,e.h); ctx.setLineDash([]); }
  ctx.restore();
}

// --- INTERACTION ---
function getXY(e){ const r=cv.getBoundingClientRect(); const cx=e.touches?e.touches[0].clientX:e.clientX, cy=e.touches?e.touches[0].clientY:e.clientY; return {x:(cx-r.left)/state.zoom, y:(cy-r.top)/state.zoom}; }
function startDrag(e){
  e.preventDefault(); const {x,y} = getXY(e);
  let hit = null; for(let i=state.elements.length-1;i>=0;i--){ const el=state.elements[i]; if(!el.hidden && x>=el.x && x<=el.x+el.w && y>=el.y && y<=el.y+el.h){ hit=el; break; } }
  if(hit){ state.activeId=hit.id; state.drag={id:hit.id, sx:x, sy:y, ox:hit.x, oy:hit.y}; render(); renderProps(); }
  else { state.activeId=null; render(); renderProps(); }
}
function moveDrag(e){
  if(!state.drag) return; const {x,y} = getXY(e); const el=state.elements.find(el=>el.id===state.drag.id);
  if(el){ el.x = state.drag.ox + (x-state.drag.sx); el.y = state.drag.oy + (y-state.drag.sy); render(); }
}
function endDrag(){ if(state.drag){ state.drag=null; saveHistory(); renderLayers(); } }
window.addEventListener('mousemove', moveDrag); window.addEventListener('mouseup', endDrag);
window.addEventListener('touchmove', moveDrag, {passive:false}); window.addEventListener('touchend', endDrag);

// --- FACTORY ---
function addText(preset){
  const size = preset==='heading'?96 : preset==='subtext'?56 : 32;
  const e = {id:++state.idCounter, type:'text', x:100, y:100, text:'Teks Baru', font:"'Space Grotesk',sans-serif", size, bold:preset==='heading', color:'#000000', opacity:1, rot:0};
  state.elements.push(e); state.activeId=e.id; saveHistory(); render(); renderLayers(); renderProps();
}
function addShape(shape){
  const e = {id:++state.idCounter, type:'shape', shape, x:state.width/2-120, y:state.height/2-120, w:240, h:240, fill:'#e0e0e0', stroke:'#000000', strokeW:2, opacity:1, rot:0};
  if(shape==='line'){ e.h=0; e.fill='transparent'; e.strokeW=4; }
  state.elements.push(e); state.activeId=e.id; saveHistory(); render(); renderLayers(); renderProps();
}
function addIcon(ch){
  const e = {id:++state.idCounter, type:'icon', char:ch, x:state.width/2-60, y:state.height/2-60, w:120, h:120, size:120, color:'#000000', opacity:1, rot:0};
  state.elements.push(e); state.activeId=e.id; saveHistory(); render(); renderLayers(); renderProps();
}
function handleUpload(ev){
  const file = ev.target.files[0]; if(!file) return;
  const rd = new FileReader();
  rd.onload = e => { const img = new Image(); img.onload = () => {
    let w=img.width, h=img.height; const ratio = Math.min((state.width*0.6)/w, (state.height*0.6)/h, 1); w*=ratio; h*=ratio;
    const el = {id:++state.idCounter, type:'image', img, x:(state.width-w)/2, y:(state.height-h)/2, w, h, opacity:1, rot:0};
    state.elements.push(el); state.activeId=el.id; saveHistory(); render(); renderLayers(); renderProps();
  }; img.src = e.target.result; };
  rd.readAsDataURL(file);
}

// --- PANELS ---
function renderLayers(){
  const list = document.getElementById('layersList'); list.innerHTML = '';
  [...state.elements].reverse().forEach(e => {
    const d = document.createElement('div'); d.className = 'layer-row' + (e.id===state.activeId?' active':'');
    d.innerHTML = `<span>${e.type==='text'?'T':e.type==='shape'?'▭':e.type==='image'?'🖼':'✦'} ${e.type.toUpperCase()}</span> <button onclick="delEl(${e.id}, event)">✕</button>`;
    d.onclick = (ev) => { if(ev.target.tagName!=='BUTTON'){ state.activeId=e.id; render(); renderLayers(); renderProps(); } };
    list.appendChild(d);
  });
}
function delEl(id, ev){ ev.stopPropagation(); state.elements = state.elements.filter(x=>x.id!==id); if(state.activeId===id) state.activeId=null; saveHistory(); render(); renderLayers(); renderProps(); }

function renderProps(){
  const e = state.elements.find(x=>x.id===state.activeId);
  const empty = document.getElementById('propsEmpty'), content = document.getElementById('propsContent');
  if(!e){ empty.hidden=false; content.hidden=true; return; }
  empty.hidden=true; content.hidden=false;
  
  let html = `
    <label class="lbl">Posisi X</label><input type="range" min="0" max="${state.width}" value="${e.x}" oninput="updateProp('x', this.value)">
    <label class="lbl">Posisi Y</label><input type="range" min="0" max="${state.height}" value="${e.y}" oninput="updateProp('y', this.value)">
  `;
  
  if(e.type==='text'){
    html += `
      <label class="lbl">Teks</label><textarea oninput="updateProp('text', this.value)">${e.text}</textarea>
      <label class="lbl">Warna</label><div class="color-row"><input type="color" value="${e.color}" oninput="updateProp('color', this.value)"></div>
      <label class="lbl">Ukuran</label><input type="range" min="10" max="200" value="${e.size}" oninput="updateProp('size', this.value)">
    `;
  } else if(e.type==='shape'){
    html += `
      <label class="lbl">Warna</label><div class="color-row"><input type="color" value="${e.fill}" oninput="updateProp('fill', this.value)"></div>
      <label class="lbl">Lebar</label><input type="range" min="10" max="1000" value="${e.w}" oninput="updateProp('w', this.value)">
      <label class="lbl">Tinggi</label><input type="range" min="10" max="1000" value="${e.h}" oninput="updateProp('h', this.value)">
    `;
  }
  
  html += `<label class="lbl">Rotasi</label><input type="range" min="-180" max="180" value="${e.rot}" oninput="updateProp('rot', this.value)">`;
  content.innerHTML = html;
}
function updateProp(k, v){ 
  const e=state.elements.find(x=>x.id===state.activeId); 
  if(e){ e[k] = (k==='text'||k==='color'||k==='fill')?v:Number(v); render(); } 
}

// --- UI LOGIC ---
function switchTab(id, btn){
  document.querySelectorAll('.sidebar.left .side-tab').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.sidebar.left .side-panel').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active'); document.getElementById('panel-'+id).classList.add('active');
}
function switchRTab(id, btn){
  document.querySelectorAll('.sidebar.right .side-tab').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.sidebar.right .side-panel').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active'); document.getElementById('panel-'+id).classList.add('active');
}
function zoomIn(){ state.zoom = Math.min(state.zoom + 0.1, 3); render(); }
function zoomOut(){ state.zoom = Math.max(state.zoom - 0.1, 0.1); render(); }
function zoomFit(){ 
  const area = document.getElementById('canvasArea').getBoundingClientRect();
  state.zoom = Math.min((area.width-60)/state.width, (area.height-60)/state.height); 
  render(); 
}
function newDesign(){ if(confirm('Buat desain baru?')){ state.elements=[]; state.activeId=null; saveHistory(); render(); renderLayers(); renderProps(); } }

// --- EXPORT ---
function openExport(){ document.getElementById('exportModal').hidden=false; }
function closeExport(){ document.getElementById('exportModal').hidden=true; }
function doExport(){
  const fmt = document.getElementById('exportFmt').value;
  const a = document.createElement('a'); a.download = `alca-canva.${fmt}`;
  a.href = cv.toDataURL(`image/${fmt}`); a.click(); closeExport();
}

// --- INIT ---
function init(){
  const pGrid = document.getElementById('presetGrid');
  PRESETS.forEach(p => { 
    const b=document.createElement('button'); b.className='preset-btn'; b.innerHTML = `${p.n}<div style="font-size:9px;opacity:.6;margin-top:2px">${p.w}×${p.h}</div>`; 
    b.onclick=()=>{ state.width=p.w; state.height=p.h; saveHistory(); render(); }; 
    pGrid.appendChild(b); 
  });
  
  const sGrid = document.getElementById('shapeGrid');
  SHAPES.forEach(s => { 
    const b=document.createElement('button'); b.className='shape-btn'; b.textContent=s[0].toUpperCase(); b.title=s; 
    b.onclick=()=>addShape(s); sGrid.appendChild(b); 
  });
  
  const iGrid = document.getElementById('iconGrid');
  ICONS.forEach(i => { 
    const b=document.createElement('button'); b.className='shape-btn'; b.textContent=i; 
    b.onclick=()=>addIcon(i); iGrid.appendChild(b); 
  });

  saveHistory(); render(); 
  setTimeout(zoomFit, 100);
}

document.addEventListener('DOMContentLoaded', init);
