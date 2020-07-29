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
  document.querySelector('#icon').src = "assistants/" + assistant + "/" + (options.manifest.icon || "icon.png");
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
  window.scrollTo(0, 0);
}

function checkJSONValidity() {
  let tab = location.hash.substr(1) || 'manifest';
  let value = document.getElementById(tab).value;
  if (!value) {
    document.querySelector('#json-success').style.display = 'none';
    document.querySelector('#json-warning').style.display = 'none';
    document.getElementById(tab + '-form')?.reset();
  } else {
    let parsed = isJSONValid(value);
    if (parsed) {
      document.getElementById(tab + '-form')?.querySelectorAll('input').forEach(input => {
        let name = input.getAttribute('name');
        input.value = parsed[name];
      });
      let errors = []
      if (tab == 'manifest') {
        if (!parsed.id) errors.push('<code>id</code> property must be set!')
        else if (parsed.id.length < 4) errors.push('<code>id</code> property must contains at least 4 letters!')
        else if (!/^[a-z]+$/.test(parsed.id)) errors.push('<code>id</code> property must contains only lowercase letters without spaces, numbers, etc!')
        if (!parsed.name) errors.push('<code>name</code> property must be set!')
        if (!parsed.author) errors.push('<code>author</code> property must be set!')
        if (!parsed.version) errors.push('<code>version</code> property must be set!')
        if (!parsed.activities) errors.push('<code>activities</code> property must be set!')
        else if (parsed.activities.filter(a => a.id == 'walk').length) errors.push('<code>id</code> property on <code>activities</code> must be other than "walk"!')
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

function exportFile({manifest, html, css, knowledge}) {
  var fileName = `${manifest.id}.txt`;
  var content = JSON.stringify({manifest, html, css, knowledge}, null, 2);
  var blob = writeBlob(content);
  var url = window.URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  window.URL.revokeObjectURL(url);
}

function writeBlob(content, type = 'text/plain') {
  try {
    return new Blob([content], {type});
  } catch (e) {
    var BlobBuilder = window.WebKitBlobBuilder || window.MozBlobBuilder || window.BlobBuilder || window.OperaBlobBuilder;
    var bb = new BlobBuilder();
    bb.append(content);
    return bb.getBlob(type);
  }
}

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
      var reader = new FileReader();
      reader.readAsText(file, "UTF-8");
      reader.onload = function (evt) {
        let fileContent = evt.target.result;
        console.log("success reading file", fileContent);
        let json = isJSONValid(fileContent);
        if (json) {
          document.getElementById('manifest').value = JSON.stringify(json.manifest, null, 2);
          document.getElementById('html').value = json.html;
          document.getElementById('css').value = json.css;
          document.getElementById('knowledge').value = JSON.stringify(json.knowledge, null, 2);
        } else {
          alert("Cannot import: file content invalid!");
        }
      }
      reader.onerror = function (evt) {
        console.log("error reading file");
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
    let manifest = isJSONValid(document.getElementById('manifest').value);
    let knowledge = isJSONValid(document.getElementById('knowledge').value);
    let html = document.getElementById('html').value;
    let css = document.getElementById('css').value;
    if (manifest && knowledge) {
      exportFile({
        manifest,
        html,
        css,
        knowledge
      });
    } else {
      alert(`Please fix all the errors in order to export!`)
    }
  }
  document.querySelectorAll('.panel-header ul li a').forEach(el => el.onclick = (e) => {
    let panel = e.target.closest(".panel");
    panel.setAttribute('data-view', e.target.getAttribute('data-view'));
  });
  document.querySelectorAll('#manifest, #knowledge').forEach(el => {
    el.addEventListener('input', checkJSONValidity);
  });
  document.querySelectorAll('#manifest-form input').forEach(el => {
    el.oninput = (e) => {
      let json = document.getElementById('manifest').value;
      let parsed = isJSONValid(json);
      if (parsed) {
        parsed[e.target.getAttribute('name')] = e.target.value;
        document.getElementById('manifest').value = JSON.stringify(parsed, null, 2);
      }
      checkJSONValidity();
    };
  });
  onTabChange();
});