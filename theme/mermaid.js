// mermaid.js — Mermaid chart rendering (flowchart, sequence, pie)
// Depends on: Haprial (core.js)
(function(){
'use strict';

var H = window.Haprial;

// ── Public API ───────────────────────────────────────────────────────────
H.processMermaid = function(){
  var articleBody = H.el.articleBody;
  var blocks = articleBody.querySelectorAll('.mermaid-block');
  if(!blocks.length) return;
  if(!H.state._mermaidIO){
    try{ H.state._mermaidIO = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){ H.state._mermaidIO.unobserve(entry.target); H._renderMermaidBlock(entry.target) }
      })
    },{root:H.el.articleView, rootMargin:'300px 0px', threshold:0}) }catch(e){ H.state._mermaidIO = null }
  }
  var unrendered = articleBody.querySelectorAll('.mermaid-block:not([data-mr])');
  var i;
  if(H.state._mermaidIO){ for(i=0;i<unrendered.length;i++) H.state._mermaidIO.observe(unrendered[i]) }
  else{ for(i=0;i<unrendered.length;i++) H._renderMermaidBlock(unrendered[i]) }
};

H._renderMermaidBlock = function(b){
  b.setAttribute('data-mr','1');
  var code = b.getAttribute("data-code") || "";
  code = code.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,"\"");
  if(!code) return;
  try{
    var svg = H.renderMermaidFlowchart(code.trim());
    if(svg){
      b.innerHTML = svg;
      var pieSvg = b.querySelector('.pie-chart');
      if(pieSvg) H.initPieChart(pieSvg);
      var innerSvg = b.querySelector('svg');
      if(innerSvg) H._setupMermaidZoom(b, innerSvg);
    } else {
      b.innerHTML = '<p style="color:var(--outline)">不支持的图表类型</p>';
    }
  }catch(e){ b.innerHTML = '<p style="color:var(--outline)">图表渲染失败</p>' }
};

