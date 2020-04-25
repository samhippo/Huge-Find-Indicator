"use strict";

/**
 * this file runs everytime the popup opens
 * the background.js file is used to store data between closing and reopening the popup
 */

var GLOBAL_RESULT_COUNT = -1; //the total result count, -1 means the search hasn't happened yet
var GLOBAL_RESULT_CURRENT = 0;
var GLOBAL_TAB_ID; //everytime this popup opens we reset the current tab ID here
var GLOBAL_SEARCH_TERM = '';



/* ================================== Loading ==================================================================== */

/**
 * Retreive the current tab ID and loading any saved settings
 */
browser.tabs.query({ currentWindow: true, active: true }).then((t) => {
    GLOBAL_TAB_ID = t[0].id;
    loadSavedResults(GLOBAL_TAB_ID);
}).catch(reportError);


/**
 * When switching to a tab that has previous search results (count, current, search term)
 */
async function loadSavedResults(tabId) {
    let exists = await browser.tabs.sendMessage(tabId, { name: "EXISTS" }).catch(reportError);
    if (exists) {
        GLOBAL_RESULT_COUNT = exists.count;
        GLOBAL_RESULT_CURRENT = exists.current;
        GLOBAL_SEARCH_TERM = exists.searchTerm;
        document.getElementById('id-find-input').value = exists.searchTerm;
    } else {
        GLOBAL_RESULT_COUNT = -1;
        GLOBAL_RESULT_CURRENT = 0;
        GLOBAL_SEARCH_TERM = '';
        document.getElementById('id-find-input').value = '';
    }
    //if search term doesn't exist in content.js then try to load from background.js
    if (document.getElementById('id-find-input').value == '') {
        browser.runtime.sendMessage({ "name": "LOAD" }).then((response) => {
            document.getElementById('id-find-input').value = response;
            GLOBAL_SEARCH_TERM = response;
        }).catch(reportError);
    }
    setResultText();
}


/**
 * load saved settings
 * If no settings exist then load defaults.
 */
browser.storage.local.get(["color", "size", "opacity"]).then(loadStorage, reportError);

function loadStorage(items) {
    if (items.size)
        document.getElementById("sizeRange").value = items.size;
    if (items.opacity)
        document.getElementById("opacityRange").value = items.opacity;
    if (items.color)
        setColor(document.getElementById(items.color));
}


/* ================================== Event Listeners ==================================================================== */

/**
 * Listen for notifications from content.js or background.js
 */
browser.runtime.onMessage.addListener(notify);

/**
 * Mouse Click: Find button
 */
document.getElementById('id-button-find').addEventListener("click", findClick);

/**
 * Mouse Click: Clear button
 */
document.getElementById('id-clear-screen').addEventListener("click", clearClick);

/**
 * Mouse Click: Next/Prev Button
 */
document.getElementById('id-next').addEventListener("click", nextClick);
document.getElementById('id-prev').addEventListener("click", prevClick);

/**
 * Mouse Click: Color button
 */
document.querySelectorAll('.options-color').forEach((item) => {
    item.addEventListener("click", colorClick);
});

/**
 * Change Event: Opacity slider
 */
document.getElementById('opacityRange').addEventListener("input", function(event) {
    browser.storage.local.set({ opacity: this.value }).catch(reportError);
    browser.tabs.sendMessage(GLOBAL_TAB_ID, { name: "CHANGE_OPACITY", opacity: this.value }).catch(reportError);
});

/**
 * Change Event: Size slider
 */
document.getElementById('sizeRange').addEventListener("input", function(event) {
    browser.storage.local.set({ size: this.value }).catch(reportError);
    browser.tabs.sendMessage(GLOBAL_TAB_ID, { name: "CHANGE_SIZE", size: this.value }).catch(reportError);
});

/**
 * Enter key
 */
// document.getElementById('id-find-input').addEventListener("keyup", function(event) {
//     if (event.key === "Enter") {
//         event.preventDefault();
//         if (document.getElementById('id-find-input').value != GLOBAL_SEARCH_TERM)
//             document.getElementById('id-button-find').click();
//         else
//             document.getElementById('id-next').click();
//     }
// });


document.addEventListener("keyup", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        if (document.getElementById('id-find-input').value != GLOBAL_SEARCH_TERM)
            document.getElementById('id-button-find').click();
        else
            document.getElementById('id-next').click();
    }
});

/**
 * Search field
 * temporarily save the value of the Find field so that it's not lost when we close/reopen the tab
 */
// document.getElementById('id-find-input').addEventListener("input", function(event) {
//     browser.runtime.sendMessage({ "name": "SAVE_INPUT_TEXT", "value": this.value, "tabId": GLOBAL_TAB_ID }).catch(reportError);
// });





/* ================================== Event Functions ==================================================================== */

async function notify(request, sender, sendResponse) {
    //when switching tabs we need to make sure the popup closes
    if (request.name == "CLOSE") {
        window.close();
    }
}

function colorClick(event) {
    setColor(event.currentTarget);
    browser.storage.local.set({ color: event.currentTarget.id });
    browser.tabs.sendMessage(GLOBAL_TAB_ID, {
        name: "CHANGE_COLOR",
        colors: {
            fill: window.getComputedStyle(event.currentTarget, null).getPropertyValue("background-color"),
            stroke: window.getComputedStyle(event.currentTarget, null).getPropertyValue("border-left-color")
        }
    });
}

/**
 * Selects/Activates a Color button
 */
