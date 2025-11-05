# ملفات الاختبارات

هذا المجلد يحتوي على جميع اختبارات المشروع.

## بنية الاختبارات

```
tests/
├── unit/           # اختبارات الوحدات
├── integration/    # اختبارات التكامل
└── e2e/           # اختبارات النهاية لنهاية
```

## الملفات المشتركة

- `setup.ts` - إعدادات Jest
- `matchers.ts` - Jest Matchers مخصصة
- `test-utils.tsx` - دوال مساعدة للاختبارات
- `mocks/` - ملفات التجميع (mocks)

## تقنيات الاختبار

- Jest للاختبارات
- Testing Library للاختبارات
- React Testing Component
- MSW للـ API mocking
- @testing-library/user-event