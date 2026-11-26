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
let slide = 0;
let timer;
let noticeTimer;

function save() {
  localStorage.setItem(key, JSON.stringify(state));
  updateNavigation();
}
function notify(message) {
  notice.textContent = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.textContent = ''; }, 2400);
}
function route() {
  const [path, param] = (location.hash.slice(1) || 'home').split('/');
  return {path, param};
}
function updateNavigation() {
  const {path} = route();
  const tab = ({shop:'categories',product:'categories',checkout:'cart',login:'account',signup:'account',
    orders:'account',manage:'account',profile:'account',settings:'account',order:'account'})[path] || path;
  document.querySelectorAll('nav a').forEach(link => {
    if (link.hash === '#' + tab) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
  const count = state.cart.reduce((total,line) => total + line.qty,0);
  document.querySelector('#count').textContent = count ? '(' + format.format(count) + ')' : '';
}
function cards(items) {
  return items.length ? '<div class="grid">' + items.map(p =>
    '<article class="card"><a href="#product/' + p.id + '">' + photo(p.image,p.name) +
    '<strong>' + escape(p.name) + '</strong></a><span class="price">' + money(p.price) +
    (p.old ? '<del>' + money(p.old) + '</del>' : '') +
    '</span><button data-add="' + p.id + '">أضيفي للسلة</button></article>').join('') +
    '</div>' : '<p class="panel">ماكو منتجات للعرض حالياً.</p>';
}
function categoryCards() {
  return '<div class="grid categories">' + categories.map(([id,name,image]) =>
    '<a class="card" href="#shop/' + id + '">' + photo(image || id) + '<strong>' + escape(name) + '</strong></a>'
  ).join('') + '</div>';
}
function searchBox() {
  return '<label class="search">بحث المنتجات<input id="search" type="search" placeholder="ابحثي عن منتج…"></label>';
}
function updateBanner() {
  const banner = document.querySelector('#banner');
  if (!banner) return;
  const b = banners[slide];
  banner.innerHTML = '<a class="hero" href="#' + b.route + '"><div><h1>' + escape(b.title) +
    '</h1><span class="button">' + escape(b.copy) + '</span></div>' + photo(b.image) + '</a>';
  document.querySelectorAll('[data-slide]').forEach((button,i) =>
    button.setAttribute('aria-pressed',String(i === slide)));
}
function home() {
  return searchBox() + '<div id="home-content"><div id="banner"></div><div class="dots" aria-label="العروض">' +
    banners.map((_,i) => '<button data-slide="' + i + '" aria-label="عرض ' + (i+1) + '"></button>').join('') +
    '</div><div class="strip">توصيل لكل المحافظات</div><div class="row"><h2>الأقسام</h2><a href="#categories">عرض الكل</a></div>' +
    '<div class="chips">' + categories.map(([id,name]) => '<a class="button secondary" href="#shop/' + id + '">' + escape(name) + '</a>').join('') +
    '</div><h2>عروض مميزة</h2>' + cards(products.filter(p => p.old || p.category === 'offers')) + '</div><div id="results" hidden></div>';
}
function shop(id) {
  const category = categories.find(row => row[0] === id);
  return '<h1>' + escape(category?.[1] || 'كل المنتجات') + '</h1>' + searchBox() +
    '<label>ترتيب المنتجات<select id="sort"><option value="">الافتراضي</option><option value="low">السعر من الأقل</option>' +
    '<option value="high">السعر من الأعلى</option></select></label><div id="results"></div>';
}
function updateResults() {
  const results = document.querySelector('#results');
  if (!results) return;
  const {path,param} = route();
  const query = document.querySelector('#search').value.trim();
  if (path === 'home') {
    document.querySelector('#home-content').hidden = Boolean(query);
    results.hidden = !query;
    if (!query) return;
  }
  const list = products.filter(p => (!param || (p.category === param || (param === 'offers' && p.old))) && p.name.includes(query));
  const sort = document.querySelector('#sort')?.value;
  if (sort) list.sort((a,b) => sort === 'low' ? a.price-b.price : b.price-a.price);
  results.innerHTML = cards(list);
}
function detail(id) {
  const p = products.find(item => item.id === id);
  if (!p) return '<h1>المنتج غير موجود</h1>';
  const shades = ['#a3283f','#b35470','#97594e','#c58d7a'];
  return '<section class="narrow"><h1>' + escape(p.name) + '</h1>' + photo(p.detail || p.image,p.name,'detail') +
    '<div class="row"><h2>' + money(p.price) + '</h2><button class="secondary" data-favorite="' + p.id +
    '">' + (state.favorites.includes(p.id) ? '♥ إزالة من المفضلة' : '♡ إضافة للمفضلة') + '</button></div>' +
    (p.description ? '<p class="panel">' + escape(p.description) + '</p>' : '') +
    '<form id="add-form" data-product="' + p.id + '">' +
    (p.shades ? '<fieldset class="panel"><legend>اختاري الدرجة</legend>' + p.shades.map((shade,i) =>
      '<label><input type="radio" name="shade" value="' + shade + '" ' + (i === 0 ? 'checked' : '') +
      '><span class="swatch" style="background:' + shades[i] + '"></span>' + shade + '</label>').join('') + '</fieldset>' : '') +
    '<label>الكمية<input name="qty" type="number" min="1" max="99" value="1" required></label>' +
    '<button class="full">أضيفي للسلة</button></form></section>';
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
    return '<div class="panel row">' + photo(p.image,p.name,'thumb') + '<div class="grow"><strong>' + escape(p.name) +
      '</strong><br>' + escape(line.shade) + '<br>' + money(p.price*line.qty) + '</div><div>' +
      '<button class="secondary" data-quantity="' + i + '/1" aria-label="زيادة الكمية">+</button> ' + format.format(line.qty) +
      ' <button class="secondary" data-quantity="' + i + '/-1" aria-label="تقليل الكمية">−</button><br>' +
      '<button class="secondary" data-remove="' + i + '">حذف</button></div></div>';
  }).join('');
  return '<h1>السلة</h1>' + lines + '<form class="panel" id="coupon"><label>رمز الخصم<input name="coupon" placeholder="BEAUTY10" ' +
    (state.coupon ? 'value="BEAUTY10"' : '') + '></label><button>تطبيق</button></form>' + summary() +
    '<a class="button full" href="#checkout">إكمال الطلب</a>';
}
const provinces = ['بغداد','البصرة','نينوى','أربيل','السليمانية','دهوك','كركوك','الأنبار','صلاح الدين','ديالى','واسط','بابل','كربلاء','النجف','القادسية','المثنى','ذي قار','ميسان','حلبجة'];
function checkout() {
  if (!state.cart.length) return cart();
  return '<section class="narrow"><h1>إتمام الطلب</h1><form id="checkout"><div class="panel"><h2>بيانات الاستلام</h2>' +
    '<p class="muted">طلب تجريبي. استخدمي بيانات وهمية.</p>' +
    '<label>الاسم الكامل<input name="name" required maxlength="80"></label>' +
    '<label>رقم الهاتف<input name="phone" type="tel" inputmode="tel" pattern="[+0-9٠-٩ ]{8,16}" required></label>' +
    '<label>المحافظة<select name="province" required><option value="">اختاري المحافظة</option>' +
    provinces.map(p => '<option>' + p + '</option>').join('') + '</select></label>' +
    '<label>المنطقة والعنوان<textarea name="address" required maxlength="200">' +
    escape(state.profile?.address || '') + '</textarea></label></div>' +
    '<div class="panel"><h2>طريقة الدفع</h2>الدفع عند الاستلام</div>' +
    (state.settings.contact ? '<p>تواصل المتجر: ' + escape(state.settings.contact) + '</p>' : '') + summary() +
    '<button class="full">تأكيد الطلب</button></form></section>';
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
  return '<h1>إعدادات المتجر</h1><form class="panel narrow" id="store-settings">' +
    '<label>اسم المتجر<input name="name" value="' + escape(name) + '" maxlength="60" required></label>' +
    '<label>معلومات التواصل<input name="contact" value="' + escape(contact) + '" maxlength="120"></label>' +
    '<label>رسوم التوصيل بالدينار العراقي<input name="delivery" type="number" min="0" max="1000000" value="' +
    delivery + '" required></label><button>حفظ</button></form>';
}
function account() {
  if (previewAsManager) return '<h1>حسابي</h1><div class="panel"><h2>' +
    escape(state.settings.name) + '</h2><span class="status">مدير المتجر</span></div>' +
    '<a class="button" href="#settings">إعدادات المتجر</a> <a class="button secondary" href="#orders">إدارة الطلبات</a> <a class="button secondary" href="#manage">إدارة محتوى المتجر</a>';
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
  if (!id) return '<h1>' + orderLabel + '</h1>' + (state.orders.length ? state.orders.map(order =>
    '<a class="panel row order-list-row" href="#order/' + escape(order.id) + '"><span>طلب <bdi>#' + escape(order.id) +
    '</bdi></span><span>' + money(order.total) + '</span><span class="status">' +
    orderStatuses[order.status || 'confirmed'] + '</span></a>').join('') : '<p>ماكو طلبات حالياً.</p>');
  const order = state.orders.find(item => item.id === id);
  if (!order) return '<h1>الطلب غير موجود</h1>';
  const status = order.status || 'confirmed';
  const editor = previewAsManager ? '<form class="panel" id="order-status" data-order="' + escape(id) +
    '"><label>حالة الطلب<select name="status">' + Object.entries(orderStatuses).map(([value,label]) =>
      '<option value="' + value + '"' + (value === status ? ' selected' : '') + '>' + label + '</option>'
    ).join('') + '</select></label><button>حفظ الحالة</button></form>' : '';
  return '<h1>' + orderStatuses[status] + '</h1><div class="panel"><p>رقم الطلب <bdi>#' + escape(order.id) + '</bdi></p>' +
    '<p>المحافظة ' + escape(order.province) + '</p><p>الإجمالي ' + money(order.total) +
    '</p><p>الدفع عند الاستلام</p><p class="muted">طلب تجريبي محفوظ على هذا الجهاز.</p></div>' +
    editor + '<a class="button" href="#orders">' + orderLabel + '</a>';
}
function render(scroll = false) {
  const {path,param} = route();
  clearInterval(timer);
  const pages = {home, categories:() => '<h1>الأقسام</h1><div class="strip">توصيل لكل المحافظات</div><br>' + categoryCards(),
    shop:() => shop(param), product:() => detail(param), cart, checkout, login:() => login(), signup:() => login(true),
    account, profile, settings, manage:managementPage, favorites:() => '<h1>المفضلة</h1>' + cards(products.filter(p => state.favorites.includes(p.id))),
    orders:() => orderContent(), order:() => orderContent(param)};
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
  document.title = state.settings.name;
  document.querySelector('#store-brand').lastChild.textContent = ' ' + state.settings.name;
  updateNavigation();
  if (scroll) window.scrollTo(0,0);
}
function addProduct(id, shade, qty) {
  const p = products.find(product => product.id === id);
  const chosen = shade || p.shades?.[0] || '';
  const line = state.cart.find(item => item.id === id && item.shade === chosen);
  if (line) line.qty = Math.min(99,line.qty + qty);
  else state.cart.push({id,shade:chosen,qty});
  save();
  notify('تمت إضافة المنتج للسلة');
}
view.addEventListener('input', event => {
  if (event.target.id === 'search' || event.target.id === 'sort') updateResults();
});
view.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const data = button.dataset;
  if (data.add) addProduct(data.add,'',1);
  if (data.slide !== undefined) { slide = Number(data.slide); updateBanner(); }
  if (data.favorite) {
    const id = data.favorite;
    state.favorites = state.favorites.includes(id) ? state.favorites.filter(item => item !== id) : [...state.favorites,id];
  } else if (data.quantity) {
    const [index,delta] = data.quantity.split('/').map(Number);
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
    const order = {id:String(Date.now()), province:data.get('province'), total:totals().total};
    state.orders.unshift(order);
    state.cart = [];
    state.coupon = false;
    save();
    location.hash = 'order/' + order.id;
  } else if (form.id === 'login' || form.id === 'signup') {
    state.profile = {name:data.get('name')?.trim() || 'متسوّقة لمسة بيوتي',identifier:data.get('identifier').trim()};
    save();
    location.hash = 'account';
  } else if (form.id === 'store-settings' && previewAsManager) {
    const name = data.get('name').trim();
    if (!name) { notify('اكتب اسم المتجر'); return; }
    state.settings = {name, contact:data.get('contact').trim(), delivery:Number(data.get('delivery'))};
    save();
    render();
    notify('تم حفظ إعدادات المتجر');
  } else if (form.id === 'order-status' && previewAsManager) {
    const order = state.orders.find(item => item.id === form.dataset.order);
    const status = data.get('status');
    if (!order || !Object.hasOwn(orderStatuses,status)) return;
    order.status = status;
    save();
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
  menuHeading.textContent = show ? 'الأقسام' : 'القائمة المختصرة';
}
menuCategories.addEventListener('click', () => {
  document.querySelector('#menu-section-links').innerHTML = categories.map(([id,name]) =>
    '<li><a href="#shop/' + id + '">' + escape(name) + '</a></li>'
  ).join('');
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
    ? state.settings.name : state.profile?.name || '';
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
window.addEventListener('hashchange', () => {
  if (quickMenu.open) quickMenu.close();
  render(true);
});
render();
