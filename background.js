"use strict";

var SAVED_SEARCH_TERM = '';

async function notify(request, sender, sendResponse) {
    if (request.name == "LOAD") {
        //returns saved data to popup page
        return Promise.resolve(SAVED_SEARCH_TERM);
    } else if (request.name == "SAVE_INPUT_TEXT") {
        //search term is saved as the user types
        SAVED_SEARCH_TERM = request.value;
    } else if (request.name == "SAVE_CLEAR") {
        SAVED_SEARCH_TERM = '';
    }
}

function reportError(error) {
    console.error(`report error background.js: ${error}`);
}

function tabChanged(activeInfo) {
    if (activeInfo.previousTabId) {
        //if previous tab exists then try to stop the timer
        browser.tabs.sendMessage(activeInfo.previousTabId, { name: "STOP_TIMER" }).catch(reportError);
    }
    if (activeInfo.tabId) {
        //try to activate timer if it exists
        browser.tabs.sendMessage(activeInfo.tabId, { name: "START_TIMER" }).catch(reportError);
    }
    //close popup if it's open
    browser.runtime.sendMessage({ "name": "CLOSE" }).catch(reportError);
}

/**
 * Not needed
 */
async function tabUpdated(tabId, changeInfo, tabInfo) {
    if (changeInfo.status == 'complete') {}
}

browser.runtime.onMessage.addListener(notify);
browser.tabs.onActivated.addListener(tabChanged);
browser.tabs.onUpdated.addListener(tabUpdated);