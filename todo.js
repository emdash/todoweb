todolist = (function () {
"use strict";


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

function jsonCmdServer(url) {
    var socket = new SockJS(url);
    var handlers = {};

    socket.onmessage = function (e) {
	var message = JSON.parse(e.data);
	if (handlers[message.type]) {
	    handlers[message.type](message);
	}
    };

    return {
	send: function (msg) { socket.send(JSON.stringify(msg)); },
	setMsgHandler: function(message, handler) { handlers[message] = handler; },
	setErrHandler: function(handler) {
	    socket.onclose = handler;
	}
    };
}

function channel(name, server) {
    var handlers = {};

    function handleMessage(msg) {
	if (handlers[msg.type]) {
	    handlers[msg.type](msg);
	}
    }

    function sendMessage(msg) {
	server.send({type: "send",
		     name: name,
		     content: msg});
    }

    return {
	handle: handleMessage,
	send: sendMessage,
	setMsgHandler: function (msg, handler) { handlers[msg] = handler; }
    };
}

function channelServer(url) {
    var cmdserver = jsonCmdServer(url);
    var channels = {};

    function handleChannelMessage(message) {
	if (channels[message.name]) {
	    channels[message.name].handle(message.content);
	}
    }

    function joinChannel(name, handler) {
	cmdserver.send({type: "join",
			name: name});
	return channels[name] = channel(name, cmdserver);
    }

    function leaveChannel(name) {
	cmdserver.send({type: "leave",
			name: name});
	delete channels[name];
    }

    cmdserver.setMsgHandler("channel-message", handleChannelMessage);

    return {
	send: cmdserver.send,
	setMsgHandler: cmdserver.setMsgHandler,
	setErrHandler: cmdserver.setErrHandler,
	login: doLogin,
	join: joinChannel,
	leave: leaveChannel
    };
}

function todoServer() {
    var chansrv = channelServer("http://" + window.location.host + ":8080/todo");
    var control;

    function load(id) {
	return function () {
	    var channel = chansrv.join(id);
	    channel.setMsgHandler("insert", handleInsert);
	    channel.setMsgHandler("delete", handleDelete);
	    channel.setMsgHandler("update", handleUpdate);
	};
    }

    function doLogin(user, password) {
	chansrv.send({type: "login",
		      user: user,
		      password: password});
    }

    function handleLogin() {
	control = chansrv.join("control");
	control.setMsgHandler("list-added", handleListAdded);
	control.send({"type": "get-lists"});
	body.setAttribute("curView", "managerView");
	restyle();
    }

    function handleListAdded(message) {
	var li;

	li = el("div");
	li.appendChild(text(message.name));
	li.className = "listItem";
	managerView.appendChild(li);
	li.onclick = load(message.id);
    }

    function showList(message) {
	body.setAttribute("curView", "listView");
	restyle();
    }

    function handleInsert(message) {
	lm.insert(message.index, message.content);
    }

    function handleDelete(message) {
	lm.remove(message.index);
    }

    function handleUpdate(message) {
	lm.update(message.index, message.attrs.content);
    }

    function handleError(msg) {
	alert(msg.message);
    }

    function handleSocketError() {
	body.setAttribute("curView", "loginView");
	alert("Lost connection to server.");
	restyle();
    }

    chansrv.setErrHandler(handleSocketError);
    chansrv.setMsgHandler("login", handleLogin);
    chansrv.setMsgHandler("error", handleError);

    return {
	login: doLogin
    };
};

var server = todoServer();
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

loginBtn.onclick = function () {
    server.login(login.value, password.value);
};

newBtn.onclick = function () {
    list.append();
};

dropBtn.onclick = function () {
    list.remove();
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