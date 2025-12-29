export interface DownloadProgress {
    loaded: number;
    total: number;
    file: string;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

export class Downloader {
    private cacheName = 'indic-tts-models';

    async getFile(url: string, filename: string, onProgress?: ProgressCallback): Promise<ArrayBuffer> {
        // 1. Try Cache
        if ('caches' in window) {
            try {
                const cache = await caches.open(this.cacheName);
                const match = await cache.match(url);
                if (match) {
                    console.log(`[IndicTTS] Loaded from cache: ${filename}`);
                    return await match.arrayBuffer();
                }
            } catch (e) {
                console.warn("[IndicTTS] Cache read failed", e);
            }
        }

        // 2. Fetch with Progress
        console.log(`[IndicTTS] Downloading: ${url}`);
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);

            const contentLength = response.headers.get('content-length');
            const total = contentLength ? parseInt(contentLength, 10) : 0;
            let loaded = 0;

            const reader = response.body?.getReader();
            const chunks: Uint8Array[] = [];

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    if (value) {
                        chunks.push(value);
                        loaded += value.length;
                        if (onProgress) {
                            onProgress({ loaded, total, file: filename });
                        }
                    }
                }
            } else {
                // Fallback if no reader (unlikely in modern browsers)
                const buffer = await response.arrayBuffer();
                chunks.push(new Uint8Array(buffer));
            }

            // Combine chunks
            const combined = new Uint8Array(loaded);
            let offset = 0;
            for (const chunk of chunks) {
                combined.set(chunk, offset);
                offset += chunk.length;
            }

            // 3. Save to Cache
            if ('caches' in window) {
                try {
                    const cache = await caches.open(this.cacheName);
                    // responsive.clone() not available since we read stream, create new Response
                    const toCache = new Response(combined, {
                        headers: response.headers
                    });
                    await cache.put(url, toCache);
                } catch (e) {
                    console.warn("[IndicTTS] Cache write failed", e);
                }
            }

            return combined.buffer;

        } catch (error) {
            console.error(`[IndicTTS] Download failed for ${filename}`, error);
            throw error;
        }
    }

    // Helper to construct GitHub Release URL
    getGitHubUrl(repo: string, tag: string, filename: string): string {
        // e.g., https://github.com/user/repo/releases/download/v1.0.0/file.onnx
        // Note: Raw GitHub or specific raw requests might be different, but Releases usually standardized.
        // However, repo usually "owner/repo".
        return `https://github.com/${repo}/releases/download/${tag}/${filename}`;
    }
}
