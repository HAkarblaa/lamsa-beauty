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
  const low = products.filter(p => productAlerts(p).includes('low')).length;
  const expiry = products.filter(p => productAlerts(p).includes('expiry')).length;
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
    <h2>نظرة عامة</h2><div class="chips">
    <a class="button secondary" href="#manage/products:low"><span>مخزون قليل</span> · ${low}</a>
    <a class="button secondary" href="#expiry-notifications"><span>تنبيه الصلاحية</span> · ${expiry}</a>
    </div><div class="admin-grid">${tiles.map(([path,title,summary]) =>
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
  const copyId = kind === 'products' && edit?.startsWith('copy-') ? edit.slice(5) : '';
  const index = kind === 'banners' ? Number(edit) : list.findIndex(item => (item.id || item[0]) === edit);
  const item = edit === undefined || edit === 'new' ? undefined : list[index];
  const base = '#manage/' + kind;
  const heading = `<a class="button secondary" href="#manage">‹ لوحة الإدارة</a><h1>${managementLabels[kind]}</h1>`;
  const alert = kind === 'products' && ['low','expiry','soon','expired'].includes(edit) ? edit : '';
  if (copyId) {
    const source = products.find(product => product.id === copyId);
    if (!source) return heading + '<p>العنصر غير موجود.</p>';
    const draft = {...source,id:'',barcode:'',expiry:'',stock:0,hidden:true,
      variants:source.variants?.map(variant => ({...variant,stock:0}))};
    return heading + '<a class="button secondary" href="#manage/products">رجوع</a>' + catalogForm(kind,draft,-1,copyId);
  }
  if (edit !== undefined && !alert) {
    if (edit !== 'new' && !item) return heading + '<p>العنصر غير موجود.</p>';
    return heading + '<a class="button secondary" href="' + base + '">رجوع</a>' + catalogForm(kind,item,index);
  }
  const filter = kind === 'products' ? `<div class="admin-filters"><label>بحث بالاسم أو الباركود<input id="admin-search" type="search"></label>
    <label>القسم<select id="admin-category-filter">${categoryOptions('', '<option value="">كل الأقسام</option>')}</select></label>
    <label>البراند<select id="admin-brand"><option value="">كل البراندات</option>${brandOptions(products)}</select></label>
    <label>تنبيهات المنتجات<select id="admin-alert"><option value="">كل المنتجات</option>
    <option value="low"${alert === 'low' ? ' selected' : ''}>مخزون قليل</option>
    <option value="expiry"${alert === 'expiry' ? ' selected' : ''}>تنبيه الصلاحية</option>
    <option value="soon"${alert === 'soon' ? ' selected' : ''}>قريب من انتهاء الصلاحية</option>
    <option value="expired"${alert === 'expired' ? ' selected' : ''}>منتهي الصلاحية</option></select></label></div>` : '';
  return heading + `<a class="button" href="${base}:new">إضافة ${{categories:'قسم',products:'منتج',banners:'إعلان'}[kind]}</a>` + filter +
    '<div id="admin-list">' + catalogRows(kind,'','',alert) + '</div>';
}

function catalogRows(kind, query = '', category = '', alert = '', brand = '') {
  const list = catalogLists[kind];
  const rows = list.map((item,index) => {
    const isCategory = kind === 'categories';
    const id = isCategory ? item[0] : item.id ?? index;
    const name = isCategory ? item[1] : item.name ?? item.title;
    const terms = kind === 'products' ? [name,item.nameEn,item.barcode,translate(name)] : [name];
    if (!terms.some(value => value?.toLowerCase().includes(query.toLowerCase())) ||
      (category && item.category !== category) || (brand && brandKey(item.brand) !== brand) ||
      (alert && !productAlerts(item).includes(alert) && expiryStatus(item.expiry) !== alert)) return '';
    const image = isCategory ? item[2] || id : item.image;
    const summary = kind === 'products' ? money(item.price) + ' · ' + (Number.isFinite(availableStock(item)) ? 'الكمية ' + format.format(availableStock(item)) : 'الكمية غير محددة')
      : kind === 'banners' ? 'الترتيب ' + format.format(index + 1) : '';
    const moves = kind === 'products' ? '' : `
      <button class="secondary" type="button" data-move="${kind}/${index}/-1" aria-label="تحريك للأعلى" ${index === 0 ? 'disabled' : ''}>↑</button>
      <button class="secondary" type="button" data-move="${kind}/${index}/1" aria-label="تحريك للأسفل" ${index === list.length - 1 ? 'disabled' : ''}>↓</button>`;
    return `<article class="panel row admin-row">${photo(image,'','thumb')}<div class="grow"><strong>${escape(name)}</strong>
      <div class="muted">${summary}</div>
      ${kind === 'products' ? `<small>${item.hidden ? 'مخفي' : 'ظاهر'}${item.barcode ? ' · ' + escape(item.barcode) : ''}</small>
        ${item.brand ? `<div class="muted">${escape(item.brand)}</div>` : ''}
        ${productAlerts(item).includes('low') ? '<div class="muted">مخزون قليل</div>' : ''}
        ${item.purchaseCost == null ? '' : `<div><span>كلفة الشراء</span> · ${money(item.purchaseCost)}</div>`}
        ${expiryBadge(item)}` : ''}
      </div><div class="admin-actions">
      <a class="button secondary" href="#manage/${kind}:${id}">${['soon','expired'].includes(alert) ? 'تعديل الصلاحية' : 'تعديل'}</a>
      ${kind === 'products' ? `<a class="button secondary" href="#manage/products:copy-${id}">نسخ المنتج</a>` : ''}
      ${kind === 'products' && ['soon','expired'].includes(alert) ? `<button type="button" class="secondary" data-expiry-hide="${id}">${item.hidden ? 'إظهار المنتج' : 'إخفاء المنتج'}</button>` : ''}${moves}</div></article>`;
  }).join('');
  return rows || '<p class="panel">ماكو عناصر للعرض.</p>';
}

function catalogForm(kind, item, index, copyId = '') {
  const isCategory = kind === 'categories';
  const isBanner = kind === 'banners';
  const name = isCategory ? item?.[1] : item?.name ?? item?.title;
  const image = isCategory ? item?.[2] || item?.[0] : item?.image;
  const selected = isBanner ? item?.route.split('/')[1] : item?.category;
  const category = isCategory ? '' : `<label>القسم<select name="category" required>${categoryOptions(selected,
    '<option value="">اختار القسم</option>')}</select></label>`;
  const extra = isCategory ? '' : isBanner ? `<label>نص زر الإعلان<input name="copy" maxlength="40" required value="${escape(item?.copy || '')}"></label>` :
    `<label>سعر البيع للزبون بالدينار العراقي<input name="price" type="number" min="1" max="1000000000" value="${item?.price ?? ''}" required></label>
    <label>كلفة شراء المنتج للأدمن بالدينار العراقي<input name="purchaseCost" type="number" min="0" max="1000000000" value="${item?.purchaseCost ?? ''}"></label>
    <label>الكمية المتوفرة<input name="stock" type="number" min="0" max="1000000" value="${item?.stock == null ? '' : availableStock(item)}"></label>
    <label>البراند<input name="brand" list="brand-suggestions" maxlength="80" value="${escape(item?.brand || '')}"></label>
    <datalist id="brand-suggestions">${[...new Set(products.map(p => p.brand).filter(Boolean))].map(brand =>
      `<option value="${escape(brand)}"></option>`).join('')}</datalist>
    <label>الحجم<input name="size" maxlength="60" value="${escape(item?.size || '')}"></label>
    <label>نوع البشرة<input name="skin" maxlength="80" value="${escape(item?.skin || '')}"></label>
    <label>درجة التغطية<input name="coverage" maxlength="60" value="${escape(item?.coverage || '')}"></label>
    <label>طريقة الاستخدام<textarea name="usage" maxlength="600">${escape(item?.usage || '')}</textarea></label>
    <label><input type="checkbox" name="hidden"${item?.hidden ? ' checked' : ''}> إخفاء المنتج من المتجر</label>
    <label>درجات الألوان ومخزونها<textarea name="variants" rows="5" dir="auto" placeholder="وردي | #b35470 | 8">${escape(
      (item?.variants || []).map(v => [v.name,v.color,availableStock(item,v.name),v.nameEn || ''].join(' | ')).join('\n')
    )}</textarea></label><p class="muted">كل سطر درجة واحدة بصيغة الاسم | اللون HEX | الكمية | الاسم بالإنجليزية (اختياري). عند إدخال درجات يُحسب المخزون منها.</p>
    <label>الوصف بالإنجليزية<textarea name="descriptionEn" maxlength="600" dir="ltr">${escape(item?.descriptionEn || '')}</textarea></label>
    <label>نوع المنتج<input name="type" maxlength="60" value="${escape(item ? productType(item) : '')}"></label>
    <label>الباركود<input name="barcode" dir="ltr" autocomplete="off" maxlength="128" value="${escape(item?.barcode || '')}"></label>
    <button class="secondary" type="button" data-scan-barcode>مسح الباركود بالكاميرا</button>
    <p data-barcode-status role="status" class="muted" hidden></p>
    <div data-barcode-camera hidden>
      <video muted playsinline aria-label="معاينة كاميرا الباركود" style="width:100%;max-height:240px"></video>
      <button class="secondary" type="button" data-stop-barcode>إغلاق الكاميرا</button>
    </div>
    <label>تاريخ انتهاء الصلاحية<input name="expiry" type="text" dir="ltr" maxlength="10" placeholder="DD/MM/YYYY" aria-describedby="expiry-format" value="${escape(displayExpiry(item?.expiry))}"></label>
    <small id="expiry-format">يوم / شهر / سنة</small>
    <label>الوصف<textarea name="description" maxlength="600">${escape(item?.description || '')}</textarea></label>
    <label>صور إضافية للمنتج <small>اختياري، حتى 3 صور</small><input type="file" name="gallery" accept="${imageTypes}" multiple></label>
    ${item?.gallery?.length ? `<small>${item.gallery.length} صور إضافية محفوظة. اختيار صور جديدة يستبدلها.</small>` : ''}`;
  return `<form class="panel narrow" data-content="${kind}" data-index="${item && !copyId ? index : ''}" data-copy-id="${escape(copyId)}">
    <h2>${copyId ? 'نسخ المنتج' : item ? 'تعديل' : 'إضافة'}</h2>
    <label>${isBanner ? 'عنوان الإعلان' : 'الاسم'}<input name="name" maxlength="80" required value="${escape(name || '')}"></label>
    ${!isBanner ? `<label>الاسم بالإنجليزية<input name="nameEn" maxlength="80" dir="ltr" value="${escape(isCategory ? item?.[3] || '' : item?.nameEn || '')}"></label>` : ''}
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
  const source = previous || (kind === 'products' && form.dataset.copyId ? products.find(p => p.id === form.dataset.copyId) : undefined);
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
      : isCategory ? source?.[2] || source?.[0] : source?.image;
    if (!image) throw new Error('اختار صورة رئيسية.');
    const id = 'custom-' + crypto.randomUUID();
    let item;
    if (isCategory) {
      item = [previous?.[0] || id,name,image,data.get('nameEn')?.trim() || ''];
    } else if (kind === 'products') {
      const files = data.getAll('gallery').filter(file => file.size);
      if (files.length > 3) throw new Error('اختار 3 صور إضافية كحد أقصى.');
      const gallery = files.length ? await Promise.all(files.map(readCatalogImage)) : source?.gallery;
      item = {...source,id:previous?.id || id,name,category,image,gallery,price:Number(data.get('price')),
        purchaseCost:data.get('purchaseCost') ? Number(data.get('purchaseCost')) : null,
        stock:Number(data.get('stock')) + soldQuantity(previous?.id),description:data.get('description').trim(),
        type:data.get('type')?.trim() || '',barcode:data.get('barcode')?.trim() || '',expiry:parseExpiry(data.get('expiry'))};
      for (const field of ['nameEn','descriptionEn','brand','size','skin','coverage','usage']) item[field] = data.get(field)?.trim() || '';
      item.hidden = data.has('hidden');
      item.variants = parseVariants(data.get('variants'),previous?.id);
      if (previous?.variants?.length) {
        const reserved = new Set([
          ...state.cart.filter(line => line.id === previous.id).map(line => line.shade),
          ...state.orders.filter(order => order.status !== 'cancelled').flatMap(order =>
            (order.items || []).filter(line => line.id === previous.id).map(line => line.shade))
        ]);
        if (item.variants.length && previous.variants.some(v => reserved.has(v.name) && !item.variants.some(next => next.name === v.name))) {
          throw new Error('درجة مرتبطة بسلة أو طلب. خلي اسمها وحدد كميتها بصفر لإيقافها.');
        }
      }
      if (!item.variants.length && data.get('stock') === '') throw new Error('حدد الكمية أو أضف درجات لها مخزون.');
      if (item.variants.length && state.cart.some(line => line.id === item.id && availableStock(item,line.shade) < cartQuantity(item.id,line.shade))) {
        throw new Error('كمية الدرجة أقل من الكمية الموجودة بالسلة.');
      }
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
    status.textContent = translate(message);
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

function parseVariants(value, id) {
  const rows = (value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (rows.length > 30) throw new Error('الحد الأقصى 30 درجة.');
  const names = new Set();
  return rows.map(row => {
    const [name,color,quantity,nameEn = '',...extra] = row.split('|').map(part => part.trim());
    const stock = Number(quantity);
    if (!name || name.length > 60 || nameEn.length > 60 || !/^#[0-9a-f]{6}$/i.test(color || '') ||
      !/^\d+$/.test(quantity || '') || stock > 1000000 || names.has(name) || extra.length) {
      throw new Error('راجع أسماء الدرجات والألوان والكميات. كل اسم لازم يكون مختلف.');
    }
    names.add(name);
    return {name,color,nameEn,stock:stock + soldQuantity(id,name)};
  });
}
function displayExpiry(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('/') : '';
}
function parseExpiry(value) {
  const text = (value || '').trim().replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) % 16));
  if (!text) return '';
  const parts = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (parts) {
    const [,day,month,year] = parts;
    const iso = year + '-' + month.padStart(2,'0') + '-' + day.padStart(2,'0');
    const date = new Date(iso + 'T00:00:00Z');
    if (year !== '0000' && Number.isFinite(date.getTime()) && date.toISOString().startsWith(iso + 'T')) return iso;
  }
  throw new Error('اكتب تاريخ صحيح بترتيب يوم / شهر / سنة.');
}
function expiryStatus(iso, now = new Date()) {
  if (!displayExpiry(iso)) return '';
  const today = Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
  const days = (Date.parse(iso) - today) / 86400000;
  return days < 0 ? 'expired' : days <= 30 ? 'soon' : '';
}
const expiryLabels = {soon:'قريب من انتهاء الصلاحية',expired:'منتهي الصلاحية'};
function expiryBadge(product) {
  const status = expiryStatus(product.expiry);
  const date = displayExpiry(product.expiry);
  if (!date) return '';
  return `<div class="expiry-meta"><bdi>${date}</bdi> ${status ?
    `<span class="expiry-badge expiry-${status}">${expiryLabels[status]}</span>` : ''}</div>`;
}
function expiryNotifications() {
  if (!previewAsManager) return '<h1>الرئيسية</h1><a href="#home">الرئيسية</a>';
  return '<a class="button secondary" href="#manage">رجوع</a><h1>إشعارات الصلاحية</h1><p>القريب من الانتهاء يعني خلال 30 يوم.</p>' +
    Object.entries(expiryLabels).reverse().map(([status,label]) =>
      `<h2><span class="expiry-badge expiry-${status}">${label}</span></h2>` + catalogRows('products','','',status)
    ).join('');
}
function updateExpiryBell() {
  if (!previewAsManager) return;
  const count = products.filter(product => expiryStatus(product.expiry)).length;
  document.querySelector('#expiry-notice-count').textContent = count ? format.format(count) : '';
}
function productAlerts(product) {
  return [availableStock(product) <= 5 || product.variants?.some(v => availableStock(product,v.name) <= 5) ? 'low' : '',
    expiryStatus(product.expiry) ? 'expiry' : ''].filter(Boolean);
}

function toggleExpiryProduct(id) {
  if (!previewAsManager) return;
  const item = products.find(product => product.id === id);
  if (!item || !expiryStatus(item.expiry)) return;
  try { persistCatalog('products',products.map(product => product === item ? {...product,hidden:!item.hidden} : product)); }
  catch { notify('تعذّر الحفظ.'); return; }
  render();
}
