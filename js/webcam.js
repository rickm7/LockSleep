/**
 * LockSleep - Webcam Controller & Recorder Module
 * Handles camera stream, circular analog clock & digital clock overlay (with hundredths of a second),
 * and burned-in lightweight MP4 recording.
 */

class WebcamController {
    constructor() {
        this.stream = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        
        // Timers
        this.clockInterval = null;
        this.timerInterval = null;
        this.startTime = null;
        this.elapsedSeconds = 0;

        // Elements
        this.videoElement = null;
        this.realTimeElement = null;
        this.timerElement = null;
        this.recBadge = null;
        this.statusIndicator = null;
        this.statusText = null;

        // UI Analog Clock
        this.analogCanvas = null;
        this.analogCtx = null;

        // Burn-in Canvas & Recording Loop
        this.recorderCanvas = null;
        this.recorderCtx = null;
        this.recordRenderInterval = null;
        this.recordAnimFrameId = null;
        this.lastFrameRenderTime = 0;

        // Codec selection
        this.selectedMimeType = 'video/mp4';
    }

    /**
     * Initializes elements and starts real-time clocks
     */
    init(videoEl, realTimeEl, timerEl, recBadgeEl, statusIndEl, statusTxtEl) {
        this.videoElement = videoEl;
        this.realTimeElement = realTimeEl;
        this.timerElement = timerEl;
        this.recBadge = recBadgeEl;
        this.statusIndicator = statusIndEl;
        this.statusText = statusTxtEl;

        this.analogCanvas = document.getElementById('analog-clock-canvas');
        if (this.analogCanvas) {
            this.analogCtx = this.analogCanvas.getContext('2d');
        }

        this.startRealTimeClock();
        this.detectSupportedCodecs();
    }

    /**
     * Detects best lightweight MP4 codec available
     */
    detectSupportedCodecs() {
        const types = [
            'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
            'video/mp4;codecs=avc1',
            'video/mp4;codecs=h264',
            'video/mp4',
            'video/webm;codecs=h264',
            'video/webm'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                this.selectedMimeType = type;
                console.log("Selezionato formato video leggero:", type);
                break;
            }
        }

