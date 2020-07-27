var timeOutAction;
var timeOutBalloon;
var timeOutLook;
var timeOutWalk;
var intervalWalk;
var div;

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
  let isReady = div && myAssistant.el;
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
        dismiss();
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
        setScale(scale);
      }
    }
  } else if (request.action == 'get_init') {
    let {scale} = myAssistant.options;
    let {activity, facing, x} = myAssistant.state;
    let {meta} = myAssistant;
    response = {meta, scale, activity, facing, x};
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

  myAssistant.el?.remove();
  div.lastElementChild.innerHTML = dom;
  myAssistant.el = div.lastElementChild.firstElementChild;
  myAssistant.el.style.cursor = "pointer";
  myAssistant.el.onclick = onClickAssistant;
  myAssistant.meta = meta;
  setAssistantStyle(css);

  setScale(myAssistant.options.scale);
  
  closeBalloon();
  setTimeout(() => requestAction('lookup'), 3000 * Math.random());

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
    doNothing(); // TODO do terpanggil
    if (Math.random() > .5) {
      let possibleResponses = meta.knowledge.click.responses;
      let message = getRandomFrom(possibleResponses);
      message = message.replace('[name]', myAssistant.meta.name);
      setBalloon(message, {
        duration: 8000,
        replies: [
          {
            action: 'lookup',
            title: getRandomFrom(
              meta.knowledge.click.answers
              ? arrayCombine(meta.knowledge.click.answers, meta.knowledge.click.add_answers)
              : arrayCombine(meta.knowledge.answers, meta.knowledge.add_answers, meta.knowledge.click.add_answers)
            ),
          },
          {
            action: 'dismiss',
            title: getRandomFrom(
              meta.knowledge.click.dispels
              ? arrayCombine(meta.knowledge.click.dispels, meta.knowledge.click.add_dispels)
              : arrayCombine(meta.knowledge.dispels, meta.knowledge.add_dispels, meta.knowledge.click.add_dispels)
            ),
          },
        ],
      });
    } else {
      requestAction('lookup');
    }
  }
}

function requestAction(action) {
  if (action == 'shutup') {
    closeBalloon(true);
  } else if (action == 'dismiss') {
    doNothing();
    setBalloon('Yakin ga mau ditemenin?', {
      duration: 10000,
      replies: [
        {title: getRandomFrom(['Yakin']), action: 'dismiss_for_real'},
        {title: getRandomFrom(['Ga jadi']), action: 'shutup'},
      ],
    });
  } else if (action == 'dismiss_for_real') {
    dismiss();
  } else {
    chrome.runtime.sendMessage({action: action}, function(response) {
      console.log(action + ' response', response);
    });
  }
}

function closeBalloon(force = false) {
  let balloon = div.firstElementChild;
  clearTimeout(timeOutBalloon);
  balloon.classList.remove('show');
  if (force) balloon.classList.add('dismissed');
  myAssistant.el.setAttribute("data-talking", false);
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
  }, duration || 5000);
}

function setAction(action, options = {}, callback = function(){}) {
  if (!myAssistant.el) return;
  doNothing();

  
  let previousActivity = myAssistant.state.activity;
  let duration = options?.duration || (3000 + Math.random() * 5000);
  console.log("change action from", previousActivity);
  console.log('now do', action, 'for', duration, 'ms');

  let facing;
  if (action == 'walk') {
    facing = getRandomFrom(['left', 'right']);
    intervalWalk = setInterval(doWalk, 100);
  } else {
    facing = '';
  }
  myAssistant.state.facing = facing;
  myAssistant.el.setAttribute("data-activity", action);
  myAssistant.el.setAttribute("data-facing", facing);
  myAssistant.state.activity = action;
  sendUpdate({activity: action});
  alignBalloon();

  clearTimeout(timeOutAction);
  timeOutAction = setTimeout(() => doNothing(callback), duration);
}

function doChangeFacing() {
  let previousFacing = myAssistant.state.facing;
  let newFacing = previousFacing == 'left' ? 'right' : 'left';
  myAssistant.state.facing = newFacing;
  myAssistant.el.setAttribute("data-facing", newFacing);
  alignBalloon();
}

function doRandomLook() {
  let delay;
  let level = +myAssistant.meta.talkativeness;
  if (level == 1) delay = 15000 + Math.random() * 70000;
  else if (level == 2) delay = 12000 + Math.random() * 60000;
  else if (level == 4) delay = 7000 + Math.random() * 40000;
  else if (level == 5) delay = 5000 + Math.random() * 30000;
  else delay = 9000 + Math.random() * 50000;

  console.log('do random look', delay);
  clearTimeout(timeOutLook);
  timeOutLook = setTimeout(() => {
    requestAction('lookup');
    doRandomLook();
  }, delay);
}

function doRandomWalk() {
  let delay;
  let level = +myAssistant.meta.hyperactiveness;
  if (level == 1) delay = 15000 + Math.random() * 30000;
  else if (level == 2) delay = 10000 + Math.random() * 30000;
  else if (level == 4) delay = 5000 + Math.random() * 20000;
  else if (level == 5) delay = 5000 + Math.random() * 10000;
  else delay = 5000 + Math.random() * 30000;

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
        duration = durationMin + Math.random() * (durationMax - durationMin);
      } else {
        duration = +activity.duration;
      }
      setAction(activity.id, {duration}, () => doRandomWalk());
    }
  }, delay);
}

function doWalk() {
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
  myAssistant.el.removeAttribute("data-activity");
  myAssistant.el.removeAttribute("data-facing");
  myAssistant.state.activity = null;
  clearTimeout(timeOutAction);
  clearInterval(intervalWalk);
  sendUpdate({activity: null});
  alignBalloon();
  callback();
}

function setScale(scale = 1.0) {
  div.firstElementChild.style.bottom = ((myAssistant.meta.knowledge.balloon_offset?.bottom || 150) * scale) + 'px';
  div.lastElementChild.style.transform = 'scale(' + scale + ')';
  myAssistant.options.scale = scale;
  sendUpdate({scale});
  alignBalloon();
}

function alignBalloon() {
  let facing = myAssistant.el.getAttribute("data-facing") || 'left';
  let multip = facing == 'left' ? 1 : -1;
  div.firstElementChild.style.marginLeft = ((myAssistant.meta.knowledge.balloon_offset?.left || 100) * multip) + 'px';
  div.firstElementChild.style.marginRight = ((myAssistant.meta.knowledge.balloon_offset?.left || 100) * -multip) + 'px';
  div.classList.remove(facing == 'left' ? 'right' : 'left');
  div.classList.add(facing);
}

function dismiss() {
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
  sendUpdate({
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