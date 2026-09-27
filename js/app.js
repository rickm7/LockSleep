/**
 * LockSleep - Application Entry Point & Controller
 * Binds PIN Setup & Verification, Webcam controls, IndexedDB Video Gallery, and Player.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. DOM Elements
    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');
    const btnGalleryToggle = document.getElementById('btn-gallery-toggle');
    const btnSettingsPin = document.getElementById('btn-settings-pin');
    const btnToggleNight = document.getElementById('btn-toggle-night');
    const cameraSelect = document.getElementById('camera-select');
    
    // Modals
    const modalPinSetup = document.getElementById('modal-pin-setup');
    const modalPinVerify = document.getElementById('modal-pin-verify');
    const modalGallery = document.getElementById('modal-gallery');
    const modalPlayer = document.getElementById('modal-player');
    const btnCloseGallery = document.getElementById('btn-close-gallery');
    const btnClosePlayer = document.getElementById('btn-close-player');

    // PIN Setup Elements
    const setupPinDots = 'setup-pin-dots';
    const inputPinSetup = document.getElementById('input-pin-setup');
    const setupKeypad = document.getElementById('setup-keypad');
    const btnPinSetupSubmit = document.getElementById('btn-pin-setup-submit');
    const pinSetupStepDesc = document.getElementById('pin-setup-step-desc');

    // PIN Verification Elements
    const verifyPinDots = 'verify-pin-dots';
    const inputPinVerify = document.getElementById('input-pin-verify');
    const verifyKeypad = document.getElementById('verify-keypad');
    const btnPinVerifySubmit = document.getElementById('btn-pin-verify-submit');
    const verifyPinError = document.getElementById('verify-pin-error');
    const btnCancelVerify = document.getElementById('btn-cancel-verify');

    // Gallery & Player Elements
    const galleryGrid = document.getElementById('gallery-grid');
    const screenshotsGrid = document.getElementById('screenshots-grid');
    const galleryCountBadge = document.getElementById('gallery-count-badge');
    const screenshotsCountBadge = document.getElementById('screenshots-count-badge');
    const btnScreenshotsToggle = document.getElementById('btn-screenshots-toggle');
    const tabCategoryVideos = document.getElementById('tab-category-videos');
    const tabCategoryScreenshots = document.getElementById('tab-category-screenshots');
    const tabVideosBadge = document.getElementById('tab-videos-badge');
    const tabScreenshotsBadge = document.getElementById('tab-screenshots-badge');
    const statCategoryIcon = document.getElementById('stat-category-icon');
    const statTotalLabel = document.getElementById('stat-total-label');
    const btnClearLabel = document.getElementById('btn-clear-label');
    const statTotalCount = document.getElementById('stat-total-count');
    const statTotalSize = document.getElementById('stat-total-size');
    const btnClearAll = document.getElementById('btn-clear-all');
    const mainVideoPlayer = document.getElementById('main-video-player');
    const playerVideoTitle = document.getElementById('player-video-title');
    const playerVideoMeta = document.getElementById('player-video-meta');
    const btnDownloadMp4 = document.getElementById('btn-download-mp4');
    const btnDeleteCurrentVideo = document.getElementById('btn-delete-current-video');

    // Snapshot & Screenshot Viewer Elements
    const btnTakeSnapshot = document.getElementById('btn-take-snapshot');
    const btnTakeSnapshotOverlay = document.getElementById('btn-take-snapshot-overlay');
    const cameraFlashOverlay = document.getElementById('camera-flash-overlay');
    const modalScreenshotViewer = document.getElementById('modal-screenshot-viewer');
    const viewerScreenshotTitle = document.getElementById('viewer-screenshot-title');
    const viewerScreenshotMeta = document.getElementById('viewer-screenshot-meta');
    const viewerScreenshotImg = document.getElementById('viewer-screenshot-img');
    const btnDownloadScreenshot = document.getElementById('btn-download-screenshot');
    const btnDeleteCurrentScreenshot = document.getElementById('btn-delete-current-screenshot');
    const btnCloseScreenshotViewer = document.getElementById('btn-close-screenshot-viewer');

    // State Variables
    let setupStep = 'CREATE'; // 'CREATE' or 'CONFIRM'
    let firstPinAttempt = '';
    let setupBuffer = '';
    let verifyBuffer = '';
    let currentOpenVideoId = null;
    let currentOpenScreenshotId = null;
    let currentGalleryCategory = 'videos'; // 'videos' or 'screenshots'

    // 2. Initialize Database & Webcam
    await window.sleepDb.init();
    window.webcamController.init(
        document.getElementById('webcam-feed'),
        document.getElementById('overlay-real-time'),
        document.getElementById('overlay-timer'),
        document.getElementById('rec-badge'),
        document.getElementById('status-indicator'),
        document.getElementById('status-text')
    );

    // 3. Populate cameras and gallery badge
    await loadCameras();
    await updateGalleryBadge();

    // ==========================================
    // QUICK START & QUICK STOP ENGINE (BroadcastChannel)
    // ==========================================
    const locksleepChannel = new BroadcastChannel('locksleep_quick_channel');

    // Handle Quick Stop broadcast from Stop_Rapido.bat
    locksleepChannel.onmessage = async (event) => {
        if (event.data && event.data.action === 'quick_stop') {
            if (window.webcamController && window.webcamController.isRecording) {
                if (blackoutOverlay) blackoutOverlay.classList.remove('active');
                const resultData = await window.webcamController.stopMonitoring();
                btnStart.disabled = false;
                btnStop.disabled = true;
                cameraSelect.disabled = false;
                const qualitySelect = document.getElementById('quality-select');
                if (qualitySelect) qualitySelect.disabled = false;

                if (resultData && resultData.blob) {
                    await window.sleepDb.saveRecording(
                        resultData.blob,
                        resultData.duration,
                        resultData.mimeType,
                        resultData.hashChain,
                        false,
                        resultData.eventsLog || [],
                        resultData.postureSummary || null
                    );
                    await updateGalleryBadge();
                    window.pinManager.clearSessionPin();
                    showToast("⏹️ Registrazione interrotta e salvata!", "success");
                }
                setTimeout(() => window.close(), 800);
            }
        }
    };

    // Check URL parameters for instant Quick Start & Quick Stop
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('autostop') === '1') {
        // Broadcast stop signal to active app and close helper window
        locksleepChannel.postMessage({ action: 'quick_stop' });
        setTimeout(() => window.close(), 300);
        return;
    }

    if (urlParams.get('autostart') === '1') {
        // Instant Quick Start: Bypass PIN modal, set session PIN, start monitoring immediately!
        window.pinManager.setSessionPin('0000');
        const qualitySelect = document.getElementById('quality-select');
        const selectedBitrate = qualitySelect ? qualitySelect.value : 800000;
        
        setTimeout(async () => {
            const ok = await window.webcamController.startMonitoring(cameraSelect.value, selectedBitrate);
            if (ok) {
                btnStart.disabled = true;
                btnStop.disabled = false;
                cameraSelect.disabled = true;
                if (qualitySelect) qualitySelect.disabled = true;
                showToast("🔴 Registrazione Rapida Avviata Istantaneamente!", "success");
            }
        }, 200);
    }

    // Camera list selector listener (Privilegia la fotocamera reale fisica rispetto ad OBS Virtual Camera)
    async function loadCameras() {
        const cameras = await window.webcamController.getCameras();
        cameraSelect.innerHTML = '';
        if (cameras.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Fotocamera Predefinita';
            cameraSelect.appendChild(opt);
        } else {
            // Ordina le fotocamere mettendo prima quelle fisiche reali (HD Webcam) e per ultime quelle virtuali (OBS)
            const sortedCameras = [...cameras].sort((a, b) => {
                const labelA = (a.label || '').toLowerCase();
                const labelB = (b.label || '').toLowerCase();
                const isVirtualA = labelA.includes('obs') || labelA.includes('virtual');
                const isVirtualB = labelB.includes('obs') || labelB.includes('virtual');
                if (isVirtualA && !isVirtualB) return 1;
                if (!isVirtualA && isVirtualB) return -1;
                return 0;
            });

            sortedCameras.forEach((cam, index) => {
                const opt = document.createElement('option');
                opt.value = cam.deviceId;
                const isVirtual = (cam.label || '').toLowerCase().includes('obs') || (cam.label || '').toLowerCase().includes('virtual');
                opt.textContent = cam.label || (isVirtual ? `Fotocamera Virtuale ${index + 1}` : `Fotocamera Reale ${index + 1}`);
                cameraSelect.appendChild(opt);
            });
        }
    }

    cameraSelect.addEventListener('change', () => {
        if (!window.webcamController.isRecording) {
            window.webcamController.startCamera(cameraSelect.value);
        }
    });

    // Audio Boost selector listener
    const audioBoostSelect = document.getElementById('audio-boost-select');
    window.currentAudioGain = 3.5;

    if (audioBoostSelect) {
        audioBoostSelect.addEventListener('change', () => {
            window.currentAudioGain = Number(audioBoostSelect.value) || 3.5;
            if (window.audioDSP) {
                window.audioDSP.setGain(window.currentAudioGain);
            }
        });
    }

    // Night vision toggle listener
    btnToggleNight.addEventListener('click', () => {
        const wrapper = document.getElementById('webcam-wrapper');
        wrapper.classList.toggle('night-mode');
        btnToggleNight.classList.toggle('active');
    });

    // Ambient Night-Light Lamp toggle listener
    const btnToggleLamp = document.getElementById('btn-toggle-lamp');
    const nightLightOverlay = document.getElementById('night-light-overlay');

    if (btnToggleLamp && nightLightOverlay) {
        btnToggleLamp.addEventListener('click', () => {
            nightLightOverlay.classList.toggle('active');
            btnToggleLamp.classList.toggle('active');
            if (window.showToast) {
                const isActive = nightLightOverlay.classList.contains('active');
                window.showToast(
                    isActive ? "Luce Notturna Webcam Attivata (Illumina la stanza senza disturbare il sonno)" : "Luce Notturna Disattivata",
                    isActive ? "info" : "secondary"
                );
            }
        });
    }

    // Cover Alarm Toggle listener (Attiva/Disattiva allarme copertura)
    const btnToggleCoverAlarm = document.getElementById('btn-toggle-cover-alarm');
    if (btnToggleCoverAlarm) {
        btnToggleCoverAlarm.addEventListener('click', () => {
            if (window.analyticsEngine) {
                window.analyticsEngine.alarmEnabled = !window.analyticsEngine.alarmEnabled;
                btnToggleCoverAlarm.classList.toggle('active', window.analyticsEngine.alarmEnabled);
                btnToggleCoverAlarm.querySelector('span').textContent = window.analyticsEngine.alarmEnabled ? "Allarme Copertura: ON" : "Allarme Copertura: OFF";
                if (window.showToast) {
                    window.showToast(
                        window.analyticsEngine.alarmEnabled ? "Allarme Copertura Fotocamera: ATTIVATO" : "Allarme Copertura Fotocamera: DISATTIVATO",
                        window.analyticsEngine.alarmEnabled ? "danger" : "secondary"
                    );
                }
            }
        });
    }

    // Discrete Mode toggle listener (Schermo Nero & Muto Totale)
    const btnDiscreteMode = document.getElementById('btn-discrete-mode');
    const blackoutOverlay = document.getElementById('blackout-overlay');

    if (btnDiscreteMode && blackoutOverlay) {
        btnDiscreteMode.addEventListener('click', () => {
            blackoutOverlay.classList.add('active');
            if (window.analyticsEngine) {
                window.analyticsEngine.alarmEnabled = false; // Mute all acoustic alarms
            }
            if (window.showToast) {
                window.showToast("Modalità Discreta Attivata (Schermo Nero & Muto Totale)", "info");
            }
        });

        // Click on Blackout Overlay opens PIN verification to unlock
        blackoutOverlay.addEventListener('click', () => {
            if (window.pinManager.isPinSet()) {
                verifyBuffer = '';
                inputPinVerify.value = '';
                updatePinDotsUI(verifyPinDots, 0);
                verifyPinError.style.display = 'none';
                btnPinVerifySubmit.disabled = true;
                openModal(modalPinVerify);
                setTimeout(() => inputPinVerify.focus(), 100);
            } else {
                blackoutOverlay.classList.remove('active');
                if (window.analyticsEngine) {
                    window.analyticsEngine.alarmEnabled = true;
                }
            }
        });
    }

    // ==========================================
    // SCREENSHOT & INSTANT SNAPSHOT ENGINE
    // ==========================================
    function playShutterSound() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const audioCtx = new AudioContext();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(650, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.08);
            gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.09);
        } catch (e) {
            // Audio context restrictions or unavailable
        }
    }

    async function takeSnapshot() {
        const videoFeed = document.getElementById('webcam-feed');

        // 1. If camera is not active, start camera preview automatically
        if (!window.webcamController.stream || !videoFeed || videoFeed.readyState < 2) {
            if (window.showToast) window.showToast("Attivazione fotocamera per lo screenshot...", "info");
            const ok = await window.webcamController.startCamera(cameraSelect.value);
            if (!ok) {
                if (window.showToast) window.showToast("Impossibile accedere alla webcam per lo screenshot.", "danger");
                return;
            }
            await new Promise(r => setTimeout(r, 650));
        }

        // 2. Camera Shutter Flash & Sound
        if (cameraFlashOverlay) {
            cameraFlashOverlay.style.display = 'block';
            cameraFlashOverlay.classList.remove('flash');
            void cameraFlashOverlay.offsetWidth;
            cameraFlashOverlay.classList.add('flash');
            setTimeout(() => {
                cameraFlashOverlay.style.display = 'none';
            }, 400);
        }
        playShutterSound();

        // 3. Create canvas for crisp full-resolution screenshot
        const vw = videoFeed.videoWidth || 1280;
        const vh = videoFeed.videoHeight || 720;
        const canvas = document.createElement('canvas');
        canvas.width = vw;
        canvas.height = vh;
        const ctx = canvas.getContext('2d');

        // Apply night vision filter if active
        const isNightMode = document.getElementById('webcam-wrapper')?.classList.contains('night-mode');
        if (isNightMode) {
            ctx.filter = 'brightness(2.2) contrast(1.6) grayscale(0.8) hue-rotate(90deg)';
            ctx.drawImage(videoFeed, 0, 0, vw, vh);
            ctx.filter = 'none';
        } else {
            ctx.drawImage(videoFeed, 0, 0, vw, vh);
        }

        // Draw stylish clocks & timestamp overlay on the screenshot
        if (window.webcamController && typeof window.webcamController.drawOverlayOnRecorder === 'function') {
            window.webcamController.drawOverlayOnRecorder(ctx, vw, vh, new Date());
        }

        // 4. Convert to blob and save into IndexedDB
        canvas.toBlob(async (blob) => {
            if (!blob) {
                if (window.showToast) window.showToast("Errore cattura screenshot", "danger");
                return;
            }

            try {
                const snapId = await window.sleepDb.saveScreenshot(blob, vw, vh);
                await updateGalleryBadge();
                if (currentGalleryCategory === 'screenshots' && modalGallery.classList.contains('active')) {
                    renderScreenshotsList();
                }
                if (window.showToast) {
                    window.showToast(`📸 Screenshot #${snapId} catturato e salvato nell'archivio!`, "success");
                }
            } catch (err) {
                console.error("Errore salvataggio screenshot:", err);
                if (window.showToast) window.showToast("Errore durante il salvataggio dello screenshot", "danger");
            }
        }, 'image/png');
    }

    if (btnTakeSnapshot) {
        btnTakeSnapshot.addEventListener('click', takeSnapshot);
    }
    if (btnTakeSnapshotOverlay) {
        btnTakeSnapshotOverlay.addEventListener('click', takeSnapshot);
    }

    // ==========================================
    // PIN SETUP MODAL LOGIC (Tastiera Fisica)
    // ==========================================
    function resetSetupPINUI() {
        setupStep = 'CREATE';
        firstPinAttempt = '';
        setupBuffer = '';
        pinSetupStepDesc.textContent = "Imposta un PIN di sicurezza a 4 cifre usando la tastiera del PC.";
        updatePinDotsUI(setupPinDots, 0);
        btnPinSetupSubmit.disabled = true;
        inputPinSetup.value = '';
        setTimeout(() => inputPinSetup.focus(), 100);
    }

    // Auto-focus input when clicking inside setup pin box
    document.getElementById('setup-pin-box')?.addEventListener('click', () => {
        inputPinSetup.focus();
    });

    inputPinSetup.addEventListener('input', (e) => {
        setupBuffer = inputPinSetup.value.replace(/\D/g, '').slice(0, 4);
        inputPinSetup.value = setupBuffer;
        updatePinDotsUI(setupPinDots, setupBuffer.length);
        btnPinSetupSubmit.disabled = setupBuffer.length !== 4;
    });

    inputPinSetup.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && setupBuffer.length === 4) {
            handleSetupSubmit();
        }
    });

    btnPinSetupSubmit.addEventListener('click', handleSetupSubmit);

    // Toast Notification System (Sostituisce gli alert del browser)
    window.showToast = function(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast-card ${type}`;

        const iconClass = type === 'success' ? 'fa-circle-check' : (type === 'danger' ? 'fa-triangle-exclamation' : 'fa-circle-info');

        toast.innerHTML = `
            <i class="fa-solid ${iconClass}"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 350);
        }, 4000);
    };

    // Custom Confirm Modal System (Sostituisce i confirm del browser)
    const modalConfirm = document.getElementById('modal-confirm');
    const confirmTitle = document.getElementById('confirm-title');
    const confirmMessage = document.getElementById('confirm-message');
    const btnConfirmYes = document.getElementById('btn-confirm-yes');
    const btnConfirmNo = document.getElementById('btn-confirm-no');
    let onConfirmCallback = null;

    function showCustomConfirm(title, message, onConfirm) {
        confirmTitle.textContent = title;
        confirmMessage.textContent = message;
        onConfirmCallback = onConfirm;
        openModal(modalConfirm);
    }

    btnConfirmYes.addEventListener('click', () => {
        closeModal(modalConfirm);
        if (onConfirmCallback) onConfirmCallback();
    });

    btnConfirmNo.addEventListener('click', () => {
        closeModal(modalConfirm);
    });

    // ==========================================
    // PIN SETUP MODAL LOGIC (Per Singola Registrazione)
    // ==========================================
    function resetSetupPINUI() {
        setupStep = 'CREATE';
        firstPinAttempt = '';
        setupBuffer = '';
        if (pinSetupStepDesc) {
            pinSetupStepDesc.textContent = "Imposta un PIN a 4 cifre con la tastiera per QUESTA registrazione.";
        }
        updatePinDotsUI(setupPinDots, 0);
        if (btnPinSetupSubmit) btnPinSetupSubmit.disabled = true;
        if (inputPinSetup) {
            inputPinSetup.value = '';
            setTimeout(() => inputPinSetup.focus(), 100);
        }
    }

    document.getElementById('setup-pin-box')?.addEventListener('click', () => {
        if (inputPinSetup) inputPinSetup.focus();
    });

    if (inputPinSetup) {
        inputPinSetup.addEventListener('input', () => {
            setupBuffer = inputPinSetup.value.replace(/\D/g, '').slice(0, 4);
            inputPinSetup.value = setupBuffer;
            updatePinDotsUI(setupPinDots, setupBuffer.length);
            if (btnPinSetupSubmit) btnPinSetupSubmit.disabled = setupBuffer.length !== 4;
        });

        inputPinSetup.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && setupBuffer.length === 4) {
                handleSetupSubmit();
            }
        });
    }

    if (btnPinSetupSubmit) {
        btnPinSetupSubmit.addEventListener('click', handleSetupSubmit);
    }

    async function handleSetupSubmit() {
        if (setupBuffer.length !== 4) return;

        if (setupStep === 'CREATE') {
            firstPinAttempt = setupBuffer;
            setupStep = 'CONFIRM';
            setupBuffer = '';
            if (inputPinSetup) inputPinSetup.value = '';
            if (pinSetupStepDesc) {
                pinSetupStepDesc.textContent = "🔒 Conferma il tuo PIN: digitalo di nuovo con la tastiera.";
            }
            updatePinDotsUI(setupPinDots, 0);
            if (btnPinSetupSubmit) btnPinSetupSubmit.disabled = true;
            if (inputPinSetup) inputPinSetup.focus();
        } else if (setupStep === 'CONFIRM') {
            if (setupBuffer === firstPinAttempt) {
                window.pinManager.setSessionPin(setupBuffer);
                closeModal(modalPinSetup);

                // Start recording after PIN set!
                const qualitySelect = document.getElementById('quality-select');
                const selectedBitrate = qualitySelect ? qualitySelect.value : 800000;

                const ok = await window.webcamController.startMonitoring(cameraSelect.value, selectedBitrate);
                if (ok) {
                    btnStart.disabled = true;
                    btnStop.disabled = false;
                    cameraSelect.disabled = true;
                    if (qualitySelect) qualitySelect.disabled = true;
                    showToast("PIN impostato! Monitoraggio del sonno avviato.", "success");
                }
            } else {
                showToast("I PIN non coincidono. Riprova dall'inizio.", "danger");
                resetSetupPINUI();
            }
        }
    }

    // ==========================================
    // ACTION CONTROLS: START & STOP
    // ==========================================
    btnStart.addEventListener('click', () => {
        openModal(modalPinSetup);
        resetSetupPINUI();
    });

    // STOP button triggers PIN verification modal
    btnStop.addEventListener('click', () => {
        verifyBuffer = '';
        inputPinVerify.value = '';
        updatePinDotsUI(verifyPinDots, 0);
        verifyPinError.style.display = 'none';
        btnPinVerifySubmit.disabled = true;
        openModal(modalPinVerify);
        setTimeout(() => inputPinVerify.focus(), 100);
    });

    document.getElementById('verify-pin-box')?.addEventListener('click', () => {
        inputPinVerify.focus();
    });

    // Cancel verification modal
    btnCancelVerify.addEventListener('click', () => {
        closeModal(modalPinVerify);
    });

    // Emergency Unlock button listener (Se l'utente dimentica il PIN)
    const btnEmergencyUnlock = document.getElementById('btn-emergency-unlock');
    if (btnEmergencyUnlock) {
        btnEmergencyUnlock.addEventListener('click', () => {
            showCustomConfirm(
                "Sblocco di Emergenza",
                "Sei sicuro di voler effettuare lo sblocco di emergenza? La registrazione attuale verrà salvata ed interrotta.",
                async () => {
                    closeModal(modalPinVerify);
                    if (blackoutOverlay) blackoutOverlay.classList.remove('active');
                    if (window.analyticsEngine) window.analyticsEngine.alarmEnabled = true;

                    const resultData = await window.webcamController.stopMonitoring();
                    btnStart.disabled = false;
                    btnStop.disabled = true;
                    cameraSelect.disabled = false;
                    const qualitySelect = document.getElementById('quality-select');
                    if (qualitySelect) qualitySelect.disabled = false;

                    if (resultData && resultData.blob) {
                        await window.sleepDb.saveRecording(
                            resultData.blob,
                            resultData.duration,
                            resultData.mimeType,
                            resultData.hashChain,
                            false,
                            resultData.eventsLog || [],
                            resultData.postureSummary || null
                        );
                        await updateGalleryBadge();
                        window.pinManager.clearSessionPin();
                        showToast("Sblocco di emergenza effettuato. Registrazione salvata nel database locale.", "warning");
                    }
                }
            );
        });
    }

    inputPinVerify.addEventListener('input', () => {
        verifyBuffer = inputPinVerify.value.replace(/\D/g, '').slice(0, 4);
        inputPinVerify.value = verifyBuffer;
        updatePinDotsUI(verifyPinDots, verifyBuffer.length);
        verifyPinError.style.display = 'none';
        btnPinVerifySubmit.disabled = verifyBuffer.length !== 4;
    });

    inputPinVerify.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && verifyBuffer.length === 4) {
            handleVerifySubmit();
        }
    });

    btnPinVerifySubmit.addEventListener('click', handleVerifySubmit);

    async function handleVerifySubmit() {
        if (verifyBuffer.length !== 4) return;

        if (window.pinManager.verifySessionPin(verifyBuffer)) {
            closeModal(modalPinVerify);
            if (blackoutOverlay) blackoutOverlay.classList.remove('active');
            if (window.analyticsEngine) window.analyticsEngine.alarmEnabled = true;

            // Correct PIN! Stop recording and save to IndexedDB
            const resultData = await window.webcamController.stopMonitoring();
            btnStart.disabled = false;
            btnStop.disabled = true;
            cameraSelect.disabled = false;
            const qualitySelect = document.getElementById('quality-select');
            if (qualitySelect) qualitySelect.disabled = false;

            if (resultData && resultData.blob) {
                const recordId = await window.sleepDb.saveRecording(
                    resultData.blob,
                    resultData.duration,
                    resultData.mimeType,
                    resultData.hashChain,
                    false,
                    resultData.eventsLog || [],
                    resultData.postureSummary || null
                );
                await updateGalleryBadge();
                window.pinManager.clearSessionPin();
                showToast("Monitoraggio interrotto. Video MP4 sigillato con SHA-256 e salvato nel database locale.", "success");
            }
        } else {
            // Incorrect PIN -> Shake modal
            verifyPinError.style.display = 'flex';
            const modalCard = modalPinVerify.querySelector('.modal-card');
            modalCard.classList.add('shake');
            setTimeout(() => modalCard.classList.remove('shake'), 400);
            verifyBuffer = '';
            updatePinDotsUI(verifyPinDots, 0);
            btnPinVerifySubmit.disabled = true;
        }
    }

    async function openVideoPlayer(id) {
        const record = await window.sleepDb.getRecording(id);
        if (!record) return;

        currentOpenVideoId = record.id;
        const playableBlob = await window.ensurePlayableVideoBlob(record.blob);
        const videoUrl = URL.createObjectURL(playableBlob);

        const motionCount = (record.eventsLog || []).filter(e => e.type === 'motion').length;
        const noiseCount = (record.eventsLog || []).filter(e => e.type === 'noise' || e.type === 'car_rumble' || e.type === 'high_whistle').length;
        const postureText = record.postureSummary ? ` • ${record.postureSummary.summaryText}` : '';

        playerVideoTitle.textContent = `Registrazione Sonno #${record.id}`;
        playerVideoMeta.textContent = `${record.dateFormatted} • Durata: ${formatDuration(record.duration)} • ${record.sizeFormatted} • Movimenti: ${motionCount} • Suoni: ${noiseCount}${postureText}`;

        mainVideoPlayer.src = videoUrl;
        btnDownloadMp4.href = videoUrl;
        btnDownloadMp4.download = `sonno_registrazione_${record.id}.mp4`;

        // Render interactive timeline markers
        renderTimelineMarkers(record.duration, record.eventsLog || []);

        openModal(modalPlayer);
        mainVideoPlayer.play().catch(e => console.warn("Autoplay:", e));
    }

    // Timeline Progress Sync with Video Player
    mainVideoPlayer.addEventListener('timeupdate', () => {
        const progress = document.getElementById('timeline-progress');
        if (progress && mainVideoPlayer.duration) {
            const percent = (mainVideoPlayer.currentTime / mainVideoPlayer.duration) * 100;
            progress.style.width = `${percent}%`;
        }
    });

    // Timeline Click Seeking
    const timelineTrack = document.getElementById('timeline-track');
    if (timelineTrack) {
        timelineTrack.addEventListener('click', (e) => {
            if (!mainVideoPlayer.duration) return;
            const rect = timelineTrack.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percent = Math.max(0, Math.min(1, clickX / rect.width));
            mainVideoPlayer.currentTime = percent * mainVideoPlayer.duration;
        });
    }

    function renderTimelineMarkers(totalDurationSec, eventsLog) {
        const layer = document.getElementById('timeline-markers-layer');
        if (!layer) return;
        layer.innerHTML = '';

        if (!totalDurationSec || totalDurationSec <= 0 || !eventsLog || eventsLog.length === 0) return;

        eventsLog.forEach(evt => {
            const posPercent = (evt.timeSec / totalDurationSec) * 100;
            if (posPercent < 0 || posPercent > 100) return;

            const marker = document.createElement('div');
            marker.className = `timeline-marker ${evt.type}`;
            marker.style.left = `${posPercent}%`;
            marker.title = `${formatDuration(evt.timeSec)} - ${evt.label}`;

            marker.addEventListener('click', (e) => {
                e.stopPropagation();
                mainVideoPlayer.currentTime = evt.timeSec;
                showToast(`Salto a ${formatDuration(evt.timeSec)}: ${evt.label}`, "info");
            });

            layer.appendChild(marker);
        });
    }

    // ==========================================
    // GALLERY & MEDIA ARCHIVE LOGIC (Videos & Screenshots)
    // ==========================================
    btnGalleryToggle.addEventListener('click', () => {
        switchGalleryCategory('videos');
        openModal(modalGallery);
    });

    if (btnScreenshotsToggle) {
        btnScreenshotsToggle.addEventListener('click', () => {
            switchGalleryCategory('screenshots');
            openModal(modalGallery);
        });
    }

    if (tabCategoryVideos) {
        tabCategoryVideos.addEventListener('click', () => switchGalleryCategory('videos'));
    }

    if (tabCategoryScreenshots) {
        tabCategoryScreenshots.addEventListener('click', () => switchGalleryCategory('screenshots'));
    }

    function switchGalleryCategory(category) {
        currentGalleryCategory = category;
        if (category === 'videos') {
            tabCategoryVideos?.classList.add('active');
            tabCategoryScreenshots?.classList.remove('active');
            if (galleryGrid) galleryGrid.style.display = 'grid';
            if (screenshotsGrid) screenshotsGrid.style.display = 'none';
            if (statCategoryIcon) statCategoryIcon.className = 'fa-solid fa-video';
            if (btnClearLabel) btnClearLabel.textContent = 'Svuota Video';
            renderGalleryList();
        } else {
            tabCategoryVideos?.classList.remove('active');
            tabCategoryScreenshots?.classList.add('active');
            if (galleryGrid) galleryGrid.style.display = 'none';
            if (screenshotsGrid) screenshotsGrid.style.display = 'grid';
            if (statCategoryIcon) statCategoryIcon.className = 'fa-solid fa-camera';
            if (btnClearLabel) btnClearLabel.textContent = 'Svuota Screenshot';
            renderScreenshotsList();
        }
    }

    btnCloseGallery.addEventListener('click', () => closeModal(modalGallery));
    
    btnClosePlayer.addEventListener('click', () => {
        mainVideoPlayer.pause();
        mainVideoPlayer.src = '';
        closeModal(modalPlayer);
    });

    if (btnCloseScreenshotViewer) {
        btnCloseScreenshotViewer.addEventListener('click', () => {
            if (viewerScreenshotImg) viewerScreenshotImg.src = '';
            closeModal(modalScreenshotViewer);
        });
    }

    async function updateGalleryBadge() {
        try {
            const records = await window.sleepDb.getAllRecordings();
            const screenshots = await window.sleepDb.getAllScreenshots();

            if (galleryCountBadge) galleryCountBadge.textContent = records.length;
            if (tabVideosBadge) tabVideosBadge.textContent = records.length;

            if (screenshotsCountBadge) screenshotsCountBadge.textContent = screenshots.length;
            if (tabScreenshotsBadge) tabScreenshotsBadge.textContent = screenshots.length;
        } catch (e) {
            console.error("Errore aggiornamento badge:", e);
        }
    }

    async function renderGalleryList() {
        const records = await window.sleepDb.getAllRecordings();
        if (statTotalLabel) {
            statTotalLabel.innerHTML = `Totale Video: <strong id="stat-total-count">${records.length}</strong>`;
        }

        let totalSizeBytes = 0;
        records.forEach(r => totalSizeBytes += (r.sizeBytes || 0));
        if (statTotalSize) {
            statTotalSize.textContent = (totalSizeBytes / (1024 * 1024)).toFixed(2) + ' MB';
        }

        if (records.length === 0) {
            galleryGrid.innerHTML = `
                <div class="empty-gallery">
                    <i class="fa-solid fa-moon"></i>
                    <p>Nessuna registrazione salvata.</p>
                    <small>Le tue sessioni di sonno appariranno qui appena fermi una registrazione.</small>
                </div>
            `;
            return;
        }

        galleryGrid.innerHTML = '';
        for (const rec of records) {
            const card = document.createElement('div');
            card.className = 'video-card';

            const playableBlob = await window.ensurePlayableVideoBlob(rec.blob);
            const blobUrl = URL.createObjectURL(playableBlob);

            const durationStr = formatDuration(rec.duration);

            card.innerHTML = `
                <div class="video-thumb-preview" data-id="${rec.id}">
                    <video src="${blobUrl}#t=0.5" preload="metadata" muted></video>
                    <div class="thumb-play-icon"><i class="fa-solid fa-play"></i></div>
                </div>
                <div class="video-card-info">
                    <span class="video-card-title">Registrazione Sonno #${rec.id}</span>
                    <div class="video-card-meta">
                        <span><i class="fa-regular fa-calendar"></i> ${rec.dateFormatted}</span>
                        <span><i class="fa-regular fa-clock"></i> ${durationStr}</span>
                    </div>
                    <div class="video-card-meta" style="margin-top: 2px;">
                        <span><i class="fa-solid fa-shield-halved" style="color: var(--success);"></i> SHA-256 Integrale</span>
                        <span>${rec.sizeFormatted}</span>
                    </div>
                </div>
                <div class="video-card-actions">
                    <button class="btn btn-secondary btn-play" data-id="${rec.id}">
                        <i class="fa-solid fa-play"></i> Guarda
                    </button>
                    <a class="btn btn-secondary btn-dl" href="${blobUrl}" download="sonno_registrazione_${rec.id}.mp4">
                        <i class="fa-solid fa-download"></i> MP4
                    </a>
                </div>
            `;

            galleryGrid.appendChild(card);

            // Card play button listener
            card.querySelector('.btn-play').addEventListener('click', () => openVideoPlayer(rec.id));
            card.querySelector('.video-thumb-preview').addEventListener('click', () => openVideoPlayer(rec.id));
        }
    }

    async function renderScreenshotsList() {
        if (!screenshotsGrid) return;
        const screenshots = await window.sleepDb.getAllScreenshots();
        if (statTotalLabel) {
            statTotalLabel.innerHTML = `Totale Screenshot: <strong id="stat-total-count">${screenshots.length}</strong>`;
        }

        let totalSizeBytes = 0;
        screenshots.forEach(s => totalSizeBytes += (s.sizeBytes || 0));
        const sizeStr = totalSizeBytes > 1024 * 1024
            ? (totalSizeBytes / (1024 * 1024)).toFixed(2) + ' MB'
            : (totalSizeBytes / 1024).toFixed(1) + ' KB';
        if (statTotalSize) statTotalSize.textContent = sizeStr;

        if (screenshots.length === 0) {
            screenshotsGrid.innerHTML = `
                <div class="empty-gallery">
                    <i class="fa-solid fa-camera"></i>
                    <p>Nessuno screenshot salvato.</p>
                    <small>Usa il pulsante "Scatta Screenshot" per catturare un'immagine istantanea.</small>
                </div>
            `;
            return;
        }

        screenshotsGrid.innerHTML = '';
        for (const snap of screenshots) {
            const card = document.createElement('div');
            card.className = 'screenshot-card';
            const imgUrl = URL.createObjectURL(snap.blob);

            card.innerHTML = `
                <div class="screenshot-thumb-preview" data-id="${snap.id}" title="Clicca per ingrandire">
                    <img src="${imgUrl}" alt="Screenshot #${snap.id}">
                    <div class="thumb-zoom-icon"><i class="fa-solid fa-magnifying-glass-plus"></i></div>
                </div>
                <div class="video-card-info">
                    <span class="video-card-title">Screenshot #${snap.id}</span>
                    <div class="video-card-meta">
                        <span><i class="fa-regular fa-calendar"></i> ${snap.dateFormatted}</span>
                        <span><i class="fa-solid fa-expand"></i> ${snap.resolution}</span>
                    </div>
                    <div class="video-card-meta" style="margin-top: 2px;">
                        <span><i class="fa-solid fa-file-image" style="color: var(--primary);"></i> PNG</span>
                        <span>${snap.sizeFormatted}</span>
                    </div>
                </div>
                <div class="video-card-actions">
                    <button class="btn btn-secondary btn-view" data-id="${snap.id}">
                        <i class="fa-solid fa-eye"></i> Vedi
                    </button>
                    <a class="btn btn-secondary btn-dl" href="${imgUrl}" download="screenshot_sonno_${snap.id}.png">
                        <i class="fa-solid fa-download"></i> PNG
                    </a>
                    <button class="btn btn-danger btn-del" data-id="${snap.id}" title="Elimina screenshot" style="flex: 0 0 42px; padding: 6px 0;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;

            screenshotsGrid.appendChild(card);

            card.querySelector('.btn-view').addEventListener('click', () => openScreenshotViewer(snap.id));
            card.querySelector('.screenshot-thumb-preview').addEventListener('click', () => openScreenshotViewer(snap.id));
            card.querySelector('.btn-del').addEventListener('click', () => deleteSingleScreenshot(snap.id));
        }
    }

    async function openScreenshotViewer(id) {
        const snap = await window.sleepDb.getScreenshot(id);
        if (!snap) return;

        currentOpenScreenshotId = snap.id;
        const imgUrl = URL.createObjectURL(snap.blob);

        if (viewerScreenshotTitle) {
            viewerScreenshotTitle.innerHTML = `<i class="fa-solid fa-camera"></i> Screenshot #${snap.id}`;
        }
        if (viewerScreenshotMeta) {
            viewerScreenshotMeta.textContent = `${snap.dateFormatted} • PNG • Risoluzione: ${snap.resolution} • ${snap.sizeFormatted}`;
        }
        if (viewerScreenshotImg) {
            viewerScreenshotImg.src = imgUrl;
        }
        if (btnDownloadScreenshot) {
            btnDownloadScreenshot.href = imgUrl;
            btnDownloadScreenshot.download = `screenshot_sonno_${snap.id}.png`;
        }

        openModal(modalScreenshotViewer);
    }

    function deleteSingleScreenshot(id) {
        showCustomConfirm(
            "Elimina Screenshot",
            `Sei sicuro di voler eliminare definitivamente lo screenshot #${id}?`,
            async () => {
                await window.sleepDb.deleteScreenshot(id);
                await updateGalleryBadge();
                renderScreenshotsList();
                showToast("Screenshot eliminato con successo", "info");
            }
        );
    }

    if (btnDeleteCurrentScreenshot) {
        btnDeleteCurrentScreenshot.addEventListener('click', () => {
            if (!currentOpenScreenshotId) return;
            showCustomConfirm(
                "Elimina Screenshot",
                `Sei sicuro di voler eliminare questo screenshot?`,
                async () => {
                    await window.sleepDb.deleteScreenshot(currentOpenScreenshotId);
                    if (viewerScreenshotImg) viewerScreenshotImg.src = '';
                    closeModal(modalScreenshotViewer);
                    await updateGalleryBadge();
                    renderScreenshotsList();
                    showToast("Screenshot eliminato con successo", "info");
                }
            );
        });
    }

    btnDeleteCurrentVideo.addEventListener('click', () => {
        if (!currentOpenVideoId) return;
        showCustomConfirm(
            "Elimina Registrazione",
            "Sei sicuro di voler eliminare definitivamente questo video dal database locale?",
            async () => {
                await window.sleepDb.deleteRecording(currentOpenVideoId);
                mainVideoPlayer.pause();
                mainVideoPlayer.src = '';
                closeModal(modalPlayer);
                await updateGalleryBadge();
                renderGalleryList();
                showToast("Video eliminato con successo", "info");
            }
        );
    });

    btnClearAll.addEventListener('click', () => {
        if (currentGalleryCategory === 'videos') {
            showCustomConfirm(
                "Svuota Video",
                "Sei sicuro di voler eliminare tutte le registrazioni video dal database del PC?",
                async () => {
                    await window.sleepDb.clearAll();
                    await updateGalleryBadge();
                    renderGalleryList();
                    showToast("Tutti i video sono stati eliminati", "info");
                }
            );
        } else {
            showCustomConfirm(
                "Svuota Screenshot",
                "Sei sicuro di voler eliminare tutti gli screenshot salvati dal database del PC?",
                async () => {
                    await window.sleepDb.clearAllScreenshots();
                    await updateGalleryBadge();
                    renderScreenshotsList();
                    showToast("Tutti gli screenshot sono stati eliminati", "info");
                }
            );
        }
    });

    // Helper functions
    function openModal(modalEl) {
        modalEl.classList.add('active');
    }

    function closeModal(modalEl) {
        modalEl.classList.remove('active');
    }

    function formatDuration(seconds) {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hrs > 0) {
            return `${hrs}h ${mins}m ${secs}s`;
        }
        return `${mins}m ${secs}s`;
    }
});
