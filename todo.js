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

    function connect() {
	sock = channels.socket("http://" + window.location.hostname + ":8000/todo");
	sock.setErrHandler(handleSocketError);
	sock.setMsgHandler("login", handleLogin);
	sock.setMsgHandler("error", handleError);
    }

    function setList(id) {
	var channel = sock.join(id);
	list.setModel(remoteListModel(channel, "New Item"));
	body.setAttribute("curView", "listView");
	restyle();
    }

    function doLogin(user, password) {
	sock.send({type: "login",
		   user: user,
		   password: password});
    }

    function handleLogin() {
	listOfLists.setModel(listManagerModel(sock.join("control")));
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


mobileScrollFix(get("screen"));

ret.login = function () {
    server.login(login.value, password.value);
};

return ret;
})();