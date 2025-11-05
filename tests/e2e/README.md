# اختبارات النهاية لنهاية

هذا المجلد يحتوي على اختبارات E2E الكاملة.

## الملفات

### User Workflows
- `workflows/` - تدفقات المستخدم
  - `basic-translation.test.ts`
  - `expert-selection.test.ts`
  - `settings-customization.test.ts`

### Cross-site Testing
- `cross-site/` - اختبار عبر المواقع
  - `youtube.test.ts`
  - `netflix.test.ts`
  - `general-video.test.ts`

### Performance Testing
- `performance/` - اختبارات الأداء
  - `memory-usage.test.ts`
  - `response-time.test.ts`
  - `concurrent-users.test.ts`

## بيئات الاختبار

- Chrome (الإصدار الأحدث)
- Firefox (إصدار Chrome Extension API)
- Edge (Chromium-based)

## معايير الاختبار

- وقت تحميل الصفحة < 3 ثواني
- وقت الاستجابة < 500ms
- استهلاك الذاكرة < 100MB
- لا تسريبات للذاكرة