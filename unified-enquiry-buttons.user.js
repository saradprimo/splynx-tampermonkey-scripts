// ==UserScript==
// @name         Unified Service Enquiry Script
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Unified Enquiry buttons for Mobile, VOIP, and ONT with portal automation.
// @match        *://*/*
// @grant        GM_notification
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_openInTab
// @updateURL    https://raw.githubusercontent.com/saradprimo/splynx-tampermonkey-scripts/main/unified-enquiry-buttons.user.js
// @downloadURL  https://raw.githubusercontent.com/saradprimo/splynx-tampermonkey-scripts/main/unified-enquiry-buttons.user.js
// ==/UserScript==

(function() {
    'use strict';

    const host = window.location.hostname;
    const currentUrl = window.location.href;

    // --- SHARED UTILITIES ---
    function isServicesTabActive() {
        const activeTab = document.querySelector('a.active_tab.tabs__link');
        return activeTab && activeTab.textContent.trim().toLowerCase() === 'services';
    }

    function getHeader() {
        return document.querySelector('.card-block-header .pull-right');
    }

    // --- MOBILE LOGIC ---
    function findMobileRows() {
        const validNumbers = [];
        const rows = document.querySelectorAll('tr.odd, tr.even');
        rows.forEach(row => {
            const tds = row.querySelectorAll('td');
            if (tds.length >= 9) {
                const status = tds[1].textContent.trim().toLowerCase();
                const plan = tds[3].textContent.trim().toLowerCase();
                if (status === 'active' && plan.replace(/\s/g, '').includes('primomobile')) {
                    const num = tds[8].textContent.trim().split(',')[0].trim();
                    if (num && !validNumbers.includes(num)) validNumbers.push(num);
                }
            }
        });
        return validNumbers;
    }

    // --- VOIP LOGIC ---
    function findVoipRows() {
        const validNumbers = [];
        const rows = document.querySelectorAll('tr.odd, tr.even');
        rows.forEach(row => {
            const tds = row.querySelectorAll('td');
            if (tds.length >= 9) {
                const status = tds[1].textContent.trim().toLowerCase();
                const plan = tds[3].textContent.trim().toLowerCase();
                if (status === 'active' && plan.replace(/\s/g, '').includes('primovoice')) {
                    const num = tds[8].textContent.trim().split(',')[0].trim();
                    if (num && !validNumbers.includes(num)) validNumbers.push(num);
                }
            }
        });
        return validNumbers;
    }

    // --- ONT LOGIC ---
    function findFibreRows() {
        const validPiids = [];
        const rows = document.querySelectorAll('tr.odd, tr.even');
        rows.forEach(row => {
            const tds = row.querySelectorAll('td');
            let planText = '', badgeText = '', piidText = '';
            tds.forEach(td => {
                const text = td.textContent.trim().toLowerCase();
                if (text.includes('fibre') || text.includes('fiber') || text.includes('ufb')) planText = text;
                const badge = td.querySelector('label.badge.bg-success, label.badge.bg-primary');
                if (badge) {
                    const val = badge.textContent.trim().toLowerCase();
                    if (val === 'online' || val === 'active') badgeText = val;
                }
                if (text.startsWith('uff')) piidText = td.textContent.trim();
            });
            if (planText && badgeText && piidText) validPiids.push(piidText);
        });
        return validPiids;
    }

    // --- UI BUILDER ---
    function createDropdown(label, items, onSelect) {
        const wrapper = document.createElement('div');
        wrapper.className = 'btn-group btn-group-xs';
        wrapper.style.marginRight = '10px';
        wrapper.style.position = 'relative';

        if (items.length === 0) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-secondary';
            btn.disabled = true;
            btn.textContent = label;
            wrapper.appendChild(btn);
        } else if (items.length === 1) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.textContent = label;
            btn.onclick = () => onSelect(items[0]);
            wrapper.appendChild(btn);
        } else {
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary dropdown-toggle';
            btn.textContent = label;

            const menu = document.createElement('div');
            Object.assign(menu.style, {
                position: 'absolute', top: '110%', left: '0', backgroundColor: '#fff',
                border: '1px solid #ccc', borderRadius: '4px', boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                padding: '4px 0', zIndex: '9999', display: 'none', minWidth: '120px'
            });

            items.forEach(val => {
                const item = document.createElement('div');
                item.textContent = val;
                item.style.padding = '6px 12px'; item.style.cursor = 'pointer';
                item.style.fontSize = '12px';
                item.onmouseenter = () => item.style.backgroundColor = '#f0f0f0';
                item.onmouseleave = () => item.style.backgroundColor = '';
                item.onclick = (e) => {
                    e.stopPropagation();
                    onSelect(val);
                    menu.style.display = 'none';
                };
                menu.appendChild(item);
            });

            btn.onclick = (e) => {
                e.stopPropagation();
                menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
            };
            document.addEventListener('click', () => menu.style.display = 'none');
            wrapper.appendChild(btn);
            wrapper.appendChild(menu);
        }
        return wrapper;
    }

    // --- MAIN INJECTION ---
    let lastState = "";
    function updateSplynxUI() {
        if (!host.includes('splynx.primo.net.nz')) return;

        const header = getHeader();
        if (!header) return;

        let container = document.getElementById('unified-enquiry-container');
        if (!isServicesTabActive()) {
            if (container) container.remove();
            return;
        }

        const mobiles = findMobileRows();
        const voips = findVoipRows();
        const fibres = findFibreRows();
        const currentState = [mobiles, voips, fibres].join('|');

        if (currentState === lastState && container) return;
        lastState = currentState;

        if (!container) {
            container = document.createElement('div');
            container.id = 'unified-enquiry-container';
            container.style.display = 'inline-flex';
            header.insertBefore(container, header.firstChild);
        } else {
            container.innerHTML = '';
        }

        // Add Mobile
        container.appendChild(createDropdown('Mobile Enquiry', mobiles, (num) => {
            GM_deleteValue("mobile_finished");
            GM_setValue("active_mobile_session", num);
            window.open(`https://xvne.partners.one.nz/?auto_mobile=${num}`, '_blank');
        }));

        // Add VOIP
        container.appendChild(createDropdown('VOIP Enquiry', voips, (num) => {
            GM_deleteValue("voip_finished");
            GM_setValue("active_voip_session", num);
            GM_openInTab(`https://primocap.2talk.co.nz/account?auto_voip=${num}`, { active: true });
        }));

        // Add ONT
        container.appendChild(createDropdown('ONT Enquiry', fibres, (piid) => {
            window.open(`https://assure.ultrafastfibre.co.nz/csm?id=diagnostic_test&ont_piid=${encodeURIComponent(piid)}`, '_blank');
        }));
    }

    // --- PORTAL AUTOMATIONS ---

    // 1. XVNE Mobile Automation
    function runXVNEAutomation() {
        const target = new URLSearchParams(window.location.search).get('auto_mobile') || GM_getValue("active_mobile_session");
        if (!target || GM_getValue("mobile_finished") === "true") return;

        const interval = setInterval(() => {
            const searchInput = document.querySelector('input[placeholder="Search"]');
            if (searchInput && !searchInput.dataset.done) {
                searchInput.focus();
                searchInput.value = target;
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                searchInput.dataset.done = "true";
            }

            const options = Array.from(document.querySelectorAll('div.option'));
            const targetOption = options.find(opt => opt.textContent.includes(target));
            if (targetOption && !targetOption.dataset.clicked) {
                targetOption.dataset.clicked = "true";
                (targetOption.querySelector('span') || targetOption).click();
            }

            const btns = Array.from(document.querySelectorAll('button.btn-tab'));
            const productTab = btns.find(b => b.innerText.trim() === 'Products');
            if (productTab && !productTab.classList.contains('active')) { productTab.click(); }

            const mobileTab = document.querySelector('button.btn-tab.stpm-mobile');
            if (mobileTab && !mobileTab.classList.contains('active')) {
                mobileTab.click();
                GM_setValue("mobile_finished", "true");
                GM_deleteValue("active_mobile_session");
                GM_notification({ title: "Mobile Enquiry", text: "Navigation Complete", timeout: 5000 });
                clearInterval(interval);
            }
        }, 800);
    }

    // 2. 2Talk VOIP Automation
    function runVoipAutomation() {
        const urlTarget = new URLSearchParams(window.location.search).get('auto_voip');
        if (urlTarget) {
            GM_setValue("active_voip_session", urlTarget);
            GM_deleteValue("voip_finished");
        }

        const sessionTarget = GM_getValue("active_voip_session");
        if (!sessionTarget || GM_getValue("voip_finished") === "true") return;

        const interval = setInterval(() => {
            if (GM_getValue("voip_finished") === "true") return clearInterval(interval);

            const path = window.location.pathname;
            const forceInput = (input) => {
                input.focus(); input.value = sessionTarget;
                ['input', 'change'].forEach(ev => input.dispatchEvent(new Event(ev, { bubbles: true })));
                const ent = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true };
                input.dispatchEvent(new KeyboardEvent('keydown', ent));
                input.dispatchEvent(new KeyboardEvent('keyup', ent));
            };

            if (host.includes('primocap')) {
                if (path.includes('/account')) {
                    document.querySelector('a[href="/customer"]')?.click();
                } else if (path === '/customer') {
                    const filter = document.getElementById('customer-filter');
                    if (filter && !filter.dataset.done) { filter.dataset.done = "true"; forceInput(filter); }
                    const row = document.querySelector('tr[data-account-code]');
                    if (row) window.location.href = `/customer/status?AccountCode=${row.getAttribute('data-account-code')}&auto_voip=${sessionTarget}`;
                } else if (path.includes('/customer/')) {
                    const viewAs = document.querySelector('a[href*="viewas"], a[href*="ViewAs"]');
                    if (viewAs && !viewAs.dataset.modified) {
                        viewAs.dataset.modified = "true";
                        window.location.href = viewAs.getAttribute('href') + `&auto_voip=${sessionTarget}`;
                    }
                }
            }

            if (host.includes('primobump')) {
                const pbxBtn = document.querySelector('a[href="/pabxprefs"]');
                if (pbxBtn && !pbxBtn.dataset.clicked) { pbxBtn.dataset.clicked = "true"; pbxBtn.click(); }
                if (path.includes('/pabxprefs')) {
                    const search = document.getElementById('text-search-filter');
                    if (search && !search.dataset.done) { search.dataset.done = "true"; forceInput(search); }
                    const firstLink = document.querySelector('table tbody tr td a');
                    if (firstLink && !firstLink.dataset.finalClicked && (firstLink.innerText.includes(sessionTarget) || search?.dataset.done)) {
                        firstLink.dataset.finalClicked = "true";
                        GM_setValue("voip_finished", "true");
                        GM_deleteValue("active_voip_session");
                        firstLink.click();
                        GM_notification({ title: "VOIP Enquiry", text: "Navigation Complete", timeout: 5000 });
                    }
                }
            }
        }, 600);
    }

    // 3. UFF ONT Automation
    function runOntAutomation() {
        const piid = new URLSearchParams(window.location.search).get('ont_piid');
        if (!piid) return;

        setTimeout(() => {
            const select2Input = document.querySelector('.select2-container input.select2-focusser');
            if (!select2Input) return;

            select2Input.focus(); select2Input.click();
            select2Input.value = piid;
            select2Input.dispatchEvent(new Event('input', { bubbles: true }));

            const resultsContainer = document.querySelector('.select2-results');
            if (resultsContainer) {
                const obs = new MutationObserver(() => {
                    const firstOption = document.querySelector('.select2-results li.select2-result-selectable');
                    if (firstOption) {
                        obs.disconnect();
                        firstOption.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                        setTimeout(() => {
                            const runBtn = document.querySelector('button[ng-click="c.runTest()"]');
                            if (window.angular && runBtn) angular.element(runBtn).triggerHandler('click');
                            else runBtn?.click();
                        }, 500);
                    }
                });
                obs.observe(resultsContainer, { childList: true, subtree: true });
            }
        }, 1500);
    }

    // --- INITIALIZATION ROUTER ---
    if (host.includes('splynx.primo.net.nz')) {
        updateSplynxUI();
        const obs = new MutationObserver(() => setTimeout(updateSplynxUI, 500));
        obs.observe(document.body, { childList: true, subtree: true });
    } else if (host.includes('xvne.partners.one.nz')) {
        runXVNEAutomation();
    } else if (host.includes('2talk.co.nz')) {
        runVoipAutomation();
    } else if (currentUrl.includes('assure.ultrafastfibre.co.nz/csm?id=diagnostic_test')) {
        runOntAutomation();
    }

})();
