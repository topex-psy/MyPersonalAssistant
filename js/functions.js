$.ajaxSetup({ cache: false });

function fetchAssistant(id, callback = function(){}) {
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
    callback({
      meta,
      dom,
      css
    });
  });
}