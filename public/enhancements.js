/* v10 personal resource library enhancements */
(() => {
  const cleanPlatform = value => String(value || '').replace(/✅|❌/g, '').trim();

  function cardTagHtml(tags) {
    const list = (tags || []).filter(Boolean);
    const shown = list.slice(0, 3);
    const more = list.length - shown.length;
    return `<div class="card-tags ${list.length ? '' : 'empty'}">${shown.map(t => `<span>${esc(t)}</span>`).join('')}${more > 0 ? `<span class="tag-more">+${more}</span>` : ''}</div>`;
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
        <div class="card-platforms ${pub.length ? '' : 'empty'}">${pub.map(x => `<span>${esc(x)}</span>`).join('')}</div>
        <div class="card-drive-actions ${linkRows ? '' : 'empty'}">${linkRows}</div>
      </div>
    </article>`;
  };

  /* Keep the original full resource detail form, only enrich its cover controls. */
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
        <label class="btn primary-soft upload-btn">更换封面<input type="file" accept="image/*" data-cover-upload="${esc(f.field_name)}" hidden></label>
        <button type="button" class="btn" data-action="paste-cover" data-field="${esc(f.field_name)}">粘贴图片</button>
        ${preview ? '<button type="button" class="btn" data-action="copy-cover-image">复制封面</button>' : ''}
        <button type="button" class="text-btn danger-text" data-action="clear-cover" data-field="${esc(f.field_name)}">清除</button>
      </div>
      <small class="cover-help">支持本地上传或复制图片后直接粘贴，保存时同步到飞书资源封面列。</small>
      <input type="hidden" name="${esc(f.field_name)}" value='${esc(JSON.stringify(tokens))}'>
    </div>`;
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
    const scope = button.closest('.card, #modal');
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

  if (state.demo && state.data.resources.schema.length) render();
})();
