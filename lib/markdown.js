#!/usr/bin/env node
'use strict';

// ── Helpers ─────────────────────────────────────────────────────────────────
function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Markdown Parser (zero-dependency, production-grade) ────────────────────
function parseFrontMatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return [{}, src];
  const meta = {};
  m[1].split(/\r?\n/).forEach(line => {
    const fm = line.match(/^(\w+):\s*"([^"]*)"/);
    const fn = line.match(/^(\w+):\s*(.+)$/);
    if (fm) {
      meta[fm[1]] = fm[2];
    } else if (fn) {
      const key = fn[1];
      let val = fn[2].trim();
      if (val.startsWith('[')) {
        try { val = JSON.parse(val); } catch (e) {
          throw new SyntaxError('Failed to parse front matter field "' + key + '" as JSON: ' + val);
        }
      }
      meta[key] = val;
    }
  });
  return [meta, src.slice(m[0].length)];
}

function mdInline(text, footnotes) {
  // Preserve markdown-escaped dollar signs: \$ -> literal $
  text = text.replace(/\\\$/g, '$');
  // Preserve <br> line breaks before HTML escaping
  text = text.replace(/<br\s*\/?>/gi, '\x01BR\x01');
  // Extract images first, replace with placeholders to protect from HTML escaping
  var _imgs = [];
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(_, alt, src) {
    var i = _imgs.length;
    // Extract width from URL params (e.g. ?w=800 or &w=800)
    var urlWidth = (src.match(/[?&]w=(\d+)/) || [])[1];
    var w = urlWidth ? parseInt(urlWidth) : 800;
    var h = Math.round(w * 0.5625); // 16:9 default aspect ratio
    // Build srcset for responsive images (Unsplash + generic)
    var srcset = '';
    if (src.includes('unsplash.com')) {
      var baseUrl = src.replace(/[?&]w=\d+/, '').replace(/[?&]q=\d+/, '').replace(/[?&]fm=[a-z]+/, '');
      var sep = baseUrl.includes('?') ? '&' : '?';
      srcset = ' srcset="' + baseUrl + sep + 'w=400&q=75 400w, ' + baseUrl + sep + 'w=800&q=80 800w, ' + baseUrl + sep + 'w=1200&q=80 1200w" sizes="(max-width: 640px) 100vw, 720px"';
    }
    // Auto-format hint for Unsplash (add fm=webp)
    var optimizedSrc = src;
    if (src.includes('unsplash.com') && !src.includes('fm=')) {
      optimizedSrc += (src.includes('?') ? '&' : '?') + 'fm=webp';
    }
    var img = '<img src="' + optimizedSrc + '" alt="' + alt + '" width="' + w + '" height="' + h + '" loading="lazy" decoding="async"' + srcset + '>';
    _imgs.push(alt ? '<figure class="img-figure">' + img + '<figcaption>' + alt + '</figcaption></figure>' : img);
    return '\x00I' + i + '\x00';
  });
  // Inline math $...$ — extract before HTML escaping; skip currency like $100
  var _maths = [];
  text = text.replace(/(^|[^$\\])\$(?!\s)((?:[^$\\]|\\.)+?)\$(?!\d)/g, function(_, pre, math) {
    var i = _maths.length;
    _maths.push('<span class="math-inline">\\(' + math + '\\)</span>');
    return pre + '\x00M' + i + '\x00';
  });
  // Escape HTML entities (XSS protection)
  text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  // Restore <br> line breaks
  text = text.replace(/\x01BR\x01/g, '<br>');
  // Bold + Italic
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Strikethrough
  text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
  // Inline code
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Footnote references [^name]
  if (footnotes) {
    text = text.replace(/\[\^([^\]]+)\]/g, function(_, name) {
      if (footnotes[name] !== undefined) {
        return '<sup class="footnote-ref"><a href="#fn-' + name + '" id="fnref-' + name + '" onclick="var el=document.getElementById(\'fn-' + name + '\');if(el){el.scrollIntoView({behavior:\'smooth\',block:\'center\'});el.style.background=\'var(--primary-container)\';setTimeout(function(){el.style.background=\'\'},2000)}return false">' + footnotes[name] + '</a></sup>';
      }
      return '<sup class="footnote-ref">[^' + name + ']</sup>';
    });
  }
  // Links (external links open in new tab)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(_, linkText, href) {
    const isExternal = href.startsWith('http://') || href.startsWith('https://');
    const attrs = isExternal ? ' target="_blank" rel="noopener"' : '';
    return '<a href="' + href + '"' + attrs + '>' + linkText + '</a>';
  });
  // Restore images from placeholders
  text = text.replace(/\x00I(\d+)\x00/g, function(_, i) { return _imgs[parseInt(i)] || ''; });
  // Restore inline math from placeholders
  text = text.replace(/\x00M(\d+)\x00/g, function(_, i) { return _maths[parseInt(i)] || ''; });
  return text;
}

