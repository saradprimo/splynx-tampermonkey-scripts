// ==UserScript==
// @name         ONT Enquiry Button
// @namespace    https://github.com/saradprimo/splynx-tampermonkey-scripts
// @version      7.4.0
// @description  Shows ONT Enquiry button only on Services tab; single PIID auto-used, multiple PIIDs shows stable dropdown
// @match        *://*/*
// @match        https://assure.ultrafastfibre.co.nz/csm?id=diagnostic_test*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/saradprimo/splynx-tampermonkey-scripts/main/ont-enquiry-button.user.js
// @downloadURL  https://raw.githubusercontent.com/saradprimo/splynx-tampermonkey-scripts/main/ont-enquiry-button.user.js
// ==/UserScript==

(function() {
  'use strict';
  const currentUrl = window.location.href;

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
      button.textContent = 'ONT Enquiry';
      button.title = 'No active/online Fibre or UFB plan found';
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
