// ==UserScript==
// @name         Splynx ETC Calculator
// @namespace    https://github.com/saradprimo/splynx-tampermonkey-scripts
// @version      2.4.1
// @description  ETC Calculator with categories, filtered plans, Fibre Starter always $0 ETC, testing
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
        btn.textContent = 'ETC';
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
        `;
        header.insertBefore(btn, nav);

        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 350px;
            padding: 15px;
            background: #fff;
            border-radius: 8px;
            border: 1px solid #ccc;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-family: Arial, sans-serif;
            font-size: 13px;
            z-index: 99999;
            display: none;
        `;

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong>ETC Calculator</strong>
                <span id="etc-close" style="cursor:pointer; font-weight:bold; color:#888;">✖</span>
            </div>
            <br>
            <label>Contract Start Date</label><br>
            <input type="date" id="etc-date" style="width:100%; margin-bottom:8px;">

            <label>Category</label><br>
            <select id="etc-category" style="width:100%; margin-bottom:10px;">
                <option value="">Select category</option>
                <option value="fib_res">Fibre Residential</option>
                <option value="fib_bus">Fibre Business</option>
                <option value="wr">Wireless Residential</option>
                <option value="wb">Wireless Business</option>
            </select>

            <label>Plan</label><br>
            <select id="etc-plan" style="width:100%; margin-bottom:10px;" disabled>
                <option value="">Select category first</option>
            </select>

            <div id="mates-year-container" style="display:none; margin-bottom:10px;">
                <label>Mates Rates Year</label><br>
                <select id="mates-year" style="width:100%;">
                    <option value="">Select year</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                </select>
            </div>

            <button id="etc-calc-btn" style="width:100%; padding:6px; background-color:#007bff; color:white; border:none; border-radius:4px; cursor:pointer;">Calculate ETC</button>

            <div id="etc-output" style="margin-top:10px; font-weight:bold;"></div>
        `;

        document.body.appendChild(container);

        // Toggle panel
        btn.addEventListener('click', () => { container.style.display = 'block'; });
        container.querySelector('#etc-close').addEventListener('click', () => { container.style.display = 'none'; });

        // Monthly charges and plan data
        const allPlans = {
            // Fibre Residential
            fib_res_starter: { name: "Fibre Starter - $65", monthly: 65 },
            fib_res_500: { name: "GoMassive 500 - $99", monthly: 99 },
            fib_res_max: { name: "GoMassive Max - $115", monthly: 115 },

            // Fibre Business
            fib_bus_300: { name: "GoMassive 300 - $105 + GST", monthly: 105 },
            fib_bus_max: { name: "GoMassive Max - $129 + GST", monthly: 129 },

            // Wireless Residential
            wr_200: { name: "200GB - $79", monthly: 79 },
            wr_400: { name: "400GB - $99", monthly: 99 },
            wr_800: { name: "800GB - $119", monthly: 119 },
            wr_unlimited: { name: "Unlimited - $149", monthly: 149 },
            wr_mates: { name: "Mates Rates - $99", monthly: 99 },

            // Wireless Business
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

        // Filter plans based on category
        categorySelect.addEventListener('change', () => {
            const cat = categorySelect.value;
            planSelect.innerHTML = '<option value="">Select plan</option>';
            if(!cat) {
                planSelect.disabled = true;
                return;
            }
            planSelect.disabled = false;
            categoryPlans[cat].forEach(plan => {
                const opt = document.createElement('option');
                opt.value = plan;
                opt.textContent = allPlans[plan].name;
                planSelect.appendChild(opt);
            });
        });

        // Show Mates dropdown only for Mates Rates
        planSelect.addEventListener('change', () => {
            const plan = planSelect.value;
            if(plan === 'wr_mates' || plan === 'wb_mates') {
                matesContainer.style.display = 'block';
            } else {
                matesContainer.style.display = 'none';
            }
        });

        const WR_CAP = 599;
        const WR_MATES_1 = 599;
        const WR_MATES_2 = 199;
        const WB_CAP = 599;
        const FIB_RES_ETC = 149; // All Fibre Residential except Starter
        const FIB_STARTER_ETC = 0; // Fibre Starter always 0

        function monthsBetween(start, end) {
            let months = (end.getFullYear() - start.getFullYear())*12 + (end.getMonth() - start.getMonth());
            if(end.getDate() < start.getDate()) months--;
            return Math.max(0, months);
        }

        container.querySelector('#etc-calc-btn').addEventListener('click', () => {
            const dateVal = container.querySelector('#etc-date').value;
            const plan = planSelect.value;
            const output = container.querySelector('#etc-output');
            const matesYear = container.querySelector('#mates-year')?.value;

            if(!dateVal || !plan) {
                output.textContent = 'Please select a date and plan.';
                return;
            }

            const startDate = new Date(dateVal);
            const today = new Date();
            const monthsUsed = monthsBetween(startDate, today);
            const monthsLeft = Math.max(0, 12 - monthsUsed);

            const monthlyCharge = allPlans[plan].monthly;
            let remainder = monthsLeft * monthlyCharge;
            let etc = remainder;

            // Plan-specific ETC logic
            if(plan === 'fib_res_starter') {
                etc = FIB_STARTER_ETC; // Fibre Starter always $0
            }
            else if(plan.startsWith('fib_res')) {
                etc = FIB_RES_ETC; // All other Fibre Residential fixed $149
            }
            else if(plan.startsWith('fib_bus')) {
                etc = remainder; // Fibre Business remainder
            }
            else if(plan.startsWith('wr_')) {
                if(plan === 'wr_mates') {
                    if(!matesYear) {
                        output.textContent = 'Please select 1st or 2nd year for Mates Rates.';
                        return;
                    }
                    const cap = matesYear === '1' ? WR_MATES_1 : WR_MATES_2;
                    etc = Math.min(cap, remainder);
                } else {
                    etc = Math.min(WR_CAP, remainder);
                }
            }
            else if(plan.startsWith('wb_')) {
                if(plan === 'wb_mates') {
                    if(!matesYear) {
                        output.textContent = 'Please select 1st or 2nd year for Mates Rates.';
                        return;
                    }
                    etc = Math.min(WB_CAP, remainder);
                } else {
                    etc = Math.min(WB_CAP, remainder);
                }
            }

            output.innerHTML = `
                Months used: ${monthsUsed}<br>
                Months remaining: ${monthsLeft}<br>
                ETC: $${etc.toFixed(2)}
            `;
        });

    }

    waitForHeader();
})();
