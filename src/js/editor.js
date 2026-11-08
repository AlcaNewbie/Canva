'use strict';

const state = {
  width: 1080, height: 1080,
  background: { type: 'solid', value: '#0a0a0a' },
  elements: [],
  activeId: null,
  zoom: 1,
  history: [],
  historyIdx: -1,
  maxHistory: 50,
  drag: null,
  idCounter: 0,
};

const cv = document.getElementById('mainCanvas');
const ctx = cv.getContext('2d');
const uid = () => ++state.idCounter;
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const el = id => document.getElementById(id);

const CANVAS_PRESETS = [
  { name:'IG Post', w:1080, h:1080 }, { name:'IG Story', w:1080, h:1920 },
  { name:'YT Thumb', w:1280, h:720 }, { name:'A4 Print', w:2480, h:3508 },
  { name:'Poster', w:1080, h:1350 }, { name:'Twitter', w:1500, h:500 },
  { name:'FB Cover', w:820, h:312 }, { name:'Slide 16:9', w:1920, h:1080 },
];

const COLOR_SWATCHES = [
  '#0a0a0a','#111111','#1a1a1a','#2a2a2a','#444444','#666666',
  '#ffffff','#f5f5f5','#e0e0e0','#cccccc','#999999','#777777',
  '#ff006e','#ff4d6d','#ffb703','#fb8500','#8338ec','#3a86ff',
  '#06ffa5','#00d9ff','#38b000','#d00000','#370617','#6a040f',
];

const GRADIENTS = [
  ['#0a0a0a','#2a2a2a'], ['#1a1a1a','#444444'], ['#ffffff','#cccccc'],
  ['#0a0a0a','#370617'], ['#000000','#3a86ff'], ['#06ffa5','#3a86ff'],
  ['#ff006e','#8338ec'], ['#fb8500','#ffb703'], ['#3a86ff','#06ffa5'],
  ['#8338ec','#ff006e'], ['#38b000','#06ffa5'], ['#d00000','#370617'],
];

const SHAPES = [
  { id:'rect', ico:'▭', name:'Rectangle' }, { id:'circle', ico:'●', name:'Circle' },
  { id:'triangle', ico:'▲', name:'Triangle' }, { id:'star', ico:'★', name:'Star' },
  { id:'line', ico:'╱', name:'Line' }, { id:'diamond', ico:'◆', name:'Diamond' },
  { id:'hexagon', ico:'⬡', name:'Hexagon' }, { id:'pentagon', ico:'⬠', name:'Pentagon' },
];

const ICONS = [
  '★','♥','✦','☀','☁','⚡','✓','✗','→','←','↑','↓',
  '🔥','💡','🎯','💎','🚀','🌈','⚙','📷','🎨','🎵',
];

const FONTS = [
  { label:'Space Grotesk', value:"'Space Grotesk',sans-serif", css:'font-family:"Space Grotesk",sans-serif' },
  { label:'JetBrains Mono', value:"'JetBrains Mono',monospace", css:'font-family:"JetBrains Mono",monospace' },
  { label:'Arial', value:'Arial,sans-serif', css:'font-family:Arial,sans-serif' },
  { label:'Georgia', value:'Georgia,serif', css:'font-family:Georgia,serif' },
  { label:'Impact', value:'Impact,sans-serif', css:'font-family:Impact,sans-serif' },
  { label:'Courier', value:"'Courier New',monospace", css:'font-family:"Courier New",monospace' },
  { label:'Verdana', value:'Verdana,sans-serif', css:'font-family:Verdana,sans-serif' },
  { label:'Times', value:"'Times New Roman',serif", css:'font-family:"Times New Roman",serif' },
];

// ═══════════════════ HISTORY ═══════════════════
function snapshot(){
  return JSON.stringify({
    width:state.width, height:state.height, background:state.background,
    elements:state.elements.map(e => e.type==='image' ? {...e, img:undefined} : {...e}),
    idCounter:state.idCounter,
  });
}
function pushHistory(){
  if (state.historyIdx < state.history.length - 1) state.history = state.history.slice(0, state.historyIdx + 1);
  state.history.push(snapshot());
  if (state.history.length > state.maxHistory) state.history.shift();
  state.historyIdx = state.history.length - 1;
  updateUndoRedo();
}
function applySnapshot(snap){
  const data = JSON.parse(snap);
  state.width = data.width; state.height = data.height; state.background = data.background; state.idCounter = data.idCounter;
  state.elements = data.elements.map(e => {
    if (e.type==='image' && e.src){ const img = new Image(); img.src = e.src; return {...e, img}; }
    return {...e};
  });
  state.activeId = null; renderAll();
}
function undo(){ if (state.historyIdx > 0){ state.historyIdx--; applySnapshot(state.history[state.historyIdx]); updateUndoRedo(); } }
function redo(){ if (state.historyIdx < state.history.length - 1){ state.historyIdx++; applySnapshot(state.history[state.historyIdx]); updateUndoRedo(); } }
function updateUndoRedo(){ el('undoBtn').disabled = state.historyIdx <= 0; el('redoBtn').disabled = state.historyIdx >= state.history.length - 1; }

