const contentKey = 'lamsa-custom-content-v1';
const customContent = {categories:[], products:[], banners:[]};
try {
  const savedContent = JSON.parse(localStorage.getItem(contentKey));
  for (const kind of Object.keys(customContent)) {
    if (Array.isArray(savedContent?.[kind])) customContent[kind] = savedContent[kind];
  }
} catch {
  // The original catalog remains available if local storage is unavailable.
}
categories.push(...customContent.categories);
products.push(...customContent.products);
banners.push(...customContent.banners);

function managementPage() {
  if (!previewAsManager) return '<h1>إدارة المتجر</h1><a href="#home">الرئيسية</a>';
  const options = categories.map(([id,name]) =>
    '<option value="' + id + '">' + escape(name) + '</option>'
  ).join('');
  const image = '<label>الصورة<input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required></label>';
  const name = '<label>الاسم<input name="name" maxlength="80" required></label>';
  return `<section class="narrow">
    <h1>إدارة محتوى المتجر</h1>
    <p class="muted">الإضافات التجريبية تُحفظ في هذا المتصفح. اختار صورة من الجهاز لكل إضافة.</p>
    <div class="chips"><a href="#categories" class="button secondary">عرض الأقسام</a>
    <a href="#shop" class="button secondary">عرض المنتجات</a>
    <a href="#home" class="button secondary">عرض شريط الإعلانات</a></div>
    <form class="panel" data-content="categories">
      <h2>إضافة قسم</h2>${name}${image}<button>إضافة القسم</button>
    </form>
    <form class="panel" data-content="products">
      <h2>إضافة منتج</h2>${name}
      <label>القسم<select name="category" required><option value="">اختار القسم</option>${options}</select></label>
      <label>السعر بالدينار العراقي<input type="number" name="price" min="1" max="1000000000" required></label>
      <label>وصف المنتج<textarea name="description" maxlength="600"></textarea></label>
      ${image}<button>إضافة المنتج</button>
    </form>
    <form class="panel" data-content="banners">
      <h2>إضافة صورة لشريط الإعلانات المتحرك</h2>
      <label>عنوان الإعلان<input name="name" maxlength="80" required></label>
      <label>نص زر الإعلان<input name="copy" maxlength="40" required></label>
      <label>القسم اللي يفتحه الإعلان<select name="category" required>${options}</select></label>
      ${image}<button>إضافة الإعلان</button>
    </form>
  </section>`;
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
  const name = data.get('name').trim();
  const category = data.get('category');
  const copy = data.get('copy')?.trim();
  const price = Number(data.get('price'));
  if (!name || (kind === 'banners' && !copy)) {
    notify('اكتب الاسم ونص الإعلان المطلوب.');
    return;
  }
  const button = form.querySelector('button');
  if (button.disabled) return;
  button.disabled = true;
  try {
    const image = await readCatalogImage(data.get('image'));
    const id = 'custom-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    let item;
    if (kind === 'categories') {
      item = [id,name,image];
    } else if (kind === 'products') {
      item = {id, name, category, price, image, description:data.get('description').trim()};
    } else {
      item = {title:name, copy, image, route:'shop/' + category};
    }

    const next = [...customContent[kind],item];
    try { localStorage.setItem(contentKey, JSON.stringify({...customContent, [kind]:next})); }
    catch { throw new Error('تعذّر الحفظ بالمتصفح. جرّب صورة أصغر أو وفّر مساحة إضافية.'); }

    customContent[kind] = next;
    ({categories,products,banners})[kind].push(item);
    if (kind === 'banners') slide = banners.length - 1;
    if (form.isConnected) render();
    notify('تمت الإضافة بنجاح');
  } catch (error) {
    notify(error.message || 'تعذّرت الإضافة.');
  } finally {
    button.disabled = false;
  }
}
