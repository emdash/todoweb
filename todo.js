todolist = (function () {


var get = function(id) {
    return document.getElementById(id);
}

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
	var entry = el("textarea");
	var text = t("");

	item.appendChild(entry);

	entry.type = "text";
	entry.className = "listItem";

	item.value = function () {
	    return entry.value;
	}

	item.focus = function () {
	    entry.focus();
	}

	entry.onfocus = function () {
	    ret.select(item);
	}

	return item;
    };

    ret.select = function (item) {
	selected = item;
    }
    
    ret.add = function () {
	var item = listItem();
	ret.appendChild(item);
	item.focus();

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
    }

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
mobileScrollFix(get("list"));

newBtn.onclick = function () {
    list.add();
};

dropBtn.onclick = function () {
    list.remove();
}

})();