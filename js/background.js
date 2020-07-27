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

(function() {
  $.get('css/content.css', function(css) {
    initOptions = {css};
    console.log('initOptions', initOptions);
  });
})();

chrome.storage.local.get('assistant', function(data) {
  console.log('loaded assistant data', data);
  if (data.assistant) assistant = data.assistant;
  chrome.tabs.getSelected(null, function(tab) {
    if (isTabReady(tab)) {
      initiateAssistant(tabId);
    }
  });
  bindListeners();
});

function bindListeners() {
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log("on action", request, sender);
    let {action, update} = request;
    if (action == 'lookup') {
      if (sender.tab.selected) lookup();
    }
    else if (action == 'count') count();
    else if (action == 'operation') {
      chrome.tabs.create({active: true, url: chrome.runtime.getURL("operation.html?id=" + assistant.meta.id)});
    }
    else if (action == 'update') {
      if (update.hasOwnProperty('activity')) assistant.activity = update.activity;
      if (update.hasOwnProperty('scale')) assistant.scale = update.scale;
      if (update.hasOwnProperty('meta')) {
        assistant.meta = update.meta;
        assistant.dom = update.dom;
        assistant.css = update.css;
      }
      chrome.storage.local.set({assistant}, function() {
        console.log('all data saved!')
      });
    }
    sendResponse({ok: true});
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
      alert(e.message);
      return;
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
    possibleResponses = host.responses || arrayCombine(possibleResponses, host.add_responses);
    if (host.specifics) {
      let specifics = host.specifics.filter(specific => url.includes(specific.keyword));
      if (specifics.length) {
        let specific = specifics[0];
        possibleResponses = specific.responses || arrayCombine(possibleResponses, specific.add_responses);
      }
    }
  } else {
    possibleResponses = meta.knowledge.hosts_unknown.responses || arrayCombine(possibleResponses, meta.knowledge.hosts_unknown.add_responses);
  }

  // process raw message
  let message = getRandomFrom(possibleResponses)
    .replace(/\[name\]/g, assistant.meta.name)
    .replace(/\[title\]/g, item_title)

  // send message
  sendBalloon(message, {
    duration: 5000,
    replies: getRandomFrom([
      {
        action: 'lookup',
        title: getRandomFrom(
          meta.knowledge.click.answers
          ? arrayCombine(meta.knowledge.click.answers, meta.knowledge.click.add_answers)
          : arrayCombine(meta.knowledge.answers, meta.knowledge.add_answers, meta.knowledge.click.add_answers)
        ),
      },
      {
        action: 'dismiss',
        title: getRandomFrom(
          meta.knowledge.click.dispels
          ? arrayCombine(meta.knowledge.click.dispels, meta.knowledge.click.add_dispels)
          : arrayCombine(meta.knowledge.dispels, meta.knowledge.add_dispels, meta.knowledge.click.add_dispels)
        ),
      },
      {
        action: 'shutup',
        title: getRandomFrom(
          meta.knowledge.click.dismiss
          ? arrayCombine(meta.knowledge.click.dismiss, meta.knowledge.click.add_dismiss)
          : arrayCombine(meta.knowledge.dismiss, meta.knowledge.add_dismiss, meta.knowledge.click.add_dismiss)
        ),
      },
    ], meta.knowledge.maximum_options || 2),
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

function count() {
  console.log("count opened tabs ...");
  chrome.tabs.query({currentWindow: true, windowType: 'normal'}, function(tabs) {
    console.log("tabs in current window", tabs.length);
    let arr = [];
    if (tabs.length > 25) {
      arr.push(
        'Njir ' + tabs.length + ' tab!',
        'Buset gan masa buka ' + tabs.length + ' tab!',
        'Banyak amat sampe ' + tabs.length + ' tab!'
      );
    } else {
      arr.push(
        'Ada ' + tabs.length + ' tab yang kebuka',
      );
    }
    sendBalloon(getRandomFrom(arr), {
      duration: 5000,
      replies: [
        {title: 'Oke, thanks', action: 'shutup'},
      ],
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
  return isHttp(tab.url) && tab.status == "complete" && tab.selected;
}