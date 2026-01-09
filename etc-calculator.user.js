// ==UserScript==
// @name         Splynx ETC Calculator
// @namespace    https://github.com/saradprimo/splynx-tampermonkey-scripts
// @version      2.4.2
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
        // Compact Trigger Button (Original Size)
        const btn = document.createElement('button');
        btn.textContent = 'ETC Calculator';
        btn.style.cssText = `
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 10px;
            margin-right: 8px;
            cursor: pointer;
            font-weight: bold;
            font-size: 12px;
            white-space: nowrap;
        `;
        header.insertBefore(btn, nav);

        // Overlay Backdrop
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.4);
            z-index: 99998;
            display: none;
            opacity: 0;
            transition: opacity 0.3s;
        `;

        // Side Panel Container
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            top: 0;
            right: -400px;
            width: 380px;
            height: 100%;
            background: #ffffff;
            box-shadow: -5px 0 15px rgba(0,0,0,0.1);
            z-index: 99999;
            transition: right 0.3s ease-in-out;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
        `;

        container.innerHTML = `
            <style>
                #etc-side-panel *, #etc-side-panel *:before, #etc-side-panel *:after { box-sizing: border-box; }
            </style>
            <div id="etc-side-panel" style="height: 100%; display: flex; flex-direction: column;">
                <div style="padding: 24px; background: #f8f9fa; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="margin: 0; font-size: 18px; color: #333;">ETC Calculator</h2>
                    <span id="etc-close" style="cursor:pointer; font-size: 24px; color:#aaa; line-height: 1;">&times;</span>
                </div>

                <div style="padding: 24px; overflow-y: auto; flex-grow: 1;">
                    <div style="margin-bottom: 20px;">
                        <label style="display:block; margin-bottom: 8px; font-weight: 600; color: #555;">Contract Start Date</label>
                        <input type="date" id="etc-date" style="width:100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-family: inherit;">
                        <small style="color: #888; display: block; margin-top: 4px;">Date must be from 2006 up to today.</small>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <label style="display:block; margin-bottom: 8px; font-weight: 600; color: #555;">Category</label>
                        <select id="etc-category" style="width:100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; background: white; height: 40px;">
                            <option value="">Select category</option>
                            <option value="fib_res">Fibre Residential</option>
                            <option value="fib_bus">Fibre Business</option>
                            <option value="wr">Wireless Residential</option>
                            <option value="wb">Wireless Business</option>
                        </select>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <label style="display:block; margin-bottom: 8px; font-weight: 600; color: #555;">Plan</label>
                        <select id="etc-plan" style="width:100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; background: white; height: 40px;" disabled>
                            <option value="">Select category first</option>
                        </select>
                    </div>

                    <div id="mates-year-container" style="display:none; margin-bottom: 20px; padding: 15px; background: #e7f3ff; border-radius: 6px; border: 1px solid #b6d4fe;">
                        <label style="display:block; margin-bottom: 8px; font-weight: 600; color: #0056b3;">Mates Rates Year</label>
                        <select id="mates-year" style="width:100%; padding: 10px; border: 1px solid #b6d4fe; border-radius: 4px; background: white; height: 40px;">
                            <option value="">Select year</option>
                            <option value="1">1st Year</option>
                            <option value="2">2nd Year</option>
                        </select>
                    </div>

                    <button id="etc-calc-btn" style="width:100%; padding: 12px; background-color:#007bff; color:white; border:none; border-radius: 6px; cursor:pointer; font-weight: 600; font-size: 15px; margin-top: 10px;">Calculate ETC</button>

                    <div id="etc-output" style="margin-top: 25px; padding: 20px; border-radius: 8px; background: #f1f3f5; min-height: 80px; line-height: 1.6;">
                        <span style="color: #888; font-style: italic;">Results will appear here...</span>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(container);

        const openPanel = () => {
            overlay.style.display = 'block';
            setTimeout(() => { overlay.style.opacity = '1'; container.style.right = '0'; }, 10);
        };

        const closePanel = () => {
            overlay.style.opacity = '0';
            container.style.right = '-400px';
            setTimeout(() => { overlay.style.display = 'none'; }, 300);
        };

        btn.addEventListener('click', openPanel);
        overlay.addEventListener('click', closePanel);
        container.querySelector('#etc-close').addEventListener('click', closePanel);

        // Plan Data
        const allPlans = {
            fib_res_starter: { name: "Fibre Starter - $65", monthly: 65 },
            fib_res_500: { name: "GoMassive 500 - $99", monthly: 99 },
            fib_res_max: { name: "GoMassive Max - $115", monthly: 115 },
            fib_bus_300: { name: "GoMassive 300 - $105 + GST", monthly: 105 },
            fib_bus_max: { name: "GoMassive Max - $129 + GST", monthly: 129 },
            wr_200: { name: "200GB - $79", monthly: 79 },
            wr_400: { name: "400GB - $99", monthly: 99 },
            wr_800: { name: "800GB - $119", monthly: 119 },
            wr_unlimited: { name: "Unlimited - $149", monthly: 149 },
            wr_mates: { name: "Mates Rates - $99", monthly: 99 },
            wb_200: { name: "200GB - $86.90 + GST", monthly: 86.90 },
            wb_400: { name: "400GB - $103.48 + GST", monthly: 103.48 },
            wb_800: { name: "800GB - $120.87 + GST", monthly: 120.87 },
            wb_unlimited: { name: "Unlimited - $146.96 + GST", monthly: 146.96 },
            wb_mates: { name: "Mates Rates - $119 + GST", monthly: 119 }
        };

        const categoryPlans = {
            fib_res: ["fib_res_starter","fib_res_500","fib_res_max"],
            fib_bus: ["fib_bus_300","fib_bus_max"],
            wr: ["wr_200","wr_400","wr_800","wr_unlimited","wr_mates"],
            wb: ["wb_200","wb_400","wb_800","wb_unlimited","wb_mates"]
        };

        const matesContainer = container.querySelector('#mates-year-container');
        const planSelect = container.querySelector('#etc-plan');
        const categorySelect = container.querySelector('#etc-category');

        categorySelect.addEventListener('change', () => {
            const cat = categorySelect.value;
            planSelect.innerHTML = '<option value="">Select plan</option>';
            if(!cat) { planSelect.disabled = true; return; }
            planSelect.disabled = false;
            categoryPlans[cat].forEach(plan => {
                const opt = document.createElement('option');
                opt.value = plan;
                opt.textContent = allPlans[plan].name;
                planSelect.appendChild(opt);
            });
        });

        planSelect.addEventListener('change', () => {
            const plan = planSelect.value;
            matesContainer.style.display = (plan === 'wr_mates' || plan === 'wb_mates') ? 'block' : 'none';
        });

        function monthsBetween(start, end) {
            let months = (end.getFullYear() - start.getFullYear())*12 + (end.getMonth() - start.getMonth());
            if(end.getDate() < start.getDate()) months--;
            return Math.max(0, months);
        }

        container.querySelector('#etc-calc-btn').addEventListener('click', () => {
            const dateInput = container.querySelector('#etc-date');
            const dateVal = dateInput.value;
            const plan = planSelect.value;
            const output = container.querySelector('#etc-output');
            const matesYear = container.querySelector('#mates-year')?.value;

            if(!dateVal || !plan) {
                output.innerHTML = '<span style="color: #dc3545;">Please select a date and plan.</span>';
                return;
            }

            // --- STRICT VALIDATION ---
            const dateRegex = /^(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
            const match = dateVal.match(dateRegex);

            if (!match) {
                output.innerHTML = '<span style="color: #dc3545; font-weight: bold;">Incorrect Date:</span><br>Please use a 4-digit year starting with 20 (e.g., 2024).';
                return;
            }

            const y = parseInt(match[1], 10);
            const m = parseInt(match[2], 10);
            const d = parseInt(match[3], 10);
            const testDate = new Date(y, m - 1, d);
            const today = new Date();

            if (y < 2006 || testDate.getFullYear() !== y || (testDate.getMonth() + 1) !== m || testDate.getDate() !== d) {
                output.innerHTML = '<span style="color: #dc3545; font-weight: bold;">Incorrect Date:</span><br>Date is invalid or before 2006.';
                return;
            }

            if (testDate > today) {
                output.innerHTML = '<span style="color: #dc3545; font-weight: bold;">Incorrect Date:</span><br>Start date cannot be in the future.';
                return;
            }

            // Calculation
            const monthsUsed = monthsBetween(testDate, today);
            const monthsLeft = Math.max(0, 12 - monthsUsed);
            const monthlyCharge = allPlans[plan].monthly;
            let remainder = monthsLeft * monthlyCharge;
            let etc = remainder;

            if(plan === 'fib_res_starter') etc = 0;
            else if(plan.startsWith('fib_res')) etc = 149;
            else if(plan.startsWith('fib_bus')) etc = remainder;
            else if(plan.startsWith('wr_')) {
                if(plan === 'wr_mates') {
                    if(!matesYear) { output.innerHTML = '<span style="color: #dc3545;">Please select 1st or 2nd year.</span>'; return; }
                    etc = Math.min(matesYear === '1' ? 599 : 199, remainder);
                } else etc = Math.min(599, remainder);
            }
            else if(plan.startsWith('wb_')) etc = Math.min(599, remainder);

            output.innerHTML = `
                <div style="font-size: 14px; color: #666;">Summary:</div>
                <div style="font-size: 15px; margin: 5px 0;">Months used: <strong>${monthsUsed}</strong></div>
                <div style="font-size: 15px; margin: 5px 0;">Months remaining: <strong>${monthsLeft}</strong></div>
                <div style="font-size: 22px; color: #28a745; margin-top: 10px;">ETC: <strong>$${etc.toFixed(2)}</strong></div>
            `;
        });
    }

    waitForHeader();
})();
