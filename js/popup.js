'use strict';

var selectedAssistant;

chrome.storage.sync.get('my_assistants', function(data) {
  console.log('setAssistants from init');
  setAssistants(data.my_assistants);
});

function setAssistants(my_assistants = null) {
  console.log('loaded assistant list', my_assistants);
  let ids = my_assistants?.map(a => a.meta.id) || defaultAssistants;
  $.get(baseUrl + 'assistants/get.php?ids=' + ids.join(), function(result) {
    let ul = document.querySelector('ul.assistant-list');
    let list = JSON.parse(result) || [];
    console.log("list result", list);
    ul.querySelectorAll('li:not([data-assistant="new"])').forEach(l => l.remove());
    list.forEach(res => {
      let mine = my_assistants?.find(a => a.meta.id == res.ID);
      let currentversion = mine?.meta?.version || '';
      let li = document.createElement('li');
      li.setAttribute('data-assistant', res.ID);
      li.setAttribute('data-name', res.NAME);
      li.setAttribute('data-current-version', currentversion);
      li.setAttribute('data-version', res.VERSION);
      li.innerHTML = `<img src="${baseUrl}assistants/${res.ID}/${res.ICON}"/> ${res.NAME}`;
      li.onclick = click;
      ul.insertBefore(li, ul.querySelector('li[data-assistant="new"]'));
    });
    chrome.tabs.getSelected(null, function(tab) {
      if (isHttp(tab.url)) {
        chrome.tabs.sendMessage(tab.id, { action: 'get_init' }, function(response) {
          console.log('get init result', response);
          if (!response) return;
          document.querySelector('input[name="scale"]').value = response?.scale || 1;
          document.querySelector('input[name="mute"]').checked = response?.mute;
          console.log('assistantMetaUpdated from: init');
          assistantMetaUpdated(response.meta);
          if (response.activity) {
            document.querySelector('li[data-action="' + response.activity + '"]').classList.add('active');
          }
        });
      } else {
        console.log('not a http or https');
      }
      document.body.classList.remove('loading');
    });
  });
}

// init listeners
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("on update", request, sender);
  let {action, update} = request;
  if (action == 'update') {
    if (update.hasOwnProperty('meta')) {
      console.log('assistantMetaUpdated from: onMessage');
      assistantMetaUpdated(update.meta);
    } else if (update.hasOwnProperty('dismissed')) {
      if (update.dismissed == selectedAssistant?.id) {
        resetAssistant();
      }
    } else if (update.hasOwnProperty('activity') && !update.activity) {
      document.querySelectorAll('li[data-action]').forEach(li => li.classList.remove('active'));
    } else if (update.hasOwnProperty('my_assistants')) {
      console.log('setAssistants from onMessage');
      setAssistants(update.my_assistants);
    } else { // more actions
      document.querySelector('li[data-action="' + update.activity + '"]')?.classList.add('active');
    }
  } else if (action == 'assistant') {
    setAssistant(update);
  }
  sendResponse({ok: true});
});

function assistantMetaUpdated(meta) {
  console.log('assistantMetaUpdated', meta);
  if (!meta?.id) return;
  let {id, name, activities} = meta;
  document.querySelector('.tool').style.display = 'block';
  document.querySelector('li[data-assistant="' + id + '"]')?.classList.add('active');
  selectedAssistant = { id, name };
  document.querySelectorAll('li[data-action]:not(:first-child)').forEach(li => li.remove());
  activities?.forEach(activity => {
    let li = document.createElement('li');
    li.setAttribute("data-action", activity.id);
    if (activity.duration) li.setAttribute("data-duration", activity.duration);
    if (activity.durationMin) li.setAttribute("data-duration-min", activity.durationMin);
    if (activity.durationMax) li.setAttribute("data-duration-max", activity.durationMax);
    li.innerText = activity.name;
    li.addEventListener('click', click);
    document.querySelector('ul.list-action').appendChild(li);
    console.log('-> activity added', activity.name);
  });
}

function resetAssistant() {
  document.querySelectorAll('li[data-assistant]').forEach(li => li.classList.remove('active'));
  document.querySelector('.tool').style.display = 'none';
  selectedAssistant = null;
}

function clickAction(e, { assistant, request, action }) {
  if (assistant) {
    if (e.target.classList.contains('active')) {
      // send({ action: 'request', type: 'dismiss', options: {confirmation: false} });
      sendAll({ action: 'dismiss' });
    } else {
      if (assistant == "new") {
        openUI("operation.html");
      } else {
        let name = e.target.getAttribute("data-name");
        console.log("will set assistant to:", name);
        setAssistant(assistant);
      }
    }
  } else if (request) {
    if (request == 'delete') {
      if (!confirm(`Are you sure you want to remove ${selectedAssistant.name}?`)) return;
    }
    send({ action: 'request', type: request }, (response) => {
      console.log('request response', request, response);
    });
  } else if (action) {
    if (e.target.classList.contains('active')) {
      send({ action: 'action' }); // stop current activity
    } else {
      let duration = +e.target.getAttribute("data-duration");
      let durationMin = +e.target.getAttribute("data-duration-min");
      let durationMax = +e.target.getAttribute("data-duration-max");
      if (durationMin && durationMax) {
        duration = getMinMax(durationMin, durationMax);
      }
      duration = duration || (3000 + Math.random() * 5000);
      let options = {
        duration,
        persist: true
      };
      send({
        action: 'action',
        type: action,
        options
      });
    }
  }
}

