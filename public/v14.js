/* v14 — fine-grained resource library refinements */
(() => {
  const sortLabelsV14 = {
    updated: '最近更新',
    created: '最近新增',
    number: '资源编号',
    name: '资源名称',
    coverFirst: '有封面优先',
    noCoverFirst: '无封面优先'
  };

  const normalizeTimeV14 = value => {
    if (value == null || value === '') return 0;
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n;
    const d = Date.parse(String(value));
    return Number.isFinite(d) ? d : 0;
  };

  function updatedAtV14(r) {
    const field = role('updated', 'resources');
    return Math.max(
      normalizeTimeV14(field ? r.fields?.[field] : 0),
      normalizeTimeV14(r.last_modified_time),
      normalizeTimeV14(r.updated_time),
      normalizeTimeV14(r.modified_time)
    );
  }

  function createdAtV14(r) {
    return Math.max(
      normalizeTimeV14(r.created_time),
      normalizeTimeV14(r.create_time),
      normalizeTimeV14(r.created_at)
    );
  }

  function resourceNumberV14(r) {
    const mapped = String(value(r, 'number') || '').trim();
    if (mapped) return mapped;
    for (const [name, fieldValueRaw] of Object.entries(r.fields || {})) {
      const text = raw(fieldValueRaw).trim();
      if ((/资源.*编号|^编号$/i.test(name) || /^RES[-_\s]?\d+$/i.test(text)) && /^RES[-_\s]?\d+$/i.test(text)) return text;
    }
    const fallback = String(label(r) || '').trim();
    const match = fallback.match(/^RES[-_\s]?\d+/i);
    return match ? match[0] : '未编号';
  }

  const escapeRegExpV14 = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function resourceTitleV14(r) {
    let title = raw(fieldValue(r, 'title')).trim();
    if (!title) return '未命名资源';
    const number = resourceNumberV14(r);
    if (number && number !== '未编号') {
      title = title.replace(new RegExp(`^${escapeRegExpV14(number)}\\s*[-–—_:：]?\\s*`, 'i'), '').trim();
    }
    title = title.replace(/^RES[-_\s]?\d+\s*[-–—_:：]?\s*/i, '').trim();
    return title || '未命名资源';
  }

  function sortRowsV14(rows) {
    const mode = state.resourceSort || 'updated';
    const original = new Map(state.data.resources.records.map((r, i) => [r.record_id, i]));
    const fallback = (a, b) => (updatedAtV14(b) - updatedAtV14(a)) || ((original.get(a.record_id) || 0) - (original.get(b.record_id) || 0));
    return [...rows].sort((a, b) => {
      if (mode === 'created') return (createdAtV14(b) - createdAtV14(a)) || fallback(a, b);
      if (mode === 'number') return resourceNumberV14(a).localeCompare(resourceNumberV14(b), 'zh-CN', {numeric: true}) || fallback(a, b);
      if (mode === 'name') return resourceTitleV14(a).localeCompare(resourceTitleV14(b), 'zh-CN', {numeric: true}) || fallback(a, b);
      if (mode === 'coverFirst') return Number(hasCover(fieldValue(b, 'cover'))) - Number(hasCover(fieldValue(a, 'cover'))) || fallback(a, b);
      if (mode === 'noCoverFirst') return Number(hasCover(fieldValue(a, 'cover'))) - Number(hasCover(fieldValue(b, 'cover'))) || fallback(a, b);
      return fallback(a, b);
    });
  }

  function sortSelectV14() {
    return `<select id="sortFilter" aria-label="资源排序">${Object.entries(sortLabelsV14).map(([key, text]) => `<option value="${key}" ${state.resourceSort === key ? 'selected' : ''}>${text}</option>`).join('')}</select>`;
  }

  function cardTagsV14(tags) {
    const list = (tags || []).filter(Boolean);
    const shown = list.slice(0, 2);
    const more = list.length - shown.length;
    return `<div class="card-tags ${list.length ? '' : 'empty'}" ${list.length ? '' : 'aria-hidden="true"'}>${shown.map(t => `<span>${esc(t)}</span>`).join('')}${more > 0 ? `<span class="tag-more">+${more}</span>` : ''}</div>`;
  }

  function driveRowV14(name, url, kind) {
    if (!url) return '';
    return `<div class="drive-action-row ${kind}">
      <span class="drive-name">${esc(name)}</span>
      <div class="drive-row-actions">
        <a class="drive-open-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">打开 ↗</a>
        <button type="button" class="drive-copy-btn" data-action="copy-drive-link" data-copy="${esc(url)}" title="复制链接" aria-label="复制${esc(name)}链接" onclick="event.stopPropagation()"><span class="copy-icon">⧉</span><span class="copy-label">复制</span></button>
      </div>
    </div>`;
  }

  function placeholderCoverV14() {
    return `<div class="card-no-cover">
      <span class="placeholder-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" stroke="currentColor"/><circle cx="9" cy="10" r="1.6" fill="currentColor"/><path d="M5.5 17l4.3-4.2 3.1 2.8 2.4-2.1 3.2 3.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      <span>暂无封面</span>
    </div>`;
  }

  card = function(r) {
    const title = resourceTitleV14(r);
    const number = resourceNumberV14(r);
    const cover = coverImg(fieldValue(r, 'cover'), title, mediaContext(r));
    const tags = tagsOf(r);
    const links = resourceLinkMeta(r);
    const extraMain = links.main && ![links.quark, links.baidu].includes(links.main) ? links.main : '';
    const netdiskRows = [
      driveRowV14('夸克网盘', links.quark, 'quark'),
      driveRowV14('百度网盘', links.baidu, 'baidu')
    ].filter(Boolean).join('');
    const webRow = driveRowV14('网页链接', extraMain, 'web');
    const driveContent = `${netdiskRows || '<div class="drive-empty">暂无网盘链接</div>'}${webRow}`;
    const coverBlock = cover
      ? `<div class="cover">${cover}<div class="card-hover-actions"><button class="card-action copy-cover-action" data-action="copy-cover-image" title="复制封面图片" aria-label="复制封面图片">⧉</button></div></div>`
      : placeholderCoverV14();

    return `<article class="card ${cover ? 'has-cover' : 'no-cover'}" data-detail="${esc(r.record_id)}" data-kind="resources">
      ${coverBlock}
      <div class="card-body">
        <div class="card-number">${esc(number)}</div>
        <h3 title="${esc(title)}">${esc(title)}</h3>
        ${cardTagsV14(tags)}
        <div class="card-spacer" aria-hidden="true"></div>
        <div class="card-drive-actions">${driveContent}</div>
      </div>
    </article>`;
  };

  function emptyResultV14() {
    return `<div class="resource-empty-result panel">
      <div class="resource-empty-icon" aria-hidden="true">⌕</div>
      <h3>没有找到符合条件的资源</h3>
      <p>可以调整关键词或筛选条件后再试。</p>
      <button class="btn" type="button" data-action="clear-all-filters">清除筛选</button>
    </div>`;
  }

  function loadingSkeletonV14() {
    const cards = Array.from({length: 10}, () => `<div class="skeleton-card"><div class="skeleton-cover shimmer"></div><div class="skeleton-card-body"><span class="skeleton-line tiny shimmer"></span><span class="skeleton-line title shimmer"></span><span class="skeleton-line tags shimmer"></span><span class="skeleton-line action shimmer"></span><span class="skeleton-line action shimmer"></span></div></div>`).join('');
    return `<div class="resource-loading-shell">
      <div class="skeleton-category panel"><span class="skeleton-pill shimmer"></span><span class="skeleton-pill shimmer"></span><span class="skeleton-pill shimmer"></span><span class="skeleton-pill shimmer"></span></div>
      <div class="skeleton-toolbar panel"><span class="skeleton-search shimmer"></span><span class="skeleton-select shimmer"></span><span class="skeleton-select shimmer"></span><span class="skeleton-select shimmer"></span></div>
      <div class="resource-grid skeleton-grid">${cards}</div>
    </div>`;
  }

  function showSkeletonV14() {
    const view = document.querySelector('#view');
    if (view && state.page === 'resources' && !state.data.resources.records.length) view.innerHTML = loadingSkeletonV14();
  }

  resources = function() {
    const rows = sortRowsV14(filtered());
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
    const hasFilters = Boolean(state.query || state.status || state.platform || state.category || state.quickFilter || state.smartFilter || state.tag);
    const totalPages = Math.max(1, Math.ceil(rows.length / 25));
    const pagination = totalPages > 1 ? `<div class="pagination"><span>第 ${state.pageNo} / ${totalPages} 页</span><button class="btn" data-turn="-1" ${state.pageNo <= 1 ? 'disabled' : ''}>上一页</button><button class="btn" data-turn="1" ${state.pageNo * 25 >= rows.length ? 'disabled' : ''}>下一页</button></div>` : '';

    return categoryBar + quick + `<div class="resource-content">
      <div class="resource-toolbar panel">
        <div class="toolbar-main-row">
          <div class="search-wrap"><span class="search-icon">⌕</span><input id="search" type="search" value="${esc(state.query)}" placeholder="搜索资源名称、编号、标签、描述、链接……"></div>
          <div class="toolbar-controls">
            ${select('statusFilter', '全部状态', statusOptions, state.status)}
            ${select('platformFilter', '全部平台', platformOptions, state.platform)}
            ${sortSelectV14()}
            <div class="segmented" aria-label="资源视图切换"><button data-layout="grid" class="${state.layout === 'grid' ? 'active' : ''}">卡片视图</button><button data-layout="table" class="${state.layout === 'table' ? 'active' : ''}">列表视图</button></div>
          </div>
        </div>
      </div>
      ${current.length ? `<div class="filter-summary">${current.map(x => `<span>${esc(x)}</span>`).join('')}<button class="text-btn" data-action="clear-all-filters">清除全部</button></div>` : ''}
      ${rows.length ? (state.layout === 'grid' ? `<div class="grid resource-grid">${pageRows.map(card).join('')}</div>` : table('resources', pageRows)) : (hasFilters ? emptyResultV14() : emptyView('资源库还没有内容', '点击右上角“新增资源”添加第一条资源。'))}
      ${pagination}
    </div>`;
  };

  let refreshResetTimerV14 = null;
  let lastSuccessStampV14 = 0;
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
    if (!refresh) return;
    refresh.disabled = state.loading || state.saving;
    if (state.loading) {
      clearTimeout(refreshResetTimerV14);
      refresh.removeAttribute('data-success');
      refresh.classList.add('is-loading');
      refresh.innerHTML = '<span class="sync-spinner" aria-hidden="true"></span><span>同步中</span>';
      return;
    }
    refresh.classList.remove('is-loading');
    const stamp = state.lastSync instanceof Date ? state.lastSync.getTime() : 0;
    if (stamp && stamp !== lastSuccessStampV14) {
      lastSuccessStampV14 = stamp;
      refresh.dataset.success = '1';
      refresh.innerHTML = '<span aria-hidden="true">✓</span><span>同步成功</span>';
      clearTimeout(refreshResetTimerV14);
      refreshResetTimerV14 = setTimeout(() => {
        if (!state.loading && refresh.isConnected) {
          refresh.removeAttribute('data-success');
          refresh.innerHTML = '<span aria-hidden="true">↻</span><span>同步</span>';
        }
      }, 1400);
    } else if (!refresh.dataset.success) {
      refresh.innerHTML = '<span aria-hidden="true">↻</span><span>同步</span>';
    }
  };

  const baseLoadV14 = load;
  load = async function(...args) {
    if (!state.demo && state.page === 'resources' && !state.data.resources.records.length) showSkeletonV14();
    return baseLoadV14(...args);
  };

  const baseRenderV14 = render;
  render = function() {
    baseRenderV14();
    if (state.loading && state.page === 'resources' && !state.data.resources.records.length) showSkeletonV14();
  };

  /* Explicitly keep card actions independent from the card detail click. */
  document.addEventListener('click', e => {
    if (e.target.closest('.drive-open-link,.drive-copy-btn,.card-action')) e.stopPropagation();
  });

  if (state.loading && state.page === 'resources' && !state.data.resources.records.length) showSkeletonV14();
})();