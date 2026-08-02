(function(){
'use strict';

if('scrollRestoration' in history)history.scrollRestoration='manual';var scrollPos=0,codeProcessed=false,currentPage='articles',pageScrollPos={},skipClear=false;
var headingCache=null,lastActiveId=null,scrollRaf=null,artScrollRaf=null,resizeTimer=null,tocBuildTimer=null;var _artScrollMax=0;
var paginationPage=0,savedPaginationPage=0,perPage=6;
var currentArticleId=null,isSwitchingArticle=false;
var searchTimer=null;
var tocManualLock=false,tocManualTimer=null;
var articleOrder=window.__HAPRIAL_DATA__.articleOrder;
var activeFilterLabel='',activeFilterFn=null;
var searchActiveIdx=-1;
var reducedMotion=window.matchMedia('(prefers-reduced-motion:reduce)').matches;
var isLowEnd=reducedMotion||(navigator.deviceMemory&&navigator.deviceMemory<=2);var isMobile=matchMedia("(max-width:768px)").matches;
var isReload=false;
try{var ne=performance.getEntriesByType('navigation');isReload=ne.length>0&&ne[0].type==='reload'}catch(e){}

var $=function(id){return document.getElementById(id)};
var topAppBar=$('topAppBar'),articleView=$('articleView'),articleBody=$('articleBody'),
    rprog=$('rprog'),avBar=$('avBar'),searchView=$('searchView'),svInput=$('svInput'),
    svResults=$('svResults'),fab=$('fab'),toc=$('toc'),tocList=$('tocList'),
    filterBar=$('filterBar'),filterLabel=$('filterLabel'),tabBar=$('tabBar'),
    tocSheet=$('tocSheet'),tocDrawerList=$('tocDrawerList'),tocToggleBtn=$('tocToggleBtn'),
    pagination=$('pagination'),fabComment=$('fabComment');
var tabOrder=['articles','tags','categories','archive','friends','about'];
var seoTitles={'articles':window.__HAPRIAL_DATA__.siteTitle,'tags':'标签 | '+window.__HAPRIAL_DATA__.siteTitle,'categories':'分类 | '+window.__HAPRIAL_DATA__.siteTitle,'archive':'归档 | '+window.__HAPRIAL_DATA__.siteTitle,'friends':'友链 | '+window.__HAPRIAL_DATA__.siteTitle,'about':'关于 | '+window.__HAPRIAL_DATA__.siteTitle};
var metaDesc=document.querySelector('meta[name="description"]');
var ogTitle=document.querySelector('meta[property="og:title"]');
var ogDesc=document.querySelector('meta[property="og:description"]');
var linkCanon=document.querySelector('link[rel="canonical"]');
var icons={chevL:'<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>',chevR:'<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>',back:'<svg viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',fwd:'<svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',copy:'<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',check:'<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>'};

var _lastElevated=null,_lastFab=null,_lastArtScrolled=null,_lastArtFab=null;var _fabIdleTimer=null;

var allTags=window.__HAPRIAL_DATA__.allTags;
var cats=window.__HAPRIAL_DATA__.cats;
var catMap=window.__HAPRIAL_DATA__.catMap;
var friends=window.__HAPRIAL_DATA__.friends;
var articles=window.__HAPRIAL_DATA__.articles;
var catNameMap={};cats.forEach(function(c){catNameMap[c.f]=c.n});

var slugToId={};
(function(){for(var id in articles)slugToId[articles[id].dateISO.replace(/-/g,'')]=id})();
function buildSlug(id){var a=articles[id];return a?a.dateISO.replace(/-/g,''):''}
function lockBody(){var sw=innerWidth-document.documentElement.clientWidth;document.body.style.paddingRight=sw>0?sw+'px':'';document.body.classList.add('locked')}
function unlockBody(){document.body.classList.remove('locked');document.body.style.paddingRight=''}
function copyText(t){if(navigator.clipboard&&isSecureContext){navigator.clipboard.writeText(t);return}var ta=document.createElement('textarea');ta.value=t;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta)}
function escHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
var _cachedCards=null;
function getAllCards(){if(!_cachedCards)_cachedCards=[].slice.call(document.querySelectorAll('.card'));return _cachedCards}
var prismLoaded=false;
function revealImages(){articleBody.querySelectorAll('img').forEach(function(img){if(img.classList.contains('revealed'))return;if(reducedMotion){img.style.opacity='1';img.style.transform='';img.classList.add('revealed');return}if(img.complete&&img.naturalWidth>0){img.classList.add('revealed');return}img.addEventListener('load',function(){setTimeout(function(){img.classList.add('revealed');invalidateHeadingCache()},60)},{once:true});img.addEventListener('error',function(){img.style.opacity='1';img.style.transform='';img.classList.add('revealed')},{once:true})})}
var imgObserver=null;
function observeImages(){if(imgObserver)imgObserver.disconnect();if(reducedMotion){articleBody.querySelectorAll('img').forEach(function(img){img.classList.add('revealed')});return}imgObserver=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){var img=entry.target;imgObserver.unobserve(img);if(img.complete&&img.naturalWidth>0){setTimeout(function(){img.classList.add('revealed')},60)}}})},{root:articleView,rootMargin:'100px',threshold:0.05});articleBody.querySelectorAll('img:not(.revealed)').forEach(function(img){imgObserver.observe(img)})}