function openUI(file) {
  chrome.tabs.query({currentWindow: true, windowType: 'normal'}, function(tabs) {
    let url = chrome.runtime.getURL(file);
    let findTab = tabs.filter(t => t.url == url);
    if (findTab.length) {
      chrome.tabs.update(findTab[0].id, {selected: true});
    } else {
      chrome.tabs.create({active: true, url});
    }
    window.close();
  });
}

function click(e) {
  let assistant = e.target.getAttribute("data-assistant");
  let request = e.target.getAttribute("data-request");
  let action = e.target.getAttribute("data-action");

  console.log('click', e, { assistant, request, action });
  clickAction(e, { assistant, request, action });
}

function setAssistant(assistant) {
  chrome.tabs.getSelected(null, function(tab) {
    if (isHttp(tab.url)) {
      console.log('getting assistant data ...', assistant);
      document.querySelectorAll('li[data-assistant]').forEach(li => li?.classList?.remove('active'));
      chrome.storage.sync.get('my_assistants', function(data) {
        console.log('my assistants data', data);
        let myAssistantList = data.my_assistants || [];
        let findMyAssistant = myAssistantList?.find(a => a.meta.id == assistant);
        if (findMyAssistant) {
          console.log('loaded from local', findMyAssistant);
          sendAll({
            action: 'assistant',
            options: findMyAssistant
          });
        } else {
          fetchAssistant(assistant, (result) => {
            console.log('loaded from online', result);
            chrome.storage.sync.get('my_assistants', function(data) {
              let myAssistantList = data.my_assistants || [];
              chrome.storage.sync.set({my_assistants: [...myAssistantList, result]}, function() {
                console.log('assistant data saved!')
              });
            });
            sendAll({
              action: 'assistant',
              options: result
            });
          });
        }
      });
    } else {
      console.log('Cannot do it here.');
      alert('Cannot do it here.');
    }
  });
}

function send(message, callback = function(){}) {
  console.log('send', message);
  chrome.tabs.getSelected(null, function(tab) {
    chrome.tabs.sendMessage(tab.id, message, function(response) {
      callback(response);
    });
  });
}

function sendAll(message) {
  console.log('send all', message);
  chrome.tabs.query({windowType: 'normal', url: ['http://*/*', 'https://*/*'], status: 'complete'}, function(tabs) {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, message);
    });
  });
}

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('li').forEach(li => li.addEventListener('click', click));
  document.querySelector('input[name="mute"]').oninput = (e) => {
    sendAll({ action: 'mute', options: { mute: e.currentTarget.checked } });
  };
  document.querySelector('input[name="scale"]').oninput = (e) => {
    sendAll({ action: 'scale', options: { scale: e.target.value } });
  };
  document.querySelector('.btn-browse').onclick = () => {
    openUI("showcase.html");
  };
  document.querySelector('.btn-import').onclick = () => {
    document.querySelector('#file-import').click();
  };
  document.querySelector('#file-import').oninput = (e) => {
    var file = e.currentTarget.files[0];
    if (file) {
      var reader = new FileReader();
      reader.readAsText(file, "UTF-8");
      reader.onload = function (evt) {
        let json = isValidJson(evt.target.result);
        if (json) {
          let options = {
            meta: {...json.manifest, knowledge: json.knowledge},
            dom: json.html,
            css: json.css
          };
          console.log('json file loaded', options);
          chrome.storage.sync.get('my_assistants', function(data) {
            console.log('my assistants data', data);
            let myAssistantList = data.my_assistants || [];
            let findMyAssistant = myAssistantList.filter(a => a.meta.id == options.meta.id) || [];
            let newList = myAssistantList;
            if (findMyAssistant.length) {
              newList.splice(myAssistantList.indexOf(findMyAssistant[0]), 1);
            }
            newList.push(options);
            chrome.storage.sync.set({my_assistants: newList}, function() {
              console.log('assistant data saved!')
            });
            console.log('setAssistants from import');
            setAssistants(newList);
          });
          sendAll({
            action: 'assistant',
            options
          });
        } else {
          alert("Cannot import: invalid content!");
        }
      }
      reader.onerror = function (evt) {
        console.log("error reading file", evt);
      }
    }
  };
});
