/* v9 personal resource library enhancements */
(() => {
  const cleanPlatform = value => String(value || '').replace(/✅|❌/g, '').trim();

  function cardTagHtml(tags) {
    if (!tags.length) return '';
    const shown = tags.slice(0, 3);
    const more = tags.length - shown.length;
    return `<div class="card-tags">${shown.map(t => `<span>${esc(t)}</span>`).join('')}${more > 0 ? `<span class="tag-more">+${more}</span>` : ''}</div>`;
  }

  function driveActionRow(name, url, kind) {
    if (!url) return '';
    return `<div class="drive-action-row ${kind}">
      <a class="drive-open-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(name)} <span>↗</span></a>
      <button type="button" class="drive-copy-btn" data-action="copy-text" data-copy="${esc(url)}" data-label="${esc(name)}链接">复制</button>
    </div>`;
  }

  card = function(r) {
    const cover = coverImg(fieldValue(r, 'cover'), label(r), mediaContext(r));
    const cat = value(r, 'category') || '';
    const num = value(r, 'number') || '';
    const tags = tagsOf(r);
    const links = resourceLinkMeta(r);
    const pub = publicationValues(r).filter(Boolean).slice(0, 3).map(cleanPlatform);
    const extraMain = links.main && ![links.quark, links.baidu].includes(links.main) ? links.main : '';
    const coverBlock = cover
      ? `<div class="cover" data-detail="${esc(r.record_id)}" data-kind="resources">
          ${cover}
          <div class="card-hover-actions">
            <button class="card-action copy-cover-action" data-action="copy-cover-image" title="复制封面图片" aria-label="复制封面图片">⧉</button>
          </div>
        </div>`
      : `<div class="card-no-cover" data-detail="${esc(r.record_id)}" data-kind="resources"><span>暂无封面</span></div>`;

    const linkRows = [
      driveActionRow('夸克网盘', links.quark, 'quark'),
      driveActionRow('百度网盘', links.baidu, 'baidu'),
      driveActionRow('网页链接', extraMain, 'web')
    ].filter(Boolean).join('');

    return `<article class="card ${cover ? 'has-cover' : 'no-cover'}">
      ${coverBlock}
      <div class="card-body">
        <div class="card-topline">${cat ? `<span class="card-category">${esc(cat)}</span>` : '<span></span>'}${num ? `<span class="card-number">${esc(num)}</span>` : ''}</div>
        <h3 data-detail="${esc(r.record_id)}" data-kind="resources">${esc(label(r))}</h3>
        ${cardTagHtml(tags)}
        ${pub.length ? `<div class="card-platforms">${pub.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
        ${linkRows ? `<div class="card-drive-actions">${linkRows}</div>` : ''}
      </div>
    </article>`;
  };

  function detailInfo(labelText, valueText) {
    if (!String(valueText || '').trim()) return '';
    return `<div class="detail-info-item"><span>${esc(labelText)}</span><b>${esc(valueText)}</b></div>`;
  }

  function detailChipSection(title, values, cls = '') {
    const list = (values || []).filter(Boolean);
    if (!list.length) return '';
    return `<section class="resource-detail-section ${cls}"><h3>${esc(title)}</h3><div class="detail-chip-list">${list.map(v => `<span>${esc(cleanPlatform(v))}</span>`).join('')}</div></section>`;
  }

  function detailLinkRows(r) {
    const links = resourceLinkMeta(r);
    const extraMain = links.main && ![links.quark, links.baidu].includes(links.main) ? links.main : '';
    const rows = [
      ['夸克网盘', links.quark, 'quark'],
      ['百度网盘', links.baidu, 'baidu'],
      ['网页链接', extraMain, 'web']
    ].filter(([, url]) => url);
    if (!rows.length) return '';
    return `<section class="resource-detail-section detail-links-section"><h3>资源链接</h3><div class="detail-link-cards">${rows.map(([name, url, kind]) => `
      <div class="detail-link-card ${kind}">
        <div><b>${esc(name)}</b><small>${esc(url)}</small></div>
        <div class="detail-link-actions">
          <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">打开链接 ↗</a>
          <button type="button" data-action="copy-text" data-copy="${esc(url)}" data-label="${esc(name)}链接">复制</button>
        </div>
      </div>`).join('')}</div></section>`;
  }

  detail = function(kind, id) {
    const r = state.data[kind].records.find(x => x.record_id === id);
    if (!r) return;
    if (kind !== 'resources') {
      state.editor = {kind, id, view: true};
      modal(`<div class="modalHead"><div><span class="eyebrow">${esc(names[kind] || kind)}</span><h2 id="modalTitle">${esc(label(r, kind))}</h2></div><button class="icon" data-action="close">×</button></div><div class="modalBody"><div class="details">${state.data[kind].schema.map(f => {const v=r.fields[f.field_name];if(v==null||raw(v)==='')return '';const url=safeUrl(v);return `<div class="detailBox"><h3>${esc(f.field_name)}</h3><div>${url?`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(raw(v))} ↗</a>`:esc(display(v,f))}</div></div>`}).join('')}</div></div><div class="modalActions"><button class="btn danger" data-action="delete" data-kind="${kind}" data-id="${esc(id)}">删除</button><button class="btn primary" data-action="edit" data-kind="${kind}" data-id="${esc(id)}">编辑记录</button></div>`);
      return;
    }

    addRecent(id);
    state.editor = {kind: 'resources', id, view: true};
    const cover = coverImg(fieldValue(r, 'cover'), label(r), mediaContext(r));
    const num = value(r, 'number') || '';
    const category = value(r, 'category') || '';
    const tags = tagsOf(r);
    const description = value(r, 'description') || '';
    const pub = publicationValues(r).filter(Boolean);
    const lf = linkStatusField();
    const linkStates = lf ? splitValues(r.fields?.[lf.field_name]) : [];
    const status = value(r, 'status') || '';

    modal(`<div class="resource-detail-view">
      <div class="modalHead resource-detail-head">
        <div><span class="eyebrow">资源详情</span><h2 id="modalTitle">${esc(label(r))}</h2></div>
        <button class="icon" data-action="close">×</button>
      </div>
      <div class="modalBody resource-detail-body">
        <aside class="resource-detail-cover-panel">
          <div class="resource-detail-cover">${cover || '<div class="detail-cover-empty">暂无封面</div>'}</div>
          ${cover ? `<button class="btn copy-detail-cover" type="button" data-action="copy-cover-image">⧉ 复制封面图片</button>` : ''}
        </aside>
        <div class="resource-detail-main">
          <div class="detail-info-grid">
            ${detailInfo('资源编号', num)}
            ${detailInfo('资源分类', category)}
            ${detailInfo('资源状态', status)}
          </div>
          ${detailChipSection('标签', tags, 'tags-section')}
          ${detailChipSection('发布状态', pub, 'publish-section')}
          ${detailChipSection('网盘状态', linkStates, 'link-status-section')}
          ${detailLinkRows(r)}
          ${description ? `<section class="resource-detail-section detail-description"><h3>资源简介</h3><p>${esc(description)}</p></section>` : ''}
        </div>
      </div>
      <div class="modalActions resource-detail-actions">
        <button class="btn danger" data-action="delete" data-kind="resources" data-id="${esc(id)}">删除</button>
        <span class="detail-action-spacer"></span>
        <button class="btn" data-action="close">关闭</button>
        <button class="btn primary" data-action="edit" data-kind="resources" data-id="${esc(id)}">编辑信息</button>
      </div>
    </div>`);
    hydrateImages().catch(() => {});
  };

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
    const scope = button.closest('.card, .resource-detail-view');
    const img = scope?.querySelector('img');
    if (!img) throw new Error('当前资源没有可复制的封面图片');
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('当前浏览器不支持直接复制图片，请使用最新版 Chrome 或 Edge');

    let response;
    if (img.dataset.feishuToken) {
      const q = new URLSearchParams({
        file_token: img.dataset.feishuToken,
        app_token: img.dataset.appToken || '',
        table_id: img.dataset.tableId || '',
        field_id: img.dataset.fieldId || '',
        record_id: img.dataset.recordId || ''
      });
      response = await fetch('/api/media?' + q);
    } else {
      response = await fetch(img.currentSrc || img.src);
    }
    if (!response.ok) throw new Error('封面读取失败');
    let blob = await response.blob();
    blob = await blobToPng(blob);
    await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
  }

  document.addEventListener('click', async e => {
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

  /* Bootstrap is async, so these overrides are installed before its first render in normal Worker mode. */
  if (state.demo && state.data.resources.schema.length) render();
})();
