"use strict";

var SAVED_SEARCH_TERM = '';
/**
 * Called from find.js (popup page)
 */
async function notify(request, sender, sendResponse) {
    //retrieves temporary data when the popup is opened
    if (request.name == "LOAD") {
        return Promise.resolve(SAVED_SEARCH_TERM);
    } else if (request.name == "SAVE_INPUT_TEXT") {
        SAVED_SEARCH_TERM = request.value;
    } else if (request.name == "SAVE_CLEAR") {
        SAVED_SEARCH_TERM = '';
    }
}

function reportError(error) {
    console.error(`report error background.js: ${error}`);
}

browser.runtime.onMessage.addListener(notify);

/**
 * Called whenever the active tab changes
 * this is used to stop any unecessary timers to free up resources
 * it also forces the popup page to close, normally this happens anyways but not with hotkeys
 */
function tabChanged(activeInfo) {

    if (typeof activeInfo.previousTabId !== 'undefined') {
        browser.tabs.sendMessage(activeInfo.previousTabId, { name: "STOP_TIMER" }).catch(reportError);
        // console.log('stopping timer');
    }
    browser.runtime.sendMessage({ "name": "CLOSE" }).catch(reportError);
    browser.tabs.sendMessage(activeInfo.tabId, { name: "START_TIMER" }).catch(reportError);
    // console.log('starting timer');
}

browser.tabs.onActivated.addListener(tabChanged);


/**
 * Called everytime something changes in a tab
 */
async function tabUpdated(tabId, changeInfo, tabInfo) {

    if (changeInfo.status == 'complete') {

    }
}

browser.tabs.onUpdated.addListener(tabUpdated);