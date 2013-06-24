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

function request(method, uri, closure) {
    var req = new XMLHttpRequest();

    req.onreadystatechange = function () {
	if (req.readyState == 4) {
	    closure(req.responseText);
	}
    };

    req.open(method, uri, true,
	     login.value,
	     password.value);

    req.send();
}


function editableList(model) {
    var ret = el("div");
    var items = [];
    var selected;

    function listItem() {
	var item = el("div");
	var content;

	item.contentEditable = "true";
	item.className = "listItem";

	item.onkeypress = function (evt) {
	    switch (evt.keyCode) {
	    case 13:
		model.insert(items.indexOf(item) + 1);
		evt.preventDefault();
		break;
	    };
	};

	item.onfocus = function (evt) {
	    selected = item;
	    content = item.innerHTML;
	    setTimeout(
		function () {
		    document.getSelection().selectAllChildren(item);
		}, 1);
	};

	item.onblur = function (evt) {
	    if (item.innerHTML === content) {
		return;
	    }
	    item.contentEditable = false;
	    model.update (items.indexOf(item), item.innerHTML);
	};

	return item;
    };

    model.itemAdded = function (index, content) {
	var item = listItem();
	item.innerHTML = content;
	ret.insertBefore(item, items[index]);
	items.splice(index, 0, item);
	item.focus();
    };

    model.itemChanged = function (index, content) {
	var item = items[index];
	item.innerHTML = content;
	item.contentEditable = true;
    };

    model.itemRemoved = function (index) {
	var item = items[index];
	items.splice(index, 1);
	if (item === selected) {
	    ((item.nextSibling)
	     || (item.previousSibling)
	     || el("unused")).focus();
	}
	ret.removeChild(item);
    };

    ret.append = function () {
	model.insert(items.indexOf(selected) + 1);
    };

    ret.remove = function () {
	if (items.length) {
	    model.remove(items.indexOf(selected));
	}
    };

    return ret;
}


function listModel(defaultItem) {
    var items = [];
    var ret = {};

    ret.itemChanged = function () {};
    ret.itemAdded = function () {};
    ret.itemRemoved = function () {};

    ret.forEach = function (closure) {
	items.forEach(closure);
    };

    ret.getItem = function (i) {
	return items[i];
    };

    ret.getLength = function () {
	return items.length;
    };

    ret.update = function (index, item) {
	items[index] = item || defaultItem;
	// simulate network roundtrip
	setTimeout(function () {
		       ret.itemChanged(index, item);
		   }, 3000);
    };

    ret.insert = function(index, item) {
	var content = item || defaultItem;
	items.splice(index, 0, content);
	ret.itemAdded(index, content);
    };

    ret.append = function(item) {
	ret.insert(items.length, item);
    };

    ret.remove = function (index) {
	items.splice(index, 1);
	ret.itemRemoved (index);
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
var loginBtn = get("doLogin");
var loginView = get("loginView");
var listView = get("listView");
var managerView = get("managerView");
var lm = listModel("New Item");
var list = editableList(lm);
var login = get("login");
var password = get("password");

get("list").appendChild(list);
mobileScrollFix(get("screen"));

loginBtn.onclick = function () {
    loginView.className = "hidden";
    listView.className = "";
}

newBtn.onclick = function () {
    list.add();
};

dropBtn.onclick = function () {
    list.remove();
};

})();