function setColor(element) {
    document.querySelectorAll('.options-color.selected').forEach((item) => {
        item.classList.remove("selected");
    });
    element.classList.add("selected");
}

function clearClick(event) {
    hideLoadingIcon();
    document.getElementById('id-find-input').value = '';
    GLOBAL_RESULT_COUNT = -1;
    GLOBAL_RESULT_CURRENT = 0;
    GLOBAL_SEARCH_TERM = '';
    document.getElementById('id-results').innerText = '';
    browser.tabs.sendMessage(GLOBAL_TAB_ID, { name: "CLEAR_SCREEN" }).catch(reportError);
    browser.runtime.sendMessage({ "name": "SAVE_CLEAR", "tabId": GLOBAL_TAB_ID }).catch(reportError);
}


function nextClick(event) {
    if (GLOBAL_RESULT_COUNT <= 0) {
        return;
    } else {
        GLOBAL_RESULT_CURRENT++;
        if (GLOBAL_RESULT_CURRENT >= GLOBAL_RESULT_COUNT)
            GLOBAL_RESULT_CURRENT = 0;
        browser.runtime.sendMessage({ "name": "SAVE_RESULT_CURRENT", "current": GLOBAL_RESULT_CURRENT, "tabId": GLOBAL_TAB_ID }).catch(reportError);
        setResultText();
        browser.tabs.sendMessage(GLOBAL_TAB_ID, { name: "NEXT_RESULT", index: GLOBAL_RESULT_CURRENT }).catch(reportError);
    }
}

function prevClick(event) {
    if (GLOBAL_RESULT_COUNT <= 0) {
        return;
    } else {
        GLOBAL_RESULT_CURRENT--;
        if (GLOBAL_RESULT_CURRENT < 0)
            GLOBAL_RESULT_CURRENT = (GLOBAL_RESULT_COUNT - 1);
        browser.runtime.sendMessage({ "name": "SAVE_RESULT_CURRENT", "current": GLOBAL_RESULT_CURRENT, "tabId": GLOBAL_TAB_ID }).catch(reportError);
        setResultText();
        browser.tabs.sendMessage(GLOBAL_TAB_ID, { name: "NEXT_RESULT", index: GLOBAL_RESULT_CURRENT }).catch(reportError);
    }
}


async function findClick(event) {
    let searchTerm = document.getElementById('id-find-input').value;
    GLOBAL_RESULT_CURRENT = 0;
    if (searchTerm.length == 0 || searchTerm.trim().length == 0) {
        clearClick();
    } else {
        showLoadingIcon();
        GLOBAL_SEARCH_TERM = searchTerm;
        browser.runtime.sendMessage({ "name": "SAVE_INPUT_TEXT", "value": searchTerm, "tabId": GLOBAL_TAB_ID }).catch(reportError);
        //bug fix: input fields need to be cleard before searching
        await browser.tabs.sendMessage(GLOBAL_TAB_ID, { name: "BUG_FIX", searchTerm: searchTerm }).catch(reportError);
        let results = await browser.find.find(searchTerm, { includeRangeData: true }).catch(reportError);
        await browser.tabs.sendMessage(GLOBAL_TAB_ID, { name: "RESTORE_BUG_FIX" }).catch(reportError);
        //end bug fix
        let settings = getSettings();
        //send results to content.js to create markers and update the page
        browser.tabs.sendMessage(GLOBAL_TAB_ID, { ranges: results.rangeData, name: "CREATE_MARKERS", settings: settings }).then((message) => {
            hideLoadingIcon();
            GLOBAL_RESULT_COUNT = message.response;
            setResultText();
        }).catch(reportError);
    }
}


/* ================================== Misc Functions ==================================================================== */

function getSettings() {
    let el = document.querySelector('.options-color.selected');
    let colors = {
        fill: window.getComputedStyle(el, null).getPropertyValue("background-color"),
        stroke: window.getComputedStyle(el, null).getPropertyValue("border-left-color")
    }
    let opacity = document.getElementById('opacityRange').value;
    let size = document.getElementById('sizeRange').value;
    let searchTerm = document.getElementById('id-find-input').value;
    return { colors: colors, opacity: opacity, size: size, searchTerm: searchTerm };
}

function showLoadingIcon() {
    document.getElementById('id-results').style.display = 'none';
    document.getElementById('loading-icon').style.display = 'flex';
}

function hideLoadingIcon() {
    document.getElementById('id-results').style.display = 'initial';
    document.getElementById('loading-icon').style.display = 'none';
}

function setResultText() {
    if (GLOBAL_RESULT_COUNT == -1) {
        document.getElementById('id-results').innerText = '';
    } else if (GLOBAL_RESULT_COUNT > 0) {
        document.getElementById('id-results').innerText = (GLOBAL_RESULT_CURRENT + 1) + ' of ' + GLOBAL_RESULT_COUNT;
    } else if (GLOBAL_RESULT_COUNT == 0) {
        document.getElementById('id-results').innerText = 'No Results';
    }
}

function reportError(error) {
    console.error(`reportError: ${error}`);
}


/* ================================== Insert Content into Current tab ==================================================================== */

/**
 * insertCSS
 */
browser.tabs.insertCSS({ file: "/content.css" }).catch(reportError);

/**
 * NOTE: there is a check inside content.js that prevents the script from running twice in the same tab
 */
browser.tabs.executeScript({ file: "/content.js" }).catch(reportError);

//browser.storage.local.clear();