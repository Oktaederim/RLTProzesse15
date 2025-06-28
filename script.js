document.addEventListener('DOMContentLoaded', () => {

    let referenceState = null;
    let currentTotalCost = 0;
    let currentPowers = { waerme: 0, kaelte: 0 };

    const dom = {
        tempAussen: document.getElementById('tempAussen'), rhAussen: document.getElementById('rhAussen'),
        tempZuluft: document.getElementById('tempZuluft'), rhZuluft: document.getElementById('rhZuluft'),
        volumenstrom: document.getElementById('volumenstrom'),
        kuehlerAktiv: document.getElementById('kuehlerAktiv'),
        druck: document.getElementById('druck'),
        resetBtn: document.getElementById('resetBtn'), preisWaerme: document.getElementById('preisWaerme'),
        preisStrom: document.getElementById('preisStrom'),
        volumenstromSlider: document.getElementById('volumenstromSlider'), tempZuluftSlider: document.getElementById('tempZuluftSlider'),
        rhZuluftSlider: document.getElementById('rhZuluftSlider'), volumenstromLabel: document.getElementById('volumenstromLabel'),
        tempZuluftLabel: document.getElementById('tempZuluftLabel'), rhZuluftLabel: document.getElementById('rhZuluftLabel'),
        resetSlidersBtn: document.getElementById('resetSlidersBtn'),
        processOverviewContainer: document.getElementById('process-overview-container'),
        nodes: [document.getElementById('node-0'), document.getElementById('node-1'), document.getElementById('node-2'), document.getElementById('node-3'), document.getElementById('node-final')],
        compVE: { node: document.getElementById('comp-ve'), p: document.getElementById('res-p-ve'), wv: document.getElementById('res-wv-ve') },
        compK: { node: document.getElementById('comp-k'), p: document.getElementById('res-p-k'), kondensat: document.getElementById('res-kondensat'), wv: document.getElementById('res-wv-k') },
        compNE: { node: document.getElementById('comp-ne'), p: document.getElementById('res-p-ne'), wv: document.getElementById('res-wv-ne') },
        summaryContainer: document.getElementById('summary-container'),
        referenceDetails: document.getElementById('reference-details'),
        kostenReferenz: document.getElementById('kostenReferenz'),
        kostenAenderung: document.getElementById('kostenAenderung'), tempAenderung: document.getElementById('tempAenderung'),
        rhAenderung: document.getElementById('rhAenderung'), volumenAenderung: document.getElementById('volumenAenderung'),
        gesamtleistungWaerme: document.getElementById('gesamtleistungWaerme'), gesamtleistungKaelte: document.getElementById('gesamtleistungKaelte'),
        kostenHeizung: document.getElementById('kostenHeizung'), kostenKuehlung: document.getElementById('kostenKuehlung'),
        kostenGesamt: document.getElementById('kostenGesamt'), setReferenceBtn: document.getElementById('setReferenceBtn'),
        kuehlmodusInputs: document.querySelectorAll('input[name="kuehlmodus"]'), kuehlmodusWrapper: document.getElementById('kuehlmodusWrapper'),
        sollFeuchteWrapper: document.getElementById('sollFeuchteWrapper'),
        tempHeizVorlauf: document.getElementById('tempHeizVorlauf'), tempHeizRuecklauf: document.getElementById('tempHeizRuecklauf'),
        tempKuehlVorlauf: document.getElementById('tempKuehlVorlauf'), tempKuehlRuecklauf: document.getElementById('tempKuehlRuecklauf'),
        preisKaelte: document.getElementById('preisKaelte'),
        stundenHeizen: document.getElementById('stundenHeizen'), stundenKuehlen: document.getElementById('stundenKuehlen'),
        jahreskostenWaerme: document.getElementById('jahreskostenWaerme'),
        jahreskostenKaelte: document.getElementById('jahreskostenKaelte'),
        jahreskostenGesamt: document.getElementById('jahreskostenGesamt'),
        jahresverbrauchWaerme: document.getElementById('jahresverbrauchWaerme'),
        jahresverbrauchKaelte: document.getElementById('jahresverbrauchKaelte'),
        jahresverbrauchVentilator: document.getElementById('jahresverbrauchVentilator'),
        sfp: document.getElementById('sfp'),
        betriebsstundenGesamt: document.getElementById('betriebsstundenGesamt'),
        betriebstageGesamt: document.getElementById('betriebstageGesamt'),
        kostenVentilator: document.getElementById('kostenVentilator'),
        jahreskostenVentilator: document.getElementById('jahreskostenVentilator'),
        fanCostDisplays: document.querySelectorAll('.fan-cost-display'),
        leistungVentilator: document.getElementById('leistungVentilator'),
    };
    
    const allInteractiveElements = document.querySelectorAll('input, select');
    storeInitialValues(); 

    const TOLERANCE = 0.01; const CP_WASSER = 4.186; const RHO_WASSER = 1000;
    const MIN_DEW_POINT = 0.5; 

    function getPs(T) { if (T >= 0) return 611.2 * Math.exp((17.62 * T) / (243.12 + T)); else return 611.2 * Math.exp((22.46 * T) / (272.62 + T)); }
    function getX(T, rH, p) { if (p <= 0) return Infinity; const p_s = getPs(T); const p_v = (rH / 100) * p_s; if (p_v >= p) return Infinity; return 622 * (p_v / (p - p_v)); }
    function getRh(T, x, p) { if (p <= 0) return 0; const p_s = getPs(T); if (p_s <= 0) return 0; const p_v = (p * x) / (622 + x); return Math.min(100, (p_v / p_s) * 100); }
    function getTd(x, p) { const p_v = (p * x) / (622 + x); if (p_v < 611.2) return -60; const log_pv_ratio = Math.log(p_v / 611.2); return (243.12 * log_pv_ratio) / (17.62 - log_pv_ratio); }
    function getH(T, x_g_kg) { if (!isFinite(x_g_kg)) return Infinity; const x_kg_kg = x_g_kg / 1000.0; return 1.006 * T + x_kg_kg * (2501 + 1.86 * T); }

    function enforceLimits(el) {
        if (!el || el.type !== 'number' || !el.hasAttribute('min')) return;
        const value = parseFloat(el.value);
        const min = parseFloat(el.min);
        const max = parseFloat(el.max);
        if (!isNaN(value)) {
            if (value < min) el.value = min;
            if (value > max) el.value = max;
        }
    }

    function calculateAll() {
        try {
            const checkedKuehlmodus = document.querySelector('input[name="kuehlmodus"]:checked');
            const inputs = {
                tempAussen: parseFloat(dom.tempAussen.value) || 0, rhAussen: parseFloat(dom.rhAussen.value) || 0,
                tempZuluft: parseFloat(dom.tempZuluft.value) || 0, rhZuluft: parseFloat(dom.rhZuluft.value) || 0,
                volumenstrom: parseFloat(dom.volumenstrom.value) || 0,
                kuehlerAktiv: dom.kuehlerAktiv.checked, tempVorerhitzerSoll: 5.0,
                druck: (parseFloat(dom.druck.value) || 1013.25) * 100,
                preisWaerme: parseFloat(dom.preisWaerme.value) || 0, preisStrom: parseFloat(dom.preisStrom.value) || 0,
                kuehlmodus: checkedKuehlmodus ? checkedKuehlmodus.value : 'dehumidify',
                tempHeizVorlauf: parseFloat(dom.tempHeizVorlauf.value) || 0, tempHeizRuecklauf: parseFloat(dom.tempHeizRuecklauf.value) || 0,
                tempKuehlVorlauf: parseFloat(dom.tempKuehlVorlauf.value) || 0, tempKuehlRuecklauf: parseFloat(dom.tempKuehlRuecklauf.value) || 0,
                preisKaelte: parseFloat(dom.preisKaelte.value) || 0,
                stundenHeizen: parseFloat(dom.stundenHeizen.value) || 0,
                stundenKuehlen: parseFloat(dom.stundenKuehlen.value) || 0,
                sfp: parseFloat(dom.sfp.value) || 0,
                betriebsstundenGesamt: parseFloat(dom.betriebsstundenGesamt.value) || 0,
            };

            const aussen = { t: inputs.tempAussen, rh: inputs.rhAussen, x: getX(inputs.tempAussen, inputs.rhAussen, inputs.druck) };
            if (!isFinite(aussen.x)) { dom.processOverviewContainer.innerHTML = `<div class="process-overview process-error">Fehler im Außenluft-Zustand.</div>`; return; }
            aussen.h = getH(aussen.t, aussen.x);
            dom.processOverviewContainer.innerHTML = ''; 

            const massenstrom_kg_s = (inputs.volumenstrom / 3600) * 1.2;
            const zuluftSoll = { t: inputs.tempZuluft };
            if (inputs.kuehlerAktiv && inputs.kuehlmodus === 'dehumidify') {
                 zuluftSoll.rh = inputs.rhZuluft;
                 zuluftSoll.x = getX(zuluftSoll.t, zuluftSoll.rh, inputs.druck); 
                 const zielTaupunkt = getTd(zuluftSoll.x, inputs.druck);
                 
                 if (zielTaupunkt < inputs.tempKuehlVorlauf + 2.0) {
                    const errorMsg = `Plausibilitätsfehler: Kühlwassertemperatur (${formatGerman(inputs.tempKuehlVorlauf, 1)}°C) ist zu hoch, um Luft auf den erforderlichen Taupunkt von ${formatGerman(zielTaupunkt, 1)}°C abzukühlen.`;
                    dom.processOverviewContainer.innerHTML = `<div class="process-overview process-error">${errorMsg}</div>`;
                    return;
                 }
                 if (zielTaupunkt < MIN_DEW_POINT) {
                     dom.processOverviewContainer.innerHTML = `<div class="process-overview process-error">Warnung: Feuchte-Sollwert erfordert Abkühlung unter ${MIN_DEW_POINT}°C.</div>`;
                     return;
                 }
            } else {
                zuluftSoll.x = aussen.x;
                zuluftSoll.rh = getRh(zuluftSoll.t, zuluftSoll.x, inputs.druck);
            }
            zuluftSoll.h = getH(zuluftSoll.t, zuluftSoll.x);

            let states = [aussen, {...aussen}, {...aussen}, {...aussen}];
            let operations = { ve: {p:0, wv:0}, k: {p:0, kondensat:0, wv:0}, ne: {p:0, wv:0} };
            
            let currentState = states[0];
            if (currentState.t < inputs.tempVorerhitzerSoll) {
                const hNach = getH(inputs.tempVorerhitzerSoll, currentState.x);
                operations.ve.p = massenstrom_kg_s * (hNach - currentState.h);
                currentState = {t: inputs.tempVorerhitzerSoll, h: hNach, x: currentState.x, rh: getRh(inputs.tempVorerhitzerSoll, currentState.x, inputs.druck)};
            }
            states[1] = { ...currentState };
            
            if (inputs.kuehlerAktiv && currentState.t > zuluftSoll.t + TOLERANCE) {
                if (inputs.kuehlmodus === 'dehumidify' && currentState.x > zuluftSoll.x + TOLERANCE) {
                    const tempNachKuehler = getTd(zuluftSoll.x, inputs.druck);
                    const hNachKuehler = getH(tempNachKuehler, zuluftSoll.x);
                    operations.k.p = massenstrom_kg_s * (currentState.h - hNachKuehler);
                    operations.k.kondensat = massenstrom_kg_s * (currentState.x - zuluftSoll.x) / 1000 * 3600;
                    currentState = { t: tempNachKuehler, h: hNachKuehler, x: zuluftSoll.x, rh: getRh(tempNachKuehler, zuluftSoll.x, inputs.druck) };
                } else if (inputs.kuehlmodus === 'sensible') {
                    const startDewPoint = getTd(currentState.x, inputs.druck);
                    if (zuluftSoll.t < startDewPoint) {
                        const x_final = getX(zuluftSoll.t, 100, inputs.druck);
                        const h_final = getH(zuluftSoll.t, x_final);
                        operations.k.p = massenstrom_kg_s * (currentState.h - h_final);
                        operations.k.kondensat = massenstrom_kg_s * (currentState.x - x_final) / 1000 * 3600;
                        currentState = { t: zuluftSoll.t, h: h_final, x: x_final, rh: getRh(zuluftSoll.t, x_final, inputs.druck) };
                    } else {
                        const h_final = getH(zuluftSoll.t, currentState.x);
                        operations.k.p = massenstrom_kg_s * (currentState.h - h_final);
                        currentState = { t: zuluftSoll.t, h: h_final, x: currentState.x, rh: getRh(zuluftSoll.t, currentState.x, inputs.druck)};
                    }
                }
            }
            states[2] = { ...currentState };

            if (currentState.t < zuluftSoll.t - TOLERANCE) {
                const h_final = getH(zuluftSoll.t, currentState.x);
                operations.ne.p = massenstrom_kg_s * (h_final - currentState.h);
                currentState = { t: zuluftSoll.t, rh: getRh(zuluftSoll.t, currentState.x, inputs.druck), x: currentState.x, h: h_final };
            }
            states[3] = { ...currentState };

            const deltaT_heiz = Math.abs(inputs.tempHeizVorlauf - inputs.tempHeizRuecklauf);
            if (deltaT_heiz > 0) {
                operations.ve.wv = (operations.ve.p / (RHO_WASSER * CP_WASSER * deltaT_heiz)) * 3600;
                operations.ne.wv = (operations.ne.p / (RHO_WASSER * CP_WASSER * deltaT_heiz)) * 3600;
            }
            const deltaT_kuehl = Math.abs(inputs.tempKuehlRuecklauf - inputs.tempKuehlVorlauf);
            if (deltaT_kuehl > 0) operations.k.wv = (operations.k.p / (RHO_WASSER * CP_WASSER * deltaT_kuehl)) * 3600;
            
            currentPowers.waerme = operations.ve.p + operations.ne.p;
            currentPowers.kaelte = operations.k.p;
            
            renderAll(states, operations, inputs);
        } catch (error) {
            console.error("Ein Fehler ist in calculateAll aufgetreten:", error);
            dom.processOverviewContainer.innerHTML = `<div class="process-overview process-error">Ein unerwarteter Fehler ist aufgetreten.</div>`;
        }
    }
