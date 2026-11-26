const view = document.querySelector('#view');
const notice = document.querySelector('#notice');
const format = new Intl.NumberFormat('ar-IQ', {numberingSystem:'latn'});
const money = amount => '<bdi dir="ltr">' + format.format(amount) + '</bdi> د.ع';
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
})[char]);
const photo = (name, alt = '', css = '') => {
  const src = /^data:image\/(webp|png);base64,[a-z0-9+/=]+$/i.test(name) ? name : './' + name + '.webp';
  return '<img class="' + css + '" src="' + escape(src) + '" alt="' + escape(alt) + '">';
};
const previewAsManager = new URLSearchParams(location.search).get('view') !== 'customer';
const orderLabel = previewAsManager ? 'إدارة الطلبات' : 'طلباتي';
const defaultSettings = {name:'لمسة بيوتي', contact:'', delivery:4000};
const orderStatuses = {
  confirmed:'تم تأكيد الطلب', preparing:'قيد التجهيز', shipped:'خرج للتوصيل',
  delivered:'تم التسليم', cancelled:'ملغي'
};
const key = 'lamsa-demo-v1';
const initial = {cart:[], favorites:[], orders:[], profile:null, coupon:false, settings:defaultSettings};
let state;
try { state = {...initial, ...JSON.parse(localStorage.getItem(key))}; }
catch { state = {...initial}; }
let checkoutDraft = null;
let slide = 0;
let timer;
let noticeTimer;

