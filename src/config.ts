export enum ModelType {
    VITS_RASA = 'vits_rasa',
    PIPER = 'piper',
    KOKORO = 'kokoro'
}

export enum Language {
    EnglishUS = 'en-US',
    EnglishUK = 'en-GB',
    EnglishIndia = 'en-IN',
    Hindi = 'hi-IN',
    Bengali = 'bn-IN',
    Telugu = 'te-IN',
    Tamil = 'ta-IN',
    Marathi = 'mr-IN',
    Kannada = 'kn-IN',
    Malayalam = 'ml-IN',
    Punjabi = 'pa-IN'
}

export interface ModelConfig {
    type: ModelType;
    repo: string; // Formatting: "owner/repo"
    releaseTag: string;
    files: {
        model: string;
        config?: string; // JSON for piper/kokoro
        vocab?: string; // Vocab for VITS
        tokens?: string; // Tokens for Kokoro
        voices?: string; // Voices bin for Kokoro
        data?: string; // Data bin for Sherpa
    };
    speakerId?: number; // For multi-speaker VITS
}

export const LANGUAGES: Record<Language, ModelConfig> = {
    [Language.EnglishUS]: {
        type: ModelType.KOKORO,
        repo: "k2-fsa/sherpa-onnx",
        releaseTag: "tts-models",
        files: {
            model: "kokoro-en-v0_19/model.onnx",
            tokens: "kokoro-en-v0_19/tokens.txt",
            voices: "kokoro-en-v0_19/voices.bin",
            // Data file usually handled separately or embedded, but we might likely need espeak-ng-data
        }
    },
    [Language.EnglishUK]: {
        type: ModelType.PIPER,
        repo: "rhasspy/piper-voices",
        // Note: Piper voices often have complex paths. 
        // We might need a custom URL or re-host them on our own GitHub release for uniformity.
        // For this task, let's assume we upload them to OUR release for simplicity ("indic-tts-assets").
        releaseTag: "v1.0.0",
        files: {
            model: "en_GB-alan-medium.onnx",
            config: "en_GB-alan-medium.onnx.json",
            // Piper WASM also needs espeak-ng-data
        }
    },
    [Language.EnglishIndia]: {
        type: ModelType.PIPER,
        repo: "h2210316651/indic-tts", // Placeholder for where we upload
        releaseTag: "v1.0.0",
        files: {
            // Fallback to GB per user instruction
            model: "en_GB-alan-medium.onnx",
            config: "en_GB-alan-medium.onnx.json"
        }
    },
    [Language.Hindi]: {
        type: ModelType.PIPER,
        repo: "h2210316651/indic-tts",
        releaseTag: "v1.0.0",
        files: {
            model: "hi_IN-pratham-medium.onnx",
            config: "hi_IN-pratham-medium.onnx.json"
        }
    },
    // Indic VITS Models (consolidated in one file usually, but we can treat as individual if split, or same file)
    // The current setup uses a single "vits_rasa_13_int8.onnx" for all.
    [Language.Bengali]: {
        type: ModelType.VITS_RASA,
        repo: "h2210316651/indic-tts",
        releaseTag: "v1.0.0",
        files: {
            model: "vits_rasa_13.onnx",
            vocab: "vocab.json"
        },
        speakerId: 2
    },
    [Language.Telugu]: {
        type: ModelType.VITS_RASA,
        repo: "h2210316651/indic-tts",
        releaseTag: "v1.0.0",
        files: {
            model: "vits_rasa_13.onnx",
            vocab: "vocab.json"
        },
        speakerId: 19
    },
    [Language.Tamil]: {
        type: ModelType.VITS_RASA,
        repo: "h2210316651/indic-tts",
        releaseTag: "v1.0.0",
        files: {
            model: "vits_rasa_13.onnx",
            vocab: "vocab.json"
        },
        speakerId: 18
    },
    [Language.Marathi]: {
        type: ModelType.VITS_RASA,
        repo: "h2210316651/indic-tts",
        releaseTag: "v1.0.0",
        files: {
            model: "vits_rasa_13.onnx",
            vocab: "vocab.json"
        },
        speakerId: 12
    },
    [Language.Kannada]: {
        type: ModelType.VITS_RASA,
        repo: "h2210316651/indic-tts",
        releaseTag: "v1.0.0",
        files: {
            model: "vits_rasa_13.onnx",
            vocab: "vocab.json"
        },
        speakerId: 8
    },
    [Language.Malayalam]: {
        type: ModelType.VITS_RASA,
        repo: "user/indic-tts-assets",
        releaseTag: "v1.0.0",
        files: {
            model: "vits_rasa_13.onnx",
            vocab: "vocab.json"
        },
        speakerId: 11
    },
    [Language.Punjabi]: {
        type: ModelType.VITS_RASA,
        repo: "h2210316651/indic-tts",
        releaseTag: "v1.0.0",
        files: {
            model: "vits_rasa_13_int8.onnx",
            vocab: "vocab.json"
        },
        speakerId: 15
    }
};

export const DEFAULT_REPO = "h2210316651/indic-tts";
export const DEFAULT_TAG = "v1.0.0";
