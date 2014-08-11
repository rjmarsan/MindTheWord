// Copyright (c) 2011-2013 Bruno Woltzenlogel Paleo. All rights reserved.
// With a little help of these awesome guys, https://github.com/OiWorld/MindTheWord/graphs/contributors!
NodeList.prototype.forEach = Array.prototype.forEach; 

var sl, tl, customURLs;

var cssClass = "mtwTranslatedWord";

function insertCSS(cssStyle) {
  document.styleSheets[0].insertRule("span."+cssClass+".translated {" + cssStyle + "}", 0);
  document.styleSheets[0].insertRule("span."+cssClass+".failure {background-color:rgba(100,0,0,0.3);}", 0);
  var s = document.createElement("script");
  s.setAttribute("src", customURLs[0]);
  document.getElementsByTagName("head")[0].appendChild(s);
}

function requestTranslations(sourceWords, callback) {
  chrome.runtime.sendMessage({wordsToBeTranslated : sourceWords }, function(response) {
      callback(response.translationMap);
  });
}

function processTranslations(translationMap) { 
  if (length(translationMap) != 0) {
    var translationSpans = document.querySelectorAll("span."+cssClass);
    translationSpans.forEach(function(span, index) {
      var original = span.dataset.original;
      if (original in translationMap) {
        span.innerHTML = translationMap[original];
        span.dataset.translated = translationMap[original];
        span.className+= " translated";
        span.onclick=function() { __mindtheword.toggleElement(this);};
      } else {
        span.className+= " failure";
      }
    });
  }
}

function length(obj) {
  return Object.keys(obj).length;
}

// More precise than the old one
function filterSourceWords(countedWords, translationProbability, minimumSourceWordLength, userBlacklistedWords) {
  var userBlacklistedWords = new RegExp(userBlacklistedWords);
  return countedWords;
  var countedWordsList = shuffle(toList(countedWords, function(word, count) {
    return !!word && word.length >= minimumSourceWordLength && // no words that are too short
	  word != "" && !/\d/.test(word) && // no empty words
	  //word.charAt(0) != word.charAt(0).toUpperCase() && // no proper nouns
	  !userBlacklistedWords.test(word.toLowerCase()); // no blacklisted words
  }));

  var targetLength = Math.floor((countedWordsList.length * translationProbability) / 100);
  return toMap(countedWordsList.slice(0, targetLength - 1));
}

function toList(map, filter) {
  var list = [];
  for (var item in map) {
    if (filter(item, map[item])) {
      list.push(item);
    }
  }
  return list;
}

function toMap(list) {
  var map = {};
  for (var i=0; i<list.length; i++) {
    map[list[i]] = 1;
  }
  return map;
}

function shuffle(o) {
  for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
  return o;
}

function getAllWords() {
  var selection = {
    maxChars: 100000,
    charCount: 0,
    minLength: 5,
    minWords: 1,
    countedSelection: {},
    splitRegex: /[,\.\?\!]/g
  };
  var paragraphs = document.getElementsByTagName('p');
  console.log("Getting words from all "+paragraphs.length+" paragraphs");
  for (var i=0; i<paragraphs.length && selection.charCount<selection.maxChars; i++) {
    deepSelectText(paragraphs[i], selection);
  }
  console.log("Counted "+selection.charCount+" characters");
  return selection.countedSelection;
}

function deepSelectText(node, selection) {
  var badTags = ['TEXTAREA', 'INPUT', 'SCRIPT', 'CODE', 'A'];
  if (node.nodeType == Node.TEXT_NODE) {
    selectTextNode(node.nodeValue, node.parentNode, selection);
  } else if (node.nodeType == Node.ELEMENT_NODE && !!badTags.indexOf(node.tagName)) {
    var child = node.firstChild;
    while (child){
        if (selection.charCount > selection.maxChars) {
          console.log("Too many chars! "+selection.charCount);
          return;
        }
        deepSelectText(child, selection);
        child = child.nextSibling;
    }
  }
}

function selectTextNode(text, parent, selection) {
  var phrases = text.split(selection.splitRegex);
  var parentHtml = parent.innerHTML;
  var phrasesInThisParagraph = {};
  for (var i=0; i<phrases.length; i++) {
    var phrase = sanitizeTextSelection(phrases[i]);
    if (!!phrase && phrase.length > selection.minLength && phrase.split(" ").length > selection.minWords) {
      if (!(phrase in selection.countedSelection)) {
        selection.countedSelection[phrase] = 0;
        selection.charCount += phrase.length;
      }
      selection.countedSelection[phrase] += 1;
      if (!(phrase in phrasesInThisParagraph)) {
        parentHtml = parentHtml.replace(phrase, getTranslationSpan(phrase));
        phrasesInThisParagraph[phrase] = 1;
      }
    }
  }
  parent.innerHTML = parentHtml;
}

function sanitizeTextSelection(text) {
  return text.trim().replace("\"", "\\\"");
}

function getTranslationSpan(text) {
  return "<span class=\""+cssClass+"\" data-original=\""+text+"\">"+text+"</span>";
}

__mindtheword = new function() {
	this.translated = true;
	this.toggleAllElements = function() {
		this.translated = !this.translated;
		var words = document.getElementsByClassName('mtwTranslatedWord');
		for (var i=0; i<words.length; i++) {
			var word = words[i];
			word.innerHTML = (this.translated) ? word.dataset.translated: word.dataset.original;
		}
	};
  this.isTranslated = function() {
    return this.translated;
  };
  this.toggleElement = function(elem) {
    var word = elem.innerHTML;
    var newword = (word == elem.dataset.translated) ? elem.dataset.original : elem.dataset.translated;
          elem.innerHTML = newword;
  };
};

function main(translationProbability, minimumSourceWordLength, userDefinedTranslations, userBlacklistedWords) {
  console.log('starting translation');
  var countedWords = getAllWords();
  console.log(countedWords);
  requestTranslations(filterSourceWords(countedWords, translationProbability, minimumSourceWordLength, userBlacklistedWords),
          function(tMap) {processTranslations(tMap, userDefinedTranslations);}); 
}

console.log("mindTheWord running");
chrome.runtime.sendMessage({getOptions : "Give me the options chosen by the user..." }, function(r) {
  console.log("got data. activated? " + r.activation);
  var blacklist = new RegExp(r.blacklist);
  sl = r.sourceLanguage;
  tl = r.targetLanguage;
  customURLs = r.MindTheInjection;
  if (!!r.activation && !blacklist.test(document.URL)) {
    insertCSS(r.translatedWordStyle);
    chrome.runtime.sendMessage({runMindTheWord: "Pretty please?"}, function(){
      main(r.translationProbability, r.minimumSourceWordLength, JSON.parse(r.userDefinedTranslations), r.userBlacklistedWords);
    })
  }
});
