console.log('location', location.href);

var initOptions;
var isReady;
var assistant = {
  meta: null,
  dom: null,
  css: null,
  activity: null,
  scale: 1.0,
};
var position = {
  window: null,
  tab: null,
}

$.get('css/content.css', function(css) {
  initOptions = {css};
  console.log('initOptions', initOptions);
});

chrome.storage.local.get('assistant', function(data) {
  console.log('loaded assistant data', data);
  if (data.assistant) assistant = data.assistant;
  chrome.tabs.getSelected(null, function(tab) {
    position.tab = tab.id;
    position.window = tab.windowId;
    // if (isTabReady(tab)) {
    //   initiateAssistant(tab.id);
    // }
  });
  bindListeners();
});

function bindListeners() {
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log("on action", request, sender);
    let {action, update} = request;
    if (action == 'lookup' && sender.tab.selected) lookup();
    else if (action == 'click') click();
    else if (action == 'count') count();
    else if (action == 'greeting') greeting();
    else if (action == 'dismiss') dismiss();
    else if (action == 'operation') chrome.tabs.create({active: true, url: chrome.runtime.getURL("operation.html?id=" + assistant.meta.id)});
    else if (action == 'update') {
      if (update.hasOwnProperty('activity')) assistant.activity = update.activity;
      if (update.hasOwnProperty('scale')) assistant.scale = update.scale;
      if (update.hasOwnProperty('meta')) {
        assistant.meta = update.meta;
        assistant.dom = update.dom;
        assistant.css = update.css;
        chrome.tabs.query({windowType: 'normal', url: ['http://*/*', 'https://*/*'], status: 'complete'}, function(tabs) {
          // if (isHttp(tab.url) && tab.status == "complete")
          tabs.forEach(tab => {
            if (update.meta) {
              let {meta, dom, css} = assistant;
              chrome.tabs.sendMessage(tab.id, { action: 'assistant', options: {meta, dom, css} });
            } else {
              chrome.tabs.sendMessage(tab.id, { action: 'dismissed' });
            }
          });
        });
      }
      chrome.storage.local.set({assistant}, function() {
        console.log('all data saved!')
      });
    }
    sendResponse({ok: true});
  });

  chrome.tabs.onSelectionChanged.addListener(function(tabId, selectInfo) {
    console.log("tab changed", position.tab, '->', tabId, selectInfo);
    // if (assistant.meta?.id) {
    //   chrome.tabs.get(+position.tab, function(tab) {
    //     console.log("tab previous get", tab);
    //     if (tab && isHttp(tab.url) && tab.status == "complete") {
    //       chrome.tabs.sendMessage(tab.id, { action: 'get_position' }, function(response) {
    //         console.log('assistant position get', response);
    //         chrome.tabs.sendMessage(tabId, { action: 'set_position', options: response }, function(response) {
    //           console.log('assistant position set', response);
    //         });
    //       });
    //     }
    //   });
    // }
    position.tab = tabId;
    position.window = selectInfo.windowId;
  });
  
  chrome.tabs.onActivated.addListener(function(info) {
    console.log("tab activated", info);
    let {tabId} = info;
    chrome.tabs.get(+tabId, function(tab) {
      console.log("tab activated get", tab);
      if (isTabReady(tab)) {
        initiateAssistant(tabId);
      }
    });
  });
  
  chrome.tabs.onUpdated.addListener(function(tabId, info, tab) {
    console.log("tab updated", tabId, info, tab);
    if (isTabReady(tab)) {
      initiateAssistant(tabId);
    }
  });
}

function initiateAssistant(tabId) {
  console.log('initiateAssistant', assistant, tabId);
  let options = { initOptions, assistant };
  chrome.tabs.sendMessage(tabId, { action: 'init', options }, function(response) {
    console.log('initiateAssistant response', response)
  });
}

function analizeTab(tab) {
  let title = tab.title;
  console.log('analizing tab ...', title);
  let url = tab.url;
  // let favIconUrl = tab.favIconUrl;
  // let audible = tab.audible;
  // let incognito = tab.incognito;
  // let muted = tab.mutedInfo.muted;

  // getting meta data from full html dom
  $.get(url, function(dom) {
    try {
      parser = new DOMParser();
      let xml = parser.parseFromString(dom, "text/xml");
      let metas = xml.querySelectorAll("meta");
      console.log('=> obtain meta', metas);
      metas.forEach(meta => {
        let property = meta.getAttribute('property');
        let content = meta.getAttribute('content');
        console.log('=> data meta', property, content);
      });
    } catch(e) {
      console.log('=> obtain meta failed', e);
    }
  });

  // getting matched response from knowledge.json
  let { meta } = assistant;
  let possibleResponses = meta.knowledge.responses || [];
  let item_title = title.split('-')[0].trim();
  let hosts = meta.knowledge.hosts.filter(host => url.includes(host.keyword));
  if (hosts.length) {
    let host = hosts[0];
    item_title = title.replace(host.title_remove, '');
    possibleResponses = host.responses || arrayCombine(possibleResponses, host.responses_add);
    if (host.specifics) {
      let specifics = host.specifics.filter(specific => url.includes(specific.keyword));
      if (specifics.length) {
        let specific = specifics[0];
        possibleResponses = specific.responses || arrayCombine(possibleResponses, specific.responses_add);
      }
    }
  } else {
    possibleResponses = meta.knowledge.hosts_unknown.responses || arrayCombine(possibleResponses, meta.knowledge.hosts_unknown.responses_add);
  }

  // process raw message
  let message = getRandomFrom(possibleResponses)
    .replace(/\[name\]/g, assistant.meta.name)
    .replace(/\[title\]/g, item_title)

  // send message
  sendBalloon(message, {
    duration: 5000,
    replies: getRandomFrom([
      generateAnswer('click', 'lookup'),
      generateAnswer('click', 'dismiss'),
      generateAnswer('click', 'shutup'),
    ], getMaxOptions()),
  });
}

