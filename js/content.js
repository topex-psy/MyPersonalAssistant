var timeOutAction;
var timeOutAttention;
var timeOutBalloon;
var timeOutLook;
var timeOutWalk;
var intervalWalk;
var div;

var disableWalk = false;
var isKeepDoing = false;

// got it from: https://stackoverflow.com/a/15506705/5060513
const setAssistantStyle = (() => {
  const style = document.createElement('style');
  document.head.append(style);
  return (styleString) => style.textContent = styleString;
})();

var myAssistant = {
  meta: null,
  el: null,
  options: {
    scale: 1.0,
    mute: false,
  },
  state: {
    activity: null,
    facing: null,
    x: '50',
  }
};

chrome.runtime.sendMessage({action: 'get_init'}, function(response) {
  console.log('get init response', response);
  const style = document.createElement('style');
  style.textContent = response.css;
  document.head.append(style);
  document.body.insertAdjacentHTML('beforeend', `<div class="mpa-container">
    <div class="mpa-balloon">
      <big></big>
      <ul></ul>
    </div>
    <div class="mpa-wrapper"></div>
  </div>`);
  div = document.body.lastElementChild;
});



chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("request received", request, sender);
  let {message, type, options} = request;
  let isReady = !!(div && myAssistant.el);
  let response = {isReady};
  if (request.action == 'init') {
    let { meta, dom, css, state } = options.assistant;
    let { scale, mute } = options.assistant.options;
    setScale(scale, false);
    setMute(mute, false);
    if (isReady) {
      console.log('current assistant exist');
      if (meta?.id) {
        if (myAssistant.state.activity != state.activity) {
          console.log(`... and should sync the activity`);
          setAction(state.activity);
        }
      }
    } else {
      console.log('current assistant not exist');
      if (meta?.id) {
        console.log('but it should exist');
        setAssistant({meta, dom, css, state});
      }
    }
  } else if (request.action == 'get_init') {
    let { scale, mute } = myAssistant.options;
    let { activity, facing, x } = myAssistant.state;
    let { meta } = myAssistant;
    response = {meta, scale, mute, activity, facing, x};
  } else if (request.action == 'get_position') {
    // let {activity, facing, x} = myAssistant.state;
    // response = {activity, facing, x};
  } else if (request.action == 'set_position') {
    // let {activity, facing, x} = options;
    // if (myAssistant.state.activity != activity) setAction(activity);
    // myAssistant.state.facing = facing;
    // myAssistant.state.x = x;
    // setDataAttributes();
    
    // TODO FIXME this will cause laggy animation for 400ms
    // disableWalk = true;
    // div.classList.add('notransition');
    // div.style.left = myAssistant.state.x + '%';
    // setTimeout(() => {
    //   div.classList.remove('notransition');
    //   disableWalk = false;
    // }, 400);

  } else if (request.action == 'assistant') {
    setAssistant(options);
  } else if (request.action == 'request') {
    requestAction(type, options);
  } else if (request.action == 'action') {
    setAction(type, options);
  } else if (request.action == 'balloon') {
    setBalloon(message, options);
  } else if (request.action == 'scale') {
    setScale(options.scale);
  } else if (request.action == 'mute') {
    setMute(options.mute);
  } else if (request.action == 'dismiss') {
    dismiss();
  }
  console.log('sendResponse', response);
  sendResponse(response);
});

function setAssistant({meta, dom, css, state = {}}) {
  if (!div) {
    console.log('not ready yet!');
    return;
  }
  if (meta.id == myAssistant.meta?.id) {
    console.log('same assistant!');
    return;
  }

  myAssistant.el?.remove();
  div.lastElementChild.innerHTML = dom;
  myAssistant.el = div.lastElementChild.firstElementChild;
  myAssistant.el.style.cursor = "pointer";
  myAssistant.el.onclick = onClickAssistant;
  myAssistant.meta = meta;
  setAssistantStyle(css);
  setScale(myAssistant.options.scale, false);
  sendUpdate({meta, dom, css, state});
  closeBalloon();
  doChangeFacing();
  doRandomWalk();
  console.log('setAssistant ...', {meta, dom, css, state});
  console.log('setAssistant', myAssistant);
  if (!myAssistant.options.mute) {
    doRandomLook();
  }
}

