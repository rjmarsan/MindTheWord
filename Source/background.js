console.log("Starting up MindTheWord background page");
var storage = chrome.storage.sync;

function test(phrases) {
  translateOneRequestPerFewWords(phrases, {sourceLanguage: "en", targetLanguage: "es"}, function(translation) {
    console.log(translation);
  });
}

function initializeStorage() {
  storage.get("initialized", function(result) {
    if (!(result.initialized)) {
      var data = {
        initialized: true,
        activation: true,
        blacklist: "(stackoverflow.com|github.com|code.google.com|developer.*.com|duolingo.com)",
        savedPatterns: JSON.stringify([[["en","English"],["it","Italian"],"15",true], [["en","English"],["la","Latin"],"15",false]]),
        sourceLanguage: "en",
        targetLanguage: "it",
        translatedWordStyle: "font-style: italic;\nbackground-color: rgba(200, 100, 50, 0.11);",
        userBlacklistedWords: "(this|that)",
        translationProbability: 15,
        minimumSourceWordLength: 3,
        userDefinedTranslations: '{"the":"the", "a":"a"}',
      };
      console.log("setting defaults: ");
      console.log(data);
      storage.set(data);
    }
  });
}
initializeStorage();


function googleTranslateURL(prefs) {
    var url = 'http://translate.google.com/translate_a/t?client=f&otf=1&pc=0&hl=en';
    var sL = prefs["sourceLanguage"];
    if(sL != 'auto') {
      url += '&sl=' + sL;
    }
    url += '&tl=' + prefs["targetLanguage"];
    url += '&text=';
    return url;
}	


function translateOneRequestPerFewWords(phrases, prefs, callback) {
  var translateRequests = [];
  var maxLength = 2000;
  var currentRequest = "";
  phrases.forEach(function(phrase) {
    var encodedPhrase = encodeURIComponent(phrase + ". . ");
    if (currentRequest.length + encodedPhrase.length <= maxLength) {
      currentRequest += encodedPhrase;
    } else {
      translateRequests.push(currentRequest);
      currentRequest = encodedPhrase;
    }
  });
  translateRequests.push(currentRequest);

  translateORPFWRec(translateRequests.slice(0,4), prefs, callback);
}

function translateORPFWRec(concatWordsArray, prefs, callback) {
  var tMap = {};
  console.log("translateORPFWRec");
  console.debug("concatWordsArray: ", concatWordsArray);
  var finished = 0;
  concatWordsArray.forEach(function(requestPhrases) {
    var url = googleTranslateURL(prefs) + requestPhrases;
    //console.log(url);
    var xhr = new XMLHttpRequest(); xhr.open("GET", url, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        //alert(xhr.responseText);
        //console.log(xhr.responseText);
        var r = JSON.parse(xhr.responseText);
        r.sentences.forEach(function(sentence) {
          var orig = sentence.orig.replace(/\./g, "").trim();
          var trans = sentence.trans.replace(/\./g,"").trim(); // removes punctuation
          tMap[orig] = trans;
        });
        finished += 1;
        if (finished >= concatWordsArray.length) {
          callback(tMap);
        }
      }
    };
    xhr.send();
  });
}  	

function onMessage(request, sender, sendResponse) {
  console.log("onMessage ");
  console.log(request);
  if (request.wordsToBeTranslated) {
    console.log("words to be translated:", request.wordsToBeTranslated);
    storage.get(null, function(prefs) {
      translateOneRequestPerFewWords(request.wordsToBeTranslated, prefs, function(tMap) {
        console.log("translations:", tMap);
        sendResponse({translationMap : tMap});
      });
    });
    //console.log(length(request.wordsToBeTranslated));
  } else if (request.getOptions) {
    storage.get(null, function(data) {
      data.MindTheInjection = [chrome.extension.getURL("/assets/js/mtw.js")];
      console.log("sending getOptions data");
      console.log(data);
      sendResponse(data);
    });
  } else if (request.runMindTheWord) {
    chrome.tabs.onUpdated.addListener(function(tabId, info){ //Wait until page has finished loading
      if(info.status == "complete"){
        console.log(info.status);
        sendResponse(true);
      }
    })
  }
  return true;
};

chrome.runtime.onMessage.addListener(onMessage);

function browserActionClicked() {
  chrome.tabs.create({url:chrome.extension.getURL("options.html")});
}

google_analytics('UA-1471148-13');
console.log("Done setting up MindTheWord background page");
