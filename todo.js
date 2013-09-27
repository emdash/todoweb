todolist = (function () {
"use strict";


function todoListItem(list, model, items)
{
    var item = editableList.item(list, model, items);

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


function remoteListModel(channel, defaultItem)
{
    var ret = editableList.model(defaultItem);
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
    var item = editableList.item(list, model, items);
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
    var ret = editableList.model("Untitled");
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
	chansrv = channelServer("http://" + window.location.hostname + ":8000/todo");
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
	alert("Lost connection to server. Reconnecting in 2 seconds.");
	restyle();
	setTimeout(connect, 2000);
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
var list = editableList.list(null, get("list"), todoListItem);
var listOfLists = editableList.list(null, get("listOfLists"), listManagerItem);
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