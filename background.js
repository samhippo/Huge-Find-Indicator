"use strict";

var SAVED_SEARCH_TERM = ''; //the only data saved in the background script is the search term
/**
 * Called from find.js (popup page)
 */
async function notify(request, sender, sendResponse) {
    if (request.name == "LOAD") {
        return Promise.resolve(SAVED_SEARCH_TERM); //retrieves temporary data when the popup is opened

    } else if (request.name == "SAVE_INPUT_TEXT") {
        SAVED_SEARCH_TERM = request.value; //search term is saved as the user types

    } else if (request.name == "SAVE_CLEAR") {
        SAVED_SEARCH_TERM = '';

    }
}

function reportError(error) {
    console.error(`report error background.js: ${error}`);
}

/**
 * Called whenever the active tab changes
 * this is used to stop any unecessary timers to free up resources
 * it also forces the popup page to close, normally this happens anyways but not with hotkeys
 */
function tabChanged(activeInfo) {
    if (activeInfo.previousTabId) {
        browser.tabs.sendMessage(activeInfo.previousTabId, { name: "STOP_TIMER" }).catch(reportError);
    }
    if (activeInfo.tabId) {
        browser.tabs.sendMessage(activeInfo.tabId, { name: "START_TIMER" }).catch(reportError);
    }
    browser.runtime.sendMessage({ "name": "CLOSE" }).catch(reportError);
}

/**
 * Not needed
 */
async function tabUpdated(tabId, changeInfo, tabInfo) {

    if (changeInfo.status == 'complete') {

    }
}

browser.runtime.onMessage.addListener(notify);
browser.tabs.onActivated.addListener(tabChanged);
browser.tabs.onUpdated.addListener(tabUpdated);