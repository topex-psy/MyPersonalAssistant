var assistant;
var options = {};

(function() {
  console.log('location', location.href)
  assistant = new URL(location.href).searchParams.get("id") || 'new';
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
  document.querySelector('#icon').src = "assistants/" + assistant + "/icon.png";
  document.querySelector('#panel-html textarea').value = options.dom;
  document.querySelector('#panel-css textarea').value = options.css;
  document.querySelector('#panel-knowledge textarea').value = JSON.stringify(options.knowledge, null, 2);
  document.querySelector('#panel-manifest textarea').value = JSON.stringify(options.manifest, null, 2);
  document.title = assistant == 'new' ? "Create New Assistant" : "Operation Room";
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
  // document.documentElement.scrollTop = 0;
  window.scrollTo(0, 0);
}

function checkJSONValidity() {
  let tab = location.hash.substr(1) || 'manifest';
  let value = document.getElementById(tab).value;
  if (!value) {
    document.querySelector('#json-success').style.display = 'none';
    document.querySelector('#json-warning').style.display = 'none';
  } else {
    let parsed = isJSONValid(value);
    if (parsed) {
      let errors = []
      if (tab == 'manifest') {
        if (!parsed.id) errors.push('<code>id</code> property must be set!')
        if (!parsed.name) errors.push('<code>name</code> property must be set!')
        if (!parsed.author) errors.push('<code>author</code> property must be set!')
        if (!parsed.version) errors.push('<code>version</code> property must be set!')
        if (!parsed.activities) errors.push('<code>activities</code> property must be set!')
      } else if (tab == 'knowledge') {
        if (!parsed.click) errors.push('<code>click</code> property must be set!')
        if (!parsed.hosts) errors.push('<code>hosts</code> property must be set!')
        if (!parsed.hosts_unknown) errors.push('<code>hosts_unknown</code> property must be set!')
      }
      if (errors.length) {
        document.querySelector('#json-success').style.display = 'none'
        document.querySelector('#json-warning span').innerHTML = errors.join('<br/>')
        document.querySelector('#json-warning').style.display = 'flex'
      } else {
        document.querySelector('#json-success').style.display = 'flex'
        document.querySelector('#json-warning').style.display = 'none'
      }
    } else {
      document.querySelector('#json-success').style.display = 'none'
      document.querySelector('#json-warning span').innerHTML = 'JSON must be in valid format.'
      document.querySelector('#json-warning').style.display = 'flex'
    }
  }
}

function isJSONValid(str) {
  let parsed;
  try {
    parsed = JSON.parse(str);
  } catch (e) {
    return null;
  }
  return parsed;
}

document.addEventListener('DOMContentLoaded', function () {
  document.querySelector('#btn-cancel').onclick = () => window.close();
  document.querySelectorAll('#manifest, #knowledge').forEach(el => {
    el.addEventListener('input', checkJSONValidity);
  });
  onTabChange();
});