// ==UserScript==
// @name         VOIP Enquiry Button
// @namespace    http://tampermonkey.net/
// @version      6.1
// @description  2Talk VOIP navigation using number from active VOIP sub.
// @match        https://splynx.primo.net.nz/admin/customers/view?id=*
// @match        https://primocap.2talk.co.nz/*
// @match        https://primobump.2talk.co.nz/*
// @grant        GM_notification
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @updateURL    https://raw.githubusercontent.com/saradprimo/splynx-tampermonkey-scripts/main/2Talk-VOIP-enquiry-button.user.js
// @downloadURL  https://raw.githubusercontent.com/saradprimo/splynx-tampermonkey-scripts/main/2Talk-VOIP-enquiry-button.user.js
// ==/UserScript==

(function() {
    'use strict';

    const host = window.location.host;
    const urlParams = new URLSearchParams(window.location.search);
    const urlTarget = urlParams.get('auto_voip');

    // --- 1. SESSION LOGIC ---
    if (urlTarget) {
        GM_setValue("active_voip_session", urlTarget);
        GM_deleteValue("voip_finished");
    }

    const currentSessionTarget = GM_getValue("active_voip_session");
    const isFinished = GM_getValue("voip_finished");

    if (host !== 'splynx.primo.net.nz') {
        if (!currentSessionTarget || isFinished === "true") return;
    }

    // --- 2. SPLYNX DOMAIN (EXACT ONT UI REPLICATION) ---
    if (host === 'splynx.primo.net.nz') {
        let lastNumberState = '';

        function findValidVoipRows() {
            const validNumbers = [];
            const rows = document.querySelectorAll('tr.odd, tr.even');
            // Flexible plan matching as requested
            for (const row of rows) {
                const tds = row.querySelectorAll('td');
                if (tds.length < 9) continue;
                const statusText = tds[1].textContent.trim().toLowerCase();
                const planText = tds[3].textContent.trim().toLowerCase();

                if (statusText === 'active' && planText.replace(/\s/g, '').includes('primovoice')) {
                    const num = tds[8].textContent.trim().split(',')[0].trim();
                    if (num && !validNumbers.includes(num)) validNumbers.push(num);
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
                button.textContent = 'VOIP Enquiry';
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
                // MULTIPLE NUMBERS - DROPDOWN STYLE MATCHING ONT
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

        // Mutation Observer to keep button stable as Splynx loads
        const observer = new MutationObserver(() => createOrUpdateVOIPButton());
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(createOrUpdateVOIPButton, 1000);
    }

    // --- 3. 2TALK AUTOMATION ---
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
