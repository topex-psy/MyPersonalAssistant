ace.config.set('basePath', 'https://pagecdn.io/lib/ace/1.4.12/');

var exportExtension = 'json';
var exportMime = 'application/json';
var editors = {
  manifest: ace.edit("editor-manifest", { mode: "ace/mode/json" }),
  knowledge: ace.edit("editor-knowledge", { mode: "ace/mode/json" }),
  html: ace.edit("editor-html", { mode: "ace/mode/html" }),
  css: ace.edit("editor-css", { mode: "ace/mode/css" })
};
var init = {
  manifest: {
    id: new URL(location.href).searchParams.get("id") || 'new'
  },
  knowledge: null,
  html: null,
  css: null
};
var isCreate = init.manifest.id == 'new';
var isImporting = false;

// setting up code editor
for (let key in editors) {
  let editor = editors[key];
  editor.setTheme("ace/theme/chrome");
  editor.setShowPrintMargin(false);
  editor.on('change', function(delta) {
    console.log("editor onchange", key, delta);
    codeValidity(key);
  });
  let {session} = editor;
  session.on("changeAnnotation", function() {
    var annotations = session.getAnnotations() || [], i = len = annotations.length;
    while (i--) {
      let {text} = annotations[i];
      if (
        /doctype first\. Expected/.test(text) ||
        /Unexpected End of file\. Expected/.test(text) ||
        /Unqualified attribute selectors/.test(text)
      ) {
        annotations.splice(i, 1);
      }
    }
    if (len > annotations.length) {
      session.setAnnotations(annotations);
    }
  });
}

function getCurrentTab() {
  return location.hash.substr(1) || 'manifest';
}

function flushEditor(key = null) {
  key = key || getCurrentTab();
  if (key == 'code') {
    editors.html.resize();
    editors.css.resize();
  } else {
    editors[key].resize();
  }
}

function codeValidity(key = null) {
  if (isImporting) {
    console.log("still importing ...");
    return;
  }
  let currentTab = getCurrentTab();
  let isTabActive = !key || currentTab == key.replace(/html|css/gi, 'code');
  if (!isTabActive) {
    console.log("no longer in that tab ...");
    return;
  }
  key = key || currentTab;
  console.log("check validity", key);

  if (['code', 'html', 'css'].includes(key)) {
    let annotations = {
      html: editors.html.getSession().getAnnotations().filter(a => a.type == 'error'),
      css: editors.css.getSession().getAnnotations().filter(a => a.type == 'error'),
    };
    let statusHTML = document.querySelector('#panel-html .status');
    let statusCSS = document.querySelector('#panel-css .status');
    console.log('annotations', annotations);
    if (annotations.html.length || annotations.css.length) {
      if (annotations.html.length) statusHTML.classList.add('error'); else statusHTML.classList.remove('error');
      if (annotations.css.length) statusCSS.classList.add('error'); else statusCSS.classList.remove('error');
      document.querySelector('#json-success').style.display = 'none';
      document.querySelector('#json-warning span').innerHTML = `There's some errors. Please fix them!`;
      document.querySelector('#json-warning').style.display = 'flex';
    } else {
      statusHTML.classList.remove('error');
      statusCSS.classList.remove('error');
      document.querySelector('#json-success').style.display = 'flex';
      document.querySelector('#json-warning').style.display = 'none';
    }
    return;
  }

  let value = editors[key].session.getValue();
  if (!value) {
    document.querySelector('#json-success').style.display = 'none';
    document.querySelector('#json-warning').style.display = 'none';
    document.getElementById(key + '-form')?.reset();
  } else {
    let parsed = isJSONValid(value);
    if (parsed) {
      document.getElementById(key + '-form')?.querySelectorAll('input').forEach(input => {
        let name = input.getAttribute('name');
        input.value = parsed[name];
      });
      let errors = []
      if (key == 'manifest') {
        document.getElementById('header-title').innerText = parsed.name || 'Anonymous';
        document.getElementById('header-author').innerText = parsed.author || 'Anonymous';
  
        if (!parsed.id) errors.push('<code>id</code> property must be set!')
        else if (parsed.id.length < 4) errors.push('<code>id</code> property must contains at least 4 letters!')
        else if (parsed.id.length > 50) errors.push('<code>id</code> property must not longer than 50 letters!')
        else if (!/^[a-z]+$/.test(parsed.id)) errors.push('<code>id</code> property must contains only lowercase letters without spaces, numbers, etc!')
        if (!parsed.name) errors.push('<code>name</code> property must be set!')
        if (!parsed.author) errors.push('<code>author</code> property must be set!')
        if (!parsed.version) errors.push('<code>version</code> property must be set!')
        if (!parsed.activities) errors.push('<code>activities</code> property must be set!')
        else if (parsed.activities.filter(a => a.id == 'walk').length) errors.push('<code>id</code> property on <code>activities</code> must be other than "walk"!')
      } else if (key == 'knowledge') {
        if (!parsed.click) errors.push('<code>click</code> property must be set!')
        if (!parsed.hosts) errors.push('<code>hosts</code> property must be set!')
        if (!parsed.hosts_unknown) errors.push('<code>hosts_unknown</code> property must be set!')
      }
      if (errors.length) {
        document.querySelector('#json-success').style.display = 'none';
        document.querySelector('#json-warning span').innerHTML = errors.join('<br/>');
        document.querySelector('#json-warning').style.display = 'flex';
      } else {
        document.querySelector('#json-success').style.display = 'flex';
        document.querySelector('#json-warning').style.display = 'none';
      }
    } else {
      document.querySelector('#json-success').style.display = 'none';
      document.querySelector('#json-warning span').innerHTML = 'JSON must be in valid format.';
      document.querySelector('#json-warning').style.display = 'flex';
    }
  }
}

