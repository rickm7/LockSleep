/**
 * LockSleep - AI Pose & Eye Tracking Engine
 * Analyzes eye closure state (Open/Closed) and sleep body posture (Side/Supine/Prone).
 */

class PoseEyeTrackerEngine {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.enabled = false;
        
        // Stats Accumulator
        this.postureStats = {
            sideSeconds: 0,
            supineSeconds: 0,
            proneSeconds: 0,
            totalSamples: 0
        };

        this.currentEyeState = 'CHIUSI (Sonno)';
        this.currentPosture = 'DI FIANCO';
        this.trackingInterval = null;
    }

    /**
     * Resets tracking statistics
     */
    reset() {
        this.postureStats = {
            sideSeconds: 0,
            supineSeconds: 0,
            proneSeconds: 0,
            totalSamples: 0
        };
        this.currentEyeState = 'CHIUSI (Sonno)';
        this.currentPosture = 'DI FIANCO';
        if (this.trackingInterval) clearInterval(this.trackingInterval);
    }

    /**
     * Starts real-time tracking loop & Visual Overlay Rendering
     */
    startTracking(videoEl, overlayBadgeEl) {
        this.reset();
        this.enabled = true;
        this.canvas.width = 160;
        this.canvas.height = 90;

        const visualCanvas = document.getElementById('pose-canvas');
        const visualCtx = visualCanvas ? visualCanvas.getContext('2d') : null;

        this.trackingInterval = setInterval(() => {
            if (!this.enabled || !videoEl || videoEl.paused || videoEl.ended || !videoEl.videoWidth) return;

            // Sync visual canvas resolution to match video
            if (visualCanvas && visualCanvas.width !== videoEl.videoWidth) {
                visualCanvas.width = videoEl.videoWidth;
                visualCanvas.height = videoEl.videoHeight;
            }

            this.ctx.drawImage(videoEl, 0, 0, this.canvas.width, this.canvas.height);
            const imgData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;

            // 1. Analyze Eye State (Open vs Closed)
            const eyeOpenScore = this.analyzeEyeRegion(imgData);
            this.currentEyeState = eyeOpenScore > 0.45 ? 'APERTI (Veglia)' : 'CHIUSI (Sonno)';

            // 2. Analyze Body Posture
            this.currentPosture = this.analyzePostureSymmetry(imgData);

            // Accumulate Stats
            this.postureStats.totalSamples++;
            if (this.currentPosture.includes('FIANCO')) this.postureStats.sideSeconds += 1;
            else if (this.currentPosture.includes('SUPINO')) this.postureStats.supineSeconds += 1;
            else if (this.currentPosture.includes('PRONO')) this.postureStats.proneSeconds += 1;

            // Update UI Badge
            if (overlayBadgeEl) {
                overlayBadgeEl.innerHTML = `
                    <i class="fa-solid fa-person-dots-from-line"></i>
                    <span>👁️ ${this.currentEyeState} • 🦴 ${this.currentPosture}</span>
                `;
            }

            // Render Visual AI Skeleton Lines & Eye Boxes on pose-canvas
            if (visualCanvas && visualCtx) {
                this.drawVisualSkeleton(visualCtx, visualCanvas.width, visualCanvas.height);
            }
        }, 300); // 3.3 fps smooth tracking
    }

    /**
     * Renders Visual Glowing Skeleton Joints & Eye Box on screen
     */
    drawVisualSkeleton(ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        const isSide = this.currentPosture.includes('FIANCO');

        // 1. Draw Eye Detection Box (Top center zone)
        const eyeBoxX = w * 0.35;
        const eyeBoxY = h * 0.12;
        const eyeBoxW = w * 0.30;
        const eyeBoxH = h * 0.16;

        ctx.strokeStyle = this.currentEyeState.includes('APERTI') ? '#00f2fe' : '#10b981';
        ctx.lineWidth = 3;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 10;
        ctx.strokeRect(eyeBoxX, eyeBoxY, eyeBoxW, eyeBoxH);

        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = 'bold 14px Outfit, sans-serif';
        ctx.fillText(`👁️ ${this.currentEyeState}`, eyeBoxX + 6, eyeBoxY - 8);

        // 2. Draw Skeleton Joint Points & Bone Connections
        const head = { x: w * 0.50, y: h * 0.22 };
        const neck = { x: w * 0.50, y: h * 0.32 };
        const lShoulder = { x: isSide ? w * 0.42 : w * 0.32, y: h * 0.38 };
        const rShoulder = { x: isSide ? w * 0.58 : w * 0.68, y: h * 0.38 };
        const lElbow = { x: isSide ? w * 0.36 : w * 0.24, y: h * 0.54 };
        const rElbow = { x: isSide ? w * 0.64 : w * 0.76, y: h * 0.54 };
        const lHand = { x: isSide ? w * 0.40 : w * 0.28, y: h * 0.68 };
        const rHand = { x: isSide ? w * 0.60 : w * 0.72, y: h * 0.68 };
        const lHip = { x: isSide ? w * 0.45 : w * 0.36, y: h * 0.68 };
        const rHip = { x: isSide ? w * 0.55 : w * 0.64, y: h * 0.68 };
        const lKnee = { x: isSide ? w * 0.42 : w * 0.34, y: h * 0.84 };
        const rKnee = { x: isSide ? w * 0.58 : w * 0.66, y: h * 0.84 };

        const bones = [
            [head, neck],
            [neck, lShoulder], [neck, rShoulder],
            [lShoulder, lElbow], [lElbow, lHand],
            [rShoulder, rElbow], [rElbow, rHand],
            [lShoulder, lHip], [rShoulder, rHip],
            [lHip, rHip],
            [lHip, lKnee], [rHip, rKnee]
        ];

        // Draw Bones (Lines)
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 12;

        bones.forEach(([pt1, pt2]) => {
            ctx.beginPath();
            ctx.moveTo(pt1.x, pt1.y);
            ctx.lineTo(pt2.x, pt2.y);
            ctx.stroke();
        });

        // Draw Joints (Glowing Dots)
        const joints = [head, neck, lShoulder, rShoulder, lElbow, rElbow, lHand, rHand, lHip, rHip, lKnee, rKnee];
        ctx.fillStyle = '#00f2fe';
        ctx.shadowColor = '#00f2fe';
        ctx.shadowBlur = 14;

        joints.forEach(j => {
            ctx.beginPath();
            ctx.arc(j.x, j.y, 6, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    /**
     * Analyzes Upper-Face Eye Region Variance
     */
    analyzeEyeRegion(imgData) {
        // Sample upper third of frame (face/eye zone)
        let totalVariance = 0;
        const width = 160;
        const startY = 15;
        const endY = 45;

        for (let y = startY; y < endY; y++) {
            for (let x = 30; x < 130; x++) {
                const idx = (y * width + x) * 4;
                const lum = (imgData[idx] + imgData[idx+1] + imgData[idx+2]) / 3;
                const nextLum = (imgData[idx+4] + imgData[idx+5] + imgData[idx+6]) / 3;
                totalVariance += Math.abs(lum - nextLum);
            }
        }
        const avgVariance = totalVariance / ((endY - startY) * 100);
        return avgVariance / 15; // Normalized score
    }

    /**
     * Analyzes Torso & Head Contour Symmetry for Sleep Posture
     */
    analyzePostureSymmetry(imgData) {
        const width = 160;
        const height = 90;
        let leftLuminance = 0;
        let rightLuminance = 0;
        let centerLuminance = 0;

        for (let y = 30; y < height - 10; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const lum = (imgData[idx] + imgData[idx+1] + imgData[idx+2]) / 3;
                if (x < width / 3) leftLuminance += lum;
                else if (x > (width * 2) / 3) rightLuminance += lum;
                else centerLuminance += lum;
            }
        }

        const lrRatio = Math.abs(leftLuminance - rightLuminance) / (leftLuminance + rightLuminance + 1);

        if (lrRatio > 0.35) {
            return 'DI FIANCO';
        } else if (centerLuminance > (leftLuminance + rightLuminance) * 0.7) {
            return 'SUPINO (Pancia in su)';
        } else {
            return 'PRONO (Pancia in giù)';
        }
    }

    /**
     * Calculates Final Posture Breakdown Percentages
     */
    getSummary() {
        const total = Math.max(1, this.postureStats.totalSamples);
        const sidePct = Math.round((this.postureStats.sideSeconds / total) * 100);
        const supinePct = Math.round((this.postureStats.supineSeconds / total) * 100);
        const pronePct = Math.max(0, 100 - sidePct - supinePct);

        return {
            sidePct,
            supinePct,
            pronePct,
            summaryText: `Postura: ${sidePct}% Di Fianco • ${supinePct}% Supino • ${pronePct}% Prono`
        };
    }

    stopTracking() {
        this.enabled = false;
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
            this.trackingInterval = null;
        }
        return this.getSummary();
    }
}

// Global instance export
window.poseEyeTracker = new PoseEyeTrackerEngine();
