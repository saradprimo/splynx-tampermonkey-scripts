// ==UserScript==
// @name         ONT Enquiry Notifier & Summary
// @namespace    https://github.com/saradprimo/splynx-tampermonkey-scripts
// @version      18.1.0
// @description  Full ONT summary with collapsible sections, handover & power summary symbols, notifier & summary buttons, connected devices with caching, scrollable summary, and GPON RX/TX power classification.
// @match        https://assure.ultrafastfibre.co.nz/csm*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @updateURL    https://raw.githubusercontent.com/saradprimo/splynx-tampermonkey-scripts/main/ont-enquiry-notifier-summary.user.js
// @downloadURL  https://raw.githubusercontent.com/saradprimo/splynx-tampermonkey-scripts/main/ont-enquiry-notifier-summary.user.js
// ==/UserScript==

(function () {
    'use strict';

    const CHECK_DELAY_MS = 1200;
    const FAILURE_KEYWORDS = ['api response taking too long', 'polling aborted', 'we are sorry for the inconvenience'];
    const successRedirectPattern = 'id=api_form&table=';
    let alreadyNotified = false;
    let lastUrl = location.href;
    let notifierBtn;

    // ---------- Utilities ----------
    function ensureNotificationPermission() {
        if (Notification.permission === 'granted') return Promise.resolve();
        if (Notification.permission === 'denied') return Promise.reject(new Error('Notifications are denied.'));
        return Notification.requestPermission().then(permission => {
            if (permission === 'granted') return;
            throw new Error('Notification permission not granted');
        });
    }

    function sendNotification(title, body) {
        try {
            const n = new Notification(title, { body, silent: false });
            n.onclick = () => window.focus();
        } catch (e) {
            console.error('ONT Enquiry Notifier: Notification failed:', e);
        }
    }

    function extractFieldValue(labelText) {
        const labels = Array.from(document.querySelectorAll('label.field-label'));
        const label = labels.find(l => l.innerText.trim() === labelText);
        if (label) {
            const container = label.closest('.form-group');
            if (container) {
                const input = container.querySelector('input');
                if (input && input.value.trim()) return input.value.trim();
                const span = container.querySelector('span.type-string');
                if (span && span.innerText.trim()) return span.innerText.trim();
                const textarea = container.querySelector('textarea');
                if (textarea && textarea.value.trim()) return textarea.value.trim();
            }
        }
        const inputByAria = document.querySelector(`input[aria-label="${labelText}"]`);
        if (inputByAria && inputByAria.value.trim()) return inputByAria.value.trim();
        return 'n/a';
    }

    function distanceSymbol(distStr) {
        if (!distStr || distStr === 'n/a') return distStr;
        let dist = parseFloat(distStr);
        if (dist < 10 || dist > 15000) return distStr + ' ❌';
        else if (dist > 10000) return distStr + ' ⚠️';
        else return distStr + ' ✅';
    }

    function classifyRxPower(power) {
        if (power === 'n/a') return { text: power, status: 'unknown' };
        power = parseFloat(power);
        if (power > -8) return { text: power + ' dBm', status: 'error' };
        if (power >= -12 && power <= -8) return { text: power + ' dBm', status: 'warn' };
        if (power >= -23 && power < -12) return { text: power + ' dBm', status: 'ok' };
        if (power < -25) return { text: power + ' dBm', status: 'error' };
        return { text: power + ' dBm', status: 'warn' };
    }

    function classifyTxPower(power) {
        if (power === 'n/a') return { text: power, status: 'unknown' };
        power = parseFloat(power);
        if (power < 0.5 || power > 5.0) return { text: power + ' dBm', status: 'error' };
        if ((power >= 0.5 && power < 2.0) || (power > 4.0 && power <= 5.0)) return { text: power + ' dBm', status: 'warn' };
        if (power >= 2.0 && power <= 4.0) return { text: power + ' dBm', status: 'ok' };
        return { text: power + ' dBm', status: 'warn' };
    }

    function addDetailsArrows() {
        document.querySelectorAll('#tffSummaryContent details').forEach(d => {
            if (!d.querySelector('.arrow')) {
                const summary = d.querySelector('summary');
                if (summary) {
                    const arrow = document.createElement('span');
                    arrow.className = 'arrow';
                    arrow.style.marginRight = '6px';
                    arrow.textContent = d.open ? '▼' : '▶';
                    summary.prepend(arrow);
                    summary.style.cursor = 'pointer';
                    summary.addEventListener('click', () => {
                        setTimeout(() => { arrow.textContent = d.open ? '▼' : '▶'; }, 0);
                    });
                }
            }
        });
    }

    function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    function fetchMacVendor(mac) {
        return new Promise(resolve => {
            GM_xmlhttpRequest({
                method: "GET",
                url: "https://api.macvendors.com/" + encodeURIComponent(mac),
                onload: res => resolve(res.status === 200 && res.responseText.trim() ? res.responseText.trim() : "Unknown"),
                onerror: () => resolve("Unknown")
            });
        });
    }

    // ---------- Build Summary ----------
    function buildSummary() {
        // ... [Entire buildSummary function unchanged] ...
    }

    // ---------- Initial Build ----------
    const interval = setInterval(() => {
        if (extractFieldValue('Raw JSON Payload') !== 'n/a') {
            clearInterval(interval);
            buildSummary();
        }
    }, 500);

    // ---------- URL Change Detection ----------
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            const summary = document.getElementById('tffSummaryWidget');
            if (summary) summary.style.display = 'none';
            const quickBtn = document.getElementById('quickSummaryBtn');
            if (quickBtn) quickBtn.style.display = 'none';
            if (notifierBtn) notifierBtn.style.display = 'block';
        }
    }, 1000);

    // ---------- Notifier Button ----------
    (function addNotifierWidget() {
        notifierBtn = document.createElement('button');
        notifierBtn.id = 'ontNotifierBtn';
        notifierBtn.textContent = 'ONT Enquiry Notifier';
        Object.assign(notifierBtn.style, {
            position: 'fixed',
            right: '12px',
            bottom: '12px',
            padding: '8px 14px',
            backgroundColor: '#0074D9',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: 'pointer',
            zIndex: 9999
        });
        notifierBtn.title = 'Click to request notification permission and send a test notification';
        notifierBtn.addEventListener('click', () => {
            ensureNotificationPermission().then(() => sendNotification(
                'ONT Enquiry Notifier active',
                'You will be notified when the test starts or finishes.'
            ));
        });
        document.body.appendChild(notifierBtn);
    })();

    // ---------- Observer for failures & success ----------
    const container = document.body;
    const observer = new MutationObserver(() => {
        if (observer._timer) clearTimeout(observer._timer);
        observer._timer = setTimeout(() => {
            const text = container.innerText.toLowerCase();
            if (FAILURE_KEYWORDS.some(k => text.includes(k))) {
                ensureNotificationPermission().then(() => sendNotification(
                    'ONT Test FAILED',
                    'ONT test failed — retrying automatically.'
                ));
                alreadyNotified = false;
                const runBtn = document.querySelector('button[ng-click="c.runTest()"]');
                if (runBtn) runBtn.click();
                return;
            }

            if (window.location.href.includes(successRedirectPattern)) {
                if (!alreadyNotified) {
                    ensureNotificationPermission().then(() => sendNotification(
                        'ONT Test COMPLETE',
                        'ONT test completed successfully.'
                    ));
                    alreadyNotified = true;
                    const summary = document.getElementById('tffSummaryWidget');
                    if (summary) {
                        summary.style.display = 'block';
                        if (notifierBtn) notifierBtn.style.display = 'none';
                    }
                }
            }
        }, CHECK_DELAY_MS);
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true });

    // ---------- Summary UI ----------
    (function addSummaryUI() {
        const summary = document.createElement('div');
        summary.id = 'tffSummaryWidget';
        const contentContainer = document.createElement('div');
        contentContainer.id = 'tffSummaryContent';
        // ... [Entire addSummaryUI function unchanged] ...
    })();

})();
