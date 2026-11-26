const contentKey = 'lamsa-custom-content-v2';
const catalogLists = {categories, products, banners};
try {
  const saved = JSON.parse(localStorage.getItem(contentKey));
  const previous = saved ? null : JSON.parse(localStorage.getItem('lamsa-custom-content-v1'));
  for (const [kind, list] of Object.entries(catalogLists)) {
    if (Array.isArray(saved?.[kind])) list.splice(0, list.length, ...saved[kind]);
    else if (Array.isArray(previous?.[kind])) list.push(...previous[kind]);
  }
} catch {
  // The bundled catalog is available when browser storage cannot be read.
}
const managementLabels = {categories:'الأقسام', products:'المنتجات', banners:'أشرطة الإعلانات'};
const imageTypes = 'image/jpeg,image/png,image/webp,image/avif';

function managementPage(param = '') {
  if (!previewAsManager) return '<h1>لوحة الإدارة</h1><a href="#home">الرئيسية</a>';
  const [kind, edit] = param.split(':');
  if (Object.hasOwn(managementLabels,kind)) return catalogManagement(kind,edit);
  const pending = state.orders.filter(order => !['delivered','cancelled'].includes(order.status)).length;
  const tiles = [
    ['manage/categories','الأقسام',categories.length + ' قسم'],
    ['manage/products','المنتجات',products.length + ' منتج'],
    ['manage/banners','أشرطة الإعلانات',banners.length + ' إعلان'],
    ['orders','الطلبات',pending + ' طلب قيد المتابعة'],
    ['settings','إعدادات المتجر','الاسم والتواصل والتوصيل']
  ];
  const preview = new URL(location.href);
  preview.searchParams.set('view','customer');
  preview.hash = 'home';
  return `<section class="admin-dashboard"><div class="row admin-heading"><h1>لوحة إدارة ${escape(state.settings.name)}</h1>
    <a class="button secondary" href="${escape(preview.href)}" target="_blank" rel="noopener">معاينة المتجر</a></div>
    <h2>نظرة عامة</h2><div class="admin-grid">${tiles.map(([path,title,summary]) =>
      `<a class="panel admin-tile" href="#${path}"><strong>${title}</strong><span>${summary}</span></a>`
    ).join('')}</div><p class="muted">البيانات التجريبية محفوظة في هذا المتصفح.</p></section>`;
}

function categoryOptions(selected = '', placeholder = '') {
  return placeholder + categories.map(([id,name]) =>
    `<option value="${id}"${selected === id ? ' selected' : ''}>${escape(name)}</option>`
  ).join('');
}

function catalogManagement(kind, edit) {
  const list = catalogLists[kind];
  const index = kind === 'banners' ? Number(edit) : list.findIndex(item => (item.id || item[0]) === edit);
  const item = edit === undefined || edit === 'new' ? undefined : list[index];
  const base = '#manage/' + kind;
  const heading = `<a class="button secondary" href="#manage">‹ لوحة الإدارة</a><h1>${managementLabels[kind]}</h1>`;
  if (edit !== undefined) {
    if (edit !== 'new' && !item) return heading + '<p>العنصر غير موجود.</p>';
    return heading + catalogForm(kind,item,index);
  }
  const filter = kind === 'products' ? `<div class="admin-filters"><label>بحث المنتج<input id="admin-search" type="search"></label>
    <label>القسم<select id="admin-category-filter">${categoryOptions('', '<option value="">كل الأقسام</option>')}</select></label></div>` : '';
  return heading + `<a class="button" href="${base}:new">إضافة ${{categories:'قسم',products:'منتج',banners:'إعلان'}[kind]}</a>` + filter +
    '<div id="admin-list">' + catalogRows(kind) + '</div>';
}

function catalogRows(kind, query = '', category = '') {
  const list = catalogLists[kind];
  const rows = list.map((item,index) => {
    const isCategory = kind === 'categories';
    const id = isCategory ? item[0] : item.id ?? index;
    const name = isCategory ? item[1] : item.name ?? item.title;
    if (!name.includes(query) || (category && item.category !== category)) return '';
    const image = isCategory ? item[2] || id : item.image;
    const summary = kind === 'products' ? money(item.price) + ' · ' + (item.stock == null ? 'الكمية غير محددة' : 'الكمية ' + format.format(availableStock(item)))
      : kind === 'banners' ? 'الترتيب ' + format.format(index + 1) : '';
    const moves = kind === 'products' ? '' : `
      <button class="secondary" type="button" data-move="${kind}/${index}/-1" aria-label="تحريك للأعلى" ${index === 0 ? 'disabled' : ''}>↑</button>
      <button class="secondary" type="button" data-move="${kind}/${index}/1" aria-label="تحريك للأسفل" ${index === list.length - 1 ? 'disabled' : ''}>↓</button>`;
    return `<article class="panel row admin-row">${photo(image,'','thumb')}<div class="grow"><strong>${escape(name)}</strong>
      <div class="muted">${summary}</div></div><div class="admin-actions">
      <a class="button secondary" href="#manage/${kind}:${id}">تعديل</a>${moves}</div></article>`;
  }).join('');
  return rows || '<p class="panel">ماكو عناصر للعرض.</p>';
}