function sendBalloon(message, options = {}) {
  chrome.tabs.getSelected(null, function(tab) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'balloon',
      message,
      options
    });
  });
}

function click() {
  let { meta } = assistant;
  if (Math.random() > .5) {
    let possibleResponses = meta.knowledge.click.responses;
    let message = getRandomFrom(possibleResponses);
    message = message.replace('[name]', meta.name);
    sendBalloon(message, {
      duration: 8000,
      replies: [
        generateAnswer('click', 'lookup'),
        generateAnswer('click', 'dismiss'),
      ],
    });
  } else {
    lookup();
  }
}

function generateAnswer(type = 'click', action = 'lookup', qty = 1) {
  let { knowledge } = assistant.meta;
  let titles = action;
  switch (action) {
    case 'lookup':
      titles = knowledge[type]?.to_lookup
        ? arrayCombine(knowledge[type]?.to_lookup, knowledge[type]?.to_lookup_add)
        : arrayCombine(knowledge.to_lookup, knowledge.to_lookup_add, knowledge[type]?.to_lookup_add);
      break;
    case 'dismiss':
      titles = knowledge[type]?.to_dismiss
        ? arrayCombine(knowledge[type]?.to_dismiss, knowledge[type]?.to_dismiss_add)
        : arrayCombine(knowledge.to_dismiss, knowledge.to_dismiss_add, knowledge[type]?.to_dismiss_add);
      break;
    case 'shutup':
      titles = knowledge[type]?.to_shutup
        ? arrayCombine(knowledge[type]?.to_shutup, knowledge[type]?.to_shutup_add)
        : arrayCombine(knowledge.to_shutup, knowledge.to_shutup_add, knowledge[type]?.to_shutup_add);
      break;
    case 'dispel':
      titles = knowledge[type]?.to_dispel
        ? arrayCombine(knowledge[type]?.to_dispel, knowledge[type]?.to_dispel_add)
        : arrayCombine(knowledge.to_dispel, knowledge.to_dispel_add, knowledge[type]?.to_dispel_add);
      break;
  }
  let title = getRandomFrom(titles, qty);
  return typeof title === 'string' ? { action, title } : title;
}

function getMaxOptions() {
  return assistant.meta.knowledge.maximum_options || 2;
}

function count() {
  console.log("count opened tabs ...");
  let { meta } = assistant;
  chrome.tabs.query({currentWindow: true, windowType: 'normal'}, function(tabs) {
    console.log("tabs in current window", tabs.length);
    let responses = meta.knowledge.count?.responses;
    let arr = tabs.length > 25 ? responses?.many : responses?.less;
    let message = arr?.length ? getRandomFrom(arr) : 'You have [count] opened tabs in current window';
    let replies = generateAnswer('count', 'shutup', getMaxOptions()).map(title => {
      return { action: 'shutup', title }
    });
    sendBalloon(message.replace('[count]', tabs.length), {
      duration: 5000,
      replies
    });
  });
}

function greeting() {
  console.log("greeting ...");
  let { meta } = assistant;
  let possibleResponses = meta.knowledge.greet?.responses;
  if (possibleResponses && possibleResponses.length) {
    let message = getRandomFrom(possibleResponses).replace('[name]', meta.name);
    let replies = generateAnswer('greet', 'shutup', getMaxOptions()).map(title => {
      return { action: 'shutup', title }
    });
    sendBalloon(message, {
      duration: durationGreeting,
      replies
    });
  } else {
    lookup();
  }
}

function dismiss() {
  console.log("dismiss ...");
  let { meta } = assistant;
  let possibleResponses = meta.knowledge.dismiss?.responses;
  if (possibleResponses && possibleResponses.length) {
    let message = getRandomFrom(possibleResponses).replace('[name]', meta.name);
    sendBalloon(message, {
      duration: 10000,
      replies: [
        generateAnswer('dismiss', 'dispel'),
        generateAnswer('dismiss', 'shutup'),
      ],
    });
  } else {
    lookup();
  }
}

function lookup() {
  console.log("lookup ...");
  chrome.tabs.getSelected(null, function(tab) {
    console.log('active tab', tab);
    if (isTabReady(tab)) {
      analizeTab(tab);
    }
  });
}

function isTabReady(tab) {
  return tab && isHttp(tab.url) && tab.status == "complete" && tab.selected;
}