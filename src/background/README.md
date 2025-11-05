# Service Worker - العمليات الخلفية

هذا المجلد يحتوي على ملفات Service Worker التي تعمل في الخلفية.

## الملفات

- `main.ts` - الملف الرئيسي للـ Service Worker
- `message-handler.ts` - معالج الرسائل بين المكونات
- `state-manager.ts` - إدارة الحالة العامة
- `error-handler.ts` - معالج الأخطاء
- `permissions-manager.ts` - إدارة الصلاحيات

## الواجبات

- إدارة دورة حياة الإضافة
- التواصل مع Content Scripts
- تخزين البيانات محلياً
- معالجة إشعارات النظام
- إدارة API keys بشكل آمن