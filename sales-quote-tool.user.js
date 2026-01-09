// ==UserScript==
// @name         Sales Quote Tool
// @namespace    https://github.com/your-org/front-desk-quoter
// @version      4.7
// @description  Added Gold Card 10% Discount Logic
// @match        *://splynx.primo.net.nz/*
// @grant        GM_addStyle
// @grant        GM_getResourceURL
// @resource     PRIMO_LOGO https://raw.githubusercontent.com/saradprimo/splynx-tampermonkey-scripts/main/primologo2.png
// @require      https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
// @updateURL    https://raw.githubusercontent.com/saradprimo/splynx-tampermonkey-scripts/main/sales-quote-tool.user.js
// @downloadURL  https://raw.githubusercontent.com/saradprimo/splynx-tampermonkey-scripts/main/sales-quote-tool.user.js
// ==/UserScript==

(function () {
  'use strict';

  const { jsPDF } = window.jspdf;

  const COLORS = {
    dark: '#1a1a1a',
    white: '#ffffff',
    blue: '#31a7eb',
    green: '#67a671',
    orange: '#ff6900'
  };

  /* ===================== STYLES ===================== */
  GM_addStyle(`
    #quoteBtn {
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 4px 10px;
        margin-right: 8px;
        cursor: pointer;
        font-weight: bold;
        font-size: 12px;
    }
    #quotePanel { position: fixed; top: 0; right: -420px; width: 400px; height: 100%; background: ${COLORS.white}; box-shadow: -4px 0 14px rgba(0,0,0,.18); z-index: 10000; padding: 25px 18px; overflow-y: auto; transition: right 0.3s ease; font-family: system-ui, Arial, sans-serif; border-left: 5px solid ${COLORS.orange}; }
    #quotePanel.open { right: 0; }
    #closePanel { position: absolute; top: 10px; right: 15px; background: none; border: none; font-size: 24px; cursor: pointer; color: ${COLORS.dark}; font-weight: bold; }
    .section-box { background: #f8f9fa; border: 1px solid #e9ecef; padding: 12px; border-radius: 8px; margin-bottom: 15px; }
    h2 { color: ${COLORS.dark}; border-bottom: 2px solid ${COLORS.blue}; padding-bottom: 5px; }
    h3 { margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: ${COLORS.blue}; text-transform: uppercase; }
    label { display: block; margin: 7px 0; font-size: 13px; color: ${COLORS.dark}; }
    select, input[type="text"], input[type="number"] { width: 100%; margin-top: 4px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; }
    .hidden { display: none; }
    .printBtn { margin-top: 10px; width: 100%; padding: 12px; background: ${COLORS.green}; color: ${COLORS.white}; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
    .indented { margin-left: 20px; border-left: 2px solid #ddd; padding-left: 10px; margin-top: 5px; }
  `);

  /* ===================== UI STRUCTURE ===================== */
  const panelHtml = `
    <div id="quotePanel">
      <button id="closePanel">&times;</button>
      <h2 style="margin-bottom:20px;">Quote Builder</h2>
      <div class="section-box">
          <h3>Customer Details</h3>
          <label>Customer Name <input type="text" id="custName" placeholder="John Smith"></label>
          <label>Address <input type="text" id="custAddr" placeholder="123 Main Street"></label>
      </div>
      <div class="section-box">
          <h3>Service Type</h3>
          <select id="custType">
              <option value="">Select Category</option>
              <option value="res">Residential</option>
          </select>
      </div>
      <div id="resLogic" class="hidden">
          <div class="section-box">
              <h3>Broadband Connection</h3>
              <select id="connType">
                  <option value="">Select Type</option>
                  <option value="fibre">Fibre</option>
                  <option value="wireless">Wireless</option>
              </select>
              <div id="fibrePlans" class="hidden" style="margin-top:10px;">
                <label><input type="radio" name="bb" data-name="Fibre Starter" data-price="65" data-starter="true"> Fibre Starter – $65</label>
                <label><input type="radio" name="bb" data-name="GoMassive 500" data-price="99" data-bundle="true"> GoMassive 500 – $99</label>
                <label><input type="radio" name="bb" data-name="GoMassive Max" data-price="115" data-bundle="true"> GoMassive Max – $115</label>
              </div>
              <div id="wirelessPlans" class="hidden" style="margin-top:10px;">
                <label><input type="radio" name="bb" data-name="200GB" data-price="79" data-bundle="true"> 200GB – $79</label>
                <label><input type="radio" name="bb" data-name="400GB" data-price="99" data-bundle="true"> 400GB – $99</label>
                <label><input type="radio" name="bb" data-name="800GB" data-price="119" data-bundle="true"> 800GB – $119</label>
                <label><input type="radio" name="bb" data-name="Unlimited" data-price="149" data-bundle="true"> Unlimited – $149</label>
                <label><input type="radio" name="bb" data-name="Mates Rates" data-price="99" data-mates="true" data-bundle="true"> Mates Rates – $99</label>
              </div>
          </div>
          <div class="section-box">
              <h3>Contract</h3>
              <label><input type="checkbox" id="contractCheck"> 12 Month Contract</label>
              <p id="contractNote" style="font-size:11px; color:#666;"></p>
          </div>
          <div class="section-box">
              <h3>Mobile Phone Plans</h3>
              <label><input type="checkbox" class="mobile" data-name="GoStarter" data-price="20"> GoStarter – $20</label>
              <label><input type="checkbox" class="mobile" data-name="Go6" data-price="50"> Go6 – $50</label>
              <label><input type="checkbox" class="mobile" data-name="Go15" data-price="65" id="go15"> Go15 – $65</label>
              <div id="go15CompBox" class="hidden indented">
                <label>Companions (Max 3) <input type="number" id="go15Comp" value="0" min="0" max="3"></label>
              </div>
              <label><input type="checkbox" class="mobile" data-name="Go50" data-price="70" id="go50"> Go50 – $70</label>
              <div id="go50CompBox" class="hidden indented">
                <label>Companions (Max 3) <input type="number" id="go50Comp" value="0" min="0" max="3"></label>
              </div>
          </div>
          <div class="section-box">
              <h3>VOIP</h3>
              <label><input type="checkbox" id="voip"> VOIP Landline</label>
              <div id="portRow" class="hidden indented">
                <label><input type="checkbox" id="port"> Port existing number ($25)</label>
              </div>
          </div>
          <div class="section-box">
              <h3>Discounts</h3>
              <label><input type="checkbox" id="goldCard"> Gold Card Holder (10% off Plan)</label>
          </div>
      </div>
      <button class="printBtn" id="generatePdf">Print Quote</button>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', panelHtml);

  /* ===================== LOGIC HANDLING ===================== */
  const els = {
    custType: document.querySelector('#custType'),
    resLogic: document.querySelector('#resLogic'),
    connType: document.querySelector('#connType'),
    fibrePlans: document.querySelector('#fibrePlans'),
    wirelessPlans: document.querySelector('#wirelessPlans'),
    contractBox: document.querySelector('#contractCheck'),
    contractNote: document.querySelector('#contractNote'),
    voip: document.querySelector('#voip'),
    portRow: document.querySelector('#portRow'),
    go15: document.querySelector('#go15'),
    go15CompBox: document.querySelector('#go15CompBox'),
    go50: document.querySelector('#go50'),
    go50CompBox: document.querySelector('#go50CompBox'),
    goldCard: document.querySelector('#goldCard')
  };

  els.custType.onchange = (e) => els.resLogic.classList.toggle('hidden', e.target.value !== 'res');
  els.connType.onchange = (e) => {
    els.fibrePlans.classList.toggle('hidden', e.target.value !== 'fibre');
    els.wirelessPlans.classList.toggle('hidden', e.target.value !== 'wireless');
    updateContractRules();
  };
  els.voip.onchange = (e) => els.portRow.classList.toggle('hidden', !e.target.checked);
  els.go15.onchange = (e) => els.go15CompBox.classList.toggle('hidden', !e.target.checked);
  els.go50.onchange = (e) => els.go50CompBox.classList.toggle('hidden', !e.target.checked);

  const updateContractRules = () => {
    const bb = document.querySelector('input[name="bb"]:checked');
    if (!bb) return;
    if (bb.dataset.starter === "true") {
      els.contractBox.checked = false; els.contractBox.disabled = true;
      els.contractNote.innerText = "Starter is Open Term only.";
    } else if (bb.dataset.mates === "true") {
      els.contractBox.checked = true; els.contractBox.disabled = true;
      els.contractNote.innerText = "Mates Rates requires contract.";
    } else {
      els.contractBox.disabled = false; els.contractNote.innerText = "Uncheck for Open Term.";
    }
  };
  document.querySelectorAll('input[name="bb"]').forEach(r => r.addEventListener('change', updateContractRules));

  /* ===================== HEADER INTEGRATION ===================== */
  const injectButton = () => {
      const headerNav = document.querySelector('.splynx-header .navigation');
      if (headerNav && !document.querySelector('#quoteBtn')) {
          const btn = document.createElement('button');
          btn.id = 'quoteBtn'; btn.innerText = 'CREATE QUOTE';
          headerNav.parentNode.insertBefore(btn, headerNav);
          btn.onclick = () => document.querySelector('#quotePanel').classList.add('open');
      }
  };
  injectButton();
  new MutationObserver(injectButton).observe(document.body, { childList: true, subtree: true });
  document.querySelector('#closePanel').onclick = () => document.querySelector('#quotePanel').classList.remove('open');

  /* ===================== PDF GENERATION ===================== */
  document.querySelector('#generatePdf').onclick = async () => {
    const bb = document.querySelector('input[name="bb"]:checked');
    if (!bb) return alert('Select a broadband plan.');

    const doc = new jsPDF();
    const rightX = 196;
    let y = 15;

    const logoUrl = await GM_getResourceURL("PRIMO_LOGO");
    doc.addImage(logoUrl, 'PNG', 14, 10, 80, 0);

    doc.setFont("helvetica", "bold").setFontSize(17).setTextColor(COLORS.dark);
    doc.text('Monthly Services Quote', rightX, 20, {align:'right'});
    doc.setFontSize(11).setFont("helvetica", "normal");
    doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, rightX, 27, {align:'right'});

    y = 55;
    doc.setFont("helvetica", "bold").setFontSize(11);
    doc.text('Prepared for:', 14, y);
    doc.text('PrimoWireless Ltd', rightX, y, {align:'right'});

    doc.setFontSize(10).setFont("helvetica", "normal");
    doc.text(document.querySelector('#custName').value || 'Customer Name', 14, y+6);
    doc.text(document.querySelector('#custAddr').value || 'Customer Address', 14, y+12);

    doc.text('123 Molesworth Street, New Plymouth', rightX, y+6, {align:'right'});
    doc.text('Phone: 0800 123 774', rightX, y+12, {align:'right'});
    doc.text('GST Number: 100-738-775', rightX, y+18, {align:'right'});

    y = 90;
    doc.setFont("helvetica", "bold").setFontSize(12);
    doc.text('Description', 14, y);
    doc.text('Qty', 95, y, {align:'right'});
    doc.text('GST %', 125, y, {align:'right'});
    doc.text('Excl. Total', 160, y, {align:'right'});
    doc.text('Incl. Total', 196, y, {align:'right'});
    doc.setDrawColor(COLORS.blue).setLineWidth(0.5);
    doc.line(14, y+2, 196, y+2);
    y += 10;

    let monthlyTotal = 0;
    let oneOffTotal = 0;
    let mobileCount = 0;

    const addLineItem = (desc, price, isOneOff = false, isDiscount = false) => {
      doc.setFont("helvetica", isDiscount ? "bold" : "italic").setFontSize(11);
      if(isDiscount) doc.setTextColor(COLORS.blue); else doc.setTextColor(COLORS.dark);

      const excl = (price / 1.15).toFixed(2);
      doc.text(desc, 14, y);
      doc.text('1', 95, y, {align:'right'});
      doc.text('15.00', 125, y, {align:'right'});
      doc.text(`$${excl}`, 160, y, {align:'right'});
      doc.text(`$${price.toFixed(2)}`, 196, y, {align:'right'});

      doc.setDrawColor(230, 230, 230).setLineWidth(0.1);
      doc.line(14, y+2, 196, y+2);

      if (isOneOff) oneOffTotal += price; else monthlyTotal += price;
      y += 10;
    };

    const bbPrice = Number(bb.dataset.price);
    addLineItem(`${bb.dataset.name} Broadband`, bbPrice);

    document.querySelectorAll('.mobile:checked').forEach(m => {
        addLineItem(`${m.dataset.name} Mobile`, Number(m.dataset.price));
        mobileCount++;
        if(m.id === 'go15' || m.id === 'go50') {
            const count = parseInt(document.querySelector(`#${m.id}Comp`).value) || 0;
            for(let i=0; i<count; i++) {
                addLineItem(` - Companion Plan`, 35);
                mobileCount++;
            }
        }
    });

    if (els.voip.checked) addLineItem('VOIP Landline', (els.connType.value === 'wireless' ? 15 : 10));

    // --- DISCOUNT LOGIC ---
    let bundleDiscountAmount = 0;
    let goldCardDiscountAmount = 0;

    // Mobile bundle: $10. Logic: must have mobile AND plan allows bundle AND plan is not Mates Rates
    if (mobileCount > 0 && bb.dataset.bundle === "true" && bb.dataset.mates !== "true") {
      bundleDiscountAmount = 10;
    }

    // Gold card: 10% of BB plan. Logic: Checkbox checked AND not starter AND not mates
    if (els.goldCard.checked && bb.dataset.starter !== "true" && bb.dataset.mates !== "true") {
      goldCardDiscountAmount = bbPrice * 0.10;
    }

    // Apply the higher discount of the two
    if (goldCardDiscountAmount > 0 || bundleDiscountAmount > 0) {
      if (goldCardDiscountAmount >= bundleDiscountAmount) {
        addLineItem('Gold Card Discount (10%)', -goldCardDiscountAmount, false, true);
      } else {
        addLineItem('Bundle Discount (Mobile)', -bundleDiscountAmount, false, true);
      }
    }

    if (els.connType.value === 'wireless' && !els.contractBox.checked && bb.dataset.mates !== 'true') {
      addLineItem('Standard Installation Fee', 599, true);
    }
    if (document.querySelector('#port').checked) addLineItem('Number Porting Fee', 25, true);

    y += 5;
    doc.setDrawColor(COLORS.blue).setLineWidth(0.5);
    doc.line(110, y, 196, y);
    y += 10;
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(COLORS.dark);
    doc.text(`Total Monthly Recurring: $${monthlyTotal.toFixed(2)}`, rightX, y, {align:'right'});
    y += 4;
    doc.setDrawColor(COLORS.blue).setLineWidth(0.5);
    doc.line(110, y, 196, y);
    y += 10;
    doc.text(`Total One-Off Charges: $${oneOffTotal.toFixed(2)}`, rightX, y, {align:'right'});
    y += 4;
    doc.line(110, y, 196, y);

    y += 20;
    doc.setFont("helvetica", "bold").setFontSize(13).text('Contract and Termination Terms', 14, y);
    doc.setFontSize(11).setFont("helvetica", "normal");
    y += 8;
    const isContract = els.contractBox.checked;

    const termBase = isContract ? 'This quote is based on a 12-Month Minimum Service Term.' : 'This service is provided on an Open Term (No Contract) basis.';
    doc.text(termBase, 14, y);
    y += 6;

    let subText = "";
    if (isContract) {
      const etcVal = els.connType.value === 'fibre' ? '$149.00' : '$599.00 (or the remainder of the contract, whichever is lower)';
      subText = `Early Termination Charge (ETC): ${etcVal} applies if cancelled within the term. We also require 30-days notice for all disconnections.`;
    } else {
      subText = 'No early termination fees apply for open term connections. However, we do require 30-days notice for all disconnections.';
    }

    const wrappedSubText = doc.splitTextToSize(subText, 180);
    doc.text(wrappedSubText, 14, y);

    y = 272;
    doc.setDrawColor(COLORS.blue).setLineWidth(0.5);
    doc.line(14, y, 196, y);
    y += 10;
    doc.setFontSize(10).setFont("helvetica", "bold").setTextColor(COLORS.dark);
    doc.text('Ready to get connected? Contact us at helpdesk@primo.nz or call 0800 123 774 to proceed!', 105, y, {align:'center'});
    y += 4;
    doc.line(14, y, 196, y);

    doc.save(`Primo_Quote.pdf`);
  };
})();