H._setupMermaidZoom = function(b, innerSvg){
  var panel = document.createElement('div');
  panel.className = 'mermaid-zoom-panel';
  var btnIn = document.createElement('button');
  btnIn.className = 'mermaid-zoom-btn'; btnIn.title = '放大';
  btnIn.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="11" y1="8" x2="11" y2="14"/></svg>';
  var btnOut = document.createElement('button');
  btnOut.className = 'mermaid-zoom-btn'; btnOut.title = '缩小';
  btnOut.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/><line x1="8" y1="11" x2="14" y2="11"/></svg>';
  panel.appendChild(btnIn); panel.appendChild(btnOut); b.appendChild(panel);

  var scale=1, tx=0, ty=0, dragging=false, startX=0, startY=0, startTx=0, startTy=0;
  var STEP=0.4, MIN_SCALE=1, MAX_SCALE=3;
  var _zfRaf=null, _bw=0, _bh=0, _sw0=0, _sh0=0;

  function _refreshDims(){ _bw=b.clientWidth; _bh=b.clientHeight; var _sgr=innerSvg.getBoundingClientRect(); _sw0=_sgr.width; _sh0=_sgr.height }
  function clamp(){
    var bw=_bw, bh=_bh, sw, sh;
    if(dragging){ sw=_sw0*scale; sh=_sh0*scale }
    else{ bw=b.clientWidth; bh=b.clientHeight; _bw=bw; _bh=bh; var _sgr2=innerSvg.getBoundingClientRect(); sw=_sgr2.width*scale; sh=_sgr2.height*scale; _sw0=_sgr2.width; _sh0=_sgr2.height }
    var maxX=Math.max((sw-bw)/2,0), maxY=Math.max((sh-bh)/2,0);
    if(tx>maxX)tx=maxX; if(tx<-maxX)tx=-maxX; if(ty>maxY)ty=maxY; if(ty<-maxY)ty=-maxY;
  }
  function _applyNow(){
    clamp();
    innerSvg.style.transform='scale('+scale+') translate('+tx/scale+'px,'+ty/scale+'px)';
    innerSvg.style.transition=dragging?'none':'transform .25s ease';
    b.classList.toggle('zoomed',scale>1);
  }
  function _scheduleApply(){ if(!_zfRaf)_zfRaf=requestAnimationFrame(function(){_zfRaf=null;_applyNow()}) }
  function apply(){ if(_zfRaf){cancelAnimationFrame(_zfRaf);_zfRaf=null}_applyNow() }

  function zoomAround(cx,cy,factor){
    var s0=scale, s1=Math.min(MAX_SCALE,Math.max(MIN_SCALE,s0*factor));
    if(s1===s0){apply();return}
    var brect=b.getBoundingClientRect(), rect=innerSvg.getBoundingClientRect();
    var sx=cx-(rect.left-brect.left), sy=cy-(rect.top-brect.top);
    var px=sx/s0, py=sy/s0;
    var _sgr3=innerSvg.getBoundingClientRect(), Cx=_sgr3.width/2, Cy=_sgr3.height/2;
    scale=s1; tx+=(s0-s1)*(px-Cx); ty+=(s0-s1)*(py-Cy);
    if(scale<=MIN_SCALE){tx=0;ty=0}
    apply();
  }
  b._zoomAround = function(e,dir){
    var br=b.getBoundingClientRect();
    var f=(dir==='out')?(1-STEP):(1+STEP);
    zoomAround(e.clientX-br.left, e.clientY-br.top, f);
  };
  btnIn.addEventListener('click',function(){ zoomAround(b.clientWidth/2, b.clientHeight/2, 1+STEP) });
  btnOut.addEventListener('click',function(){ zoomAround(b.clientWidth/2, b.clientHeight/2, 1-STEP) });
  innerSvg.addEventListener('mousedown',function(e){
    if(scale<=1||e.altKey)return; e.preventDefault(); dragging=true; innerSvg.style.willChange='transform';
    startX=e.clientX; startY=e.clientY; startTx=tx; startTy=ty; innerSvg.classList.add('panning'); _refreshDims();
  });
  var _onDocMove=function(e){if(!dragging)return;tx=startTx+(e.clientX-startX);ty=startTy+(e.clientY-startY);_scheduleApply()};
  var _onDocUp=function(){if(dragging){dragging=false;innerSvg.style.willChange='';innerSvg.classList.remove('panning');document.removeEventListener('mousemove',_onDocMove);document.removeEventListener('mouseup',_onDocUp);if(_zfRaf){cancelAnimationFrame(_zfRaf);_zfRaf=null;_applyNow()}}};
  document.addEventListener('mousemove',_onDocMove);
  document.addEventListener('mouseup',_onDocUp);

  // Touch support
  var touchId=null, touchPending=false, touchStartX=0, touchStartY=0, TOUCH_THRESHOLD=8;
  var pinchDist=0, pinchScale0=0;
  b.addEventListener('touchstart',function(e){
    var pts=e.touches;
    if(pts.length===2){
      e.preventDefault();
      var dx=pts[0].clientX-pts[1].clientX, dy=pts[0].clientY-pts[1].clientY;
      pinchDist=Math.sqrt(dx*dx+dy*dy); pinchScale0=scale;
    } else if(pts.length===1 && scale>1){
      touchId=pts[0].identifier; touchStartX=pts[0].clientX; touchStartY=pts[0].clientY;
      startTx=tx; startTy=ty; dragging=true; innerSvg.style.transition='none';
    }
  },{passive:false});
  b.addEventListener('touchmove',function(e){
    var pts=e.touches;
    if(pts.length===2 && pinchDist>0){
      e.preventDefault();
      var dx=pts[0].clientX-pts[1].clientX, dy=pts[0].clientY-pts[1].clientY;
      var dist=Math.sqrt(dx*dx+dy*dy);
      scale=Math.max(MIN_SCALE,Math.min(MAX_SCALE,pinchScale0*(dist/pinchDist)));
      _scheduleApply();
    } else if(pts.length===1 && dragging){
      for(var i=0;i<pts.length;i++){
        if(pts[i].identifier===touchId){
          tx=startTx+(pts[i].clientX-touchStartX);
          ty=startTy+(pts[i].clientY-touchStartY);
          _scheduleApply();
          break;
        }
      }
    }
  },{passive:false});
  b.addEventListener('touchend',function(e){
    if(pinchDist>0 && e.touches.length<2){ pinchDist=0; scale=Math.max(MIN_SCALE,scale); _applyNow() }
    if(e.touches.length===0){ dragging=false; innerSvg.style.transition='' }
  });

  b._zoomCleanup = function(){
    document.removeEventListener('mousemove', _onDocMove);
    document.removeEventListener('mouseup', _onDocUp);
  };
};

