var defaultBalloonOffsetBottom = 150;
var defaultBalloonOffsetLeft = 100;
var defaultBalloonDuration = 5000;

var maxDelayGreeting = 3000;
var durationGreeting = 8000;
var durationAttention = 3000;
var durationActivityMin = 3000;
var durationActivityMax = 8000;

function arrayCombine(...arrays) {
  let result = [];
  arrays.forEach(arr => {
    if (arr?.length) result = [...result, ...arr]
  });
  return result;
}

function arrayShuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function getRandomFrom(array, qty = 1) {
  if (qty == 1) return array[Math.floor(Math.random() * array.length)];
  arrayShuffle(array);
  return array.slice(0, qty);
}

function getMinMax(min, max) {
  return min + Math.random() * (max - min)
}

function isHttp(url) {
  return url?.substring(0, 4) == "http";
}