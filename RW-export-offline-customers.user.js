// ==UserScript==
// @name         Splynx RW Residential Export Offline Customers
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  List of Online and Online last 24 hours Wireless customers so HD can contact
// @match        https://splynx.primo.net.nz/admin/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/saradprimo/splynx-tampermonkey-scripts/main/RW-export-offline-customers.user.js
// @downloadURL  https://raw.githubusercontent.com/saradprimo/splynx-tampermonkey-scripts/main/RW-export-offline-customers.user.js
// ==/UserScript==

(function() {
    'use strict';

    let activeCustomers = [];
    let online24hCustomers = [];
    let exportButton;

    // --------------------
    // Header Injection
    // --------------------
    function addHeaderButton() {
        const navList = document.querySelector(".splynx-header ul.navigation");
        if (!navList || document.getElementById("rw-export-btn-container")) return;

        const li = document.createElement("li");
        li.id = "rw-export-btn-container";
        li.style.cssText = "display: flex !important; align-items: center !important; padding: 0 !important; margin: 0 !important; list-style: none !important;";

        exportButton = document.createElement("button");
        exportButton.id = "rw-export-btn";
        exportButton.innerText = "Export RW Residential";

        exportButton.style.cssText = `
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 10px;
            margin-left: 0px !important;
            margin-right: 8px !important;
            cursor: pointer;
            font-weight: bold;
            font-size: 12px;
            white-space: nowrap;
            height: 26px;
            line-height: 1;
        `;

        exportButton.addEventListener("click", (e) => {
            e.preventDefault();
            startExportSequence();
        });

        li.appendChild(exportButton);
        navList.prepend(li);
    }

    // --------------------
    // Sequence Logic
    // --------------------
    async function startExportSequence() {
        exportButton.disabled = true;
        exportButton.innerText = "Navigating...";

        // If we are NOT on the search page, navigate there first
        if (!window.location.pathname.includes("/admin/customers/search")) {
            localStorage.setItem('rw_export_pending', 'true');

            // 1. Click "Customers" menu to expand it
            const customerMenu = document.querySelector('a.color-purple i.icon-ic_fluent_people_team_24_regular')?.closest('a');
            if (customerMenu) customerMenu.click();

            await new Promise(r => setTimeout(r, 500));

            // 2. Click "Search" link
            const searchLink = document.querySelector('a[href="/admin/customers/search"]');
            if (searchLink) {
                searchLink.click();
            } else {
                // Fallback: force location change if menu click fails
                window.location.href = "/admin/customers/search";
            }
        } else {
            // Already on search page, just run
            runExport();
        }
    }

    // This checks if we just arrived here via the button click
    function checkPendingExport() {
        if (localStorage.getItem('rw_export_pending') === 'true' && window.location.pathname.includes("/admin/customers/search")) {
            localStorage.removeItem('rw_export_pending');
            runExport();
        }
    }

    async function runExport() {
        if (exportButton) {
            exportButton.disabled = true;
            exportButton.innerText = "Processing...";
        }
        activeCustomers = [];
        online24hCustomers = [];
        await applyFilters();
    }

    // --------------------
    // Filter Logic (Standard)
    // --------------------
    async function applyFilters() {
        try {
            const statusDropdown = await waitForElement('.ms-choice');
            statusDropdown.click();
            await new Promise(r => setTimeout(r, 300));

            const statusItems = [...document.querySelectorAll('.ms-drop li')]
                .filter(li => li.textContent.trim() === "Active" || li.textContent.trim() === "Online last 24 hours");

            statusItems.forEach(item => {
                const checkbox = item.querySelector('input[type=checkbox]');
                if(checkbox && !checkbox.checked) checkbox.click();
            });
            statusDropdown.click();

            const tariffDropdown = document.querySelectorAll('.input-wrap .ms-choice')[1];
            tariffDropdown.click();
            const tariffInput = document.querySelectorAll('.input-ms-search')[1];
            tariffInput.value = 'RW Residential';
            tariffInput.dispatchEvent(new Event('input', { bubbles: true }));

            await new Promise(r => setTimeout(r, 400));
            const tariffItems = [...document.querySelectorAll('.ms-drop li')]
                .filter(li => li.textContent.includes('RW Residential'));

            tariffItems.forEach(item => {
                const checkbox = item.querySelector('input[type=checkbox]');
                if(checkbox && !checkbox.checked) checkbox.click();
            });
            tariffDropdown.click();

            const findButton = await waitForElement('#admin_customers_search_form_search_button');
            findButton.click();

            setTimeout(() => waitForTable(collectAllPages), 1200);
        } catch (err) { console.error("Filter Error:", err); }
    }

    function waitForElement(selector) {
        return new Promise(resolve => {
            const timer = setInterval(() => {
                const el = document.querySelector(selector);
                if(el) { clearInterval(timer); resolve(el); }
            }, 150);
        });
    }

    function waitForTable(callback) {
        const interval = setInterval(() => {
            const table = document.querySelector("#customers_list_table tbody");
            if (table && table.querySelector("tr")) {
                clearInterval(interval);
                callback();
            }
        }, 500);
    }

    function parsePage() {
        const tableBody = document.querySelector("#customers_list_table tbody");
        if (!tableBody) return;
        const rows = tableBody.querySelectorAll("tr");
        rows.forEach(row => {
            const tds = row.querySelectorAll("td");
            if (tds.length < 5) return;
            const customer = {
                id: tds[2].innerText.trim(),
                status: tds[1].innerText.trim(),
                name: tds[4].innerText.trim(),
                phone: tds[5] ? tds[5].innerText.trim() : "",
                plan: tds[6] ? tds[6].innerText.trim() : ""
            };
            if (customer.status.toLowerCase() === "active") activeCustomers.push(customer);
            else online24hCustomers.push(customer);
        });
    }

    function collectAllPages() {
        parsePage();
        const nextBtn = document.querySelector("#customers_list_table_next a");
        if (nextBtn && !nextBtn.parentElement.classList.contains("disabled")) {
            nextBtn.click();
            setTimeout(collectAllPages, 1000);
        } else {
            showExportView();
        }
    }

    function exportToCSV(customers) {
        const headers = ["ID", "Name", "Status", "Phone", "Plan"];
        const rows = customers.map(c => [c.id, `"${c.name}"`, c.status, c.phone, `"${c.plan}"`]);
        const content = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", "Splynx_Export.csv");
        link.click();
    }

    function showExportView() {
        const newTab = window.open();
        const allData = JSON.stringify([...activeCustomers, ...online24hCustomers]);

        const html = `
            <html>
            <head>
                <title>Residential Export Manager</title>
                <style>
                    body { font-family: 'Segoe UI', sans-serif; background: #f8fafc; padding: 40px; color: #1e293b; }
                    .container { max-width: 1250px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                    .header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #f8fafc; padding-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; }
                    th { text-align: left; background: #f8fafc; padding: 14px 12px; font-size: 0.75rem; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; }
                    td { padding: 14px 12px; border-bottom: 1px solid #e2e8f0; font-size: 0.9rem; }
                    .status-pill { display: inline-block; padding: 6px 14px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; background: #e0f2fe; color: #0369a1; white-space: nowrap; }
                    .btn-csv { background: #10b981; color: white; padding: 10px 22px; border-radius: 6px; border: none; cursor: pointer; font-weight: bold; font-size: 12px; text-transform: uppercase; }
                    .contacted-chk { width: 20px; height: 20px; cursor: pointer; }
                    .row-done { background-color: #f1f5f9; opacity: 0.6; }
                    a { color: #007bff; text-decoration: none; font-weight: 500; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header-flex">
                        <h1>Residential Customer List</h1>
                        <button id="dlCsv" class="btn-csv">Download CSV</button>
                    </div>
                    <table>
                        <thead>
                            <tr><th>Done</th><th>ID</th><th>Name</th><th style="width:240px">Status</th><th>Phone</th><th>Plan</th></tr>
                        </thead>
                        <tbody id="tableBody"></tbody>
                    </table>
                </div>
                <script>
                    const data = ${allData};
                    const tableBody = document.getElementById('tableBody');

                    data.forEach(c => {
                        const isChecked = localStorage.getItem('contacted_' + c.id) === 'true';
                        const row = document.createElement('tr');
                        if(isChecked) row.classList.add('row-done');
                        row.innerHTML = '<td><input type="checkbox" class="contacted-chk" ' + (isChecked ? 'checked' : '') + ' data-id="' + c.id + '"></td>' +
                                        '<td>#' + c.id + '</td>' +
                                        '<td><a href="https://splynx.primo.net.nz/admin/customers/view?id=' + c.id + '" target="_blank">' + c.name + '</a></td>' +
                                        '<td><span class="status-pill">' + c.status + '</span></td>' +
                                        '<td>' + c.phone + '</td>' +
                                        '<td>' + c.plan + '</td>';
                        tableBody.appendChild(row);
                    });

                    document.addEventListener('change', (e) => {
                        if(e.target.classList.contains('contacted-chk')) {
                            localStorage.setItem('contacted_' + e.target.dataset.id, e.target.checked);
                            e.target.closest('tr').classList.toggle('row-done', e.target.checked);
                        }
                    });

                    document.getElementById('dlCsv').onclick = () => {
                        window.opener.postMessage({type: 'DOWNLOAD_CSV', data: data}, '*');
                    };
                <\/script>
            </body>
            </html>
        `;

        newTab.document.write(html);
        newTab.document.close();

        if (exportButton) {
            exportButton.innerText = "Export RW Residential";
            exportButton.disabled = false;
        }
    }

    window.addEventListener("message", (event) => {
        if (event.data.type === 'DOWNLOAD_CSV') exportToCSV(event.data.data);
    });

    // --- Init ---
    addHeaderButton();
    checkPendingExport();

    // Check page for button status
    if (exportButton) {
        exportButton.disabled = false;
        exportButton.style.backgroundColor = "#007bff";
        exportButton.style.opacity = "1";
    }

    const observer = new MutationObserver(() => {
        addHeaderButton();
        checkPendingExport();
    });
    observer.observe(document.body, { childList: true, subtree: true });

})();