// ── Flowchart rendering ──────────────────────────────────────────────────
H.renderMermaidFlowchart = function(code){
  var lines = code.split('\n');
  if(!lines.length) return null;
  var first = lines[0].trim().toLowerCase();
  if(first.indexOf('graph')===0 || first.indexOf('flowchart')===0) return H.renderFlowGraph(lines);
  if(first.indexOf('sequencediagram')===0) return H.renderSequenceDiagram(lines);
  if(first.indexOf('pie')===0) return H.renderPieChart(lines);
  return null;
};

H.renderFlowGraph = function(lines){
  var nodes={}, nodeOrder=[], edges=[], children={};
  var dir='TB';
  function getNode(id){ if(!nodes[id])nodes[id]={id:id,label:id,shape:'rect'}; return nodes[id] }
  function ensureNode(id){ if(!nodes[id]){getNode(id);nodeOrder.push(id)} }

  for(var i=0;i<lines.length;i++){
    var line=lines[i].trim();
    if(!line||line.startsWith('%%'))continue;
    var dm=line.match(/^(graph|flowchart)\s+([A-Z]{2})/i);
    if(dm){dir=dm[2].toUpperCase();continue}
    
    // Helper: parse node ID, optionally with inline definition like C[label]
    function parseNodeId(s){
      s=s.trim();
      var nm=s.match(/^(\w+)(\[.*\]|\{.*\}|\(.*\)|\(\(.*\)\)|\[\[.*\]\])?$/);
      if(nm){
        var id=nm[1],shape=nm[2];
        if(shape){
          var n=getNode(id);
          if(shape.startsWith('{')){n.shape='diamond';n.label=shape.slice(1,-1)}
          else if(shape.startsWith('[[')){n.shape='subroutine';n.label=shape.slice(2,-2)}
          else if(shape.startsWith('((')){n.shape='circle';n.label=shape.slice(2,-2)}
          else if(shape.startsWith('[')){n.shape='rect';n.label=shape.slice(1,-1)}
          else if(shape.startsWith('(')){n.shape='round';n.label=shape.slice(1,-1)}
          nodeOrder.push(id);
        }
        return id;
      }
      return s.match(/^\w+$/) ? s : null;
    }
    
    // Edge with label: A -->|label| C[label] or A -->|label| C
    var edgeLabelMatch = line.match(/^(\w+)\s*(-->|---|-\.-|==>)\s*\|([^|]+)\|\s*(.+)$/);
    if(edgeLabelMatch){
      var src=edgeLabelMatch[1],label=edgeLabelMatch[3].trim();
      var tgt=parseNodeId(edgeLabelMatch[4]);
      if(tgt){ensureNode(src);ensureNode(tgt);edges.push({from:src,to:tgt,label:label});if(!children[src])children[src]=[];children[src].push(tgt);continue}
    }
    // Edge without label: A --> C[label] or A --> C
    var em=line.match(/^(\w+)\s*(-->|---|-\.-|==>|\.->|-->o|-->x)\s*(.+)$/);
    if(em){
      var src=em[1],tgt=parseNodeId(em[3]);
      if(tgt){ensureNode(src);ensureNode(tgt);edges.push({from:src,to:tgt,label:''});if(!children[src])children[src]=[];children[src].push(tgt);continue}
    }
    // Node definition: A[label] or A{label} etc.
    var nm=line.match(/^(\w+)\s*(\{[^}]*\}|\[[^\]]*\]|\([^\)]*\)|\[\[[^\]]*\]\]|\(\([^\)]*\)\))\s*$/);
    if(nm){var id=nm[1],shape=nm[2];var n=getNode(id);if(shape.startsWith('{')){n.shape='diamond';n.label=shape.slice(1,-1)}else if(shape.startsWith('[[')){n.shape='subroutine';n.label=shape.slice(2,-2)}else if(shape.startsWith('((')){n.shape='circle';n.label=shape.slice(2,-2)}else if(shape.startsWith('[')){n.shape='rect';n.label=shape.slice(1,-1)}else if(shape.startsWith('(')){n.shape='round';n.label=shape.slice(1,-1)}nodeOrder.push(id);continue}
    if(line.startsWith('end'))continue;
  }
  if(!nodeOrder.length)return null;

  // Layout
  var depths={};
  function getDepth(id,d){ if(depths[id]!==undefined)return depths[id]; depths[id]=d;var mx=d;(children[id]||[]).forEach(function(c){mx=Math.max(mx,getDepth(c,d+1))});return mx }
  nodeOrder.forEach(function(id){getDepth(id,0)});
  var maxD=0;for(var id in depths)if(depths[id]>maxD)maxD=depths[id];

  var layers=[];for(i=0;i<=maxD;i++)layers.push([]);
  nodeOrder.forEach(function(id){layers[depths[id]].push(id)});

  var nodeW=160,nodeH=50,gapX=40,gapY=60;
  var sW=(maxD+1)*(nodeW+gapX)+40;
  var maxLayerLen=0;layers.forEach(function(l){if(l.length>maxLayerLen)maxLayerLen=l.length});
  var sH=maxLayerLen*(nodeH+gapY)+80;

  var positions={};
  layers.forEach(function(layer,d){
    var x=20+d*(nodeW+gapX);
    var startY=(sH-layer.length*(nodeH+gapY))/2;
    layer.forEach(function(id,y){
      positions[id]={x:x, y:startY+y*(nodeH+gapY), w:nodeW, h:nodeH};
    });
  });

  // Render SVG
  var tc='var(--on-surface)', lc='var(--outline)', ac='var(--primary)';
  var s='<svg viewBox="0 0 '+sW+' '+sH+'" style="max-width:100%;height:auto;font-family:inherit">';
  // Draw edges
  edges.forEach(function(e){
    var from=positions[e.from], to=positions[e.to];
    if(!from||!to)return;
    var x1=from.x+from.w, y1=from.y+from.h/2;
    var x2=to.x, y2=to.y+to.h/2;
    var mx=(x1+x2)/2;
    s+='<path d="M'+x1+','+y1+' C'+mx+','+y1+' '+mx+','+y2+' '+x2+','+y2+'" fill="none" stroke="'+lc+'" stroke-width="1.5"/>';
    if(e.label)s+='<text x="'+mx+'" y="'+(Math.min(y1,y2)-8)+'" text-anchor="middle" font-size="12" fill="'+tc+'">'+H.escHtml(e.label)+'</text>';
  });
  // Draw nodes
  nodeOrder.forEach(function(id){
    var n=nodes[id], p=positions[id];
    if(!p)return;
    var _dark=document.documentElement.getAttribute('data-theme')==='dark';
    var fill=_dark?'#2D3138':'#D4DDE3', stroke=_dark?'#3D4248':'#A0B0BE';
    if(n.shape==='diamond'){
      s+='<polygon points="'+(p.x+p.w/2)+','+p.y+' '+(p.x+p.w)+','+(p.y+p.h/2)+' '+(p.x+p.w/2)+','+(p.y+p.h)+' '+p.x+','+(p.y+p.h/2)+'" fill="'+fill+'" stroke="'+stroke+'"/>';
    }else if(n.shape==='circle'){
      s+='<circle cx="'+(p.x+p.w/2)+'" cy="'+(p.y+p.h/2)+'" r="'+(p.h/2)+'" fill="'+fill+'" stroke="'+stroke+'"/>';
    }else{
      var rx=n.shape==='round'?25:4;
      s+='<rect x="'+p.x+'" y="'+p.y+'" width="'+p.w+'" height="'+p.h+'" rx="'+rx+'" fill="'+fill+'" stroke="'+stroke+'"/>';
    }
    s+='<text x="'+(p.x+p.w/2)+'" y="'+(p.y+p.h/2+5)+'" text-anchor="middle" font-size="14" font-weight="500" fill="'+tc+'">'+H.escHtml(n.label)+'</text>';
  });
  s+='</svg>';
  return s;
};