function save() {
  localStorage.setItem(key, JSON.stringify(state));
  updateNavigation();
}
function notify(message) {
  notice.textContent = translate(message);
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.textContent = ''; }, 2400);
}
function route() {
  const [path, param] = (location.hash.slice(1) || 'home').split('/');
  return {path, param};
}
function updateNavigation() {
  const {path} = route();
  const tab = ({shop:'categories',product:'categories',checkout:'cart',review:'cart',login:'account',signup:'account',
    orders:'account',manage:'account','expiry-notifications':'account',profile:'account',settings:'account',order:'account'})[path] || path;
  document.querySelectorAll('nav a').forEach(link => {
    if (link.hash === '#' + tab) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
  const count = state.cart.reduce((total,line) => total + line.qty,0);
  document.querySelector('#count').textContent = count ? format.format(count) : '';
}
function productName(product) {
  return language === 'en' && product.nameEn ? product.nameEn : product.name;
}
function categoryName(category) {
  return language === 'en' && category?.[3] ? category[3] : category?.[1];
}
function cards(items) {
  items = items.filter(product => !product.hidden);
  return items.length ? '<div class="grid">' + items.map(p =>
    '<article class="card product-card"><a href="#product/' + p.id + '">' +
    '<span class="depth-photo">' + photo(p.image,productName(p)) + '</span>' +
    '<strong>' + escape(productName(p)) + '</strong></a><span class="price">' + money(p.price) +
    (p.old ? '<del>' + money(p.old) + '</del>' : '') +
    '</span>' + ((p.variants?.length || p.shades?.length) && availableStock(p) > 0
      ? '<a class="button card-action" href="#product/' + p.id + '">اختاري الدرجة</a>'
      : '<button data-add="' + p.id + '"' + (availableStock(p) === 0 ? ' disabled>نفد المخزون' : '>أضيفي للسلة') + '</button>') +
    '</article>').join('') +
    '</div>' : '<p class="panel">ماكو منتجات للعرض حالياً.</p>';
}
function categoryCards() {
  return '<div class="grid categories">' + categories.map(category => {
    const [id,,image] = category;
    const useDepthArt = (!image || image === id) && ['face','eyes','lips','skin','brushes','offers'].includes(id);
    const art = useDepthArt ? '<span class="category-depth-art" aria-hidden="true" data-art="' + id + '"></span>' : photo(image || id);
    return '<a class="card category-card" href="#shop/' + id + '">' +
      '<span class="depth-photo">' + art + '</span>' +
      '<strong>' + escape(categoryName(category)) + '</strong></a>';
  }).join('') + '</div>';
}
function searchBox() {
  return '<label class="search">بحث المنتجات<input id="search" type="search" placeholder="ابحثي عن منتج…"></label>';
}
function updateBanner() {
  const banner = document.querySelector('#banner');
  if (!banner) return;
  const b = banners[slide];
  if (!b) return;
  banner.innerHTML = '<a class="hero" href="#' + b.route + '"><div><h1>' + escape(b.title) +
    '</h1><span class="button">' + escape(b.copy) + '</span></div>' + photo(b.image) + '</a>';
  localize(banner);
  document.querySelectorAll('[data-slide]').forEach((button,i) =>
    button.setAttribute('aria-pressed',String(i === slide)));
}
function home() {
  const recent = products.filter(p => !p.hidden).reverse().slice(0,6);
  return searchBox() + '<div id="home-content"><div id="banner"></div><div class="dots" aria-label="العروض">' +
    banners.map((_,i) => '<button data-slide="' + i + '" aria-label="عرض ' + (i+1) + '"></button>').join('') +
    '</div><div class="row"><h2>الأقسام</h2><a href="#categories">عرض الكل</a></div>' + categoryCards() +
    '<div class="row"><h2>وصل حديثاً</h2><a href="#shop">عرض الكل</a></div>' + cards(recent) +
    '<div class="row"><h2>عروض مميزة</h2><a href="#shop/offers">عرض الكل</a></div>' +
    cards(products.filter(p => p.old || p.category === 'offers')) + '</div><div id="results" hidden></div>';
}
function brandKey(name) {
  return (name || '').trim().replace(/\s+/g,' ').toLowerCase();
}
function brandOptions(items) {
  const names = new Map();
  for (const item of items) {
    const key = brandKey(item.brand);
    if (key && !names.has(key)) names.set(key,item.brand);
  }
  return [...names].sort(([,left],[,right]) => left.localeCompare(right)).map(([key,name]) =>
    '<option value="' + escape(key) + '">' + escape(name) + '</option>').join('');
}
function shop(id) {
  const category = categories.find(row => row[0] === id);
  const types = [...new Set([...(Object.hasOwn(categoryTypes,id) ? categoryTypes[id] : []),
    ...products.filter(p => p.category === id).map(productType).filter(Boolean)])];
  const filter = types.length ? '<label>نوع المنتج<select id="type-filter"><option value="">كل الأنواع</option>' +
    types.map(type => '<option value="' + escape(type) + '">' + escape(type) + '</option>').join('') + '</select></label>' : '';
  const candidates = products.filter(p => !p.hidden && (!id || p.category === id || (id === 'offers' && p.old)));
  const options = values => [...new Set(values.filter(Boolean))].map(value =>
    '<option value="' + escape(value) + '">' + escape(value) + '</option>').join('');
  const brands = brandOptions(candidates);
  const shades = options(candidates.flatMap(p => p.variants?.length ? p.variants.map(v => language === 'en' && v.nameEn ? v.nameEn : v.name) : p.shades || []));
  const filters = (brands ? '<label>الماركة<select id="brand-filter"><option value="">كل الماركات</option>' + brands + '</select></label>' : '') +
    (shades ? '<label>الدرجة<select id="shade-filter"><option value="">كل الدرجات</option>' + shades + '</select></label>' : '') +
    '<label>أقل سعر<input id="price-min" type="number" min="0"></label><label>أعلى سعر<input id="price-max" type="number" min="0"></label>';
  return '<h1>' + escape(categoryName(category) || 'كل المنتجات') + '</h1>' + searchBox() +
    '<div class="admin-filters">' + filter + filters + '<label>ترتيب المنتجات<select id="sort"><option value="">الافتراضي</option>' +
    '<option value="low">السعر من الأقل</option><option value="high">السعر من الأعلى</option></select></label></div><div id="results"></div>';
}
function updateResults() {
  const results = document.querySelector('#results');
  if (!results) return;
  const {path,param} = route();
  const query = document.querySelector('#search').value.trim().toLowerCase();
  const type = document.querySelector('#type-filter')?.value;
  if (path === 'home') {
    document.querySelector('#home-content').hidden = Boolean(query);
    results.hidden = !query;
    if (!query) return;
  }
  const value = id => document.querySelector('#' + id)?.value || '';
  const brand = value('brand-filter'), shade = value('shade-filter');
  const min = value('price-min'), max = value('price-max');
  const list = products.filter(p => !p.hidden && (!brand || brandKey(p.brand) === brand) &&
    (!min || p.price >= Number(min)) && (!max || p.price <= Number(max)) &&
    (!shade || (p.variants?.length ? p.variants.some(v => (language === 'en' && v.nameEn ? v.nameEn : v.name) === shade) : p.shades?.includes(shade))) &&
    (!param || (p.category === param || (param === 'offers' && p.old))) && (!type || productType(p) === type) &&
    [p.name,productName(p),translate(p.name)].some(name => name.toLowerCase().includes(query)));
  const sort = document.querySelector('#sort')?.value;
  if (sort) list.sort((a,b) => sort === 'low' ? a.price-b.price : b.price-a.price);
  results.innerHTML = cards(list);
  localize(results);
}
function detail(id) {
  const p = products.find(item => item.id === id);
  if (!p || p.hidden) return '<h1>المنتج غير موجود</h1>';
  const colors = ['#a3283f','#b35470','#97594e','#c58d7a'];
  const shades = p.variants?.length ? p.variants : (p.shades || []).map((name,i) => ({name,color:colors[i]}));
  const firstAvailable = shades.findIndex(v => availableStock(p,v.name) > 0);
  const description = language === 'en' && p.descriptionEn ? p.descriptionEn : p.description;
  const specs = [['الماركة',p.brand],['الحجم',p.size],['نوع البشرة',p.skin],['درجة التغطية',p.coverage],['طريقة الاستخدام',p.usage]]
    .filter(([,value]) => value).map(([key,value]) => '<div class="line"><strong>' + key + '</strong> · <span>' + escape(value) + '</span></div>').join('');
  const images = [...new Set([p.detail || p.image,p.image,...(p.gallery || [])])];
  const gallery = '<div class="product-photos" id="product-photos" tabindex="0" aria-label="صور المنتج">' +
    images.map(src => '<div class="depth-slide">' + photo(src,productName(p),'detail') + '</div>').join('') + '</div>' +
    (images.length > 1 ? '<div class="row gallery-controls"><button type="button" class="secondary" data-photo-step="-1" aria-label="الصورة السابقة">‹</button>' +
      '<button type="button" class="secondary" data-photo-step="1" aria-label="الصورة التالية">›</button></div>' : '');
  return '<section class="narrow"><a class="button secondary" href="#shop/' + p.category + '">رجوع</a><h1>' + escape(productName(p)) + '</h1>' + gallery +
    '<div class="row"><h2>' + money(p.price) + '</h2><button class="secondary" data-favorite="' + p.id +
    '">' + (state.favorites.includes(p.id) ? '♥ إزالة من المفضلة' : '♡ إضافة للمفضلة') + '</button></div>' +
    (p.stock == null ? '' : '<p>المتوفر ' + format.format(availableStock(p)) + '</p>') +
    (description ? '<p class="panel">' + escape(description) + '</p>' : '') + (specs ? '<div class="panel">' + specs + '</div>' : '') +
    '<form id="add-form" data-product="' + p.id + '">' +
    (shades.length ? '<fieldset class="panel"><legend>اختاري الدرجة</legend>' + shades.map((shade,i) => {
      const stock = availableStock(p,shade.name);
      return '<label><input type="radio" name="shade" required value="' + escape(shade.name) + '"' +
        (i === firstAvailable ? ' checked' : '') + (stock === 0 ? ' disabled' : '') +
        '><span class="swatch" style="background:' + shade.color + '"></span><span>' +
        escape(language === 'en' && shade.nameEn ? shade.nameEn : shade.name) +
        '</span>' + (stock === 0 ? ' · <small>نفد المخزون</small>' : p.variants?.length ?
          ' · <small>المتوفر ' + format.format(stock) + '</small>' : '') + '</label>';
    }).join('') + '</fieldset>' : '') +
    '<label>الكمية<input name="qty" type="number" min="1" max="99" value="1" required></label>' +
    '<div class="purchase-bar"><button class="full"' + (availableStock(p) === 0 ? ' disabled>نفد المخزون' : '>أضيفي للسلة') + '</button></div></form></section>';
}
function totals() {
  const subtotal = state.cart.reduce((sum,line) => sum + products.find(p => p.id === line.id).price * line.qty,0);
  const discount = state.coupon ? Math.round(subtotal * 0.1) : 0;
  return {subtotal, discount, total:subtotal + state.settings.delivery - discount};
}
function summary() {
  const {subtotal,discount,total} = totals();
  return '<div class="panel"><div class="row line"><span>مجموع المنتجات</span><b>' + money(subtotal) +
    '</b></div><div class="row line"><span>رسوم التوصيل</span><b>' + money(state.settings.delivery) +
    '</b></div>' + (discount ? '<div class="row line"><span>الخصم</span><b>− ' + money(discount) + '</b></div>' : '') +
    '<div class="row"><strong>الإجمالي</strong><strong>' + money(total) + '</strong></div></div>';
}
function cart() {
  if (!state.cart.length) return '<h1>السلة</h1><p class="panel">سلتك فارغة.</p><a class="button" href="#categories">تسوّقي الآن</a>';
  const lines = state.cart.map((line,i) => {
    const p = products.find(item => item.id === line.id);
    return '<div class="panel row">' + photo(p.image,p.name,'thumb') + '<div class="grow"><strong>' + escape(productName(p)) +
      '</strong><br>' + escape(line.shade) + '<br>' + money(p.price*line.qty) + '</div><div>' +
      '<button class="secondary" data-quantity="' + i + '/1" aria-label="زيادة الكمية">+</button> ' + format.format(line.qty) +
      ' <button class="secondary" data-quantity="' + i + '/-1" aria-label="تقليل الكمية">−</button><br>' +
      '<button class="secondary" data-remove="' + i + '">حذف</button></div></div>';
  }).join('');
  return '<a class="button secondary" href="#home">رجوع</a><h1>السلة</h1>' + lines + '<form class="panel" id="coupon"><label>رمز الخصم<input name="coupon" placeholder="BEAUTY10" ' +
    (state.coupon ? 'value="BEAUTY10"' : '') + '></label><button>تطبيق</button></form>' + summary() +
    '<div class="purchase-bar row"><div><strong>الإجمالي</strong><br>' + money(totals().total) +
    '</div><a class="button" href="#checkout">إكمال الطلب</a></div>';
}
const provinces = ['بغداد','البصرة','نينوى','أربيل','السليمانية','دهوك','كركوك','الأنبار','صلاح الدين','ديالى','واسط','بابل','كربلاء','النجف','القادسية','المثنى','ذي قار','ميسان','حلبجة'];
function checkout() {
  if (!state.cart.length) return cart();
  const draft = checkoutDraft || {};
  return '<section class="narrow"><a class="button secondary" href="#cart">رجوع</a><h1>إتمام الطلب</h1><form id="checkout"><div class="panel"><h2>بيانات الاستلام</h2>' +
    '<p class="muted">طلب تجريبي. استخدمي بيانات وهمية.</p>' +
    '<label>الاسم الكامل<input name="name" required maxlength="80" value="' + escape(draft.name || '') + '"></label>' +
    '<label>رقم الهاتف<input name="phone" type="tel" inputmode="tel" pattern="[+0-9٠-٩ ]{8,16}" value="' + escape(draft.phone || '') + '" required></label>' +
    '<label>المحافظة<select name="province" required><option value="">اختاري المحافظة</option>' +
    provinces.map(p => '<option value="' + escape(p) + '"' + (draft.province === p ? ' selected' : '') + '>' + p + '</option>').join('') + '</select></label>' +
    '<label>المنطقة والعنوان<textarea name="address" required maxlength="200">' +
    escape(draft.address ?? state.profile?.address ?? '') + '</textarea></label></div>' +
    '<div class="panel"><h2>طريقة الدفع</h2>الدفع عند الاستلام</div>' +
    (state.settings.contact ? '<p><span>تواصل المتجر:</span> ' + escape(state.settings.contact) + '</p>' : '') + summary() +
    '<div class="chips"><button>مراجعة الطلب</button><button type="button" class="secondary" data-cancel-checkout>إلغاء</button></div></form></section>';
}
function reviewOrder() {
  if (!checkoutDraft || !state.cart.length) return checkout();
  const draft = checkoutDraft;
  const lines = state.cart.map(line => {
    const product = products.find(p => p.id === line.id);
    const shade = product.variants?.find(v => v.name === line.shade);
    return '<div class="row line"><span>' + escape(productName(product)) +
      (line.shade ? ' · ' + escape(language === 'en' && shade?.nameEn ? shade.nameEn : line.shade) : '') +
      ' × ' + format.format(line.qty) + '</span><b>' + money(product.price * line.qty) + '</b></div>';
  }).join('');
  return '<section class="narrow"><a class="button secondary" href="#checkout">رجوع</a><h1>مراجعة الطلب</h1>' +
    '<div class="panel"><h2>محتويات الطلب</h2>' + lines + '<a href="#cart" class="button secondary">تعديل السلة</a></div>' +
    '<div class="panel"><h2>بيانات الاستلام</h2><p>' + escape(draft.name) + '<br><bdi>' + escape(draft.phone) +
    '</bdi><br>' + escape(translate(draft.province)) + ' · ' + escape(draft.address) +
    '</p><a href="#checkout" class="button secondary">تعديل العنوان</a></div>' + summary() +
    '<form id="confirm-order" class="chips"><button>تأكيد الطلب</button><button type="button" class="secondary" data-cancel-checkout>إلغاء</button></form></section>';
}
function login(signup = false) {
  const title = signup ? 'إنشاء حساب تجريبي' : 'تسجيل الدخول';
  return '<section class="narrow"><h1>' + title + '</h1><form class="panel" id="' + (signup ? 'signup' : 'login') + '">' +
    '<p class="muted">الحساب للتجربة على هذا الجهاز. استخدمي بيانات وهمية.</p>' +
    (signup ? '<label>الاسم<input name="name" maxlength="80" required></label>' : '') +
    '<label>رقم الهاتف أو البريد<input name="identifier" maxlength="100" required placeholder="demo@example.com"></label>' +
    '<button class="full">' + (signup ? title : 'دخول تجريبي') + '</button></form>' +
    '<a class="button secondary" href="#' + (signup ? 'login">تسجيل الدخول' : 'signup">إنشاء حساب') + '</a></section>';
}
function settings() {
  if (!previewAsManager) return profile();
  const {name,contact,delivery} = state.settings;
  const background = storeBackground();
  return '<a class="button secondary" href="#manage">‹ لوحة الإدارة</a><h1>إعدادات المتجر</h1><form class="panel narrow" id="store-settings">' +
    '<label>اسم المتجر<input name="name" value="' + escape(name) + '" maxlength="60" required></label>' +
    '<label>معلومات التواصل<input name="contact" value="' + escape(contact) + '" maxlength="120"></label>' +
    '<label>رسوم التوصيل بالدينار العراقي<input name="delivery" type="number" min="0" max="1000000" value="' +
    delivery + '" required></label><label>لون خلفية المتجر<input name="background" type="color" value="' +
    background + '"></label><div class="chips"><button>حفظ</button><a class="button secondary" href="#manage">إلغاء</a></div></form>';
}
function account() {
  if (previewAsManager) return '<h1>حسابي</h1><div class="panel"><h2>' +
    escape(state.settings.name) + '</h2><span class="status">مدير المتجر</span></div>' +
    '<a class="button" href="#manage">لوحة الإدارة</a>';
  if (!state.profile) return '<h1>حسابي</h1><div class="panel"><a class="button" href="#login">تسجيل الدخول</a> ' +
    '<a class="button secondary" href="#signup">إنشاء حساب</a></div><a href="#orders">الطلبات التجريبية</a>';
  return '<h1>حسابي</h1><div class="panel"><h2>' + escape(state.profile.name) + '</h2>' +
    escape(state.profile.identifier || '') + '</div><div class="panel"><a class="line row" href="#orders">طلباتي <span>‹</span></a>' +
    '<a class="line row" href="#favorites">المفضلة <span>‹</span></a><a class="line row" href="#profile">تعديل الحساب والعنوان <span>‹</span></a></div>' +
    '<button class="secondary" data-logout>تسجيل الخروج</button>';
}
function profile() {
  return '<h1>تعديل الحساب والعنوان</h1><form class="panel narrow" id="profile">' +
    '<label>الاسم<input name="name" required maxlength="80" value="' + escape(state.profile?.name || '') + '"></label>' +
    '<label>العنوان المفضل<textarea name="address" maxlength="200">' + escape(state.profile?.address || '') +
    '</textarea></label><button>حفظ</button></form>';
}
function orderContent(id) {
  if (!id) return (previewAsManager ? '<a class="button secondary" href="#manage">‹ لوحة الإدارة</a>' : '') + '<h1>' + orderLabel + '</h1>' + (state.orders.length ? state.orders.map(order =>
    '<a class="panel row order-list-row" href="#order/' + escape(order.id) + '"><span>طلب <bdi>#' + escape(order.id) +
    '</bdi></span><span>' + money(order.total) + '</span><span class="status">' +
    orderStatuses[order.status || 'confirmed'] + '</span></a>').join('') : '<p>ماكو طلبات حالياً.</p>');
  const order = state.orders.find(item => item.id === id);
  if (!order) return '<h1>الطلب غير موجود</h1>';
  const status = order.status || 'confirmed';
  const editor = previewAsManager ? '<form class="panel" id="order-status" data-order="' + escape(id) +
    '"><label>حالة الطلب<select name="status">' + Object.entries(orderStatuses).map(([value,label]) =>
      '<option value="' + value + '"' + (value === status ? ' selected' : '') + '>' + label + '</option>'
    ).join('') + '</select></label><div class="chips"><button>حفظ الحالة</button><a class="button secondary" href="#orders">إلغاء</a></div></form>' : '';
  const items = order.items?.length ? '<div class="panel"><h2>محتويات الطلب</h2>' + order.items.map(item =>
    '<div class="row line"><span>' + escape(item.name) + (item.shade ? ' · ' + escape(item.shade) : '') +
    ' × ' + format.format(item.qty) + '</span><span>' + money(item.price * item.qty) + '</span></div>'
  ).join('') + '</div>' : '';
  return '<h1>' + orderStatuses[status] + '</h1><div class="panel"><p>رقم الطلب <bdi>#' + escape(order.id) + '</bdi></p>' +
    '<p><span>المحافظة</span> ' + escape(translate(order.province)) + '</p><p><span>الإجمالي</span> ' + money(order.total) +
    '</p><p>الدفع عند الاستلام</p><p class="muted">طلب تجريبي محفوظ على هذا الجهاز.</p></div>' +
    items + editor + '<a class="button" href="#orders">' + orderLabel + '</a>';
}
function storeBackground() {
  const color = state.settings.background;
  return /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#fff9f6';
}
function render(scroll = false) {
  const {path,param} = route();
  clearInterval(timer);
  const pages = {home, categories:() => '<h1>الأقسام</h1><div class="strip">توصيل لكل المحافظات</div><br>' + categoryCards(),
    shop:() => shop(param), product:() => detail(param), cart, checkout, review:reviewOrder, login:() => login(), signup:() => login(true),
    account, profile, settings, manage:() => managementPage(param), favorites:() => '<h1>المفضلة</h1>' + cards(products.filter(p => !p.hidden && state.favorites.includes(p.id))),
    orders:() => orderContent(), order:() => orderContent(param)};
  pages['expiry-notifications'] = expiryNotifications;
  view.innerHTML = Object.hasOwn(pages,path) ? pages[path]() : '<h1>الصفحة غير موجودة</h1><a href="#home">الرئيسية</a>';
  if (path === 'home') {
    updateBanner();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(() => {
      if (!document.hidden && !document.querySelector('#home-content').matches(':focus-within')) {
        slide = (slide+1) % banners.length;
        updateBanner();
      }
    }, 6500);
  }
  if (path === 'shop') updateResults();
  document.documentElement.style.setProperty('--store-bg',storeBackground());
  view.classList.toggle('has-purchase-bar',Boolean(view.querySelector('.purchase-bar')));
  updateExpiryBell();
  localize(view);
  document.title = translate(state.settings.name);
  document.querySelector('#store-brand').lastChild.textContent = ' ' + translate(state.settings.name);
  updateNavigation();
  if (scroll) window.scrollTo(0,0);
}
function soldQuantity(id, shade) {
  return state.orders.reduce((total,order) => order.status === 'cancelled' ? total : total +
    (order.items || []).reduce((sum,item) => sum + (item.id === id && (shade === undefined || item.shade === shade) ? item.qty : 0),0),0);
}
function availableStock(product, shade) {
  if (product.variants?.length) {
    if (shade === undefined) return product.variants.reduce((sum,v) => sum + availableStock(product,v.name),0);
    const variant = product.variants.find(v => v.name === shade);
    return variant ? Math.max(0,variant.stock - soldQuantity(product.id,shade)) : 0;
  }
  return product.stock == null ? Infinity : Math.max(0,product.stock - soldQuantity(product.id));
}
function cartQuantity(id, shade) {
  return state.cart.reduce((count,line) => count + (line.id === id && (shade === undefined || line.shade === shade) ? line.qty : 0),0);
}
function stockScope(product,line) {
  return product.variants?.length ? line.shade : undefined;
}
function addProduct(id, shade, qty) {
  const p = products.find(product => product.id === id);
  if (!p || p.hidden) return;
  const chosen = shade || p.variants?.[0]?.name || p.shades?.[0] || '';
  const scope = stockScope(p,{shade:chosen});
  if (cartQuantity(id,scope) + qty > availableStock(p,scope)) { notify('الكمية المطلوبة تتجاوز المخزون.'); return; }
  const line = state.cart.find(item => item.id === id && item.shade === chosen);
  if (line) line.qty = Math.min(99,line.qty + qty);
  else state.cart.push({id,shade:chosen,qty});
  save();
  notify('تمت إضافة المنتج للسلة');
}
view.addEventListener('input', event => {
  if (['admin-search','admin-category-filter','admin-alert','admin-brand'].includes(event.target.id)) {
    document.querySelector('#admin-list').innerHTML = catalogRows('products',
      document.querySelector('#admin-search').value.trim(),document.querySelector('#admin-category-filter').value,document.querySelector('#admin-alert').value,document.querySelector('#admin-brand').value);
    localize(document.querySelector('#admin-list'));
  }
  if (['search','sort','type-filter','brand-filter','shade-filter','price-min','price-max'].includes(event.target.id)) updateResults();
});
view.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.hasAttribute('data-scan-barcode')) { scanProductBarcode(button.form); return; }
  if (button.hasAttribute('data-stop-barcode')) { stopProductBarcodeScan?.(); return; }
  const data = button.dataset;
  if (button.hasAttribute('data-cancel-checkout')) { checkoutDraft = null; location.hash = 'cart'; return; }
  if (data.photoStep) {
    const gallery = document.querySelector('#product-photos');
    gallery.scrollBy({left:Number(data.photoStep) * gallery.clientWidth * (language === 'ar' ? -1 : 1),behavior:'auto'});
    return;
  }
  if (data.move) { moveCatalogItem(data.move); return; }
  if (data.add) addProduct(data.add,'',1);
  if (data.slide !== undefined) { slide = Number(data.slide); updateBanner(); }
  if (data.favorite) {
    const id = data.favorite;
    state.favorites = state.favorites.includes(id) ? state.favorites.filter(item => item !== id) : [...state.favorites,id];
  } else if (data.quantity) {
    const [index,delta] = data.quantity.split('/').map(Number);
    const id = state.cart[index].id;
    const product = products.find(p => p.id === id);
    const scope = stockScope(product,state.cart[index]);
    if (delta > 0 && (product.hidden || cartQuantity(id,scope) + delta > availableStock(product,scope))) {
      notify('الكمية المطلوبة تتجاوز المخزون.');
      return;
    }
    state.cart[index].qty = Math.max(1,Math.min(99,state.cart[index].qty + delta));
  } else if (data.remove !== undefined) {
    state.cart.splice(Number(data.remove),1);
    if (!state.cart.length) state.coupon = false;
  } else if (data.logout !== undefined) {
    state.profile = null;
  } else return;
  save();
  render();
});
view.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);
  if (form.dataset.content) {
    saveCatalogItem(form,data);
  } else if (form.id === 'add-form') {
    addProduct(form.dataset.product,data.get('shade'),Number(data.get('qty')));
  } else if (form.id === 'coupon') {
    state.coupon = data.get('coupon').trim().toUpperCase() === 'BEAUTY10';
    save();
    render();
    notify(state.coupon ? 'تم تطبيق خصم 10%' : 'رمز الخصم غير صالح');
  } else if (form.id === 'checkout' && state.cart.length) {
    checkoutDraft = Object.fromEntries(['name','phone','province','address'].map(field => [field,data.get(field).trim()]));
    if (!checkoutDraft.name || !checkoutDraft.address) { notify('أكمل الاسم والعنوان.'); return; }
    location.hash = 'review';
    if (route().path === 'review') render(true);
  } else if (form.id === 'confirm-order' && checkoutDraft && state.cart.length) {
    const items = state.cart.map(line => {
      const product = products.find(p => p.id === line.id);
      return {...line,name:product.name,price:product.price};
    });
    if (items.some(item => {
      const product = products.find(p => p.id === item.id);
      const shade = stockScope(product,item);
      return product.hidden || cartQuantity(item.id,shade) > availableStock(product,shade);
    })) {
      notify('المخزون تغيّر. عدّل الكميات بالسلة.');
      return;
    }
    const order = {id:String(Date.now()), province:checkoutDraft.province, total:totals().total, items};
    const next = {...state,orders:[order,...state.orders],cart:[],coupon:false};
    try { localStorage.setItem(key,JSON.stringify(next)); }
    catch { notify('تعذّر حفظ الطلب في المتصفح.'); return; }
    state = next;
    updateNavigation();
    checkoutDraft = null;
    location.hash = 'order/' + order.id;
  } else if (form.id === 'login' || form.id === 'signup') {
    state.profile = {name:data.get('name')?.trim() || 'متسوّقة لمسة بيوتي',identifier:data.get('identifier').trim()};
    save();
    location.hash = 'account';
  } else if (form.id === 'store-settings' && previewAsManager) {
    const name = data.get('name').trim();
    if (!name) { notify('اكتب اسم المتجر'); return; }
    state.settings = {name, contact:data.get('contact').trim(), delivery:Number(data.get('delivery')),background:data.get('background')};
    save();
    render();
    notify('تم حفظ إعدادات المتجر');
  } else if (form.id === 'order-status' && previewAsManager) {
    const order = state.orders.find(item => item.id === form.dataset.order);
    const status = data.get('status');
    if (!order || !Object.hasOwn(orderStatuses,status)) return;
    if (order.status === 'cancelled' && status !== 'cancelled' && (order.items || []).some(line =>
      {
        const product = products.find(product => product.id === line.id);
        const shade = stockScope(product,line);
        return order.items.reduce((qty,item) => qty + (item.id === line.id && (shade === undefined || item.shade === shade) ? item.qty : 0),0) >
          availableStock(product,shade);
      }
    )) {
      notify('المخزون الحالي ما يكفي لإعادة تفعيل الطلب.');
      return;
    }
    const next = {...state,orders:state.orders.map(item => item === order ? {...item,status} : item)};
    try { localStorage.setItem(key,JSON.stringify(next)); }
    catch { notify('تعذّر حفظ حالة الطلب.'); return; }
    state = next;
    render();
    notify('تم تحديث حالة الطلب');
  } else if (form.id === 'profile') {
    const name = data.get('name').trim();
    if (!name) { notify('اكتب الاسم'); return; }
    state.profile = {...state.profile, name, address:data.get('address').trim()};
    save();
    location.hash = 'account';
    notify('تم حفظ التعديلات');
  }
});
const menuToggle = document.querySelector('#menu-toggle');
const quickMenu = document.querySelector('#quick-menu');
const menuMain = document.querySelector('#menu-main');
const menuSections = document.querySelector('#menu-sections');
const menuCategories = document.querySelector('#menu-categories');
const menuBack = document.querySelector('#menu-back');
const menuHeading = document.querySelector('#menu-heading');
document.querySelector('#menu-manage').hidden = !previewAsManager;
document.querySelector('#menu-role').textContent = previewAsManager ? 'مدير المتجر' : 'زبون';
document.querySelector('#menu-orders').textContent = orderLabel;

