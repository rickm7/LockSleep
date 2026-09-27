/**
 * LockSleep - Motion & Audio Peak Analytics Module
 * Analyzes video frame pixels and microphone audio levels during monitoring.
 * Renders interactive timeline markers in the video player modal.
 */

class AnalyticsEngine {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.prevFrameData = null;
        
        // Audio
        this.audioCtx = null;
        this.analyser = null;
        this.microphoneStream = null;

        // Events Log
        this.eventsLog = [];
        this.analysisInterval = null;
        this.lastEventTime = 0;
    }

    /**
     * Resets analytics session
     */
    reset() {
        this.prevFrameData = null;
        this.eventsLog = [];
        this.lastEventTime = 0;
        if (this.analysisInterval) clearInterval(this.analysisInterval);
    }

    /**
     * Initializes motion and audio sensors
     */
    initSensors(videoElement, mediaStream) {
        this.reset();
        
        this.canvas.width = 160;
        this.canvas.height = 90;

        // Audio Analysis setup
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext && mediaStream.getAudioTracks().length > 0) {
                this.audioCtx = new AudioContext();
                const source = this.audioCtx.createMediaStreamSource(mediaStream);
                this.analyser = this.audioCtx.createAnalyser();
                this.analyser.fftSize = 256;
                source.connect(this.analyser);
            }
        } catch (e) {
            console.warn("Analizzatore audio non disponibile:", e);
        }

        this.coverStreak = 0;
        this.alarmEnabled = false; // DISATTIVATO DI DEFAULT: Si attiva solo se l'utente clicca il pulsante in UI!
        this.isSirenPlaying = false;
        this.sirenTimer = null;

        // Sampling loop (every 500ms)
        this.analysisInterval = setInterval(() => {
            if (!videoElement || videoElement.paused || videoElement.ended) return;
            
            const currentSec = Math.floor(window.webcamController.elapsedSeconds || 0);

            // 0. Continuous Lens Cover Detection (Attivo solo se alarmEnabled = true)
            if (this.alarmEnabled) {
                const isCovered = this.detectLensCover(videoElement);
                if (isCovered) {
                    this.coverStreak++;
                    if (this.coverStreak >= 5) { // Requires 2.5 seconds of total zero-texture blockage
                        if (!this.isSirenPlaying) {
                            this.startContinuousAlarm();
                            if (window.showToast) {
                                window.showToast("🚨 ALLARME CONTINUO: Copertura fotocamera rilevata!", "danger");
                            }
                        }
                        if (currentSec - this.lastEventTime >= 4) {
                            this.eventsLog.push({
                                timeSec: currentSec,
                                type: 'noise',
                                score: 100,
                                label: `🚨 ALLARME CONTINUO COPERTURA OBIETTIVO`
                            });
                            this.lastEventTime = currentSec;
                        }
                    }
                } else {
                    this.coverStreak = 0;
                    if (this.isSirenPlaying) {
                        this.stopContinuousAlarm();
                    }
                }
            }

            // 1. Audio Spectrum Analysis & Categorization
            const audioData = this.detectAudioSpectrum();
            if (audioData.detected && (currentSec - this.lastEventTime >= 2)) {
                this.eventsLog.push({
                    timeSec: currentSec,
                    type: audioData.category,
                    score: audioData.score,
                    label: audioData.label
                });
                this.lastEventTime = currentSec;
            }
        }, 500);
    }

    /**
     * Starts continuous acoustic siren alarm loop
     */
    startContinuousAlarm() {
        if (this.isSirenPlaying) return;
        this.isSirenPlaying = true;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.alarmAudioCtx = new AudioContext();
            
            const playSirenTone = () => {
                if (!this.isSirenPlaying || !this.alarmAudioCtx) return;
                const osc = this.alarmAudioCtx.createOscillator();
                const gain = this.alarmAudioCtx.createGain();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(900, this.alarmAudioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(450, this.alarmAudioCtx.currentTime + 0.4);

                gain.gain.setValueAtTime(0.4, this.alarmAudioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.alarmAudioCtx.currentTime + 0.45);

                osc.connect(gain);
                gain.connect(this.alarmAudioCtx.destination);

                osc.start();
                osc.stop(this.alarmAudioCtx.currentTime + 0.45);

                this.sirenTimer = setTimeout(playSirenTone, 480);
            };

            playSirenTone();
        } catch (e) {
            console.warn("Errore allarme continuo:", e);
        }
    }

    /**
     * Stops continuous acoustic siren alarm
     */
    stopContinuousAlarm() {
        this.isSirenPlaying = false;
        if (this.sirenTimer) {
            clearTimeout(this.sirenTimer);
            this.sirenTimer = null;
        }
        if (this.alarmAudioCtx) {
            this.alarmAudioCtx.close().catch(() => {});
            this.alarmAudioCtx = null;
        }
    }

    /**
     * Plays acoustic tamper alarm sound synthesized via Web Audio API
     */
    playTamperAlarm() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch A5
            osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.4);

            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) {
            console.warn("Impossibile riprodurre suono allarme:", e);
        }
    }

    /**
     * Detects frame-to-frame pixel differences
     */
    detectMotion(videoEl) {
        if (!videoEl.videoWidth) return 0;

        this.ctx.drawImage(videoEl, 0, 0, this.canvas.width, this.canvas.height);
        const currentData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;

        if (!this.prevFrameData) {
            this.prevFrameData = currentData;
            return 0;
        }

        let diffCount = 0;
        const totalPixels = currentData.length / 4;

        for (let i = 0; i < currentData.length; i += 4) {
            // R, G, B channels diff
            const diffR = Math.abs(currentData[i] - this.prevFrameData[i]);
            const diffG = Math.abs(currentData[i+1] - this.prevFrameData[i+1]);
            const diffB = Math.abs(currentData[i+2] - this.prevFrameData[i+2]);

            if ((diffR + diffG + diffB) / 3 > 25) {
                diffCount++;
            }
        }

        this.prevFrameData = currentData;
        return (diffCount / totalPixels) * 100;
    }

    /**
     * Detects audio peak levels
     */
    detectAudioNoise() {
        if (!this.analyser) return 0;
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        return (sum / bufferLength) * (100 / 255);
    }

    /**
     * Detects physical hand/cloth/tape covering directly obstructing the camera lens.
     */
    detectLensCover(videoEl) {
        if (!videoEl.videoWidth) return false;

        this.ctx.drawImage(videoEl, 0, 0, this.canvas.width, this.canvas.height);
        const imgData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;

        let totalBrightness = 0;
        let darkPixelCount = 0;
        let totalVariance = 0;
        const totalPixels = imgData.length / 4;

        for (let i = 0; i < imgData.length; i += 4) {
            const r = imgData[i];
            const g = imgData[i + 1];
            const b = imgData[i + 2];
            const brightness = (r + g + b) / 3;
            totalBrightness += brightness;

            if (brightness < 6) {
                darkPixelCount++;
            }

            if (i > 0) {
                const prevR = imgData[i - 4];
                totalVariance += Math.abs(r - prevR);
            }
        }

        const avgBrightness = totalBrightness / totalPixels;
        const darkRatio = darkPixelCount / totalPixels;
        const avgVariance = totalVariance / totalPixels;

        // Physical lens blockage requires > 98% pitch black pixels + near-zero spatial variance (< 0.5)
        const isCovered = (darkRatio > 0.98) && (avgBrightness < 4) && (avgVariance < 0.5);

        return isCovered;
    }

    /**
     * Stops analytics sensors
     */
    stopSensors() {
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
        this.stopContinuousAlarm();
        if (this.audioCtx) {
            this.audioCtx.close().catch(() => {});
            this.audioCtx = null;
        }
        return [...this.eventsLog];
    }
}

// Global instance export
window.analyticsEngine = new AnalyticsEngine();
