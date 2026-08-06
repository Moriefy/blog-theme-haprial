(function(){
'use strict';
var API='https://comments.pluslogic.eu.org';
var token='';
var currentPage='';
var articles=[],friends=[],trashList=[];
var cmtData={comments:[],total:0,pages:[]};
var editingId=null;
var $=function(id){return document.getElementById(id)};
var esc=function(s){var d=document.createElement('div');d.textContent=s||'';return d.innerHTML};

// ── API ──
function api(method,path,body){
  var opts={method:method,headers:{}};
  if(token)opts.headers['Authorization']='Bearer '+token;
  if(body){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(body)}
  return fetch(API+path,opts).then(function(r){
    if(r.status===401){logout();throw new Error('登录已过期')}
    return r.json()
  })
}

// ── Toast ──
function toast(msg){var t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove('show')},3000)}

// ── Dialog ──
function showDialog(html){$('dialog').innerHTML=html;$('dialogOverlay').classList.add('open')}
function closeDialog(){$('dialogOverlay').classList.remove('open')}
window.closeDialog=closeDialog;

// ── 时间 ──
function timeAgo(ds){var s=Math.floor((Date.now()-new Date(ds+'Z').getTime())/1000);if(s<60)return'刚刚';if(s<3600)return(s/60|0)+'分钟前';if(s<86400)return(s/3600|0)+'小时前';if(s<2592000)return(s/86400|0)+'天前';return new Date(ds+'Z').toLocaleDateString('zh-CN')}

// ════════════════════════════════════════
//  认证
// ════════════════════════════════════════
function checkAuth(){
  try{token=localStorage.getItem('admin_token')||''}catch(e){}
  if(!token){showLogin();return}
  api('GET','/api/admin/verify').then(function(d){if(d.ok)showApp();else showLogin()}).catch(showLogin)
}
function showLogin(){
  $('loginPage').style.display='flex';
  $('app').style.display='none';
  // 检查是否已设置密码
  api('GET','/api/admin/setup/status').then(function(d){
    if(!d.passwordSet){
      $('loginTitle').textContent='🔑 首次设置';
      $('loginDesc').textContent='这是你第一次使用，请设置管理密码';
      $('loginBtn').textContent='设置密码';
    }else{
      $('loginTitle').textContent='🔐 管理后台';
      $('loginDesc').textContent='输入密码登录 Haprial 博客管理系统';
      $('loginBtn').textContent='登录';
    }
  }).catch(function(){});
  $('loginPassword').focus()
}
function showApp(){$('loginPage').style.display='none';$('app').style.display='flex';route()}
function logout(){token='';try{localStorage.removeItem('admin_token')}catch(e){};showLogin()}

$('loginForm').addEventListener('submit',function(e){
  e.preventDefault();
  var pw=$('loginPassword').value;if(!pw)return;
  api('POST','/api/admin/auth',{password:pw}).then(function(d){
    if(d.ok){token=d.token;try{localStorage.setItem('admin_token',token)}catch(e){};showApp()}
    else{$('loginError').textContent=d.error||'登录失败';$('loginError').style.display='block'}
  }).catch(function(){$('loginError').textContent='网络错误';$('loginError').style.display='block'})
});
$('logoutBtn').addEventListener('click',logout);