function showMenuSections(show) {
  menuMain.hidden = show;
  menuSections.hidden = !show;
  menuHeading.textContent = translate(show ? 'الأقسام' : 'القائمة المختصرة');
}
menuCategories.addEventListener('click', () => {
  document.querySelector('#menu-section-links').innerHTML = categories.map(category =>
    '<li><a href="#shop/' + category[0] + '">' + escape(categoryName(category)) + '</a></li>'
  ).join('');
  localize(menuSections);
  showMenuSections(true);
  quickMenu.scrollTop = 0;
  menuBack.focus();
});
menuBack.addEventListener('click', () => {
  showMenuSections(false);
  menuCategories.focus();
});
menuToggle.addEventListener('click', () => {
  showMenuSections(false);
  document.querySelector('#menu-name').textContent = previewAsManager
    ? translate(state.settings.name) : state.profile?.name || '';
  quickMenu.showModal();
  quickMenu.scrollTop = 0;
  menuToggle.setAttribute('aria-expanded','true');
});
quickMenu.addEventListener('click', event => {
  if (event.target.closest('a') || event.target === quickMenu) quickMenu.close();
});
quickMenu.addEventListener('close', () => {
  menuToggle.setAttribute('aria-expanded','false');
});
window.addEventListener('pagehide', () => stopProductBarcodeScan?.());
window.addEventListener('hashchange', () => {
  stopProductBarcodeScan?.();
  if (quickMenu.open) quickMenu.close();
  render(true);
});
document.querySelector('#expiry-bell').hidden = !previewAsManager;
if (previewAsManager) setInterval(updateExpiryBell,60000);
const languageSelect = document.querySelector('#store-language');
languageSelect.value = language;
document.documentElement.lang = language === 'ar' ? 'ar-IQ' : 'en';
document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
localize(document.body);
languageSelect.addEventListener('change', () => {
  try {
    localStorage.setItem('lamsa-language',languageSelect.value);
    location.reload();
  } catch {
    languageSelect.value = language;
  }
});
render();