// ── Sequence diagram rendering ───────────────────────────────────────────
H.renderSequenceDiagram = function(lines){
  lines.shift();var participants=[],messages=[];
  lines.forEach(function(rawLine){
    var line=rawLine.trim(); if(!line||line.startsWith('%%'))return;
    var pm=line.match(/^participant\s+(\S+)(?:\s+as\s+(.+))?$/);
    if(pm){participants.push({id:pm[1],label:pm[2]||pm[1]});return}
    var mm=line.match(/^(\S+)\s*(--?>>?|--?>>?)\s*(\S+)\s*:\s*(.+)$/);
    if(mm)messages.push({from:mm[1],to:mm[3],label:mm[4].trim(),style:mm[2].indexOf('--')>=0?'dashed':'solid'});
  });
  if(!participants.length&&!messages.length)return null;
  var pMap={};participants.forEach(function(p){pMap[p.id]=p});
  messages.forEach(function(m){if(!pMap[m.from])pMap[m.from]={id:m.from,label:m.from};if(!pMap[m.to])pMap[m.to]={id:m.to,label:m.to}});
  var pList=[];var seen={};messages.forEach(function(m){if(!seen[m.from]){pList.push(pMap[m.from]);seen[m.from]=1}if(!seen[m.to]){pList.push(pMap[m.to]);seen[m.to]=1}});
  if(!pList.length)return null;
  var colW=200,colGap=80,rowH=60,padX=50,padY=40;
  var sW=pList.length*colW+(pList.length-1)*colGap+padX*2;
  var sH=padY*2+70+messages.length*rowH;
  var _dark=document.documentElement.getAttribute('data-theme')==='dark';var tc=_dark?'#E4E7EB':'#1C1C1E',ac=_dark?'#8A919C':'#75787C',lc=_dark?'#5A7391':'#3D5A6E';
  var bg=_dark?'#2D3138':'#D4DDE3';
  var s='<svg class="mermaid-zoom" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+sW+' '+sH+'" style="font-family:Noto Sans SC,PingFang SC,sans-serif;max-width:'+sW+'px;width:100%;height:auto">';
  s+='<defs><marker id="sa" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto"><path d="M0,0L10,3L0,6" fill="'+ac+'"/></marker></defs>';
  pList.forEach(function(p,i){var x=padX+i*(colW+colGap)+colW/2;s+='<rect x="'+(x-60)+'" y="'+padY+'" width="120" height="36" rx="8" fill="'+bg+'" stroke="'+lc+'" stroke-width="1.5"/><text x="'+x+'" y="'+(padY+22)+'" text-anchor="middle" font-size="14" font-weight="600" fill="'+tc+'">'+H.escHtml(p.label)+'</text>';s+='<line x1="'+x+'" y1="'+(padY+36)+'" x2="'+x+'" y2="'+(sH-padY)+'" stroke="'+ac+'" stroke-width="1" stroke-dasharray="4 3"/>'});
  var pIdx={};pList.forEach(function(p,i){pIdx[p.id]=i});
  messages.forEach(function(m,i){
    var yi=padY+60+i*rowH;
    var fromX=padX+pIdx[m.from]*(colW+colGap)+colW/2;
    var toX=padX+pIdx[m.to]*(colW+colGap)+colW/2;
    var dash=m.style==='dashed'?' stroke-dasharray="6 4"':'';
    s+='<line x1="'+fromX+'" y1="'+yi+'" x2="'+toX+'" y2="'+yi+'" stroke="'+lc+'" stroke-width="1.5"'+dash+' marker-end="url(#sa)"/>';
    var lx=(fromX+toX)/2;
    s+='<text x="'+lx+'" y="'+(yi-8)+'" text-anchor="middle" font-size="13" fill="'+tc+'">'+H.escHtml(m.label)+'</text>';
  });
  s+='</svg>';return s;
};

