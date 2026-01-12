// ==UserScript==
// @name         ONT Enquiry Notifier & Summary
// @namespace    https://github.com/saradprimo/splynx-tampermonkey-scripts
// @version      18.2
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
        const rawJson = extractFieldValue('Raw JSON Payload');
        let data;
        try { data = JSON.parse(rawJson); }
        catch (e) { console.error('Failed to parse JSON payload:', e); return; }

        const ont = data.result?.ont || {};
        const detectedFaults = data.result?.detectedFaults || [];
        const alarms = data.result?.alarms || [];
        const ports = ont.dataPorts || [];

        const ontModel = ont.model || ont.modelName || ont.attributes?.model || extractFieldValue('ONT Model') || 'n/a';
        const ontSerial = ont.ontSerialNumber || ont.serialNumber || ont.attributes?.serialNumber || extractFieldValue('ONT Serial Number') || 'n/a';
        const ontStatus = data.result?.status || 'n/a';
        const distance = ont.distance ? `${ont.distance} m` : 'n/a';
        const rxPowerRaw = data.result?.downstream?.signalLevel ?? ont.downstream?.signalLevel ?? 'n/a';
        const txPowerRaw = data.result?.upstream?.signalLevel ?? ont.upstream?.signalLevel ?? 'n/a';
        const rxPower = classifyRxPower(rxPowerRaw);
        const txPower = classifyTxPower(txPowerRaw);

        const serviceObj = data.product?.dataServices?.[0] || {};
        const svid = serviceObj.svlan || 'n/a';
        const cvid = serviceObj.cvlan || 'n/a';
        const ontPortConfigured = serviceObj.port || 'n/a';

        const igPiid = serviceObj.igPiid || '';
        let handoverName = 'Unknown';
        if (igPiid === 'UFF000003537375') handoverName = 'DORY';
        else if (igPiid === 'UFF000003537381') handoverName = 'ZEBRA';
        const handoverDisplay = `${handoverName}@<br>ONT#${ontPortConfigured}`;

        const provisioningStatus = serviceObj.provisioningStatus || 'n/a';
        const serviceType = data.product?.service?.type || 'n/a';
        const taggingMode = serviceObj.taggingMode || 'n/a';
        const cevlan = serviceObj.cevlan || 'n/a';

        const provisioningStatusSymbol = provisioningStatus === 'Provisioned' ? '✅' : '❌';
        const serviceTypeSymbol = serviceType === 'Bitstream 2 Ultra' ? '✅' : '❌';
        const taggingModeSymbol = taggingMode.toLowerCase() === 'tagged' ? '✅' : '❌';
        const cevlanSymbol = cevlan === '10' ? '✅' : '❌';

        // ---------- Handover overall symbol ----------
        let handoverSymbol = '❌';
        const allCorrect = provisioningStatus === 'Provisioned' && serviceType === 'Bitstream 2 Ultra' &&
            taggingMode.toLowerCase() === 'tagged' && cevlan === '10';
        const noneCorrect = provisioningStatus !== 'Provisioned' && serviceType !== 'Bitstream 2 Ultra' &&
            taggingMode.toLowerCase() !== 'tagged' && cevlan !== '10';
        if (allCorrect) handoverSymbol = '✅';
        else if (!allCorrect && !noneCorrect) handoverSymbol = '⚠️';
        else handoverSymbol = '❌';

        // ---------- Power overall symbol ----------
        let powerSymbolSummary = '❌';
        if (rxPower.status === 'ok' && txPower.status === 'ok') powerSymbolSummary = '✅';
        else if (rxPower.status !== 'error' && txPower.status !== 'error') powerSymbolSummary = '⚠️';
        else powerSymbolSummary = '❌';

        // ---------- Build HTML ----------
        let content = `<div style="font-weight:bold; font-size:16px; margin-bottom:8px; color:#001f3f;">ONT Test Summary</div>`;

        // Detected Issues / Outages
        let issuesContent = detectedFaults.map(f =>
            `Title: ${f.title}\nSeverity: ${f.severity}\nExplanation: ${f.explanation}\nRecommended Action: ${f.actions}`
        ).join('\n\n');
        let alarmsContent = alarms.map(a =>
            `Title: ${a.title}\nLevel: ${a.alarmLevel}\nOccurred: ${a.occurredDateTime}\nReset: ${a.resetDateTime}`
        ).join('\n\n');

        let issuesHeaderColor = '#ff4136';
        let issuesDisplayContent = '';
        if (issuesContent || alarmsContent) {
            issuesDisplayContent = `${issuesContent ? `<pre>${issuesContent}</pre>` : ''}${alarmsContent ? `<pre>${alarmsContent}</pre>` : ''}`;
        } else {
            issuesHeaderColor = '#2ecc40';
            issuesDisplayContent = '<div>No Detected Issues / Outages</div>';
        }
        content += `<details open>
                        <summary style="cursor:pointer; font-weight:bold; color:${issuesHeaderColor};">Detected Issues / Outages</summary>
                        ${issuesDisplayContent}
                    </details>`;

        // ONT Port Match
        let ontPortActive = 'n/a';
        const activePort = ports.find(p => p.linkUp);
        if (activePort) ontPortActive = activePort.portName.replace('ETH', '').trim();
        let portMatch = `<span style="color:#ff4136">❌</span>`;
        const configuredNumber = parseInt(ontPortConfigured, 10);
        const activeNumber = parseInt(ontPortActive, 10);
        if (!isNaN(configuredNumber) && !isNaN(activeNumber) && configuredNumber === activeNumber) {
            portMatch = `<span style="color:#2ecc40">✅</span>`;
        }
        content += `<details>
                        <summary style="cursor:pointer; font-weight:bold;">ONT Port Match: ${portMatch}</summary>
                        <div><b>Configured:</b> ${ontPortConfigured}</div>
                        <div><b>Active:</b> ${ontPortActive}</div>
                    </details>`;

        // ONT Details
        const ontModelLink = `<a href="https://www.google.com/search?q=${encodeURIComponent(ontModel)}" target="_blank" style="color:#0074D9; font-weight:bold;">${ontModel} →</a>`;
        content += `<details>
                        <summary style="cursor:pointer; font-weight:bold;">ONT Details</summary>
                        <div><b>Status:</b> ${ontStatus}</div>
                        <div><b>Model:</b> ${ontModelLink}</div>
                        <div><b>Serial Number:</b> ${ontSerial}</div>
                        <div><b>Distance to OLT:</b> ${distanceSymbol(distance)}</div>
                    </details>`;

        // Connected Devices Section
        const connectedDevicesContainerId = 'connectedDevicesContainer';
        content += `<details>
                        <summary style="cursor:pointer; font-weight:bold;">Connected Devices</summary>
                        <div id="${connectedDevicesContainerId}"></div>
                    </details>`;

        // Power
        content += `<details>
                        <summary style="cursor:pointer; font-weight:bold;">Power ${powerSymbolSummary}</summary>
                        <div><b>Rx Power:</b> <span style="color:${rxPower.status==='ok'?'#2ecc40':rxPower.status==='warn'?'#ff851b':'#ff4136'}">${rxPower.text}</span></div>
                        <div><b>Tx Power:</b> <span style="color:${txPower.status==='ok'?'#2ecc40':txPower.status==='warn'?'#ff851b':'#ff4136'}">${txPower.text}</span></div>
                    </details>`;

        // Handover Details
        content += `<details>
                        <summary style="cursor:pointer; font-weight:bold;">Handover Details ${handoverSymbol}</summary>
                        <div>${handoverDisplay}</div>
                        <div><b>Provisioning Status:</b> ${provisioningStatus} ${provisioningStatusSymbol}</div>
                        <div><b>Service Type:</b> ${serviceType} ${serviceTypeSymbol}</div>
                        <div><b>Tagging Mode:</b> ${taggingMode} ${taggingModeSymbol}</div>
                        <div><b>CEVLAN:</b> ${cevlan} ${cevlanSymbol}</div>
                    </details>`;

        const contentContainer = document.getElementById('tffSummaryContent');
        if (contentContainer) {
            contentContainer.innerHTML = content;
            addDetailsArrows();
        }

        // ---------- Populate connected devices ----------
        const macCache = {};
        if (ports.length) {
            (async () => {
                const connectedDevicesContainer = document.getElementById(connectedDevicesContainerId);
                if (!connectedDevicesContainer) return;

                for (const port of ports) {
                    if (port.linkUp && port.status === 'Active' && Array.isArray(port.macAddress) && port.macAddress.length) {
                        const devices = [];
                        for (const macObj of port.macAddress) {
                            const mac = macObj.macAddress;
                            let vendor = macCache[mac];
                            if (!vendor) {
                                vendor = await fetchMacVendor(mac);
                                macCache[mac] = vendor;
                                await delay(1000);
                            }
                            devices.push([mac, vendor]);
                        }

                        const table = document.createElement('table');
                        table.style.borderCollapse = 'collapse';
                        table.style.marginTop = '4px';
                        devices.forEach(([mac, vendor]) => {
                            const row = document.createElement('tr');
                            [mac, vendor].forEach(v => {
                                const td = document.createElement('td');
                                td.textContent = v;
                                td.style.border = '1px solid #ccc';
                                td.style.padding = '2px 6px';
                                td.style.fontSize = '12px';
                                row.appendChild(td);
                            });
                            table.appendChild(row);
                        });

                        const portDiv = document.createElement('div');
                        portDiv.style.marginBottom = '6px';
                        portDiv.innerHTML = `<b>${port.portName}:</b>`;
                        portDiv.appendChild(table);
                        connectedDevicesContainer.appendChild(portDiv);
                    }
                }

                if (!connectedDevicesContainer.querySelector('table')) {
                    connectedDevicesContainer.innerHTML += '<div>No connected devices detected.</div>';
                }
            })();
        }
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

        Object.assign(summary.style, {
            position: 'fixed',
            right: '12px',
            bottom: '12px',
            padding: '20px',
            background: '#f8f8f8',
            color: '#333',
            borderRadius: '10px',
            fontSize: '14px',
            zIndex: 10001,
            maxWidth: '350px',
            maxHeight: '80vh',
            lineHeight: '1.6',
            boxShadow: '0 0 12px rgba(0,0,0,0.2)',
            border: '1px solid #ccc',
            fontFamily: 'Segoe UI, sans-serif',
            display: 'none',
            overflowY: 'auto'
        });

        const closeBtn = document.createElement('div');
        closeBtn.innerHTML = '&times;';
        closeBtn.title = 'Close';
        closeBtn.style.cssText = `position: absolute; top: 8px; right: 12px; font-size: 18px; cursor: pointer; color: #888;`;
        closeBtn.onclick = () => {
            summary.style.display = 'none';
            const quickBtn = document.getElementById('quickSummaryBtn');
            if (quickBtn) quickBtn.style.display = 'block';
            if (notifierBtn) notifierBtn.style.display = 'block';
        };
        summary.appendChild(closeBtn);

        summary.appendChild(contentContainer);
        document.body.appendChild(summary);

        const quickBtn = document.createElement('button');
        quickBtn.id = 'quickSummaryBtn';
        quickBtn.innerText = 'ONT Summary';
        quickBtn.style.cssText = `position: fixed; right: 12px; bottom: 60px; padding: 8px 14px; background-color: #0074D9; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; z-index: 9999; display: none;`;
        quickBtn.onclick = () => {
            summary.style.display = 'block';
            quickBtn.style.display = 'none';
            if (notifierBtn) notifierBtn.style.display = 'none';
            addDetailsArrows();
        };
        document.body.appendChild(quickBtn);
    })();

})();

