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

function isHttp(url) {
  return url?.substring(0, 4) == "http";
}