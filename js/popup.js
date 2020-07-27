'use strict';

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("on update", request, sender);
  let {action, update} = request;
  if (action == 'update') {
    if (update.hasOwnProperty('meta')) {
      assistantMetaUpdated(update.meta);
    } else if (update.hasOwnProperty('activity') && !update.activity) {
      document.querySelectorAll('li[data-action]').forEach(li => li.classList.remove('active'));
    } else { // more actions
      document.querySelector('li[data-action="' + update.activity + '"]').classList.add('active');
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
    } else {
      if (assistant == "new") {
        chrome.tabs.create({active: true, url: chrome.runtime.getURL("operation.html")});
      } else {
        let name = e.target.getAttribute("data-name");
        console.log("will set assistant to:", name);
        setAssistant(assistant);
      }
    }
  } else if (request) {
    send({
      action: 'request',
      type: request
    });
  } else if (action) {
    let duration = +e.target.getAttribute("data-duration");
    let durationMin = +e.target.getAttribute("data-duration-min");
    let durationMax = +e.target.getAttribute("data-duration-max");
    if (durationMin && durationMax) {
      duration = durationMin + Math.random() * (durationMax - durationMin);
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
  document.querySelectorAll('li[data-assistant]').forEach(li => li.classList.remove('active'));
  console.log('getting assistant data ...', assistant);
  $.when(
    $.get('assistants/' + assistant + '/html.html'),
    $.get('assistants/' + assistant + '/style.css'),
    $.get('assistants/' + assistant + '/knowledge.json'),
    $.get('assistants/' + assistant + '/manifest.json'),
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
    loadActivities(meta.activities);
    send({
      action: 'assistant',
      options
    });
  });
}

function loadActivities(activities) {
  console.log('loadActivities', activities);
  document.querySelectorAll('li[data-action]:not(:first-child)').forEach(li => li.remove());
  activities.forEach(activity => {
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
  chrome.tabs.getSelected(null, function(tab) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'get_init',
    }, function(response) {
      console.log('get init result', response);
      document.querySelector('input[name="scale"]').value = response.scale;
      assistantMetaUpdated(response.meta);
      if (response.activity) {
        document.querySelector('li[data-action="' + response.activity + '"]').classList.add('active');
      }
    });
  });
  document.querySelectorAll('li').forEach(li => li.addEventListener('click', click));
  document.querySelector('input[name="scale"]').oninput = (e) => {
    send({
      action: 'scale',
      options: {
        scale: e.target.value
      }
    });
  };
});