function processMermaid(){
  var blocks=articleBody.querySelectorAll('.mermaid-block');
  if(!blocks.length)return;
  blocks.forEach(function(b){
    var code=b.getAttribute("data-code")||"";
    code=code.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,"\"")
    if(!code)return;
    try{
      var svg=renderMermaidFlowchart(code.trim());
      if(svg){b.innerHTML=svg;bindPieEvents(b)}
      else{b.innerHTML='<p style="color:var(--outline)">不支持的图表类型</p>'}
    }catch(e){b.innerHTML='<p style="color:var(--outline)">图表渲染失败</p>'}
  });
}
function bindPieEvents(block){
  var svg=block.querySelector('.pie-chart');
  if(!svg)return;
  var labels=svg.querySelectorAll('.pie-label');
  var slices=svg.querySelectorAll('.pie-slice');
  function clearAll(){for(var j=0;j<labels.length;j++){labels[j].style.opacity='0';labels[j].style.pointerEvents='none';if(slices[j])slices[j].style.transform=''}}
  slices.forEach(function(slice,i){
    slice.addEventListener('click',function(e){
      e.stopPropagation();
      var cur=labels[i];if(!cur)return;
      var shown=cur.style.opacity==='1';
      clearAll();
      if(!shown){cur.style.opacity='1';cur.style.pointerEvents='auto';slice.style.transform='scale(1.06)'}
    });
  });
  svg.addEventListener('click',clearAll);
}
function renderMermaidFlowchart(code){
  var lines=code.split('\n').map(function(l){return l.trim()}).filter(Boolean);
  if(!lines.length)return null;
  var first=lines[0];
  if(/^(graph|flowchart)\s+(TD|LR|RL|BT)/i.test(first))return renderFlowGraph(lines);
  if(first.match(/^sequenceDiagram/i))return renderSequenceDiagram(lines);
  if(first.match(/^pie(\s+title)?/i))return renderPieChart(lines);
  return null;
}
function renderFlowGraph(lines){
  var dir='TD';var first=lines[0].match(/^(graph|flowchart)\s+(TD|LR|RL|BT)/i);
  if(first){dir=first[2].toUpperCase();lines.shift()}
  var nodes={},edges=[],nodeOrder=[];
  function getNode(id){if(!nodes[id])nodes[id]={id:id,label:id,shape:'rect'};return nodes[id]}
  function ensureNode(id){if(!nodes[id]){getNode(id);nodeOrder.push(id)}}
  lines.forEach(function(line){
    var m=line.match(/^(\w+)(\[.*?\]|\(.*?\)|\{.*?\}|\[\[.*?\]\]|\(\(.*?\)\))?\s*(-[-.]*>|==+>|-[-.]*[^>]*->|==[^>]*==>)\s*(\w+)(\[.*?\]|\(.*?\)|\{.*?\}|\[\[.*?\]\]|\(\(.*?\)\))?\s*(?:\|([^|]*)\|)?$/);
    if(!m)return;
    var src=m[1],dst=m[4];ensureNode(src);ensureNode(dst);
    var s1=m[2]||'',s2=m[5]||'';
    if(s1.match(/^\[.*\]$/))nodes[src].label=s1.slice(1,-1);
    else if(s1.match(/^\(.*\)$/)){nodes[src].label=s1.slice(1,-1);nodes[src].shape='rounded'}
    else if(s1.match(/^\{.*\}$/)){nodes[src].label=s1.slice(1,-1);nodes[src].shape='diamond'}
    else if(s1.match(/^\[\[.*\]\]$/)){nodes[src].label=s1.slice(2,-2);nodes[src].shape='subprocess'}
    else if(s1.match(/^\(\(.*\)\)$/)){nodes[src].label=s1.slice(2,-2);nodes[src].shape='circle'}
    if(s2.match(/^\[.*\]$/))nodes[dst].label=s2.slice(1,-1);
    else if(s2.match(/^\(.*\)$/)){nodes[dst].label=s2.slice(1,-1);nodes[dst].shape='rounded'}
    else if(s2.match(/^\{.*\}$/)){nodes[dst].label=s2.slice(1,-1);nodes[dst].shape='diamond'}
    else if(s2.match(/^\[\[.*\]\]$/)){nodes[dst].label=s2.slice(2,-2);nodes[dst].shape='subprocess'}
    else if(s2.match(/^\(\(.*\)\)$/)){nodes[dst].label=s2.slice(2,-2);nodes[dst].shape='circle'}
    edges.push({src:src,dst:dst,label:(m[6]||'').trim(),style:m[3].indexOf('.')>=0?'dotted':'solid'});
  });
  if(!nodeOrder.length)return null;
  var children={};nodeOrder.forEach(function(id){children[id]=[]});edges.forEach(function(e){if(children[e.src])children[e.src].push(e.dst)});
  var depths={};function getDepth(id,d){if(depths[id]!==undefined)return depths[id];depths[id]=d;var mx=d;(children[id]||[]).forEach(function(c){mx=Math.max(mx,getDepth(c,d+1))});return mx}
  nodeOrder.forEach(function(id){getDepth(id,0)});
  var maxD=0;nodeOrder.forEach(function(id){maxD=Math.max(maxD,depths[id])});
  var layers=[];for(var d=0;d<=maxD;d++){layers[d]=[];nodeOrder.forEach(function(id){if(depths[id]===d)layers[d].push(id)})}
  var nW=160,nH=50,gX=40,gY=80,pX=30,pY=30,positions={};
  layers.forEach(function(layer,di){var tw=layer.length*nW+(layer.length-1)*gX;layer.forEach(function(id,li){positions[id]={x:pX+li*(nW+gX)+nW/2,y:pY+di*(nH+gY)+nH/2}})});
  var maxLW=0;layers.forEach(function(l){var w=l.length*nW+(l.length-1)*gX;if(w>maxLW)maxLW=w});
  var sW=maxLW+pX*2,sH=(maxD+1)*(nH+gY)-gY+pY*2;
  var dk=document.documentElement.getAttribute('data-theme')==='dark';
  var bg=dk?'#191B1D':'#FFF',nBg=dk?'#354A54':'#D4DDE3',nBd=dk?'#9AB0BF':'#3D5A6E',tc=dk?'#E3E3E6':'#1C1C1E',ac=dk?'#6B6F73':'#75787C',dBg=dk?'#4A7B6A':'#D4E8DF';
  var s='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+sW+' '+sH+'" style="font-family:Noto Sans SC,PingFang SC,sans-serif;max-width:'+sW+'px;width:100%;height:auto">';
  s+='<defs><marker id="ah" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="10" markerHeight="6" orient="auto"><path d="M0,0L10,3L0,6" fill="'+ac+'"/></marker></defs>';
  edges.forEach(function(e){var sx=positions[e.src].x,sy=positions[e.src].y+nH/2,dx=positions[e.dst].x,dy=positions[e.dst].y-nH/2;var dash=e.style==='dotted'?' stroke-dasharray="6 4"':'';s+='<line x1="'+sx+'" y1="'+sy+'" x2="'+dx+'" y2="'+dy+'" stroke="'+ac+'" stroke-width="1.5"'+dash+' marker-end="url(#ah)"/>';if(e.label){var lx=(sx+dx)/2,ly=(sy+dy)/2-6;s+='<rect x="'+(lx-e.label.length*5-4)+'" y="'+(ly-10)+'" width="'+(e.label.length*10+8)+'" height="16" rx="3" fill="'+bg+'"/><text x="'+lx+'" y="'+ly+'" text-anchor="middle" font-size="11" fill="'+tc+'">'+escHtml(e.label)+'</text>'}});
  nodeOrder.forEach(function(id){var n=nodes[id],p=positions[id],cx=p.x,cy=p.y;if(n.shape==='diamond'){var dw=nW*0.7,dh=nH*0.9;s+='<polygon points="'+cx+','+(cy-dh)+' '+(cx+dw)+','+cy+' '+cx+','+(cy+dh)+' '+(cx-dw)+','+cy+'" fill="'+dBg+'" stroke="'+nBd+'" stroke-width="1.5"/><text x="'+cx+'" y="'+(cy+4)+'" text-anchor="middle" font-size="13" font-weight="600" fill="'+tc+'">'+escHtml(n.label)+'</text>'}else if(n.shape==='circle'){var r=nH*0.45;s+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+nBg+'" stroke="'+nBd+'" stroke-width="1.5"/><text x="'+cx+'" y="'+(cy+4)+'" text-anchor="middle" font-size="12" fill="'+tc+'">'+escHtml(n.label)+'</text>'}else{var rx=n.shape==='rounded'?10:4;s+='<rect x="'+(cx-nW/2)+'" y="'+(cy-nH/2)+'" width="'+nW+'" height="'+nH+'" rx="'+rx+'" fill="'+nBg+'" stroke="'+nBd+'" stroke-width="1.5"/><text x="'+cx+'" y="'+(cy+4)+'" text-anchor="middle" font-size="13" fill="'+tc+'">'+escHtml(n.label)+'</text>'}});
  s+='</svg>';return s;
}
function renderSequenceDiagram(lines){
  lines.shift();var participants=[],messages=[];
  lines.forEach(function(line){
    var pm=line.match(/^participant\s+(\S+)(?:\s+as\s+(.+))?$/);
    if(pm){participants.push({id:pm[1],label:pm[2]||pm[1]});return}
    var mm=line.match(/^(\S+)\s*(--?>>?|--?>>?)\s*(\S+)\s*:\s*(.+)$/);
    if(mm)messages.push({from:mm[1],to:mm[3],label:mm[4].trim(),style:mm[2].indexOf('--')>=0?'dashed':'solid'});
  });
  if(!participants.length&&!messages.length)return null;
  var pMap={};participants.forEach(function(p){pMap[p.id]=p});
  messages.forEach(function(m){if(!pMap[m.from])pMap[m.from]={id:m.from,label:m.from};if(!pMap[m.to])pMap[m.to]={id:m.to,label:m.to}});;
  var pList=[];var seen={};messages.forEach(function(m){if(!seen[m.from]){pList.push(pMap[m.from]);seen[m.from]=1}if(!seen[m.to]){pList.push(pMap[m.to]);seen[m.to]=1}});
  if(!pList.length)return null;
  var colW=160,colGap=60,rowH=50,padX=40,padY=30;
  var sW=pList.length*colW+(pList.length-1)*colGap+padX*2;
  var sH=padY*2+60+messages.length*rowH;
  var dk=document.documentElement.getAttribute('data-theme')==='dark';
  var tc=dk?'#E3E3E6':'#1C1C1E',ac=dk?'#6B6F73':'#75787C',lc=dk?'#9AB0BF':'#3D5A6E';
  var bg=dk?'#354A54':'#D4DDE3';
  var s='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+sW+' '+sH+'" style="font-family:Noto Sans SC,PingFang SC,sans-serif;max-width:'+sW+'px;width:100%;height:auto">';
  s+='<defs><marker id="sa" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto"><path d="M0,0L10,3L0,6" fill="'+ac+'"/></marker></defs>';
  pList.forEach(function(p,i){var x=padX+i*(colW+colGap)+colW/2;s+='<rect x="'+(x-50)+'" y="'+padY+'" width="100" height="32" rx="6" fill="'+bg+'" stroke="'+lc+'" stroke-width="1.5"/><text x="'+x+'" y="'+(padY+20)+'" text-anchor="middle" font-size="13" font-weight="600" fill="'+tc+'">'+escHtml(p.label)+'</text>';s+='<line x1="'+x+'" y1="'+(padY+32)+'" x2="'+x+'" y2="'+(sH-padY)+'" stroke="'+ac+'" stroke-width="1" stroke-dasharray="4 3"/>'});
  var pIdx={};pList.forEach(function(p,i){pIdx[p.id]=i});
  messages.forEach(function(m,i){
    var yi=padY+60+i*rowH;
    var fromX=padX+pIdx[m.from]*(colW+colGap)+colW/2;
    var toX=padX+pIdx[m.to]*(colW+colGap)+colW/2;
    var dash=m.style==='dashed'?' stroke-dasharray="6 4"':'';
    s+='<line x1="'+fromX+'" y1="'+yi+'" x2="'+toX+'" y2="'+yi+'" stroke="'+lc+'" stroke-width="1.5"'+dash+' marker-end="url(#sa)"/>';
    var lx=(fromX+toX)/2;
    s+='<text x="'+lx+'" y="'+(yi-6)+'" text-anchor="middle" font-size="12" fill="'+tc+'">'+escHtml(m.label)+'</text>';
  });
  s+='</svg>';return s;
}
function renderPieChart(lines){
  var title='';var slices=[];var inPie=false;
  lines.forEach(function(line){
    if(line.match(/^pie\s*(?:title\s+(.*))?$/i)){title=RegExp.$1||'';inPie=true;return}
    if(inPie){var sm=line.match(/^"([^"]+)"\s*:\s*(\d+)/);if(sm)slices.push({label:sm[1],value:parseInt(sm[2])})}
  });
  if(!slices.length)return null;
  var total=0;slices.forEach(function(s){total+=s.value});if(!total)return null;
  var colors=['#3D5A6E','#4A7B6A','#8E6B9E','#B07D56','#5C7A3D','#6B5B8A','#8B6B4A','#4A6B8A','#7A5B6B','#5B7A6A'];
  var cx=250,cy=200,r=130;
  var sW=500,legendGap=40,legendH=slices.length*26;
  var titleH=title?36:0;
  var sH=titleH+cy+r+legendGap+legendH+20;
  var dk=document.documentElement.getAttribute('data-theme')==='dark';
  var tc=dk?'#E3E3E6':'#1C1C1E',ac=dk?'#6B6F73':'#8E9196',lb=dk?'#E3E3E6':'#1C1C1E';
  var bg=dk?'#191B1D':'#FFFFFF';
  var s='<svg class="pie-chart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+sW+' '+sH+'" style="font-family:Noto Sans SC,PingFang SC,sans-serif;max-width:'+sW+'px;width:100%;height:auto">';
  s+='<rect width="'+sW+'" height="'+sH+'" fill="transparent"/>';
  var titleY=titleH?28:0;
  if(title)s+='<text x="'+(sW/2)+'" y="'+titleY+'" text-anchor="middle" font-size="16" font-weight="600" fill="'+tc+'">'+escHtml(title)+'</text>';
  var pieCy=titleH+cy;
  var startAngle=-Math.PI/2;
  var sliceData=[];
  slices.forEach(function(sl,i){
    var angle=sl.value/total*2*Math.PI;var endAngle=startAngle+angle;
    var x1=cx+r*Math.cos(startAngle),y1=pieCy+r*Math.sin(startAngle);
    var x2=cx+r*Math.cos(endAngle),y2=pieCy+r*Math.sin(endAngle);
    var large=angle>Math.PI?1:0;
    var col=colors[i%colors.length];
    var midAngle=startAngle+angle/2;
    var pct=Math.round(sl.value/total*100);
    sliceData.push({midAngle:midAngle,label:sl.label,pct:pct,col:col,i:i,x1:x1,y1:y1,x2:x2,y2:y2,large:large});
    s+='<path class="pie-slice" d="M'+cx+','+pieCy+' L'+x1+','+y1+' A'+r+','+r+' 0 '+large+',1 '+x2+','+y2+' Z" fill="'+col+'" stroke="'+bg+'" stroke-width="2" style="transform-origin:'+cx+'px '+pieCy+'px;transition:transform 220ms cubic-bezier(.4,0,.2,1);cursor:pointer"/>';
    var tx=cx+r*0.55*Math.cos(midAngle);var ty=pieCy+r*0.55*Math.sin(midAngle);
    if(angle>0.3)s+='<text x="'+tx+'" y="'+(ty+4)+'" text-anchor="middle" font-size="12" font-weight="600" fill="#fff" pointer-events="none">'+pct+'%</text>';
    startAngle=endAngle;
  });
  sliceData.forEach(function(sd){
    var lx1=cx+r*0.85*Math.cos(sd.midAngle);
    var ly1=pieCy+r*0.85*Math.sin(sd.midAngle);
    var lx2=cx+r*1.4*Math.cos(sd.midAngle);
    var ly2=pieCy+r*1.4*Math.sin(sd.midAngle);
    var right=Math.cos(sd.midAngle)>=0;
    var tx=lx2+(right?10:-10);
    var anchor=right?'start':'end';
    s+='<g class="pie-label" style="opacity:0;transition:opacity 200ms;pointer-events:none">';
    s+='<line x1="'+lx1+'" y1="'+ly1+'" x2="'+lx2+'" y2="'+ly2+'" stroke="'+ac+'" stroke-width="1.2"/>';
    s+='<circle cx="'+lx1+'" cy="'+ly1+'" r="2.5" fill="'+ac+'"/>';
    s+='<text x="'+tx+'" y="'+(ly2+4)+'" text-anchor="'+anchor+'" font-size="13" font-weight="500" fill="'+lb+'">'+escHtml(sd.label)+' ('+sd.pct+'%)</text>';
    s+='</g>';
  });
  var ly=titleH+cy+r+legendGap;
  var lx=cx-60;
  slices.forEach(function(sl,i){
    var col=colors[i%colors.length];
    s+='<circle cx="'+lx+'" cy="'+(ly+6)+'" r="5" fill="'+col+'"/>';
    s+='<text x="'+(lx+12)+'" y="'+(ly+10)+'" font-size="13" fill="'+tc+'">'+escHtml(sl.label)+'</text>';
    lx+=escHtml(sl.label).length*13+36;
    if(lx>sW-40){lx=cx-60;ly+=26}
  });
  s+='</svg>';return s;
}
function processCodeBlocks(){if(codeProcessed)return;codeProcessed=true;var pres=articleBody.querySelectorAll('pre');if(!pres.length)return;if(!document.querySelector('link[href*="prism-tomorrow"]')){var cb=document.createElement('link');cb.rel='stylesheet';cb.href='https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css';document.head.appendChild(cb)}function highlightAll(pres){for(var i=0;i<pres.length;i++){var pre=pres[i];if(pre.closest('.code-block'))continue;var code=pre.querySelector('code'),text=code?code.textContent:pre.textContent;text=text.replace(/^\n+/,'').replace(/\n+$/,'');var lines=text.split('\n');var lm=code?code.className.match(/language-(\w+)/):null,lang=lm?lm[1]:'code';var w=document.createElement('div');w.className='code-block';var bar=document.createElement('div');bar.className='cb-bar';var ft=code.getAttribute("file-title");bar.innerHTML='<span class="cb-lang">'+lang+'</span>'+(ft?'<span class="cb-file">'+escHtml(ft)+'</span>':'')+'<button class="cb-copy" type="button" aria-label="复制代码">'+icons.copy+'</button>';var body=document.createElement('div');body.className='cb-body';var lnDiv=document.createElement('div');lnDiv.className='cb-lines';var lh='';for(var j=0;j<lines.length;j++)lh+='<span>'+(j+1)+'</span>';lnDiv.innerHTML=lh;var sep=document.createElement('div');sep.className='cb-sep';var preW=document.createElement('div');preW.className='cb-pre-wrap';var np=document.createElement('pre');np.className='language-'+lang;var nc=document.createElement('code');nc.className='language-'+lang;nc.textContent=lines.join('\n');np.appendChild(nc);preW.appendChild(np);body.appendChild(lnDiv);body.appendChild(sep);body.appendChild(preW);w.appendChild(bar);w.appendChild(body);pre.parentNode.replaceChild(w,pre);if(lang==="diff"){var dLines=nc.textContent.split("\n");var dlHtml="";for(var dl=0;dl<dLines.length;dl++){var dlt=escHtml(dLines[dl]);if(dlt.charAt(0)==="+")dlHtml+="<span class=\"diff-add\">"+dlt+"</span>\n";else if(dlt.charAt(0)==="-")dlHtml+="<span class=\"diff-del\">"+dlt+"</span>\n";else dlHtml+=dlt+"\n"}nc.innerHTML=dlHtml.trimEnd()}if(typeof Prism!=='undefined'&&window.Prism)try{Prism.highlightElement(nc)}catch(e){}}}if(prismLoaded){highlightAll(pres);return}prismLoaded=true;var s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js';s.setAttribute('data-manual','');s.onload=function(){if(typeof Prism!=='undefined')highlightAll(pres)};document.head.appendChild(s)}
function setPageStagger(pid){}

var pageHash={'/':'articles','/tags':'tags','/categories':'categories','/archive':'archive','/friends':'friends','/about':'about'};
var hashPage={articles:'/',tags:'/tags',categories:'/categories',archive:'/archive',friends:'/friends',about:'/about'};
function routeToHash(r){if(r.type==='article')return '#/posts/'+buildSlug(r.articleId);var page=r.page||'articles';if(page==='articles'){if(r.paginationPage>0)return '#/page/'+(r.paginationPage+1);return '#/'}return '#'+(hashPage[page]||'/')}
function parseHash(){var h=(location.hash||'').replace(/^#/,'')||'/';if(h==='/')return{type:'page',page:'articles'};var am=h.match(/^\/posts\/(\d{8})$/);if(am&&slugToId[am[1]])return{type:'article',articleId:slugToId[am[1]]};var pm=h.match(/^\/page\/(\d+)$/);if(pm)return{type:'page',page:'articles',paginationPage:parseInt(pm[1])-1};return{type:'page',page:pageHash[h]||'articles'}}
function pushRoute(r){history.pushState(r,'',routeToHash(r));updateSEO(r)}
function replaceRoute(r){history.replaceState(r,'',routeToHash(r));updateSEO(r)}
function updateSEO(r){if(r.type==='article'){var a=articles[r.articleId];if(a){document.title=a.title+' | '+window.__HAPRIAL_DATA__.siteTitle;if(metaDesc)metaDesc.content=a.excerpt;if(ogTitle)ogTitle.content=a.title;if(ogDesc)ogDesc.content=a.excerpt;addJsonLd(a)}}else{document.title=seoTitles[r.page]||window.__HAPRIAL_DATA__.siteTitle;if(metaDesc)metaDesc.content=window.__HAPRIAL_DATA__.siteTitle;removeJsonLd()}if(linkCanon)linkCanon.href=location.href}
function addJsonLd(a){removeJsonLd();var s=document.createElement('script');s.type='application/ld+json';s.id='artld';s.textContent=JSON.stringify({"@context":"https://schema.org","@type":"BlogPosting","headline":a.title,"description":a.excerpt,"datePublished":a.dateISO,"author":{"@type":"Person","name":window.__HAPRIAL_DATA__.siteAuthor}});document.head.appendChild(s)}
function removeJsonLd(){var o=document.getElementById('artld');if(o)o.remove()}
var lastRouteWasArticle=false;
function applyRoute(route){if(!route)route={type:'page',page:'articles'};var artOpen=articleView.classList.contains('open');if(route.type==='article'){lastRouteWasArticle=true;if(artOpen&&route.articleId===currentArticleId){updateSEO(route);return}if(!artOpen)openArticleVisual(route.articleId);else{var dir=articleOrder.indexOf(route.articleId)<articleOrder.indexOf(currentArticleId)?'next':'prev';switchToArticleVisual(route.articleId,dir)}}else{if(artOpen)closeArticleVisual();if(lastRouteWasArticle&&route.page==='articles'){lastRouteWasArticle=false;syncTabs('articles');updateSEO(route);return}lastRouteWasArticle=false;if(route.page!==currentPage){var oi=tabOrder.indexOf(currentPage),ni=tabOrder.indexOf(route.page);switchPageVisual(route.page,ni>oi?'right':'left')}else syncTabs(route.page);if(route.page==='articles'&&route.paginationPage!=null){paginationPage=route.paginationPage;renderPaginationPage()}}updateSEO(route)}

var _lastRenderKey='';
function renderPaginationPage(){var all=getAllCards(),cards=all.filter(function(c){return c.dataset._filtered!=='1'});var total=Math.ceil(cards.length/perPage);if(total<1)total=1;if(paginationPage>=total)paginationPage=total-1;if(paginationPage<0)paginationPage=0;try{sessionStorage.setItem('pg',paginationPage)}catch(e){}var renderKey=paginationPage+'|'+cards.map(function(c){return c.dataset.id}).join(',');var animate=renderKey!==_lastRenderKey;_lastRenderKey=renderKey;var start=paginationPage*perPage,end=start+perPage,i,ci=0;var cardsState=[];for(i=0;i<all.length;i++){var c=all[i],isFiltered=c.dataset._filtered==='1',inPage=false;if(!isFiltered){inPage=ci>=start&&ci<end;ci++}cardsState.push({el:c,show:isFiltered?false:inPage})}if(animate){for(i=0;i<cardsState.length;i++){var s=cardsState[i];s.el.classList.remove('show');s.el.style.display='none'}var _=all[0]&&all[0].offsetHeight}for(i=0;i<cardsState.length;i++){var s=cardsState[i];if(s.show){s.el.style.display='';if(animate)s.el.classList.add('show');else if(!s.el.classList.contains('show'))s.el.classList.add('show')}else{s.el.style.display='none';s.el.classList.remove('show')}}var noR=$('noResults');if(!cards.length){noR.classList.add('show');pagination.innerHTML='';pagination.classList.remove('show');return}noR.classList.remove('show');if(total>1){var h='<button class="pg-btn"'+(paginationPage===0?' disabled':'')+' data-pg="prev" aria-label="上一页">'+icons.chevL+'</button>';for(var i=0;i<total;i++)h+='<button class="pg-btn'+(i===paginationPage?' active':'')+'"'+(i===paginationPage?' aria-current="page"':'')+' data-pg="'+i+'" aria-label="第'+(i+1)+'页">'+(i+1)+'</button>';h+='<button class="pg-btn"'+(paginationPage===total-1?' disabled':'')+' data-pg="next" aria-label="下一页">'+icons.chevR+'</button>';pagination.innerHTML=h;pagination.classList.add('show')}else{pagination.innerHTML='<span style="font-size:13px;color:var(--outline)">共 '+cards.length+' 篇文章</span>';pagination.classList.add('show')}}
function renderAllCards(){getAllCards().forEach(function(c){c.dataset._filtered='';c.style.display='none';c.classList.remove('show')})}

function setTocHighlight(id){lastActiveId=id;var items=tocList.children;for(var i=0;i<items.length;i++){var it=items[i];it.classList.toggle('active',it.dataset.target===id)}var dItems=tocDrawerList.children;for(var i=0;i<dItems.length;i++){var di=dItems[i];di.classList.toggle('active',di.dataset.target===id)}var activeItem=tocList.querySelector('.active');if(activeItem){var aTop=activeItem.offsetTop,sTop=toc.scrollTop,cH=toc.clientHeight;if(aTop<sTop||aTop+activeItem.offsetHeight>sTop+cH){toc.scrollTop=aTop-cH/2}}if(tocSheet.classList.contains('open')){var activeDrawer=tocDrawerList.querySelector('.active');if(activeDrawer){var dTop=activeDrawer.offsetTop,dsTop=tocDrawerList.scrollTop,dH=tocDrawerList.clientHeight;if(dTop<dsTop||dTop+activeDrawer.offsetHeight>dsTop+dH){tocDrawerList.scrollTop=dTop-dH/3}}}}
function lockTocManual(){tocManualLock=true;clearTimeout(tocManualTimer);tocManualTimer=setTimeout(function(){tocManualLock=false},3000)}
function buildTOC(){tocList.innerHTML='';tocDrawerList.innerHTML='';headingCache=null;lastActiveId=null;var heads=articleBody.querySelectorAll('h2,h3');heads.forEach(function(h){var li=document.createElement('li');li.className='toc-item';li.dataset.target=h.id;li.innerHTML='<a class="toc-link'+(h.tagName==='H3'?' sub':'')+'">'+h.textContent+'</a>';tocList.appendChild(li);li.addEventListener('click',function(){lockTocManual();setTocHighlight(h.id);articleView.scrollTo({top:h.offsetTop-80,behavior:'smooth'})});var di=document.createElement('li');di.className='toc-drawer-item'+(h.tagName==='H3'?' sub':'');di.textContent=h.textContent;di.dataset.target=h.id;tocDrawerList.appendChild(di);di.addEventListener('click',function(){closeTocSheet();lockTocManual();setTocHighlight(h.id);articleView.scrollTo({top:h.offsetTop-80,behavior:'smooth'})})});cacheHeadings();if(headingCache.length)setTocHighlight(headingCache[0].id)}
function cacheHeadings(){headingCache=[];var vTop=articleView.getBoundingClientRect().top;articleBody.querySelectorAll('h2,h3').forEach(function(h){headingCache.push({id:h.id,top:h.getBoundingClientRect().top-vTop+articleView.scrollTop})});_headingCacheDirty=false}
var _headingCacheDirty=false;
function invalidateHeadingCache(){_headingCacheDirty=true}
function updateTOCHighlight(){if(tocManualLock||!headingCache||!headingCache.length)return;if(_headingCacheDirty)cacheHeadings();var st=articleView.scrollTop,maxS=articleView.scrollHeight-articleView.clientHeight;if(maxS<100)return;var curId=null;for(var i=headingCache.length-1;i>=0;i--){if(headingCache[i].top<=st+120){curId=headingCache[i].id;break}}if(!curId&&st>=maxS-30)curId=headingCache[headingCache.length-1].id;if(!curId)curId=headingCache[0].id;if(curId!==lastActiveId)setTocHighlight(curId)}
function openTocSheet(){tocSheet.classList.add('open');setTimeout(function(){document.addEventListener('click',tocOutClick)},10);var active=tocDrawerList.querySelector('.toc-drawer-item.active');if(active){tocDrawerList.scrollTop=active.offsetTop-tocDrawerList.clientHeight/3}}
function closeTocSheet(){tocSheet.classList.remove('open');document.removeEventListener('click',tocOutClick)}
function tocOutClick(e){if(!e.target.closest('.toc-drawer')&&e.target!==tocToggleBtn&&!tocToggleBtn.contains(e.target))closeTocSheet()}
function renderArticleNav(id){var idx=articleOrder.indexOf(String(id)),nav=$('artNav'),html='';if(idx>0){var n=articles[articleOrder[idx-1]];if(n)html+='<button class="art-nav-btn prev" data-nav-id="'+articleOrder[idx-1]+'"><span class="art-nav-icon">'+icons.back+'</span><div class="art-nav-info"><div class="art-nav-label">'+escHtml(n.date)+'</div><div class="art-nav-title">'+escHtml(n.title)+'</div></div></button>'}if(idx<articleOrder.length-1){var p=articles[articleOrder[idx+1]];if(p)html+='<button class="art-nav-btn next" data-nav-id="'+articleOrder[idx+1]+'"><div class="art-nav-info"><div class="art-nav-label">'+escHtml(p.date)+'</div><div class="art-nav-title">'+escHtml(p.title)+'</div></div><span class="art-nav-icon">'+icons.fwd+'</span></button>'}nav.innerHTML=html;requestAnimationFrame(function(){nav.classList.add('revealed')})}

var __twikooLoaded=false;
var __friendsTwikooLoaded=false;
function __initFriendsTwikoo(){
  var envId=window.__HAPRIAL_DATA__.twikooEnvId;
  if(!envId||__friendsTwikooLoaded)return;
  var el=document.getElementById('tcomment-friends');
  if(!el)return;
  __friendsTwikooLoaded=true;
  function doInit(){if(typeof twikoo!=='undefined'){try{twikoo.init({envId:envId,el:'#tcomment-friends',path:'/friends/'})}catch(e){}}}
  var obs=new IntersectionObserver(function(entries){
    if(entries[0].isIntersecting){obs.disconnect();
      if(__twikooLoaded){doInit();return}
      __twikooLoaded=true;
      var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/twikoo@1.6.40/dist/twikoo.all.min.js';s.onload=doInit;document.head.appendChild(s);
    }
  },{rootMargin:'200px'});
  obs.observe(el);
}
function __initTwikoo(path){
  var envId=window.__HAPRIAL_DATA__.twikooEnvId;
  if(!envId)return;
  var section=document.getElementById('commentSection');
  if(!section)return;
  var el=section.querySelector('#tcomment');
  if(!el){section.innerHTML='<div id="tcomment"></div>';el=section.querySelector('#tcomment')}
  function doInit(){
    if(typeof twikoo!=='undefined'){
      try{
        if(el&&el.__twikoo){try{el.__twikoo.destroy()}catch(e){}}
        twikoo.init({envId:envId,el:'#tcomment',path:path})
      }catch(e){}
    }
  }
  if(typeof twikoo!=='undefined'){
    doInit();
  }else if(!__twikooLoaded){
    __twikooLoaded=true;
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/twikoo@1.6.40/dist/twikoo.all.min.js';
    s.onload=doInit;
    document.head.appendChild(s);
  }
}

function loadArticleMeta(id){var art=articles[id];if(!art)return;currentArticleId=id;_artScrollMax=articleView.scrollHeight-articleView.clientHeight;$('artMeta').innerHTML='<span>'+art.date+'</span><span style="color:var(--outline-variant)"> · </span><span>'+art.wc+' 字</span><span style="color:var(--outline-variant)"> · </span><span>'+art.rt+'</span>';$('artTitle').textContent=art.title;$('artTags').innerHTML=art.tags.map(function(t){return'<span class="tag" data-tagname="'+escHtml(t)+'">'+escHtml(t)+'</span>'}).join('');renderArticleNav(id);}
var _contentCache={};var _cacheOrder=[];var _cacheMax=10;
var _prefetchInFlight={};
function prefetchArticle(id){if(_contentCache[id]||_prefetchInFlight[id])return;_prefetchInFlight[id]=true;fetch('/posts/'+id+'/article.json').then(function(r){if(!r.ok)throw new Error(r.status);return r.json()}).then(function(d){cachePut(id,d.content||'')}).catch(function(){}).finally(function(){delete _prefetchInFlight[id]})}
function cachePut(id,content){if(!_contentCache[id])_cacheOrder.push(id);_contentCache[id]=content;if(_cacheOrder.length>_cacheMax){var evict=_cacheOrder.shift();delete _contentCache[evict]}}
function prefetchNeighbors(id){var idx=articleOrder.indexOf(String(id));if(idx>=0&&idx<articleOrder.length-1)prefetchArticle(articleOrder[idx+1]);if(idx>0)prefetchArticle(articleOrder[idx-1])}
function loadArticle(id){var art=articles[id];if(!art)return;loadArticleMeta(id);rprog.style.transform='scaleX(0)';fab.classList.remove('visible');articleView.scrollTop=0;headingCache=null;lastActiveId=null;tocManualLock=false;clearTimeout(tocManualTimer);clearTimeout(tocBuildTimer);_lastArtScrolled=null;_lastArtFab=null;articleBody.classList.remove('revealed');function renderContent(html){articleBody.innerHTML=html;codeProcessed=false;processCodeBlocks();revealImages();observeImages();requestAnimationFrame(function(){articleBody.classList.add('revealed')});tocBuildTimer=setTimeout(buildTOC,80);processMermaid();__initTwikoo('/posts/'+id+'/');setTimeout(function(){prefetchNeighbors(id)},300)}if(_contentCache[id]){renderContent(_contentCache[id]);var ci=_cacheOrder.indexOf(id);if(ci>0){_cacheOrder.splice(ci,1);_cacheOrder.push(id)}return}articleBody.innerHTML='<div class="skel-wrap"><div class="skel-line skel-w60"></div><div class="skel-line skel-w100"></div><div class="skel-line skel-w90"></div><div class="skel-line skel-w70"></div><div class="skel-gap"></div><div class="skel-line skel-w100"></div><div class="skel-line skel-w80"></div><div class="skel-line skel-w95"></div><div class="skel-line skel-w60"></div><div class="skel-gap"></div><div class="skel-line skel-w100"></div><div class="skel-line skel-w75"></div><div class="skel-line skel-w85"></div></div>';fetch('/posts/'+id+'/article.json').then(function(r){if(!r.ok)throw new Error(r.status);return r.json()}).then(function(d){cachePut(id,d.content||'');renderContent(_contentCache[id])}).catch(function(){articleBody.innerHTML='<p style="text-align:center;padding:80px 0;color:var(--outline)">加载失败，请刷新重试。</p>'})}
function openArticleVisual(id){scrollPos=window.scrollY;loadArticle(id);lockBody();requestAnimationFrame(function(){articleView.classList.add('open')});avBar.classList.remove('scrolled');fabComment.classList.add('visible');fabComment.classList.remove('shifted')}
function openArticleVisualImmediate(id){loadArticle(id);lockBody();articleView.style.transition='none';articleView.classList.add('open');articleView.offsetHeight;requestAnimationFrame(function(){articleView.style.transition=''});avBar.classList.remove('scrolled');fabComment.classList.add('visible');fabComment.classList.remove('shifted')}
function switchToArticleVisual(nid,dir){if(isSwitchingArticle)return;isSwitchingArticle=true;var ac=$('avContent'),dx=dir==='next'?-16:16;ac.style.transition='opacity 160ms cubic-bezier(.4,0,1,1),transform 160ms cubic-bezier(.4,0,1,1)';ac.style.opacity='0';ac.style.transform='translateX('+dx+'px)';ac.addEventListener('transitionend',function handler(){ac.removeEventListener('transitionend',handler);ac.style.transition='none';ac.style.transform='translateX('+(-dx)+'px)';loadArticle(nid);requestAnimationFrame(function(){ac.style.transition='opacity 240ms cubic-bezier(0,0,.2,1),transform 240ms cubic-bezier(0,0,.2,1)';ac.style.opacity='1';ac.style.transform='translateX(0)';ac.addEventListener('transitionend',function handler2(){ac.removeEventListener('transitionend',handler2);ac.style.transition='';ac.style.opacity='';ac.style.transform='';isSwitchingArticle=false},{once:true})})},{once:true})}
function closeArticleVisual(){if(!articleView.classList.contains('open'))return;articleView.classList.remove('open');closeTocSheet();unlockBody();var af=document.getElementById('anti-fouc');if(af)af.remove();currentArticleId=null;_lastFab=null;fabComment.classList.remove('visible');fabComment.classList.remove('shifted');fab.classList.remove('idle');fabComment.classList.remove('idle');var nav=$('artNav');if(nav)nav.classList.remove('idle');clearTimeout(_fabIdleTimer);lastRouteWasArticle=false;requestAnimationFrame(function(){window.scrollTo(0,scrollPos);topAppBar.classList.toggle('elevated',scrollPos>0);fab.classList.toggle('visible',scrollPos>400)})}
function switchPageVisual(name,dir){pageScrollPos[currentPage]=window.scrollY;if(currentPage==='articles')savedPaginationPage=paginationPage;var el=$('page'+name.charAt(0).toUpperCase()+name.slice(1));var curEl=$('page'+currentPage.charAt(0).toUpperCase()+currentPage.slice(1));function doSwitch(){syncTabs(name);if(curEl)curEl.classList.remove('active','slide-in-right','slide-in-left','slide-out-left','slide-out-right');if(el){if(dir&&!reducedMotion&&!isMobile){var cls=dir==='right'?'slide-in-right':'slide-in-left';el.classList.add('active',cls);el.addEventListener('animationend',function(){el.classList.remove(cls)},{once:true})}else{el.classList.add('active')}}currentPage=name;if(name==='articles'&&activeFilterLabel){applyFilterDirect(activeFilterLabel,activeFilterFn)}if(name==='friends')__initFriendsTwikoo();requestAnimationFrame(function(){instantScroll(pageScrollPos[name]||0)})}if(dir&&!reducedMotion&&!isMobile&&curEl&&curEl!==el){var exitCls=dir==='right'?'slide-out-left':'slide-out-right';var done=false;curEl.classList.add(exitCls);curEl.addEventListener('animationend',function(){if(done)return;done=true;curEl.classList.remove(exitCls);doSwitch()},{once:true});setTimeout(function(){if(!done){done=true;curEl.classList.remove(exitCls);doSwitch()}},160)}else{doSwitch()}}

var _artScrollThrottle=null,_tocRaf=null;
articleView.addEventListener('scroll',function(){if(_artScrollThrottle)return;_artScrollThrottle=setTimeout(function(){_artScrollThrottle=null;if(artScrollRaf)return;artScrollRaf=requestAnimationFrame(function(){artScrollRaf=null;var s=articleView.scrollTop,sc=s>0,fv=s>400;var prog=_artScrollMax>0?'scaleX('+s/_artScrollMax+')':'scaleX(0)';rprog.style.transform=prog;if(sc!==_lastArtScrolled){avBar.classList.toggle('scrolled',sc);_lastArtScrolled=sc}if(fv!==_lastArtFab){fab.classList.toggle('visible',fv);fabComment.classList.toggle('shifted',fv);_lastArtFab=fv}if(innerWidth<=768&&articleView.classList.contains('open')){clearTimeout(_fabIdleTimer);fab.classList.remove('idle');fabComment.classList.remove('idle');var nav=$('artNav');if(nav)nav.classList.remove('idle');_fabIdleTimer=setTimeout(function(){if(articleView.classList.contains('open')){fab.classList.add('idle');fabComment.classList.add('idle');var nav=$('artNav');if(nav)nav.classList.add('idle')}},1000)}if(!_tocRaf){_tocRaf=requestAnimationFrame(function(){_tocRaf=null;updateTOCHighlight()})}
})},100)},{passive:true});

function handleMainScroll(){var y=window.scrollY,el=y>0,fv=y>400,artOpen=articleView.classList.contains('open');if(el!==_lastElevated){topAppBar.classList.toggle('elevated',el);_lastElevated=el}if(!artOpen&&fv!==_lastFab){fab.classList.toggle('visible',fv);_lastFab=fv}}
window.addEventListener('scroll',function(){if(scrollRaf)return;scrollRaf=requestAnimationFrame(function(){scrollRaf=null;handleMainScroll()})},{passive:true});

function openSearch(){searchView.classList.add('open');svInput.value='';svResults.innerHTML='<p class="sv-hint">输入关键词搜索文章、标签和摘要。</p>';searchActiveIdx=-1;lockBody();history.pushState({type:'search'},'','#search');setTimeout(function(){svInput.focus()},300)}
function closeSearch(fromPopstate){if(!searchView.classList.contains('open'))return;searchView.classList.remove('open');searchActiveIdx=-1;unlockBody();if(!fromPopstate)history.back()}
function hlMatch(t,q){var s=escHtml(t);if(!q)return s;return s.replace(new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'),'<mark class="hl-match">$1</mark>')}
function filterSearch(q){q=(q||'').toLowerCase().trim();if(!q){svResults.innerHTML='<p class="sv-hint">输入关键词搜索文章、标签和摘要。</p>';return}var cards=getAllCards(),html='',found=false;cards.forEach(function(c){var t=c.dataset.title||'',e=c.dataset.excerpt||'',g=c.dataset.tags||'';if(t.toLowerCase().indexOf(q)!==-1||e.toLowerCase().indexOf(q)!==-1||g.toLowerCase().indexOf(q)!==-1){found=true;var tag=c.querySelector('.tag');html+='<div class="sv-item" data-id="'+c.dataset.id+'"><div class="sv-item-tag">'+(tag?tag.textContent:'')+'</div><div class="sv-item-title">'+hlMatch(t,q)+'</div><div class="sv-item-excerpt">'+hlMatch(e,q)+'</div></div>'}});svResults.innerHTML=found?html:'<div class="sv-no-results">未找到相关结果。</div>';svResults.querySelectorAll('.sv-item').forEach(function(el,i){el.style.setProperty('--sd',(i*40)+'ms')});searchActiveIdx=-1}
function updateSearchHighlight(){var items=svResults.querySelectorAll('.sv-item');for(var i=0;i<items.length;i++)items[i].classList.toggle('sv-item-active',i===searchActiveIdx);if(searchActiveIdx>=0&&items[searchActiveIdx])items[searchActiveIdx].scrollIntoView({block:'nearest'})}
svInput.addEventListener('input',function(){clearTimeout(searchTimer);searchActiveIdx=-1;var v=this.value;searchTimer=setTimeout(function(){filterSearch(v)},350)});

function updateTabIndicator(){var a=document.querySelector('.tab.active');if(a&&tabBar){var w=a.offsetWidth;var x=a.offsetLeft;tabBar.style.width=w+'px';tabBar.style.transform='translateX('+x+'px)'}}
function syncTabs(n){document.querySelectorAll('.tab').forEach(function(t){t.classList.toggle('active',t.dataset.page===n)});updateTabIndicator()}
function applyFilterDirect(label,fn){getAllCards().forEach(function(c){if(!fn(c)){c.dataset._filtered='1';c.style.display='none';c.classList.remove('show')}else{c.dataset._filtered='';c.style.display=''}});filterLabel.textContent=label;if(!filterBar.classList.contains('on'))filterBar.classList.add('on');paginationPage=0;renderPaginationPage()}
function instantScroll(y){document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,y);document.documentElement.style.scrollBehavior='';_lastElevated=null;_lastFab=null;handleMainScroll()}
function applyFilter(label,fn){activeFilterLabel=label;activeFilterFn=fn;if(currentPage!=='articles'){skipClear=true;switchPageVisual('articles','left');skipClear=false}else{syncTabs('articles')}applyFilterDirect(label,fn);instantScroll(0);pushRoute({type:'page',page:'articles'})}
function clearFilter(){activeFilterLabel='';activeFilterFn=null;if(!reducedMotion&&filterBar.classList.contains('on')){filterBar.classList.add('out');filterBar.classList.remove('on');filterBar.addEventListener('animationend',function(){filterBar.classList.remove('out')},{once:true})}else{filterBar.classList.remove('on')}filterLabel.textContent='';paginationPage=0;getAllCards().forEach(function(c){c.dataset._filtered='';c.style.display='none';c.classList.remove('show')});renderPaginationPage()}

function renderTags(){var sorted=allTags.slice().sort(function(a,b){return a.n.localeCompare(b.n,'zh-CN')});$('tagsCount').textContent='共 '+sorted.length+' 个标签';$('tagsGrid').innerHTML=sorted.map(function(t){return'<div class="tag-card" data-tag="'+t.n+'"><div class="tag-card-name">'+t.n+'</div><div class="tag-card-count">'+t.c+' 篇文章</div></div>'}).join('')}
function renderCats(){$('catsCount').textContent='共 '+cats.length+' 个分类';$('catsGrid').innerHTML=cats.map(function(c){return'<div class="cat-card" data-cat="'+c.f+'"><div class="cat-dot" style="background:'+c.col+'"></div><div class="cat-name">'+c.n+'</div><div class="cat-desc">'+c.d+'</div><div class="cat-count">'+c.c+' 篇文章</div></div>'}).join('')}
function renderArchive(){var entries=[];articleOrder.forEach(function(id){var art=articles[id];if(!art)return;var m=art.dateISO.match(/(\d{4})-(\d{2})-(\d{2})/);if(!m)return;entries.push({id:id,year:+m[1],month:+m[2],day:+m[3],title:art.title,tags:art.tags,rt:art.rt,category:art.category})});entries.sort(function(a,b){return(b.year*10000+b.month*100+b.day)-(a.year*10000+a.month*100+a.day)});var grouped={},html='',idx=0;var monthNames={1:"Jan",2:"Feb",3:"Mar",4:"Apr",5:"May",6:"Jun",7:"Jul",8:"Aug",9:"Sep",10:"Oct",11:"Nov",12:"Dec"};entries.forEach(function(e){if(!grouped[e.year])grouped[e.year]=[];grouped[e.year].push(e)});Object.keys(grouped).sort(function(a,b){return b-a}).forEach(function(y){var items=grouped[y];html+='<div class="archive-year-group"><div class="archive-year-label">'+y+'<span class="archive-year-count">'+items.length+' 篇</span></div>';items.forEach(function(e){var tag=e.tags.length?e.tags[0]:'';html+='<div class="archive-card" data-id="'+e.id+'" style="--arch-d:'+(idx++*50)+'ms"><div class="archive-card-date"><span class="archive-card-month">'+monthNames[e.month]+'</span><span class="archive-card-day">'+e.day+'</span></div><div class="archive-card-body"><div class="archive-card-title">'+escHtml(e.title)+'</div><div class="archive-card-meta">'+(tag?'<span class="archive-card-tag">'+escHtml(tag)+'</span>':'')+'<span class="archive-card-rt">'+e.rt+'</span></div></div></div>'});html+='</div>'});$('archiveCount').textContent='共 '+entries.length+' 篇文章';$('archiveTimeline').innerHTML=html}
function renderFriends(){$('flGrid').innerHTML=friends.map(function(f){return'<a class="fl-card" href="'+escHtml(f.u)+'" target="_blank" rel="noopener"><img class="fl-avatar" src="'+escHtml(f.a)+'" alt="'+escHtml(f.n)+'" width="48" height="48" loading="lazy"><div class="fl-info"><div class="fl-name">'+escHtml(f.n)+'</div><div class="fl-desc">'+escHtml(f.d)+'</div></div></a>'}).join('')}
function createRipple(e,el){if(isLowEnd)return;if(el.querySelectorAll('.ripple').length>3)return;var r=el.getBoundingClientRect(),s=Math.max(r.width,r.height)*2,sp=document.createElement('span');sp.className='ripple';sp.style.cssText='width:'+s+'px;height:'+s+'px;left:'+(e.clientX-r.left-s/2)+'px;top:'+(e.clientY-r.top-s/2)+'px';el.appendChild(sp);sp.addEventListener('animationend',function(){sp.remove()})}
function syncAllIcons(t){document.querySelectorAll('.theme-wrap').forEach(function(w){var s=w.querySelector('.sun'),m=w.querySelector('.moon');if(t==='dark'){s.classList.add('off');m.classList.remove('off')}else{s.classList.remove('off');m.classList.add('off')}})}
function setTheme(t){var el=document.documentElement;el.setAttribute('data-theme',t);try{localStorage.setItem('th',t)}catch(e){}syncAllIcons(t);var btn=document.getElementById('themeBtn');if(btn)btn.setAttribute('aria-pressed',t==='dark'?'true':'false')}
function toggleTheme(){var cur=document.documentElement.getAttribute('data-theme')||'light';setTheme(cur==='light'?'dark':'light')}

window.addEventListener('popstate',function(){if(searchView.classList.contains('open')){closeSearch(true);return}var st=history.state;if(!st)st=parseHash();applyRoute(st)});

/* Ripple: cards excluded — they only ripple on click, not pointerdown */
document.addEventListener('pointerdown',function(e){var el=e.target.closest('.icon-btn,.fab,.tab,.tag-card,.cat-card,.fl-card,.filter-clear,.pg-btn,.art-nav-btn,.archive-card,.about-link,.about-skill');if(!el||el.disabled||el.offsetParent===null)return;createRipple(e,el)},{passive:true});
/* Hover prefetch: start loading article content on card hover */
var _hoverTimer=null,_hoverId=null;
document.addEventListener('mouseover',function(e){var card=e.target.closest('.card[data-id]');if(!card){if(_hoverTimer){clearTimeout(_hoverTimer);_hoverTimer=null;_hoverId=null}return}var hid=card.dataset.id;if(hid===_hoverId)return;if(_hoverTimer)clearTimeout(_hoverTimer);_hoverId=hid;_hoverTimer=setTimeout(function(){prefetchArticle(hid)},150)},{passive:true});

document.addEventListener('click',function(e){
  var t;
  if((t=e.target.closest('.cb-copy'))){var cd=t.closest('.code-block');cd=cd&&cd.querySelector('code');if(cd){copyText(cd.textContent);t.classList.add('copied');var old=t.innerHTML;t.innerHTML=icons.check;setTimeout(function(){t.innerHTML=old;t.classList.remove('copied')},2000)}return}
  if((t=e.target.closest('.art-nav-btn'))&&t.dataset.navId){var nId=t.dataset.navId,dir=t.classList.contains('next')?'next':'prev';switchToArticleVisual(nId,dir);replaceRoute({type:'article',articleId:nId});return}
  if((t=e.target.closest('#artTags .tag'))&&t.dataset.tagname){var tn=t.dataset.tagname;activeFilterLabel=tn;activeFilterFn=function(c){var tags=(c.dataset.tags||'').split('\u001f');return tags.indexOf(tn)!==-1};closeArticleVisual();if(currentPage!=='articles'){switchPageVisual('articles','left')}replaceRoute({type:'page',page:'articles'});applyFilterDirect(tn,activeFilterFn);window.scrollTo({top:0,behavior:'smooth'});return}
  if((t=e.target.closest('.pg-btn'))&&!t.disabled){var p=t.dataset.pg;if(p==='prev')paginationPage--;else if(p==='next')paginationPage++;else paginationPage=parseInt(p);renderPaginationPage();var list=$('articleList');if(list)list.scrollIntoView({behavior:'smooth',block:'start'});pushRoute({type:'page',page:'articles',paginationPage:paginationPage});return}
  if((t=e.target.closest('.sv-item'))&&t.dataset.id){closeSearch();var sid=t.dataset.id;setTimeout(function(){pushRoute({type:'article',articleId:sid});openArticleVisual(sid)},150);return}
  if((t=e.target.closest('.archive-card'))&&t.dataset.id){createRipple(e,t);pushRoute({type:'article',articleId:t.dataset.id});openArticleVisual(t.dataset.id);return}
  if((t=e.target.closest('.card'))&&t.dataset.id){createRipple(e,t);prefetchArticle(t.dataset.id);pushRoute({type:'article',articleId:t.dataset.id});openArticleVisual(t.dataset.id);return}
  if(e.target.closest('#avBack')){if(history.length>1)history.back();else{closeArticleVisual();pushRoute({type:'page',page:'articles'})}return}
  if(e.target.closest('#tocToggleBtn')){tocSheet.classList.contains('open')?closeTocSheet():openTocSheet();return}
  if(e.target.closest('#tocScrim')){closeTocSheet();return}
  if(e.target.closest('#searchBtn')){openSearch();return}
  if(e.target.closest('#svBack')){closeSearch();return}
  if(e.target.closest('#svClear')){svInput.value='';svInput.focus();filterSearch('');return}
  if(e.target.closest('#themeBtn')||e.target.closest('#avThemeBtn')){toggleTheme();return}
  if(e.target.closest('#fab')){if(articleView.classList.contains('open'))articleView.scrollTo({top:0,behavior:'smooth'});else window.scrollTo({top:0,behavior:'smooth'});return}
  if(e.target.closest('#fabComment')){var cs=$('commentSection');if(cs)articleView.scrollTo({top:cs.offsetTop-64,behavior:'smooth'});return}
  if(e.target.closest('#logoBtn')){activeFilterLabel='';activeFilterFn=null;if(articleView.classList.contains('open')){closeArticleVisual();pushRoute({type:'page',page:'articles'})}else{pushRoute({type:'page',page:'articles'});switchPageVisual('articles','left')}return}
  if((t=e.target.closest('.tab'))&&t.dataset.page){var pg=t.dataset.page;if(pg!==currentPage||articleView.classList.contains('open')){if(articleView.classList.contains('open'))closeArticleVisual();var oi=tabOrder.indexOf(currentPage),ni=tabOrder.indexOf(pg);switchPageVisual(pg,ni>oi?'right':'left');pushRoute({type:'page',page:pg})}return}
  if((t=e.target.closest('.footer-link'))&&t.dataset.page){var pg=t.dataset.page;if(pg!==currentPage||articleView.classList.contains('open')){if(articleView.classList.contains('open'))closeArticleVisual();var oi=tabOrder.indexOf(currentPage),ni=tabOrder.indexOf(pg);switchPageVisual(pg,ni>oi?'right':'left');pushRoute({type:'page',page:pg})}return}
  if((t=e.target.closest('.tag-card'))&&t.dataset.tag){applyFilter(t.dataset.tag,function(c){var tags=(c.dataset.tags||'').split('\u001f');return tags.indexOf(t.dataset.tag)!==-1});return}
  if((t=e.target.closest('.cat-card'))&&t.dataset.cat){var cv=t.dataset.cat;applyFilter(catNameMap[cv]||cv,function(c){return catMap[+c.dataset.id]===cv});return}
  if(e.target.closest('#filterClear')){clearFilter();return}

});

document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){if(tocSheet.classList.contains('open')){closeTocSheet();return}if(searchView.classList.contains('open')){closeSearch();return}var lb=document.getElementById('lightbox');if(lb&&lb.classList.contains('open')){if(window.__lbClose)window.__lbClose();else{lb.classList.remove('open');document.body.style.overflow=''}return}if(articleView.classList.contains('open')){if(history.length>1)history.back();else{closeArticleVisual();pushRoute({type:'page',page:'articles'})}return}}
  if(searchView.classList.contains('open')){var items=svResults.querySelectorAll('.sv-item');if(e.key==='ArrowDown'){e.preventDefault();if(searchActiveIdx<items.length-1){searchActiveIdx++;updateSearchHighlight()}return}if(e.key==='ArrowUp'){e.preventDefault();if(searchActiveIdx>0){searchActiveIdx--;updateSearchHighlight()}return}if(e.key==='Enter'){e.preventDefault();if(searchActiveIdx>=0&&items[searchActiveIdx]){closeSearch();var sid=items[searchActiveIdx].dataset.id;setTimeout(function(){pushRoute({type:'article',articleId:sid});openArticleVisual(sid)},150)}return}}
  if(articleView.classList.contains('open')&&!searchView.classList.contains('open')){if(e.key==='ArrowRight'){var idx=articleOrder.indexOf(currentArticleId);if(idx<articleOrder.length-1){switchToArticleVisual(articleOrder[idx+1],'next');replaceRoute({type:'article',articleId:articleOrder[idx+1]})}return}if(e.key==='ArrowLeft'){var idx=articleOrder.indexOf(currentArticleId);if(idx>0){switchToArticleVisual(articleOrder[idx-1],'prev');replaceRoute({type:'article',articleId:articleOrder[idx-1]})}return}}
  if(e.key==='/'&&!searchView.classList.contains('open')&&!articleView.classList.contains('open')){e.preventDefault();openSearch()}
});
window.addEventListener('resize',function(){clearTimeout(resizeTimer);resizeTimer=setTimeout(function(){updateTabIndicator();invalidateHeadingCache();_artScrollMax=articleView.scrollHeight-articleView.clientHeight},120)});
/* Archive timeline grow on page activate */
(function(){var pg=$('pageArchive');if(!pg)return;var tl=pg.querySelector('.archive-timeline');if(!tl)return;new MutationObserver(function(){if(pg.classList.contains('active')){tl.classList.add('grow')}else{tl.classList.remove('grow')}}).observe(pg,{attributes:true,attributeFilter:['class']})})();

var th=null;try{th=localStorage.getItem('th')}catch(e){}if(!th)th=window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';
document.documentElement.setAttribute('data-theme',th);syncAllIcons(th);
var initRoute=parseHash();
if(initRoute.type==='page'&&initRoute.paginationPage){paginationPage=initRoute.paginationPage}
else{try{var sp=sessionStorage.getItem('pg');if(sp!==null)paginationPage=parseInt(sp)||0}catch(e){}}
renderTags();renderCats();renderArchive();renderFriends();renderPaginationPage();handleMainScroll();requestAnimationFrame(updateTabIndicator);
if(initRoute.type==='article'){if(isReload){replaceRoute(initRoute);openArticleVisualImmediate(initRoute.articleId)}else{replaceRoute({type:'page',page:'articles'});pushRoute(initRoute);requestAnimationFrame(function(){openArticleVisual(initRoute.articleId)})}}else{var af=document.getElementById('anti-fouc');if(af)af.remove();replaceRoute(initRoute);if(initRoute.page&&initRoute.page!=='articles'){switchPageVisual(initRoute.page,null);syncTabs(initRoute.page)}}




// TOC hover — bind/unbind mousemove for zero overhead when article closed
(function(){
  if(!toc||!articleView)return;
  var hideTimer=null, artOpen=false, threshold=9999, thresholdDirty=true;
  function updateThreshold(){var av=document.querySelector('.av-content');if(av)threshold=av.getBoundingClientRect().right;thresholdDirty=false}
  function show(){clearTimeout(hideTimer);toc.classList.add('visible')}
  function scheduleHide(){clearTimeout(hideTimer);hideTimer=setTimeout(function(){toc.classList.remove('visible')},1500)}
  var moveRaf=null;
  function onMove(e){
    if(moveRaf)return;
    moveRaf=requestAnimationFrame(function(){
      moveRaf=null;
      if(thresholdDirty)updateThreshold();
      if(e.clientX>=threshold)show();
      else scheduleHide();
    });
  }
var _moveBound=false;
  function bindMove(){if(!_moveBound){_moveBound=true;document.addEventListener('mousemove',onMove)}}
  function unbindMove(){if(_moveBound){_moveBound=false;document.removeEventListener('mousemove',onMove)}}
  toc.addEventListener('mouseenter',function(){if(artOpen)clearTimeout(hideTimer)});
  toc.addEventListener('mouseleave',function(){if(artOpen)scheduleHide()});
  var _origOpen=openArticleVisual;
  openArticleVisual=function(id){artOpen=true;thresholdDirty=true;bindMove();_origOpen(id)};
  var _origClose=closeArticleVisual;
  closeArticleVisual=function(){artOpen=false;unbindMove();clearTimeout(hideTimer);toc.classList.remove('visible');_origClose()};
  var _origImm=openArticleVisualImmediate;
  openArticleVisualImmediate=function(id){artOpen=true;thresholdDirty=true;bindMove();_origImm(id)};
  window.addEventListener('resize',function(){thresholdDirty=true});
})();
// Initialize lightbox (shared module)
window.__initLightbox(articleBody);

})();