// load initial data
console.log('location', location.href);
document.title = isCreate ? "Create New Assistant" : "Operation Room";
if (isCreate) {
  $.ajaxSetup({ cache: false });
  $.when(
    $.get(baseUrl + 'assistants/new/html.html'),
    $.get(baseUrl + 'assistants/new/style.css'),
    $.get(baseUrl + 'assistants/new/knowledge.json'),
    $.get(baseUrl + 'assistants/new/manifest.json'),
  ).done(function (htmlResult, cssResult, knowledgeResult, manifestResult) {
    console.log('ajax results', htmlResult, cssResult, knowledgeResult, manifestResult);
    let manifest = manifestResult[0];
    let knowledge = knowledgeResult[0];
    let html = htmlResult[0];
    let css = cssResult[0];
    initEditor({
      ...init,
      manifest,
      knowledge,
      html,
      css
    });
  });
} else {
  chrome.storage.sync.get('my_assistants', function(data) {
    console.log('my assistants data', data);
    let item = data.my_assistants?.filter(a => a.meta.id == init.manifest.id)[0];
    let manifest = item.meta;
    let knowledge = item.meta.knowledge;
    let html = item.dom;
    let css = item.css;
    delete manifest.knowledge;
    isImporting = true;
    initEditor({
      ...init,
      manifest,
      knowledge,
      html,
      css
    });
  });
}

function initEditor(initData) {
  init = initData;
  console.log('loaded data', init);
  document.getElementById('icon').src = baseUrl + "assistants/" + init.manifest.id + "/" + (init.manifest.icon || "icon.png");
  editors.html.session.setValue(init.html);
  editors.css.session.setValue(init.css);
  editors.manifest.session.setValue(JSON.stringify(init.manifest, null, 2));
  editors.knowledge.session.setValue(JSON.stringify(init.knowledge, null, 2));
  document.getElementById('header-title').innerText = init.manifest.name || 'Anonymous';
  document.getElementById('header-author').innerText = init.manifest.author || 'Anonymous';
  for (let key in editors) {
    editors[key].renderer.updateFull();
  }
  isImporting = false;
  console.log('check validity from: initEditor');
  codeValidity();
}

window.onhashchange = onTabChange;

