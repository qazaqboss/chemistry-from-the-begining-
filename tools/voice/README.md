# Озвучка голосового гида

Голос гида — нейросеть [OmniVoice](https://github.com/k2-fsa/OmniVoice) (навык
[VoiceStudio](https://github.com/debpalash/VoiceStudio)). Все фразы клонируются
из одного эталона `ref.wav` (голос создан OmniVoice по описанию
«female, young adult, moderate pitch»), поэтому голос везде одинаковый.
Экскурсия «Покажи мне всё» озвучена отдельно (ElevenLabs, `audio/tour/`).

1. Запустить сайт: `python3 -m http.server 8765` в корне.
2. Собрать все фразы гида: `SP=tools/voice node tools/voice/corpus.cjs` → `corpus.json`.
3. Озвучить (`pip install omnivoice num2words audioop-lts`):
   `python tools/voice/gen.py 1` — экскурсии, словарь и уроки;
   `python tools/voice/gen.py 3` — плюс страницы элементов. Готовые фразы пропускаются.
4. Собрать файлы: `python tools/voice/build.py audio/voice`.

Фраза ищется по хешу FNV-1a текста после `toSpeech()` (js/guide.js), так что
после правки текстов достаточно повторить шаги 2–4: озвучатся только новые фразы.
