// ==UserScript==
// @name         Activity Feed Visual Separator
// @namespace    https://github.com/saradprimo/splynx-tampermonkey-scripts
// @version      1.6.0
// @description  Adds borders and background to activity items, always showing full text
// @match        *://*/*
// @grant        GM_addStyle
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/saradprimo/splynx-tampermonkey-scripts/main/activity-feed-visual-separator.user.js
// @downloadURL  https://raw.githubusercontent.com/saradprimo/splynx-tampermonkey-scripts/main/activity-feed-visual-separator.user.js
// ==/UserScript==

(function () {
    'use strict';

    GM_addStyle(`
        .common-activity-list {
            padding: 6px;
        }

        .common-activity-item {
            background: #f8f9fb;
            border: 1px solid #e1e4e8;
            border-radius: 8px;
            margin-bottom: 12px;
            padding: 10px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        }

        .common-activity-body {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #e5e7eb;
            line-height: 1.4;
            max-height: none; /* Allow full height */
            overflow: visible; /* Show all text */
        }

        .common-activity-item:has(.admin-system) {
            background: #f3f4f6;
        }
    `);

    // Optional: force items to expand if dynamically added
    const expandItems = () => {
        const items = document.querySelectorAll('.common-activity-item .common-activity-body');
        items.forEach(body => {
            body.style.maxHeight = 'none';
            body.style.overflow = 'visible';
        });
    };

    // Initial run
    expandItems();

    // Observe for dynamically added activity items
    const observer = new MutationObserver(expandItems);
    observer.observe(document.body, { childList: true, subtree: true });
})();
