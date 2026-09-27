/**
 * LockSleep - IndexedDB Database Module
 * Direct local browser storage for sleep recording videos (MP4 blobs).
 */

const DB_NAME = 'LockSleepDatabase';
const DB_VERSION = 2;
const STORE_NAME = 'sleep_recordings';
const SCREENSHOTS_STORE = 'screenshots';

class SleepDatabase {
    constructor() {
        this.db = null;
    }

    /**
     * Initializes the IndexedDB database
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("IndexedDB error:", event.target.error);
                reject("Impossibile aprire il database locale");
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
                if (!db.objectStoreNames.contains(SCREENSHOTS_STORE)) {
                    const snapStore = db.createObjectStore(SCREENSHOTS_STORE, { keyPath: 'id', autoIncrement: true });
                    snapStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    /**
     * Saves a new video recording blob into IndexedDB with cryptographic hash chain
     * @param {Blob} videoBlob - The MP4 video blob
     * @param {number} durationSeconds - Duration in seconds
     * @param {string} mimeType - Video MimeType (e.g. video/mp4)
     * @param {Array} hashChain - Cryptographic SHA-256 hash chain
     * @param {boolean} isRecovered - True if auto-recovered after unexpected shutdown
     */
    async saveRecording(videoBlob, durationSeconds, mimeType = 'video/mp4', hashChain = [], isRecovered = false, eventsLog = [], postureSummary = null) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const record = {
                timestamp: Date.now(),
                dateFormatted: new Date().toLocaleString('it-IT', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                }),
                duration: durationSeconds,
                sizeBytes: videoBlob.size,
                sizeFormatted: (videoBlob.size / (1024 * 1024)).toFixed(2) + ' MB',
                mimeType: mimeType,
                blob: videoBlob,
                hashChain: hashChain,
                masterHash: hashChain.length > 0 ? hashChain[hashChain.length - 1].chainHash : '',
                integrityStatus: 'SIGILLATO_CRITTOGRAFICAMENTE',
                isRecovered: isRecovered,
                eventsLog: eventsLog,
                postureSummary: postureSummary
            };

            const request = store.add(record);

            request.onsuccess = (event) => {
                resolve(event.target.result); // Returns ID
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * Gets all saved video recordings metadata & blobs
     */
    async getAllRecordings() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('timestamp');
            const request = index.openCursor(null, 'prev'); // Latest first

            const results = [];
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * Gets a single recording by ID
     */
    async getRecording(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(Number(id));

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * Deletes a recording by ID
     */
    async deleteRecording(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(Number(id));

            request.onsuccess = () => resolve(true);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * Deletes recordings older than N days
     */
    async autoCleanOldRecordings(daysToKeep = 7) {
        if (!this.db) await this.init();
        const records = await this.getAllRecordings();
        const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

        let deletedCount = 0;
        for (const rec of records) {
            if (rec.timestamp && rec.timestamp < cutoffTime) {
                await this.deleteRecording(rec.id);
                deletedCount++;
            }
        }
        return deletedCount;
    }

    /**
     * Deletes all recordings from the database
     */
    async clearAll() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => resolve(true);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * Saves a captured screenshot blob into IndexedDB
     * @param {Blob} imageBlob - The screenshot PNG/JPEG blob
     * @param {number} width - Image width
     * @param {number} height - Image height
     */
    async saveScreenshot(imageBlob, width = 1280, height = 720) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([SCREENSHOTS_STORE], 'readwrite');
            const store = transaction.objectStore(SCREENSHOTS_STORE);

            const sizeFormatted = imageBlob.size > 1024 * 1024
                ? (imageBlob.size / (1024 * 1024)).toFixed(2) + ' MB'
                : (imageBlob.size / 1024).toFixed(1) + ' KB';

            const record = {
                timestamp: Date.now(),
                dateFormatted: new Date().toLocaleString('it-IT', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                }),
                width: width,
                height: height,
                resolution: `${width}x${height}`,
                sizeBytes: imageBlob.size,
                sizeFormatted: sizeFormatted,
                blob: imageBlob
            };

            const request = store.add(record);

            request.onsuccess = (event) => {
                resolve(event.target.result); // Returns ID
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * Gets all saved screenshots (latest first)
     */
    async getAllScreenshots() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([SCREENSHOTS_STORE], 'readonly');
            const store = transaction.objectStore(SCREENSHOTS_STORE);
            const index = store.index('timestamp');
            const request = index.openCursor(null, 'prev');

            const results = [];
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * Gets a single screenshot by ID
     */
    async getScreenshot(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([SCREENSHOTS_STORE], 'readonly');
            const store = transaction.objectStore(SCREENSHOTS_STORE);
            const request = store.get(Number(id));

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * Deletes a screenshot by ID
     */
    async deleteScreenshot(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([SCREENSHOTS_STORE], 'readwrite');
            const store = transaction.objectStore(SCREENSHOTS_STORE);
            const request = store.delete(Number(id));

            request.onsuccess = () => resolve(true);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * Clears all screenshots
     */
    async clearAllScreenshots() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([SCREENSHOTS_STORE], 'readwrite');
            const store = transaction.objectStore(SCREENSHOTS_STORE);
            const request = store.clear();

            request.onsuccess = () => resolve(true);
            request.onerror = (event) => reject(event.target.error);
        });
    }
}

// Global instance export
window.sleepDb = new SleepDatabase();

/**
 * Ensures MP4 blobs are immediately playable in HTML5 video elements.
 * If the initialization segment (ftyp/moov) is preceded by movie fragments (moof/mdat),
 * it seamlessly repositions the ftyp/moov header to byte 0 in-memory for the video player.
 */
window.ensurePlayableVideoBlob = async function(blob) {
    if (!blob || blob.size < 8) return blob;

    try {
        const sampleSize = Math.min(blob.size, 10 * 1024 * 1024);
        const sampleBuffer = await blob.slice(0, sampleSize).arrayBuffer();
        const uint8 = new Uint8Array(sampleBuffer);

        // Check if starts with ftyp
        if (uint8.length >= 8 && uint8[4] === 0x66 && uint8[5] === 0x74 && uint8[6] === 0x79 && uint8[7] === 0x70) {
            return blob;
        }

        // Check if WebM (EBML header)
        if (uint8[0] === 0x1A && uint8[1] === 0x45 && uint8[2] === 0xDF && uint8[3] === 0xA3) {
            return blob;
        }

        // Search for 'ftyp' box
        let ftypOffset = -1;
        for (let i = 0; i <= uint8.length - 8; i++) {
            if (uint8[i+4] === 0x66 && uint8[i+5] === 0x74 && uint8[i+6] === 0x79 && uint8[i+7] === 0x70) {
                ftypOffset = i;
                break;
            }
        }

        if (ftypOffset === -1) {
            return blob;
        }

        const view = new DataView(sampleBuffer);
        let curr = ftypOffset;
        let initSegmentEnd = ftypOffset;

        while (curr + 8 <= uint8.length) {
            const boxSize = view.getUint32(curr, false);
            if (boxSize === 0 || boxSize > uint8.length - curr) break;
            const boxType = String.fromCharCode(uint8[curr+4], uint8[curr+5], uint8[curr+6], uint8[curr+7]);
            if (boxType === 'ftyp' || boxType === 'moov') {
                curr += boxSize;
                initSegmentEnd = curr;
            } else {
                break;
            }
        }

        const initSegmentLength = initSegmentEnd - ftypOffset;
        if (initSegmentLength <= 0) return blob;

        const initBlob = blob.slice(ftypOffset, ftypOffset + initSegmentLength);
        const beforeBlob = blob.slice(0, ftypOffset);
        const afterBlob = blob.slice(ftypOffset + initSegmentLength);

        return new Blob([initBlob, beforeBlob, afterBlob], { type: blob.type || 'video/mp4' });
    } catch (e) {
        console.error("ensurePlayableVideoBlob error:", e);
        return blob;
    }
};
