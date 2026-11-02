const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const land=['Пашня','Пастбище','Сенокос','Залежь','Многолетние насаждения'];
const animals=[['Ферма','farm'],['Убойный пункт','factory'],['Молокоперерабатывающее предприятие','bottle'],['Птицефабрика','rooster'],['Скотомогильник','burial'],['Пустующий объект животноводства','empty']];
const landColors=['#1d9b45','#d58c12','#087ea3','#7950ba','#c64479'];
const animalColors=['#246ec4','#cc5c27','#008f88','#c13f72','#626b79','#94701e'];
const s={module:'all',filter:'Все',query:'',selected:null,view:'map',resultBlock:null,role:'ministry',advanced:{district:'',status:'',areaMin:'',areaMax:'',soil:'',relief:''},zoom:1,x:0,y:0,layers:{boundaries:true,health:true,labels:true},parcels:[],byRegion:new Map(),labels:null,w:595,h:515};
const icon=name=>`<svg class="animal-icon" viewBox="0 0 32 32" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
const uiIcon=name=>`<svg class="ui-icon" viewBox="0 0 32 32" aria-hidden="true"><use href="#ui-${name}"></use></svg>`;
function loadParcelData(){
 const data=window.PARCEL_DATA;if(!data)throw new Error('Нет данных контуров участков');
 const demo=window.DEMO_RECORDS;if(!demo||demo.records.length!==data.regions.length)throw new Error('Демонстрационные записи не соответствуют контурам');
 const binary=atob(data.runs),labels=new Uint16Array(data.width*data.height);
 let position=0;
 for(let i=0;i<binary.length;i+=4){
  const length=binary.charCodeAt(i)|(binary.charCodeAt(i+1)<<8);
  const id=binary.charCodeAt(i+2)|(binary.charCodeAt(i+3)<<8);
  labels.fill(id,position,position+length);position+=length;
 }
 if(position!==labels.length)throw new Error('Повреждённые данные контуров');
 s.labels=labels;s.w=data.width;s.h=data.height;
 s.parcels=data.regions.map((p,i)=>{
  const record=demo.records[i],id='У-'+String(i+1).padStart(3,'0');
  if(record.id!==id||record.regionId!==p.regionId)throw new Error('Несовпадение демонстрационной записи '+id);
  return {...p,id,name:'Участок '+String(i+1).padStart(3,'0'),direction:i%4===0?'animals':'fields',land:land[(i*11+Math.floor(i/5))%land.length],animal:animals[(i*7+Math.floor(i/6))%animals.length],district:['Район А','Район Б','Район В'][i%3],status:i%5===0?'Не используется':'Используется',soil:['Чернозём','Серая лесная','Нет данных'][i%3],relief:['Равнина','Склон','Нет данных'][(i+1)%3],cadastre:record.cadastre,integrations:record.integrations};
 });
 s.byRegion=new Map(s.parcels.map(p=>[p.regionId,p]));
 render();
}
const kind=p=>p.direction==='fields'?p.land:p.animal[0];
const filtered=()=>s.parcels.filter(p=>(s.module==='all'||p.direction===s.module)&&(s.role==='ministry'||(s.role==='district'&&p.district==='Район А')||(s.role==='producer'&&p.regionId%5===0))&&(s.filter==='Все'||kind(p)===s.filter)&&`${p.name} ${p.id} ${p.land} ${p.animal[0]} ${p.district} ${p.cadastre.number}`.toLowerCase().includes(s.query.toLowerCase())&&(!s.advanced.district||p.district===s.advanced.district)&&(!s.advanced.status||p.status===s.advanced.status)&&(!s.advanced.areaMin||Number(p.cadastre.areaHa)>=Number(s.advanced.areaMin))&&(!s.advanced.areaMax||Number(p.cadastre.areaHa)<=Number(s.advanced.areaMax))&&(!s.advanced.soil||p.soil===s.advanced.soil)&&(!s.advanced.relief||p.relief===s.advanced.relief));
function color(parcel){return parcel.direction==='fields'?landColors[land.indexOf(parcel.land)]:animalColors[animals.findIndex(a=>a[0]===parcel.animal[0])]}
function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16))}
function overlay(){
 const c=$('parcelOverlay');c.width=s.w;c.height=s.h;if(!s.labels)return;
 const ctx=c.getContext('2d'),data=ctx.createImageData(s.w,s.h);
 const selected=s.parcels.find(parcel=>parcel.id===s.selected);
 const matching=new Set(filtered().map(parcel=>parcel.regionId));
 const visible=new Map(filtered().map(parcel=>[parcel.regionId,rgb(color(parcel))]));
 for(let i=0;i<s.labels.length;i++){
  const id=s.labels[i],pixel=i*4;
  if(selected&&matching.has(id)&&s.layers.boundaries&&id===selected.regionId){
   const x=i%s.w,y=(i/s.w)|0;
   const edge=x===0||y===0||x===s.w-1||y===s.h-1||
    s.labels[i-1]!==id||s.labels[i+1]!==id||s.labels[i-s.w]!==id||s.labels[i+s.w]!==id;
   const base=rgb(color(selected));
   const fill=edge?base.map(value=>Math.round(value*.48)):base;
   data.data[pixel]=fill[0];data.data[pixel+1]=fill[1];data.data[pixel+2]=fill[2];data.data[pixel+3]=edge?255:222;
  }else if(s.layers.health&&visible.has(id)){
   const fill=visible.get(id);
   data.data[pixel]=fill[0];data.data[pixel+1]=fill[1];data.data[pixel+2]=fill[2];data.data[pixel+3]=195;
  }
 }
 ctx.putImageData(data,0,0);
}
function list(){let data=filtered();$('objectCount').textContent=data.length;$('objectList').innerHTML=data.length?data.map(p=>`<button class="object-item ${s.selected===p.id?'active':''}" data-id="${p.id}"><span class="object-symbol" style="color:${color(p)}">${p.direction==='fields'?uiIcon('plant'):icon(p.animal[1])}</span><span><strong>${p.name}</strong><small>${esc(kind(p))}</small><small class="object-cadastre">${esc(p.cadastre.number)}</small></span><span class="item-meta">${p.id}</span></button>`).join(''):'<div class="empty-list">По заданным условиям участков нет.</div>';document.querySelectorAll('.object-item').forEach(b=>b.onclick=()=>select(b.dataset.id,true))}
function chips(){
 const entries=[{name:'Все',color:null},
  ...(s.module!=='animals'?land.map((name,i)=>({name,color:landColors[i]})):[]),
  ...(s.module!=='fields'?animals.map(([name],i)=>({name,color:animalColors[i]})):[])];
 $('filterChips').innerHTML=entries.map(({name,color})=>{
  const swatch=color?`<span class="filter-swatch" style="background:${color}"></span>`:'';
  const category=color?'category-chip':'';
  const style=color?` style="--chip-color:${color}"`:'';
  return `<button class="filter-chip ${category} ${s.filter===name?'active':''}"${style} data-filter="${esc(name)}">${swatch}${esc(name)}</button>`;
 }).join('');
 document.querySelectorAll('.filter-chip').forEach(b=>b.onclick=()=>{s.filter=b.dataset.filter;render()});
}
function legend(){
 const entries=[...(s.module!=='animals'?land.map((name,i)=>({name,color:landColors[i],symbol:uiIcon('plant')})):[]),...(s.module!=='fields'?animals.map(([name,iconName],i)=>({name,color:animalColors[i],symbol:icon(iconName)})):[])];
 $('mapLegend').innerHTML='<div class="legend-title">УСЛОВНЫЕ ОБОЗНАЧЕНИЯ</div>'+entries.map(entry=>`<div class="legend-entry"><span class="legend-symbol" style="color:${entry.color}">${entry.symbol}</span><span>${esc(entry.name)}</span></div>`).join('')+'<div class="legend-divider"></div><div class="legend-entry"><span class="legend-boundary"></span><span>Красная линия — граница участка</span></div>';
}
function detail(){
 const p=s.parcels.find(p=>p.id===s.selected);
 $('detailCard').classList.toggle('open',!!p);
 if(!p)return;
 $('detailName').textContent=p.name;
 $('detailDistrict').textContent=p.district+' · демонстрационная категория';
 $('detailIcon').innerHTML=p.direction==='fields'?uiIcon('plant'):icon(p.animal[1]);
 $('detailStatus').textContent=p.status+' · демо';
 $('detailStatus').className='detail-status'+(p.status==='Не используется'?' empty':'');
 $('detailMetrics').innerHTML=[['Тип объекта',kind(p)],['ID участка',p.id],['Условная площадь',p.cadastre.areaHa+' га'],['Район',p.district]].map(([a,b])=>`<div class="detail-metric"><small>${esc(a)}</small><strong>${esc(b)}</strong></div>`).join('');
 $('cadastreCard').innerHTML=[['Демо-номер',p.cadastre.number],['Условная площадь',p.cadastre.areaHa+' га'],['Категория земель',p.cadastre.landCategory],['Условное использование',p.cadastre.permittedUse],['Дата записи (демо)',p.cadastre.registrationDate],['Права',p.cadastre.rights],['Ограничения',p.cadastre.restriction]].map(([name,value])=>`<div class="cadastre-row"><span>${esc(name)}</span><strong>${esc(value)}</strong></div>`).join('')+'<p>Площадь вымышлена для макета. Географическая привязка и сведения Росреестра не использовались.</p>';
 const dzz=p.integrations.find(source=>source.code==='dzz');
 const blocks=p.direction==='fields'?
  [['Базовые и кадастровые сведения',`${p.cadastre.number} · ${p.cadastre.areaHa} га (вымышлено)`,'demo'],['Используемые и неиспользуемые земли',`${p.status} · ${p.land}`,'demo'],['Использование и производство','Производственные показатели отсутствуют','empty'],['Почвы и рельеф',`${p.soil} · ${p.relief}`,'demo'],['Дистанционный мониторинг',dzz.state==='demo'?dzz.details:'Тематические сведения отсутствуют',dzz.state==='demo'?'demo':'empty']]:
  [['Основные сведения',p.animal[0]+' · '+p.district,'demo'],['Состояние объекта','Данные мониторинга отсутствуют','empty'],['Земли для размещения','Оценка пригодности не подключена','empty']];
 $('profileBlocks').innerHTML=blocks.map(([name,value,state])=>`<div class="profile-block"><div><strong>${esc(name)}</strong><span class="block-state ${state}">${state==='demo'?'Демо':'Нет данных'}</span></div><p>${esc(value)}</p></div>`).join('');
 const stateText={demo:'Демо-ответ',empty:'Нет данных',unavailable:'Временно недоступно'};
 $('detailSources').innerHTML=p.integrations.map(source=>`<div class="integration-card"><div class="integration-head"><strong>${esc(source.name)}</strong><span class="integration-state ${source.state}">${stateText[source.state]}</span></div><p>${esc(source.state==='demo'?source.details:source.state==='empty'?'Сведения по объекту не получены.':'Имитация сбоя источника; остальные блоки профиля доступны.')}</p><div class="integration-meta"><span>${esc(source.recordId)}</span><span>Демо-дата: ${esc(source.checkedAt)}</span></div></div>`).join('');
}
function thematicBlocks(data){
 if(s.module==='all')return [['fields','Растениеводство',data.filter(p=>p.direction==='fields').length,'Земельные участки на фрагменте'],['animals','Животноводство',data.filter(p=>p.direction==='animals').length,'Объекты животноводства на фрагменте']];
 return s.module==='fields'?
  [['base','Базовые и кадастровые сведения',data.length,'Вымышленные записи для макета'],['unused','Используемые и неиспользуемые земли',data.filter(p=>p.status==='Не используется').length,'Неиспользуемые участки · демо'],['production','Использование и производственные показатели',data.length,'Показатели производства отсутствуют'],['soil','Почвенные и рельефные условия',data.length,'Условные значения для макета'],['remote','Дистанционный мониторинг',data.filter(p=>p.integrations.find(source=>source.code==='dzz')?.state==='demo').length,'Демо-ответы ДЗЗ']]:
  [['base','Основные сведения',data.length,'Типы объектов · демо'],['monitoring','Мониторинг объектов',0,'Источник не подключён'],['placement','Земли для размещения',0,'Оценка пригодности отсутствует']];
}
function resultData(){const data=filtered();if(s.resultBlock==='fields'||s.resultBlock==='animals')return data.filter(p=>p.direction===s.resultBlock);if(s.resultBlock==='unused')return data.filter(p=>p.status==='Не используется');if(s.resultBlock==='remote')return data.filter(p=>p.integrations.find(source=>source.code==='dzz')?.state==='demo');if(['monitoring','placement'].includes(s.resultBlock))return [];return data}
function analytics(){
 const data=filtered(),types=[...(s.module!=='animals'?land:[]),...(s.module!=='fields'?animals.map(a=>a[0]):[])],counts=types.map(t=>data.filter(p=>kind(p)===t).length);
 $('analyticsTitle').textContent=s.module==='all'?'Все объекты':s.module==='fields'?'Земельные участки':'Объекты животноводства';
 $('analyticsSubtitle').textContent=data.length+' объектов в текущем наборе · демонстрационные характеристики';
 $('metricGrid').innerHTML=[['Объектов',data.length,'В текущем фильтре'],['Типов',counts.filter(Boolean).length,'Условная классификация'],['Кадастровых записей',data.length,'Вымышленные'],['Источников',4,'Ответы имитированы']].map(([a,b,c])=>`<div class="metric-card"><small>${esc(a)}</small><strong>${esc(b)}</strong><em>${esc(c)}</em></div>`).join('');
 $('themeGrid').innerHTML=thematicBlocks(data).map(([id,title,count,note])=>`<button class="theme-card" data-block="${id}"><span>${esc(title)}</span><strong>${count}</strong><small>${esc(note)}</small><em>Показать список ${uiIcon('arrow')}</em></button>`).join('');
 document.querySelectorAll('.theme-card').forEach(button=>button.onclick=()=>{s.resultBlock=button.dataset.block;s.view='results';render()});
 $('chartTitle').textContent='Распределение по типам';
 $('barChart').innerHTML=types.map((t,i)=>`<div class="bar-row"><span>${esc(t)}</span><div class="bar-track"><i style="width:${data.length?counts[i]/data.length*100:0}%"></i></div><b>${counts[i]}</b></div>`).join('');
 $('analyticsItems').innerHTML=data.slice(0,12).map(p=>`<button class="analytics-object" data-id="${p.id}">${p.name} ${uiIcon('arrow')}</button>`).join('');
 document.querySelectorAll('.analytics-object').forEach(b=>b.onclick=()=>select(b.dataset.id));
}
function results(){
 const block=thematicBlocks(filtered()).find(entry=>entry[0]===s.resultBlock),data=resultData();
 $('resultsTitle').textContent=block?.[1]||'Список объектов';
 $('resultsSubtitle').textContent=data.length?`${data.length} объектов. Выберите объект, чтобы открыть профиль на карте.`:'По этому показателю данные отсутствуют или источник не подключён.';
 $('resultsItems').innerHTML=data.length?data.map(p=>`<button class="result-item" data-id="${p.id}"><span class="result-color" style="background:${color(p)}"></span><span><strong>${p.name}</strong><small>${esc(kind(p))} · ${esc(p.district)} · ${esc(p.cadastre.number)}</small></span><b>Профиль ${uiIcon('arrow')}</b></button>`).join(''):'<div class="result-empty">Нет данных для отображения. Остальные разделы макета доступны.</div>';
 document.querySelectorAll('.result-item').forEach(b=>b.onclick=()=>select(b.dataset.id,true));
}
function render(){if(s.selected&&!filtered().some(parcel=>parcel.id===s.selected))s.selected=null;chips();list();legend();overlay();detail();analytics();results();for(const [id,mode] of [['allTab','all'],['fieldsTab','fields'],['animalsTab','animals']]){$(id).classList.toggle('active',s.module===mode);$(id).setAttribute('aria-selected',s.module===mode)}$('listTitle').textContent=s.module==='all'?'Все объекты':s.module==='fields'?'Участки растениеводства':'Участки животноводства';$('breadcrumbCurrent').textContent=s.module==='all'?'Все объекты':s.module==='fields'?'Растениеводство':'Животноводство';$('mapPanel').style.display=s.view==='map'?'block':'none';$('analyticsPanel').classList.toggle('hidden',s.view!=='analytics');$('resultsPanel').classList.toggle('hidden',s.view!=='results');$('mapViewBtn').classList.toggle('active',s.view==='map');$('analyticsViewBtn').classList.toggle('active',s.view==='analytics'||s.view==='results');$('mapBadgeText').textContent=(s.module==='all'?'Все объекты':s.module==='fields'?'Растениеводство':'Животноводство')+' · '+filtered().length+' участков'}
function focus(parcel){s.zoom=Math.max(s.zoom,1.65);transform();const viewport=$('rasterViewport');s.x=-(parcel.cx/s.w-.5)*viewport.offsetWidth;s.y=-(parcel.cy/s.h-.5)*viewport.offsetHeight;transform()}
function select(id,fromList=false){const parcel=s.parcels.find(p=>p.id===id);if(!parcel)return;if(s.module!=='all'&&s.module!==parcel.direction){s.module=parcel.direction;s.filter='Все'}s.selected=id;s.view='map';render();if(fromList)focus(parcel);$('sidebar').classList.remove('open');$('objectPane').classList.remove('open')}
function transform(){const viewport=$('rasterViewport'),surface=$('mapSurface');const base=Math.min(surface.clientWidth,surface.clientHeight*s.w/s.h);viewport.style.width=Math.round(base*s.zoom)+'px';viewport.style.transform=`translate(calc(-50% + ${s.x}px),calc(-50% + ${s.y}px))`;$('zoomLevel').textContent=Math.round(s.zoom*100)+'%';$('zoomRange').value=Math.round(s.zoom*100)}
function fit(){s.zoom=1;s.x=0;s.y=0;transform()}
function hit(e){let r=$('parcelOverlay').getBoundingClientRect(),x=Math.floor((e.clientX-r.left)*s.w/r.width),y=Math.floor((e.clientY-r.top)*s.h/r.height);if(x<0||y<0||x>=s.w||y>=s.h)return null;let found=s.byRegion.get(s.labels?.[y*s.w+x]);if(found)return found;for(let radius=1;radius<=5;radius++)for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){let nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<s.w&&ny<s.h){found=s.byRegion.get(s.labels?.[ny*s.w+nx]);if(found)return found}}return null}
loadParcelData();
$('allTab').onclick=()=>{s.module='all';s.filter='Все';s.selected=null;render()};$('fieldsTab').onclick=()=>{s.module='fields';s.filter='Все';s.selected=null;render()};$('animalsTab').onclick=()=>{s.module='animals';s.filter='Все';s.selected=null;render()};$('searchInput').oninput=e=>{s.query=e.target.value;render()};$('resetFilters').onclick=()=>{s.filter='Все';s.query='';$('searchInput').value='';for(const key of Object.keys(s.advanced)){s.advanced[key]='';$(key==='district'?'districtFilter':key==='status'?'statusFilter':key==='soil'?'soilFilter':key==='relief'?'reliefFilter':key).value=''}render()};
for(const [id,key] of [['districtFilter','district'],['statusFilter','status'],['areaMin','areaMin'],['areaMax','areaMax'],['soilFilter','soil'],['reliefFilter','relief']])$(id).oninput=e=>{s.advanced[key]=e.target.value;render()};
$('rolePreview').onchange=e=>{s.role=e.target.value;s.selected=null;render()};
$('mapViewBtn').onclick=()=>{s.view='map';render()};$('analyticsViewBtn').onclick=()=>{s.view='analytics';render()};$('backToAnalytics').onclick=()=>{s.view='analytics';render()};$('detailAnalytics').onclick=()=>{s.view='analytics';render()};$('detailFocus').onclick=()=>{const parcel=s.parcels.find(p=>p.id===s.selected);s.view='map';render();if(parcel)focus(parcel)};$('closeDetail').onclick=()=>{s.selected=null;render()};$('fitBtn').onclick=fit;$('zoomIn').onclick=()=>{s.zoom=Math.min(4,s.zoom*1.2);transform()};$('zoomOut').onclick=()=>{s.zoom=Math.max(.7,s.zoom/1.2);transform()};$('zoomReset').onclick=fit;$('zoomRange').oninput=e=>{s.zoom=Number(e.target.value)/100;transform()};
for(let [name,key] of [['Boundaries','boundaries'],['Health','health'],['Labels','labels']])$('layer'+name).onchange=e=>{s.layers[key]=e.target.checked;overlay()};
$('themeToggle').onclick=()=>{let t=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=t;$('themeIcon').innerHTML=uiIcon(t==='dark'?'sun':'moon');$('themeLabel').textContent=t==='dark'?'Светлая тема':'Тёмная тема';localStorage.setItem('agro-theme',t)};if(localStorage.getItem('agro-theme')==='light')$('themeToggle').click();$('sidebarToggle').onclick=()=>{const open=$('sidebar').classList.toggle('open');if(open)$('objectPane').classList.remove('open')};$('objectListToggle').onclick=()=>{const open=$('objectPane').classList.toggle('open');if(open)$('sidebar').classList.remove('open')};document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('searchInput').focus();$('objectPane').classList.remove('open');$('sidebar').classList.add('open')}if(e.key==='Escape'){$('sidebar').classList.remove('open');$('objectPane').classList.remove('open')}});
let drag=null,surface=$('mapSurface');surface.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,px:s.x,py:s.y,moved:false};surface.setPointerCapture(e.pointerId)});surface.addEventListener('pointermove',e=>{if(drag){let dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4)drag.moved=true;if(drag.moved){s.x=drag.px+dx;s.y=drag.py+dy;surface.classList.add('dragging');transform()}}else if(s.layers.labels&&s.labels){let p=hit(e);$('mapBadgeText').textContent=p?p.name+' · '+kind(p):'Фрагмент карты · '+s.parcels.length+' отдельных участков'}});surface.addEventListener('pointerup',e=>{if(drag&&!drag.moved&&s.labels){let p=hit(e);if(p)select(p.id)}drag=null;surface.classList.remove('dragging')});surface.addEventListener('pointercancel',()=>{drag=null;surface.classList.remove('dragging')});surface.addEventListener('wheel',e=>{e.preventDefault();s.zoom=Math.max(.7,Math.min(4,s.zoom*(e.deltaY<0?1.12:.89)));transform()},{passive:false});window.addEventListener('resize',transform);render();transform();
