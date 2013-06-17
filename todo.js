todolist = (function () {
"use strict";

var get = function(id) {
    return document.getElementById(id);
};

function el(tag) {
    var ret = document.createElement(tag);
    var i;

    for (i = 1; i < arguments.length; i++) {
	ret.appendChild(arguments[i]);
    }

    return ret;
}

function t(text) {
    return document.createTextNode(text);
}


function editableList() {
    var ret = el("div");
    var selected;

    function listItem() {
	var item = el("div");
	var text = t("");

	item.appendChild(text);
	item.contentEditable = "true";
	item.className = "listItem";

	item.onclick = function () {
	    ret.select(item);
	};

	item.onkeypress = function (evt) {
	    switch (evt.keyCode) {
	    case 13:
		ret.add();
		evt.preventDefault();
		break;
	    case 40:
		if (selected && selected.nextSibling) {
		    ret.select(selected.nextSibling);
		}
 		break;
	    case 38:
		if (selected && selected.prevSibling) {
		    ret.selected(selected.prevSibling);
		}
		break;

	    };
	};

	return item;
    };

    ret.select = function (item) {
	selected = item;
	document.getSelection().selectAllChildren(item);
    };

    ret.add = function () {
	var item = listItem();
	if (selected) {
	    ret.insertBefore(item, selected.nextSibling);
	} else {
	    ret.appendChild(item);
	}
	ret.select(item);
	item.focus();
    };

    ret.remove = function () {
	var next = selected ?
	    (selected.nextSibling || selected.previousSibling) :
	    null;

	if (selected) {
	    ret.removeChild(selected);
	    if (next) {
		ret.select(next);
	    }
	}
    };

    return ret;
}

function isTouchDevice(){
    try {
	document.createEvent("TouchEvent");
	return true;
    } catch(e) {
	return false;
    }
}

function mobileScrollFix(element) {
    var scrollStartPos = 0;

    function touchstart(event) {
	scrollStartPos = this.scrollTop + event.touches[0].pageY;
	//event.preventDefault();
    }

    function touchmove(event) {
	this.scrollTop = scrollStartPos - event.touches[0].pageY;
	event.preventDefault();
    }

    if (isTouchDevice()) {
	element.ontouchstart = touchstart;
	element.ontouchmove = touchmove;
    }
}

var doneBtn = get("done");
var dropBtn = get("drop");
var newBtn = get("new");
var list = editableList();
get("list").appendChild(list);
mobileScrollFix(get("screen"));

newBtn.onclick = function () {
    list.add();
};

dropBtn.onclick = function () {
    list.remove();
};

})();