function catalogForm(kind, item, index) {
  const isCategory = kind === 'categories';
  const isBanner = kind === 'banners';
  const name = isCategory ? item?.[1] : item?.name ?? item?.title;
  const image = isCategory ? item?.[2] || item?.[0] : item?.image;
  const selected = isBanner ? item?.route.split('/')[1] : item?.category;
  const category = isCategory ? '' : `<label>القسم<select name="category" required>${categoryOptions(selected,
    '<option value="">اختار القسم</option>')}</select></label>`;
  const extra = isCategory ? '' : isBanner ? `<label>نص زر الإعلان<input name="copy" maxlength="40" required value="${escape(item?.copy || '')}"></label>` :
    `<label>السعر بالدينار العراقي<input name="price" type="number" min="1" max="1000000000" value="${item?.price ?? ''}" required></label>
    <label>الكمية المتوفرة<input name="stock" type="number" min="0" max="1000000" value="${item?.stock == null ? '' : availableStock(item)}" required></label>
    <label>الباركود<input name="barcode" dir="ltr" autocomplete="off" maxlength="128" value="${escape(item?.barcode || '')}"></label>
    <button class="secondary" type="button" data-scan-barcode>مسح الباركود بالكاميرا</button>
    <p data-barcode-status role="status" class="muted" hidden></p>
    <div data-barcode-camera hidden>
      <video muted playsinline aria-label="معاينة كاميرا الباركود" style="width:100%;max-height:240px"></video>
      <button class="secondary" type="button" data-stop-barcode>إغلاق الكاميرا</button>
    </div>
    <label>تاريخ انتهاء الصلاحية<input name="expiry" type="date" value="${escape(item?.expiry || '')}"></label>
    <label>الوصف<textarea name="description" maxlength="600">${escape(item?.description || '')}</textarea></label>
    <label>صور إضافية للمنتج <small>اختياري، حتى 3 صور</small><input type="file" name="gallery" accept="${imageTypes}" multiple></label>
    ${item?.gallery?.length ? `<small>${item.gallery.length} صور إضافية محفوظة. اختيار صور جديدة يستبدلها.</small>` : ''}`;
  return `<form class="panel narrow" data-content="${kind}" data-index="${item ? index : ''}">
    <h2>${item ? 'تعديل' : 'إضافة'}</h2>
    <label>${isBanner ? 'عنوان الإعلان' : 'الاسم'}<input name="name" maxlength="80" required value="${escape(name || '')}"></label>
    ${category}${extra}${image ? photo(image,'الصورة الحالية','thumb') : ''}
    <label>${image ? 'استبدال الصورة' : 'الصورة الرئيسية'}<input name="image" type="file" accept="${imageTypes}" ${item ? '' : 'required'}></label>
    <div class="chips"><button type="submit">حفظ</button><a class="button secondary" href="#manage/${kind}">إلغاء</a></div></form>`;
}

function persistCatalog(kind, next) {
  const current = catalogLists[kind];
  localStorage.setItem(contentKey, JSON.stringify({...catalogLists,[kind]:next}));
  current.splice(0,current.length,...next);
}

