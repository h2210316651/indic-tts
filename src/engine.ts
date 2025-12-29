import * as ort from 'onnxruntime-web';
import { LANGUAGES, Language, ModelConfig, ModelType, DEFAULT_REPO, DEFAULT_TAG } from './config';
import { Downloader, ProgressCallback } from './downloader';
import { AudioUtils } from './utils';

// Helper for Tokenizer (Basic Char level for VITS)
const BLANK_ID = 0;
function tokenizeVits(text: string, vocab: Record<string, number>): number[] {
    const ids: number[] = [];
    const unk = vocab['<UNK>'] || 0;
    ids.push(BLANK_ID);
    for (const char of text) {
        let cid = unk;
        if (vocab[char] !== undefined) cid = vocab[char];
        else if (char === ' ' && vocab[' ']) cid = vocab[' '];
        ids.push(cid);
        ids.push(BLANK_ID);
    }
    return ids;
}

export interface TTSOptions {
    text: string;
    language: Language;
    speed?: number; // 1.0 default
}

export interface InitOptions {
    onProgress?: ProgressCallback;
}

export class IndicTTS {
    private sessions: Map<string, ort.InferenceSession> = new Map();
    private vocabCache: Record<string, any> = {};
    private downloader = new Downloader();
    private initialized = false;

    // We might need to handle WASM paths for ORT if not standard
    constructor() {
        ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;
        ort.env.wasm.simd = true;
        // Assume standard CDN or user configured path. 
        // ideally user sets ort.env.wasm.wasmPaths if needed.
    }

    async initialize(options?: InitOptions) {
        // Pre-initialization checks or global setup
        this.initialized = true;
    }

    private async loadVitsModel(lang: Language, config: ModelConfig, onProgress?: ProgressCallback) {
        if (this.sessions.has(lang)) return;

        // Download Model
        const modelUrl = this.downloader.getGitHubUrl(config.repo, config.releaseTag, config.files.model);
        const modelData = await this.downloader.getFile(modelUrl, config.files.model, onProgress);

        // Download Vocab
        if (config.files.vocab && !this.vocabCache[lang]) {
            const vocabUrl = this.downloader.getGitHubUrl(config.repo, config.releaseTag, config.files.vocab);
            const vocabData = await this.downloader.getFile(vocabUrl, config.files.vocab); // small, no progress
            const dec = new TextDecoder("utf-8");
            this.vocabCache[lang] = JSON.parse(dec.decode(vocabData));
        }

        // Create Session
        const session = await ort.InferenceSession.create(new Uint8Array(modelData), { executionProviders: ['wasm'] });
        this.sessions.set(lang, session);
    }

    // Piper/Kokoro usually managed by Sherpa-ONNX-WASM.
    // Implementing direct ONNX Runtime for them is complex (custom ops).
    // existing 'app.js' used a WASM blob 'sherpa-onnx-wasm-main-tts.js' + '.wasm'.
    // To make this a pure NPM library, we either:
    // 1. Bundle that WASM (heavy)
    // 2. Fetch that WASM from CDN/GitHub too.

    // For this refactor, we will focus on the VITS (Internal ORT) part primarily as it covers Indic.
    // For English (Piper/Kokoro), we wrap the logic that was in app.js but cleaner.
    // However, app.js logic relied on window.Module and external script loading.
    // We should enable dynamic loading of the Sherpa WASM script.

    private async loadSherpa(onProgress?: ProgressCallback) {
        // Only load once
        if ((window as any).Module && (window as any).Module.onRuntimeInitialized) return;

        console.log("Loading Sherpa-ONNX WASM Runtime...");
        // Real implementation would fetch these from a stable CDN or our assets repo
        // For now, prompt user to ensure these are served or we fetch them?
        // Let's assume we fetch them from the SAME repo as models for convenience?
        // Or unpkg/jsdelivr?

        // For this plan, we assume the user environment has them or we inject script
        // But better is to just return Error if not found, or fetch blobs and create URL.

        // TODO: Full Sherpa Integration implementation is complex for single engine file.
        // We will stub this to use the existing global implementation if present, 
        // or throw "Sherpa Runtime not loaded".

        // Actually, let's implement the VITS logic fully first.
        // And for English, we fallback to VITS if possible? No, we need Piper.
        // We will assume 'sherpa-onnx-wasm-main-tts.js' is available in global scope or loaded via script tag
        // by the USER of this library for now, simplifying the "Library" part to just managing the models/inference.
    }

    async speak(options: TTSOptions): Promise<{ audio: ArrayBuffer, wav: ArrayBuffer, play: () => Promise<void> }> {
        const { text, language, speed = 1.0 } = options;
        const config = LANGUAGES[language];

        if (!config) throw new Error(`Language ${language} not supported.`);

        if (config.type === ModelType.VITS_RASA) {
            await this.loadVitsModel(language, config);

            const session = this.sessions.get(language);
            const vocab = this.vocabCache[language];
            if (!session || !vocab) throw new Error("Model initialization failed.");

            const tokens = tokenizeVits(text, vocab);
            const inputTensor = new ort.Tensor('int64', BigInt64Array.from(tokens.map(x => BigInt(x))), [1, tokens.length]);
            const spkId = config.speakerId !== undefined ? config.speakerId : 0;
            const spkTensor = new ort.Tensor('int64', BigInt64Array.from([BigInt(spkId)]), [1]);
            const emoTensor = new ort.Tensor('int64', BigInt64Array.from([BigInt(0)]), [1]);

            try {
                const results = await session.run({
                    "input_ids": inputTensor,
                    "speaker_id": spkTensor,
                    "emotion_id": emoTensor
                });

                const pcm = results.waveform.data as Float32Array;
                const sampleRate = 22050; // VITS standard

                const wav = AudioUtils.encodeWAV(pcm, sampleRate);

                return {
                    audio: pcm.buffer as ArrayBuffer,
                    wav: wav,
                    play: () => AudioUtils.playAudio(pcm.buffer as ArrayBuffer)
                };

            } catch (e) {
                console.error("Inference Error", e);
                throw e;
            }

        } else {
            // Piper / Kokoro
            // Here we would interface with Sherpa-ONNX-WASM
            // Validating Request:
            // English Models (Piper/Kokoro) are effectively separate engines.
            throw new Error("English/Hindi (Piper/Kokoro) support requires Sherpa-WASM loaded. (Not fully ported in this step yet)");
        }
    }
}
