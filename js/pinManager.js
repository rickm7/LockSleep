/**
 * LockSleep - Security PIN Manager Module
 * Handles first access PIN creation with confirmation, asterisk representation, and PIN verification.
 */

class PinManager {
    constructor() {
        this.STORAGE_KEY = 'locksleep_security_pin';
        this.sessionPin = null; // Active PIN chosen specifically for current video session
    }

    /**
     * Checks if a session PIN is active for current recording
     */
    isSessionPinSet() {
        return Boolean(this.sessionPin);
    }

    /**
     * Sets the session PIN for current recording session
     */
    setSessionPin(pin) {
        this.sessionPin = pin;
    }

    /**
     * Verifies if entered PIN matches active session PIN
     */
    verifySessionPin(pin) {
        if (!this.sessionPin) return false;
        return pin === this.sessionPin;
    }

    /**
     * Clears current session PIN when recording stops
     */
    clearSessionPin() {
        this.sessionPin = null;
    }
}

// Global instance export
window.pinManager = new PinManager();

/**
 * UI Helpers for PIN Keypads & Masking
 */
function updatePinDotsUI(containerId, currentLength, maxLength = 4) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const dots = container.querySelectorAll('.dot');
    dots.forEach((dot, index) => {
        if (index < currentLength) {
            dot.classList.add('filled');
        } else {
            dot.classList.remove('filled');
        }
    });
}
