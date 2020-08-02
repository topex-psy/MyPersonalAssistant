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
    x: 50,
  }
};

chrome.runtime?.sendMessage({action: 'get_init'}, function(response) {
  console.log('get init response', response);
  const style = document.createElement('style');
  style.textContent = response.css;
  document.head.append(style);
  document.body.insertAdjacentHTML('beforeend', `<div class="mpa-container">
    <div class="mpa-balloon">
      <big></big>
      <ul></ul>
      <img class="mpa-balloon-mute" title="Muted" src="data:image/png;base64,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"/>
    </div>
    <div class="mpa-wrapper"></div>
  </div>`);
  div = document.body.lastElementChild;
  div.firstElementChild.lastElementChild.onclick = () => setMute(false);
});



chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("request received", request, sender);
  let {message, type, options} = request;
  let isReady = !!(div && myAssistant.el);
  let response = {isReady};
  if (request.action == 'init') {
    let { meta, dom, css, state } = options.assistant;
    let { scale, mute } = options.assistant.options;
    if (isReady) {
      setScale(scale, false);
      setMute(mute, false);
      console.log('current assistant exist');
      if (meta?.id) {
        if (myAssistant.state.activity != state.activity) {
          console.log(`... and should sync the activity`);
          setAction(state.activity);
        }
      } else {
        console.log(`but it shouldn't be`);
        dismiss(false);
      }
    } else {
      myAssistant.options.scale = scale;
      myAssistant.options.mute = mute;
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
  } else if (request.action == 'remove') {
    if (myAssistant.meta.id == options.id) dismiss(false);
  }
  console.log('response sent for', request.action, response);
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
  // console.log("set scale from setAssistant");
  setScale(myAssistant.options.scale, false);
  sendUpdate({meta, dom, css, state});
  closeBalloon();
  doChangeFacing();
  doRandomWalk();
  console.log('setAssistant ...', {meta, dom, css, state});
  console.log('setAssistant', myAssistant);
  if (!myAssistant.options.mute) {
    // console.log('doRandomLook from setAssistant');
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
    chrome.runtime?.sendMessage({action, options}, function(response) {
      let error = chrome.runtime.lastError;
      if (error) {
        console.log(action + ' error', error.message);
      } else {
        console.log(action + ' response', response);
      }
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
  if (type == 'greeting') {
    myAssistant.el.setAttribute("data-greeting", true);
  }

  let balloon = div.firstElementChild;
  balloon.querySelector('big').innerText = message;

  if (replies) {
    let listActionEl = replies.map(rep => `<li data-action="${rep.action}"><a>${rep.title}</a></li>`).join('');
    balloon.querySelector('ul').innerHTML = listActionEl;
    balloon.querySelectorAll('li a').forEach(li => li.addEventListener('click', e => {
      let action = e.currentTarget.parentNode.getAttribute('data-action');
      myAssistant.el?.removeAttribute("data-attention");
      myAssistant.el?.removeAttribute("data-greeting");
      let isAction = myAssistant.meta.activities.filter(a => a.id == action).length > 0;
      console.log('click action', action, isAction);
      if (isAction) {
        setAction(action);
      } else {
        requestAction(action);
      }
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
  // console.log('doRandomLook ...', {...myAssistant.meta});
  if (!myAssistant.meta) return;
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

  // console.log('do random look', delay);
  clearTimeout(timeOutLook);
  timeOutLook = setTimeout(() => {
    let mute = myAssistant.options.mute;
    let greeting = myAssistant.el.hasAttribute("data-greeting");
    if (mute || greeting) {
      console.log('lookup prevented', {mute, greeting});
    } else {
      requestAction('lookup');
    }
    // console.log('doRandomLook from doRandomLook');
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
  console.log("set scale", scale, sync, {...myAssistant});
  if (sync) {
    if (myAssistant.options.scale == scale) return;
    sendUpdate({scale});
  }
  myAssistant.options.scale = scale;
  if (myAssistant.el) {
    div.firstElementChild.style.bottom = ((myAssistant.meta.knowledge.balloon_offset?.bottom || defaultBalloonOffsetBottom) * scale) + 'px';
    div.lastElementChild.style.transform = 'scale(' + scale + ')';
    div.lastElementChild.classList.remove('animate');
    setTimeout(() => {
      div.lastElementChild.classList.add('animate');
    }, 400);
    alignBalloon();
  }
}

function setMute(mute = true, sync = true) {
  console.log("set mute", mute, sync);
  if (sync) {
    if (myAssistant.options.mute == mute) return;
    sendUpdate({mute});
  }
  myAssistant.options.mute = mute;
  if (mute) {
    closeBalloon();
    clearTimeout(timeOutLook);
    timeOutLook = null;
    div.firstElementChild.lastElementChild.style.display = 'block';
  } else {
    // console.log('doRandomLook from setMute');
    doRandomLook();
    div.firstElementChild.lastElementChild.style.display = 'none';
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

function dismiss(sync = true) {
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
  // sendUpdate({
  //   meta: null,
  //   dom: null,
  //   css: null,
  //   state: {
  //     activity: null,
  //     greet: false,
  //   },
  // });
  if (sync) sendUpdate({ dismissed: true });
}

function sendUpdate(update) {
  if (document.visibilityState === "hidden") {
    console.log('update not sent because visibility', document.visibilityState);
    return;
  }
  chrome.runtime?.sendMessage({action: 'update', update}, function(response) {
    console.log('update sent', update, response);
  });
}