        const tagEl = document.getElementById('mp4-codec-tag');
        if (tagEl) {
            const isMp4 = this.selectedMimeType.includes('mp4');
            tagEl.textContent = isMp4 ? 'Formato: MP4 Leggero' : 'Formato: WebM (Compatibile)';
        }
    }

    /**
     * Draws an analog circular clock on any canvas context
     */
    drawAnalogClock(ctx, cx, cy, radius, date) {
        const hours = date.getHours() % 12;
        const minutes = date.getMinutes();
        const seconds = date.getSeconds();
        const ms = date.getMilliseconds();

        ctx.save();

        // 1. Outer dial shadow & background
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(10, 15, 26, 0.88)';
        ctx.fill();
        ctx.lineWidth = Math.max(1.5, radius * 0.05);
        ctx.strokeStyle = '#00f2fe';
        ctx.shadowColor = 'rgba(0, 242, 254, 0.5)';
        ctx.shadowBlur = radius * 0.18;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 2. Inner subtle ring
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.86, 0, Math.PI * 2);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.stroke();

        // 3. 12 Hour tick marks
        for (let i = 0; i < 12; i++) {
            const angle = (i * Math.PI) / 6;
            const isCardinal = (i % 3 === 0);
            const tickLength = isCardinal ? radius * 0.22 : radius * 0.12;
            const outerR = radius * 0.82;
            const innerR = outerR - tickLength;

            const x1 = cx + Math.sin(angle) * innerR;
            const y1 = cy - Math.cos(angle) * innerR;
            const x2 = cx + Math.sin(angle) * outerR;
            const y2 = cy - Math.cos(angle) * outerR;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineWidth = isCardinal ? Math.max(2, radius * 0.06) : Math.max(1, radius * 0.03);
            ctx.strokeStyle = isCardinal ? '#ffffff' : 'rgba(255, 255, 255, 0.45)';
            ctx.lineCap = 'round';
            ctx.stroke();
        }

        // 4. Hour hand
        const hourAngle = (hours + minutes / 60 + seconds / 3600) * (Math.PI / 6);
        const hourLen = radius * 0.50;
        ctx.beginPath();
        ctx.moveTo(cx - Math.sin(hourAngle) * (radius * 0.12), cy + Math.cos(hourAngle) * (radius * 0.12));
        ctx.lineTo(cx + Math.sin(hourAngle) * hourLen, cy - Math.cos(hourAngle) * hourLen);
        ctx.lineWidth = Math.max(2.5, radius * 0.07);
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        // 5. Minute hand
        const minAngle = (minutes + seconds / 60 + ms / 60000) * (Math.PI / 30);
        const minLen = radius * 0.70;
        ctx.beginPath();
        ctx.moveTo(cx - Math.sin(minAngle) * (radius * 0.12), cy + Math.cos(minAngle) * (radius * 0.12));
        ctx.lineTo(cx + Math.sin(minAngle) * minLen, cy - Math.cos(minAngle) * minLen);
        ctx.lineWidth = Math.max(1.8, radius * 0.045);
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#e2e8f0';
        ctx.stroke();

        // 6. Second hand (smooth sweep)
        const secAngle = (seconds + ms / 1000) * (Math.PI / 30);
        const secLen = radius * 0.80;
        ctx.beginPath();
        ctx.moveTo(cx - Math.sin(secAngle) * (radius * 0.18), cy + Math.cos(secAngle) * (radius * 0.18));
        ctx.lineTo(cx + Math.sin(secAngle) * secLen, cy - Math.cos(secAngle) * secLen);
        ctx.lineWidth = Math.max(1.2, radius * 0.03);
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#00f2fe';
        ctx.stroke();

        // 7. Center pivot pin
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(2.5, radius * 0.07), 0, Math.PI * 2);
        ctx.fillStyle = '#00f2fe';
        ctx.fill();

        ctx.restore();
    }

    /**
     * Helper for rounded rectangle on canvas
     */
    drawRoundRect(ctx, x, y, w, h, r) {
        if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, r);
        } else {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
        }
    }

    /**
     * Returns formatted sleep timer string (HH:mm:ss)
     */
    getFormattedTimer() {
        const hrs = String(Math.floor(this.elapsedSeconds / 3600)).padStart(2, '0');
        const mins = String(Math.floor((this.elapsedSeconds % 3600) / 60)).padStart(2, '0');
        const secs = String(this.elapsedSeconds % 60).padStart(2, '0');
        return `${hrs}:${mins}:${secs}`;
    }

    /**
     * Draws the two clocks (circular analog clock and digital clock with hundredths)
     * and sleep timer onto the recorder video frame canvas
     */
    drawOverlayOnRecorder(ctx, width, height, now) {
        const s = Math.max(0.65, width / 1280);
        const badgeX = 24 * s;
        const badgeY = 24 * s;
        const badgeW = 385 * s;
        const badgeH = 88 * s;
        const badgeRadius = 14 * s;

        ctx.save();

        // 1. Dark glassmorphic background badge
        ctx.fillStyle = 'rgba(7, 9, 14, 0.78)';
        this.drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeRadius);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = Math.max(1, 1.5 * s);
        ctx.stroke();

        // 2. Analog circular clock on the left
        const clockRadius = 32 * s;
        const clockX = badgeX + 16 * s + clockRadius;
        const clockY = badgeY + badgeH / 2;
        this.drawAnalogClock(ctx, clockX, clockY, clockRadius, now);

        // 3. Digital clock with seconds and hundredths of a second
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const secs = String(now.getSeconds()).padStart(2, '0');
        const cs = String(Math.floor(now.getMilliseconds() / 10)).padStart(2, '0');

        const textStartX = badgeX + 16 * s + clockRadius * 2 + 16 * s;
        const digitalFontSize = Math.round(24 * s);
        ctx.font = `700 ${digitalFontSize}px "JetBrains Mono", Consolas, monospace`;
        ctx.textBaseline = 'top';

        // Draw HH:MM:SS in crisp white
        const mainTimeStr = `${hrs}:${mins}:${secs}`;
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        ctx.shadowBlur = 6 * s;
        ctx.fillText(mainTimeStr, textStartX, badgeY + 16 * s);

        // Draw .CS in glowing cyan
        const mainWidth = ctx.measureText(mainTimeStr).width;
        ctx.fillStyle = '#00f2fe';
        ctx.shadowColor = 'rgba(0, 242, 254, 0.6)';
        ctx.shadowBlur = 6 * s;
        ctx.fillText(`.${cs}`, textStartX + mainWidth, badgeY + 16 * s);

        ctx.shadowBlur = 0;

        // 4. Timer Sonno row below the digital clock
        const timerFontSize = Math.round(11 * s);
        ctx.font = `600 ${timerFontSize}px "JetBrains Mono", Consolas, monospace`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.fillText('TIMER SONNO', textStartX, badgeY + 54 * s);

        const labelWidth = ctx.measureText('TIMER SONNO').width;
        ctx.font = `700 ${Math.round(13 * s)}px "JetBrains Mono", Consolas, monospace`;
        ctx.fillStyle = '#00f2fe';
        ctx.fillText(` ${this.getFormattedTimer()}`, textStartX + labelWidth, badgeY + 52 * s);

        ctx.restore();
    }

    /**
     * Starts continuous real-time clock updating both the circular clock and digital clock with hundredths
     */
    startRealTimeClock() {
        const updateUI = () => {
            const now = new Date();
            const hrs = String(now.getHours()).padStart(2, '0');
            const mins = String(now.getMinutes()).padStart(2, '0');
            const secs = String(now.getSeconds()).padStart(2, '0');
            const cs = String(Math.floor(now.getMilliseconds() / 10)).padStart(2, '0');

            if (this.realTimeElement) {
                this.realTimeElement.innerHTML = `${hrs}:${mins}:${secs}<span class="clock-cs">.${cs}</span>`;
            }

            if (!this.analogCanvas) {
                this.analogCanvas = document.getElementById('analog-clock-canvas');
                if (this.analogCanvas) {
                    this.analogCtx = this.analogCanvas.getContext('2d');
                }
            }

            if (this.analogCtx && this.analogCanvas) {
                const w = this.analogCanvas.width;
                const h = this.analogCanvas.height;
                this.analogCtx.clearRect(0, 0, w, h);
                this.drawAnalogClock(this.analogCtx, w / 2, h / 2, (w / 2) - 4, now);
            }
        };

        updateUI();
        if (this.clockInterval) clearInterval(this.clockInterval);
        // ~30 fps update for smooth second hand & hundredths of second in the UI
        this.clockInterval = setInterval(updateUI, 33);
    }

    /**
     * Renders each frame during recording: video + burned-in clocks
     */
    renderRecorderFrame() {
        if (!this.isRecording || !this.videoElement || !this.recorderCtx) return;

        const now = performance.now();
        if (now - this.lastFrameRenderTime < 28) return; // ~30 fps cap
        this.lastFrameRenderTime = now;

        const vw = this.videoElement.videoWidth || 1280;
        const vh = this.videoElement.videoHeight || 720;

        if (this.recorderCanvas.width !== vw || this.recorderCanvas.height !== vh) {
            this.recorderCanvas.width = vw;
            this.recorderCanvas.height = vh;
        }

        const ctx = this.recorderCtx;

        // Apply night vision filter if active
        const isNightMode = document.getElementById('webcam-wrapper')?.classList.contains('night-mode');
        if (isNightMode) {
            ctx.filter = 'brightness(2.2) contrast(1.6) grayscale(0.8) hue-rotate(90deg)';
            ctx.drawImage(this.videoElement, 0, 0, vw, vh);
            ctx.filter = 'none';
        } else {
            ctx.drawImage(this.videoElement, 0, 0, vw, vh);
        }

        // Burn the two clocks onto the video frame
        this.drawOverlayOnRecorder(ctx, vw, vh, new Date());
    }

    /**
     * Starts continuous frame rendering loop during recording
     */
    startRecorderLoop() {
        this.lastFrameRenderTime = 0;
        this.renderRecorderFrame();

        const loop = () => {
            if (!this.isRecording) return;
            this.renderRecorderFrame();
            this.recordAnimFrameId = requestAnimationFrame(loop);
        };
        this.recordAnimFrameId = requestAnimationFrame(loop);

        // Fallback interval (guarantees frames even if window is minimized or in background)
        if (this.recordRenderInterval) clearInterval(this.recordRenderInterval);
        this.recordRenderInterval = setInterval(() => {
            if (this.isRecording) {
                this.renderRecorderFrame();
            }
        }, 40); // 25 fps
    }

    /**
     * Stops frame rendering loop
     */
    stopRecorderLoop() {
        if (this.recordAnimFrameId) {
            cancelAnimationFrame(this.recordAnimFrameId);
            this.recordAnimFrameId = null;
        }
        if (this.recordRenderInterval) {
            clearInterval(this.recordRenderInterval);
            this.recordRenderInterval = null;
        }
    }

    /**
     * Enumerates available video input devices
     */
    async getCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(d => d.kind === 'videoinput');
        } catch (e) {
            console.error("Errore lettura fotocamere:", e);
            return [];
        }
    }

    /**
     * Starts webcam media stream
     */
    async startCamera(deviceId = null) {
        if (this.stream) {
            this.stopCamera();
        }

        const constraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { max: 25 },
                deviceId: deviceId ? { exact: deviceId } : undefined
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        };

        try {
            const rawStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Process audio with DSP Amplifier & Noise Cleaner
            let finalStream = rawStream;
            if (window.audioDSP && rawStream.getAudioTracks().length > 0) {
                const gainLevel = window.currentAudioGain || 3.5;
                const processedAudioTrack = window.audioDSP.processAudioStream(rawStream, gainLevel);
                if (processedAudioTrack) {
                    finalStream = new MediaStream([
                        ...rawStream.getVideoTracks(),
                        processedAudioTrack
                    ]);
                }
            }

            this.stream = finalStream;
            this.videoElement.srcObject = this.stream;
            document.getElementById('webcam-placeholder').style.display = 'none';

            // Wait briefly for video stream metadata to populate actual width/height
            await new Promise((resolve) => {
                if (this.videoElement.videoWidth > 0) {
                    resolve();
                } else {
                    this.videoElement.onloadedmetadata = () => resolve();
                    setTimeout(resolve, 500);
                }
            });

            if (this.statusIndicator) this.statusIndicator.classList.add('active');
            if (this.statusText) this.statusText.textContent = 'Fotocamera & Microfono Amplificato Attivi';
            return true;
        } catch (err) {
            console.error("Errore accesso alla fotocamera:", err);
            if (window.showToast) {
                window.showToast("Impossibile accedere alla webcam: verificare i permessi della fotocamera.", "danger");
            }
            return false;
        }
    }

    /**
     * Stops webcam media stream
     */
    stopCamera() {
        this.isRecording = false;
        this.stopRecorderLoop();

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }
        document.getElementById('webcam-placeholder').style.display = 'flex';
        
        if (this.statusIndicator) {
            this.statusIndicator.classList.remove('active', 'recording');
        }
        if (this.statusText) this.statusText.textContent = 'Standby';
    }

    /**
     * Starts sleep monitoring session & lightweight MP4 recording with burned-in clocks
     */
    async startMonitoring(deviceId = null, bitrateBps = 800000) {
        if (!this.stream) {
            const ok = await this.startCamera(deviceId);
            if (!ok) return false;
        }

        this.recordedChunks = [];
        this.elapsedSeconds = 0;
        this.startTime = Date.now();
        window.cryptoSecurity.resetSession();

        const bitrate = Number(bitrateBps) || 800000;

        // Custom bitrate for lightweight MP4 file sizes
        const options = {
            mimeType: this.selectedMimeType,
            videoBitsPerSecond: bitrate
        };

        // Prepare Recorder Canvas for burning clocks onto the recorded video
        if (!this.recorderCanvas) {
            this.recorderCanvas = document.createElement('canvas');
        }
        const vw = this.videoElement?.videoWidth || 1280;
        const vh = this.videoElement?.videoHeight || 720;
        this.recorderCanvas.width = vw;
        this.recorderCanvas.height = vh;
        this.recorderCtx = this.recorderCanvas.getContext('2d', { alpha: false });

        this.isRecording = true;
        this.startRecorderLoop();

        // Capture video stream from canvas with burned-in clocks
        const canvasStream = this.recorderCanvas.captureStream(20);
        const audioTracks = this.stream.getAudioTracks();
        const recordStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...audioTracks
        ]);

        try {
            this.mediaRecorder = new MediaRecorder(recordStream, options);
        } catch (e) {
            console.warn("Fallback a MediaRecorder predefinito:", e);
            this.mediaRecorder = new MediaRecorder(recordStream);
        }

        this.mediaRecorder.ondataavailable = async (event) => {
            if (event.data && event.data.size > 0) {
                this.recordedChunks.push(event.data);
                // Compute SHA-256 hash chain node for this chunk
                await window.cryptoSecurity.processChunk(event.data, Date.now());
            }
        };

        this.mediaRecorder.start(1000); // collect 1s slice chunks

        // UI state
        if (this.recBadge) this.recBadge.classList.add('show');
        if (this.statusIndicator) {
            this.statusIndicator.classList.remove('active');
            this.statusIndicator.classList.add('recording');
        }
        if (this.statusText) this.statusText.textContent = 'Monitoraggio in corso (REC)';

        // Prevent Windows from going to sleep or turning off screen during monitoring
        try {
            if ('wakeLock' in navigator) {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log("WakeLock Windows attivo: il PC non andrà in sospensione.");
            }
        } catch (e) {
            console.warn("WakeLock non disponibile:", e);
        }

        // Start analytics sensors for motion & noise tracking
        if (window.analyticsEngine) {
            window.analyticsEngine.initSensors(this.videoElement, this.stream);
        }

        // Hide Eye Tracker & Skeleton Badge (Sospesi per oggi)
        const poseBadge = document.getElementById('pose-eye-badge');
        if (poseBadge) poseBadge.style.display = 'none';
        
        const poseCanvas = document.getElementById('pose-canvas');
        if (poseCanvas) poseCanvas.style.display = 'none';

        // Start elapsed timer
        this.startTimer();
        return true;
    }

    /**
     * Starts the elapsed timer (00:00:00)
     */
    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        const updateTimer = () => {
            this.elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
            const hrs = String(Math.floor(this.elapsedSeconds / 3600)).padStart(2, '0');
            const mins = String(Math.floor((this.elapsedSeconds % 3600) / 60)).padStart(2, '0');
            const secs = String(this.elapsedSeconds % 60).padStart(2, '0');

            if (this.timerElement) {
                this.timerElement.textContent = `${hrs}:${mins}:${secs}`;
            }
        };

        updateTimer();
        this.timerInterval = setInterval(updateTimer, 1000);
    }

    /**
     * Stops monitoring session and returns recorded MP4 video blob
     */
    async stopMonitoring() {
        if (!this.isRecording || !this.mediaRecorder) return null;

        return new Promise((resolve) => {
            this.mediaRecorder.onstop = () => {
                this.isRecording = false;
                this.stopRecorderLoop();

                // Stop timer
                if (this.timerInterval) {
                    clearInterval(this.timerInterval);
                    this.timerInterval = null;
                }

                // UI Reset
                if (this.recBadge) this.recBadge.classList.remove('show');
                if (this.statusIndicator) {
                    this.statusIndicator.classList.remove('recording');
                    this.statusIndicator.classList.add('active');
                }
                if (this.statusText) this.statusText.textContent = 'Monitoraggio Completato';

                // Build MP4 Blob
                const mime = this.selectedMimeType.split(';')[0] || 'video/mp4';
                const rawBlob = new Blob(this.recordedChunks, { type: mime });
                
                (async () => {
                    const videoBlob = window.ensurePlayableVideoBlob ? await window.ensurePlayableVideoBlob(rawBlob) : rawBlob;

                    const eventsLog = window.analyticsEngine ? window.analyticsEngine.stopSensors() : [];
                    const postureSummary = window.poseEyeTracker ? window.poseEyeTracker.stopTracking() : null;

                    const resultData = {
                        blob: videoBlob,
                        duration: this.elapsedSeconds,
                        mimeType: mime,
                        hashChain: [...window.cryptoSecurity.hashChain],
                        eventsLog: eventsLog,
                        postureSummary: postureSummary
                    };

                    if (this.wakeLock) {
                        this.wakeLock.release().catch(() => {});
                        this.wakeLock = null;
                    }

                    this.stopCamera();
                    resolve(resultData);
                })();
            };

            this.mediaRecorder.stop();
        });
    }
}

// Global instance export
window.webcamController = new WebcamController();
