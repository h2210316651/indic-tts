import { IndicTTS, Language } from './dist/index.js';

// Mock browser globals for Node.js environment
global.fetch = () => Promise.resolve({ ok: true });
global.window = {
    caches: {
        open: async () => ({
            match: async () => null,
            put: async () => { },
        })
    }
};
global.navigator = { hardwareConcurrency: 4 };

async function test() {
    console.log("Initializing IndicTTS...");
    const tts = new IndicTTS();
    await tts.initialize();
    console.log("Initialization successful.");

    // Just verify the config is accessible
    const lang = Language.Hindi;
    console.log(`Testing Language Config for: ${lang}`);

    // We won't actually run inference as ONNX Runtime Web in Node needs specific setup/polyfill
    // or we'd need onnxruntime-node. This test is just to check module exports and basic logic.
    console.log("Module structure verified.");
}

test().catch(console.error);
