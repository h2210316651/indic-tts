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
    sherpaBaseUrl?: string;
}

export class IndicTTS {
    private sessions: Map<string, ort.InferenceSession> = new Map();
    private vocabCache: Record<string, any> = {};
    private downloader = new Downloader();
    private initialized = false;
    private sherpaBaseUrl: string | null = null;

    // We might need to handle WASM paths for ORT if not standard
    constructor() {
        ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;
        ort.env.wasm.simd = true;
        // Assume standard CDN or user configured path. 
        // ideally user sets ort.env.wasm.wasmPaths if needed.
    }

    async initialize(options?: InitOptions) {
        // Pre-initialization checks or global setup
        if (options?.sherpaBaseUrl) {
            this.sherpaBaseUrl = options.sherpaBaseUrl;
            // Ensure trailing slash
            if (!this.sherpaBaseUrl.endsWith('/')) {
                this.sherpaBaseUrl += '/';
            }
        }
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

    // Flag to track Sherpa loading state
    private sherpaLoaded = false;
    private sherpaModule: any = null;
    private sherpaTts: any = null;

    private async loadSherpa() {
        if (this.sherpaLoaded) return;

        return new Promise<void>((resolve, reject) => {
            // Check if already in window
            if ((window as any).Module && (window as any).Module.onRuntimeInitialized) {
                this.sherpaModule = (window as any).Module;
                this.sherpaLoaded = true;
                resolve();
                return;
            }

            // Check if script already injected
            if (document.querySelector('script[src*="sherpa-onnx-wasm-main-tts.js"]')) {
                this.waitForSherpaModule(resolve, reject);
                return;
            }

            // Dynamic Injection from GitHub (Raw) or custom base URL
            // We use JSDelivr for global CDN caching and CORS support on the WASM binaries.
            // Note: We moved dist/ files to assets/ in the repo for this purpose.
            const baseUrl = this.sherpaBaseUrl || `https://cdn.jsdelivr.net/gh/${DEFAULT_REPO}@${DEFAULT_TAG}/assets/`;
            const scriptUrl = `${baseUrl}sherpa-onnx-wasm-main-tts.js`;

            const script = document.createElement('script');
            script.src = scriptUrl;

            // Setup Global Module before script loads
            if (!(window as any).Module) {
                (window as any).Module = {
                    onRuntimeInitialized: () => {
                        console.log("Sherpa-ONNX WASM initialized");
                        this.sherpaModule = (window as any).Module;
                        this.sherpaLoaded = true;
                        resolve();
                    },
                    // We need to tell Emscripten where to find the .wasm and .data file
                    // locateFile receives the filename and script directory. 
                    // We want it to fetch from GitHub too.
                    locateFile: (path: string, prefix: string) => {
                        if (path.endsWith('.wasm') || path.endsWith('.data')) {
                            return `${baseUrl}${path}`;
                        }
                        return prefix + path;
                    }
                };
            } else {
                // Hook into existing?
                const oldOnRuntime = (window as any).Module.onRuntimeInitialized;
                (window as any).Module.onRuntimeInitialized = () => {
                    if (oldOnRuntime) oldOnRuntime();
                    this.sherpaModule = (window as any).Module;
                    this.sherpaLoaded = true;
                    resolve();
                };
            }

            script.onerror = (e) => reject(new Error("Failed to load Sherpa Runtime from " + scriptUrl + ": " + e));
            document.body.appendChild(script);
        });
    }

    private waitForSherpaModule(resolve: any, reject: any, retries = 0) {
        if (retries > 50) {
            reject(new Error("Timeout waiting for Sherpa Module initialization"));
            return;
        }
        if ((window as any).Module && (window as any).Module.onRuntimeInitialized) {
            // It might be initialized already or not.
            // If we missed the callback, check if runtime properties exist?
            // Since we can't easily check 'isInitialized' without custom flag, 
            // we might rely on re-hooking or assuming user handled it.
            // For now, let's assume if script is present, Module should be there.
            this.sherpaModule = (window as any).Module;
            this.sherpaLoaded = true;
            resolve();
        } else {
            setTimeout(() => this.waitForSherpaModule(resolve, reject, retries + 1), 100);
        }
    }

    private async prepareSherpaFile(url: string, filename: string) {
        if (!this.sherpaModule) throw new Error("Sherpa Module not loaded");

        // Simple caching in window to avoid re-downloading to FS
        if (!(window as any).downloadedFiles) (window as any).downloadedFiles = new Set();
        if ((window as any).downloadedFiles.has(filename)) return;

        // Fetch
        const buffer = await this.downloader.getFile(url, filename); // Uses our caching downloader!
        const uint8Arr = new Uint8Array(buffer);

        // Write to Virtual FS
        // Handle directories
        if (filename.includes("/")) {
            const parts = filename.split("/");
            const dir = parts.slice(0, -1).join("/");
            const name = parts[parts.length - 1];

            try {
                this.sherpaModule.FS_createPath("/", dir, true, true);
            } catch (e) { /* Assume exists */ }

            try {
                this.sherpaModule.FS_createDataFile(dir, name, uint8Arr, true, true, true);
            } catch (e) { console.log("File write error (might exist):", e); }
        } else {
            try {
                this.sherpaModule.FS_createDataFile("/", filename, uint8Arr, true, true, true);
            } catch (e) { console.log("File write error (might exist):", e); }
        }

        (window as any).downloadedFiles.add(filename);
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
                const sampleRate = 22050;
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
            await this.loadSherpa();

            // Prepare files
            // Config usually has 'files' object with model, vocab (tokens), potentially voices/json
            const files = config.files;

            // Helper to get URL
            const getUrl = (f: string) => this.downloader.getGitHubUrl(config.repo, config.releaseTag, f);

            // Download and write all files
            if (files.model) await this.prepareSherpaFile(getUrl(files.model), files.model);
            if (files.vocab) await this.prepareSherpaFile(getUrl(files.vocab), files.vocab); // tokens
            if (files.voices) await this.prepareSherpaFile(getUrl(files.voices), files.voices); // voices.bin or json? config.ts has generic 'files' map

            // Determine Sherpa Config based on ModelType
            let sherpaConfig: any = {};

            if (config.type === ModelType.KOKORO) {
                // Kokoro specific config structure
                const dataDir = ''; // Default populated by .data file usually?
                sherpaConfig = {
                    offlineTtsModelConfig: {
                        offlineTtsKokoroModelConfig: {
                            model: files.model,
                            tokens: files.vocab,
                            dataDir: dataDir,
                            voices: files.voices || "kokoro-en-v0_19/voices.bin", // fallbacks if needed?
                        },
                        provider: 'cpu', // wasm usually cpu or simple
                        numThreads: 1,
                        debug: 1
                    }
                };
            } else if (config.type === ModelType.PIPER) {
                sherpaConfig = {
                    offlineTtsModelConfig: {
                        offlineTtsVitsModelConfig: {
                            model: files.model,
                            tokens: files.vocab, // Piper uses .json config as 'tokens' arg usually? 
                            // Wait, app.js said: model: modelFile, tokens: jsonFile
                            dataDir: './espeak-ng-data'
                        },
                        provider: 'piper',
                        numThreads: 1
                    }
                };
            }

            // Re-create engine if needed
            // NOTE: Sherpa engine creation might be expensive. We should cache it if possible, 
            // BUT switching languages might require re-creating if config changes drastically.
            // For now, simple approach: free previous, create new.
            if (this.sherpaTts) {
                this.sherpaTts.free();
                this.sherpaTts = null;
            }

            // Global function from script
            const createFn = (window as any).createOfflineTts;
            if (!createFn) throw new Error("createOfflineTts function not found in global scope.");

            this.sherpaTts = createFn(this.sherpaModule, sherpaConfig);

            // Generate
            // Piper/Kokoro args might vary? app.js used same generate call.
            const result = this.sherpaTts.generate({
                text: text,
                sid: 0, // usually 0 for single speaker?
                speed: speed
            });

            // Result: .samples (Float32Array), .sampleRate
            const audioData = result.samples;
            const sampleRate = result.sampleRate;

            // Copy to new buffer to avoid WASM memory issues? 
            // Float32Array from WASM is view, usually valid until free.
            const pcm = new Float32Array(audioData);
            const wav = AudioUtils.encodeWAV(pcm, sampleRate);

            return {
                audio: pcm.buffer as ArrayBuffer,
                wav: wav,
                play: () => AudioUtils.playAudio(pcm.buffer as ArrayBuffer)
            };
        }
    }
}