function onTabChange() {
  let tab = location.hash.substr(1) || 'manifest';
  console.log('hash changed', tab);
  document.querySelectorAll('[data-tab]').forEach(el => el.style.display = 'none');
  document.querySelectorAll('[data-tab="' + tab + '"]').forEach(el => el.style.display = 'flex');
  document.querySelectorAll('#header a').forEach(a => a.classList.remove('active'));
  document.querySelector('#header a[href="#' + tab + '"]').classList.add('active');
  switch (tab) {
    case 'manifest':
      editors.manifest.resize();
      break;
    case 'knowledge':
      editors.knowledge.resize();
      break;
    case 'code':
      editors.html.resize();
      editors.css.resize();
      break;
  }
  console.log('check validity from: onTabChange');
  codeValidity();
  window.scrollTo(0, 0);
}

// function finalizeScripts(cssID, setValues = false) {
//   let html = editors.html.session.getValue()
//     .replace(/id="([^"]+)"/, `id="${cssID}"`)
//     .replace(/id=""/, `id="${cssID}"`);
//   let css = editors.css.session.getValue()
//     .replace(/#([^"]+) {/, `#${cssID} {`)
//     .replace(/#([^"]+)\[/g, `#${cssID}\[`)
//     .replace(/#([^"]+)::/g, `#${cssID}::`)
//     .replace(/#([^"]+):/g, `#${cssID}:`)
//     .replace(/#([^"]+)\./g, `#${cssID}\.`)
//     .replace(/# {/, `#${cssID} {`)
//     .replace(/#\[/g, `#${cssID}\[`)
//     .replace(/#::/g, `#${cssID}::`)
//     .replace(/#:/g, `#${cssID}:`)
//     .replace(/#\./g, `#${cssID}\.`);
//   let result = { html, css };
//   if (setValues) {
//     editors.html.session.setValue(html);
//     editors.css.session.setValue(css);
//   }
//   return result;
// }

document.addEventListener('DOMContentLoaded', function () {
  document.body.onclick = (e) => {
    if (!e.target.classList.contains('dropdown') && !e.target.closest('.dropdown'))
      document.querySelectorAll('.dropdown-list').forEach(d => d.classList.remove('show'));
  }
  document.querySelectorAll('.dropdown').forEach(el => el.onclick = (e) => {
    if (e.target.classList.contains('btn-dropdown') || e.target.closest('.btn-dropdown'))
      e.currentTarget.querySelector('.dropdown-list').classList.toggle('show');
  });
  document.querySelector('#file-import').oninput = (e) => {
    var file = e.currentTarget.files[0];
    if (file) {
      isImporting = true;
      var reader = new FileReader();
      reader.readAsText(file, "UTF-8");
      reader.onload = function (evt) {
        let json = isJSONValid(evt.target.result);
        if (json) {
          initEditor(json);
        } else {
          alert("Cannot import: Invalid content!");
        }
      }
      reader.onerror = function (evt) {
        console.log("error reading file", evt);
      }
    }
  }
  document.querySelector('#btn-close').onclick = () => {
    if (confirm(`Are you sure you're done here?`)) window.close();
  }
  document.querySelector('#btn-import').onclick = () => {
    document.querySelector('#file-import').click();
  }
  document.querySelector('#btn-export').onclick = () => {
    let manifest = isJSONValid(editors.manifest.session.getValue());
    let knowledge = isJSONValid(editors.knowledge.session.getValue());
    let html = editors.html.session.getValue();
    let css = editors.css.session.getValue();
    if (manifest && knowledge) {
      exportFile({
        manifest,
        knowledge,
        // ...finalizeScripts(manifest.id + '' + new Date().getTime())
        html,
        css
      });
    } else {
      alert(`Please fix all the errors in order to export!`)
    }
  }
  document.querySelectorAll('.panel-header ul li a').forEach(el => el.onclick = (e) => {
    let panel = e.target.closest(".panel-section");
    panel.setAttribute('data-view', e.target.getAttribute('data-view'));
    flushEditor();
  });
  document.querySelectorAll('#manifest-form input').forEach(el => {
    el.oninput = (e) => {
      let parsed = isJSONValid(editors.manifest.session.getValue());
      if (parsed) {
        parsed[e.target.getAttribute('name')] = e.target.value;
        editors.manifest.session.setValue(JSON.stringify(parsed, null, 2));
        flushEditor('manifest');
      }
    };
  });
  onTabChange();
});