// ── Pie chart rendering ──────────────────────────────────────────────────
H.renderPieChart = function(lines){
  var title='';var slices=[];var inPie=false;
  lines.forEach(function(rawLine){
    var line=rawLine.trim(); if(!line||line.startsWith('%%'))return;
    if(line.match(/^pie\s*(?:title\s+(.*))?$/i)){title=RegExp.$1||'';inPie=true;return}
    if(inPie){var sm=line.match(/^"([^"]+)"\s*:\s*(\d+)/);if(sm)slices.push({label:sm[1],value:parseInt(sm[2])})}
  });
  if(!slices.length)return null;
  var total=0;slices.forEach(function(s){total+=s.value});if(!total)return null;
  var colors=['#3D5A6E','#4A7B6A','#8E6B9E','#B07D56','#5C7A3D','#6B5B8A','#8B6B4A','#4A6B8A','#7A5B6B','#5B7A6A'];
  var cx=250,cy=200,r=130;
  var sW=500,legendGap=60,legendH=slices.length*26;
  var titleH=title?40:0;
  var sH=titleH+cy+r+legendGap+legendH+30;
  var _dark=document.documentElement.getAttribute('data-theme')==='dark';var tc=_dark?'#E4E7EB':'#1C1C1E',ac=_dark?'#8A919C':'#8E9196',lb=_dark?'#E4E7EB':'#1C1C1E';
  var bg=_dark?'#1E2429':'#FFFFFF';
  var s='<svg class="pie-chart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+sW+' '+sH+'" style="font-family:Noto Sans SC,PingFang SC,sans-serif;max-width:'+sW+'px;width:100%;height:auto">';
  s+='<rect class="pie-bg" width="'+sW+'" height="'+sH+'" fill="transparent"/>';
  if(title)s+='<text x="'+(sW/2)+'" y="'+(titleH-8)+'" text-anchor="middle" font-size="16" font-weight="600" fill="'+tc+'">'+H.escHtml(title)+'</text>';
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
    sliceData.push({midAngle:midAngle,label:sl.label,pct:pct,col:col,i:i});
    s+='<path class="pie-slice" data-idx="'+i+'" d="M'+cx+','+pieCy+' L'+x1+','+y1+' A'+r+','+r+' 0 '+large+',1 '+x2+','+y2+' Z" fill="'+col+'" stroke="'+bg+'" stroke-width="2" style="transform-origin:'+cx+'px '+pieCy+'px;transition:transform 220ms ease;cursor:pointer"/>';
    var tx=cx+r*0.55*Math.cos(midAngle);var ty=pieCy+r*0.55*Math.sin(midAngle);
    if(angle>0.3)s+='<text x="'+tx+'" y="'+(ty+4)+'" text-anchor="middle" font-size="12" font-weight="600" fill="#fff" pointer-events="none">'+pct+'%</text>';
    startAngle=endAngle;
  });
  sliceData.forEach(function(sd){
    var lx1=cx+r*0.85*Math.cos(sd.midAngle);
    var ly1=pieCy+r*0.85*Math.sin(sd.midAngle);
    // Adjust label radius to avoid overlap with legend
    var labelR = r * 1.3;
    // If label would be in the bottom area near legend, push it up
    var rawLy2 = pieCy + labelR * Math.sin(sd.midAngle);
    var legendTop = titleH + cy + r + legendGap - 10;
    if (rawLy2 > legendTop) {
      labelR = r * 1.15;
    }
    var lx2=cx+labelR*Math.cos(sd.midAngle);
    var ly2=pieCy+labelR*Math.sin(sd.midAngle);
    var right=Math.cos(sd.midAngle)>=0;
    var tx=lx2+(right?10:-10);
    var anchor=right?'start':'end';
    var label=H.escHtml(sd.label)+' ('+sd.pct+'%)';
    var available=right?sW-tx-10:tx-10;
    var fontSize=13;var charW=fontSize*0.55;var maxChars=Math.floor(available/charW);
    if(maxChars<6)maxChars=6;
    s+='<g class="pie-label" style="opacity:0;transition:opacity 200ms;pointer-events:none">';
    s+='<line x1="'+lx1+'" y1="'+ly1+'" x2="'+lx2+'" y2="'+ly2+'" stroke="'+ac+'" stroke-width="1.2"/>';
    s+='<circle cx="'+lx1+'" cy="'+ly1+'" r="2.5" fill="'+ac+'"/>';
    if(label.length>maxChars){
      var lns=[];for(var k=0;k<label.length;k+=maxChars)lns.push(label.slice(k,k+maxChars));
      s+='<text x="'+tx+'" y="'+(ly2+4)+'" text-anchor="'+anchor+'" font-size="'+fontSize+'" font-weight="500" fill="'+lb+'">';
      lns.forEach(function(ln,li){s+='<tspan x="'+tx+'" dy="'+(li===0?0:16)+'">'+ln+'</tspan>'});
      s+='</text>';
    }else{
      s+='<text x="'+tx+'" y="'+(ly2+4)+'" text-anchor="'+anchor+'" font-size="'+fontSize+'" font-weight="500" fill="'+lb+'">'+label+'</text>';
    }
    s+='</g>';
  });
  var ly=titleH+cy+r+legendGap;
  var legendLabels=slices.map(function(sl){return H.escHtml(sl.label)});
  var totalLegendW=0;legendLabels.forEach(function(l){totalLegendW+=l.length*13+36});
  var lx=cx-totalLegendW/2;
  slices.forEach(function(sl,i){
    var col=colors[i%colors.length];
    var lbl=legendLabels[i];
    if(lx+lbl.length*13+24>sW-20){lx=cx-totalLegendW/2;ly+=26}
    s+='<circle cx="'+lx+'" cy="'+(ly+6)+'" r="5" fill="'+col+'"/>';
    s+='<text x="'+(lx+12)+'" y="'+(ly+10)+'" font-size="13" fill="'+tc+'">'+lbl+'</text>';
    lx+=lbl.length*13+36;
  });
  s+='</svg>';return s;
};

H.initPieChart = function(svg){
  var labels=svg.querySelectorAll('.pie-label');
  var slices=svg.querySelectorAll('.pie-slice');
  var bg=svg.querySelector('.pie-bg');
  function clearAll(){for(var j=0;j<labels.length;j++){labels[j].style.opacity='0';if(slices[j])slices[j].style.transform=''}}
  slices.forEach(function(slice){
    var idx=parseInt(slice.getAttribute('data-idx'));
    slice.addEventListener('mouseenter',function(){
      clearAll();
      labels[idx].style.opacity='1';
      slice.style.transform='scale(1.06)';
    });
    slice.addEventListener('click',function(e){e.stopPropagation()});
  });
  if(bg)bg.addEventListener('click',clearAll);
  svg.addEventListener('mouseleave',clearAll);
};

})();
