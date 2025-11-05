# المصدر الرئيسي للمشروع

هذا المجلد يحتوي على جميع ملفات المصدر لإضافة الترجمة الفورية للفيديو.

## بنية المجلدات

```
src/
├── background/          # Service Worker وعمليات الخلفية
├── content/             # Content Scripts لفحص الفيديو
├── ui/                  # واجهة المستخدم
├── core/                # النواة الأساسية للنظام
├── services/            # خدمات STT والترجمة
├── types/               # تعريفات TypeScript
├── utils/               # دوال مساعدة
└── assets/              # الصور والأيقونات
```

## الملفات الرئيسية

- `background/main.ts` - Service Worker الأساسي
- `content/main.ts` - Content Script للفيديو
- `ui/popup.tsx` - نافذة الإضافة المنبثقة
- `ui/options.tsx` - صفحة الإعدادات
- `core/` - النواة المنطقية للنظام
- `services/` - خدمات الترجمة والتعرف على الكلام