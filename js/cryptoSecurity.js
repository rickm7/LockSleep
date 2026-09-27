/**
 * LockSleep - Cryptographic Security & Anti-Tampering Engine
 * Implements SHA-256 Hash Chaining, Frame Watermarking verification, and Periodical Chunk Commit.
 */

class CryptoSecurityEngine {
    constructor() {
        this.hashChain = [];
        this.lastHash = '0000000000000000000000000000000000000000000000000000000000000000';
        this.sequenceNumber = 0;
    }

    /**
     * Resets the cryptographic session
     */
    resetSession() {
        this.hashChain = [];
        this.lastHash = '0000000000000000000000000000000000000000000000000000000000000000';
        this.sequenceNumber = 0;
    }

    /**
     * Calculates SHA-256 hash of an ArrayBuffer
     */
    async calculateSHA256(buffer) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Processes a video chunk and appends to the immutable hash chain:
     * Hash_N = SHA256(LastHash + ChunkHash + Sequence + Timestamp)
     */
    async processChunk(blobChunk, timestampMs) {
        const buffer = await blobChunk.arrayBuffer();
        const chunkHash = await this.calculateSHA256(buffer);
        
        this.sequenceNumber++;
        const payloadStr = `${this.lastHash}:${chunkHash}:${this.sequenceNumber}:${timestampMs}`;
        
        const encoder = new TextEncoder();
        const payloadBuffer = encoder.encode(payloadStr);
        const chainHash = await this.calculateSHA256(payloadBuffer);
        
        this.lastHash = chainHash;

        const recordNode = {
            seq: this.sequenceNumber,
            timestamp: timestampMs,
            chunkHash: chunkHash,
            chainHash: chainHash
        };

        this.hashChain.push(recordNode);
        return recordNode;
    }

    /**
     * Verifies the cryptographic integrity of a recorded session.
     * Detects if any frame was deleted, edited, or inserted.
     */
    async verifyIntegrity(chunksList, storedHashChain) {
        if (!chunksList || !storedHashChain || chunksList.length !== storedHashChain.length) {
            return { valid: false, reason: "Numero di blocchi video non corrispondente alla catena crittografica!" };
        }

        let runningHash = '0000000000000000000000000000000000000000000000000000000000000000';

        for (let i = 0; i < chunksList.length; i++) {
            const chunk = chunksList[i];
            const node = storedHashChain[i];
            
            const buffer = await chunk.arrayBuffer();
            const chunkHash = await this.calculateSHA256(buffer);

            const payloadStr = `${runningHash}:${chunkHash}:${node.seq}:${node.timestamp}`;
            const encoder = new TextEncoder();
            const expectedChainHash = await this.calculateSHA256(encoder.encode(payloadStr));

            if (expectedChainHash !== node.chainHash) {
                return {
                    valid: false,
                    reason: `MANIPOLAZIONE RILEVATA al blocco #${node.seq}! L'impronta crittografica non corrisponde.`
                };
            }

            runningHash = expectedChainHash;
        }

        return { valid: true, masterHash: runningHash };
    }
}

// Global instance export
window.cryptoSecurity = new CryptoSecurityEngine();
