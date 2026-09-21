/* v13 resource library UX enhancements */
(() => {
  const sortLabels = {
    updated: '最近更新',
    created: '最近新增',
    number: '资源编号',
    name: '资源名称',
    coverFirst: '有封面优先',
    noCoverFirst: '无封面优先'
  };

  state.resourceSort = read('frm_resource_sort', 'updated') || 'updated';

  const normalizeTime = value => {
    if (value == null || value === '') return 0;
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n;
    const d = Date.parse(String(value));
    return Number.isFinite(d) ? d : 0;
  };

  function recordUpdatedAt(r) {
    const field = role('updated', 'resources');
    return Math.max(
      normalizeTime(field ? r.fields?.[field] : 0),
      normalizeTime(r.last_modified_time),
      normalizeTime(r.updated_time),
      normalizeTime(r.modified_time)
    );
  }

  function recordCreatedAt(r) {
    return Math.max(
      normalizeTime(r.created_time),
      normalizeTime(r.create_time),
      normalizeTime(r.created_at)
    );
  }

  function sortResourceRows(rows) {
    const mode = state.resourceSort || 'updated';
    const originalOrder = new Map(state.data.resources.records.map((r, i) => [r.record_id, i]));
    const fallback = (a, b) => (recordUpdatedAt(b) - recordUpdatedAt(a)) || ((originalOrder.get(a.record_id) || 0) - (originalOrder.get(b.record_id) || 0));
    return [...rows].sort((a, b) => {
      if (mode === 'created') return (recordCreatedAt(b) - recordCreatedAt(a)) || fallback(a, b);
      if (mode === 'number') return (value(a, 'number') || '').localeCompare(value(b, 'number') || '', 'zh-CN', {numeric: true}) || fallback(a, b);
      if (mode === 'name') return label(a).localeCompare(label(b), 'zh-CN', {numeric: true}) || fallback(a, b);
      if (mode === 'coverFirst') return Number(hasCover(fieldValue(b, 'cover'))) - Number(hasCover(fieldValue(a, 'cover'))) || fallback(a, b);
      if (mode === 'noCoverFirst') return Number(hasCover(fieldValue(a, 'cover'))) - Number(hasCover(fieldValue(b, 'cover'))) || fallback(a, b);
      return fallback(a, b);
    });
  }

  function sortSelect() {
    return `<select id="sortFilter" aria-label="资源排序">${Object.entries(sortLabels).map(([k, v]) => `<option value="${k}" ${state.resourceSort === k ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
  }

  function cardTagHtml(tags) {
    const list = (tags || []).filter(Boolean);
    if (!list.length) return '';
    const shown = list.slice(0, 3);
    const more = list.length - shown.length;
    return `<div class="card-tags">${shown.map(t => `<span>${esc(t)}</span>`).join('')}${more > 0 ? `<span class="tag-more">+${more}</span>` : ''}</div>`;
  }

  function driveActionRow(name, url, kind) {
    if (!url) return '';
    return `<div class="drive-action-row ${kind}">
      <span class="drive-name">${esc(name)}</span>
      <div class="drive-row-actions">
        <a class="drive-open-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">打开 ↗</a>
        <button type="button" class="drive-copy-btn" data-action="copy-drive-link" data-copy="${esc(url)}" title="复制链接"><span class="copy-icon">⧉</span><span class="copy-label">复制</span></button>
      </div>
    </div>`;
  }

  card = function(r) {
    const cover = coverImg(fieldValue(r, 'cover'), label(r), mediaContext(r));
    const num = value(r, 'number') || '未编号';
    const tags = tagsOf(r);
    const links = resourceLinkMeta(r);
    const extraMain = links.main && ![links.quark, links.baidu].includes(links.main) ? links.main : '';

    const coverBlock = cover
      ? `<div class="cover">${cover}<div class="card-hover-actions"><button class="card-action copy-cover-action" data-action="copy-cover-image" title="复制封面图片" aria-label="复制封面图片">⧉</button></div></div>`
      : `<div class="card-no-cover"><span class="placeholder-icon" aria-hidden="true">▧</span><span>暂无封面</span></div>`;

    const linkRows = [
      driveActionRow('夸克网盘', links.quark, 'quark'),
      driveActionRow('百度网盘', links.baidu, 'baidu'),
      driveActionRow('网页链接', extraMain, 'web')
    ].filter(Boolean).join('');

    return `<article class="card ${cover ? 'has-cover' : 'no-cover'}" data-detail="${esc(r.record_id)}" data-kind="resources">
      ${coverBlock}
      <div class="card-body">
        <div class="card-number">${esc(num)}</div>
        <h3>${esc(label(r))}</h3>
        ${cardTagHtml(tags)}
        ${linkRows ? `<div class="card-drive-actions">${linkRows}</div>` : ''}
      </div>
    </article>`;
  };

  resources = function() {
    const rows = sortResourceRows(filtered());
    const cats = categoryNames();
    state.pageNo = Math.min(state.pageNo, Math.max(1, Math.ceil(rows.length / 25)));
    const pageRows = rows.slice((state.pageNo - 1) * 25, state.pageNo * 25);
    const statusField = linkStatusField() || findResourceField([role('status')].filter(Boolean), /资源.*状态|状态/);
    const platformField = publicationStatusField();
    const statusOptions = filterOptions(statusField, state.data.resources.records.map(r => value(r, 'status')));
    const platformOptions = filterOptions(platformField, [
      ...state.data.platforms.records.map(r => label(r, 'platforms')),
      ...state.data.resources.records.flatMap(r => platformFor(r).split('、'))
    ]);
    const uncategorizedCount = state.data.resources.records.filter(r => !value(r, 'category')).length;
    const categoryBar = `<div class="category-strip panel"><span class="category-strip-label">分类</span><div class="category-chips"><button class="category-chip ${!state.category ? 'active' : ''}" data-category="">全部 <small>${state.data.resources.records.length}</small></button>${cats.map(c => `<button class="category-chip ${state.category === c ? 'active' : ''}" data-category="${esc(c)}">${esc(c)}</button>`).join('')}${uncategorizedCount ? `<button class="category-chip ${state.category === '__none' ? 'active' : ''}" data-category="__none">未分类 <small>${uncategorizedCount}</small></button>` : ''}</div></div>`;
    const quick = state.quickFilter ? `<div class="active-filter panel"><span>当前快捷筛选：<b>${esc(quickLabel(state.quickFilter))}</b></span><button class="text-btn" data-action="clear-quick-filter">清除</button></div>` : '';
    const current = [
      state.query && `关键词：${state.query}`,
      state.status && `状态：${state.status}`,
      state.platform && `平台：${state.platform}`,
      state.category && state.category !== '__none' && `分类：${state.category}`,
      state.category === '__none' && '分类：未分类'
    ].filter(Boolean);
    const totalPages = Math.max(1, Math.ceil(rows.length / 25));
    const pagination = totalPages > 1 ? `<div class="pagination"><span>第 ${state.pageNo} / ${totalPages} 页</span><button class="btn" data-turn="-1" ${state.pageNo <= 1 ? 'disabled' : ''}>上一页</button><button class="btn" data-turn="1" ${state.pageNo * 25 >= rows.length ? 'disabled' : ''}>下一页</button></div>` : '';

    return categoryBar + quick + `<div class="resource-content">
      <div class="resource-toolbar panel">
        <div class="toolbar-main-row">
          <div class="search-wrap"><span class="search-icon">⌕</span><input id="search" type="search" value="${esc(state.query)}" placeholder="搜索资源名称、编号、标签、描述、链接……"></div>
          <div class="toolbar-filters">${select('statusFilter', '全部状态', statusOptions, state.status)}${select('platformFilter', '全部平台', platformOptions, state.platform)}${sortSelect()}</div>
        </div>
        <div class="toolbar-sub-row">
          <div class="resource-total">共 <b>${rows.length}</b> 个资源${rows.length !== state.data.resources.records.length ? `<small> · 总计 ${state.data.resources.records.length}</small>` : ''}</div>
          <div class="toolbar-view-controls"><span class="sort-current">${esc(sortLabels[state.resourceSort] || '最近更新')}</span><div class="segmented"><button data-layout="grid" class="${state.layout === 'grid' ? 'active' : ''}">卡片视图</button><button data-layout="table" class="${state.layout === 'table' ? 'active' : ''}">列表视图</button></div></div>
        </div>
      </div>
      ${current.length ? `<div class="filter-summary">${current.map(x => `<span>${esc(x)}</span>`).join('')}<button class="text-btn" data-action="clear-all-filters">清除全部</button></div>` : ''}
      ${rows.length ? (state.layout === 'grid' ? `<div class="grid resource-grid">${pageRows.map(card).join('')}</div>` : table('resources', pageRows)) : emptyView('没有符合条件的资源', '调整筛选条件后再试。')}
      ${pagination}
    </div>`;
  };

  /* Keep the complete detail editor; only improve cover controls. */
  detailCoverEditor = function(r, schema) {
    const fieldName = role('cover', 'resources');
    const f = schema.find(x => x.field_name === fieldName) || schema.find(x => x.type === 17 && /(封面|图片|主图)/.test(x.field_name || ''));
    if (!f) return '';
    const v = r.fields[f.field_name];
    const tokens = (Array.isArray(v) ? v : []).filter(x => x?.file_token).map(x => ({file_token: String(x.file_token)}));
    const preview = coverImg(v, label(r), mediaContext(r));
    return `<div class="detail-cover-editor" data-attachment-field="${esc(f.field_name)}">
      <div class="detail-cover" data-upload-preview>${preview || '<div class="cover-empty-action">添加封面</div>'}<div class="cover-edit-badge">${preview ? '可更换、复制或清除封面' : '支持上传或粘贴图片'}</div></div>
      <div class="detail-cover-actions">
        <label class="btn primary-soft upload-btn"><span>更换封面</span><input type="file" accept="image/*" data-cover-upload="${esc(f.field_name)}" hidden></label>
        <button type="button" class="btn" data-action="paste-cover" data-field="${esc(f.field_name)}">粘贴图片</button>
        ${preview ? '<button type="button" class="btn" data-action="copy-cover-image">复制封面</button>' : ''}
        <button type="button" class="text-btn danger-text" data-action="clear-cover" data-field="${esc(f.field_name)}">清除</button>
      </div>
      <small class="cover-help">支持本地上传或复制图片后直接粘贴，保存时同步到飞书资源封面列。</small>
      <input type="hidden" name="${esc(f.field_name)}" value='${esc(JSON.stringify(tokens))}'>
    </div>`;
  };

  const baseRender = render;
  render = function() {
    baseRender();
    const total = state.data.resources.records.length;
    const totalEl = document.querySelector('[data-total-count]');
    if (totalEl) totalEl.textContent = String(total);
    document.querySelectorAll('[data-count]').forEach(el => {
      el.textContent = String(state.data.resources.records.filter(r => quickMatch(r, el.dataset.count)).length);
    });
    if (state.page === 'resources') {
      const breadcrumb = document.querySelector('.breadcrumb');
      if (breadcrumb) breadcrumb.innerHTML = `<div class="header-resource-title"><strong>资源库</strong><span id="headerResourceCount">共 ${total} 个资源</span></div>`;
    }
  };

  syncUI = function() {
    const syncText = state.demo
      ? '演示模式'
      : state.loading
        ? '正在同步…'
        : state.syncError
          ? '同步失败'
          : state.lastSync
            ? `已同步 · ${state.lastSync.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit', second: '2-digit'})}`
            : '等待同步';
    const sync = document.querySelector('#syncStatus');
    if (sync) sync.textContent = syncText;
    const side = document.querySelector('#sideStatus');
    if (side) side.textContent = state.demo ? '演示空间' : state.syncError ? '飞书连接异常' : state.lastSync ? '飞书已连接' : '正在连接飞书…';
    const refresh = document.querySelector('#refresh');
    if (refresh) refresh.disabled = state.loading || state.saving;
  };

  function copyDriveLink(button) {
    const text = button.dataset.copy || '';
    if (!text) return;
    const original = button.innerHTML;
    const done = () => {
      button.classList.add('copied');
      button.innerHTML = '<span class="copy-icon">✓</span><span class="copy-label">已复制</span>';
      setTimeout(() => { button.classList.remove('copied'); button.innerHTML = original; }, 1200);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => copyText(text, '链接'));
    } else {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); done(); } catch { notice('复制失败，请手动复制', true); }
      area.remove();
    }
  }

  async function blobToPng(blob) {
    if (blob.type === 'image/png') return blob;
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    return await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('图片转换失败')), 'image/png'));
  }

  async function copyImageFromButton(button) {
    const scope = button.closest('.card, #modal');
    const img = scope?.querySelector('img');
    if (!img) throw new Error('当前资源没有可复制的封面图片');
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('当前浏览器不支持直接复制图片，请使用最新版 Chrome 或 Edge');
    let response;
    if (img.dataset.feishuToken) {
      const q = new URLSearchParams({file_token: img.dataset.feishuToken, app_token: img.dataset.appToken || '', table_id: img.dataset.tableId || '', field_id: img.dataset.fieldId || '', record_id: img.dataset.recordId || ''});
      response = await fetch('/api/media?' + q);
    } else response = await fetch(img.currentSrc || img.src);
    if (!response.ok) throw new Error('封面读取失败');
    let blob = await response.blob();
    blob = await blobToPng(blob);
    await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
  }

  document.addEventListener('change', e => {
    if (e.target?.id !== 'sortFilter') return;
    state.resourceSort = e.target.value || 'updated';
    write('frm_resource_sort', state.resourceSort);
    state.pageNo = 1;
    render();
  }, true);

  document.addEventListener('click', async e => {
    const driveCopy = e.target.closest('[data-action="copy-drive-link"]');
    if (driveCopy) {
      e.preventDefault();
      e.stopPropagation();
      copyDriveLink(driveCopy);
      return;
    }
    const button = e.target.closest('[data-action="copy-cover-image"]');
    if (!button) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      button.disabled = true;
      await copyImageFromButton(button);
      notice('封面图片已复制');
    } catch (err) {
      notice(err.message || '复制图片失败', true);
    } finally {
      button.disabled = false;
    }
  }, true);

  const logo = document.querySelector('.brand .logo img');
  if (logo) logo.addEventListener('error', () => {
    logo.parentElement.innerHTML = '<span class="logo-fallback">▦</span>';
  }, {once: true});

  if (state.demo && state.data.resources.schema.length) render();
})();
