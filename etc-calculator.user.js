// ==UserScript==
// @name         Splynx ETC Calculator
// @namespace    https://github.com/saradprimo/splynx-tampermonkey-scripts
// @version      2.7
// @description  ETC Calculator with categories, filtered plans, Fibre Starter always $0 ETC
// @match        *://*/*
// @updateURL    https://raw.githubusercontent.com/saradprimo/splynx-tampermonkey-scripts/main/etc-calculator.user.js
// @downloadURL  https://raw.githubusercontent.com/saradprimo/splynx-tampermonkey-scripts/main/etc-calculator.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function waitForHeader() {
        const header = document.querySelector('.splynx-header');
        const nav = header ? header.querySelector('.navigation') : null;
        if (!header || !nav) {
            setTimeout(waitForHeader, 500);
            return;
        }
        addETCButton(header, nav);
    }

    function addETCButton(header, nav) {
        const btn = document.createElement('button');
        btn.textContent = 'ETC Calculator';
        btn.style.cssText = `background-color: #007bff; color: white; border: none; border-radius: 4px; padding: 4px 10px; margin-right: 8px; cursor: pointer; font-weight: bold; font-size: 12px; white-space: nowrap;`;
        header.insertBefore(btn, nav);

        const overlay = document.createElement('div');
        overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); z-index: 99998; display: none; opacity: 0; transition: opacity 0.3s;`;

        const container = document.createElement('div');
        container.style.cssText = `position: fixed; top: 0; right: -400px; width: 380px; height: 100%; background: #ffffff; box-shadow: -5px 0 15px rgba(0,0,0,0.1); z-index: 99999; transition: right 0.3s ease-in-out; font-family: sans-serif; display: flex; flex-direction: column; box-sizing: border-box;`;

        container.innerHTML = `
            <div id="etc-side-panel" style="height: 100%; display: flex; flex-direction: column;">
                <div style="padding: 20px; background: #f8f9fa; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="margin: 0; font-size: 18px; color: #333;">ETC Calculator</h2>
                    <span id="etc-close" style="cursor:pointer; font-size: 24px; color:#aaa;">&times;</span>
                </div>
                <div style="padding: 20px; overflow-y: auto; flex-grow: 1;">
                    <div style="margin-bottom: 15px;">
                        <label style="display:block; margin-bottom: 5px; font-weight: 600;">End of Contract (DD/MM/YYYY)</label>
                        <input type="text" id="etc-date-display" placeholder="DD/MM/YYYY" style="width:100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display:block; margin-bottom: 5px; font-weight: 600;">Plan Price ($)</label>
                        <input type="number" id="etc-manual-price" style="width:100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display:block; margin-bottom: 5px; font-weight: 600;">Detected Plan</label>
                        <input type="text" id="etc-plan-name" style="width:100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; background:#f9f9f9;" readonly>
                    </div>
                    <button id="etc-calc-btn" style="width:100%; padding: 10px; background-color:#28a745; color:white; border:none; border-radius: 4px; cursor:pointer; font-weight: 600;">Re-Calculate</button>
                    <div id="etc-output" style="margin-top: 20px; padding: 15px; border-radius: 4px; background: #f1f3f5; min-height: 60px; border: 1px solid #ddd;">
                        <span style="color: #888;">Awaiting scan...</span>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(container);

        function parseNZDate(dateStr) {
            if (!dateStr) return null;
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                return new Date(parts[2], parts[1] - 1, parts[0]);
            }
            const isoParts = dateStr.split('-');
            if (isoParts.length === 3) {
                return new Date(isoParts[0], isoParts[1] - 1, isoParts[2]);
            }
            return null;
        }

        function clearInputs() {
            container.querySelector('#etc-date-display').value = "";
            container.querySelector('#etc-manual-price').value = "";
            container.querySelector('#etc-plan-name').value = "";
            container.querySelector('#etc-output').innerHTML = '<span style="color: #888;">Scanning...</span>';
        }

        function scanSplynxTable() {
            const data = { plan: null, status: null, price: null, endDateStr: null, errors: [] };
            const headers = Array.from(document.querySelectorAll('th'));

            const findIdx = (regex) => headers.findIndex(th =>
                regex.test(th.getAttribute('aria-label') || "") ||
                regex.test(th.innerText || "")
            );

            const planIdx = findIdx(/Plan/i);
            const statusIdx = findIdx(/Status/i);
            const priceIdx = findIdx(/Price/i);
            const endIdx = findIdx(/End of contract/i);

            if (planIdx === -1) data.errors.push("Plan column");
            if (statusIdx === -1) data.errors.push("Status column");
            if (priceIdx === -1) data.errors.push("Price column");
            if (endIdx === -1) data.errors.push("End of contract column");

            if (data.errors.length === 0) {
                const rows = Array.from(document.querySelectorAll('table[id*="internet_list"] tbody tr'));
                const activeRow = rows.find(row => {
                    const statusText = row.cells[statusIdx]?.innerText.trim().toLowerCase();
                    return statusText === 'active' || statusText === 'online';
                });

                if (activeRow) {
                    const cells = activeRow.cells;
                    data.plan = cells[planIdx]?.innerText.trim();
                    data.status = cells[statusIdx]?.innerText.trim().toLowerCase();
                    const rawPrice = cells[priceIdx]?.innerText || "0";
                    data.price = parseFloat(rawPrice.replace(/[^0-9.]/g, ''));
                    data.endDateStr = cells[endIdx]?.innerText.trim();
                } else {
                    data.errors.push("No Active/Online service found on this page.");
                }
            }
            return data;
        }

        const runCalculation = () => {
            const output = container.querySelector('#etc-output');
            const dateInput = container.querySelector('#etc-date-display');
            const priceInput = container.querySelector('#etc-manual-price');
            const planInput = container.querySelector('#etc-plan-name');

            const scraped = scanSplynxTable();

            if (scraped.errors.length > 0) {
                output.innerHTML = `<span style="color: #dc3545; font-size:12px;"><strong>Scan Failed:</strong><br>${scraped.errors.join('<br>')}</span>`;
                return;
            }

            // Populate fields with fresh data
            planInput.value = scraped.plan || "";
            priceInput.value = scraped.price || 0;
            dateInput.value = scraped.endDateStr || "";

            const endDate = parseNZDate(dateInput.value);
            const today = new Date();

            if (!endDate || isNaN(endDate.getTime())) {
                output.innerHTML = `<span style="color: #d9480f;"><strong>Missing End Date:</strong><br>Found active plan but no date. Enter manually (DD/MM/YYYY) above.</span>`;
                return;
            }

            if (endDate <= today) {
                output.innerHTML = `<div style="font-size: 20px; color: #28a745;">ETC: <strong>$0.00</strong></div><small>Contract has expired.</small>`;
                return;
            }

            // Calculation Logic
            let monthsLeft = (endDate.getFullYear() - today.getFullYear()) * 12 + (endDate.getMonth() - today.getMonth());
            if (endDate.getDate() > today.getDate()) monthsLeft++;
            monthsLeft = Math.max(0, monthsLeft);

            let etc = 0;
            const planLower = (scraped.plan || "").toLowerCase();

            if (planLower.includes('starter')) {
                etc = 0;
            } else if (planLower.includes('fibre')) {
                etc = 149.00;
            } else {
                etc = Math.min(599, monthsLeft * (parseFloat(priceInput.value) || 0));
            }

            output.innerHTML = `
                <div style="font-size: 14px; margin-bottom: 5px;">Status: <strong style="color:green;">${scraped.status.toUpperCase()}</strong></div>
                <div style="font-size: 14px; margin: 3px 0;">Remaining: <strong>${monthsLeft} months</strong></div>
                <div style="font-size: 22px; color: #007bff; margin-top: 8px; border-top: 1px solid #eee; padding-top: 8px;">ETC: <strong>$${etc.toFixed(2)}</strong></div>
            `;
        };

        const openPanel = () => {
            clearInputs(); // Reset UI before scanning
            overlay.style.display = 'block';
            setTimeout(() => {
                overlay.style.opacity = '1';
                container.style.right = '0';
                runCalculation(); // Auto-scan on open
            }, 10);
        };

        const closePanel = () => {
            overlay.style.opacity = '0';
            container.style.right = '-400px';
            setTimeout(() => {
                overlay.style.display = 'none';
                clearInputs(); // Ensure next open starts fresh
            }, 300);
        };

        btn.addEventListener('click', openPanel);
        overlay.addEventListener('click', closePanel);
        container.querySelector('#etc-close').addEventListener('click', closePanel);

        // Manual button also clears and re-scans
        container.querySelector('#etc-calc-btn').addEventListener('click', () => {
            runCalculation();
        });
    }

    waitForHeader();
})();