function moveCatalogItem(value) {
  if (!previewAsManager) return;
  const [kind, rawIndex, rawDelta] = value.split('/');
  if (!['categories','banners'].includes(kind)) return;
  const index = Number(rawIndex), target = index + Number(rawDelta);
  const next = [...catalogLists[kind]];
  if (!next[index] || !next[target]) return;
  [next[index],next[target]] = [next[target],next[index]];
  try { persistCatalog(kind,next); }
  catch { notify('تعذّر حفظ الترتيب.'); return; }
  render();
}
async function readCatalogImage(file) {
  const allowed = ['image/jpeg','image/png','image/webp','image/avif'];
  if (!allowed.includes(file?.type) || file.size > 10000000) {
    throw new Error('اختار صورة JPG أو PNG أو WebP أو AVIF بحجم أقصى 10 MB.');
  }
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('تعذّر فتح الصورة. اختار صورة ثانية.'); }
  try {
    const scale = Math.min(1,1000 / Math.max(bitmap.width,bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1,Math.round(bitmap.width * scale));
    canvas.height = Math.max(1,Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/webp',0.82);
  } finally {
    bitmap.close();
  }
}

async function saveCatalogItem(form, data) {
  if (!previewAsManager) return;
  const kind = form.dataset.content;
  const index = form.dataset.index === '' ? -1 : Number(form.dataset.index);
  const list = catalogLists[kind];
  const previous = list[index];
  const name = data.get('name').trim();
  const category = data.get('category');
  const copy = data.get('copy')?.trim();
  if (!name || (kind === 'banners' && !copy)) {
    notify('اكتب الاسم والبيانات المطلوبة.');
    return;
  }
  const button = form.querySelector('button[type=submit]');
  if (button.disabled) return;
  button.disabled = true;
  try {
    const file = data.get('image');
    const isCategory = kind === 'categories';
    const image = file?.size ? await readCatalogImage(file)
      : isCategory ? previous?.[2] || previous?.[0] : previous?.image;
    if (!image) throw new Error('اختار صورة رئيسية.');
    const id = 'custom-' + crypto.randomUUID();
    let item;
    if (isCategory) {
      item = [previous?.[0] || id,name,image];
    } else if (kind === 'products') {
      const files = data.getAll('gallery').filter(file => file.size);
      if (files.length > 3) throw new Error('اختار 3 صور إضافية كحد أقصى.');
      const gallery = files.length ? await Promise.all(files.map(readCatalogImage)) : previous?.gallery;
      item = {...previous,id:previous?.id || id,name,category,image,gallery,price:Number(data.get('price')),
        stock:Number(data.get('stock')) + soldQuantity(previous?.id),description:data.get('description').trim(),
        barcode:data.get('barcode')?.trim() || '',expiry:data.get('expiry') || ''};
      if (file?.size) delete item.detail;
    } else {
      item = {title:name,copy,image,route:'shop/' + category};
    }
    const next = [...list];
    if (previous && list[index] !== previous) throw new Error('تغيّر ترتيب العناصر. افتح العنصر من جديد.');
    if (previous) next[index] = item;
    else next.push(item);
    try { persistCatalog(kind,next); }
    catch { throw new Error('تعذّر الحفظ في المتصفح. جرّب صور بحجم أصغر.'); }
    if (form.isConnected) location.hash = 'manage/' + kind;
    notify('تم الحفظ');
  } catch (error) {
    notify(error.message || 'تعذّر الحفظ.');
  } finally {
    button.disabled = false;
  }
}

let stopProductBarcodeScan;

async function scanProductBarcode(form) {
  if (!previewAsManager || form.dataset.content !== 'products' || stopProductBarcodeScan) return;
  const input = form.elements.barcode;
  const status = form.querySelector('[data-barcode-status]');
  const camera = form.querySelector('[data-barcode-camera]');
  const video = camera.querySelector('video');
  const show = message => {
    status.hidden = false;
    status.textContent = message;
  };
  if (!window.BarcodeDetector || !navigator.mediaDevices?.getUserMedia) {
    show('المسح بالكاميرا غير متاح بهالمتصفح. تگدر تكتب الباركود أو تستخدم قارئ باركود خارجي.');
    input.focus();
    return;
  }

  let stream;
  let active = true;
  let scanTimer;
  function stop() {
    active = false;
    clearTimeout(scanTimer);
    stream?.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    camera.hidden = true;
    status.hidden = true;
    if (stopProductBarcodeScan === stop) stopProductBarcodeScan = undefined;
  }
  stopProductBarcodeScan = stop;

  try {
    camera.hidden = false;
    show('انتظر إذن الكاميرا…');
    const detector = new BarcodeDetector();
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    if (!active || !form.isConnected) { stop(); return; }
    video.srcObject = stream;
    await video.play();
    if (!active || !form.isConnected) { stop(); return; }
    show('قرّب الباركود للكاميرا وخليه واضح.');
    async function readFrame() {
      if (!active || !form.isConnected) { stop(); return; }
      try {
        const codes = await detector.detect(video);
        if (!active || !form.isConnected) { stop(); return; }
        const value = codes.find(code => code.rawValue && code.rawValue.length <= input.maxLength)?.rawValue;
        if (value) {
          input.value = value;
          stop();
          show('تمت قراءة الباركود.');
          input.focus();
          return;
        }
        scanTimer = setTimeout(readFrame,180);
      } catch {
        if (!active) return;
        stop();
        show('تعذّرت قراءة الباركود. جرّب الإضاءة أو اكتبه يدوياً.');
      }
    }
    await readFrame();
  } catch (error) {
    if (!active) return;
    stop();
    show(error.name === 'NotAllowedError' ? 'اسمح للمتصفح باستخدام الكاميرا أو اكتب الباركود يدوياً.'
      : 'تعذّر فتح الكاميرا. تگدر تكتب الباركود يدوياً.');
  }
}
