var assistant = "doggo";
var options = {};

(function() {
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
    options = {
      manifest,
      knowledge,
      dom,
      css
    };
    console.log('loaded data', options);
    initEditor();
  });
})();

function initEditor() {
  document.querySelector('#panel-html textarea').value = options.dom;
  document.querySelector('#panel-css textarea').value = options.css;
  document.querySelector('#panel-knowledge textarea').value = JSON.stringify(options.knowledge, null, 2);
  document.querySelector('#panel-manifest textarea').value = JSON.stringify(options.manifest, null, 2);
  document.title = "Operation Room";
  checkJSONValidity();
}

window.onhashchange = onTabChange;

function onTabChange() {
  let tab = location.hash.substr(1) || 'manifest';
  console.log('hash changed', tab);
  document.querySelectorAll('[data-tab]').forEach(el => el.style.display = 'none');
  document.querySelectorAll('[data-tab="' + tab + '"]').forEach(el => el.style.display = 'flex');
  document.querySelectorAll('#header a').forEach(a => a.classList.remove('active'));
  document.querySelector('#header a[href="#' + tab + '"]').classList.add('active');
  if (tab == 'code') {
    document.querySelector('#json-success').style.display = 'none';
    document.querySelector('#json-warning').style.display = 'none';
  } else {
    checkJSONValidity();
  }
}

function checkJSONValidity(value = null) {
  if (value == null) {
    let tab = location.hash.substr(1) || 'manifest';
    value = document.getElementById(tab).value
  }
  if (!value) {
    document.querySelector('#json-success').style.display = 'none';
    document.querySelector('#json-warning').style.display = 'none';
  } else if (isJSONValid(value)) {
    document.querySelector('#json-success').style.display = 'flex'
    document.querySelector('#json-warning').style.display = 'none'
  } else {
    document.querySelector('#json-success').style.display = 'none'
    document.querySelector('#json-warning').style.display = 'flex'
  }
}

function isJSONValid(str) {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}

document.addEventListener('DOMContentLoaded', function () {
  document.querySelector('#btn-cancel').onclick = () => window.close();
  document.querySelectorAll('#manifest, #knowledge').forEach(el => {
    el.addEventListener('input', (e) => checkJSONValidity(e.target.value));
  });
  onTabChange();
});