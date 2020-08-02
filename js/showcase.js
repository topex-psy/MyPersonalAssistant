var showPerpage = 20;
var page = 1;
var timeOutAction;
var timeOutAttention;
var timeOutBalloon;
var timeOutWalk;
var intervalWalk;
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
var div;
var isKeepDoing = false;

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000
});

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
      // let myAssistantsIDs = data.my_assistants?.map(a => a.meta.id) || [];
      let myAssistantsIDs = data.my_assistants ? data.my_assistants.map(a => a.meta.id) : defaultAssistants;
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
  let el = e.currentTarget;
  let id = el.closest('li').getAttribute('data-id');
  let name = el.closest('li').getAttribute('data-name');
  if (el.classList.contains('btn-hire')) {
    let active = el.getAttribute('data-active') == "true";
    console.log(active ? 'fire' : 'hire', id);
    if (active) {
      Swal.fire({
        text: `Are you sure you want to remove ${name}?`,
        type: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
      }).then((result) => {
        if (result.value) {
          chrome.storage.sync.get('my_assistants', function(data) {
            console.log('my assistants data', data);
            let myAssistantList = data.my_assistants || [];
            let findMyAssistant = myAssistantList?.filter(a => a.meta.id == id)[0];
            let index = myAssistantList.indexOf(findMyAssistant);
            let newList = myAssistantList;
            newList.splice(index, 1);
            console.log('newList', newList);
            chrome.storage.sync.set({my_assistants: newList}, function() {
              console.log('assistant data saved!');
              sendAll({action: 'remove', options: {id}});
              let update = { dismissed: true };
              chrome.runtime.sendMessage({action: 'update', update}, function(response) {
                console.log('update sent', update, response);
              });
              getData();
            });
          });
        }
      });
    } else {
      fetchAssistant(id, (result) => {
        chrome.storage.sync.get('my_assistants', function(data) {
          let myAssistantList = data.my_assistants || [];
          chrome.storage.sync.set({my_assistants: [...myAssistantList, result]}, function() {
            console.log('assistant data saved!')
            getData();
          });
        });
        Toast.fire({
          text: name + ' has been hired to your list!',
          type: 'success',
        })
      });
    }
  }
  if (el.classList.contains('btn-demo')) {
    if (el.classList.contains('active')) {
      console.log('dismiss', id);
      dismiss();
    } else {
      console.log('demo', id);
      fetchAssistant(id, seeDemo);
    }
  }
  if (el.classList.contains('btn-download')) {
    console.log('download', id);
    fetchAssistant(id, ({ meta, dom, css }) => {
      let html = dom;
      let knowledge = meta.knowledge;
      let manifest = meta;
      delete manifest.knowledge;
      exportFile({
        manifest,
        knowledge,
        html,
        css
      });
    });
  }
  if (el.classList.contains('btn-vote')) {
    let vote = el.getAttribute('data-vote');
    console.log('vote', vote, id);
  }
  if (el.classList.contains('btn-comments')) {
    console.log('comment', id);
  }
  if (el.classList.contains('btn-report')) {
    console.log('report', id);
  }
}

function getMaxOptions() {
  let {maximum_options} = demoAssistant.meta.knowledge;
  if (!maximum_options || maximum_options < 1 || maximum_options > 5) return 2;
  return maximum_options;
}

function onClickAssistant() {
  if (Math.random() > .5) selectAction(); else click();
}

function click() {
  let { meta } = demoAssistant;
  let possibleResponses = meta.knowledge.click.responses;
  let message = getRandomFrom(possibleResponses).replace('[name]', meta.name);
  let replies = [
    generateAnswer('click', 'dismiss'),
    generateAnswer('click', 'action'),
  ];
  setBalloon(message, {
    duration: 8000,
    replies,
  });
}

function selectAction() {
  let { meta } = demoAssistant;
  let possibleResponses = meta.knowledge.action.responses;
  let message = getRandomFrom(possibleResponses).replace('[name]', meta.name);
  let replies = demoAssistant.meta.activities.map(a => {
    return { action: a.id, title: a.name }
  });
  setBalloon(message, {
    duration: 8000,
    replies,
  });
}