// ════════════════════════════════════════
//  路由 (Hash-based)
// ════════════════════════════════════════
var pageTitles={dashboard:'仪表盘',articles:'文章管理',editor:'写文章',comments:'评论管理',friends:'友链管理',trash:'回收站',settings:'设置'};
var routes={
  '/':function(){renderDashboard()},
  '/articles':function(){renderArticles()},
  '/editor':function(){renderEditor()},
  '/comments':function(){renderComments()},
  '/friends':function(){renderFriends()},
  '/images':function(){renderImages()},
  '/trash':function(){renderTrash()},
  '/settings':function(){renderSettings()}
};
function parseHash(){var h=(location.hash||'').replace(/^#/,'')||'/';return h}
function route(){
  var path=parseHash();
  var page='dashboard';
  if(path==='/')page='dashboard';
  else if(path==='/articles')page='articles';
  else if(path==='/editor'){page='editor';editingId=null}
  else if(path.match(/^\/editor\/(\d+)$/)){page='editor';editingId=parseInt(path.match(/^\/editor\/(\d+)$/)[1])}
  else if(path==='/comments')page='comments';
  else if(path==='/friends')page='friends';
  else if(path==='/images'||path.match(/^\/images\//)){page='images'};
  else if(path==='/trash')page='trash';
  else if(path==='/settings')page='settings';
  else page='dashboard';
  currentPage=page;
  // 更新导航高亮
  document.querySelectorAll('.nav-item[data-page]').forEach(function(b){b.classList.toggle('active',b.dataset.page===page)});
  document.querySelectorAll('.mobile-tab[data-page]').forEach(function(b){b.classList.toggle('active',b.dataset.page===page)});
  $('pageTitle').textContent=pageTitles[page]||page;
  $('topbarActions').innerHTML='';
  // 渲染页面
  var fn=routes[path]||routes['/'];
  if(path.match(/^\/editor\/\d+$/))fn=routes['/editor'];
  if(path.match(/^\/images\//))fn=routes['/images'];
  fn()
}
window.addEventListener('hashchange',route);

// ════════════════════════════════════════
//  仪表盘
// ════════════════════════════════════════
function renderDashboard(){
  var c=$('content');
  c.innerHTML='<div class="stats-grid"><div class="stat-card"><div class="stat-num">…</div><div class="stat-label">加载中</div></div></div>';
  api('GET','/api/admin/stats').then(function(d){
    c.innerHTML='<div class="stats-grid">'
      +sc(d.published,'已发布')+sc(d.drafts,'草稿')+sc(d.comments,'评论')
      +sc(d.friends,'友链')+sc(d.trash,'回收站')+'</div>'
      +'<div class="card"><div class="card-title">快捷操作</div>'
      +'<div style="display:flex;gap:12px;flex-wrap:wrap">'
      +'<button class="md3-btn md3-btn-filled" onclick="location.hash=\'#/editor\'">写文章</button>'
      +'<button class="md3-btn md3-btn-outlined" onclick="location.hash=\'#/articles\'">管理文章</button>'
      +'<button class="md3-btn md3-btn-outlined" onclick="location.hash=\'#/comments\'">管理评论</button>'
      +'<button class="md3-btn md3-btn-outlined" onclick="location.hash=\'#/friends\'">管理友链</button>'
      +'</div></div>'
  })
}
function sc(n,l){return '<div class="stat-card"><div class="stat-num">'+n+'</div><div class="stat-label">'+l+'</div></div>'}

// ════════════════════════════════════════
//  文章管理
// ════════════════════════════════════════
var artPage=0,artPerPage=10,artFilter='all',artYear='',artCat='',artTag='',artSearch='';
window._artNav=function(p){artPage=p;renderArtList()};
window._artPrev=function(){artPage--;renderArtList()};
window._artNext=function(){artPage++;renderArtList()};
var artSearchTimer=null;
function renderArticles(){
  var c=$('content');
  c.innerHTML='<div class="filter-bar">'
    +'<input class="md3-input" id="artSearch" placeholder="搜索…" style="max-width:120px;min-width:80px">'
    +'<select class="md3-input" id="artStatus"><option value="all">状态</option><option value="published">已发布</option><option value="draft">草稿</option></select>'
    +'<select class="md3-input" id="artYearFilter"><option value="">年份</option></select>'
    +'<select class="md3-input" id="artCatFilter"><option value="">分类</option></select>'
    +'<select class="md3-input" id="artTagFilter"><option value="">标签</option></select>'
    +'</div>'
    +'<div class="table-wrap"><table><thead><tr><th>标题</th><th>日期</th><th>分类</th><th>标签</th><th>状态</th><th>操作</th></tr></thead><tbody id="artBody"><tr><td colspan="6" style="text-align:center;padding:40px">加载中…</td></tr></tbody></table></div>'
    +'<div id="artPagination" style="display:flex;justify-content:center;gap:4px;padding:16px 0"></div>';
  $('artSearch').addEventListener('input',function(){clearTimeout(artSearchTimer);artSearchTimer=setTimeout(function(){artSearch=$('artSearch').value.trim().toLowerCase();artPage=0;renderArtList()},300)});
  $('artStatus').addEventListener('change',function(){artFilter=this.value;artPage=0;renderArtList()});
  $('artYearFilter').addEventListener('change',function(){artYear=this.value;artPage=0;renderArtList()});
  $('artCatFilter').addEventListener('change',function(){artCat=this.value;artPage=0;renderArtList()});
  $('artTagFilter').addEventListener('change',function(){artTag=this.value;artPage=0;renderArtList()});
  loadAllArticles();
  $('topbarActions').innerHTML='<button class="md3-btn md3-btn-filled" onclick="location.hash=\'#/editor\'">+ 新文章</button>'
}
function loadAllArticles(){
  api('GET','/api/admin/articles?status=all').then(function(d){
    articles=d.articles||[];
    // 填充筛选下拉
    var years={},cats={},tags={};
    articles.forEach(function(a){
      var y=(a.date||'').slice(0,4);if(y)years[y]=1;
      if(a.category)cats[a.category]=1;
      try{parseTags(a.tags).forEach(function(t){tags[t]=1})}catch(e){}
    });
    var ySel=$('artYearFilter');if(ySel)ySel.innerHTML='<option value="">全部年份</option>'+Object.keys(years).sort().reverse().map(function(y){return '<option value="'+y+'">'+y+'</option>'}).join('');
    var cSel=$('artCatFilter');if(cSel)cSel.innerHTML='<option value="">全部分类</option>'+Object.keys(cats).sort().map(function(c){return '<option value="'+c+'">'+c+'</option>'}).join('');
    var tSel=$('artTagFilter');if(tSel)tSel.innerHTML='<option value="">全部标签</option>'+Object.keys(tags).sort().map(function(t){return '<option value="'+t+'">'+t+'</option>'}).join('');
    renderArtList()
  })
}
function getFilteredArticles(){
  return articles.filter(function(a){
    if(artSearch&&(a.title||'').toLowerCase().indexOf(artSearch)===-1)return false;
    if(artFilter!=='all'&&a.status!==artFilter)return false;
    if(artYear&&(a.date||'').slice(0,4)!==artYear)return false;
    if(artCat&&a.category!==artCat)return false;
    if(artTag){var tags=[];try{tags=parseTags(a.tags)}catch(e){};if(tags.indexOf(artTag)===-1)return false}
    return true
  })
}
function renderArtList(){
  var filtered=getFilteredArticles();
  var total=Math.ceil(filtered.length/artPerPage);if(total<1)total=1;
  if(artPage>=total)artPage=total-1;if(artPage<0)artPage=0;
  var start=artPage*artPerPage;
  var pageItems=filtered.slice(start,start+artPerPage);
  var tb=$('artBody');if(!tb)return;
  if(!pageItems.length){tb.innerHTML='<tr><td colspan="6" class="empty">暂无文章</td></tr>'}
  else{tb.innerHTML=pageItems.map(function(a){
    var tags=[];try{tags=parseTags(a.tags)}catch(e){}
    return '<tr><td><strong>'+esc(a.title)+'</strong>'+(a.pinned?' 📌':'')+'</td><td>'+esc(a.date)+'</td><td>'+esc(a.category)+'</td><td>'+tags.map(function(t){return '<span class="tag-chip">'+esc(t)+'</span>'}).join('')+'</td><td><span class="status-badge status-'+a.status+'">'+(a.status==='published'?'已发布':'草稿')+'</span></td><td class="action-group">'
    +'<button class="md3-btn md3-btn-text" onclick="location.hash=\'#/editor/'+a.id+'\'">编辑</button>'
    +'<button class="md3-btn md3-btn-text" onclick="window._togglePub('+a.id+')">'+(a.status==='published'?'下架':'发布')+'</button>'
    +'<button class="md3-btn md3-btn-text" style="color:var(--error)" onclick="window._delArt('+a.id+')">删除</button>'
    +'</td></tr>'
  }).join('')}
  // 分页
  var pg=$('artPagination');if(!pg)return;
  if(total<=1){pg.innerHTML='';return}
  var h='<button class="md3-btn md3-btn-text"'+(artPage===0?' disabled':'')+' onclick="_artPrev()">上一页</button>';
  for(var i=0;i<total;i++)h+='<button class="md3-btn md3-btn-text'+(i===artPage?' md3-btn-filled':'')+'" onclick="_artNav('+i+')">'+(i+1)+'</button>';
  h+='<button class="md3-btn md3-btn-text"'+(artPage>=total-1?' disabled':'')+' onclick="_artNext()">下一页</button>';
  pg.innerHTML=h
}
function loadArticles(status){
  api('GET','/api/admin/articles'+(status&&status!=='all'?'?status='+status:'')).then(function(d){
    articles=d.articles||[];
    var tb=$('artBody');if(!tb)return;
    if(!articles.length){tb.innerHTML='<tr><td colspan="6" class="empty">暂无文章</td></tr>';return}
    tb.innerHTML=articles.map(function(a){
      var tags=[];try{tags=parseTags(a.tags)}catch(e){}
      return '<tr><td><strong>'+esc(a.title)+'</strong>'+(a.pinned?' 📌':'')+'</td><td>'+esc(a.date)+'</td><td>'+esc(a.category)+'</td><td>'+tags.map(function(t){return '<span class="tag-chip">'+esc(t)+'</span>'}).join('')+'</td><td><span class="status-badge status-'+a.status+'">'+(a.status==='published'?'已发布':'草稿')+'</span></td><td class="action-group">'
      +'<button class="md3-btn md3-btn-text" onclick="location.hash=\'#/editor/'+a.id+'\'">编辑</button>'
      +'<button class="md3-btn md3-btn-text" onclick="window._togglePub('+a.id+')">'+(a.status==='published'?'下架':'发布')+'</button>'
      +'<button class="md3-btn md3-btn-text" style="color:var(--error)" onclick="window._delArt('+a.id+')">删除</button>'
      +'</td></tr>'
    }).join('')
  })
}
window._togglePub=function(id){
  api('POST','/api/admin/articles/'+id+'/publish').then(function(d){
    if(d.ok){toast(d.status==='published'?'已发布':'已下架');loadAllArticles()}
  })
};
window._delArt=function(id){
  showDialog('<h3>确认删除</h3><p>文章将移入回收站，GitHub 文件将被删除</p><div class="dialog-actions"><button class="md3-btn md3-btn-text" onclick="closeDialog()">取消</button><button class="md3-btn md3-btn-danger" onclick="window._confirmDelArt('+id+')">删除</button></div>')
};
window._confirmDelArt=function(id){
  closeDialog();
  api('DELETE','/api/admin/articles/'+id).then(function(d){if(d.ok){toast('已移入回收站');loadAllArticles()}})
};

// ════════════════════════════════════════
//  编辑器
// ════════════════════════════════════════
function renderEditor(){
  var c=$('content');
  c.innerHTML='<div class="meta-grid">'
    +'<div class="meta-field full"><label>标题</label><input class="md3-input" id="edTitle" placeholder="文章标题"></div>'
    +'<div class="meta-field"><label>日期</label><input class="md3-input" id="edDate" type="date"></div>'
    +'<div class="meta-field"><label>备注（文件名后缀）</label><input class="md3-input" id="edSlug" placeholder="webassembly"></div>'
    +'<div class="meta-field"><label>分类</label><input class="md3-input" id="edCat" placeholder="tech / design / think / culture"></div>'
    +'<div class="meta-field"><label>标签（逗号分隔）</label><input class="md3-input" id="edTags" placeholder="标签1, 标签2, 标签3"></div>'
    +'<div class="meta-field full"><label>摘要</label><textarea class="md3-input" id="edExcerpt" rows="2" placeholder="文章摘要"></textarea></div>'
    +'</div>'
    +'<div class="toolbar">'
    +'<button onclick="window._insMd(\'**\',\'**\')"><b>B</b></button>'
    +'<button onclick="window._insMd(\'*\',\'*\')"><i>I</i></button>'
    +'<button onclick="window._insMd(\'~~\',\'~~\')"><s>S</s></button>'
    +'<button onclick="window._insMd(\'`\',\'`\')">Code</button>'
    +'<button onclick="window._insMd(\'\\n```\\n\',\'\\n```\\n\')">Block</button>'
    +'<button onclick="window._insMd(\'## \',\'\')">H2</button>'
    +'<button onclick="window._insMd(\'### \',\'\')">H3</button>'
    +'<button onclick="window._insMd(\'[text](\',\')\')">Link</button>'
    +'<button onclick="window._insMd(\'![alt](\',\')\')">Img</button>'
    +'<button onclick="window._insMd(\'> \',\'\')">Quote</button>'
    +'<button onclick="window._insMd(\'- \',\'\')">List</button>'
    +'<button onclick="window._insMd(\'---\\n\',\'\')">HR</button>'
    +'<input type="file" accept="image/*" multiple style="display:none" id="edImgUpload">'
    +'<button type="button" onclick="document.getElementById(\'edImgUpload\').click()">Img+</button>'
    +'<span style="flex:1"></span>'
    +'<button class="md3-btn md3-btn-text" onclick="window._previewToggle()" id="previewToggleBtn" style="display:none">预览</button>'
    +'</div>'
    +'<div class="editor-wrap">'
    +'<div class="editor-pane"><textarea id="edContent" placeholder="Markdown 内容…"></textarea></div>'
    +'<div class="preview-pane" id="edPreview"></div>'
    +'</div>';
  $('topbarActions').innerHTML='<button class="md3-btn md3-btn-outlined" onclick="window._saveDraft()">存草稿</button><button class="md3-btn md3-btn-filled" onclick="window._saveArticle()">发布</button>';
  var ed=$('edContent');
  // 日期变化时自动填充备注前缀
  $('edDate').addEventListener('change',function(){
    if(editingId)return;
    var slug=$('edSlug');
    if(slug.dataset.manual)return;
    slug.value=this.value.replace(/-/g,'');
  });
  $('edSlug').addEventListener('input',function(){this.dataset.manual='1'});
  ed.addEventListener('input',function(){updatePreview()});
  // 滚动同步：编辑器 → 预览
  var scrollSyncTimer=null;
  ed.addEventListener('scroll',function(){
    clearTimeout(scrollSyncTimer);
    scrollSyncTimer=setTimeout(function(){
      var pct=ed.scrollTop/(ed.scrollHeight-ed.clientHeight||1);
      var pp=$('edPreview');
      pp.scrollTop=pct*(pp.scrollHeight-pp.clientHeight)
    },16)
  });
  ed.addEventListener('keydown',function(e){
    if(e.key==='Tab'){e.preventDefault();var s=this.selectionStart,end=this.selectionEnd;this.value=this.value.substring(0,s)+'  '+this.value.substring(end);this.selectionStart=this.selectionEnd=s+2;updatePreview()}
    if(e.ctrlKey||e.metaKey){
      if(e.key==='s'){e.preventDefault();window._saveArticle()}
      if(e.key==='b'){e.preventDefault();window._insMd('**','**')}
      if(e.key==='i'){e.preventDefault();window._insMd('*','*')}
    }
  });
  if(window.innerWidth<=768){$('previewToggleBtn').style.display=''}
  // 编辑器图片上传
  var edImgInput=$('edImgUpload');
  if(edImgInput){
    edImgInput.addEventListener('change',function(e){
      var files=e.target.files;if(!files||!files.length)return;
      var dateVal=$('edDate').value||new Date().toISOString().slice(0,10);
      var folder=dateVal.slice(0,4)+'/'+dateVal.slice(5,7);
      var done=0,total=files.length;
      toast('上传中… 0/'+total);
      Array.from(files).forEach(function(file){
        var reader=new FileReader();
        reader.onload=function(){
          var base64=reader.result.split(',')[1];
          api('POST','/api/admin/images/upload',{data:base64,name:file.name,folder:folder}).then(function(d){
            done++;
            if(d.ok){
              window._insMd('![',']('+d.url+')');
            }
            if(done===total)toast('上传完成');
            else toast('上传中… '+done+'/'+total);
          }).catch(function(){done++;toast('上传失败: '+file.name)})
        };
        reader.readAsDataURL(file)
      });
      e.target.value=''
    })
  }
  if(editingId){
    api('GET','/api/admin/articles/'+editingId).then(function(d){
      if(!d.article)return;
      var a=d.article;
      $('edTitle').value=a.title||'';
      $('edDate').value=a.date||'';
      $('edSlug').value=a.slug||'';
      $('edCat').value=a.category||'';
      var tags=[];try{tags=parseTags(a.tags)}catch(e){}
      $('edTags').value=tags.join(', ');
      $('edExcerpt').value=a.excerpt||'';
      ed.value=a.content||'';
      updatePreview()
    })
  }else{
    $('edDate').value=new Date().toISOString().slice(0,10);
    $('edSlug').value=new Date().toISOString().slice(0,10).replace(/-/g,'');
    // 从 localStorage 恢复未保存的草稿
    try{
      var saved=localStorage.getItem('haprial_draft_new');
      if(saved){
        var d=JSON.parse(saved);
        if(d.title)$('edTitle').value=d.title;
        if(d.date)$('edDate').value=d.date;
        if(d.slug)$('edSlug').value=d.slug;
        if(d.cat)$('edCat').value=d.cat;
        if(d.tags)$('edTags').value=d.tags;
        if(d.excerpt)$('edExcerpt').value=d.excerpt;
        if(d.content)ed.value=d.content;
      }
    }catch(e){}
    updatePreview()
  }
  // 自动保存
  clearInterval(window._autoSaveLocal);clearInterval(window._autoSaveD1);
  window._autoSaveLocal=setInterval(function(){
    try{
      var key=editingId?'haprial_draft_'+editingId:'haprial_draft_new';
      localStorage.setItem(key,JSON.stringify({
        title:$('edTitle').value,date:$('edDate').value,slug:$('edSlug').value,
        cat:$('edCat').value,tags:$('edTags').value,excerpt:$('edExcerpt').value,
        content:$('edContent').value
      }))
    }catch(e){}
  },5000);
  window._autoSaveD1=setInterval(function(){
    if(editingId)saveArticle('draft');
  },60000)
}
function updatePreview(){
  var raw=$('edContent').value;
  $('edPreview').innerHTML=mdToHtml(raw)
}
window._insMd=function(before,after){
  var ta=$('edContent');var s=ta.selectionStart,e=ta.selectionEnd;var sel=ta.value.substring(s,e);
  ta.value=ta.value.substring(0,s)+before+sel+after+ta.value.substring(e);
  ta.selectionStart=s+before.length;ta.selectionEnd=s+before.length+sel.length;
  ta.focus();updatePreview()
};
window._previewToggle=function(){
  var pp=$('edPreview');pp.classList.toggle('show')
};
window._saveDraft=function(){saveArticle('draft')};
window._saveArticle=function(){saveArticle('published')};
function parseTags(t){
  if(!t||t==='null'||t==='undefined')return[];
  if(Array.isArray(t))return t;
  if(typeof t==='string'){
    t=t.trim();
    if(!t||t==='[]')return[];
    if(t.charAt(0)==='['){try{return JSON.parse(t)}catch(e){}}
    return t.split(',').map(function(s){return s.trim()}).filter(Boolean)
  }
  return[]
}
function toSlug(str){
  // 中文转拼音风格的 slug：去掉特殊字符，空格转连字符，小写
  return str.toLowerCase()
    .replace(/[\u4e00-\u9fff]/g,function(c){return c}) // 保留中文
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,50);
}
function saveArticle(status){
  var title=$('edTitle').value.trim();
  var content=$('edContent').value;
  if(!title){toast('请输入标题');return}
  if(!content){toast('请输入内容');return}
  var tags=$('edTags').value.split(',').map(function(t){return t.trim()}).filter(Boolean);
  var body={title:title,date:$('edDate').value,slug:$('edSlug').value.trim(),tags:tags,category:$('edCat').value.trim(),excerpt:$('edExcerpt').value.trim(),content:content,status:status};
  var p=editingId?api('PUT','/api/admin/articles/'+editingId,body):api('POST','/api/admin/articles',body);
  p.then(function(d){
    if(d.ok){
      toast(editingId?'已更新':'已创建');
      if(!editingId&&d.id){
        // 新建文章后：清除新建草稿缓存，设置 editingId
        try{localStorage.removeItem('haprial_draft_new')}catch(e){}
        editingId=d.id;
        location.hash='#/editor/'+d.id;
        // 重新设置自动保存（使用新的 editingId）
        clearInterval(window._autoSaveLocal);clearInterval(window._autoSaveD1);
        window._autoSaveLocal=setInterval(function(){
          try{localStorage.setItem('haprial_draft_'+editingId,JSON.stringify({title:$('edTitle').value,date:$('edDate').value,slug:$('edSlug').value,cat:$('edCat').value,tags:$('edTags').value,excerpt:$('edExcerpt').value,content:$('edContent').value}))}catch(e){}
        },5000);
        window._autoSaveD1=setInterval(function(){if(editingId)saveArticle('draft')},60000)
      }else if(status==='published'){
        // 发布后：停止自动保存，清除草稿缓存
        clearInterval(window._autoSaveLocal);clearInterval(window._autoSaveD1);
        try{localStorage.removeItem('haprial_draft_'+editingId)}catch(e){}
        location.hash='#/articles'
      }
    }
    else toast(d.error||'保存失败')
  }).catch(function(){toast('网络错误')})
}

// ════════════════════════════════════════
//  评论管理（两栏式）
// ════════════════════════════════════════
var cmtSelectedPage='';
var cmtArticles={};// slug -> {title, id}
var cmtAllArticles=[];// 完整文章列表
var adminWebsite='https://pluslogic.eu.org';
try{var _w=localStorage.getItem('admin_website');if(_w)adminWebsite=_w}catch(e){}
function renderComments(){
  var c=$('content');
  c.innerHTML='<div class="cmt-layout">'
    +'<div class="cmt-sidebar" id="cmtSidebar"><div class="cmt-sidebar-header">文章列表</div><div id="cmtArticleList"><div class="empty">加载中…</div></div></div>'
    +'<div class="cmt-main" id="cmtMain"><div class="cmt-main-header" id="cmtMainHeader">选择一篇文章查看评论</div><div id="cmtList"><div class="empty">← 点击左侧文章</div></div></div>'
    +'</div>';
  $('topbarActions').innerHTML='<button class="md3-btn md3-btn-outlined" onclick="window._exportComments()">导出评论</button>';
  loadCommentArticles()
}
window._exportComments=function(){window.open(API+'/api/admin/comments/export?token='+token,'_blank')};
function findArtBySlug(slug){
  // 精确匹配
  for(var i=0;i<cmtAllArticles.length;i++){if(cmtAllArticles[i].slug===slug)return cmtAllArticles[i]}
  // 按日期前缀模糊匹配
  var datePrefix=slug.replace(/-.*$/,'');
  for(var i=0;i<cmtAllArticles.length;i++){if(cmtAllArticles[i].slug.indexOf(datePrefix)===0)return cmtAllArticles[i]}
  return null
}
function loadCommentArticles(){
  Promise.all([
    api('GET','/api/admin/articles?status=all'),
    api('GET','/api/admin/comments?limit=1')
  ]).then(function(results){
    cmtAllArticles=results[0].articles||[];
    var d=results[1];
    cmtData=d;
    // 建立 slug -> 文章映射
    cmtArticles={};
    cmtAllArticles.forEach(function(a){cmtArticles[a.slug]=a});
    var pages=d.pages||[];
    var el=$('cmtArticleList');if(!el)return;
    if(!pages.length){el.innerHTML='<div class="empty">暂无评论</div>';return}
    el.innerHTML=pages.map(function(p){
      var slug=p.replace(/^\/posts\//,'').replace(/\/$/,'');
      var art=findArtBySlug(slug);
      var title=art?art.title:'';
      var displayName=title?esc(title):esc(slug);
      return '<div class="cmt-art-item" data-page="'+esc(p)+'">'
        +'<div class="cmt-art-title">'+displayName+'</div>'
        +'<div class="cmt-art-slug">'+esc(p)+'</div>'
        +'</div>'
    }).join('');
    el.onclick=function(e){
      var item=e.target.closest('.cmt-art-item');
      if(!item)return;
      [].forEach.call(el.children,function(i){i.classList.remove('active')});
      item.classList.add('active');
      cmtSelectedPage=item.dataset.page;
      loadPageComments(cmtSelectedPage)
    };
    if(pages.length&&!cmtSelectedPage){
      el.children[0].classList.add('active');
      cmtSelectedPage=pages[0];
      loadPageComments(cmtSelectedPage)
    }
  })
}
function loadPageComments(pageSlug){
  var slug=pageSlug.replace(/^\/posts\//,'').replace(/\/$/,'');
  var art=findArtBySlug(slug);
  var title=art?art.title:slug;
  var artId=art?art.id:null;
  var headerHtml='<span>'+esc(title)+'</span>';
  if(artId)headerHtml+=' <a href="#/editor/'+artId+'" style="font-size:12px;font-weight:400;color:var(--primary);margin-left:8px">编辑文章</a>';
  headerHtml+=' <a href="https://pluslogic.eu.org/#/posts/'+slug+'" target="_blank" style="font-size:12px;font-weight:400;color:var(--primary);margin-left:8px">查看页面 ↗</a>';
  $('cmtMainHeader').innerHTML=headerHtml;
  $('cmtList').innerHTML='<div class="empty">加载中…</div>';
  api('GET','/api/admin/comments?limit=200&page_slug='+encodeURIComponent(pageSlug)).then(function(d){
    cmtData=d;
    renderCmtTree(d.comments,pageSlug)
  })
}
function renderCmtTree(list,pageSlug){
  var el=$('cmtList');if(!el)return;
  if(!list.length){el.innerHTML='<div class="empty">暂无评论</div>';return}
  var roots=[];
  var byId={};
  list.forEach(function(c){byId[c.id]=c;c._children=[]});
  list.forEach(function(c){
    if(c.parent_id&&byId[c.parent_id]){byId[c.parent_id]._children.push(c)}
    else{roots.push(c)}
  });
  function renderNode(c,depth){
    var indent=depth*24;
    var pinIcon='<svg viewBox="0 0 16 16" width="13" height="13" fill="'+(c.pinned?'currentColor':'none')+'" stroke="currentColor" stroke-width="1.5" style="vertical-align:-2px"><path d="M9.83 2.17a1.41 1.41 0 0 0-2 0L3.29 6.71a1 1 0 0 0-.29.71V8a1 1 0 0 0 1 1h1l-3 5h2l3-3v4l1-1 1 1v-4l3 3h2l-3-5h1a1 1 0 0 0 1-1v-.59a1 1 0 0 0-.29-.71z"/></svg>';
    var h='<div class="cmt-item" style="margin-left:'+indent+'px">'
      +'<div class="cmt-header"><span class="cmt-nick">'+esc(c.nickname)+'</span>'+(c.is_admin?'<span class="cmt-badge">艾德密</span>':'')+(c.pinned?'<span class="cmt-badge" style="background:var(--on-surface-variant)">置顶</span>':'')
      +'<span class="cmt-time">'+timeAgo(c.created_at)+'</span></div>'
      +'<div class="cmt-body">'+c.content_html+'</div>'
      +'<div class="cmt-actions">'
      +'<button class="md3-btn md3-btn-text" onclick="_doReply('+c.id+')">回复</button>'
      +'<button class="md3-btn md3-btn-text cmt-like-btn" data-id="'+c.id+'" onclick="_doLike('+c.id+')">'+(c.liked>0?'<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" stroke="none" style="vertical-align:-2px"><path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 018 4a3.5 3.5 0 015.5 3c0 3.5-5.5 7-5.5 7z"/></svg> '+c.liked:'<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" style="vertical-align:-2px"><path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 018 4a3.5 3.5 0 015.5 3c0 3.5-5.5 7-5.5 7z"/></svg>')+'</button>'
      +'<button class="md3-btn md3-btn-text" onclick="_doPin('+c.id+')" title="'+(c.pinned?'取消置顶':'置顶')+'">'+pinIcon+'</button>'
      +'<button class="md3-btn md3-btn-text" style="color:var(--error)" onclick="_doDel('+c.id+')">删除</button>'
      +'</div><div id="reply-'+c.id+'"></div></div>';
    c._children.forEach(function(child){h+=renderNode(child,depth+1)});
    return h
  }
  var html='';
  roots.forEach(function(c){html+=renderNode(c,0)});
  el.innerHTML=html
}
window._doReply=function(id){
  var el=document.getElementById('reply-'+id);if(!el)return;
  if(el.innerHTML){el.innerHTML='';return}
  el.innerHTML='<div class="reply-box"><textarea id="replyInput-'+id+'" placeholder="回复…"></textarea><div class="reply-actions"><button class="md3-btn md3-btn-text" onclick="_doCancelReply('+id+')">取消</button><button class="md3-btn md3-btn-filled" onclick="_doSendReply('+id+')">回复</button></div></div>';
  document.getElementById('replyInput-'+id).focus()
};
window._doCancelReply=function(id){var el=document.getElementById('reply-'+id);if(el)el.innerHTML=''};
window._doSendReply=function(id){
  var input=document.getElementById('replyInput-'+id);if(!input||!input.value.trim())return;
  if(!cmtSelectedPage){toast('请先选择一篇文章');return}
  var parent=null;
  if(cmtData&&cmtData.comments){parent=cmtData.comments.find(function(c){return c.id===id})}
  var depth=parent?parent.depth+1:0;
  api('POST','/api/admin/comments',{page:cmtSelectedPage,parent_id:id,depth:depth,nickname:'Moriefy',email:'3518972914@qq.com',website:adminWebsite,content:input.value.trim()}).then(function(d){
    if(d.ok){toast('已回复');loadPageComments(cmtSelectedPage)}
  })
};
window._doPin=function(id){
  api('POST','/api/admin/comments/'+id+'/pin').then(function(d){
    if(d.ok){toast(d.pinned?'已置顶':'已取消置顶');loadPageComments(cmtSelectedPage)}
  })
};
window._doLike=function(id){
  var heartFill='<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" stroke="none" style="vertical-align:-2px"><path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 018 4a3.5 3.5 0 015.5 3c0 3.5-5.5 7-5.5 7z"/></svg>';
  var heartLine='<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" style="vertical-align:-2px"><path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 018 4a3.5 3.5 0 015.5 3c0 3.5-5.5 7-5.5 7z"/></svg>';
  var btn=document.querySelector('.cmt-like-btn[data-id="'+id+'"]');
  if(btn&&!btn.dataset.liked){btn.innerHTML=heartFill+' …';btn.dataset.liked='1'}
  api('POST','/api/admin/comments/'+id+'/like').then(function(d){
    if(d.ok){
      if(btn){btn.innerHTML=heartFill+' '+d.liked;btn.dataset.liked='1'}
    }else{
      if(btn){btn.innerHTML=heartLine;delete btn.dataset.liked}
      toast(d.error||'点赞失败')
    }
  }).catch(function(){if(btn){btn.innerHTML=heartLine;delete btn.dataset.liked}})
};
window._doDel=function(id){showDialog('<h3>确认删除</h3><p>此评论将被删除</p><div class="dialog-actions"><button class="md3-btn md3-btn-text" onclick="closeDialog()">取消</button><button class="md3-btn md3-btn-danger" onclick="_doConfirmDel('+id+')">删除</button></div>')};
window._doConfirmDel=function(id){closeDialog();api('DELETE','/api/admin/comments/'+id).then(function(d){if(d.ok){toast('已删除');loadPageComments(cmtSelectedPage)}})};

// ════════════════════════════════════════
//  友链管理
// ════════════════════════════════════════
function renderFriends(){
  var c=$('content');
  c.innerHTML='<div id="friendList"><div class="empty">加载中…</div></div>';
  $('topbarActions').innerHTML='<button class="md3-btn md3-btn-filled" onclick="window._addFriend()">+ 添加友链</button>';
  loadFriends()
}
function loadFriends(){
  api('GET','/api/admin/friends').then(function(d){
    friends=d.friends||[];
    var el=$('friendList');if(!el)return;
    if(!friends.length){el.innerHTML='<div class="empty">暂无友链</div>';return}
    el.innerHTML=friends.map(function(f){
      return '<div class="friend-card">'
        +'<img class="friend-avatar" src="'+esc(f.avatar||'')+'" alt="'+esc(f.name)+'" onerror="this.style.display=\'none\'">'
        +'<div class="friend-info"><div class="friend-name">'+esc(f.name)+'</div><div class="friend-url">'+esc(f.url)+'</div><div class="friend-desc">'+esc(f.desc||'')+'</div></div>'
        +'<div class="action-group"><button class="md3-btn md3-btn-text" onclick="window._editFriend('+f.id+')">编辑</button><button class="md3-btn md3-btn-text" style="color:var(--error)" onclick="window._delFriend('+f.id+')">删除</button></div></div>'
    }).join('')
  })
}
function friendForm(f){
  return '<div class="meta-grid" style="margin:0">'
    +'<div class="meta-field full"><label>名称</label><input class="md3-input" id="frName" value="'+esc(f?f.name:'')+'"></div>'
    +'<div class="meta-field full"><label>链接</label><input class="md3-input" id="frUrl" value="'+esc(f?f.url:'')+'"></div>'
    +'<div class="meta-field full"><label>头像 URL</label><input class="md3-input" id="frAvatar" value="'+esc(f?f.avatar:'')+'"></div>'
    +'<div class="meta-field full"><label>描述</label><input class="md3-input" id="frDesc" value="'+esc(f?f.desc:'')+'"></div>'
    +'<div class="meta-field"><label>排序</label><input class="md3-input" id="frSort" type="number" value="'+(f?f.sort:0)+'"></div></div>'
}
window._addFriend=function(){showDialog('<h3>添加友链</h3>'+friendForm(null)+'<div class="dialog-actions"><button class="md3-btn md3-btn-text" onclick="closeDialog()">取消</button><button class="md3-btn md3-btn-filled" onclick="window._saveFriend()">添加</button></div>')};
window._editFriend=function(id){
  var f=friends.find(function(x){return x.id===id});if(!f)return;
  showDialog('<h3>编辑友链</h3>'+friendForm(f)+'<div class="dialog-actions"><button class="md3-btn md3-btn-text" onclick="closeDialog()">取消</button><button class="md3-btn md3-btn-filled" onclick="window._updateFriend('+id+')">保存</button></div>')
};
window._saveFriend=function(){
  var body={name:$('frName').value,url:$('frUrl').value,avatar:$('frAvatar').value,desc:$('frDesc').value,sort:parseInt($('frSort').value)||0};
  if(!body.name||!body.url){toast('名称和链接必填');return}
  api('POST','/api/admin/friends',body).then(function(d){if(d.ok){toast('已添加');closeDialog();loadFriends()}})
};
window._updateFriend=function(id){
  var body={name:$('frName').value,url:$('frUrl').value,avatar:$('frAvatar').value,desc:$('frDesc').value,sort:parseInt($('frSort').value)||0};
  api('PUT','/api/admin/friends/'+id,body).then(function(d){if(d.ok){toast('已更新');closeDialog();loadFriends()}})
};
window._delFriend=function(id){showDialog('<h3>确认删除</h3><div class="dialog-actions"><button class="md3-btn md3-btn-text" onclick="closeDialog()">取消</button><button class="md3-btn md3-btn-danger" onclick="window._confirmDelFriend('+id+')">删除</button></div>')};
window._confirmDelFriend=function(id){closeDialog();api('DELETE','/api/admin/friends/'+id).then(function(d){if(d.ok){toast('已删除');loadFriends()}})};

// ════════════════════════════════════════
//  回收站
// ════════════════════════════════════════
function renderTrash(){
  var c=$('content');
  c.innerHTML='<div id="trashList"><div class="empty">加载中…</div></div>';
  $('topbarActions').innerHTML='<button class="md3-btn md3-btn-text" style="color:var(--error)" onclick="window._emptyTrash()">清空回收站</button>';
  api('GET','/api/admin/trash').then(function(d){
    trashList=d.trash||[];
    var el=$('trashList');if(!el)return;
    if(!trashList.length){el.innerHTML='<div class="empty">回收站是空的</div>';return}
    el.innerHTML=trashList.map(function(t){
      return '<div class="friend-card"><div class="friend-info"><div class="friend-name">'+esc(t.title)+'</div><div class="friend-desc">类型: '+esc(t.type)+' | 删除于 '+esc(t.deleted_at)+'</div></div>'
        +'<div class="action-group"><button class="md3-btn md3-btn-text" onclick="window._restoreTrash('+t.id+')">恢复</button><button class="md3-btn md3-btn-text" style="color:var(--error)" onclick="window._delTrash('+t.id+')">彻底删除</button></div></div>'
    }).join('')
  })
}
window._restoreTrash=function(id){api('POST','/api/admin/trash/'+id+'/restore').then(function(d){if(d.ok){toast('已恢复');renderTrash()}})};
window._delTrash=function(id){api('DELETE','/api/admin/trash/'+id).then(function(d){if(d.ok){toast('已彻底删除');renderTrash()}})};
window._emptyTrash=function(){showDialog('<h3>清空回收站</h3><p>所有内容将被彻底删除，不可恢复</p><div class="dialog-actions"><button class="md3-btn md3-btn-text" onclick="closeDialog()">取消</button><button class="md3-btn md3-btn-danger" onclick="window._confirmEmptyTrash()">清空</button></div>')};
window._confirmEmptyTrash=function(){closeDialog();api('DELETE','/api/admin/trash').then(function(d){if(d.ok){toast('已清空');renderTrash()}})};

// ════════════════════════════════════════
//  图片管理
// ════════════════════════════════════════
var imgCurrentFolder='';
window.imgSelectMode=false;
window.imgSelected=new Set();
// 文件管理剪贴板
var imgClipboard=null; // {type:'copy'|'cut', path:'2026/08/img.jpg'}
function renderImages(){
  window.imgSelectMode=false;window.imgSelected.clear();
  // 从 hash 恢复文件夹路径
  var h=(location.hash||'').replace(/^#/,'');
  var m=h.match(/^\/images\/?(.*)/);
  if(m&&m[1])imgCurrentFolder=decodeURIComponent(m[1]);
  else if(h==='/images')imgCurrentFolder='';
  var c=$('content');
  c.innerHTML='<div id="imgBreadcrumb" style="margin-bottom:12px;font-size:13px;color:var(--on-surface-variant)"></div>'
    +'<div id="imgGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px"><div class="empty">加载中…</div></div>'
    +'<div id="imgBatchBar" style="display:none;position:fixed;bottom:70px;left:50%;transform:translateX(-50%);background:var(--on-surface);color:var(--surface);padding:10px 20px;border-radius:20px;z-index:200;gap:12px;align-items:center;box-shadow:var(--e3);font-size:13px"></div>'
    +'<div id="imgPasteBar" style="display:none;position:fixed;bottom:70px;left:50%;transform:translateX(-50%);background:var(--primary);color:var(--on-primary);padding:10px 20px;border-radius:20px;z-index:200;gap:12px;align-items:center;box-shadow:var(--e3);font-size:13px"></div>'
    +'<div id="imgLightbox" style="display:none;position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.92);cursor:zoom-out;align-items:center;justify-content:center" onclick="this.style.display=\'none\'"><img id="imgLightboxImg" style="max-width:90vw;max-height:90vh;object-fit:contain;border-radius:8px"></div>';
  $('topbarActions').innerHTML='<label class="md3-btn md3-btn-filled" style="cursor:pointer"><input type="file" accept="image/*" multiple style="display:none" id="imgUploadInput">上传</label><button class="md3-btn md3-btn-outlined" id="imgSelectBtn" onclick="_imgToggleSelect()">选择</button>';
  $('imgUploadInput').addEventListener('change',function(e){uploadImages(e.target.files)});
  loadImages();
  // 更新粘贴条
  _imgUpdatePasteBar()
}
function loadImages(){
  var url='/api/admin/images/list';
  if(imgCurrentFolder)url+='?folder='+encodeURIComponent(imgCurrentFolder);
  api('GET',url).then(function(d){
    var grid=$('imgGrid');if(!grid)return;
    var bc=$('imgBreadcrumb');
    // 面包屑 + 返回按钮
    var bcHtml='';
    if(imgCurrentFolder){
      bcHtml+='<a href="javascript:void(0)" onclick="_imgGoBack()" style="color:var(--primary);cursor:pointer;margin-right:8px">← 返回</a>';
    }
    bcHtml+='<a href="javascript:void(0)" onclick="imgCurrentFolder=\'\';renderImages()" style="color:var(--primary);cursor:pointer">图片</a>';
    if(imgCurrentFolder){
      var parts=imgCurrentFolder.split('/');
      var path='';
      parts.forEach(function(p,i){
        path+=(i>0?'/':'')+p;
        bcHtml+=' / <a href="javascript:void(0)" onclick="imgCurrentFolder=\''+path+'\';renderImages()" style="color:var(--primary);cursor:pointer">'+p+'</a>';
      });
    }
    bc.innerHTML=bcHtml;
    var html='';
    // 文件夹
    (d.folders||[]).forEach(function(f){
      var folderPath=imgCurrentFolder?imgCurrentFolder+'/'+f:f;
      html+='<div style="position:relative;padding:16px;border:1px solid var(--outline-variant);border-radius:12px;cursor:pointer;text-align:center;transition:border-color 200ms" data-folder="'+esc(f)+'" onclick="if(!window.imgSelectMode)_imgEnterFolder(this.dataset.folder)">'
        +'<div style="position:absolute;top:6px;right:6px" onclick="event.stopPropagation()">'
        +'<button class="md3-btn md3-btn-text" style="width:24px;height:24px;padding:0;min-width:0;font-size:14px;background:rgba(0,0,0,.4);color:#fff;border-radius:12px;line-height:1" onclick="_imgFolderMenu(event,\''+esc(folderPath)+'\')">⋯</button>'
        +'</div>'
        +'<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--primary)" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
        +'<div style="font-size:12px;margin-top:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(f)+'</div>'
        +'</div>';
    });
    // 图片
    (d.images||[]).forEach(function(img){
      var fullUrl='https://pluslogic.eu.org'+img.url;
      var imgPath=imgCurrentFolder?imgCurrentFolder+'/'+img.name:img.name;
      html+='<div class="img-card" data-path="'+esc(imgPath)+'" data-url="'+esc(fullUrl)+'" style="position:relative;border:1px solid var(--outline-variant);border-radius:12px;overflow:hidden;cursor:pointer;transition:border-color 200ms">'
        +'<div style="aspect-ratio:1;background:var(--surface-container-high);display:flex;align-items:center;justify-content:center;overflow:hidden" onclick="if(!window.imgSelectMode)_imgPreview(\''+fullUrl+'\');else _imgToggleItem(this.parentElement)">'
        +'<img src="'+fullUrl+'" alt="'+esc(img.name)+'" style="max-width:100%;max-height:100%;object-fit:cover" loading="lazy" onerror="this.style.display=\'none\'">'
        +'</div>'
        +'<div style="padding:8px;font-size:11px;color:var(--on-surface-variant);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(img.name)+'</div>'
        +'<div class="img-check" style="display:none;position:absolute;top:6px;left:6px;width:22px;height:22px;border-radius:50%;border:2px solid #fff;background:rgba(0,0,0,.3);align-items:center;justify-content:center;font-size:12px;color:#fff"></div>'
        +'<div style="position:absolute;top:6px;right:6px" onclick="event.stopPropagation()">'
        +'<button class="md3-btn md3-btn-text" style="width:24px;height:24px;padding:0;min-width:0;font-size:14px;background:rgba(0,0,0,.5);color:#fff;border-radius:12px;line-height:1" onclick="_imgMenu(event,\''+fullUrl+'\',\''+esc(imgPath)+'\')">⋯</button>'
        +'</div>'
        +'</div>';
    });
    if(!html)html='<div class="empty">暂无图片</div>';
    grid.innerHTML=html;
    _imgUpdateSelectUI()
  })
}
window._imgEnterFolder=function(name){
  imgCurrentFolder=imgCurrentFolder?imgCurrentFolder+'/'+name:name;
  history.pushState({page:'images',folder:imgCurrentFolder},'','#/images/'+encodeURIComponent(imgCurrentFolder));
  loadImages()
};
window._imgGoBack=function(){
  var parts=imgCurrentFolder.split('/');
  parts.pop();
  imgCurrentFolder=parts.join('/');
  history.pushState({page:'images',folder:imgCurrentFolder},'','#/images/'+encodeURIComponent(imgCurrentFolder));
  loadImages()
};

// 手机返回键：子文件夹内按返回→回到上一级，而不是退出图片管理
window.addEventListener('popstate',function(){
  if(currentPage!=='images')return;
  var h=(location.hash||'').replace(/^#/,'');
  var m=h.match(/^\/images\/?(.*)/);
  if(m){
    imgCurrentFolder=decodeURIComponent(m[1]||'');
    loadImages()
  }
});
window._imgFolderMenu=function(e,path){
  e.stopPropagation();
  var old=document.querySelector('.img-ctx-menu');if(old)old.remove();
  var menu=document.createElement('div');
  menu.className='img-ctx-menu';
  menu.style.cssText='position:fixed;z-index:300;background:var(--surface-container);border:1px solid var(--outline-variant);border-radius:12px;box-shadow:var(--e3);padding:4px 0;min-width:140px';
  menu.style.left=Math.min(e.clientX,innerWidth-160)+'px';
  menu.style.top=Math.min(e.clientY,innerHeight-80)+'px';
  menu.innerHTML='<button class="md3-btn md3-btn-text" style="width:100%;justify-content:flex-start;border-radius:0;height:36px;font-size:13px;color:var(--error)" onclick="_imgDeleteFolder(\''+path+'\');this.parentElement.remove()">删除文件夹</button>';
  document.body.appendChild(menu);
  setTimeout(function(){document.addEventListener('click',function f(){menu.remove();document.removeEventListener('click',f)},{once:true})},10)
};
window._imgDeleteFolder=function(path){
  showDialog('<h3>确认删除</h3><p>文件夹 "'+esc(path)+'" 及其所有内容将被删除</p><div class="dialog-actions"><button class="md3-btn md3-btn-text" onclick="closeDialog()">取消</button><button class="md3-btn md3-btn-danger" onclick="_doDeleteFolder(\''+esc(path)+'\')">删除</button></div>')
};
window._doDeleteFolder=function(path){
  closeDialog();
  api('DELETE','/api/admin/images/folder/'+path).then(function(d){
    if(d.ok){toast('文件夹已删除');loadImages()}
    else toast(d.error||'删除失败')
  })
};
window._imgToggleSelect=function(){
  window.imgSelectMode=!window.imgSelectMode;
  window.imgSelected.clear();
  var btn=$('imgSelectBtn');
  if(btn)btn.textContent=window.imgSelectMode?'取消':'选择';
  _imgUpdateSelectUI()
};
window._imgToggleItem=function(el){
  var path=el.dataset.path;
  if(!path)return;
  if(window.imgSelected.has(path))window.imgSelected.delete(path);
  else window.imgSelected.add(path);
  _imgUpdateSelectUI()
};
function _imgUpdateSelectUI(){
  // 显示/隐藏复选框
  document.querySelectorAll('.img-card').forEach(function(el){
    var cb=el.querySelector('.img-check');
    if(!cb)return;
    cb.style.display=window.imgSelectMode?'flex':'none';
    var path=el.dataset.path;
    cb.textContent=window.imgSelected.has(path)?'✓':'';
    cb.style.background=window.imgSelected.has(path)?'var(--primary)':'rgba(0,0,0,.3)';
    el.style.borderColor=window.imgSelected.has(path)?'var(--primary)':'var(--outline-variant)';
  });
  // 批量操作栏
  var bar=$('imgBatchBar');
  if(!bar)return;
  if(window.imgSelectMode&&window.imgSelected.size>0){
    bar.style.display='flex';
    bar.innerHTML='<span>'+window.imgSelected.size+' 项</span>'
      +'<button class="md3-btn md3-btn-text" style="height:32px;padding:0 12px;font-size:12px;color:#fff;border-radius:16px" onclick="_imgBatchCopy()">📋 复制</button>'
      +'<button class="md3-btn md3-btn-text" style="height:32px;padding:0 12px;font-size:12px;color:#fff;border-radius:16px" onclick="_imgBatchCut()">✂️ 剪切</button>'
      +'<button class="md3-btn md3-btn-text" style="height:32px;padding:0 12px;font-size:12px;color:#FF8A80;border-radius:16px" onclick="_imgBatchDelete()">🗑️ 删除</button>'
  }else{
    bar.style.display='none'
  }
}
window._imgBatchCopy=function(){
  imgClipboard={type:'copy',paths:Array.from(window.imgSelected)};
  _imgToggleSelect();
  _imgUpdatePasteBar();
  toast('已复制 '+imgClipboard.paths.length+' 项，请选择目标文件夹后粘贴')
};
window._imgBatchCut=function(){
  imgClipboard={type:'cut',paths:Array.from(window.imgSelected)};
  _imgToggleSelect();
  _imgUpdatePasteBar();
  toast('已剪切 '+imgClipboard.paths.length+' 项，请选择目标文件夹后粘贴')
};
window._imgBatchDelete=function(){
  var count=window.imgSelected.size;
  showDialog('<h3>批量删除</h3><p>确认删除 '+count+' 个项目？</p><div class="dialog-actions"><button class="md3-btn md3-btn-text" onclick="closeDialog()">取消</button><button class="md3-btn md3-btn-danger" onclick="_doBatchDelete()">删除</button></div>')
};
window._doBatchDelete=function(){
  closeDialog();
  var paths=Array.from(window.imgSelected);var done=0;
  paths.forEach(function(p){
    api('DELETE','/api/admin/images/'+p).then(function(){done++;if(done===paths.length){toast('已删除 '+paths.length+' 项');_imgToggleSelect();loadImages()}})
  })
};
window._imgPreview=function(url){
  var lb=$('imgLightbox');var img=$('imgLightboxImg');
  if(!lb||!img)return;
  img.src=url;lb.style.display='flex'
};
window._imgMenu=function(e,url,path){
  e.stopPropagation();
  var old=document.querySelector('.img-ctx-menu');if(old)old.remove();
  var menu=document.createElement('div');
  menu.className='img-ctx-menu';
  menu.style.cssText='position:fixed;z-index:300;background:var(--surface-container);border:1px solid var(--outline-variant);border-radius:12px;box-shadow:var(--e3);padding:4px 0;min-width:160px';
  menu.style.left=Math.min(e.clientX,innerWidth-180)+'px';
  menu.style.top=Math.min(e.clientY,innerHeight-200)+'px';
  menu.innerHTML='<button class="md3-btn md3-btn-text" style="width:100%;justify-content:flex-start;border-radius:0;height:36px;font-size:13px" onclick="_imgCopy(\''+esc(path)+'\');this.parentElement.remove()">📋 复制</button>'
    +'<button class="md3-btn md3-btn-text" style="width:100%;justify-content:flex-start;border-radius:0;height:36px;font-size:13px" onclick="_imgCut(\''+esc(path)+'\');this.parentElement.remove()">✂️ 剪切</button>'
    +'<hr style="border:none;border-top:1px solid var(--outline-variant);margin:4px 0">'
    +'<button class="md3-btn md3-btn-text" style="width:100%;justify-content:flex-start;border-radius:0;height:36px;font-size:13px" onclick="copyImageUrl(\''+url+'\');this.parentElement.remove()">复制链接</button>'
    +'<button class="md3-btn md3-btn-text" style="width:100%;justify-content:flex-start;border-radius:0;height:36px;font-size:13px" onclick="window.open(\''+url+'\',\'_blank\');this.parentElement.remove()">新窗口打开</button>'
    +'<button class="md3-btn md3-btn-text" style="width:100%;justify-content:flex-start;border-radius:0;height:36px;font-size:13px" onclick="_imgFindRefs(\''+url+'\');this.parentElement.remove()">查找引用</button>'
    +'<hr style="border:none;border-top:1px solid var(--outline-variant);margin:4px 0">'
    +'<button class="md3-btn md3-btn-text" style="width:100%;justify-content:flex-start;border-radius:0;height:36px;font-size:13px;color:var(--error)" onclick="deleteImage(\''+path+'\');this.parentElement.remove()">删除</button>';
  document.body.appendChild(menu);
  setTimeout(function(){document.addEventListener('click',function f(){menu.remove();document.removeEventListener('click',f)},{once:true})},10)
};

// ── 文件管理：复制/剪切/粘贴 ──
window._imgCopy=function(path){
  imgClipboard={type:'copy',paths:[path]};
  _imgUpdatePasteBar();
  toast('已复制，请选择目标文件夹后粘贴')
};
window._imgCut=function(path){
  imgClipboard={type:'cut',paths:[path]};
  _imgUpdatePasteBar();
  toast('已剪切，请选择目标文件夹后粘贴')
};
function _imgUpdatePasteBar(){
  var bar=$('imgPasteBar');if(!bar)return;
  if(!imgClipboard||!imgClipboard.paths.length){bar.style.display='none';return}
  var count=imgClipboard.paths.length;
  var label=imgClipboard.type==='copy'?'复制':'剪切';
  bar.style.display='flex';
  bar.innerHTML='<span>'+label+' '+count+' 项</span>'
    +'<button class="md3-btn md3-btn-text" style="height:32px;padding:0 12px;font-size:12px;color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:16px" onclick="_imgShowPastePicker()">选择目标并粘贴</button>'
    +'<button class="md3-btn md3-btn-text" style="height:32px;padding:0 8px;font-size:12px;color:rgba(255,255,255,.7);border-radius:16px" onclick="imgClipboard=null;_imgUpdatePasteBar()">✕</button>'
}
window._imgShowPastePicker=function(){
  if(!imgClipboard||!imgClipboard.paths.length){toast('剪贴板为空');return}
  var count=imgClipboard.paths.length;
  var label=imgClipboard.type==='copy'?'复制':'移动';
  _fpPath='';_fpCache={};window._fpTargetFolder='';
  showDialog('<h3>'+label+'到…</h3>'
    +'<div id="fpBreadcrumb" style="font-size:13px;color:var(--on-surface-variant);margin-bottom:8px">根目录</div>'
    +'<div id="fpBody" style="max-height:320px;overflow-y:auto;border:1px solid var(--outline-variant);border-radius:12px;padding:4px"></div>'
    +'<div style="padding:8px 0;font-size:12px;color:var(--outline)" id="fpSelected">当前选择：根目录</div>'
    +'<div class="dialog-actions"><button class="md3-btn md3-btn-text" onclick="closeDialog()">取消</button>'
    +'<button class="md3-btn md3-btn-filled" onclick="window._fpDoPaste()">粘贴到此</button></div>');
  _fpRender()
};
function _fpCheckDone(done,failed,total,type){
  if(done+failed<total){toast('处理中… '+(done+failed)+'/'+total);return}
  imgClipboard=null;
  _imgUpdatePasteBar();
  loadImages();
  if(failed===0)toast((type==='cut'?'移动':'复制')+'完成：'+done+' 项');
  else toast('完成 '+done+' 项，失败 '+failed+' 项')
}

// ── 文件夹选择器（支持展开子文件夹）──
var _fpPath='';
var _fpCache={};
function _fpLoad(path){
  return new Promise(function(resolve,reject){
    if(_fpCache[path+':']){resolve(_fpCache[path+':']);return}
    var url='/api/admin/images/list'+(path?'?folder='+encodeURIComponent(path):'');
    api('GET',url).then(function(d){
      _fpCache[path+':']=d.folders||[];
      resolve(d.folders||[])
    }).catch(reject)
  })
}
function _fpRender(){
  var el=document.getElementById('fpBody');if(!el)return;
  el.innerHTML='<div style="text-align:center;padding:20px;color:var(--outline);font-size:13px">加载中…</div>';
  _fpLoad(_fpPath).then(function(folders){
    var html='';
    // 返回上一级
    if(_fpPath){
      html+='<div class="fp-row" style="padding:10px 16px;cursor:pointer;border-radius:8px;font-size:13px;display:flex;align-items:center;gap:8px;color:var(--primary)" onclick="_fpUp()">'
        +'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> 返回上一级</div>'
    }
    // 当前文件夹选项
    var label=_fpPath||'根目录';
    html+='<div class="fp-row" data-folder="'+esc(_fpPath)+'" style="padding:10px 16px;cursor:pointer;border-radius:8px;font-size:14px;display:flex;align-items:center;gap:8px;font-weight:600" onclick="_fpSelect(this,\''+esc(_fpPath)+'\')">'
      +'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--primary)" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
      +'<span>'+esc(label)+'</span>'
      +'<span style="margin-left:auto;font-size:12px;color:var(--primary)">← 选择此处</span></div>';
    // 子文件夹列表
    if(folders.length){
      html+='<div style="border-top:1px solid var(--outline-variant);margin:4px 0;padding-top:4px">';
      folders.forEach(function(f){
        html+='<div class="fp-row" style="padding:10px 16px;cursor:pointer;border-radius:8px;font-size:14px;display:flex;align-items:center;gap:8px" onclick="_fpOpen(\''+esc(f)+'\')">'
          +'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
          +'<span>'+esc(f)+'</span>'
          +'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--outline)" stroke-width="1.5" style="margin-left:auto"><polyline points="9 18 15 12 9 6"/></svg></div>'
      });
      html+='</div>'
    }else if(!_fpPath){
      html+='<div style="padding:16px;text-align:center;font-size:13px;color:var(--outline)">暂无文件夹</div>'
    }
    el.innerHTML=html;
    // 更新面包屑
    var bc=document.getElementById('fpBreadcrumb');
    if(bc){
      var bcHtml='<span style="cursor:pointer;color:var(--primary)" onclick="_fpGoto(\'\')">根目录</span>';
      if(_fpPath){
        var parts=_fpPath.split('/');var acc='';
        parts.forEach(function(p,i){
          acc+=(i?'/':'')+p;
          bcHtml+=' / <span style="cursor:pointer;color:var(--primary)" onclick="_fpGoto(\''+esc(acc)+'\')">'+esc(p)+'</span>'
        })
      }
      bc.innerHTML=bcHtml
    }
    // 更新选择状态
    window._fpTargetFolder=_fpPath;
    _fpUpdateSel()
  })
}
function _fpUpdateSel(){
  var sel=document.getElementById('fpSelected');
  if(sel)sel.textContent='当前选择：'+(window._fpTargetFolder||'根目录')
}
window._fpOpen=function(name){
  _fpPath=_fpPath?_fpPath+'/'+name:name;
  _fpRender()
};
window._fpUp=function(){
  var parts=_fpPath.split('/');parts.pop();
  _fpPath=parts.join('/');
  _fpRender()
};
window._fpGoto=function(path){
  _fpPath=path;
  _fpRender()
};
window._fpSelect=function(el,folder){
  window._fpTargetFolder=folder;
  document.querySelectorAll('.fp-row').forEach(function(r){r.style.background='';r.style.color=''});
  el.style.background='var(--primary-container)';
  el.style.color='var(--on-primary-container)';
  _fpUpdateSel()
};
window._fpDoPaste=function(){
  if(!imgClipboard||!imgClipboard.paths.length){closeDialog();return}
  var dest=window._fpTargetFolder;
  if(dest===undefined){toast('请选择目标文件夹');return}
  var type=imgClipboard.type;
  var paths=imgClipboard.paths;
  var total=paths.length,done=0,failed=0;
  closeDialog();
  toast('处理中… 0/'+total);
  paths.forEach(function(srcPath){
    var fileName=srcPath.split('/').pop();
    api('GET','/api/admin/images/file/'+encodeURIComponent(srcPath)).then(function(d){
      if(!d.ok){failed++;_fpCheckDone(done,failed,total,type);return}
      api('POST','/api/admin/images/upload',{data:d.data,name:fileName,folder:dest}).then(function(r){
        if(r.ok){
          if(type==='cut'){
            api('DELETE','/api/admin/images/'+srcPath).then(function(){done++;_fpCheckDone(done,failed,total,type)}).catch(function(){done++;_fpCheckDone(done,failed,total,type)})
          }else{done++;_fpCheckDone(done,failed,total,type)}
        }else{failed++;_fpCheckDone(done,failed,total,type)}
      }).catch(function(){failed++;_fpCheckDone(done,failed,total,type)})
    }).catch(function(){failed++;_fpCheckDone(done,failed,total,type)})
  })
};
window.copyImageUrl=function(url){
  if(navigator.clipboard){navigator.clipboard.writeText(url);toast('URL 已复制')}
  else{var ta=document.createElement('textarea');ta.value=url;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);toast('URL 已复制')}
};
window.deleteImage=function(name){
  showDialog('<h3>确认删除</h3><p>图片 "'+esc(name)+'" 将被删除</p><div class="dialog-actions"><button class="md3-btn md3-btn-text" onclick="closeDialog()">取消</button><button class="md3-btn md3-btn-danger" onclick="_doDeleteImage(\''+esc(name)+'\')">删除</button></div>')
};
window._doDeleteImage=function(name){
  closeDialog();
  api('DELETE','/api/admin/images/'+name).then(function(d){
    if(d.ok){toast('已删除');loadImages()}
    else toast(d.error||'删除失败')
  }).catch(function(e){toast('删除失败: '+e.message)})
};
window._imgFindRefs=function(url){
  var fileName=url.split('/').pop();
  api('GET','/api/admin/images/references/'+encodeURIComponent(url)).then(function(d){
    var arts=d.articles||[];
    if(!arts.length){showDialog('<h3>查找引用</h3><p>图片 "'+esc(fileName)+'" 未被任何文章引用。</p><div class="dialog-actions"><button class="md3-btn md3-btn-text" onclick="closeDialog()">关闭</button></div>');return}
    var list=arts.map(function(a){return '<div style="padding:8px 0;border-bottom:1px solid var(--outline-variant)"><a href="#/editor/'+a.id+'" style="color:var(--primary);font-weight:500" onclick="closeDialog()">'+esc(a.title)+'</a><div style="font-size:12px;color:var(--outline);margin-top:2px">'+esc(a.slug)+'</div></div>'}).join('');
    showDialog('<h3>查找引用</h3><p>图片 "'+esc(fileName)+'" 被以下 '+arts.length+' 篇文章引用：</p>'+list+'<div class="dialog-actions"><button class="md3-btn md3-btn-text" onclick="closeDialog()">关闭</button></div>')
  })
};
function uploadImages(files){
  if(!files||!files.length)return;
  var folder=imgCurrentFolder||new Date().toISOString().slice(0,7).replace('-','/');
  var total=files.length,done=0;
  toast('上传中… 0/'+total);
  Array.from(files).forEach(function(file){
    var reader=new FileReader();
    reader.onload=function(){
      var base64=reader.result.split(',')[1];
      api('POST','/api/admin/images/upload',{data:base64,name:file.name,folder:folder}).then(function(d){
        done++;
        if(done===total){toast('上传完成 '+total+' 张');loadImages()}
        else toast('上传中… '+done+'/'+total)
      }).catch(function(){done++;toast('上传失败: '+file.name)})
    };
    reader.readAsDataURL(file)
  })
};

// ════════════════════════════════════════
//  设置
// ════════════════════════════════════════
function renderSettings(){
  var c=$('content');
  c.innerHTML='<div class="settings-section"><h3>修改密码</h3>'
    +'<div style="max-width:400px">'
    +'<div style="margin-bottom:12px"><input class="md3-input" type="password" id="setOldPw" placeholder="当前密码"></div>'
    +'<div style="margin-bottom:12px"><input class="md3-input" type="password" id="setNewPw" placeholder="新密码"></div>'
    +'<div style="margin-bottom:16px"><input class="md3-input" type="password" id="setNewPw2" placeholder="确认新密码"></div>'
    +'<button class="md3-btn md3-btn-filled" onclick="window._changePw()">修改密码</button>'
    +'</div></div>'
    +'<div class="settings-section"><h3>管理员评论设置</h3>'
    +'<div style="max-width:400px">'
    +'<div style="margin-bottom:12px"><label style="display:block;font-size:12px;font-weight:600;color:var(--on-surface-variant);margin-bottom:4px">网站地址</label><input class="md3-input" id="setWebsite" value="'+esc(adminWebsite)+'" placeholder="https://pluslogic.eu.org"></div>'
    +'<button class="md3-btn md3-btn-filled" onclick="window._saveWebsite()">保存</button>'
    +'</div></div>'
    +'<div class="settings-section"><h3>数据管理</h3>'
    +'<div style="display:flex;gap:12px;flex-wrap:wrap">'
    +'<button class="md3-btn md3-btn-outlined" onclick="window._importData()">从 GitHub 导入数据</button>'
    +'<button class="md3-btn md3-btn-outlined" onclick="window._exportData()">导出全站数据</button>'
    +'<button class="md3-btn md3-btn-outlined" onclick="window._exportComments()">导出评论数据</button>'
    +'</div></div>'
}
window._saveWebsite=function(){
  var w=$('setWebsite').value.trim();
  if(!w){toast('请输入网站地址');return}
  adminWebsite=w;
  try{localStorage.setItem('admin_website',w)}catch(e){}
  toast('网站地址已保存')
};
window._changePw=function(){
  var old=$('setOldPw').value,new1=$('setNewPw').value,new2=$('setNewPw2').value;
  if(!old||!new1){toast('请填写完整');return}
  if(new1!==new2){toast('两次输入的新密码不一致');return}
  if(new1.length<6){toast('新密码至少6位');return}
  api('POST','/api/admin/password',{old_password:old,new_password:new1}).then(function(d){
    if(d.ok){toast('密码已修改');$('setOldPw').value='';$('setNewPw').value='';$('setNewPw2').value=''}
    else toast(d.error||'修改失败')
  }).catch(function(){toast('网络错误')})
};
window._exportData=function(){window.open(API+'/api/admin/export?token='+token,'_blank')};
window._importData=function(){
  showDialog('<h3>从 GitHub 导入</h3><p>将从 GitHub 仓库的 content/blog/ 目录导入所有文章到 D1 数据库。</p><div class="dialog-actions"><button class="md3-btn md3-btn-text" onclick="closeDialog()">取消</button><button class="md3-btn md3-btn-filled" onclick="window._doImport()">开始导入</button></div>')
};
window._doImport=function(){
  closeDialog();
  toast('正在导入…');
  api('POST','/api/admin/import-from-github').then(function(d){
    if(d.ok)toast('导入完成: '+d.imported+' 篇文章');
    else toast(d.error||'导入失败')
  }).catch(function(){toast('导入失败')})
};

// ════════════════════════════════════════
//  Markdown 解析 (预览用)
// ════════════════════════════════════════
function mdToHtml(src){
  var lines=src.split(/\r?\n/),html='',i=0;
  var inCode=false,codeLang='',codeLines=[];
  var inList=false,listType='';
  var inTable=false,tableRows=[],tableAligns=[];
  var inBq=false,bqLines=[];
  function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
  function inline(t){
    t=t.replace(/\\\$/g,'$');
    t=t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,'<img src="$2" alt="$1" style="max-width:100%">');
    t=t.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank">$1</a>');
    t=t.replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>');
    t=t.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
    t=t.replace(/\*(.+?)\*/g,'<em>$1</em>');
    t=t.replace(/~~(.+?)~~/g,'<del>$1</del>');
    t=t.replace(/`([^`]+)`/g,'<code style="background:var(--surface-container-high);padding:2px 6px;border-radius:4px;font-family:JetBrains Mono,monospace;font-size:.85em">$1</code>');
    return t
  }
  function flushBq(){if(inBq&&bqLines.length){html+='<blockquote style="border-left:3px solid var(--primary);padding:8px 16px;margin:12px 0;background:var(--surface-container);border-radius:0 8px 8px 0"><p>'+inline(bqLines.join('<br>'))+'</p></blockquote>\n';bqLines=[];inBq=false}}
  function flushList(){if(inList){html+=listType==='ul'?'</ul>\n':'</ol>\n';inList=false;listType=''}}
  function flushTable(){
    if(inTable&&tableRows.length){
      html+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px"><thead><tr>';
      tableRows[0].forEach(function(h,ci){var a=tableAligns[ci]||'';html+='<th style="text-align:'+(a||'left')+';padding:8px 12px;border:1px solid var(--outline-variant);background:var(--surface-container)">'+inline(h.trim())+'</th>'});
      html+='</tr></thead><tbody>';
      for(var r=2;r<tableRows.length;r++){html+='<tr>';tableRows[r].forEach(function(c,ci){var a=tableAligns[ci]||'';html+='<td style="text-align:'+(a||'left')+';padding:8px 12px;border:1px solid var(--outline-variant)">'+inline(c.trim())+'</td>'});html+='</tr>'}
      html+='</tbody></table></div>\n';tableRows=[];tableAligns=[];inTable=false
    }
  }
  function flushAll(){flushBq();flushList();flushTable()}
  while(i<lines.length){
    var line=lines[i];
    if(line.match(/^```/)){
      if(inCode){html+='<pre style="background:#1e1e2e;color:#cdd6f4;padding:16px;border-radius:8px;overflow-x:auto;margin:12px 0"><code>'+esc(codeLines.join('\n'))+'</code></pre>\n';inCode=false;codeLines=[];codeLang=''}
      else{flushAll();inCode=true;codeLang=line.replace(/^```/,'').trim()}
      i++;continue
    }
    if(inCode){codeLines.push(line);i++;continue}
    if(line.trim()===''){flushAll();i++;continue}
    if(line.match(/^>\s?/)){flushList();flushTable();inBq=true;bqLines.push(line.replace(/^>\s?/,''));i++;continue}
    else{flushBq()}
    if(line.includes('|')&&(line.trim().startsWith('|')||line.trim().match(/^[^|]*\|/))){
      flushBq();flushList();
      var cells=line.split('|').filter(function(_,idx,arr){return idx>0&&idx<arr.length-1});
      var nonEmpty=cells.filter(function(c){return c.trim()!==''});
      var isSep=nonEmpty.length>0&&nonEmpty.every(function(c){return /^[:\s]*-{3,}[\s:]*$/.test(c.trim())});
      if(isSep){tableAligns=cells.map(function(c){var t=c.trim();if(t.startsWith(':')&&t.endsWith(':'))return'center';if(t.endsWith(':'))return'right';if(t.startsWith(':'))return'left';return''});tableRows.push(cells);i++;continue}
      if(!inTable){inTable=true;tableRows=[];tableAligns=[]}
      tableRows.push(cells);i++;continue
    }else{flushTable()}
    var hm=line.match(/^(#{1,6})\s+(.+)$/);
    if(hm){flushAll();var lv=hm[1].length;html+='<h'+lv+'>'+inline(hm[2].trim())+'</h'+lv+'>\n';i++;continue}
    if(line.match(/^[-*_]{3,}\s*$/)){flushAll();html+='<hr>\n';i++;continue}
    if(line.match(/^\s*[-*]\s+/)){
      flushBq();flushTable();
      if(!inList||listType!=='ul'){if(inList)flushList();html+='<ul>\n';inList=true;listType='ul'}
      html+='<li>'+inline(line.replace(/^\s*[-*]\s+/,''))+'</li>\n';i++;continue
    }
    if(line.match(/^\s*\d+\.\s+/)){
      flushBq();flushTable();
      if(!inList||listType!=='ol'){if(inList)flushList();html+='<ol>\n';inList=true;listType='ol'}
      html+='<li>'+inline(line.replace(/^\s*\d+\.\s+/,''))+'</li>\n';i++;continue
    }
    flushList();flushTable();
    var para=[line];i++;
    while(i<lines.length&&lines[i].trim()!==''&&!lines[i].match(/^(#{1,6}\s|```|>\s?|\s*[-*]\s+|\s*\d+\.\s+|[-*_]{3,}\s*$|\|)/)){para.push(lines[i]);i++}
    html+='<p>'+inline(para.join('<br>'))+'</p>\n'
  }
  flushAll();
  return html
}

// ── Init ──
checkAuth()
})();
