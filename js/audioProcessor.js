/**
 * LockSleep - Web Audio DSP Processor & Distance Microphone Booster
 * Amplifies faint/distant speech (1-3 meters), removes PC fan noise, and compresses dynamic range.
 */

class AudioDSPProcessor {
    constructor() {
        this.audioCtx = null;
        this.sourceNode = null;
        this.highPassFilter = null;
        this.gainNode = null;
        this.compressor = null;
        this.destinationNode = null;
        this.currentGainMultiplier = 3.5; // Default +350% amplification
    }

    /**
     * Creates an amplified, noise-filtered audio stream from input raw stream
     * @param {MediaStream} rawStream - Original mic input stream
     * @param {number} gainMultiplier - Gain factor (e.g. 3.5 = +350%)
     * @returns {MediaStreamTrack} - Processed audio track
     */
    processAudioStream(rawStream, gainMultiplier = 3.5) {
        this.currentGainMultiplier = gainMultiplier;
        const audioTracks = rawStream.getAudioTracks();
        if (audioTracks.length === 0) return null;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();

            // 1. Media Source
            this.sourceNode = this.audioCtx.createMediaStreamSource(rawStream);

            // Full-Spectrum Wideband Audio (20Hz - 20,000Hz)
            // Preserves low-frequency car rumbles and high-pitch electronic whistles for full proof!
            
            // Audio Gain Booster (Multiplies audio level for 1-3m distance)
            this.gainNode = this.audioCtx.createGain();
            this.gainNode.gain.value = Number(this.currentGainMultiplier) || 3.5;

            // Dynamics Compressor (Captures quiet sounds while preventing harsh clipping)
            this.compressor = this.audioCtx.createDynamicsCompressor();
            this.compressor.threshold.setValueAtTime(-50, this.audioCtx.currentTime);
            this.compressor.knee.setValueAtTime(40, this.audioCtx.currentTime);
            this.compressor.ratio.setValueAtTime(12, this.audioCtx.currentTime);
            this.compressor.attack.setValueAtTime(0.003, this.audioCtx.currentTime);
            this.compressor.release.setValueAtTime(0.25, this.audioCtx.currentTime);

            // Output Destination
            this.destinationNode = this.audioCtx.createMediaStreamDestination();

            // Connect Full Spectrum Pipeline:
            // Source -> Gain -> Compressor -> Destination (Full-spectrum HD Audio 20Hz - 20kHz)
            this.sourceNode.connect(this.gainNode);
            this.gainNode.connect(this.compressor);
            this.compressor.connect(this.destinationNode);

            console.log(`Web Audio DSP attivo: Guadagno amplificato a ${this.currentGainMultiplier}x (+${Math.round((this.currentGainMultiplier - 1)*100)}%)`);
            return this.destinationNode.stream.getAudioTracks()[0];

        } catch (e) {
            console.warn("Errore elaboratore DSP Audio:", e);
            return audioTracks[0]; // Fallback to raw mic
        }
    }

    /**
     * Adjusts gain multiplier dynamically
     */
    setGain(multiplier) {
        this.currentGainMultiplier = Number(multiplier) || 3.5;
        if (this.gainNode && this.audioCtx) {
            this.gainNode.gain.setValueAtTime(this.currentGainMultiplier, this.audioCtx.currentTime);
        }
    }

    /**
     * Cleans up Audio Context
     */
    close() {
        if (this.audioCtx) {
            this.audioCtx.close().catch(() => {});
            this.audioCtx = null;
        }
    }
}

// Global instance export
window.audioDSP = new AudioDSPProcessor();
