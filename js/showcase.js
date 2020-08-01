var showPerpage = 20;
var page = 1;
var timeOutBalloon;
var demoAssistant = {
  meta: null,
  el: null,
  options: {
    scale: 1.0,
    mute: false,
  },
  state: {
    activity: null,
    facing: null,
    x: 50,
  }
};

const setAssistantStyle = (() => {
  const style = document.createElement('style');
  document.head.append(style);
  return (styleString) => style.textContent = styleString;
})();

function getData() {
  let keyword = document.querySelector('#search').value;
  let url = `${baseUrl}assistants/get.php?keyword=${keyword}&page=${page}&limit=${showPerpage}`;
  document.querySelector('#content').classList.add('loading');
  console.log('get data url', url);
  $.get(url, function(results) {
    console.log('get data result', results);

    chrome.storage.sync.get('my_assistants', function(data) {
      let myAssistantsIDs = data.my_assistants?.map(a => a.meta.id) || [];
      let ul = document.querySelector('#list');
      ul.innerHTML = '';
  
      JSON.parse(results).forEach(res => {
        let isHired = myAssistantsIDs.includes(res.ID);
        ul.insertAdjacentHTML('beforeend', `<li data-id="${res.ID}" data-name="${res.NAME}">
          <div class="content">
            <img src="${baseUrl}assistants/${res.ID}/${res.ICON}"/>
            <div class="info">
              <h3>${res.NAME}</h3>
              <p><small>by ${res.AUTHOR}</small></p>
              <p>${res.BIO}</p>
            </div>
            <div class="action">
              <a class="btn btn-hire btn-success" data-active="${isHired}">${isHired ? 'Hired' : 'Hire'}</a>
              <a class="btn btn-demo btn-primary">See demo</a>
              <a class="btn-download">Download .json</a>
            </div>
          </div>
          <div class="footer">
            <a class="btn btn-sm btn-comments no-shadow">${res.COMMENTS} Comments</a>
            <a class="btn btn-sm btn-vote btn-white no-shadow" data-vote="down" title="Vote down">&#x25BC;</a>
            <big class="text-${res.VOTES > 0 ? 'success' : (res.VOTES < 0 ? 'danger' : 'muted')}">${res.VOTES}</big>
            <a class="btn btn-sm btn-vote btn-white no-shadow" data-vote="up" title="Vote up">&#x25B2;</a>
            <a class="btn-report text-danger">Report</a>
          </div>
        </li>`);
      });
      ul.querySelectorAll('li a').forEach(el => el.addEventListener('click', action));
      document.querySelector('#content').classList.remove('loading');
    });
  });
}

getData();

function action(e) {
  let id = e.currentTarget.closest('li').getAttribute('data-id');
  let name = e.currentTarget.closest('li').getAttribute('data-name');
  if (e.currentTarget.classList.contains('btn-hire')) {
    let active = e.currentTarget.getAttribute('data-active') == "true";
    console.log(active ? 'fire' : 'hire', id);
    if (active) {

    } else {
      hireAssistant(id, () => {
        Swal.fire(
          'Hire Success!',
          name + ' has been hired to your list!',
          'success'
        ).then(getData);
      });
    }
  }
  if (e.currentTarget.classList.contains('btn-demo')) {
    console.log('demo', id);
  }
  if (e.currentTarget.classList.contains('btn-download')) {
    console.log('download', id);
    hireAssistant(id, () => {
      Swal.fire(
        'Hire Success!',
        name + ' has been hired to your list!',
        'success'
      ).then((data) => {
        let { manifest, knowledge, html, css } = data;
        exportFile({
          manifest,
          knowledge,
          html,
          css
        });
      });
    });
  }
  if (e.currentTarget.classList.contains('btn-vote')) {
    let vote = e.currentTarget.getAttribute('data-vote');
    console.log('vote', vote, id);
  }
  if (e.currentTarget.classList.contains('btn-comments')) {
    console.log('comment', id);
    let panel = document.querySelector('#panel');
    let prevID = panel.getAttribute('data-id');
    if (prevID != id) {
      panel.setAttribute('data-id', id);
      panel.classList.add('show');
    } else {
      panel.removeAttribute('data-id');
      panel.classList.remove('show');
    }
  }
  if (e.currentTarget.classList.contains('btn-report')) {
    console.log('report', id);
  }
}

function setDemo({meta, dom, css, state = {}}) {
  if (meta.id == demoAssistant.meta?.id) {
    console.log('same assistant!');
    return;
  }

  let div = document.querySelector('#demo');

  demoAssistant.el?.remove();
  div.lastElementChild.innerHTML = dom;
  demoAssistant.el = div.lastElementChild.firstElementChild;
  demoAssistant.el.style.cursor = "pointer";
  demoAssistant.el.onclick = onClickAssistant;
  demoAssistant.meta = meta;
  setAssistantStyle(css);
  // setScale(demoAssistant.options.scale, false);
  // sendUpdate({meta, dom, css, state});
  closeBalloon();
  doChangeFacing();
  doRandomWalk();
  console.log('setAssistant ...', {meta, dom, css, state});
  console.log('setAssistant', demoAssistant);
  doRandomLook();
}

function closeBalloon(force = false) {
  if (!demoAssistant.el) return;
  let balloon = div.firstElementChild;
  clearTimeout(timeOutBalloon);
  balloon.classList.remove('show');
  if (force) balloon.classList.add('dismissed');
  demoAssistant.el.removeAttribute("data-talking");
  demoAssistant.el.removeAttribute("data-greeting");
}

function sendAll(message) {
  console.log('send all', message);
  chrome.tabs.query({windowType: 'normal', url: ['http://*/*', 'https://*/*'], status: 'complete'}, function(tabs) {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, message);
    });
  });
}

document.addEventListener('DOMContentLoaded', function () {
  document.querySelector('#search').onsearch = e => {
    console.log("on search event", e.currentTarget.value);
    getData();
  };
  document.querySelector('#search').oninput = e => {
    if (!e.currentTarget.value) getData();
  };
  document.querySelector('.btn-publish').onclick = () => {
    document.querySelector('#file-import').click();
  };
  document.querySelector('#file-import').oninput = (e) => {
    var file = e.currentTarget.files[0];
    if (file) {
      var reader = new FileReader();
      reader.readAsText(file, "UTF-8");
      reader.onload = function (evt) {
        let { result } = evt.target;
        if (result.toLowerCase().includes('script')) {
          Swal.fire(
            'Publish Failed!',
            'Cannot publish: Contains "script" is not allowed!',
            'error'
          );
          return;
        }
        let json = isJSONValid(result);
        if (json) {
          $.post(`${baseUrl}assistants/post.php`, json, function(response) {
            console.log("post result", response);
            let res = JSON.parse(response);
            if (res.error) {
              Swal.fire(
                'Publish Failed!',
                'Cannot publish: ' + res.error,
                'error'
              );
            } else {
              Swal.fire(
                'Publish Success!',
                'Your assistant has been published to the showcase!',
                'success'
              ).then(getData);
            }
          });
        } else {
          Swal.fire(
            'Publish Failed!',
            'Cannot publish: Invalid content!',
            'error'
          );
        }
      }
      reader.onerror = function (evt) {
        console.log("error reading file", evt);
      }
    }
  };
});