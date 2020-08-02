console.log('location', location.href);

var initOptions;
var isReady;
var timeOutResponse;
var assistant = {
  meta: null,
  dom: null,
  css: null,
  state: {
    activity: null,
    greet: false,
  },
  options: {
    scale: 1.0,
    mute: false,
  }
};
var position = {
  window: null,
  tab: null,
};


// chrome.storage.sync.clear();

chrome.storage.sync.get('assistant', function(data) {
  console.log('loaded assistant data', data);
  if (data.assistant) assistant = data.assistant;
  chrome.tabs.getSelected(null, function(tab) {
    position.tab = tab.id;
    position.window = tab.windowId;
  });
  bindListeners();
});

function bindListeners() {
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log("on action", request, sender);
    let {action, update, options} = request;
    if (action == 'get_init') {
      $.get('css/content.css', function(css) {
        initOptions = {css};
        console.log('initOptions', initOptions);
        sendResponse(initOptions);
      });
      return true;
    }
    else if (action == 'lookup' && sender.tab.selected) lookup();
    else if (action == 'action') action();
    else if (action == 'click') click();
    else if (action == 'count') count();
    else if (action == 'greeting') greeting();
    else if (action == 'dismiss') dismiss(options);
    else if (action == 'operation') chrome.tabs.create({active: true, url: chrome.runtime.getURL("operation.html?id=" + assistant.meta.id)});
    else if (action == 'update') {
      let sync = false;
      if (update.hasOwnProperty('activity')) {
        assistant.state.activity = update.activity;
      }
      if (update.hasOwnProperty('scale')) {
        assistant.options.scale = update.scale;
        sync = true;
      }
      if (update.hasOwnProperty('mute')) {
        assistant.options.mute = update.mute;
        sync = true;
      }
      if (update.hasOwnProperty('meta')) {
        assistant.meta = update.meta;
        assistant.dom = update.dom;
        assistant.css = update.css;
        assistant.state = update.state || assistant.state;
        if (assistant.meta?.id && !assistant.state.greet) greeting();
        sync = true;
      }
      if (update.hasOwnProperty('dismissed')) {
        assistant.meta = null;
        assistant.dom = null;
        assistant.css = null;
        assistant.state = {
          activity: null,
          greet: false,
        };
        sync = true;
      }
      if (sync) chrome.storage.sync.set({assistant}, function() {
        console.log('assistant data saved!', update);
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
        console.log('initiateAssistant: onActivated');
        initiateAssistant(tabId);
      }
    });
  });
  
  chrome.tabs.onUpdated.addListener(function(tabId, info, tab) {
    console.log("tab updated", tabId, info, tab);
    if (isTabReady(tab)) {
      console.log('initiateAssistant: onUpdated');
      initiateAssistant(tabId);
    }
  });
}

function initiateAssistant(tabId) {
  console.log('initiateAssistant', assistant, tabId);
  let options = { initOptions, assistant };
  chrome.tabs.sendMessage(tabId, { action: 'init', options }, function(response) {
    let error = chrome.runtime.lastError;
    if (error) {  
      console.log('initiateAssistant error', error);
    } else {
      console.log('initiateAssistant response', response)
    }
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
  clearTimeout(timeOutResponse);
  timeOutResponse = setTimeout(() => {
    sendBalloon(message, {
      duration: 5000,
      replies: getRandomFrom([
        generateAnswer('click', 'lookup'),
        generateAnswer('click', 'dismiss'),
        generateAnswer('click', 'shutup'),
      ], getMaxOptions()),
    });
  }, getMinMax(0, 500));
}

function sendBalloon(message, options = {}) {
  chrome.tabs.getSelected(null, function(tab) {
    if (isTabReady(tab)) chrome.tabs.sendMessage(tab.id, {
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
      replies: getRandomFrom([
        generateAnswer('click', 'lookup'),
        generateAnswer('click', 'dismiss'),
        generateAnswer('click', 'action'),
      ], getMaxOptions()),
    });
  } else {
    lookup();
  }
}

function action() {
  let { meta } = assistant;
  let possibleResponses = meta.knowledge.action.responses;
  let message = getRandomFrom(possibleResponses).replace('[name]', meta.name);
  let replies = assistant.meta.activities.map(a => {
    return { action: a.id, title: a.name }
  });
  sendBalloon(message, {
    duration: 8000,
    replies,
  });
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
    case 'action':
      titles = knowledge[type]?.to_action
        ? arrayCombine(knowledge[type]?.to_action, knowledge[type]?.to_action_add)
        : arrayCombine(knowledge.to_action, knowledge.to_action_add, knowledge[type]?.to_action_add);
      break;
  }
  let title = getRandomFrom(titles, qty);
  return typeof title === 'string' ? { action, title } : title;
}

function getMaxOptions() {
  let {maximum_options} = assistant.meta.knowledge;
  if (!maximum_options || maximum_options < 1 || maximum_options > 5) return 2;
  return maximum_options;
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
  console.log("greeting ...", {...assistant});
  let { meta } = assistant;
  let possibleResponses = meta.knowledge.greet?.responses;
  if (possibleResponses && possibleResponses.length) {
    let message = getRandomFrom(possibleResponses).replace('[name]', meta.name);
    let replies = generateAnswer('greet', 'shutup', getMaxOptions()).map(title => {
      return { action: 'shutup', title }
    });
    sendBalloon(message, {
      type: 'greeting',
      duration: durationGreeting,
      replies
    });
  } else {
    lookup();
  }
  assistant.state.greet = true;
}

function dismiss({confirmation = true}) {
  console.log("dismiss ...");
  if (confirmation) {
    let { meta } = assistant;
    let possibleResponses = meta.knowledge.dismiss?.responses;
    if (possibleResponses?.length) {
      let message = getRandomFrom(possibleResponses).replace('[name]', meta.name);
      sendBalloon(message, {
        duration: 10000,
        replies: [
          generateAnswer('dismiss', 'dispel'),
          generateAnswer('dismiss', 'shutup'),
        ],
      });
    } else {
      dispel();
    }
  } else {
    dispel();
  }
}

function dispel() {
  chrome.tabs.query({windowType: 'normal', url: ['http://*/*', 'https://*/*'], status: 'complete'}, function(tabs) {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: 'dismiss' });
    });
  });
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