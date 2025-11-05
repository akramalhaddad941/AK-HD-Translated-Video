# خدمات STT والترجمة

هذا المجلد يحتوي على جميع خدمات التعرف على الكلام والترجمة.

## الملفات

### Speech-to-Text Services
- `stt/` - خدمات التعرف على الكلام
  - `web-speech-api.ts` - Web Speech API
  - `google-stt.ts` - Google Cloud Speech-to-Text
  - `azure-stt.ts` - Microsoft Azure Speech
  - `amazon-transcribe.ts` - Amazon Transcribe
  - `whisper.ts` - OpenAI Whisper
  - `deepspeech.ts` - Mozilla DeepSpeech

### Translation Services
- `translation/` - خدمات الترجمة
  - `google-translate.ts` - Google Translate
  - `deepl.ts` - DeepL
  - `azure-translator.ts` - Microsoft Translator
  - `libretranslate.ts` - LibreTranslate
  - `openai-gpt.ts` - OpenAI GPT
  - `mymemory.ts` - MyMemory
  - `apertium.ts` - Apertium

### Audio Processing
- `audio/` - معالجة الصوت
  - `recorder.ts` - مسجل الصوت
  - `processor.ts` - معالج الصوت
  - `analyzer.ts` - محلل الصوت

## المسؤوليات

- استقبال وتشغيل الصوت
- تحويل الصوت إلى نص
- ترجمة النصوص
- دمج مع خدمات خارجية
- إدارة API keys
- تحسين جودة النتائج