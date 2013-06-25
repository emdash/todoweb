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

function restyle() {
    document.body.className = document.body.className;
}


function editableList(model, ret) {
    var items = [];
    var selected;
    var editing = "false";

    function listItem() {
	var item = el("div");
	var content;

	item.contentEditable = editing;
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

	item.onclick = function (evt) {
	    if (editing == "false") {
		if (item.getAttribute("completed") == "true") {
		    item.setAttribute("completed", "false");
		} else {
		    item.setAttribute("completed", "true");
		}
		restyle();
	    }
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

    ret.setEditMode = function (mode) {
	var li;
	editing = mode;
	for (li = ret.firstChild; li !== null; li = li.nextSibling) {
	    li.contentEditable = mode;
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
	setTimeout(
	    function () {
		ret.itemChanged(index, item);
	    },
	    1000
	);
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

var body = document.body;
var doneBtn = get("done");
var dropBtn = get("drop");
var newBtn = get("new");
var showBtn = get("show");
var loginBtn = get("doLogin");
var loginView = get("loginView");
var listView = get("listView");
var managerView = get("managerView");
var lm = listModel("New Item");
var list = editableList(lm, get("list"));
var login = get("login");
var password = get("password");

mobileScrollFix(get("screen"));

function showList(text) {
    var items = text.split("\n");
    body.setAttribute("curView", "listView");
    restyle();

    items.forEach(
	function (i) {
	    lm.append(i);
	}
    );
}

function load(i) {
    return function () {
	request("GET", "lists/" + i, showList);
    };
}

function populateLists(text) {
    var lists = text.split("\n");

    lists.forEach(
	function (i) {
	    var li;
	    if (i) {
		li = el("div", t(i));
		li.className = "listItem";
		managerView.appendChild(li);
		li.onclick = load(i);
	    }
	}
    );

    body.setAttribute("curView", "managerView");
    restyle();
}

loginBtn.onclick = function () {
    request("GET", "lists.txt", populateLists);
};

newBtn.onclick = function () {
    list.append();
};

doneBtn.onclick = function () {
    if (doneBtn.innerHTML === "Edit") {
	list.setEditMode("true");
	listView.setAttribute("editing", "true");
	doneBtn.innerHTML = "Done";
    } else {
	list.setEditMode("false");
	listView.setAttribute("editing", "false");
	doneBtn.innerHTML = "Edit";
    }
    restyle();
};

showBtn.onclick = function () {
    if (showBtn.innerHTML === "Show Completed") {
	list.setAttribute("showCompleted", "true");
	showBtn.innerHTML = "Hide Completed";
    } else {
	list.setAttribute("showCompleted", "false");
	showBtn.innerHTML = "Show Completed";
    }
    restyle();
};
})();