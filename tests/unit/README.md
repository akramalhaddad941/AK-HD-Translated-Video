# اختبارات الوحدات

هذا المجلد يحتوي على اختبارات الوحدات لجميع المكونات.

## الملفات

### Background Service
- `background/` - اختبارات Service Worker
  - `main.test.ts`
  - `message-handler.test.ts`
  - `state-manager.test.ts`

### Core System
- `core/` - اختبارات النواة
  - `engine.test.ts`
  - `expert-system.test.ts`
  - `event-dispatcher.test.ts`

### Services
- `services/` - اختبارات الخدمات
  - `stt/` - اختبارات STT
  - `translation/` - اختبارات الترجمة
  - `audio/` - اختبارات الصوت

### UI Components
- `ui/` - اختبارات واجهة المستخدم
  - `components/` - مكونات React
  - `hooks/` - React Hooks
  - `contexts/` - Context Providers

## معايير الاختبار

- تغطية اختبار 85%+
- اختبارات سريعة (< 500ms)
- اختبار الحالات الحدية
- اختبار الأخطاء والاستثناءات