function dismiss() {
  if (!demoAssistant.el) return;
  document.querySelectorAll('.btn-demo').forEach(el => el.classList.remove('active'));
  doNothing();
  clearTimeout(timeOutWalk);
  let balloon = div.firstElementChild;
  balloon.querySelector('big').innerText = getRandomFrom(demoAssistant.meta.knowledge.dispel?.responses) || 'Good bye!';
  balloon.querySelector('ul').innerHTML = '';
  closeBalloon(true);
  demoAssistant.el.remove();
  demoAssistant.el = null;
  demoAssistant.meta = null;
}

function generateAnswer(type = 'click', action = 'shutup', qty = 1) {
  let { knowledge } = demoAssistant.meta;
  let titles = action;
  switch (action) {
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
    case 'action':
      titles = knowledge[type]?.to_action
        ? arrayCombine(knowledge[type]?.to_action, knowledge[type]?.to_action_add)
        : arrayCombine(knowledge.to_action, knowledge.to_action_add, knowledge[type]?.to_action_add);
      break;
  }
  let title = getRandomFrom(titles, qty);
  return typeof title === 'string' ? { action, title } : title;
}

function seeDemo({meta, dom, css, state = {}}) {
  if (meta.id == demoAssistant.meta?.id) {
    console.log('same assistant!');
    return;
  }

  div = document.querySelector('#demo');

  document.querySelectorAll('.btn-demo').forEach(el => el.classList.remove('active'));
  document.querySelector(`#list li[data-id="${meta.id}"] .btn-demo`).classList.add('active');

  demoAssistant.el?.remove();
  div.lastElementChild.innerHTML = dom;
  demoAssistant.el = div.lastElementChild.firstElementChild;
  demoAssistant.el.style.cursor = "pointer";
  demoAssistant.el.onclick = onClickAssistant;
  demoAssistant.meta = meta;
  setAssistantStyle(css);
  div.firstElementChild.style.bottom = (demoAssistant.meta.knowledge.balloon_offset?.bottom || defaultBalloonOffsetBottom) + 'px';
  closeBalloon();
  doChangeFacing();
  doRandomWalk();
  console.log('setAssistant ...', {meta, dom, css, state});
  console.log('setAssistant', demoAssistant);
}

function setAction(action, options = {}, callback = function(){}) {
  if (!demoAssistant.el) return;
  doNothing();
  if (!action) return;

  let previousActivity = demoAssistant.state.activity;
  let duration = options?.duration || getMinMax(durationActivityMin, durationActivityMax);
  let facing = options?.facing || null;
  isKeepDoing = options?.persist || false;
  console.log("change action from", previousActivity);
  console.log('now do', action, 'for', duration, 'ms');

  if (action == 'walk') {
    facing = facing || getRandomFrom(['left', 'right']);
    intervalWalk = setInterval(doWalk, 100);
  }
  demoAssistant.state.activity = action;
  demoAssistant.state.facing = facing;
  setDataAttributes();
  alignBalloon();

  clearTimeout(timeOutAction);
  timeOutAction = setTimeout(() => doNothing(callback), duration);
}

function setBalloon(message, {duration, replies, type}) {
  console.log('setBalloon', message, {duration, replies, type});
  if (type == 'greeting') {
    demoAssistant.el.setAttribute("data-greeting", true);
  }

  let balloon = div.firstElementChild;
  balloon.querySelector('big').innerText = message;

  if (replies) {
    let listActionEl = replies.map(rep => `<li data-action="${rep.action}"><a>${rep.title}</a></li>`).join('');
    balloon.querySelector('ul').innerHTML = listActionEl;
    balloon.querySelectorAll('li a').forEach(li => li.addEventListener('click', e => {
      demoAssistant.el?.removeAttribute("data-attention");
      demoAssistant.el?.removeAttribute("data-greeting");
      let action = e.currentTarget.parentNode.getAttribute('data-action');
      closeBalloon(true);
      switch (action) {
        case 'action':
          selectAction();
          break;
        case 'shutup':
          break;
        case 'dismiss':
          dismiss();
          break;
        default:
          setAction(action, {persist: true});
      }
    }));
  } else {
    balloon.querySelector('ul').innerHTML = ''
  }

  balloon.classList.remove('dismissed');
  balloon.classList.add('show');
  demoAssistant.el.setAttribute("data-talking", true);

  clearTimeout(timeOutBalloon);
  timeOutBalloon = setTimeout(() => {
    closeBalloon();
  }, duration || defaultBalloonDuration);
}

