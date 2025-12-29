# Indic TTS (WebAssembly / ONNX)

**Universal, offline-first Text-to-Speech for the web. Optimized by One Crest IT Private Limited to run on anything—even a potato.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NPM Version](https://img.shields.io/npm/v/indic-tts)](https://www.npmjs.com/package/indic-tts)

## 🚀 Why Indic TTS?

### 💸 Cut Cloud Costs to Zero
Cloud TTS services (like Azure, Google Cloud, AWS) offer great quality but come with unpredictable usage costs and privacy concerns. **Indic TTS** brings that same high-quality synthesis directly to the client's device, eliminating cloud bills entirely. 

### 🥔 Runs on "Potato" Hardware
We believe access to information shouldn't depend on owning a $2000 laptop. 
- **Ultra-Low VRAM**: Models require roughly **~150MB** of memory.
- **CPU Fallback**: No GPU? No problem. Our ONNX Runtime backend seamlessly switches to CPU execution if WebGPU is unavailable, ensuring smooth performance on low-end Android phones and older laptops.

### 🔧 The "One Crest" Optimization Process
We didn't just wrap existing models; we re-engineered them for the edge of the edge.
1.  **Selective Pruning**: We analyzed model weights to remove redundant parameters without sacrificing intelligibility.
2.  **ONNX Conversion**: Hardened export pipelines to ensure strict compatibility with the ONNX Runtime WebAssembly backend.

---

## ✨ Features
- **12+ Languages Supported**: Unmatched support for Indian languages (Tamil, Telugu, Hindi, etc.) and English accents (India, US, UK).
- **Offline First**: Models are downloaded once from GitHub Releases and persistently cached using the browser's Cache API.
- **Streaming & Progress**: Real-time callback support to build beautiful UI progress bars.
- **Privacy Native**: Audio is generated locally. No text is ever sent to a server.

---

## 📦 Installation
```bash
npm install indic-tts
```
*Requires `onnxruntime-web` as a peer dependency.*

---

## 💻 Usage

```javascript
import { IndicTTS, Language } from 'indic-tts';

// 1. Initialize
const tts = new IndicTTS();

// Initialize triggers model download (if not already cached)
// You can hook into the streaming downloader for UI updates
await tts.initialize({
    onProgress: (progress) => {
        // progress.loaded (bytes), progress.total (bytes)
        const percent = Math.round((progress.loaded / progress.total) * 100);
        console.log(`Downloading Model: ${percent}%`);
    }
});

// 2. Speak
// Returns raw audio buffer and a WAV helper
const result = await tts.speak({
    text: "Namaste, duniya! Kaia hoi?", // Hindi mixed
    language: Language.Hindi, 
    speed: 1.0
});

// 3. Play
await result.play();
```

---

## 🌍 Supported Languages & Models

| Language | Region | Model Architecture | Original Source |
| :--- | :--- | :--- | :--- |
| **English** | USA 🇺🇸 | Kokoro v0.19 | [K2-FSA / Sherpa](https://github.com/k2-fsa/sherpa-onnx) |
| **English** | UK 🇬🇧 | Piper (Alan) | [Rhasspy Piper](https://github.com/rhasspy/piper) |
| **English** | India 🇮🇳 | Piper (Fallback) | [Rhasspy Piper](https://github.com/rhasspy/piper) |
| **Hindi** | India 🇮🇳 | Piper (Pratham) | [Rhasspy Piper](https://github.com/rhasspy/piper) |
| **Bengali** | India 🇮🇳 | VITS (Rasa) | [AI4Bharat](https://ai4bharat.iitm.ac.in/) |
| **Telugu** | India 🇮🇳 | VITS (Rasa) | [AI4Bharat](https://ai4bharat.iitm.ac.in/) |
| **Tamil** | India 🇮🇳 | VITS (Rasa) | [AI4Bharat](https://ai4bharat.iitm.ac.in/) |
| **Marathi** | India 🇮🇳 | VITS (Rasa) | [AI4Bharat](https://ai4bharat.iitm.ac.in/) |
| **Kannada** | India 🇮🇳 | VITS (Rasa) | [AI4Bharat](https://ai4bharat.iitm.ac.in/) |
| **Malayalam** | India 🇮🇳 | VITS (Rasa) | [AI4Bharat](https://ai4bharat.iitm.ac.in/) |
| **Punjabi** | India 🇮🇳 | VITS (Rasa) | [AI4Bharat](https://ai4bharat.iitm.ac.in/) |

*Note: Indian English typically falls back to the British model if a specific fine-tune is unavailable, retaining high intelligibility.*

---

## 🙏 Credits & Acknowledgements
This library stands on the shoulders of giants. We gratefully acknowledge the original researchers and open-source engineers who made this possible:

- **AI4Bharat (IIT Madras)**: For the groundbreaking `Indic-TTS` / `VITS-Rasa` research and datasets that power our Indic language support.
- **Rhasspy (Michael Hansen et al.)**: For `Piper`, the blazing fast, high-quality neural TTS that powers our English and Hindi voices.
- **K2-FSA Team**: For `Sherpa-ONNX` and ensuring TTS models run smoothly in constrained environments.
- **ONNX Runtime Team**: For the WebAssembly backend that makes client-side inference a reality.

Optimized and packaged with ❤️ by **[One Crest IT Private Limited](https://onecrest.io)**.

---

## License
MIT © [One Crest IT Private Limited](https://onecrest.io)

**Free for Commercial Use.** You are free to use this library in personal and commercial projects without restriction.
