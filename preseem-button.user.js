// ==UserScript==
// @name         Preseem Button
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Preseem button that links directly to subscriber page.
// @match        *://*/*
// @grant        GM_notification
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @updateURL    https://raw.githubusercontent.com/saradprimo/splynx-tampermonkey-scripts/main/preseem-button.user.js
// @downloadURL  https://raw.githubusercontent.com/saradprimo/splynx-tampermonkey-scripts/main/preseem-button.user.js
// ==/UserScript==

(function() {
    'use strict';

    const wrapperId = 'preseem_stable_wrapper';
    let lastKnownLogin = '';

    function findActiveServiceLogin() {
        const table = document.querySelector('#admin_customers_services_internet_list');
        if (!table) return null;

        const rows = table.querySelectorAll('tbody tr');
        for (const row of rows) {
            const badge = row.querySelector('label.badge.bg-success, label.badge.bg-primary');
            if (badge && (badge.textContent.trim().toLowerCase() === 'online' || badge.textContent.trim().toLowerCase() === 'active')) {
                const tds = row.querySelectorAll('td');
                if (tds.length >= 9) {
                    return tds[8].textContent.trim();
                }
            }
        }
        return null;
    }

    function isServicesTabActive() {
        const activeTab = document.querySelector('a.active_tab.tabs__link');
        return activeTab && activeTab.textContent.trim().toLowerCase() === 'services';
    }

    function updatePreseemButton() {
        const header = document.querySelector('.card-block-header .pull-right');
        if (!header) return;

        const wrapper = document.getElementById(wrapperId);

        // 1. Check Tab Visibility
        if (!isServicesTabActive()) {
            if (wrapper) {
                wrapper.remove();
                lastKnownLogin = '';
            }
            return;
        }

        // 2. Check Login State
        const currentLogin = findActiveServiceLogin();

        // STABILITY CHECK: If the login hasn't changed and the button exists, DO NOTHING.
        // This prevents the flickering loop.
        if (currentLogin === lastKnownLogin && wrapper) return;

        lastKnownLogin = currentLogin;

        // 3. Create or Refresh the Wrapper
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

        // 4. Build the Button
        const button = document.createElement('button');
        button.type = 'button';
        button.style.minWidth = '120px';

        if (!currentLogin) {
            button.className = 'btn btn-secondary';
            button.disabled = true;
            button.textContent = 'Preseem';
            button.title = 'No active internet service login found in table';
        } else {
            const directUrl = `https://app.preseem.com/r/subscriber/${encodeURIComponent(currentLogin)}`;
            button.className = 'btn btn-primary';
            button.innerHTML = '<i class="fa fa-line-chart"></i> Preseem';
            button.title = `Open Preseem for ${currentLogin}`;
            button.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(directUrl, '_blank');
            };
        }

        container.appendChild(button);
    }

    // --- High Performance Watcher ---
    function startDynamicWatcher() {
        // Initial run
        updatePreseemButton();

        // Use a single observer with a debounce to prevent the "flicker loop"
        let debounceTimer;
        const observer = new MutationObserver(() => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(updatePreseemButton, 200);
        });

        // Watch only the main content area to reduce overhead
        const mainContent = document.querySelector('.card-block') || document.body;
        observer.observe(mainContent, {
            childList: true,
            subtree: true,
            attributes: false // Don't watch attributes to stop LastPass/Style flickering
        });
    }

    // Start
    if (document.readyState === 'complete') {
        startDynamicWatcher();
    } else {
        window.addEventListener('load', startDynamicWatcher);
    }

})();
