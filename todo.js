/* The MIT License (MIT)
 *
 * Copyright (c) 2014 Brandon Lewis
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use, copy,
 * modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
 * BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
 * ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

var TOAST_TIMEOUT = 3000;

function toast (msg) {
    var ret = el("toast");
    ret.appendChild(text(msg));
    document.body.appendChild(ret);
    setTimeout(function () { ret.remove(); },
	       TOAST_TIMEOUT);
}

todo = (function () {
"use strict";
var ret = {};
var server = todoClient();


ret.todoListItem = function(list, model, items)
{
    var item = editableList.item(list, model, items);

    item.onEnterKey = function (evt) {
	model.insert(items.indexOf(item) + 1, {});
    };

    item.onclick = function (evt) {
	var completed;

	if (list.getEditMode() === false) {
	    if (item.getAttribute("completed") == "true") {
		completed = "false";
	    } else {
		completed = "true";
	    }

	    model.update(items.indexOf(item), {completed: completed});
	}
    };

    return item;
};


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
	history.back();
	toast("The list has been deleted.");
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


ret.listManagerItem = function (list, model, items)
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
	server.setList(item.id, label.innerHTML);
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
};


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


function todoClient() {
    var sock;
    var body = document.body;
    var lists;
    var reconnecting = false;

    function connect(reconnect) {
	console.log(reconnect ? "reconnecting" : "connecting");
	sock = channels.socket("http://" + window.location.hostname + ":8000/todo");
	sock.setErrHandler(handleSocketError);
	sock.setConnectHandler(handleConnect);
	sock.setMsgHandler("login", handleLogin);
	sock.setMsgHandler("error", handleError);
	reconnecting = reconnect;
    }

    function setList(id, name) {
	if (!lists[id]) {
	    lists[id] = remoteListModel(sock.join(id), "New Item");
	}

	list.setModel(lists[id]);
	setCurrentPage("listView", name);
	listViewHeader.innerHTML = name;
    }

    function doLogin(user, password) {
	console.log("loggin in");
	sock.send({type: "login",
		   user: user,
		   password: password});
    }

    function handleLogin() {
	lists = {};
	listOfLists.setModel(listManagerModel(sock.join("control")));
	setHomePage();
	setCurrentPage("managerView");
	restyle();
    }

    function handleConnect() {
	console.log("connected");
	setDisconnected(false);
	if (reconnecting) {
	    ret.login();
	    reconnecting = false;
	}
    }

    function handleError(msg) {
	console.log("protocol error: " + JSON.stringify(msg));
	toast(msg.message);
    }

    function handleSocketError() {
        setDisconnected(true);
	restyle();
    }

    list.setAllCompleted = function () {
	var i;
	for (i = list.firstChild; i != null; i = i.nextSibling) {
	    console.log(i);
	    if (i.getAttribute("completed") == "true") {
		i.onclick();
	    }
	}
    };

    setDisconnected(true);
    connect();

    return {
	login: doLogin,
	setList: setList,
	reconnect: function () { connect(true); }
    };
};

ret.login = function () {
    server.login(login.value, password.value);
};

ret.reconnect = function () {
    server.reconnect();
};

window.onpopstate = function (event) {
    if (event.state) {
	document.body.setAttribute("curView", event.state.page);
	document.title = event.state.title;
    } else {
	document.title = "Todo";
    }
};

function setDisconnected(state) {
    var full_title = "Todo - Disconnected";
    document.body.setAttribute("disconnected", state ? "true" : "false");
    document.title = full_title;
}

function setHomePage() {
    while (history.state) {
	history.back();
    }
}

function setCurrentPage(page, title) {
    var full_title = "Todo" + (title ? " - " + title : "");
    document.body.setAttribute("curView", page);
    document.title = full_title;
    history.pushState({page: page, title: full_title}, null);
};

return ret;
})();