function onClickAssistant() {
  let previousActivity = myAssistant.state.activity;
  let { meta } = myAssistant;
  console.log(meta.name + ' clicked while still', previousActivity, myAssistant);
  let balloon = div.firstElementChild;
  let isBalloonShown = balloon.classList.contains('show');
  if (isBalloonShown) {
    closeBalloon();
  } else {
    doNothing();
    myAssistant.el.setAttribute("data-attention", true);
    timeOutAttention = setTimeout(() => {
      myAssistant.el?.removeAttribute("data-attention");
    }, durationAttention);
    requestAction('click');
  }
}

function requestAction(action, options = {}) {
  if (!myAssistant.el) {
    console.log('no assistant to do the', action);
    return;
  }
  if (action == 'shutup') {
    closeBalloon(true);
  } else if (action == 'dispel') {
    dismiss();
  } else if (action == 'delete') {
    chrome.storage.sync.get('my_assistants', function(data) {
      console.log('my assistants data', data);
      let myAssistantList = data.my_assistants || [];
      let findMyAssistant = myAssistantList?.filter(a => a.meta.id == myAssistant.meta.id)[0];
      let index = myAssistantList.indexOf(findMyAssistant);
      let newList = myAssistantList;
      newList.splice(index, 1);
      console.log('newList', newList);
      chrome.storage.sync.set({my_assistants: newList}, function() {
        console.log('assistant data saved!');
      });
      sendUpdate({my_assistants: newList});
      dismiss();
    });
  } else {
    if (action == 'dismiss' || action == 'greeting') doNothing();
    if (action == 'lookup') closeBalloon(true);
    chrome.runtime.sendMessage({action, options}, function(response) {
      console.log(action + ' response', response);
    });
  }
}

function closeBalloon(force = false) {
  if (!myAssistant.el) return;
  let balloon = div.firstElementChild;
  clearTimeout(timeOutBalloon);
  balloon.classList.remove('show');
  if (force) balloon.classList.add('dismissed');
  myAssistant.el.removeAttribute("data-talking");
  myAssistant.el.removeAttribute("data-greeting");
}

function setBalloon(message, {duration, replies, type}) {
  console.log('will show balloon', {message, duration, replies, type});
  if (!myAssistant.el) {
    console.log('but no assistant')
    return;
  }
  if (document.visibilityState === "hidden") {
    console.log('but tab not opened')
    return;
  }
  if (myAssistant.options.mute) {
    console.log('but muted')
    return;
  }
  if (type == 'greeting') {
    myAssistant.el.setAttribute("data-greeting", true);
  }

  let balloon = div.firstElementChild;
  balloon.querySelector('big').innerText = message;

  if (replies) {
    let listActionEl = replies.map(rep => `<li data-action="${rep.action}"><a>${rep.title}</a></li>`).join('');
    balloon.querySelector('ul').innerHTML = listActionEl;
    balloon.querySelectorAll('li a').forEach(li => li.addEventListener('click', e => {
      myAssistant.el?.removeAttribute("data-attention");
      myAssistant.el?.removeAttribute("data-greeting");
      requestAction(e.target.parentNode.getAttribute('data-action'));
    }));
  } else {
    balloon.querySelector('ul').innerHTML = ''
  }

  balloon.classList.remove('dismissed');
  balloon.classList.add('show');
  myAssistant.el.setAttribute("data-talking", true);

  clearTimeout(timeOutBalloon);
  timeOutBalloon = setTimeout(() => {
    closeBalloon();
  }, duration || defaultBalloonDuration);
}

function setAction(action, options = {}, callback = function(){}) {
  if (!myAssistant.el) return;
  doNothing();
  if (!action) return;

  let previousActivity = myAssistant.state.activity;
  let duration = options?.duration || getMinMax(durationActivityMin, durationActivityMax);
  let facing = options?.facing || null;
  isKeepDoing = options?.persist || false;
  console.log("change action from", previousActivity);
  console.log('now do', action, 'for', duration, 'ms');

  if (action == 'walk') {
    facing = facing || getRandomFrom(['left', 'right']);
    intervalWalk = setInterval(doWalk, 100);
  }
  myAssistant.state.activity = action;
  myAssistant.state.facing = facing;
  setDataAttributes();
  sendUpdate({activity: action});
  alignBalloon();

  clearTimeout(timeOutAction);
  timeOutAction = setTimeout(() => doNothing(callback), duration);
}

