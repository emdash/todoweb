todolist = (function () {
"use strict";


function restyle() {
    document.body.className = document.body.className;
}


function editableListItem(list, model, items) {
    var item = el("div");
    var content;

    item.className = "listItem";

    item.onkeypress = function (evt) {
	switch (evt.keyCode) {
	case 13:
	    item.onEnterKey();
	    evt.preventDefault();
	    break;
	};
    };

    item.onfocus = function (evt) {
	list.setSelected(item);
	content = item.getContent();
	setTimeout(item.selectAll, 1);
    };

    item.onblur = function (evt) {
	if (item.innerHTML === content) {
	    return;
	}
	item.setEditable(false);
	model.update(items.indexOf(item), {content: item.getContent()});
    };

    item.onEnterKey = function (content) {
	item.blur();
    };

    item.getContent = function (content) {
	return item.innerHTML;
    };

    item.selectAll = function () {
	document.getSelection().selectAllChildren(item);
    };

    item.setContent = function (content) {
	item.innerHTML = content;
    };

    item.setEditable = function (editable) {
	item.contentEditable = editable;
    };

    return item;
}


function todoListItem(list, model, items)
{
    var item = editableListItem(list, model, items);

    item.onEnterKey = function (evt) {
	model.insert(items.indexOf(item) + 1, {});
    };

    item.onclick = function (evt) {
	var completed;

	if (list.getEditMode() == "false") {
	    if (item.getAttribute("completed") == "true") {
		completed = "false";
	    } else {
		completed = "true";
	    }

	    model.update(items.indexOf(item), {completed: completed});
	}
    };

    return item;
}


function editableList(model, ret, listItem) {
    var items = [];
    var selected;
    var editing = "false";

    function itemAdded(index, attrs) {
	var item = listItem(ret, model, items);
	var attr;

	console.log("item added " + attrs.content);

	ret.insertBefore(item, items[index]);
	items.splice(index, 0, item);

	for (attr in attrs) {
	    model.itemChanged(index, attr, attrs[attr]);
	}

	item.setEditable(editing);
	item.focus();
    }

    function itemChanged(index, attr, value) {
	var item = items[index];

	if (!item) {
	    return;
	}

	if (attr == "content") {
	    item.setContent(value);

	    if (editing == "true") {
		item.setEditable(true);
	    }
	} else {
	    item.setAttribute(attr, value);
	}
    }

    function itemRemoved(index) {
	var item = items[index];
	var unused = { focus: function () {}};
	var hilight;

	items.splice(index, 1);

	if (item === selected) {
	    hilight = (item.nextSibling
			|| item.previousSibling
			|| unused);
	    hilight.focus && hilight.focus();
	}

	item && ret.removeChild(item);
    }

    ret.append = function () {
	model.insert(items.indexOf(selected) + 1, {});
    };

    ret.remove = function () {
	if (items.length) {
	    model.remove(items.indexOf(selected));
	}
    };

    ret.getEditMode = function (mode) {
	return editing;
    };

    ret.setEditMode = function (mode) {
	var li;
	editing = mode;
	for (li = ret.firstChild; li !== null; li = li.nextSibling) {
	    li.setEditable(mode);
	}
    };

    ret.setModel = function (newModel) {
	model = newModel;

	if (model) {
	    model.itemAdded = itemAdded;
	    model.itemChanged = itemChanged;
	    model.itemRemoved = itemRemoved;
	}

	ret.innerHTML = "";
    };

    ret.setSelected = function (item) {
	selected = item;
    };

    ret.setModel(model);

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

    ret.update = function (index, attrs) {
	var attr;
	var value;

	for (attr in attrs) {
	    value = attrs[attr];
	    items[index][attr] = value;
	    ret.itemChanged(index, attr, value);
	}
    };

    ret.insert = function(index, attrs) {
	console.log("insert");
	attrs.content = attrs.content || defaultItem;
	items.splice(index, 0, attrs);
	ret.itemAdded(index, attrs);
    };

    ret.remove = function (index) {
	items.splice(index, 1);
	ret.itemRemoved (index);
    };

    return ret;
}


function remoteListModel(channel, defaultItem)
{
    var ret = listModel(defaultItem);
    var insert = ret.insert;
    var remove = ret.remove;
    var update = ret.update;

    function handleInsert(msg) {
	insert(msg.index, msg.attrs);
    }

    function handleDelete(msg) {
	remove(msg.index);
    }

    function handleUpdate(msg) {
	update(msg.index, msg.attrs);
    }

    function handleDestroy(msg) {
	alert("This list has been deleted");
	document.body.setAttribute("curView", "managerView");
    }

    ret.insert = function (index, attrs) {
	channel.send({type: "insert",
		      index: index,
		      attrs: attrs});
    };

    ret.remove = function (index) {
	channel.send({type: "delete",
		      index: index});
    };

    ret.update = function (index, attrs) {
	channel.send({type: "update",
		      index: index,
		      attrs: attrs});
    };

    channel.setMsgHandler("insert", handleInsert);
    channel.setMsgHandler("delete", handleDelete);
    channel.setMsgHandler("update", handleUpdate);
    channel.setMsgHandler("destroy", handleDestroy);

    return ret;
}


function jsonCmdServer(url) {
    var socket = new SockJS(url);
    var handlers = {};

    socket.onmessage = function (e) {
	var message = JSON.parse(e.data);
	console.log("-->" + e.data);
	if (handlers[message.type]) {
	    handlers[message.type](message);
	}
    };

    return {
	send: function (msg) {
	    msg = JSON.stringify(msg);
	    console.log("<--" + msg);
	    socket.send(msg);
	},
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


function listManagerItem(list, model, items)
{
    var item = editableListItem(list, model, items);
    var label = el("span");
    var destroy = el("span");

    item.appendChild(destroy);
    item.appendChild(label);

    item.focus = function () {
	label.focus();
    };

    item.blur = function () {
	label.blur();
    };

    item.setContent = function (content) {
	label.innerHTML = content;
    };

    item.getContent = function (content) {
	return label.innerHTML;
    };

    item.onclick = function (content) {
	server.setList(item.id);
    };

    item.selectAll = function (editable) {
	document.getSelection().selectAllChildren(label);
    };

    item.setEditable = function (editable) {
	label.contentEditable = editable;
    };

    label.onclick = function (e) {
	e.preventDefault();
	e.stopPropagation();
    };

    label.onfocus = item.onfocus;
    label.onblur = item.onblur;

    destroy.appendChild(text("X"));
    destroy.className = "destroy";

    destroy.onclick = function (e) {
	model.remove(item.id);
	e.preventDefault();
	e.stopPropagation();
	return false;
    };

    return item;
}


function listManagerModel(channel) {
    var ret = listModel("Untitled");
    var insert = ret.insert;
    var update = ret.update;
    var remove = ret.remove;
    var lists = {};
    var byIndex = [];
    var curlist = 0;

    function handleListRename(msg) {
	update(lists[msg.id],
	       {content: msg.name});
    }

    function handleListAdded(msg) {
	console.log("list: " + msg.name);
	insert(ret.getLength(), {content: msg.name, id:msg.id});
	byIndex[curlist] = msg.id;
	lists[msg.id] = curlist++;
    }

    function handleListDelete(msg) {
	var id = msg.id;
	var index = lists[msg.id];

	console.log("delete list: " + id);
	remove(index);
	delete lists[id];
	byIndex.splice(index, 1);
    }

    ret.insert = function (index, attrs) {
	channel.send({type: "create",
		      name: attrs.content || "Untitled List"});
    };

    ret.update = function (index, attrs) {
	channel.send({type: "rename",
		      id: byIndex[index],
		      name: attrs.content});
    };

    ret.remove = function (id) {
	if (confirm("Are you sure?")) {
	    channel.send({type: "delete",
			  id: id});
	}
    };

    channel.setMsgHandler("list-added", handleListAdded);
    channel.setMsgHandler("list-rename", handleListRename);
    channel.setMsgHandler("list-delete", handleListDelete);
    channel.send({"type": "get-lists"});

    return ret;
}


function todoServer() {
    var chansrv;
    var body = document.body;

    function connect() {
	chansrv = channelServer("http://" + window.location.host + ":8080/todo");
	chansrv.setErrHandler(handleSocketError);
	chansrv.setMsgHandler("login", handleLogin);
	chansrv.setMsgHandler("error", handleError);
    }

    function setList(id) {
	var channel = chansrv.join(id);
	list.setModel(remoteListModel(channel, "New Item"));
	body.setAttribute("curView", "listView");
	restyle();
    }

    function doLogin(user, password) {
	chansrv.send({type: "login",
		      user: user,
		      password: password});
    }

    function handleLogin() {
	listOfLists.setModel(listManagerModel(chansrv.join("control")));
	body.setAttribute("curView", "managerView");
	restyle();
    }

    function handleError(msg) {
	console.log("protocol error: " + JSON.stringify(msg));
    }

    function handleSocketError() {
	body.setAttribute("curView", "loginView");
	alert("Lost connection to server.");
	restyle();
	connect();
    }

    connect();

    return {
	login: doLogin,
	setList: setList
    };
};

var server = todoServer();
var doneBtn = get("done");
var dropBtn = get("drop");
var newBtn = get("new");
var newListBtn = get("newList");
var showBtn = get("show");
var loginBtn = get("doLogin");
var loginView = get("loginView");
var listView = get("listView");
var managerView = get("managerView");
var list = editableList(null, get("list"), todoListItem);
var listOfLists = editableList(null, get("listOfLists"), listManagerItem);
var login = get("login");
var password = get("password");

mobileScrollFix(get("screen"));
listOfLists.setEditMode(true);

loginBtn.onclick = function () {
    server.login(login.value, password.value);
};

newListBtn.onclick = function () {
    listOfLists.append();
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