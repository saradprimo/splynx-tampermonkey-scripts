// ==UserScript==
// @name         Splynx ETC Calculator
// @namespace    https://github.com/saradprimo/splynx-tampermonkey-scripts
// @version      2.9
// @description  ETC Calculator with categories, filtered plans, Fibre Starter always $0 ETC
// @match        *://*/*
// @updateURL    https://raw.githubusercontent.com/saradprimo/splynx-tampermonkey-scripts/main/etc-calculator.user.js
// @downloadURL  https://raw.githubusercontent.com/saradprimo/splynx-tampermonkey-scripts/main/etc-calculator.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const manualPlans = {
        fib_res: [
            { name: "Fibre Starter - $65", price: 65, type: "fibre_starter" },
            { name: "GoMassive 500 - $99", price: 99, type: "fibre" },
            { name: "GoMassive Max - $115", price: 115, type: "fibre" }
        ],
        fib_bus: [
            { name: "GoMassive 300 - $105 + GST", price: 105, type: "fibre" },
            { name: "GoMassive Max - $129 + GST", price: 129, type: "fibre" }
        ],
        wr_res: [
            { name: "Wireless 200GB - $79", price: 79, type: "wireless" },
            { name: "Wireless 400GB - $99", price: 99, type: "wireless" },
            { name: "Wireless 800GB - $119", price: 119, type: "wireless" },
            { name: "Wireless Unlimited - $149", price: 149, type: "wireless" }
        ],
        wr_bus: [
            { name: "Wireless 200GB - $86.90 + GST", price: 86.90, type: "wireless" },
            { name: "Wireless 400GB - $103.48 + GST", price: 103.48, type: "wireless" },
            { name: "Wireless Unlimited - $146.96 + GST", price: 146.96, type: "wireless" }
        ]
    };

    function waitForHeader() {
        const header = document.querySelector('.splynx-header');
        const nav = header ? header.querySelector('.navigation') : null;
        if (!header || !nav) { setTimeout(waitForHeader, 500); return; }
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

                <div id="service-selector-area" style="padding: 15px 20px 0 20px;">
                    <label style="display:block; font-size: 11px; font-weight: bold; color: #666; margin-bottom: 8px; text-transform: uppercase;">Detected Services:</label>
                    <div id="service-list" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px;"></div>
                </div>

                <div style="padding: 0 20px 20px 20px; overflow-y: auto; flex-grow: 1;">
                    <div id="manual-dropdowns" style="margin-bottom: 15px; padding: 12px; background: #fff3cd; border: 1px solid #ffeeba; border-radius: 6px;">
                        <label style="display:block; font-size: 11px; font-weight: bold; color: #856404; margin-bottom: 8px;">MANUAL SELECTION</label>
                        <select id="sel-category" style="width:100%; padding: 8px; margin-bottom: 8px; border-radius: 4px; border: 1px solid #ccc;">
                            <option value="">-- Select Category --</option>
                            <option value="fib_res">Fibre Residential</option>
                            <option value="fib_bus">Fibre Business</option>
                            <option value="wr_res">Wireless Residential</option>
                            <option value="wr_bus">Wireless Business</option>
                        </select>
                        <select id="sel-plan" style="width:100%; padding: 8px; border-radius: 4px; border: 1px solid #ccc;" disabled>
                            <option value="">-- Select Plan --</option>
                        </select>
                    </div>

                    <div style="margin-bottom: 15px;">
                        <label style="display:block; margin-bottom: 5px; font-weight: 600;">End of Contract</label>
                        <input type="text" id="etc-date-display" placeholder="DD/MM/YYYY" style="width:100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display:block; margin-bottom: 5px; font-weight: 600;">Plan Price ($)</label>
                        <input type="number" id="etc-manual-price" style="width:100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display:block; margin-bottom: 5px; font-weight: 600;">Plan Name</label>
                        <input type="text" id="etc-plan-name" style="width:100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; background:#f9f9f9;">
                    </div>
                    <button id="etc-calc-btn" style="width:100%; padding: 10px; background-color:#28a745; color:white; border:none; border-radius: 4px; cursor:pointer; font-weight: 600;">Calculate</button>

                    <div id="etc-output" style="margin-top: 20px; padding: 15px; border-radius: 4px; background: #f1f3f5; min-height: 60px; border: 1px solid #ddd;">
                        <span style="color: #888;">Detecting services...</span>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(container);

        const serviceListDiv = container.querySelector('#service-list');
        const selCat = container.querySelector('#sel-category');
        const selPlan = container.querySelector('#sel-plan');
        const dateInput = container.querySelector('#etc-date-display');
        const priceInput = container.querySelector('#etc-manual-price');
        const planInput = container.querySelector('#etc-plan-name');
        const output = container.querySelector('#etc-output');

        // --- Manual Dropdown Logic ---
        selCat.addEventListener('change', () => {
            const cat = selCat.value;
            selPlan.innerHTML = '<option value="">-- Select Plan --</option>';
            if (!cat) { selPlan.disabled = true; return; }
            selPlan.disabled = false;
            manualPlans[cat].forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.name;
                opt.textContent = p.name;
                opt.dataset.price = p.price;
                selPlan.appendChild(opt);
            });
        });

        selPlan.addEventListener('change', () => {
            const opt = selPlan.options[selPlan.selectedIndex];
            if (selPlan.value) {
                planInput.value = selPlan.value;
                priceInput.value = opt.dataset.price;
                runCalculation();
            }
        });

        function parseNZDate(dateStr) {
            if (!dateStr) return null;
            const parts = dateStr.split('/');
            return parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]) : null;
        }

        function scanAllServices() {
            const services = [];
            const headers = Array.from(document.querySelectorAll('th'));
            const findIdx = (reg) => headers.findIndex(th => reg.test(th.getAttribute('aria-label') || "") || reg.test(th.innerText || ""));

            const pIdx = findIdx(/Plan/i);
            const sIdx = findIdx(/Status/i);
            const prIdx = findIdx(/Price/i);
            const eIdx = findIdx(/End of contract/i);

            if (pIdx !== -1 && sIdx !== -1) {
                const rows = Array.from(document.querySelectorAll('table[id*="internet_list"] tbody tr'));
                rows.forEach(row => {
                    const status = row.cells[sIdx]?.innerText.trim().toLowerCase();
                    if (status === 'active' || status === 'online') {
                        services.push({
                            plan: row.cells[pIdx].innerText.trim(),
                            price: parseFloat(row.cells[prIdx].innerText.replace(/[^0-9.]/g, '')),
                            date: row.cells[eIdx].innerText.trim().replace('00/00/0000', '').replace('-', '').trim(),
                            status: status.toUpperCase()
                        });
                    }
                });
            }
            return services;
        }

        function runCalculation() {
            const endDate = parseNZDate(dateInput.value);
            const today = new Date();
            const currentPrice = parseFloat(priceInput.value);

            if (!endDate || isNaN(endDate.getTime())) {
                output.innerHTML = `<span style="color: #d9480f;"><strong>Required:</strong> Enter End of Contract date (DD/MM/YYYY).</span>`;
                return;
            }

            if (endDate <= today) {
                output.innerHTML = `<div style="font-size: 20px; color: #28a745;">ETC: <strong>$0.00</strong></div><small>Contract has expired.</small>`;
                return;
            }

            let monthsLeft = (endDate.getFullYear() - today.getFullYear()) * 12 + (endDate.getMonth() - today.getMonth());
            if (endDate.getDate() > today.getDate()) monthsLeft++;
            monthsLeft = Math.max(0, monthsLeft);

            let etc = 0;
            const p = planInput.value.toLowerCase();
            if (p.includes('starter')) etc = 0;
            else if (p.includes('fibre')) etc = 149.00;
            else etc = Math.min(599, monthsLeft * (currentPrice || 0));

            output.innerHTML = `
                <div style="font-size: 14px; margin-bottom: 5px;">Plan: <strong>${planInput.value}</strong></div>
                <div style="font-size: 14px; margin: 3px 0;">Remaining: <strong>${monthsLeft} months</strong></div>
                <div style="font-size: 22px; color: #007bff; margin-top: 8px; border-top: 1px solid #eee; padding-top: 8px;">ETC: <strong>$${etc.toFixed(2)}</strong></div>
            `;
        }

        const openPanel = () => {
            serviceListDiv.innerHTML = "";
            planInput.value = ""; priceInput.value = ""; dateInput.value = "";
            selCat.value = ""; selPlan.innerHTML = '<option value="">-- Select Plan --</option>'; selPlan.disabled = true;

            const activeServices = scanAllServices();

            if (activeServices.length > 0) {
                activeServices.forEach(s => {
                    const sBtn = document.createElement('div');
                    sBtn.style.cssText = `padding: 10px; border: 2px solid #ddd; border-radius: 6px; cursor: pointer; background: #fff; transition: all 0.2s;`;
                    sBtn.innerHTML = `<div style="font-weight: bold; font-size: 13px; color: #333;">${s.plan}</div><div style="font-size: 11px; color: #28a745;">${s.status} • $${s.price}</div>`;
                    sBtn.onclick = () => {
                        planInput.value = s.plan;
                        priceInput.value = s.price;
                        dateInput.value = s.date;
                        Array.from(serviceListDiv.children).forEach(child => {
                            child.style.borderColor = "#ddd";
                            child.style.background = "#fff";
                        });
                        sBtn.style.borderColor = "#007bff";
                        sBtn.style.background = "#f0f7ff";
                        runCalculation();
                    };
                    serviceListDiv.appendChild(sBtn);
                });
                setTimeout(() => serviceListDiv.firstChild.click(), 50);
            } else {
                serviceListDiv.innerHTML = `<div style="color: #dc3545; font-size: 12px;">No active services found. Please select a plan manually below.</div>`;
            }

            overlay.style.display = 'block';
            setTimeout(() => { overlay.style.opacity = '1'; container.style.right = '0'; }, 10);
        };

        const closePanel = () => {
            overlay.style.opacity = '0'; container.style.right = '-400px';
            setTimeout(() => { overlay.style.display = 'none'; }, 300);
        };

        btn.addEventListener('click', openPanel);
        overlay.addEventListener('click', closePanel);
        container.querySelector('#etc-close').addEventListener('click', closePanel);
        container.querySelector('#etc-calc-btn').addEventListener('click', runCalculation);
    }

    waitForHeader();
})();
