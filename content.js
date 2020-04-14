"use strict";

(function() {

    //prevents script from running twice
    if (window.hasRun) {
        return;
    }
    window.hasRun = true;

    var GLOBAL_TIMER; //the timer keeps markers updated on the screen
    var GLOBAL_RESULT_LIST = []; //after a search the results are stored here
    var GLOBAL_CURRENT_POS = -1; //-1 means next/prev have not bee clicked yet
    var GLOBAL_BUG_FIX = [];
    var GLOBAL_SEARCH_TERM = '';
    var GLOBAL_COUNT = -1; //-1 means the search hasn't happened yet
    const TIMER_INTERVAL = 100; //miliseconds to update page

    //Elements that should not have any search results
    //https://developer.mozilla.org/en-US/docs/Web/HTML/Element
    let NODE_TYPES_ALLOWED = ['HTML', 'BASE', 'HEAD', 'LINK', 'META', 'STYLE', 'TITLE', 'EMBED', 'IFRAME', 'OBJECT', 'PARAM', 'PICTURE', 'SOURCE', 'CANVAS', 'NOSCRIPT', 'SCRIPT'];
    let NODE_SET = new Set(NODE_TYPES_ALLOWED);

    //called from find.js (popup page)
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.name == "EXISTS") {
            return Promise.resolve(resultsExist());

        } else if (message.name == "BUG_FIX") {
            clearInputBug(message.searchTerm);
            return Promise.resolve({ response: 'DONE' });

        } else if (message.name == "RESTORE_BUG_FIX") {
            restoreInputBug();
            return Promise.resolve({ response: 'DONE' });

        } else if (message.name == "CREATE_MARKERS") {
            GLOBAL_SEARCH_TERM = message.settings.searchTerm;
            changeColor(message.settings.colors);
            changeOpacity(message.settings.opacity);
            changeSize(message.settings.size);
            let count = search(message.ranges);
            return Promise.resolve({ response: count });

        } else if (message.name == "CHANGE_COLOR") {
            changeColor(message.colors);

        } else if (message.name == "CHANGE_SIZE") {
            changeSize(message.size);

        } else if (message.name == "CLEAR_SCREEN") {
            clearScreen();

        } else if (message.name == "CHANGE_OPACITY") {
            changeOpacity(message.opacity);

        } else if (message.name == "NEXT_RESULT") {
            nextResult(message.index);

        } else if (message.name == "STOP_TIMER") {
            clearInterval(GLOBAL_TIMER);

        } else if (message.name == "START_TIMER") {
            //only start timer if there are actual search results
            if (GLOBAL_RESULT_LIST.length > 0) {
                clearInterval(GLOBAL_TIMER);
                GLOBAL_TIMER = setInterval(checkForChanges, TIMER_INTERVAL);
            }
        }
    });

    /**
     * When switching between tabs this retreives the results
     */
    function resultsExist() {
        return { count: GLOBAL_COUNT, current: GLOBAL_CURRENT_POS, searchTerm: GLOBAL_SEARCH_TERM };
    }

    /**
     * Scroll and highlight next result 
     */
    function nextResult(index) {
        GLOBAL_CURRENT_POS = index;
        clearInterval(GLOBAL_TIMER);
        let rect = GLOBAL_RESULT_LIST[index].range.getBoundingClientRect();
        let height = window.innerHeight / 2;
        window.scrollBy(rect.left, rect.top - height); //scroll to center of window
        updateMarkers();
        reset_animation(GLOBAL_RESULT_LIST[index].arrow);
        GLOBAL_TIMER = setInterval(checkForChanges, TIMER_INTERVAL);
    }

    /**
     * sets the value of the CSS global variables
     * page is automatically redrawn
     */
    function changeOpacity(opacity) {
        document.documentElement.style.setProperty("--hfi-opacity", (opacity / 100.0));
    }

    /**
     * sets the value of the CSS global variables.
     * page is automatically redrawn
     */
    function changeColor(colors) {
        document.documentElement.style.setProperty("--hfi-fill", colors.fill);
        document.documentElement.style.setProperty("--hfi-stroke", colors.stroke);
    }

    /**
     * calculates the size as a percentage of 250(max size)
     * .83 is the aspect ratio height to width
     * sets the value of the CSS global variables. Page style is automatically updated.
     */
    function changeSize(size) {
        let height = 250 * (size / 100.0);
        let width = height * .83;
        document.documentElement.style.setProperty("--hfi-width", width + 'px');
        document.documentElement.style.setProperty("--hfi-height", height + 'px');
    }

    /**
     * Bug Fix
     * If you try searching a page with input fields then it breaks tabs.find
     */
    function clearInputBug(searchTerm) {
        GLOBAL_BUG_FIX = [];
        let inputFields = document.querySelectorAll('input[type=text]');
        for (let i = 0; i < inputFields.length; i++) {
            if (inputFields[i].value.includes(searchTerm)) {
                GLOBAL_BUG_FIX.push({ input: inputFields[i], value: inputFields[i].value });
                inputFields[i].value = '';
            }
        }
    }

    /**
     * After Bug Fix restore values
     */
    function restoreInputBug() {
        for (let i = 0; i < GLOBAL_BUG_FIX.length; i++) {
            GLOBAL_BUG_FIX[i].input.value = GLOBAL_BUG_FIX[i].value;
        }

    }

    /**
     * uses rangeData from tabs.find to build and display arrows and underline
     * returns the result count to find.js popup
     * skips some META elements
     * skips if element has a negative position (off screen)
     */
    function search(ranges) {
        clearInterval(GLOBAL_TIMER); //stop the timer while searching
        removeMarkers(); //remove previous search results
        GLOBAL_RESULT_LIST = [];
        GLOBAL_CURRENT_POS = -1; //-1 means the user has not clicked on next or prev, 0 means first result
        GLOBAL_COUNT = 0;
        let results = document.createNodeIterator(document, NodeFilter.SHOW_TEXT);
        let FOUND_NODES = [];
        let currentNode;
        /*  Builds an array of all textNodes 
            these text nodes should line up with the rangeData returned by tabs.find
            if the textnode does not match with rangeData then we skip the result */
        while (currentNode = results.nextNode()) {
            FOUND_NODES.push(currentNode);
        }
        //loop results and place markers on screen
        for (let i = 0; i < ranges.length; i++) {
            try {
                let foundTextNodeStart = FOUND_NODES[ranges[i].startTextNodePos];
                let foundTextNodeEnd = FOUND_NODES[ranges[i].endTextNodePos];
                if (NODE_SET.has(foundTextNodeStart.parentNode.nodeName.toUpperCase())) {
                    continue; //skip meta nodes
                }
                //the range is created from inside a text node based on char start/end indexes
                let range = document.createRange();
                range.setStart(foundTextNodeStart, ranges[i].startOffset);
                range.setEnd(foundTextNodeEnd, ranges[i].endOffset);
                let rect = range.getClientRects()[0]; //grab first rect only
                let rectDoc = getOffset(rect); //convert client rect to document rect
                if (rectDoc.left < 0 || rectDoc.top < 0) {
                    continue; //skip result if the text is outside the document area
                }
                //create new dom objects
                let arrow = createArrow(rect);
                let hili = createHighlight(rect);
                //these new html elements will be added to the end of the document.body
                document.body.appendChild(arrow);
                document.body.appendChild(hili);
                //this global array will be used when traversing the search results and when updating position
                GLOBAL_RESULT_LIST.push({ rect: rect, range: range, arrow: arrow, hili: hili });
                GLOBAL_COUNT++; //the final result count can be different from tabs.find
            } catch (e) {
                console.log('skipping result do to unknown error');
            }
        }
        //sort the result list based on vertical position not horizontal
        GLOBAL_RESULT_LIST.sort(function(a, b) { return a.rect.top - b.rect.top });
        GLOBAL_TIMER = setInterval(checkForChanges, TIMER_INTERVAL); //start timer to keep results in sync with page
        forceRedraw(); //the page does not update automatically (bug?)
        return GLOBAL_COUNT; //return count back to popup page
    }

    /**
     * sometimes the page does not redraw properly, this is a temporary fix
     */
    function forceRedraw() {
        window.scrollBy(0, 1);
    }

    /**
     * anytime the user scrolls, resizes the page, or zooms we need to reposition all the markers
     */
    function checkForChanges() {
        updateMarkers();
    }


    /**
     * converts screen coord to document coords
     */
    function getOffset(rect) {
        let scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        return { top: rect.top + scrollTop, left: rect.left + scrollLeft }
    }

    /**
     * builds new dom element containing the div and svg inside the div
     * TODO: make svg external file?
     */
    function createArrow(rect) {
        let buildHTML = document.createElement("div"); //div is required so that the svg can be bottom aligned at any size
        buildHTML.className = "hfi-arrow-div huge-find-indicator";
        /* this svg created in illustrator from export selection option */
        buildHTML.innerHTML = '<svg class="hfi-arrow-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 211.98 255.83"><g id="Layer_2" data-name="Layer 2"><g id="Layer_1-2" data-name="Layer 1"><path class="hfi-arrow-path" d="M106,250.83a5,5,0,0,1-3.54-1.47l-96-96a5,5,0,0,1,0-7.07l26.08-26.07a5,5,0,0,1,7.07,0l43.24,43.24V10a5,5,0,0,1,5-5h36.87a5,5,0,0,1,5,5V162.88l42.65-42.65a5,5,0,0,1,7.07,0l26.08,26.07a5,5,0,0,1,0,7.07l-96,96A5,5,0,0,1,106,250.83Z"/><path class="hfi-arrow-path2" d="M124.72,10V175l51.19-51.18L202,149.84l-96,96-96-96,26.07-26.07,51.78,51.78V10h36.87m0-10H87.85a10,10,0,0,0-10,10V151.4L43.14,116.69a10,10,0,0,0-14.14,0L2.93,142.77a10,10,0,0,0,0,14.14l96,96a10,10,0,0,0,14.14,0l96-96a10,10,0,0,0,0-14.14L183,116.69a10,10,0,0,0-14.14,0l-34.12,34.12V10a10,10,0,0,0-10-10Z"/></g></g></svg>';
        let height = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--hfi-height'));
        let ofs = getOffset(rect);
        if (height > ofs.top) { //arrow facing up, otherwise down is default
            buildHTML.style.transform = "rotate(-180deg)";
        }
        positionArrow(buildHTML, rect);
        return buildHTML;
    }


    /**
     * The highlight was changed to a small div which looks like the text is underlined 
     */
    function createHighlight(rect) {
        let buildHTML = document.createElement("div"); //div is required so that the svg can be bottom aligned at any size
        buildHTML.className = "hfi-hili-div huge-find-indicator";
        positionHighlight(buildHTML, rect);
        return buildHTML;
    }

    /**
     * This function forces a reflow which is required to restart the animation
     * simple fadein effect to identify which arrow is active
     */
    function reset_animation(el) {
        el.style.animation = 'none';
        el.offsetHeight; /* trigger reflow */
        el.style.animation = 'hfi-fadeIn 1.0s forwards';
    }

    /**
     * helper function to position the element correctly
     */
    function positionArrow(arrow, rect) {
        if (arrow.style.transform == 'rotate(-180deg)') {
            arrow.style.left = (rect.left - 150) + 'px';
            arrow.style.top = (rect.bottom) + 'px';
        } else {
            arrow.style.left = (rect.left - 150) + 'px'; //150 is the width of the outside div 
            arrow.style.top = (rect.top - 300) + 'px'; //300 is the height of the outside div 
        }
    }

    /**
     * helper function to position the element correctly
     */
    function positionHighlight(hili, rect) {
        hili.style.left = (rect.left) + 'px';
        hili.style.top = (rect.bottom) + 'px';
        hili.style.width = (rect.right - rect.left) + 'px';
        hili.style.height = '4px';
    }

    /**
     * called every 100ms to update the position of markers on the screen
     */
    function updateMarkers() {
        for (let i = 0; i < GLOBAL_RESULT_LIST.length; i++) {
            let result = GLOBAL_RESULT_LIST[i];
            let rect = result.range.getClientRects()[0];
            if (rect) {
                positionArrow(result.arrow, rect);
                positionHighlight(result.hili, rect);
            } else {
                //if rect doesn't exist then nothing we can do
            }
        }
    }

    function removeMarkers() {
        let hideArrows = document.querySelectorAll('.huge-find-indicator');
        for (let i = 0; i < hideArrows.length; i++) {
            document.body.removeChild(hideArrows[i]);
        }
    }

    function clearScreen() {
        clearInterval(GLOBAL_TIMER); //stop timer since nothing to update
        GLOBAL_RESULT_LIST = [];
        GLOBAL_SEARCH_TERM = '';
        GLOBAL_COUNT = -1;
        GLOBAL_CURRENT_POS = -1;
        let hideArrows = document.querySelectorAll('.huge-find-indicator');
        for (let i = 0; i < hideArrows.length; i++) {
            document.body.removeChild(hideArrows[i]);
        }
        forceRedraw(); //fix because sometimes screen does not update
    }

})();