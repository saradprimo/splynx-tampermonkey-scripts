// ==UserScript==
// @name         Unified Primo Enquiry Buttons
// @namespace    https://github.com/saradprimo/splynx-tampermonkey-scripts
// @version      2.3
// @description  Unified script: ONT, VOIP, XVNE, Preseem buttons + ONT Notifier & Summary
// @match        *://*/*
// @grant        GM_notification
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/saradprimo/splynx-tampermonkey-scripts/main/unified-enquiry-buttons.user.js
// @downloadURL  https://raw.githubusercontent.com/saradprimo/splynx-tampermonkey-scripts/main/unified-enquiry-buttons.user.js
// ==/UserScript==

(function() {
    'use strict';

    const host = window.location.host;
    const currentUrl = window.location.href;

    // ============================================================================
    // HELPER: Create Info Icon with Tooltip
    // ============================================================================
    function createInfoIcon(message, button) {
        // Store the current button content before modifying
        const currentContent = button.innerHTML || button.textContent;

        // Make button position relative so icon can be absolutely positioned
        button.style.position = 'relative';
        button.style.paddingRight = '30px'; // Add space for the icon

        // Create the icon element
        const icon = document.createElement('span');
        icon.innerHTML = '<i class="fa fa-info-circle"></i>';
        icon.style.position = 'absolute';
        icon.style.top = '4px';
        icon.style.right = '6px';
        icon.style.cursor = 'pointer';
        icon.style.color = '#0056b3'; // Darker blue for better visibility
        icon.style.fontSize = '14px';
        icon.style.zIndex = '1000';
        icon.style.pointerEvents = 'auto'; // Always clickable
        icon.title = 'Click for requirements';

        icon.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            alert(message);
            return false;
        };

        icon.onmousedown = (e) => {
            e.stopPropagation();
            e.preventDefault();
            return false;
        };

        return icon;
    }

    // ============================================================================
    // 1. VOIP ENQUIRY BUTTON
    // ============================================================================
    (function voipEnquiry() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlTarget = urlParams.get('auto_voip');

        // --- SESSION LOGIC ---
        if (urlTarget) {
            GM_setValue("active_voip_session", urlTarget);
            GM_deleteValue("voip_finished");
        }

        const currentSessionTarget = GM_getValue("active_voip_session");
        const isFinished = GM_getValue("voip_finished");

        if (host !== 'splynx.primo.net.nz') {
            if (!currentSessionTarget || isFinished === "true") return;
        }

        // --- SPLYNX DOMAIN ---
        if (host === 'splynx.primo.net.nz') {
            let lastNumberState = '';

            function findValidVoipRows() {
                const validNumbers = [];
                const table = document.querySelector('#admin_customers_services_voice_list');
                if (!table) return validNumbers;

                // DYNAMIC COLUMN SEARCH - Find "Phone" column index
                const headers = Array.from(table.querySelectorAll('thead th'));
                const phoneColumnIndex = headers.findIndex(th =>
                    th.textContent.trim().toLowerCase() === 'phone'
                );

                // If Phone column not found, return empty
                if (phoneColumnIndex === -1) return validNumbers;

                const rows = table.querySelectorAll('tbody tr.odd, tbody tr.even');

                for (const row of rows) {
                    const tds = row.querySelectorAll('td');
                    if (tds.length <= phoneColumnIndex) continue;

                    // Find status badge
                    const badge = row.querySelector('label.badge.bg-success, label.badge.bg-primary');
                    const statusText = badge ? badge.textContent.trim().toLowerCase() : '';

                    // Find plan text (look through all cells for "primovoice")
                    let hasPrimoVoice = false;
                    for (const td of tds) {
                        const text = td.textContent.trim().toLowerCase();
                        if (text.replace(/\s/g, '').includes('primovoice')) {
                            hasPrimoVoice = true;
                            break;
                        }
                    }

                    if (statusText === 'active' && hasPrimoVoice) {
                        const phoneCell = tds[phoneColumnIndex].textContent.trim();
                        const num = phoneCell.split(',')[0].trim();
                        if (num && !validNumbers.includes(num)) {
                            validNumbers.push(num);
                        }
                    }
                }

                return validNumbers;
            }

            function isServicesTabActive() {
                const activeTab = document.querySelector('a.active_tab.tabs__link');
                return activeTab && activeTab.textContent.trim().toLowerCase().includes('services');
            }

            function startProcess(phone) {
                GM_deleteValue("voip_finished");
                GM_setValue("active_voip_session", phone);
                GM_openInTab(`https://primocap.2talk.co.nz/account?auto_voip=${phone}`, { active: true });
            }

            function createOrUpdateVOIPButton() {
                const header = document.querySelector('.card-block-header .pull-right');
                if (!header) return;

                const wrapperId = 'voip_enquiry_wrapper';
                let wrapper = document.getElementById(wrapperId);

                if (!isServicesTabActive()) {
                    if (wrapper) wrapper.remove();
                    return;
                }

                const validNumbers = findValidVoipRows();
                const currentState = validNumbers.join(',');

                if (currentState === lastNumberState && wrapper) return;
                lastNumberState = currentState;

                if (!wrapper) {
                    wrapper = document.createElement('div');
                    wrapper.id = wrapperId;
                    wrapper.className = 'btn-group btn-group-xs';
                    wrapper.setAttribute('role', 'group');
                    wrapper.style.marginRight = '20px';
                    wrapper.style.position = 'relative';
                    header.insertBefore(wrapper, header.firstChild);
                } else {
                    wrapper.innerHTML = '';
                }

                if (validNumbers.length === 0) {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'btn btn-secondary';
                    button.disabled = true;
                    button.style.minWidth = '120px';

                    // Create text node first
                    const textSpan = document.createElement('span');
                    textSpan.textContent = 'VOIP Enquiry';
                    button.appendChild(textSpan);

                    // Add info icon
                    const infoMessage = 'VOIP Enquiry Requirements:\n\n' +
                        '✓ Services tab must be active\n' +
                        '✓ At least one service with status "Active"\n' +
                        '✓ Service plan must contain "PrimoVoice"\n' +
                        '✓ "Phone" column must be visible in the table\n' +
                        '✓ Phone number must be present in the Phone column';
                    const icon = createInfoIcon(infoMessage, button);
                    button.appendChild(icon);

                    wrapper.appendChild(button);
                } else if (validNumbers.length === 1) {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'btn btn-primary';
                    button.textContent = 'VOIP Enquiry';
                    button.style.minWidth = '120px';
                    button.onclick = () => startProcess(validNumbers[0]);
                    wrapper.appendChild(button);
                } else {
                    const dropdownButton = document.createElement('button');
                    dropdownButton.className = 'btn btn-primary dropdown-toggle';
                    dropdownButton.textContent = 'VOIP Enquiry';
                    wrapper.appendChild(dropdownButton);

                    const menu = document.createElement('div');
                    Object.assign(menu.style, {
                        position: 'absolute',
                        top: '110%',
                        left: '0',
                        backgroundColor: '#fff',
                        border: '1px solid #ccc',
                        borderRadius: '6px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                        padding: '4px 0',
                        zIndex: '9999',
                        display: 'none',
                        minWidth: '130px'
                    });

                    validNumbers.forEach(num => {
                        const item = document.createElement('div');
                        item.textContent = num;
                        item.style.padding = '6px 12px';
                        item.style.cursor = 'pointer';
                        item.style.fontSize = '12px';
                        item.style.color = '#333';
                        item.onmouseenter = () => item.style.backgroundColor = '#f0f0f0';
                        item.onmouseleave = () => item.style.backgroundColor = '';
                        item.onclick = () => {
                            startProcess(num);
                            menu.style.display = 'none';
                        };
                        menu.appendChild(item);
                    });

                    dropdownButton.onclick = (e) => {
                        e.stopPropagation();
                        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                    };

                    document.addEventListener('click', () => (menu.style.display = 'none'));
                    wrapper.appendChild(menu);
                }
            }

            const observer = new MutationObserver(() => createOrUpdateVOIPButton());
            observer.observe(document.body, { childList: true, subtree: true });
            setTimeout(createOrUpdateVOIPButton, 1000);
        }

        // --- 2TALK AUTOMATION ---
        if (host.includes('2talk.co.nz')) {
            const target = currentSessionTarget;
            const forceInput = (input) => {
                input.focus();
                input.value = target;
                ['input', 'change'].forEach(ev => input.dispatchEvent(new Event(ev, { bubbles: true })));
                const ent = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true };
                input.dispatchEvent(new KeyboardEvent('keydown', ent));
                input.dispatchEvent(new KeyboardEvent('keyup', ent));
            };

            const runAutomation = () => {
                if (GM_getValue("voip_finished") === "true") return;
                const path = window.location.pathname;

                if (host.includes('primocap')) {
                    if (path.includes('/account')) {
                        document.querySelector('a[href="/customer"]')?.click();
                    } else if (path === '/customer') {
                        const filter = document.getElementById('customer-filter');
                        if (filter && !filter.dataset.done) {
                            filter.dataset.done = "true";
                            forceInput(filter);
                        }
                        const row = document.querySelector('tr[data-account-code]');
                        if (row) {
                            window.location.href = `/customer/status?AccountCode=${row.getAttribute('data-account-code')}&auto_voip=${target}`;
                        }
                    } else if (path.includes('/customer/')) {
                        const viewAs = document.querySelector('a[href*="viewas"], a[href*="ViewAs"]');
                        if (viewAs && !viewAs.dataset.modified) {
                            viewAs.dataset.modified = "true";
                            window.location.href = viewAs.getAttribute('href') + `&auto_voip=${target}`;
                        }
                    }
                }

                if (host.includes('primobump')) {
                    const pbxBtn = document.querySelector('a[href="/pabxprefs"]');
                    if (pbxBtn && !pbxBtn.dataset.clicked) {
                        pbxBtn.dataset.clicked = "true";
                        pbxBtn.click();
                    }
                    if (path.includes('/pabxprefs')) {
                        const search = document.getElementById('text-search-filter');
                        if (search && !search.dataset.done) {
                            search.dataset.done = "true";
                            forceInput(search);
                        }
                        const firstItem = document.querySelector('table tbody tr td a');
                        if (firstItem && !firstItem.dataset.finalClicked) {
                            if (firstItem.innerText.includes(target) || search.dataset.done) {
                                firstItem.dataset.finalClicked = "true";
                                GM_setValue("voip_finished", "true");
                                GM_deleteValue("active_voip_session");
                                firstItem.click();
                                GM_notification({ title: "VOIP Enquiry", text: "Navigation Complete", timeout: 5000 });
                            }
                        }
                    }
                }
            };

            const interval = setInterval(() => {
                if (GM_getValue("voip_finished") === "true") {
                    clearInterval(interval);
                    return;
                }
                runAutomation();
            }, 600);
        }
    })();

    // ============================================================================
    // 2. ONT ENQUIRY BUTTON
    // ============================================================================
    (function ontEnquiry() {
        function findValidFibreRows() {
            const validPiids = [];
            const rows = document.querySelectorAll('tr.odd, tr.even');
            for (const row of rows) {
                const tds = row.querySelectorAll('td');
                let planText = '';
                let badgeText = '';
                let piidText = '';
                for (const td of tds) {
                    const text = td.textContent.trim().toLowerCase();
                    if (text.includes('fibre') || text.includes('fiber') || text.includes('ufb')) planText = text;
                    const badge = td.querySelector('label.badge.bg-success, label.badge.bg-primary');
                    if (badge) {
                        const badgeVal = badge.textContent.trim().toLowerCase();
                        if (badgeVal === 'online' || badgeVal === 'active') badgeText = badgeVal;
                    }
                    if (text.startsWith('uff')) piidText = td.textContent.trim();
                }
                if (planText && (badgeText === 'online' || badgeText === 'active') && piidText) {
                    validPiids.push(piidText);
                }
            }
            return validPiids;
        }

        function isServicesTabActive() {
            const activeTab = document.querySelector('a.active_tab.tabs__link');
            return activeTab && activeTab.textContent.trim().toLowerCase() === 'services';
        }

        let lastPiidState = '';

        function createOrUpdateONTButton() {
            const header = document.querySelector('.card-block-header .pull-right');
            if (!header) return;

            const wrapperId = 'ont_enquiry_wrapper';
            let wrapper = document.getElementById(wrapperId);

            if (!isServicesTabActive()) {
                if (wrapper) wrapper.remove();
                return;
            }

            const validPiids = findValidFibreRows();
            const currentState = validPiids.join(',');

            if (currentState === lastPiidState && wrapper) return;
            lastPiidState = currentState;

            if (!wrapper) {
                wrapper = document.createElement('div');
                wrapper.id = wrapperId;
                wrapper.className = 'btn-group btn-group-xs';
                wrapper.setAttribute('role', 'group');
                wrapper.style.marginRight = '20px';
                wrapper.style.position = 'relative';
                header.insertBefore(wrapper, header.firstChild);
            } else {
                wrapper.innerHTML = '';
            }

            if (validPiids.length === 0) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'btn btn-secondary';
                button.disabled = true;
                button.style.minWidth = '120px';

                // Create text node first
                const textSpan = document.createElement('span');
                textSpan.textContent = 'ONT Enquiry';
                button.appendChild(textSpan);

                // Add info icon
                const infoMessage = 'ONT Enquiry Requirements:\n\n' +
                    '✓ Services tab must be active\n' +
                    '✓ At least one service with status "Online" or "Active"\n' +
                    '✓ Service plan must contain "Fibre", "Fiber", or "UFB"\n' +
                    '✓ Service must have a PIID starting with "UFF"';
                const icon = createInfoIcon(infoMessage, button);
                button.appendChild(icon);

                wrapper.appendChild(button);
            } else if (validPiids.length === 1) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'btn btn-primary';
                button.textContent = 'ONT Enquiry';
                button.title = `Open ONT Diagnostic for ${validPiids[0]}`;
                button.style.minWidth = '120px';
                button.onclick = () => window.open(`https://assure.ultrafastfibre.co.nz/csm?id=diagnostic_test&ont_piid=${encodeURIComponent(validPiids[0])}`, '_blank');
                wrapper.appendChild(button);
            } else {
                const dropdownButton = document.createElement('button');
                dropdownButton.className = 'btn btn-primary dropdown-toggle';
                dropdownButton.textContent = 'ONT Enquiry';
                wrapper.appendChild(dropdownButton);

                const menu = document.createElement('div');
                Object.assign(menu.style, {
                    position: 'absolute',
                    top: '110%',
                    left: '0',
                    backgroundColor: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: '6px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                    padding: '4px 0',
                    zIndex: '9999',
                    display: 'none'
                });

                validPiids.forEach(piid => {
                    const item = document.createElement('div');
                    item.textContent = piid;
                    item.style.padding = '6px 12px';
                    item.style.cursor = 'pointer';
                    item.onmouseenter = () => item.style.backgroundColor = '#f0f0f0';
                    item.onmouseleave = () => item.style.backgroundColor = '';
                    item.onclick = () => {
                        window.open(`https://assure.ultrafastfibre.co.nz/csm?id=diagnostic_test&ont_piid=${encodeURIComponent(piid)}`, '_blank');
                        menu.style.display = 'none';
                    };
                    menu.appendChild(item);
                });

                dropdownButton.onclick = (e) => {
                    e.stopPropagation();
                    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                };

                document.addEventListener('click', () => (menu.style.display = 'none'));
                wrapper.appendChild(menu);
            }
        }

        function startDynamicWatcher() {
            createOrUpdateONTButton();
            const observer = new MutationObserver(() => setTimeout(createOrUpdateONTButton, 500));
            observer.observe(document.body, { childList: true, subtree: true });

            const tabObserver = new MutationObserver(() => {
                setTimeout(createOrUpdateONTButton, 500);
            });
            const tabContainer = document.querySelector('.tabs');
            if (tabContainer) {
                tabObserver.observe(tabContainer, { attributes: true, childList: true, subtree: true });
            }
        }

        function getQueryParam(name) {
            return new URLSearchParams(window.location.search).get(name);
        }

        function selectFirstSelect2Option() {
            const firstOption = document.querySelector('.select2-results li.select2-result-selectable');
            const select2Input = document.querySelector('.select2-container input.select2-focusser');
            if (!firstOption || !select2Input) return false;
            const mouseUpEvent = new MouseEvent('mouseup', { bubbles: true });
            firstOption.dispatchEvent(mouseUpEvent);
            if (window.jQuery) {
                $(select2Input).trigger('select2:select', {
                    data: { id: firstOption.dataset['id'], text: firstOption.textContent.trim() }
                });
            }
            return true;
        }

        function triggerAngularClick(selector) {
            const el = document.querySelector(selector);
            if (!el) return false;
            if (window.angular) {
                angular.element(el).triggerHandler('click');
            } else {
                el.click();
            }
            return true;
        }

        function autoEnterPIIDAndRunTest() {
            const piid = getQueryParam('ont_piid');
            if (!piid) return;

            function tryInputAndRun() {
                const select2Input = document.querySelector('.select2-container input.select2-focusser');
                if (!select2Input) return;

                select2Input.focus();
                select2Input.click();
                select2Input.value = piid;
                select2Input.dispatchEvent(new Event('input', { bubbles: true }));

                const resultsContainer = document.querySelector('.select2-results');
                if (!resultsContainer) return;

                const select2Observer = new MutationObserver(() => {
                    if (selectFirstSelect2Option()) {
                        select2Observer.disconnect();
                        setTimeout(() => triggerAngularClick('button[ng-click="c.runTest()"]'), 500);
                    }
                });
                select2Observer.observe(resultsContainer, { childList: true, subtree: true });
            }

            window.addEventListener('load', () => setTimeout(tryInputAndRun, 1500));
        }

        if (currentUrl.includes('assure.ultrafastfibre.co.nz/csm?id=diagnostic_test')) {
            autoEnterPIIDAndRunTest();
        } else {
            setTimeout(startDynamicWatcher, 1000);
        }
    })();

    // ============================================================================
    // 3. ONT ENQUIRY NOTIFIER & SUMMARY
    // ============================================================================
    (function ontNotifierSummary() {
        if (!currentUrl.includes('assure.ultrafastfibre.co.nz/csm')) return;

        const CHECK_DELAY_MS = 1200;
        const FAILURE_KEYWORDS = ['api response taking too long', 'polling aborted', 'we are sorry for the inconvenience'];
        const successRedirectPattern = 'id=api_form&table=';
        let alreadyNotified = false;
        let lastUrl = location.href;
        let notifierBtn;

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
            const distance = ont.distance ? ont.distance + ' m' : 'n/a';
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
            const handoverDisplay = handoverName + '@<br>ONT#' + ontPortConfigured;

            const provisioningStatus = serviceObj.provisioningStatus || 'n/a';
            const serviceType = data.product?.service?.type || 'n/a';
            const taggingMode = serviceObj.taggingMode || 'n/a';
            const cevlan = serviceObj.cevlan || 'n/a';

            const provisioningStatusSymbol = provisioningStatus === 'Provisioned' ? '✅' : '❌';
            const serviceTypeSymbol = serviceType === 'Bitstream 2 Ultra' ? '✅' : '❌';
            const taggingModeSymbol = taggingMode.toLowerCase() === 'tagged' ? '✅' : '❌';
            const cevlanSymbol = cevlan === '10' ? '✅' : '❌';

            let handoverSymbol = '❌';
            const allCorrect = provisioningStatus === 'Provisioned' && serviceType === 'Bitstream 2 Ultra' &&
                taggingMode.toLowerCase() === 'tagged' && cevlan === '10';
            const noneCorrect = provisioningStatus !== 'Provisioned' && serviceType !== 'Bitstream 2 Ultra' &&
                taggingMode.toLowerCase() !== 'tagged' && cevlan !== '10';
            if (allCorrect) handoverSymbol = '✅';
            else if (!allCorrect && !noneCorrect) handoverSymbol = '⚠️';
            else handoverSymbol = '❌';

            let powerSymbolSummary = '❌';
            if (rxPower.status === 'ok' && txPower.status === 'ok') powerSymbolSummary = '✅';
            else if (rxPower.status !== 'error' && txPower.status !== 'error') powerSymbolSummary = '⚠️';
            else powerSymbolSummary = '❌';

            let content = '<div style="font-weight:bold; font-size:16px; margin-bottom:8px; color:#001f3f;">ONT Test Summary</div>';

            let issuesContent = detectedFaults.map(f =>
                'Title: ' + f.title + '\nSeverity: ' + f.severity + '\nExplanation: ' + f.explanation + '\nRecommended Action: ' + f.actions
            ).join('\n\n');
            let alarmsContent = alarms.map(a =>
                'Title: ' + a.title + '\nLevel: ' + a.alarmLevel + '\nOccurred: ' + a.occurredDateTime + '\nReset: ' + a.resetDateTime
            ).join('\n\n');

            let issuesHeaderColor = '#ff4136';
            let issuesDisplayContent = '';
            if (issuesContent || alarmsContent) {
                issuesDisplayContent = (issuesContent ? '<pre>' + issuesContent + '</pre>' : '') + (alarmsContent ? '<pre>' + alarmsContent + '</pre>' : '');
            } else {
                issuesHeaderColor = '#2ecc40';
                issuesDisplayContent = '<div>No Detected Issues / Outages</div>';
            }
            content += '<details open><summary style="cursor:pointer; font-weight:bold; color:' + issuesHeaderColor + ';">Detected Issues / Outages</summary>' + issuesDisplayContent + '</details>';

            let ontPortActive = 'n/a';
            const activePort = ports.find(p => p.linkUp);
            if (activePort) ontPortActive = activePort.portName.replace('ETH', '').trim();
            let portMatch = '<span style="color:#ff4136">❌</span>';
            const configuredNumber = parseInt(ontPortConfigured, 10);
            const activeNumber = parseInt(ontPortActive, 10);
            if (!isNaN(configuredNumber) && !isNaN(activeNumber) && configuredNumber === activeNumber) {
                portMatch = '<span style="color:#2ecc40">✅</span>';
            }
            content += '<details><summary style="cursor:pointer; font-weight:bold;">ONT Port Match: ' + portMatch + '</summary><div><b>Configured:</b> ' + ontPortConfigured + '</div><div><b>Active:</b> ' + ontPortActive + '</div></details>';

            const ontModelLink = '<a href="https://www.google.com/search?q=' + encodeURIComponent(ontModel) + '" target="_blank" style="color:#0074D9; font-weight:bold;">' + ontModel + ' →</a>';
            content += '<details><summary style="cursor:pointer; font-weight:bold;">ONT Details</summary><div><b>Status:</b> ' + ontStatus + '</div><div><b>Model:</b> ' + ontModelLink + '</div><div><b>Serial Number:</b> ' + ontSerial + '</div><div><b>Distance to OLT:</b> ' + distanceSymbol(distance) + '</div></details>';

            const connectedDevicesContainerId = 'connectedDevicesContainer';
            content += '<details><summary style="cursor:pointer; font-weight:bold;">Connected Devices</summary><div id="' + connectedDevicesContainerId + '"></div></details>';

            const rxColor = rxPower.status==='ok'?'#2ecc40':rxPower.status==='warn'?'#ff851b':'#ff4136';
            const txColor = txPower.status==='ok'?'#2ecc40':txPower.status==='warn'?'#ff851b':'#ff4136';
            content += '<details><summary style="cursor:pointer; font-weight:bold;">Power ' + powerSymbolSummary + '</summary><div><b>Rx Power:</b> <span style="color:' + rxColor + '">' + rxPower.text + '</span></div><div><b>Tx Power:</b> <span style="color:' + txColor + '">' + txPower.text + '</span></div></details>';

            content += '<details><summary style="cursor:pointer; font-weight:bold;">Handover Details ' + handoverSymbol + '</summary><div>' + handoverDisplay + '</div><div><b>Provisioning Status:</b> ' + provisioningStatus + ' ' + provisioningStatusSymbol + '</div><div><b>Service Type:</b> ' + serviceType + ' ' + serviceTypeSymbol + '</div><div><b>Tagging Mode:</b> ' + taggingMode + ' ' + taggingModeSymbol + '</div><div><b>CEVLAN:</b> ' + cevlan + ' ' + cevlanSymbol + '</div></details>';

            const contentContainer = document.getElementById('tffSummaryContent');
            if (contentContainer) {
                contentContainer.innerHTML = content;
                addDetailsArrows();
            }

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
                            portDiv.innerHTML = '<b>' + port.portName + ':</b>';
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

        const interval = setInterval(() => {
            if (extractFieldValue('Raw JSON Payload') !== 'n/a') {
                clearInterval(interval);
                buildSummary();
            }
        }, 500);

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
            closeBtn.style.cssText = 'position: absolute; top: 8px; right: 12px; font-size: 18px; cursor: pointer; color: #888;';
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
            quickBtn.style.cssText = 'position: fixed; right: 12px; bottom: 60px; padding: 8px 14px; background-color: #0074D9; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; z-index: 9999; display: none;';
            quickBtn.onclick = () => {
                summary.style.display = 'block';
                quickBtn.style.display = 'none';
                if (notifierBtn) notifierBtn.style.display = 'none';
                addDetailsArrows();
            };
            document.body.appendChild(quickBtn);
        })();
    })();

    // ============================================================================
    // 4. PRESEEM BUTTON (Dynamic Column Search)
    // ============================================================================
    (function preseemButton() {
        if (host !== 'splynx.primo.net.nz') return;

        const wrapperId = 'preseem_stable_wrapper';
        let lastKnownLoginsJson = '[]';

        // Returns sorted array of unique, active service logins
        function findActiveServiceLogins() {
            const table = document.querySelector('#admin_customers_services_internet_list');
            if (!table) return [];

            // 1. DYNAMICALLY FIND THE COLUMN INDEX
            // We search the header row for the "Service login" column
            const headers = Array.from(table.querySelectorAll('thead th'));
            const columnIndex = headers.findIndex(th => th.textContent.trim() === 'Service login');

            // If we can't find the column, stop immediately
            if (columnIndex === -1) return [];

            const uniqueLogins = new Set();
            const rows = table.querySelectorAll('tbody tr');

            for (const row of rows) {
                const badge = row.querySelector('label.badge.bg-success, label.badge.bg-primary');
                // Check if row is Active or Online
                if (badge && (badge.textContent.trim().toLowerCase() === 'online' || badge.textContent.trim().toLowerCase() === 'active')) {
                    const tds = row.querySelectorAll('td');
                    // Ensure the row has enough cells to cover the column we found
                    if (tds.length > columnIndex) {
                        const login = tds[columnIndex].textContent.trim();
                        if (login) uniqueLogins.add(login);
                    }
                }
            }
            return Array.from(uniqueLogins).sort();
        }

        function isServicesTabActive() {
            const activeTab = document.querySelector('a.active_tab.tabs__link');
            return activeTab && activeTab.textContent.trim().toLowerCase() === 'services';
        }

        function updatePreseemButton() {
            const header = document.querySelector('.card-block-header .pull-right');
            if (!header) return;

            const wrapper = document.getElementById(wrapperId);

            if (!isServicesTabActive()) {
                if (wrapper) {
                    wrapper.remove();
                    lastKnownLoginsJson = '[]';
                }
                return;
            }

            const currentLogins = findActiveServiceLogins();
            const currentLoginsJson = JSON.stringify(currentLogins);

            if (currentLoginsJson === lastKnownLoginsJson && wrapper) return;

            lastKnownLoginsJson = currentLoginsJson;

            let container = wrapper;
            if (!container) {
                container = document.createElement('div');
                container.id = wrapperId;
                container.className = 'btn-group btn-group-xs';
                container.setAttribute('role', 'group');
                container.style.marginRight = '20px';
                container.style.position = 'relative';
                header.insertBefore(container, header.firstChild);
            } else {
                container.innerHTML = '';
            }

            // CASE 0: No Active Services
            if (currentLogins.length === 0) {
                const button = document.createElement('button');
                button.className = 'btn btn-secondary';
                button.disabled = true;
                button.style.minWidth = '120px';

                // Create content with icon first
                const contentSpan = document.createElement('span');
                contentSpan.innerHTML = '<i class="fa fa-line-chart"></i> Preseem';
                button.appendChild(contentSpan);

                // Add info icon
                const infoMessage = 'Preseem Requirements:\n\n' +
                    '✓ Services tab must be active\n' +
                    '✓ At least one internet service with status "Online" or "Active"\n' +
                    '✓ "Service login" column must be visible in the table';
                const icon = createInfoIcon(infoMessage, button);
                button.appendChild(icon);

                container.appendChild(button);
            }
            // CASE 1: Single Service
            else if (currentLogins.length === 1) {
                const login = currentLogins[0];
                const button = document.createElement('button');
                button.className = 'btn btn-primary';
                button.innerHTML = '<i class="fa fa-line-chart"></i> Preseem';
                button.title = 'Open Preseem for ' + login;
                button.style.minWidth = '120px';
                button.onclick = (e) => {
                    e.preventDefault();
                    window.open('https://app.preseem.com/r/subscriber/' + encodeURIComponent(login), '_blank');
                };
                container.appendChild(button);
            }
            // CASE 2+: Multiple Services (Dropdown)
            else {
                const toggleBtn = document.createElement('button');
                toggleBtn.className = 'btn btn-primary dropdown-toggle';
                toggleBtn.innerHTML = '<i class="fa fa-line-chart"></i> Preseem <span class="caret"></span>';
                toggleBtn.style.minWidth = '120px';
                container.appendChild(toggleBtn);

                // Manual Dropdown Menu
                const menu = document.createElement('div');
                Object.assign(menu.style, {
                    position: 'absolute',
                    top: '110%',
                    left: '0',
                    backgroundColor: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: '6px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                    padding: '4px 0',
                    zIndex: '9999',
                    display: 'none',
                    minWidth: '130px',
                    textAlign: 'left'
                });

                currentLogins.forEach(login => {
                    const item = document.createElement('div');
                    item.textContent = login;
                    item.style.padding = '6px 12px';
                    item.style.cursor = 'pointer';
                    item.style.fontSize = '12px';
                    item.style.color = '#333';
                    item.onmouseenter = () => item.style.backgroundColor = '#f0f0f0';
                    item.onmouseleave = () => item.style.backgroundColor = '';
                    item.onclick = (e) => {
                        e.stopPropagation();
                        window.open('https://app.preseem.com/r/subscriber/' + encodeURIComponent(login), '_blank');
                        menu.style.display = 'none';
                    };
                    menu.appendChild(item);
                });

                toggleBtn.onclick = (e) => {
                    e.stopPropagation();
                    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                };

                document.addEventListener('click', () => { if(menu) menu.style.display = 'none'; });
                container.appendChild(menu);
            }
        }

        function startDynamicWatcher() {
            updatePreseemButton();
            let debounceTimer;
            const observer = new MutationObserver(() => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(updatePreseemButton, 200);
            });
            const mainContent = document.querySelector('.card-block') || document.body;
            observer.observe(mainContent, { childList: true, subtree: true, attributes: false });
        }

        if (document.readyState === 'complete') startDynamicWatcher();
        else window.addEventListener('load', startDynamicWatcher);
    })();

    // ============================================================================
    // 5. XVNE MOBILE ENQUIRY
    // ============================================================================
    (function xvneEnquiry() {
        function findValidMobileRows() {
            const validNumbers = [];
            const table = document.querySelector('#admin_customers_services_voice_list');
            if (!table) return validNumbers;

            // DYNAMIC COLUMN SEARCH - Find "Phone" column index
            const headers = Array.from(table.querySelectorAll('thead th'));
            const phoneColumnIndex = headers.findIndex(th =>
                th.textContent.trim().toLowerCase() === 'phone'
            );

            // If Phone column not found, return empty
            if (phoneColumnIndex === -1) return validNumbers;

            const rows = table.querySelectorAll('tbody tr.odd, tbody tr.even');

            for (const row of rows) {
                const tds = row.querySelectorAll('td');
                if (tds.length <= phoneColumnIndex) continue;

                // Find status badge
                const badge = row.querySelector('label.badge.bg-success, label.badge.bg-primary');
                const statusText = badge ? badge.textContent.trim().toLowerCase() : '';

                // Find plan text (look through all cells for "primomobile")
                let hasPrimoMobile = false;
                for (const td of tds) {
                    const text = td.textContent.trim().toLowerCase();
                    if (text.replace(/\s/g, '').includes('primomobile')) {
                        hasPrimoMobile = true;
                        break;
                    }
                }

                if (statusText === 'active' && hasPrimoMobile) {
                    const phoneCell = tds[phoneColumnIndex].textContent.trim();
                    const num = phoneCell.split(',')[0].trim();
                    if (num && !validNumbers.includes(num)) {
                        validNumbers.push(num);
                    }
                }
            }

            return validNumbers;
        }

        function isServicesTabActive() {
            const activeTab = document.querySelector('a.active_tab.tabs__link');
            return activeTab && activeTab.textContent.trim().toLowerCase() === 'services';
        }

        let lastMobileState = '';

        function createOrUpdateXVNEButton() {
            if (!window.location.hostname.includes('splynx.primo.net.nz')) return;

            const header = document.querySelector('.card-block-header .pull-right');
            if (!header) return;

            const wrapperId = 'xvne_enquiry_wrapper';
            let wrapper = document.getElementById(wrapperId);

            if (!isServicesTabActive()) {
                if (wrapper) wrapper.remove();
                return;
            }

            const validNumbers = findValidMobileRows();
            const currentState = validNumbers.join(',');

            if (currentState === lastMobileState && wrapper) return;
            lastMobileState = currentState;

            if (!wrapper) {
                wrapper = document.createElement('div');
                wrapper.id = wrapperId;
                wrapper.className = 'btn-group btn-group-xs';
                wrapper.style.marginRight = '20px';
                wrapper.style.position = 'relative';
                header.insertBefore(wrapper, header.firstChild);
            } else {
                wrapper.innerHTML = '';
            }

            const startSession = (phone) => {
                GM_deleteValue("mobile_finished");
                GM_setValue("active_mobile_session", phone);
                window.open('https://xvne.partners.one.nz/?auto_mobile=' + phone, '_blank');
            };

            if (validNumbers.length === 0) {
                const button = document.createElement('button');
                button.className = 'btn btn-secondary';
                button.disabled = true;
                button.style.minWidth = '120px';

                // Create text node first
                const textSpan = document.createElement('span');
                textSpan.textContent = 'XVNE Enquiry';
                button.appendChild(textSpan);

                // Add info icon
                const infoMessage = 'XVNE Enquiry Requirements:\n\n' +
                    '✓ Services tab must be active\n' +
                    '✓ At least one service with status "Active"\n' +
                    '✓ Service plan must contain "PrimoMobile"\n' +
                    '✓ "Phone" column must be visible in the table\n' +
                    '✓ Phone number must be present in the Phone column';
                const icon = createInfoIcon(infoMessage, button);
                button.appendChild(icon);

                wrapper.appendChild(button);
            } else if (validNumbers.length === 1) {
                const button = document.createElement('button');
                button.className = 'btn btn-primary';
                button.textContent = 'XVNE Enquiry';
                button.onclick = () => startSession(validNumbers[0]);
                wrapper.appendChild(button);
            } else {
                const dropdownButton = document.createElement('button');
                dropdownButton.className = 'btn btn-primary dropdown-toggle';
                dropdownButton.textContent = 'XVNE Enquiry';
                wrapper.appendChild(dropdownButton);

                const menu = document.createElement('div');
                Object.assign(menu.style, {
                    position: 'absolute', top: '110%', left: '0', backgroundColor: '#fff',
                    border: '1px solid #ccc', borderRadius: '6px', boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                    padding: '4px 0', zIndex: '9999', display: 'none', minWidth: '130px'
                });

                validNumbers.forEach(num => {
                    const item = document.createElement('div');
                    item.textContent = num;
                    item.style.padding = '6px 12px'; item.style.cursor = 'pointer';
                    item.style.fontSize = '12px'; item.style.color = '#333';
                    item.onmouseenter = () => item.style.backgroundColor = '#f0f0f0';
                    item.onmouseleave = () => item.style.backgroundColor = '';
                    item.onclick = (e) => {
                        e.stopPropagation();
                        startSession(num);
                        menu.style.display = 'none';
                    };
                    menu.appendChild(item);
                });

                dropdownButton.onclick = (e) => {
                    e.stopPropagation();
                    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                };

                document.addEventListener('click', () => { if(menu) menu.style.display = 'none'; });
                wrapper.appendChild(menu);
            }
        }

        function runXVNEAutomation() {
            const target = new URLSearchParams(window.location.search).get('auto_mobile') || GM_getValue("active_mobile_session");
            if (!target || GM_getValue("mobile_finished") === "true") return;

            const interval = setInterval(() => {
                if (GM_getValue("mobile_finished") === "true") {
                    clearInterval(interval);
                    return;
                }

                const searchInput = document.querySelector('input[placeholder="Search"]');
                if (searchInput && !searchInput.dataset.done) {
                    searchInput.focus();
                    searchInput.value = target;
                    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                    searchInput.dataset.done = "true";
                    return;
                }

                const options = Array.from(document.querySelectorAll('div.option'));
                const targetOption = options.find(opt => opt.textContent.includes(target));

                if (targetOption && !targetOption.dataset.clicked) {
                    targetOption.dataset.clicked = "true";
                    const clickTarget = targetOption.querySelector('span') || targetOption;
                    clickTarget.click();
                    return;
                }

                const btns = Array.from(document.querySelectorAll('button.btn-tab'));
                const productTab = btns.find(b => b.innerText.trim() === 'Products');
                if (productTab && !productTab.classList.contains('active')) {
                    productTab.click();
                    return;
                }

                const mobileTab = document.querySelector('button.btn-tab.stpm-mobile');
                if (mobileTab && !mobileTab.classList.contains('active')) {
                    mobileTab.click();

                    GM_setValue("mobile_finished", "true");
                    GM_deleteValue("active_mobile_session");
                    GM_notification({ title: "XVNE Enquiry", text: "Navigation Complete", timeout: 5000 });
                    clearInterval(interval);
                }
            }, 800);
        }

        if (window.location.hostname.includes('splynx.primo.net.nz')) {
            createOrUpdateXVNEButton();
            const observer = new MutationObserver(() => setTimeout(createOrUpdateXVNEButton, 500));
            observer.observe(document.body, { childList: true, subtree: true });
        } else if (window.location.hostname.includes('xvne.partners.one.nz')) {
            runXVNEAutomation();
        }
    })();

    // ============================================================================
    // 6. GOOGLE MAPS (SIDEBAR & SERVICES)
    // ============================================================================
    (function googleMapsButtons() {
        if (host !== 'splynx.primo.net.nz') return;

        // FIXED URL FORMAT: Uses the standard Google Maps query URL
        const getMapUrl = (address) => 'https://www.google.com/maps?q=' + encodeURIComponent(address);

        // --- PART A: SIDEBAR BUTTON (Customer Profile) ---
        (function sidebarMapsButton() {
            const BUTTON_GROUP_ID = 'splynx-sidebar-maps-btn-group';

            function getProfileAddress() {
                // Target the specific input from your HTML snippet
                const streetInput = document.querySelector('input[name="Customers[street_1]"]');

                if (!streetInput) return null;

                // Try to get value, fallback to 'original-value' attribute if value is empty/hidden
                let fullAddress = streetInput.value.trim() || streetInput.getAttribute('original-value');

                // Optional: Try to append City/Zip for better accuracy
                try {
                    const cityInput = document.querySelector('input[name="Customers[city]"]');
                    const zipInput = document.querySelector('input[name="Customers[zip_code]"]');

                    if (cityInput && cityInput.value.trim()) {
                        fullAddress += `, ${cityInput.value.trim()}`;
                    }
                    if (zipInput && zipInput.value.trim()) {
                        fullAddress += `, ${zipInput.value.trim()}`;
                    }
                } catch (e) {
                    // If city/zip fails, ignore and use street
                }

                return fullAddress;
            }

            function addButton() {
                const buttonWrapper = document.querySelector('.customer-buttons-wrapper');
                // Check if wrapper exists and button doesn't already exist
                if (!buttonWrapper || document.getElementById(BUTTON_GROUP_ID)) return;

                // Create Group
                const btnGroup = document.createElement('div');
                btnGroup.className = 'btn-group';
                btnGroup.id = BUTTON_GROUP_ID;
                btnGroup.style.marginRight = '4px';

                // Create Button
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn btn-primary';
                btn.innerHTML = '<i class="fa fa-map-marker"></i> Maps';
                btn.title = 'Open Profile Address in Google Maps';
                btn.style.minWidth = '80px';

                btn.onclick = (e) => {
                    e.preventDefault();
                    const address = getProfileAddress();
                    if (address && address !== 'null') {
                        window.open(getMapUrl(address), '_blank');
                    } else {
                        alert('Could not find an address in the "Street" field.');
                    }
                };

                btnGroup.appendChild(btn);

                // Insert at START (Left side) of the wrapper
                if (buttonWrapper.firstChild) {
                    buttonWrapper.insertBefore(btnGroup, buttonWrapper.firstChild);
                } else {
                    buttonWrapper.appendChild(btnGroup);
                }
            }

            const observer = new MutationObserver(() => {
                // Ensure the input field actually exists before adding button
                if (document.querySelector('input[name="Customers[street_1]"]')) {
                    addButton();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        })();

        // --- PART B: SERVICES TAB BUTTON (Subscription Address) ---
        (function servicesMapsButton() {
            const wrapperId = 'splynx_services_maps_wrapper';
            let lastKnownAddressesJson = '[]';

            function findUniqueAddresses() {
                const table = document.querySelector('#admin_customers_services_internet_list');
                if (!table) return [];

                // Find "Subscription Address" column index
                const headers = Array.from(table.querySelectorAll('thead th'));
                const colIndex = headers.findIndex(th => th.textContent.trim() === 'Subscription Address');

                if (colIndex === -1) return [];

                const uniqueAddresses = new Set();
                const rows = table.querySelectorAll('tbody tr');

                for (const row of rows) {
                    const badge = row.querySelector('label.badge.bg-success, label.badge.bg-primary');
                    // Check for Active/Online status
                    if (badge && (badge.textContent.trim().toLowerCase() === 'online' || badge.textContent.trim().toLowerCase() === 'active')) {
                        const tds = row.querySelectorAll('td');
                        if (tds.length > colIndex) {
                            const addr = tds[colIndex].textContent.trim();
                            // Filter out empty or placeholder dashes
                            if (addr && addr !== '-' && addr !== '') {
                                uniqueAddresses.add(addr);
                            }
                        }
                    }
                }
                return Array.from(uniqueAddresses).sort();
            }

            function isServicesTabActive() {
                const activeTab = document.querySelector('a.active_tab.tabs__link');
                return activeTab && activeTab.textContent.trim().toLowerCase() === 'services';
            }

            function updateButton() {
                const header = document.querySelector('.card-block-header .pull-right');
                if (!header) return;

                const wrapper = document.getElementById(wrapperId);

                if (!isServicesTabActive()) {
                    if (wrapper) {
                        wrapper.remove();
                        lastKnownAddressesJson = '[]';
                    }
                    return;
                }

                const currentAddresses = findUniqueAddresses();
                const currentJson = JSON.stringify(currentAddresses);

                if (currentJson === lastKnownAddressesJson && wrapper) return;
                lastKnownAddressesJson = currentJson;

                // Setup Wrapper
                let container = wrapper;
                if (!container) {
                    container = document.createElement('div');
                    container.id = wrapperId;
                    container.className = 'btn-group btn-group-xs';
                    container.setAttribute('role', 'group');
                    container.style.marginRight = '20px';
                    container.style.position = 'relative';
                    // Insert at the START of the header buttons (Left side)
                    header.insertBefore(container, header.firstChild);
                } else {
                    container.innerHTML = '';
                }

                // --- Logic ---
                if (currentAddresses.length === 0) {
                    const btn = document.createElement('button');
                    btn.className = 'btn btn-secondary';
                    btn.disabled = true;
                    btn.style.minWidth = '80px';

                    // Create content with icon first
                    const contentSpan = document.createElement('span');
                    contentSpan.innerHTML = '<i class="fa fa-map-marker"></i> Maps';
                    btn.appendChild(contentSpan);

                    // Add info icon
                    const infoMessage = 'Maps Requirements:\n\n' +
                        '✓ Services tab must be active\n' +
                        '✓ At least one service with status "Online" or "Active"\n' +
                        '✓ "Subscription Address" column must be visible in the table\n' +
                        '✓ Valid address must be present (not "-" or empty)';
                    const icon = createInfoIcon(infoMessage, btn);
                    btn.appendChild(icon);

                    container.appendChild(btn);
                }
                else if (currentAddresses.length === 1) {
                    const btn = document.createElement('button');
                    btn.className = 'btn btn-primary';
                    btn.innerHTML = '<i class="fa fa-map-marker"></i> Maps';
                    btn.style.minWidth = '80px';
                    btn.onclick = (e) => {
                        e.preventDefault();
                        window.open(getMapUrl(currentAddresses[0]), '_blank');
                    };
                    container.appendChild(btn);
                }
                else {
                    // Dropdown
                    const toggleBtn = document.createElement('button');
                    toggleBtn.className = 'btn btn-primary dropdown-toggle';
                    toggleBtn.innerHTML = '<i class="fa fa-map-marker"></i> Maps <span class="caret"></span>';
                    toggleBtn.style.minWidth = '80px';
                    container.appendChild(toggleBtn);

                    const menu = document.createElement('div');
                    Object.assign(menu.style, {
                        position: 'absolute', top: '110%', left: '0',
                        backgroundColor: '#fff', border: '1px solid #ccc',
                        borderRadius: '6px', boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                        padding: '4px 0', zIndex: '9999', display: 'none',
                        minWidth: '200px', textAlign: 'left'
                    });

                    currentAddresses.forEach(addr => {
                        const item = document.createElement('div');
                        item.textContent = addr;
                        item.style.padding = '8px 12px';
                        item.style.cursor = 'pointer';
                        item.style.fontSize = '12px';
                        item.style.color = '#333';
                        item.style.borderBottom = '1px solid #eee';

                        item.onmouseenter = () => item.style.backgroundColor = '#f0f0f0';
                        item.onmouseleave = () => item.style.backgroundColor = '';
                        item.onclick = (e) => {
                            e.stopPropagation();
                            window.open(getMapUrl(addr), '_blank');
                            menu.style.display = 'none';
                        };
                        menu.appendChild(item);
                    });

                    toggleBtn.onclick = (e) => {
                        e.stopPropagation();
                        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                    };

                    document.addEventListener('click', () => { if(menu) menu.style.display = 'none'; });
                    container.appendChild(menu);
                }
            }

            const observer = new MutationObserver(() => {
                 setTimeout(updateButton, 200);
            });
            const mainContent = document.querySelector('.card-block') || document.body;
            observer.observe(mainContent, { childList: true, subtree: true });

            if(document.readyState === 'complete') updateButton();
        })();
    })();

})();
