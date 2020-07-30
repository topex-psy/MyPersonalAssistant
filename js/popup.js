'use strict';

chrome.storage.sync.get('my_assistants', function(data) {
  console.log('loaded assistant list', data);
  let ids = defaultAssistants;
  data.my_assistants?.forEach(a => {
    if (!ids.includes(a.meta.id)) ids.push(a.meta.id);
  });
  $.get(baseUrl + 'assistants/get.php?ids=' + ids.join(), function(result) {
    let ul = document.querySelector('ul.assistant-list');
    let list = JSON.parse(result) || [];
    console.log("list result", list);
    ul.querySelectorAll('li:not([data-assistant="new"])').forEach(l => l.remove());
    list.forEach(res => {
      let li = document.createElement('li');
      li.setAttribute('data-assistant', res.ID);
      li.setAttribute('data-name', res.NAME);
      li.innerHTML = `<img src="${baseUrl}assistants/${res.ID}/${res.ICON}"/> ${res.NAME}`;
      li.onclick = click;
      ul.insertBefore(li, ul.querySelector('li[data-assistant="new"]'));
    });
    document.body.classList.remove('loading');
    chrome.tabs.getSelected(null, function(tab) {
      if (isHttp(tab.url)) {
        chrome.tabs.sendMessage(tab.id, { action: 'get_init' }, function(response) {
          console.log('get init result', response);
          if (!response) return;
          document.querySelector('input[name="scale"]').value = response?.scale || 1;
          assistantMetaUpdated(response.meta);
          if (response.activity) {
            document.querySelector('li[data-action="' + response.activity + '"]').classList.add('active');
          }
        });
      } else {
        console.log('not a http or https');
      }
    });
  });
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("on update", request, sender);
  let {action, update} = request;
  if (action == 'update') {
    if (update.hasOwnProperty('meta')) {
      assistantMetaUpdated(update.meta);
    } else if (update.hasOwnProperty('activity') && !update.activity) {
      document.querySelectorAll('li[data-action]').forEach(li => li.classList.remove('active'));
    } else { // more actions
      document.querySelector('li[data-action="' + update.activity + '"]')?.classList.add('active');
    }
  } else if (action == 'assistant') {
    setAssistant(update);
  }
  sendResponse({ok: true});
});

function assistantMetaUpdated(meta) {
  if (meta?.id) {
    document.querySelector('.tool').style.display = 'block';
    document.querySelector('li[data-assistant="' + meta.id + '"]').classList.add('active');
    loadActivities(meta.activities);
  } else {
    document.querySelectorAll('li[data-assistant]').forEach(li => li.classList.remove('active'));
    document.querySelector('.tool').style.display = 'none';
  }
}

function click(e) {
  let assistant = e.target.getAttribute("data-assistant");
  let request = e.target.getAttribute("data-request");
  let action = e.target.getAttribute("data-action");

  console.log('click', e, {
    assistant,
    request,
    action
  });

  if (assistant) {
    if (e.target.classList.contains('active')) {
      send({ action: 'request', type: 'dismiss' });
      window.close();
    } else {
      if (assistant == "new") {
        chrome.tabs.create({active: true, url: chrome.runtime.getURL("operation.html")});
        window.close();
      } else {
        let name = e.target.getAttribute("data-name");
        console.log("will set assistant to:", name);
        setAssistant(assistant);
      }
    }
  } else if (request) {
    if (request == 'delete') {
      if (!confirm('Are you sure?')) return;
    }
    send({
      action: 'request',
      type: request
    });
  } else if (action) {
    let duration = +e.target.getAttribute("data-duration");
    let durationMin = +e.target.getAttribute("data-duration-min");
    let durationMax = +e.target.getAttribute("data-duration-max");
    if (durationMin && durationMax) {
      duration = getMinMax(durationMin, durationMax);
    }
    duration = duration || (3000 + Math.random() * 5000);
    let options = {
      duration
    };
    send({
      action: 'action',
      type: action,
      options
    });
  }
}

function setAssistant(assistant) {
  console.log('getting assistant data ...', assistant);
  document.querySelectorAll('li[data-assistant]').forEach(li => li?.classList?.remove('active'));
  chrome.storage.sync.get('my_assistants', function(data) {
    console.log('my assistants data', data);
    let myAssistantList = data.my_assistants || [];
    let findMyAssistant = myAssistantList.filter(a => a.meta.id == assistant) || [];
    if (findMyAssistant.length) {
      let myAssistant = findMyAssistant[0];
      console.log('loaded from local', myAssistant);
      loadActivities(myAssistant.meta.activities);
      send({
        action: 'assistant',
        options: myAssistant
      });
    } else {
      $.when(
        $.get(baseUrl + 'assistants/' + assistant + '/html.html'),
        $.get(baseUrl + 'assistants/' + assistant + '/style.css'),
        $.get(baseUrl + 'assistants/' + assistant + '/knowledge.json'),
        $.get(baseUrl + 'assistants/' + assistant + '/manifest.json'),
      ).done(function (domResult, cssResult, knowledgeResult, manifestResult) {
        let manifest = manifestResult[0];
        let knowledge = knowledgeResult[0];
        let dom = domResult[0];
        let css = cssResult[0];
        let meta = { ...manifest, knowledge };
        let options = {
          meta,
          dom,
          css
        };
        console.log('loaded from online', options);
        loadActivities(meta.activities);
        chrome.storage.sync.set({my_assistants: [...myAssistantList, options]}, function() {
          console.log('assistant data saved!')
        });
        send({
          action: 'assistant',
          options
        });
      });
    }
  });
}

function loadActivities(activities) {
  console.log('loadActivities', activities);
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

function send(message) {
  console.log('send', message);
  chrome.tabs.getSelected(null, function(tab) {
    chrome.tabs.sendMessage(tab.id, message);
  });
}

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('li').forEach(li => li.addEventListener('click', click));
  document.querySelector('input[name="scale"]').oninput = (e) => {
    send({
      action: 'scale',
      options: {
        scale: e.target.value
      }
    });
  };
  document.querySelector('.btn-import').onclick = () => {
    document.querySelector('#file-import').click();
  };
  document.querySelector('#file-import').oninput = (e) => {
    var file = e.currentTarget.files[0];
    if (file) {
      isImporting = true;
      var reader = new FileReader();
      reader.readAsText(file, "UTF-8");
      reader.onload = function (evt) {
        let json = isJSONValid(evt.target.result);
        if (json) {
          let options = {
            meta: {...json.manifest, knowledge: json.knowledge},
            dom: json.html,
            css: json.css
          };
          console.log('loaded from online', options);
          loadActivities(meta.activities);
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
          });        
          send({
            action: 'assistant',
            options
          });
          alert(json.manifest.name + " has been set as your assistant!");
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
