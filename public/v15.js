/* v15 — platform quick filters + continuous resource list */
(() => {
  const sortLabelsV15 = {
    updated: '最近更新',
    created: '最近新增',
    number: '资源编号',
    name: '资源名称',
    coverFirst: '有封面优先',
    noCoverFirst: '无封面优先'
  };

  const normalizeTextV15 = value => String(value ?? '')
    .replace(/[\uFE0E\uFE0F]/g, '')
    .replace(/\s+/g, '')
    .trim();

  function platformFieldV15(key) {
    const schema = state.data.resources.schema || [];
    const exact = {
      xiaohongshu: ['🍠小红书', '🍠 小红书'],
      xianyu: ['🐟咸鱼', '🐟 咸鱼', '🐟闲鱼', '🐟 闲鱼'],
      twitter: ['✖︎ Twitter', '✖ Twitter', '✕ Twitter', '𝕏 Twitter', 'X Twitter', 'Twitter']
    }[key] || [];

    const exactNormalized = exact.map(normalizeTextV15);
    let field = schema.find(f => exactNormalized.includes(normalizeTextV15(f.field_name)));
    if (field) return field;

    field = schema.find(f => {
      const name = normalizeTextV15(f.field_name);
      if (key === 'xiaohongshu') return name.includes('小红书') && !/链接|网址|URL/i.test(name);
      if (key === 'xianyu') return (name.includes('咸鱼') || name.includes('闲鱼')) && !/链接|网址|URL/i.test(name);
      if (key === 'twitter') return /twitter/i.test(name) && !/链接|网址|URL/i.test(name);
      return false;
    });
    return field || null;
  }

  function isPublishedV15(r, key) {
    const field = platformFieldV15(key);
    if (!field) return false;
    const content = normalizeTextV15(raw(r.fields?.[field.field_name]));
    return content.includes(normalizeTextV15('🟢已发布'));
  }

  const previousQuickMatchV15 = quickMatch;
  quickMatch = function(r, key) {
    if (key === 'xiaohongshu' || key === 'xianyu' || key === 'twitter') {
      return isPublishedV15(r, key);
    }
    return previousQuickMatchV15(r, key);
  };

  const normalizeTimeV15 = value => {
    if (value == null || value === '') return 0;
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n;
    const d = Date.parse(String(value));
    return Number.isFinite(d) ? d : 0;
  };

  function updatedAtV15(r) {
    const field = role('updated', 'resources');
    return Math.max(
      normalizeTimeV15(field ? r.fields?.[field] : 0),
      normalizeTimeV15(r.last_modified_time),
      normalizeTimeV15(r.updated_time),
      normalizeTimeV15(r.modified_time)
    );
  }

  function createdAtV15(r) {
    return Math.max(
      normalizeTimeV15(r.created_time),
      normalizeTimeV15(r.create_time),
      normalizeTimeV15(r.created_at)
    );
  }

  function resourceNumberV15(r) {
    const mapped = String(value(r, 'number') || '').trim();
    if (mapped) return mapped;
    for (const [name, fieldValueRaw] of Object.entries(r.fields || {})) {
      const text = raw(fieldValueRaw).trim();
      if ((/资源.*编号|^编号$/i.test(name) || /^RES[-_\s]?\d+$/i.test(text)) && /^RES[-_\s]?\d+$/i.test(text)) return text;
    }
    return '';
  }

  function displayTitleV15(r) {
    let title = raw(fieldValue(r, 'title')).trim();
    if (!title) return '未命名资源';
    const number = resourceNumberV15(r);
    if (number) {
      const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      title = title.replace(new RegExp(`^${escaped}\\s*[-–—_:：]?\\s*`, 'i'), '').trim();
    }
    title = title.replace(/^RES[-_\s]?\d+\s*[-–—_:：]?\s*/i, '').trim();
    return title || '未命名资源';
  }

  function sortRowsV15(rows) {
    const mode = state.resourceSort || 'updated';
    const original = new Map(state.data.resources.records.map((r, i) => [r.record_id, i]));
    const fallback = (a, b) => (updatedAtV15(b) - updatedAtV15(a)) || ((original.get(a.record_id) || 0) - (original.get(b.record_id) || 0));
    return [...rows].sort((a, b) => {
      if (mode === 'created') return (createdAtV15(b) - createdAtV15(a)) || fallback(a, b);
      if (mode === 'number') return resourceNumberV15(a).localeCompare(resourceNumberV15(b), 'zh-CN', {numeric: true}) || fallback(a, b);
      if (mode === 'name') return displayTitleV15(a).localeCompare(displayTitleV15(b), 'zh-CN', {numeric: true}) || fallback(a, b);
      if (mode === 'coverFirst') return Number(hasCover(fieldValue(b, 'cover'))) - Number(hasCover(fieldValue(a, 'cover'))) || fallback(a, b);
      if (mode === 'noCoverFirst') return Number(hasCover(fieldValue(a, 'cover'))) - Number(hasCover(fieldValue(b, 'cover'))) || fallback(a, b);
      return fallback(a, b);
    });
  }

  function sortSelectV15() {
    return `<select id="sortFilter" aria-label="资源排序">${Object.entries(sortLabelsV15).map(([key, text]) => `<option value="${key}" ${state.resourceSort === key ? 'selected' : ''}>${text}</option>`).join('')}</select>`;
  }

  function emptyResultV15() {
    return `<div class="resource-empty-result panel">
      <div class="resource-empty-icon" aria-hidden="true">⌕</div>
      <h3>没有找到符合条件的资源</h3>
      <p>可以调整关键词或筛选条件后再试。</p>
      <button class="btn" type="button" data-action="clear-all-filters">清除筛选</button>
    </div>`;
  }

  resources = function() {
    const rows = sortRowsV15(filtered());
    const cats = categoryNames();
    state.pageNo = 1;

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

    return categoryBar + quick + `<div class="resource-content">
      <div class="resource-toolbar panel">
        <div class="toolbar-main-row">
          <div class="search-wrap"><span class="search-icon">⌕</span><input id="search" type="search" value="${esc(state.query)}" placeholder="搜索资源名称、编号、标签、描述、链接……"></div>
          <div class="toolbar-controls">
            ${select('statusFilter', '全部状态', statusOptions, state.status)}
            ${select('platformFilter', '全部平台', platformOptions, state.platform)}
            ${sortSelectV15()}
            <div class="segmented" aria-label="资源视图切换"><button data-layout="grid" class="${state.layout === 'grid' ? 'active' : ''}">卡片视图</button><button data-layout="table" class="${state.layout === 'table' ? 'active' : ''}">列表视图</button></div>
          </div>
        </div>
      </div>
      ${current.length ? `<div class="filter-summary">${current.map(x => `<span>${esc(x)}</span>`).join('')}<button class="text-btn" data-action="clear-all-filters">清除全部</button></div>` : ''}
      ${rows.length ? (state.layout === 'grid' ? `<div class="grid resource-grid">${rows.map(card).join('')}</div>` : table('resources', rows)) : (hasFilters ? emptyResultV15() : emptyView('资源库还没有内容', '点击右上角“新增资源”添加第一条资源。'))}
    </div>`;
  };

  if (state.page === 'resources' && state.data.resources.schema.length) render();
})();