// ═══════════════════ RENDER ═══════════════════
function renderAll(){ renderCanvas(); renderLayers(); renderProps(); el('docSize').textContent = `${state.width} × ${state.height}`; }

function renderCanvas(){
  cv.width = state.width; cv.height = state.height;
  cv.style.width = (state.width * state.zoom) + 'px'; cv.style.height = (state.height * state.zoom) + 'px';
  ctx.clearRect(0,0,cv.width,cv.height);
  ctx.save(); ctx.scale(state.zoom, state.zoom);
  
  const b = state.background;
  if (b.type === 'solid'){ ctx.fillStyle = b.value; ctx.fillRect(0,0,state.width,state.height); }
  else if (b.type === 'gradient'){ const g = ctx.createLinearGradient(0,0,state.width,state.height); g.addColorStop(0, b.value[0]); g.addColorStop(1, b.value[1]); ctx.fillStyle = g; ctx.fillRect(0,0,state.width,state.height); }
  else if (b.type === 'image' && b.img){ ctx.drawImage(b.img,0,0,state.width,state.height); }
  
  state.elements.forEach(e => { if (!e.hidden) drawElement(ctx, e); });
  
  if (state.activeId !== null){
    const a = state.elements.find(e => e.id === state.activeId);
    if (a && !a.hidden) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 / state.zoom; ctx.setLineDash([6/state.zoom, 4/state.zoom]);
      ctx.strokeRect(a.x, a.y, a.w||0, a.h||0); ctx.setLineDash([]);
      const hs = 8/state.zoom; ctx.fillStyle = '#fff';
      [[a.x,a.y],[a.x+(a.w||0),a.y],[a.x,a.y+(a.h||0)],[a.x+(a.w||0),a.y+(a.h||0)]].forEach(([x,y]) => ctx.fillRect(x-hs/2,y-hs/2,hs,hs));
    }
  }
  ctx.restore(); el('zoomVal').textContent = Math.round(state.zoom*100)+'%';
}