function doRandomWalk() {
  let delay;
  let level = +demoAssistant.meta.hyperactiveness || 3;
  if (level < 1) level = 1;
  if (level > 5) level = 5;

  switch (level) {
    case 1: delay = 15000 + Math.random() * 30000; break;
    case 2: delay = 10000 + Math.random() * 30000; break;
    case 3: delay = 5000 + Math.random() * 30000; break;
    case 4: delay = 5000 + Math.random() * 20000; break;
    case 5: delay = 5000 + Math.random() * 10000; break;
  }

  clearTimeout(timeOutWalk);
  timeOutWalk = setTimeout(() => {
    if (isKeepDoing || demoAssistant.el.hasAttribute("data-greeting")) {
      doRandomWalk();
      return;
    }
    if (Math.random() > .5) {
      setAction('walk', {}, () => doRandomWalk());
    } else {
      let activity = getRandomFrom(demoAssistant.meta.activities);
      let duration;
      let durationMin = +activity.durationMin;
      let durationMax = +activity.durationMax;
      if (durationMin && durationMax) {
        duration = getMinMax(durationMin, durationMax);
      } else {
        duration = +activity.duration;
      }
      setAction(activity.id, {duration}, () => doRandomWalk());
    }
  }, delay);
}

function doWalk() {
  if (demoAssistant.state.facing == 'left') {
    demoAssistant.state.x--;
    if (demoAssistant.state.x <= 10) doChangeFacing();
  } else {
    demoAssistant.state.x++;
    if (demoAssistant.state.x >= 85) doChangeFacing();
  }
  div.style.left = demoAssistant.state.x + '%';
}

function doChangeFacing() {
  let previousFacing = demoAssistant.state.facing;
  let newFacing = previousFacing == 'left' ? 'right' : 'left';
  demoAssistant.state.facing = newFacing;
  setDataAttributes();
  alignBalloon();
}

function doNothing(callback = function(){}) {
  let previousActivity = demoAssistant.state.activity;
  console.log("idle from", previousActivity);
  clearTimeout(timeOutAction);
  clearTimeout(timeOutAttention);
  clearInterval(intervalWalk);
  demoAssistant.el.removeAttribute("data-attention");
  demoAssistant.el.removeAttribute("data-greeting");
  demoAssistant.state.activity = null;
  demoAssistant.state.facing = null;
  isKeepDoing = false;
  setDataAttributes();
  alignBalloon();
  callback();
}

function setDataAttributes() {
  if (!demoAssistant.el) return;
  let {el, state} = demoAssistant;
  let {activity, facing} = state;
  if (activity) {
    el.setAttribute("data-activity", activity);
  } else {
    el.removeAttribute("data-activity");
  }
  if (facing) {
    el.setAttribute("data-facing", facing);
  } else {
    el.removeAttribute("data-facing");
  }
}

function alignBalloon() {
  let {meta, el} = demoAssistant;
  let facing = el.getAttribute("data-facing") || 'left';
  let multip = facing == 'left' ? 1 : -1;
  div.firstElementChild.style.marginLeft = ((meta.knowledge.balloon_offset?.left || defaultBalloonOffsetLeft) * multip) + 'px';
  div.firstElementChild.style.marginRight = ((meta.knowledge.balloon_offset?.left || defaultBalloonOffsetLeft) * -multip) + 'px';
  div.classList.remove(facing == 'left' ? 'right' : 'left');
  div.classList.add(facing);
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
      console.log('sent to', tab.url);
      chrome.tabs.sendMessage(tab.id, message, function(response) {
        let error = chrome.runtime.lastError;
        if (error) {  
          console.log('send all error', error);
        } else {
          console.log('send all response', response)
        }
      });
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