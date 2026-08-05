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
      +'<button class="md3-btn md3-btn-filled" onclick="location.hash=\'#/editor\'">✏️ 写文章</button>'
      +'<button class="md3-btn md3-btn-outlined" onclick="location.hash=\'#/articles\'">📄 管理文章</button>'
      +'<button class="md3-btn md3-btn-outlined" onclick="location.hash=\'#/comments\'">💬 管理评论</button>'
      +'<button class="md3-btn md3-btn-outlined" onclick="location.hash=\'#/friends\'">🔗 管理友链</button>'
      +'</div></div>'
  })
}
function sc(n,l){return '<div class="stat-card"><div class="stat-num">'+n+'</div><div class="stat-label">'+l+'</div></div>'}

// ════════════════════════════════════════
//  文章管理
// ════════════════════════════════════════
function renderArticles(){
  var c=$('content');
  c.innerHTML='<div class="filter-bar"><select id="artFilter"><option value="all">全部</option><option value="published">已发布</option><option value="draft">草稿</option></select></div><div class="table-wrap"><table><thead><tr><th>标题</th><th>日期</th><th>分类</th><th>标签</th><th>状态</th><th>操作</th></tr></thead><tbody id="artBody"><tr><td colspan="6" style="text-align:center;padding:40px">加载中…</td></tr></tbody></table></div>';
  $('artFilter').addEventListener('change',function(){loadArticles(this.value)});
  loadArticles('all');
  $('topbarActions').innerHTML='<button class="md3-btn md3-btn-filled" onclick="location.hash=\'#/editor\'">+ 新文章</button>'
}
function loadArticles(status){
  api('GET','/api/admin/articles'+(status&&status!=='all'?'?status='+status:'')).then(function(d){
    articles=d.articles||[];
    var tb=$('artBody');if(!tb)return;
    if(!articles.length){tb.innerHTML='<tr><td colspan="6" class="empty">暂无文章</td></tr>';return}
    tb.innerHTML=articles.map(function(a){
      var tags=[];try{tags=JSON.parse(a.tags)}catch(e){}
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
    if(d.ok){toast(d.status==='published'?'已发布':'已下架');loadArticles($('artFilter').value)}
  })
};
window._delArt=function(id){
  showDialog('<h3>确认删除</h3><p>文章将移入回收站</p><div class="dialog-actions"><button class="md3-btn md3-btn-text" onclick="closeDialog()">取消</button><button class="md3-btn md3-btn-danger" onclick="window._confirmDelArt('+id+')">删除</button></div>')
};
window._confirmDelArt=function(id){
  closeDialog();
  api('DELETE','/api/admin/articles/'+id).then(function(d){if(d.ok){toast('已移入回收站');loadArticles($('artFilter').value)}})
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
    +'<span style="flex:1"></span>'
    +'<button class="md3-btn md3-btn-text" onclick="window._previewToggle()" id="previewToggleBtn" style="display:none">预览</button>'
    +'</div>'
    +'<div class="editor-wrap">'
    +'<div class="editor-pane"><textarea id="edContent" placeholder="Markdown 内容…"></textarea></div>'
    +'<div class="preview-pane" id="edPreview"></div>'
    +'</div>';
  $('topbarActions').innerHTML='<button class="md3-btn md3-btn-outlined" onclick="window._saveDraft()">存草稿</button><button class="md3-btn md3-btn-filled" onclick="window._saveArticle()">发布</button>';
  var ed=$('edContent');
  // 标题变化时自动生成备注
  var titleTimer=null;
  $('edTitle').addEventListener('input',function(){
    if(editingId)return; // 编辑已有文章时不自动覆盖
    clearTimeout(titleTimer);
    titleTimer=setTimeout(function(){
      var slug=$('edSlug');
      if(slug.dataset.manual)return; // 用户手动修改过则不覆盖
      slug.value=toSlug($('edTitle').value);
    },300);
  });
  $('edSlug').addEventListener('input',function(){this.dataset.manual='1'});
  ed.addEventListener('input',function(){updatePreview()});
  ed.addEventListener('keydown',function(e){
    if(e.key==='Tab'){e.preventDefault();var s=this.selectionStart,end=this.selectionEnd;this.value=this.value.substring(0,s)+'  '+this.value.substring(end);this.selectionStart=this.selectionEnd=s+2;updatePreview()}
    if(e.ctrlKey||e.metaKey){
      if(e.key==='s'){e.preventDefault();window._saveArticle()}
      if(e.key==='b'){e.preventDefault();window._insMd('**','**')}
      if(e.key==='i'){e.preventDefault();window._insMd('*','*')}
    }
  });
  if(window.innerWidth<=768){$('previewToggleBtn').style.display=''}
  if(editingId){
    api('GET','/api/admin/articles/'+editingId).then(function(d){
      if(!d.article)return;
      var a=d.article;
      $('edTitle').value=a.title||'';
      $('edDate').value=a.date||'';
      $('edSlug').value=a.slug||'';
      $('edCat').value=a.category||'';
      var tags=[];try{tags=JSON.parse(a.tags)}catch(e){}
      $('edTags').value=tags.join(', ');
      $('edExcerpt').value=a.excerpt||'';
      ed.value=a.content||'';
      updatePreview()
    })
  }else{
    $('edDate').value=new Date().toISOString().slice(0,10);
    updatePreview()
  }
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
    if(d.ok){toast(editingId?'已更新':'已创建');if(!editingId&&d.id){location.hash='#/editor/'+d.id;editingId=d.id}else{location.hash='#/articles'}}
    else toast(d.error||'保存失败')
  }).catch(function(){toast('网络错误')})
}

