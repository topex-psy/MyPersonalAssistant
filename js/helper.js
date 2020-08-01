var defaultBalloonOffsetBottom = 150;
var defaultBalloonOffsetLeft = 100;
var defaultBalloonDuration = 5000;
var durationGreeting = 8000;
var durationAttention = 3000;
var durationActivityMin = 3000;
var durationActivityMax = 8000;

var isLocal = false;
var baseUrl = isLocal ? '' : 'https://www.taufiknur.com/';
var defaultAssistants = ['doggo', 'menhera'];

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
  if (!array) array = [];
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

function isJSONValid(str) {
  let parsed;
  try {
    parsed = JSON.parse(str);
  } catch (e) {
    return null;
  }
  return parsed;
}

function exportFile({manifest, knowledge, html, css}) {
  var fileName = `${manifest.id}.${exportExtension}`;
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

function writeBlob(content, type = exportMime) {
  try {
    return new Blob([content], {type});
  } catch (e) {
    var BlobBuilder = window.WebKitBlobBuilder || window.MozBlobBuilder || window.BlobBuilder || window.OperaBlobBuilder;
    var bb = new BlobBuilder();
    bb.append(content);
    return bb.getBlob(type);
  }
}