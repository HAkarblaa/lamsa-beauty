const categories = [
  ['face', 'مكياج الوجه'], ['eyes', 'العيون'], ['lips', 'الشفاه'],
  ['skin', 'العناية بالبشرة'], ['brushes', 'الفرش والأدوات'], ['offers', 'العروض']
];
const products = [
  {id:'foundation', category:'face', name:'كريم أساس بتغطية عالية', price:22500, old:30000, image:'foundation', shades:['بيج فاتح','بيج متوسط','بيج داكن']},
  {id:'palette', category:'eyes', name:'باليت ظلال عيون', price:28000, old:37500, image:'palette'},
  {id:'lipstick', category:'lips', name:'روج مطفي', price:12000, old:16000, image:'lipstick', detail:'hero-lip', shades:['أحمر كلاسيكي','وردي غامق','بني دافئ','نود طبيعي']},
  {id:'serum', category:'skin', name:'سيروم مرطب للبشرة', price:24000, image:'skin'},
  {id:'brush', category:'brushes', name:'مجموعة فرش مكياج', price:19500, image:'brushes'},
  {id:'liner', category:'eyes', name:'آيلاينر أسود', price:9500, image:'eyes'},
  ...['أحمر كلاسيكي','وردي لؤلؤي','وردي طبيعي','بيج نود','عنابي','خوخي','بني ترابي','فوشيا','مرجاني'].map((shade,i) => ({
    id:'lip-'+i, category:'lips', name:([1,3,5,7].includes(i)?'ملمع شفاه ':'أحمر شفاه ') + shade,
    price:[1,3,5,7].includes(i)?14000:18000, image:'lip-'+i
  }))
];
const banners = [
  {title:'خصم 25% على منتجات مختارة', copy:'تسوّقي عروض المكياج', image:'banner', route:'shop/offers'},
  {title:'ألوان تناسب كل إطلالة', copy:'اكتشفي منتجات الشفاه', image:'lips', route:'shop/lips'},
  {title:'فرش وأدوات المكياج', copy:'تسوّقي الأدوات', image:'brushes', route:'shop/brushes'}
];
