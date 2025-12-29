export class AudioUtils {

    static encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);

        const writeString = (view: DataView, offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + samples.length * 2, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, samples.length * 2, true);

        let offset = 44;
        for (let i = 0; i < samples.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            // 16-bit PCM
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }

        return buffer;
    }

    static playAudio(buffer: ArrayBuffer, context?: AudioContext): Promise<void> {
        return new Promise((resolve) => {
            const ctx = context || new (window.AudioContext || (window as any).webkitAudioContext)();
            ctx.decodeAudioData(buffer.slice(0), (decoded) => {
                const source = ctx.createBufferSource();
                source.buffer = decoded;
                source.connect(ctx.destination);
                source.onended = () => resolve();
                source.start(0);
            });
        });
    }

    static createBlob(wavBuffer: ArrayBuffer): Blob {
        return new Blob([wavBuffer], { type: 'audio/wav' });
    }
}