function mdToHtml(src) {
  const lines = src.split(/\r?\n/);
  let html = '';
  let i = 0;
  let inCodeBlock = false;
  let codeLang = '';
  let codeLines = [];
  let inList = false;
  let listType = '';
  let inTable = false;
  let tableRows = [];
  let tableAligns = [];
  let inBlockquote = false;
  let bqLines = [];
  let inDefList = false;
  let inHtmlBlock = false;  // track unclosed raw HTML blocks
  let htmlBlockTag = '';
  let footnotes = {};
  let fnCounter = 0;
  let fnDefs = [];

  // First pass: collect footnote definitions
  for (let li = 0; li < lines.length; li++) {
    const fnm = lines[li].match(/^\s*\[\^([^\]]+)\]:\s*(.+)$/);
    if (fnm) {
      fnCounter++;
      footnotes[fnm[1]] = fnCounter;
      fnDefs.push({ name: fnm[1], text: fnm[2], num: fnCounter });
      lines[li] = '';
    }
  }

  function flushBlockquote() {
    if (inBlockquote && bqLines.length) {
      html += '<blockquote><p>' + mdInline(bqLines.join('<br>'), footnotes) + '</p></blockquote>\n';
      bqLines = [];
      inBlockquote = false;
    }
  }

  function flushList() {
    if (inList) {
      html += listType === 'ul' ? '</ul>\n' : '</ol>\n';
      inList = false;
      listType = '';
    }
  }

  function flushDefList() {
    if (inDefList) {
      html += '</dl>\n';
      inDefList = false;
    }
  }

  function flushTable() {
    if (inTable && tableRows.length) {
      html += '<table><thead><tr>';
      tableRows[0].forEach((h, ci) => {
        const align = tableAligns[ci] || '';
        const alignAttr = align ? ' style="text-align:' + align + '"' : '';
        html += '<th' + alignAttr + '>' + mdInline(h.trim(), footnotes) + '</th>';
      });
      html += '</tr></thead><tbody>';
      for (let r = 2; r < tableRows.length; r++) {
        html += '<tr>';
        tableRows[r].forEach((c, ci) => {
          const align = tableAligns[ci] || '';
          const alignAttr = align ? ' style="text-align:' + align + '"' : '';
          html += '<td' + alignAttr + '>' + mdInline(c.trim(), footnotes) + '</td>';
        });
        html += '</tr>';
      }
      html += '</tbody></table>\n';
      tableRows = [];
      tableAligns = [];
      inTable = false;
    }
  }

  function flushAll() {
    flushBlockquote();
    flushList();
    flushTable();
    flushDefList();
  }

  // Check if a line looks like raw HTML (allow up to 3 spaces of indentation)
  function isHtmlLine(line) {
    return /^\s{0,3}<(table|tr|th|td|thead|tbody|div|img|br|hr|p|span|a|b|i|em|strong|ul|ol|li|dl|dt|dd|h[1-6]|blockquote|pre|code|nav|section|article|aside|header|footer|figure|figcaption|details|summary|mark|small|sub|sup|video|audio|source|iframe|embed|object|param|map|area|caption|col|colgroup|fieldset|form|input|button|select|option|textarea|label|legend|datalist|output|progress|meter|dialog|template|slot|canvas|svg|math)(\s|>|\/)/i.test(line);
  }

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block ```
    if (line.match(/^```/)) {
      if (inCodeBlock) {
        const code = codeLines.join('\n');
        html += '<pre><code class="language-' + codeLang + '">' + escHtml(code) + '</code></pre>\n';
        inCodeBlock = false;
        codeLines = [];
        codeLang = '';
      } else {
        flushAll();
        inCodeBlock = true;
        codeLang = line.replace(/^```/, '').trim() || 'code';
      }
      i++;
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      i++;
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      flushAll();
      i++;
      continue;
    }

    // Math block $$ - only match standalone $$ as delimiter
    if (line.trim() === '$$' || (line.trim().startsWith('$$') && !line.trim().slice(2).match(/[\u4e00-\u9fff]/) && line.trim().length > 2 && line.trim().slice(2).trim().length > 0 && !line.trim().slice(2).match(/^[\s]/))) {
      flushAll();
      const afterDollar = line.trim().slice(2).trim();
      if (afterDollar.endsWith('$$') && afterDollar.length > 2) {
        // Single line $$...$$
        html += '<div class="math-block">\\[' + afterDollar.slice(0, -2) + '\\]</div>\n';
      } else if (afterDollar === '') {
        // Standalone $$ - multi-line block
        i++;
        const mathLines = [];
        while (i < lines.length) {
          if (lines[i].trim() === '$$' || lines[i].trim().endsWith('$$')) {
            const endLine = lines[i].trim();
            if (endLine === '$$') { i++; break; }
            mathLines.push(endLine.slice(0, -2));
            i++;
            break;
          }
          mathLines.push(lines[i]);
          i++;
        }
        html += '<div class="math-block">\\[' + mathLines.join('\n') + '\\]</div>\n';
        continue;
      } else {
        // $$ followed by math on same line (no closing $$ on same line)
        i++;
        const mathLines = [afterDollar];
        while (i < lines.length) {
          if (lines[i].trim().endsWith('$$')) {
            const endLine = lines[i].trim();
            if (endLine === '$$') { i++; break; }
            mathLines.push(endLine.slice(0, -2));
            i++;
            break;
          }
          mathLines.push(lines[i]);
          i++;
        }
        html += '<div class="math-block">\\[' + mathLines.join('\n') + '\\]</div>\n';
        continue;
      }
      i++;
      continue;
    }

    // [TOC] directive
    if (line.trim() === '[TOC]') {
      flushAll();
      html += '<nav class="md-toc" id="md-toc-auto"></nav>\n';
      i++;
      continue;
    }

    // Blockquote
    if (line.match(/^>\s?/)) {
      flushList();
      flushTable();
      flushDefList();
      inBlockquote = true;
      bqLines.push(line.replace(/^>\s?/, ''));
      i++;
      continue;
    } else {
      flushBlockquote();
    }

    // Definition list (:   definition)
    if (line.match(/^\s{0,3}:\s{3,}/)) {
      flushList();
      flushTable();
      if (!inDefList) {
        // Check if previous line was plain text (dt)
        html = html.replace(/(<\/(?:p|dd|li|blockquote)>)?\s*$/, '');
        if (!inDefList) {
          html += '<dl>\n';
          inDefList = true;
        }
      }
      const defText = line.replace(/^\s{0,3}:\s{3,}/, '');
      html += '<dd>' + mdInline(defText, footnotes) + '</dd>\n';
      i++;
      continue;
    }

    // Table
    if (line.includes('|') && (line.trim().startsWith('|') || line.trim().match(/^[^|]*\|/))) {
      flushList();
      flushBlockquote();
      flushDefList();
      const cells = line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (cells.some(c => c.match(/^[\s\-:]+$/))) {
        tableAligns = cells.map(c => {
          const t = c.trim();
          if (t.startsWith(':') && t.endsWith(':')) return 'center';
          if (t.endsWith(':')) return 'right';
          if (t.startsWith(':')) return 'left';
          return '';
        });
        tableRows.push(cells);
        i++;
        continue;
      }
      if (!inTable) {
        inTable = true;
        tableRows = [];
        tableAligns = [];
      }
      tableRows.push(cells);
      i++;
      continue;
    } else {
      flushTable();
    }

    // Inside raw HTML block: pass through all non-empty lines
    if (inHtmlBlock && line.trim() !== '') {
      flushAll();
      html += line + '\n';
      const closeMatch2 = line.match(/^\s*<\/(\w+)/);
      if (closeMatch2 && closeMatch2[1].toLowerCase() === htmlBlockTag) {
        inHtmlBlock = false;
        htmlBlockTag = '';
      }
      i++;
      continue;
    }

    // Indented code block (4 spaces) — skip if inside raw HTML block
    if (line.match(/^    /) && line.trim() !== '' && !inHtmlBlock) {
      flushAll();
      const codeLines2 = [];
      while (i < lines.length) {
        if (lines[i].match(/^    /)) {
          codeLines2.push(lines[i].replace(/^    /, ''));
          i++;
        } else if (lines[i].trim() === '') {
          // Empty line: check if followed by more indented content
          if (i + 1 < lines.length && lines[i + 1].match(/^    /)) {
            codeLines2.push('');
            i++;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      html += '<pre><code>' + escHtml(codeLines2.join('\n').replace(/\n+$/, '')) + '</code></pre>\n';
      continue;
    }

    // Raw HTML lines (pass through)
    if (isHtmlLine(line) || (inHtmlBlock && line.match(/^\s*<\/\w+/))) {
      flushAll();
      html += line + '\n';
      // Track open/close tags for block-level elements
      const tagMatch = line.match(/^\s*<(\w+)(?:\s|>|\/)/);
      const closeMatch = line.match(/^\s*<\/(\w+)/);
      if (tagMatch && !line.includes('/>') && !closeMatch) {
        const tag = tagMatch[1].toLowerCase();
        if (['table','tr','thead','tbody','div','section','article','aside','header','footer','nav','figure','details','form','fieldset','blockquote','ul','ol','dl','pre','code','video','audio','iframe','embed','object','dialog','template','slot','canvas','svg','math'].includes(tag)) {
          inHtmlBlock = true;
          htmlBlockTag = tag;
        }
      }
      if (closeMatch && closeMatch[1].toLowerCase() === htmlBlockTag) {
        inHtmlBlock = false;
        htmlBlockTag = '';
      }
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+?)(?:\s+\{#([^}]+)\})?\s*$/);
    if (headingMatch) {
      flushAll();
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      const id = headingMatch[3] || text.toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '');
      html += '<h' + level + ' id="' + id.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '">' + mdInline(text, footnotes) + '</h' + level + '>\n';
      i++;
      continue;
    }

    // Horizontal rule
    if (line.match(/^[-*_]{3,}\s*$/)) {
      flushAll();
      html += '<hr>\n';
      i++;
      continue;
    }

    // Unordered list (with task list support)
    if (line.match(/^\s*[-*]\s+/)) {
      flushBlockquote();
      flushTable();
      flushDefList();
      if (!inList || listType !== 'ul') {
        if (inList) flushList();
        html += '<ul>\n';
        inList = true;
        listType = 'ul';
      }
      // Task list: - [ ] or - [x]
      const taskMatch = line.match(/^\s*[-*]\s+\[([ xX])\]\s*(.*)/);
      if (taskMatch) {
        const checked = taskMatch[1] !== ' ';
        const cls = checked ? ' class="task-item checked"' : ' class="task-item"';
        html += '<li' + cls + '><input type="checkbox" disabled' + (checked ? ' checked' : '') + '> ' + mdInline(taskMatch[2], footnotes) + '</li>\n';
      } else {
        html += '<li>' + mdInline(line.replace(/^\s*[-*]\s+/, ''), footnotes) + '</li>\n';
      }
      i++;
      continue;
    }

    // Ordered list
    if (line.match(/^\s*\d+\.\s+/)) {
      flushBlockquote();
      flushTable();
      flushDefList();
      if (!inList || listType !== 'ol') {
        if (inList) flushList();
        html += '<ol>\n';
        inList = true;
        listType = 'ol';
      }
      html += '<li>' + mdInline(line.replace(/^\s*\d+\.\s+/, ''), footnotes) + '</li>\n';
      i++;
      continue;
    }

    // Paragraph (default)
    flushList();
    flushTable();
    flushDefList();
    const paraLines = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].match(/^(#{1,6}\s|```|>\s?|\s*[-*]\s+|\s*\d+\.\s+|[-*_]{3,}\s*$|\s{0,3}:\s{3,}|\|)/) && !isHtmlLine(lines[i]) && !lines[i].trim().startsWith('$$') && lines[i].trim() !== '[TOC]') {
      paraLines.push(lines[i]);
      i++;
    }
    html += '<p>' + mdInline(paraLines.join('<br>'), footnotes) + '</p>\n';
  }

  flushAll();

  // Append footnotes section
  if (fnDefs.length) {
    html += '<section class="footnotes"><ol>\n';
    fnDefs.forEach(fn => {
      html += '<li id="fn-' + fn.name + '">' + mdInline(fn.text, footnotes) + ' <a href="#fnref-' + fn.name + '" class="footnote-backref" onclick="var el=document.getElementById(\'fnref-' + fn.name + '\');if(el){el.scrollIntoView({behavior:\'smooth\',block:\'center\'});el.style.background=\'var(--primary-container)\';setTimeout(function(){el.style.background=\'\'},2000)}return false">↩</a></li>\n';
    });
    html += '</ol></section>\n';
  }

  return html;
}

module.exports = { escHtml, parseFrontMatter, mdInline, mdToHtml };