// ════════════════════════════════════════
//  评论管理（两栏式）
// ════════════════════════════════════════
var cmtSelectedPage='';
function renderComments(){
  var c=$('content');
  c.innerHTML='<div class="cmt-layout">'
    +'<div class="cmt-sidebar" id="cmtSidebar"><div class="cmt-sidebar-header">文章列表</div><div id="cmtArticleList"><div class="empty">加载中…</div></div></div>'
    +'<div class="cmt-main" id="cmtMain"><div class="cmt-main-header" id="cmtMainHeader">选择一篇文章查看评论</div><div id="cmtList"><div class="empty">← 点击左侧文章</div></div></div>'
    +'</div>';
  loadCommentArticles()
}
function loadCommentArticles(){
  api('GET','/api/admin/comments?limit=1').then(function(d){
    cmtData=d;
    var pages=d.pages||[];
    var el=$('cmtArticleList');if(!el)return;
    if(!pages.length){el.innerHTML='<div class="empty">暂无评论</div>';return}
    // 加载每篇文章的评论数
    el.innerHTML=pages.map(function(p){
      return '<div class="cmt-art-item" data-page="'+esc(p)+'"><div class="cmt-art-name">'+esc(p)+'</div></div>'
    }).join('');
    el.addEventListener('click',function(e){
      var item=e.target.closest('.cmt-art-item');
      if(!item)return;
      document.querySelectorAll('.cmt-art-item').forEach(function(i){i.classList.remove('active')});
      item.classList.add('active');
      cmtSelectedPage=item.dataset.page;
      loadPageComments(cmtSelectedPage)
    });
    // 自动选中第一个
    if(pages.length&&!cmtSelectedPage){
      el.children[0].classList.add('active');
      cmtSelectedPage=pages[0];
      loadPageComments(cmtSelectedPage)
    }else if(cmtSelectedPage){
      var active=el.querySelector('[data-page="'+cmtSelectedPage.replace(/"/g,'\\"')+'"]');
      if(active){active.classList.add('active');loadPageComments(cmtSelectedPage)}
    }
  })
}
function loadPageComments(pageSlug){
  $('cmtMainHeader').textContent=pageSlug;
  $('cmtList').innerHTML='<div class="empty">加载中…</div>';
  api('GET','/api/admin/comments?limit=200&page_slug='+encodeURIComponent(pageSlug)).then(function(d){
    cmtData=d;
    renderCmtTree(d.comments,pageSlug)
  })
}
function renderCmtTree(list,pageSlug){
  var el=$('cmtList');if(!el)return;
  if(!list.length){el.innerHTML='<div class="empty">暂无评论</div>';return}
  // 构建树形结构
  var roots=[];
  var byId={};
  list.forEach(function(c){byId[c.id]=c;c._children=[]});
  list.forEach(function(c){
    if(c.parent_id&&byId[c.parent_id]){byId[c.parent_id]._children.push(c)}
    else{roots.push(c)}
  });
  function renderNode(c,depth){
    var indent=depth*24;
    var h='<div class="cmt-item" id="cmt-'+c.id+'" style="margin-left:'+indent+'px">'
      +'<div class="cmt-header"><span class="cmt-nick">'+esc(c.nickname)+'</span>'+(c.is_admin?'<span class="cmt-badge">艾德密</span>':'')
      +'<span class="cmt-time">'+timeAgo(c.created_at)+'</span></div>'
      +'<div class="cmt-body">'+c.content_html+'</div>'
      +'<div class="cmt-actions">'
      +'<button class="md3-btn md3-btn-text" onclick="window._replyCmt('+c.id+',\''+esc(c.nickname).replace(/'/g,"\\'")+'\')">回复</button>'
      +'<button class="md3-btn md3-btn-text" onclick="window._likeCmt('+c.id+')">👍 '+(c.liked||0)+'</button>'
      +'<button class="md3-btn md3-btn-text" style="color:var(--error)" onclick="window._delCmt('+c.id+')">删除</button>'
      +'</div><div id="reply-'+c.id+'"></div></div>';
    c._children.forEach(function(child){h+=renderNode(child,depth+1)});
    return h
  }
  var html='';
  roots.forEach(function(c){html+=renderNode(c,0)});
  el.innerHTML=html
}
window._replyCmt=function(id,name){
  var el=$('reply-'+id);if(!el)return;
  if(el.innerHTML){el.innerHTML='';return}
  el.innerHTML='<div class="reply-box"><textarea id="replyInput-'+id+'" placeholder="回复 '+name+'…"></textarea><div class="reply-actions"><button class="md3-btn md3-btn-text" onclick="window._cancelReply('+id+')">取消</button><button class="md3-btn md3-btn-filled" onclick="window._sendReply('+id+')">回复</button></div></div>';
  $('replyInput-'+id).focus()
};
window._cancelReply=function(id){var el=$('reply-'+id);if(el)el.innerHTML=''};
window._sendReply=function(id){
  var input=$('replyInput-'+id);if(!input||!input.value.trim())return;
  var parent=cmtData.comments.find(function(c){return c.id===id});
  var page=parent?parent.page_slug:'';
  api('POST','/api/admin/comments',{page:page,parent_id:id,depth:parent?parent.depth+1:1,nickname:'Moriefy',email:'3518972914@qq.com',website:'https://pluslogic.eu.org',content:input.value.trim()}).then(function(d){
    if(d.ok){toast('已回复');loadComments($('cmtPageFilter').value)}
  })
};
window._likeCmt=function(id){api('POST','/api/admin/comments/'+id+'/like').then(function(d){if(d.ok)toast('已点赞 '+d.liked)})};
window._delCmt=function(id){showDialog('<h3>确认删除</h3><p>此评论将被删除</p><div class="dialog-actions"><button class="md3-btn md3-btn-text" onclick="closeDialog()">取消</button><button class="md3-btn md3-btn-danger" onclick="window._confirmDelCmt('+id+')">删除</button></div>')};
window._confirmDelCmt=function(id){closeDialog();api('DELETE','/api/admin/comments/'+id).then(function(d){if(d.ok){toast('已删除');loadComments($('cmtPageFilter').value)}})};

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
    +'<div class="settings-section"><h3>数据管理</h3>'
    +'<div style="display:flex;gap:12px;flex-wrap:wrap">'
    +'<button class="md3-btn md3-btn-outlined" onclick="window._importData()">📦 从 GitHub 导入数据</button>'
    +'<button class="md3-btn md3-btn-outlined" onclick="window.open(API+\'/api/admin/export?token=\'+token,\'_blank\')">📤 导出全站数据</button>'
    +'</div></div>'
}
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
//  简易 Markdown 解析 (预览用)
// ════════════════════════════════════════
function mdToHtml(src){
  var h=src.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  h=h.replace(/```(\w*)\n([\s\S]*?)```/g,(_,l,c)=>'<pre><code>'+c.replace(/\n$/,'')+'</code></pre>');
  h=h.replace(/^### (.+)$/gm,'<h3>$1</h3>');h=h.replace(/^## (.+)$/gm,'<h2>$1</h2>');h=h.replace(/^# (.+)$/gm,'<h1>$1</h1>');
  h=h.replace(/^> (.+)$/gm,'<blockquote><p>$1</p></blockquote>');h=h.replace(/^---+$/gm,'<hr>');
  h=h.replace(/^\s*[-*] (.+)$/gm,'<li>$1</li>');h=h.replace(/((?:<li>.*<\/li>\n?)+)/g,'<ul>$1</ul>');
  h=h.replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>');h=h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');h=h.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g,'<em>$1</em>');
  h=h.replace(/~~(.+?)~~/g,'<del>$1</del>');h=h.replace(/`([^`]+?)`/g,'<code>$1</code>');
  h=h.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,'<img src="$2" alt="$1">');h=h.replace(/\[([^\]]+?)\]\((https?:\/\/[^)]+?)\)/g,'<a href="$2" target="_blank">$1</a>');
  h=h.replace(/\n{2,}/g,'</p><p>');h=h.replace(/\n/g,'<br>');h='<p>'+h+'</p>';h=h.replace(/<p>\s*<\/p>/g,'');
  return h
}

// ── Init ──
checkAuth()
})();