function drawElement(c, e){
  c.save(); c.globalAlpha = e.opacity ?? 1;
  const cx = e.x + (e.w||0)/2, cy = e.y + (e.h||0)/2;
  c.translate(cx, cy); if (e.rot) c.rotate(e.rot * Math.PI / 180); c.translate(-cx, -cy);

  if (e.type === 'text') {
    const lines = (e.text||'').split('\n'); const lh = (e.size||48) * 1.2;
    c.font = `${e.italic?'italic ':''}${e.bold?'bold ':''}${e.size||48}px ${e.font||'Arial'}`;
    c.textAlign = e.align || 'left'; c.textBaseline = 'top';
    lines.forEach((line, i) => {
      const y = e.y + i*lh;
      if (e.shadow){ c.shadowColor = 'rgba(0,0,0,.75)'; c.shadowBlur = (e.size||48)*0.15; c.shadowOffsetX = 2; c.shadowOffsetY = 2; }
      if (e.outline){ c.shadowColor = 'transparent'; c.lineWidth = (e.size||48)*0.06; c.strokeStyle = e.ocolor || '#000'; c.lineJoin = 'round'; c.strokeText(line, e.x, y, e.w||undefined); }
      c.shadowColor = e.shadow ? 'rgba(0,0,0,.75)' : 'transparent'; c.shadowBlur = e.shadow ? (e.size||48)*0.15 : 0;
      c.fillStyle = e.color || '#fff'; c.fillText(line, e.x, y, e.w||undefined);
    });
    e.h = lines.length * lh; if (!e.w) e.w = Math.max(...lines.map(l => c.measureText(l).width), 20);
  } 
  else if (e.type === 'shape') {
    const r = Math.min(e.w, e.h)/2; c.beginPath();
    if (e.shape==='rect') c.rect(e.x,e.y,e.w,e.h);
    else if (e.shape==='circle') c.arc(cx,cy,r,0,Math.PI*2);
    else if (e.shape==='triangle') { c.moveTo(cx, e.y); c.lineTo(e.x+e.w, e.y+e.h); c.lineTo(e.x, e.y+e.h); c.closePath(); }
    else if (e.shape==='diamond') { c.moveTo(cx, e.y); c.lineTo(e.x+e.w, cy); c.lineTo(cx, e.y+e.h); c.lineTo(e.x, cy); c.closePath(); }
    else if (e.shape==='pentagon') { for(let i=0;i<5;i++){ const a=-Math.PI/2+i*2*Math.PI/5; const x=cx+r*Math.cos(a), y=cy+r*Math.sin(a); i===0?c.moveTo(x,y):c.lineTo(x,y); } c.closePath(); }
    else if (e.shape==='hexagon') { for(let i=0;i<6;i++){ const a=-Math.PI/2+i*2*Math.PI/6; const x=cx+r*Math.cos(a), y=cy+r*Math.sin(a); i===0?c.moveTo(x,y):c.lineTo(x,y); } c.closePath(); }
    else if (e.shape==='star') { for(let i=0;i<10;i++){ const r2=i%2===0?r:r*0.45; const a=-Math.PI/2+i*Math.PI/5; const x=cx+r2*Math.cos(a), y=cy+r2*Math.sin(a); i===0?c.moveTo(x,y):c.lineTo(x,y); } c.closePath(); }
    else if (e.shape==='line') { c.moveTo(e.x,e.y); c.lineTo(e.x+e.w,e.y+e.h); }
    if (e.fill && e.fill !== 'transparent'){ c.fillStyle = e.fill; c.fill(); }
    if (e.stroke){ c.lineWidth = e.strokeW || 2; c.strokeStyle = e.stroke; c.stroke(); }
  }
  else if (e.type === 'icon') { c.font = `${e.size||100}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = e.color || '#fff'; c.fillText(e.char||'★', e.x + e.w/2, e.y + e.h/2); }
  else if (e.type === 'image') { if (e.img && e.img.complete) c.drawImage(e.img, e.x, e.y, e.w, e.h); else { c.fillStyle = '#222'; c.fillRect(e.x,e.y,e.w,e.h); } }
  c.restore();
}

// ═══════════════════ FACTORY ═══════════════════
function addText(preset){
  const base = { id: uid(), type: 'text', x: state.width/2 - 250, y: state.height/2 - 50, w: 0, h: 0, text: 'Tulis teks di sini', font: "'Space Grotesk',sans-serif", size: 72, bold: true, italic: false, shadow: false, outline: false, align: 'left', color: '#ffffff', ocolor: '#000000', opacity: 1, rot: 0, hidden: false, locked: false };
  if (preset === 'heading'){ base.text = 'Heading'; base.size = 96; } else if (preset === 'subtext'){ base.text = 'Subheading'; base.size = 56; base.bold = false; } else if (preset === 'body'){ base.text = 'Body text.'; base.size = 32; base.bold = false; }
  state.elements.push(base); state.activeId = base.id; pushHistory(); renderAll();
}
function addShape(shapeId){
  const e = { id: uid(), type: 'shape', shape: shapeId, x: state.width/2 - 120, y: state.height/2 - 120, w: 240, h: 240, fill: '#ffffff', stroke: '#ffffff', strokeW: 0, opacity: 1, rot: 0, hidden: false, locked: false };
  if (shapeId === 'line'){ e.fill = 'transparent'; e.stroke = '#fff'; e.strokeW = 4; e.h = 0; } if (shapeId === 'star'){ e.fill = '#ffb703'; }
  state.elements.push(e); state.activeId = e.id; pushHistory(); renderAll();
}
function addIcon(ch){
  const e = { id: uid(), type: 'icon', char: ch, x: state.width/2 - 60, y: state.height/2 - 60, w: 120, h: 120, size: 120, color: '#ffffff', opacity: 1, rot: 0, hidden: false, locked: false };
  state.elements.push(e); state.activeId = e.id; pushHistory(); renderAll();
}
function addImage(img){
  let w = img.width, h = img.height; const ratio = Math.min((state.width*0.6)/w, (state.height*0.6)/h, 1); w *= ratio; h *= ratio;
  const e = { id: uid(), type: 'image', img, src: img.src, x: (state.width-w)/2, y: (state.height-h)/2, w, h, opacity: 1, rot: 0, hidden: false, locked: false };
  state.elements.push(e); state.activeId = e.id; pushHistory(); renderAll();
}

// ═══════════════════ RENDER PANELS ═══════════════════
function renderLayers(){
  const list = el('layersList'); list.innerHTML = '';
  [...state.elements].reverse().forEach(e => {
    const row = document.createElement('div'); row.className = 'layer-row' + (e.id===state.activeId?' active':'') + (e.locked?' locked':'');
    const ico = e.type==='text'?'T':e.type==='shape'?'▭':e.type==='image'?'🖼':'✦';
    const name = e.type==='text' ? (e.text||'Teks').split('\n')[0].slice(0,15) : e.type==='shape' ? (e.shape) : e.type==='image' ? 'Image' : 'Icon';
    row.innerHTML = `<span class="layer-ico">${ico}</span><span class="layer-name">${name}</span><span class="layer-act"><button data-act="up">↑</button><button data-act="dn">↓</button><button data-act="hide">${e.hidden?'◌':'◉'}</button><button data-act="lock">${e.locked?'🔒':'🔓'}</button><button data-act="del" class="del">✕</button></span>`;
    row.addEventListener('click', ev => {
      const act = ev.target.closest('[data-act]')?.dataset.act;
      if (act === 'del'){ state.elements = state.elements.filter(x => x.id !== e.id); if (state.activeId === e.id) state.activeId = null; pushHistory(); renderAll(); }
      else if (act === 'up'){ const i = state.elements.findIndex(x => x.id === e.id); if (i < state.elements.length-1){ [state.elements[i], state.elements[i+1]] = [state.elements[i+1], state.elements[i]]; pushHistory(); renderAll(); } }
      else if (act === 'dn'){ const i = state.elements.findIndex(x => x.id === e.id); if (i > 0){ [state.elements[i], state.elements[i-1]] = [state.elements[i-1], state.elements[i]]; pushHistory(); renderAll(); } }
      else if (act === 'hide'){ e.hidden = !e.hidden; pushHistory(); renderAll(); }
      else if (act === 'lock'){ e.locked = !e.locked; pushHistory(); renderAll(); }
      else { state.activeId = e.id; renderAll(); }
    });
    list.appendChild(row);
  });
}

function renderProps(){
  const empty = el('propsEmpty'), content = el('propsContent');
  const e = state.elements.find(x => x.id === state.activeId);
  if (!e){ empty.hidden = false; content.hidden = true; content.innerHTML = ''; return; }
  empty.hidden = true; content.hidden = false;
  let html = '';
  if (e.type === 'text'){
    html += `<label class="lbl">Teks</label><textarea id="pText" rows="3">${e.text.replace(/</g,'&lt;')}</textarea>
      <label class="lbl">Font</label><select id="pFont">${FONTS.map(f=>`<option value="${f.value}" ${f.value===e.font?'selected':''}>${f.label}</option>`).join('')}</select>
      <label class="lbl">Ukuran <span id="pSizeV" class="range-val">${e.size}</span></label><input type="range" id="pSize" min="8" max="300" value="${e.size}">
      <label class="lbl">Gaya</label><div class="seg"><button data-toggle="bold" class="${e.bold?'on':''}"><b>B</b></button><button data-toggle="italic" class="${e.italic?'on':''}"><i>I</i></button><button data-toggle="shadow" class="${e.shadow?'on':''}">Shadow</button><button data-toggle="outline" class="${e.outline?'on':''}">Outline</button></div>
      <label class="lbl">Rata</label><div class="seg"><button data-align="left" class="${e.align==='left'?'on':''}">Kiri</button><button data-align="center" class="${e.align==='center'?'on':''}">Tengah</button><button data-align="right" class="${e.align==='right'?'on':''}">Kanan</button></div>
      <label class="lbl">Warna Teks</label><div class="color-row"><input type="color" id="pColor" value="${e.color}"><input type="text" id="pColorHex" value="${e.color}" maxlength="7"></div>
      ${e.outline?`<label class="lbl">Warna Outline</label><div class="color-row"><input type="color" id="pOColor" value="${e.ocolor}"><input type="text" id="pOColorHex" value="${e.ocolor}" maxlength="7"></div>`:''}
      <div class="props-divider"></div>`;
  } else if (e.type === 'shape'){
    html += `<label class="lbl">Fill</label><div class="color-row"><input type="color" id="pFill" value="${e.fill==='transparent'?'#ffffff':e.fill}"><input type="text" id="pFillHex" value="${e.fill}" maxlength="9"></div>
      <label class="lbl">Stroke</label><div class="color-row"><input type="color" id="pStroke" value="${e.stroke}"><input type="text" id="pStrokeHex" value="${e.stroke}" maxlength="7"></div>
      <label class="lbl">Stroke Width <span id="pStrokeWV" class="range-val">${e.strokeW}</span></label><input type="range" id="pStrokeW" min="0" max="50" value="${e.strokeW}"><div class="props-divider"></div>`;
  } else if (e.type === 'icon'){
    html += `<label class="lbl">Icon</label><input type="text" id="pIconChar" value="${e.char}" maxlength="4" style="text-align:center;font-size:20px">
      <label class="lbl">Ukuran <span id="pSizeV" class="range-val">${e.size}</span></label><input type="range" id="pSize" min="20" max="400" value="${e.size}">
      <label class="lbl">Warna</label><div class="color-row"><input type="color" id="pColor" value="${e.color}"><input type="text" id="pColorHex" value="${e.color}" maxlength="7"></div><div class="props-divider"></div>`;
  }
  html += `<label class="lbl">Posisi X <span id="pXV" class="range-val">${Math.round(e.x)}</span></label><input type="range" id="pX" min="0" max="${state.width}" value="${e.x}">
    <label class="lbl">Posisi Y <span id="pYV" class="range-val">${Math.round(e.y)}</span></label><input type="range" id="pY" min="0" max="${state.height}" value="${e.y}">
    ${e.type!=='text'?`<label class="lbl">Lebar <span id="pWV" class="range-val">${Math.round(e.w)}</span></label><input type="range" id="pW" min="10" max="${state.width}" value="${e.w}"><label class="lbl">Tinggi <span id="pHV" class="range-val">${Math.round(e.h)}</span></label><input type="range" id="pH" min="0" max="${state.height}" value="${e.h}">`:''}
    <label class="lbl">Rotasi <span id="pRotV" class="range-val">${e.rot}°</span></label><input type="range" id="pRot" min="-180" max="180" value="${e.rot}">
    <label class="lbl">Opacity <span id="pOpV" class="range-val">${Math.round(e.opacity*100)}%</span></label><input type="range" id="pOp" min="0" max="100" value="${e.opacity*100}">
    <div class="modal-actions" style="margin-top:14px"><button class="btn-secondary" id="pDuplicate">Duplikat</button><button class="btn-secondary" id="pDelete">Hapus</button></div>`;
  
  content.innerHTML = html;
  const on = (id, ev, fn) => { const n = el(id); if (n) n.addEventListener(ev, fn); };
  const commit = () => { pushHistory(); renderCanvas(); renderLayers(); };
  
  if (e.type === 'text'){
    on('pText','input', ev => { e.text = ev.target.value; renderCanvas(); });
    on('pText','blur', commit);
    on('pFont','change', ev => { e.font = ev.target.value; commit(); });
    on('pSize','input', ev => { e.size = +ev.target.value; el('pSizeV').textContent = e.size; renderCanvas(); });
    on('pSize','change', commit);
    content.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => { const k=b.dataset.toggle; e[k]=!e[k]; b.classList.toggle('on',e[k]); if(k==='outline') renderProps(); commit(); }));
    content.querySelectorAll('[data-align]').forEach(b => b.addEventListener('click', () => { e.align=b.dataset.align; content.querySelectorAll('[data-align]').forEach(x=>x.classList.toggle('on',x.dataset.align===e.align)); commit(); }));
    on('pColor','input', ev => { e.color = ev.target.value; el('pColorHex').value = e.color; commit(); });
    on('pColorHex','input', ev => { if(/^#[0-9a-fA-F]{6}$/.test(ev.target.value)){ e.color = ev.target.value; el('pColor').value = e.color; commit(); }});
    on('pOColor','input', ev => { e.ocolor = ev.target.value; el('pOColorHex').value = e.ocolor; commit(); });
    on('pOColorHex','input', ev => { if(/^#[0-9a-fA-F]{6}$/.test(ev.target.value)){ e.ocolor = ev.target.value; el('pOColor').value = e.ocolor; commit(); }});
  } else if (e.type === 'shape'){
    on('pFill','input', ev => { e.fill = ev.target.value; el('pFillHex').value = e.fill; commit(); });
    on('pFillHex','input', ev => { if(/^#[0-9a-fA-F]{6}$|^transparent$/.test(ev.target.value)){ e.fill = ev.target.value; commit(); }});
    on('pStroke','input', ev => { e.stroke = ev.target.value; el('pStrokeHex').value = e.stroke; commit(); });
    on('pStrokeHex','input', ev => { if(/^#[0-9a-fA-F]{6}$/.test(ev.target.value)){ e.stroke = ev.target.value; commit(); }});
    on('pStrokeW','input', ev => { e.strokeW = +ev.target.value; el('pStrokeWV').textContent = e.strokeW; commit(); });
  } else if (e.type === 'icon'){
    on('pIconChar','input', ev => { e.char = ev.target.value; commit(); });
    on('pSize','input', ev => { e.size = +ev.target.value; el('pSizeV').textContent = e.size; renderCanvas(); });
    on('pSize','change', commit);
    on('pColor','input', ev => { e.color = ev.target.value; el('pColorHex').value = e.color; commit(); });
    on('pColorHex','input', ev => { if(/^#[0-9a-fA-F]{6}$/.test(ev.target.value)){ e.color = ev.target.value; commit(); }});
  }
  on('pX','input', ev => { e.x = +ev.target.value; el('pXV').textContent = Math.round(e.x); renderCanvas(); }); on('pX','change', commit);
  on('pY','input', ev => { e.y = +ev.target.value; el('pYV').textContent = Math.round(e.y); renderCanvas(); }); on('pY','change', commit);
  on('pW','input', ev => { e.w = +ev.target.value; el('pWV').textContent = Math.round(e.w); renderCanvas(); }); on('pW','change', commit);
  on('pH','input', ev => { e.h = +ev.target.value; el('pHV').textContent = Math.round(e.h); renderCanvas(); }); on('pH','change', commit);
  on('pRot','input', ev => { e.rot = +ev.target.value; el('pRotV').textContent = e.rot+'°'; renderCanvas(); }); on('pRot','change', commit);
  on('pOp','input', ev => { e.opacity = +ev.target.value/100; el('pOpV').textContent = ev.target.value+'%'; renderCanvas(); }); on('pOp','change', commit);
  on('pDuplicate','click', () => { const copy = JSON.parse(JSON.stringify(e, (k,v) => k==='img'?undefined:v)); copy.id = uid(); copy.x += 20; copy.y += 20; if (e.type==='image') copy.img = e.img; state.elements.push(copy); state.activeId = copy.id; pushHistory(); renderAll(); });
  on('pDelete','click', () => { state.elements = state.elements.filter(x => x.id !== e.id); state.activeId = null; pushHistory(); renderAll(); });
}

// ═══════════════════ DRAG & CLICK ═══════════════════
function getCanvasXY(evt){
  const rect = cv.getBoundingClientRect(); const cx = evt.touches ? evt.touches[0].clientX : evt.clientX; const cy = evt.touches ? evt.touches[0].clientY : evt.clientY;
  return { x: (cx - rect.left) / state.zoom, y: (cy - rect.top) / state.zoom };
}
function hitTest(x, y){
  for (let i = state.elements.length-1; i >= 0; i--){ const e = state.elements[i]; if (e.hidden || e.locked) continue; if (x >= e.x && x <= e.x + (e.w||0) && y >= e.y && y <= e.y + (e.h||0)) return e; }
  return null;
}
function startDrag(evt){
  evt.preventDefault(); const {x, y} = getCanvasXY(evt); const hit = hitTest(x, y);
  if (hit){ state.activeId = hit.id; state.drag = { id:hit.id, sx:x, sy:y, ox:hit.x, oy:hit.y }; cv.classList.add('grabbing'); renderAll(); } else { state.activeId = null; renderAll(); }
}
function moveDrag(evt){
  if (!state.drag) return; evt.preventDefault(); const {x, y} = getCanvasXY(evt); const e = state.elements.find(e => e.id === state.drag.id); if (!e) return;
  e.x = state.drag.ox + (x - state.drag.sx); e.y = state.drag.oy + (y - state.drag.sy); renderCanvas();
}
function endDrag(){ if (state.drag){ state.drag = null; cv.classList.remove('grabbing'); pushHistory(); renderLayers(); renderProps(); } }
cv.addEventListener('mousedown', startDrag); window.addEventListener('mousemove', moveDrag); window.addEventListener('mouseup', endDrag);
cv.addEventListener('touchstart', startDrag, { passive:false }); cv.addEventListener('touchmove', moveDrag, { passive:false }); window.addEventListener('touchend', endDrag);

// ═══════════════════ INIT UI ═══════════════════
function setupSidebar(){
  document.querySelectorAll('.left-sidebar .side-tab').forEach(tab => tab.addEventListener('click', () => { document.querySelectorAll('.left-sidebar .side-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); document.querySelectorAll('.left-sidebar .side-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tab.dataset.tab)); }));
  document.querySelectorAll('.right-sidebar .side-tab').forEach(tab => tab.addEventListener('click', () => { document.querySelectorAll('.right-sidebar .side-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); document.querySelectorAll('.right-sidebar .side-panel').forEach(p => p.classList.toggle('active', p.dataset.rpanel === tab.dataset.rtab)); }));
  document.querySelectorAll('.mn-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.mn-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
    const key = btn.dataset.mnav; const left = document.querySelector('.left-sidebar'), right = document.querySelector('.right-sidebar');
    left.classList.remove('open'); right.classList.remove('open');
    if (key === 'props' || key === 'layers') { right.classList.add('open'); document.querySelectorAll('.right-sidebar .side-tab').forEach(t => t.classList.toggle('active', t.dataset.rtab === key)); document.querySelectorAll('.right-sidebar .side-panel').forEach(p => p.classList.toggle('active', p.dataset.rpanel === key)); }
    else { left.classList.add('open'); document.querySelectorAll('.left-sidebar .side-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === key)); document.querySelectorAll('.left-sidebar .side-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === key)); }
  }));
  cv.addEventListener('touchstart', () => { if (window.innerWidth <= 720){ document.querySelector('.left-sidebar').classList.remove('open'); document.querySelector('.right-sidebar').classList.remove('open'); } }, { passive:true });
}

function setupTemplates(){
  const grid = el('presetGrid'); CANVAS_PRESETS.forEach(p => { const b = document.createElement('button'); b.className = 'preset-btn'; b.innerHTML = `${p.name}<div style="font-size:9px;opacity:.6;margin-top:2px">${p.w}×${p.h}</div>`; b.addEventListener('click', () => { state.width = p.w; state.height = p.h; state.elements.forEach(e => { e.x = clamp(e.x, 0, state.width); e.y = clamp(e.y, 0, state.height); }); document.querySelectorAll('#presetGrid .preset-btn').forEach(x => x.classList.remove('active')); b.classList.add('active'); pushHistory(); renderAll(); }); grid.appendChild(b); });
  const bgGrid = el('bgPresetGrid'); GRADIENTS.slice(0,4).forEach(g => { const b = document.createElement('button'); b.className = 'preset-btn'; b.style.padding = '0'; b.style.height = '42px'; b.style.background = `linear-gradient(135deg,${g[0]},${g[1]})`; b.style.border = '1px solid var(--line2)'; b.addEventListener('click', () => { state.background = { type:'gradient', value:g }; pushHistory(); renderAll(); }); bgGrid.appendChild(b); });
}

function setupElements(){
  const sg = el('shapeGrid'); SHAPES.forEach(s => { const b = document.createElement('button'); b.className = 'shape-btn'; b.textContent = s.ico; b.title = s.name; b.addEventListener('click', () => addShape(s.id)); sg.appendChild(b); });
  const ig = el('iconGrid'); ICONS.forEach(ch => { const b = document.createElement('button'); b.className = 'shape-btn'; b.textContent = ch; b.addEventListener('click', () => addIcon(ch)); ig.appendChild(b); });
}

function setupText(){
  document.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => addText(b.dataset.add)));
  const fp = el('fontPresets'); FONTS.forEach(f => { const b = document.createElement('button'); b.className = 'block-btn'; b.innerHTML = `<div style="${f.css};font-size:14px;color:#fff;margin-bottom:2px">${f.label}</div>`; b.addEventListener('click', () => { addText('body'); const last = state.elements[state.elements.length-1]; last.font = f.value; pushHistory(); renderAll(); }); fp.appendChild(b); });
}

function setupUploads(){
  const dz = el('dropZone'), input = el('uploadInput'), list = el('uploadsList');
  function handleFile(file){
    if (!file.type.startsWith('image/')) return; const reader = new FileReader();
    reader.onload = e => { const img = new Image(); img.onload = () => addImage(img); img.src = e.target.result;
      const item = document.createElement('div'); item.className = 'upload-item'; item.innerHTML = `<img src="${e.target.result}"><button class="u-del">✕</button>`;
      item.querySelector('.u-del').addEventListener('click', ev => { ev.stopPropagation(); item.remove(); });
      item.querySelector('img').addEventListener('click', () => { const im = new Image(); im.onload = () => addImage(im); im.src = e.target.result; }); list.appendChild(item);
    }; reader.readAsDataURL(file);
  }
  input.addEventListener('change', e => { [...e.target.files].forEach(handleFile); input.value = ''; });
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); }); dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); [...e.dataTransfer.files].forEach(handleFile); });
}

function setupBackground(){
  const sw = el('solidSwatches'); COLOR_SWATCHES.forEach(c => { const b = document.createElement('button'); b.className = 'color-swatch'; b.style.background = c; b.addEventListener('click', () => { state.background = { type:'solid', value:c }; el('bgColorPicker').value = c; el('bgColorHex').value = c; pushHistory(); renderAll(); }); sw.appendChild(b); });
  el('bgColorPicker').addEventListener('input', e => { state.background = { type:'solid', value:e.target.value }; el('bgColorHex').value = e.target.value; pushHistory(); renderAll(); });
  el('bgColorHex').addEventListener('input', e => { if(/^#[0-9a-fA-F]{6}$/.test(e.target.value)){ state.background = { type:'solid', value:e.target.value }; el('bgColorPicker').value = e.target.value; pushHistory(); renderAll(); }});
  const gp = el('gradientPresets'); GRADIENTS.forEach(g => { const b = document.createElement('button'); b.className = 'grad-btn'; b.style.background = `linear-gradient(135deg,${g[0]},${g[1]})`; b.addEventListener('click', () => { state.background = { type:'gradient', value:g }; pushHistory(); renderAll(); }); gp.appendChild(b); });
}

function setupTopbar(){
  el('undoBtn').addEventListener('click', undo); el('redoBtn').addEventListener('click', redo);
  el('zoomIn').addEventListener('click', () => { state.zoom = clamp(state.zoom + 0.1, 0.1, 3); renderCanvas(); });
  el('zoomOut').addEventListener('click', () => { state.zoom = clamp(state.zoom - 0.1, 0.1, 3); renderCanvas(); });
  el('zoomFit').addEventListener('click', () => { const area = el('canvasArea').getBoundingClientRect(); const z = Math.min((area.width-60)/state.width, (area.height-60)/state.height); state.zoom = clamp(z, 0.1, 2); renderCanvas(); });
  el('newBtn').addEventListener('click', () => { if (!confirm('Buat desain baru?')) return; state.elements = []; state.activeId = null; state.background = { type:'solid', value:'#0a0a0a' }; pushHistory(); renderAll(); });
  el('exportBtn').addEventListener('click', () => el('exportModal').hidden = false);
  el('exportCancel').addEventListener('click', () => el('exportModal').hidden = true);
  el('exportQuality').addEventListener('input', e => el('qualityVal').textContent = e.target.value + '%');
  el('exportGo').addEventListener('click', () => { const fmt = el('exportFmt').value, quality = +el('exportQuality').value / 100; const mime = fmt === 'jpeg' ? 'image/jpeg' : fmt === 'webp' ? 'image/webp' : 'image/png'; cv.toBlob(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `alca-canva-${Date.now()}.${fmt}`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }, mime, quality); el('exportModal').hidden = true; });
}

function setupKeyboard(){
  document.addEventListener('keydown', e => {
    const tag = document.activeElement.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.ctrlKey && e.key.toLowerCase() === 'z'){ e.preventDefault(); undo(); } else if (e.ctrlKey && e.key.toLowerCase() === 'y'){ e.preventDefault(); redo(); }
    else if (e.key === 'Delete' || e.key === 'Backspace'){ if (state.activeId !== null){ e.preventDefault(); state.elements = state.elements.filter(x => x.id !== state.activeId); state.activeId = null; pushHistory(); renderAll(); } }
    else if (e.ctrlKey && e.key.toLowerCase() === 'd'){ e.preventDefault(); const el_ = state.elements.find(x => x.id === state.activeId); if (el_){ const copy = JSON.parse(JSON.stringify(el_, (k,v) => k==='img'?undefined:v)); copy.id = uid(); copy.x += 20; copy.y += 20; if (el_.type==='image') copy.img = el_.img; state.elements.push(copy); state.activeId = copy.id; pushHistory(); renderAll(); } }
    else if (e.key === '+' || e.key === '='){ state.zoom = clamp(state.zoom + 0.1, 0.1, 3); renderCanvas(); } else if (e.key === '-'){ state.zoom = clamp(state.zoom - 0.1, 0.1, 3); renderCanvas(); }
    else if (e.key === 'Escape'){ el('exportModal').hidden = true; state.activeId = null; renderAll(); }
  });
}

function init(){
  setupSidebar(); setupTemplates(); setupElements(); setupText(); setupUploads(); setupBackground(); setupTopbar(); setupKeyboard();
  const firstBtn = document.querySelector('#presetGrid .preset-btn'); if (firstBtn) firstBtn.classList.add('active');
  pushHistory(); renderAll(); setTimeout(() => el('zoomFit').click(), 100);
  document.addEventListener('contextmenu', e => { if (e.target.tagName === 'CANVAS') e.preventDefault(); });
  console.log('%c⛔ STOP!','color:red;font-size:50px;font-weight:900;');
  console.log('%cAlca Canva — Credits: AlcaW44\nhttps://www.whatsapp.com/channel/0029Vb82nkLEwEjtLSQ49I44','font-size:13px;color:#999;');
}
document.addEventListener('DOMContentLoaded', init);