function setDataAttributes() {
  if (!myAssistant.el) return;
  let {el, state} = myAssistant;
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

function doChangeFacing() {
  let previousFacing = myAssistant.state.facing;
  let newFacing = previousFacing == 'left' ? 'right' : 'left';
  myAssistant.state.facing = newFacing;
  setDataAttributes();
  alignBalloon();
}

function doRandomLook() {
  let delay;
  let level = +myAssistant.meta.talkativeness || 3;
  if (level < 1) level = 1;
  if (level > 5) level = 5;

  switch (level) {
    case 1: delay = 15000 + Math.random() * 70000; break;
    case 2: delay = 12000 + Math.random() * 60000; break;
    case 3: delay = 9000 + Math.random() * 50000; break;
    case 4: delay = 7000 + Math.random() * 40000; break;
    case 5: delay = 5000 + Math.random() * 30000; break;
  }

  console.log('do random look', delay);
  clearTimeout(timeOutLook);
  timeOutLook = setTimeout(() => {
    let mute = myAssistant.options.mute;
    let greeting = myAssistant.el.hasAttribute("data-greeting");
    if (mute || greeting) {
      console.log('lookup prevented', {mute, greeting});
    } else {
      requestAction('lookup');
    }
    doRandomLook();
  }, delay);
}

function doRandomWalk() {
  let delay;
  let level = +myAssistant.meta.hyperactiveness || 3;
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
    if (isKeepDoing || myAssistant.el.hasAttribute("data-greeting")) {
      doRandomWalk();
      return;
    }
    if (Math.random() > .5) {
      setAction('walk', {}, () => doRandomWalk());
    } else {
      let activity = getRandomFrom(myAssistant.meta.activities);
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
  if (disableWalk) return;
  if (myAssistant.state.facing == 'left') {
    myAssistant.state.x--;
    if (myAssistant.state.x <= 10) doChangeFacing();
  } else {
    myAssistant.state.x++;
    if (myAssistant.state.x >= 85) doChangeFacing();
  }
  div.style.left = myAssistant.state.x + '%';
}

function doNothing(callback = function(){}) {
  let previousActivity = myAssistant.state.activity;
  console.log("idle from", previousActivity);
  clearTimeout(timeOutAction);
  clearTimeout(timeOutAttention);
  clearInterval(intervalWalk);
  myAssistant.el.removeAttribute("data-attention");
  myAssistant.el.removeAttribute("data-greeting");
  myAssistant.state.activity = null;
  myAssistant.state.facing = null;
  isKeepDoing = false;
  setDataAttributes();
  sendUpdate({activity: null});
  alignBalloon();
  callback();
}

function setScale(scale = 1.0, sync = true) {
  if (myAssistant.options.scale == scale) return;
  if (sync) sendUpdate({scale});
  myAssistant.options.scale = scale;
  if (myAssistant.el) {
    div.firstElementChild.style.bottom = ((myAssistant.meta.knowledge.balloon_offset?.bottom || defaultBalloonOffsetBottom) * scale) + 'px';
    div.lastElementChild.style.transform = 'scale(' + scale + ')';
    alignBalloon();
  }
}

function setMute(mute = true, sync = true) {
  if (myAssistant.options.mute == mute) return;
  if (sync) sendUpdate({mute});
  myAssistant.options.mute = mute;
  if (mute) {
    closeBalloon();
    clearTimeout(timeOutLook);
    timeOutLook = null;
  } else {
    doRandomLook();
  }
}

function alignBalloon() {
  let {meta, el} = myAssistant;
  let facing = el.getAttribute("data-facing") || 'left';
  let multip = facing == 'left' ? 1 : -1;
  div.firstElementChild.style.marginLeft = ((meta.knowledge.balloon_offset?.left || defaultBalloonOffsetLeft) * multip) + 'px';
  div.firstElementChild.style.marginRight = ((meta.knowledge.balloon_offset?.left || defaultBalloonOffsetLeft) * -multip) + 'px';
  div.classList.remove(facing == 'left' ? 'right' : 'left');
  div.classList.add(facing);
}

function dismiss() {
  if (!myAssistant.el) return;
  doNothing();
  clearTimeout(timeOutLook);
  clearTimeout(timeOutWalk);
  let balloon = div.firstElementChild;
  balloon.querySelector('big').innerText = getRandomFrom(myAssistant.meta.knowledge.dispel?.responses) || 'Good bye!';
  balloon.querySelector('ul').innerHTML = '';
  closeBalloon(true);
  myAssistant.el.remove();
  myAssistant.el = null;
  myAssistant.meta = null;
  sendUpdate({
    meta: null,
    dom: null,
    css: null,
    state: {
      activity: null,
      greet: false,
    },
  });
}

function sendUpdate(update) {
  if (document.visibilityState === "hidden") {
    console.log('visibility', document.visibilityState);
    return;
  }
  chrome.runtime.sendMessage({action: 'update', update}, function(response) {
    console.log('update sent', update, response);
  });
}