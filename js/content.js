var timeOutAction;
var timeOutAttention;
var timeOutBalloon;
var timeOutGreeting;
var timeOutLook;
var timeOutWalk;
var intervalWalk;
var div;

var disableWalk = false;

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
  },
  state: {
    activity: null,
    facing: null,
    x: '50',
  }
};


chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("request received", request, sender);
  let {message, type, options} = request;
  let isReady = !!(div && myAssistant.el);
  let response = {isReady};
  if (request.action == 'init') {
    let {meta, dom, css, activity, scale } = options.assistant;
    if (isReady) {
      console.log('current assistant exist');
      if (meta?.id) {
        if (myAssistant.options.scale != scale) setScale(scale);
        if (myAssistant.state.activity != activity) setAction(activity);
        if (myAssistant.meta.id != meta.id) setAssistant({meta, dom, css});
      } else {
        dismiss(true);
      }
    } else {
      console.log('initiating assistant');

      if (!div) {
        // initiating css
        const style = document.createElement('style');
        style.textContent = options.initOptions.css;
        document.head.append(style);
  
        // initiating dom
        document.body.insertAdjacentHTML('beforeend', `<div class="mpa-container">
          <div class="mpa-balloon">
            <big></big>
            <ul></ul>
          </div>
          <div class="mpa-wrapper"></div>
        </div>`);
        div = document.body.lastElementChild;
      }

      // initiating ass
      if (meta?.id) {
        setAssistant({meta, dom, css});
      }
    }
  } else if (request.action == 'get_init') {
    let {scale} = myAssistant.options;
    let {activity, facing, x} = myAssistant.state;
    let {meta} = myAssistant;
    response = {meta, scale, activity, facing, x};
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
    requestAction(type);
  } else if (request.action == 'action') {
    setAction(type, options);
  } else if (request.action == 'balloon') {
    setBalloon(message, options);
  } else if (request.action == 'scale') {
    setScale(options.scale);
  } else if (request.action == 'dismissed') {
    dismiss(true);
  }
  console.log('sendResponse', response);
  sendResponse(response);
});

function setAssistant(options = {}) {
  let {meta, dom, css} = options;
  
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

  setScale(myAssistant.options.scale);
  
  closeBalloon();
  setTimeout(() => {
    myAssistant.el.setAttribute("data-greeting", true);
    timeOutGreeting = setTimeout(() => {
      myAssistant.el.removeAttribute("data-greeting");
    }, durationGreeting);
    requestAction('greeting');
  }, maxDelayGreeting * Math.random());

  sendUpdate({meta, dom, css});
  doTheThings();
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
      myAssistant.el.removeAttribute("data-attention");
    }, durationAttention);
    requestAction('click');
  }
}

function requestAction(action) {
  if (action == 'shutup') {
    closeBalloon(true);
  } else if (action == 'dispel') {
    dismiss();
  } else {
    if (action == 'dismiss') doNothing();
    if (action == 'lookup' && myAssistant.el.hasAttribute("data-greeting")) return;
    chrome.runtime.sendMessage({action: action}, function(response) {
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
}

function setBalloon(message, options = {}) {
  if (!myAssistant.el) return;
  console.log("setBalloon", message, options);
  let {duration, replies} = options;

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

  let previousActivity = myAssistant.state.activity;
  let duration = options?.duration || getMinMax(durationActivityMin, durationActivityMax);
  let facing = options?.facing || null;
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
    requestAction('lookup');
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
    let duration;
    if (Math.random() > .5) {
      setAction('walk', {duration}, () => doRandomWalk());
    } else {
      let activity = getRandomFrom(myAssistant.meta.activities);
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

function doTheThings() {
  doChangeFacing();
  doRandomWalk();
  doRandomLook();
}

function doNothing(callback = function(){}) {
  let previousActivity = myAssistant.state.activity;
  console.log("idle from", previousActivity);
  clearTimeout(timeOutAction);
  clearTimeout(timeOutAttention);
  clearTimeout(timeOutGreeting);
  clearInterval(intervalWalk);
  myAssistant.el.removeAttribute("data-attention");
  myAssistant.el.removeAttribute("data-greeting");
  myAssistant.state.activity = null;
  myAssistant.state.facing = null;
  setDataAttributes();
  sendUpdate({activity: null});
  alignBalloon();
  callback();
}

function setScale(scale = 1.0) {
  let {meta, options} = myAssistant;
  div.firstElementChild.style.bottom = ((meta.knowledge.balloon_offset?.bottom || defaultBalloonOffsetBottom) * scale) + 'px';
  div.lastElementChild.style.transform = 'scale(' + scale + ')';
  options.scale = scale;
  sendUpdate({scale});
  alignBalloon();
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

function dismiss(silent = false) {
  if (!myAssistant.el) return;
  doNothing();
  clearTimeout(timeOutLook);
  clearTimeout(timeOutWalk);
  let balloon = div.firstElementChild;
  balloon.querySelector('big').innerText = 'Yaudah, bye!';
  balloon.querySelector('ul').innerHTML = '';
  closeBalloon(true);
  myAssistant.el.remove();
  myAssistant.el = null;
  myAssistant.meta = null;
  if (!silent) sendUpdate({
    meta: null,
    dom: null,
    css: null
  });
}

function sendUpdate(update) {
  chrome.runtime.sendMessage({action: 'update', update}, function(response) {
    console.log('update sent', update, response);
  });
}