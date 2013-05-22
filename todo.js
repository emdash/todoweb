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
	var entry = el("input");
	var text = t("new item");
	var focused = false;

	item.appendChild(text);

	entry.type = "text";
	entry.className = "listItem";

	item.value = function () {
	    return entry.value;
	};

	item.onclick = function () {
	    if (item === selected) {
		item.focus();
	    } else {
		ret.select(item);
	    }
	};

	item.focus = function () {
	    if (focused) {
		return;
	    }
	    focused = true;
	    entry.value = text.data;
	    item.appendChild(entry);
	    item.removeChild(text);
	    entry.focus();
	};

	item.blur = function () {
	    if (focused) {
		entry.onblur();
	    }
	};

	entry.onblur = function () {
	    if (!focused) {
		return;
	    }
	    focused = false;
	    item.removeChild(entry);
	    item.appendChild((text = t(entry.value)));
	};

	return item;
    };

    ret.select = function (item) {
	if (selected) {
	    selected.className = "listItem";
	    selected.blur();
	}
	selected = item;
	selected.className = "listItem selected";
    };

    ret.add = function () {
	var item = listItem();
	ret.appendChild(item);
	ret.select(item);
    };

    ret.getItems = function () {
	var items = [];
	for (i = ret.firstChild; i; i = i.nextSibling) {
	    items.push(i.value());
	}

	return items;
    };

    ret.remove = function () {
	if (selected) {
	    ret.removeChild(selected);
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