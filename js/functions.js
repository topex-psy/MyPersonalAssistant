function hireAssistant(id, callback = function(){}) {
  $.when(
    $.get(baseUrl + 'assistants/' + id + '/html.html'),
    $.get(baseUrl + 'assistants/' + id + '/style.css'),
    $.get(baseUrl + 'assistants/' + id + '/knowledge.json'),
    $.get(baseUrl + 'assistants/' + id + '/manifest.json'),
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
    chrome.storage.sync.get('my_assistants', function(data) {
      let myAssistantList = data.my_assistants || [];
      chrome.storage.sync.set({my_assistants: [...myAssistantList, options]}, function() {
        console.log('assistant data saved!')
        callback(options);
      });
    });
  });
}