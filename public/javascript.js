// avoid warnings from early browsers
if (typeof console === "undefined") {
  console = { log: function() {} };
}

var BLUR_INTENTION_TIMEOUT_MILLIS = 6000;
var AJAX_TIMEOUT_MILLIS = 4000;
var OVER_TIME_FLASH_RATE_MILLIS = 1000;
var DEFAULT_INTENDED_DURATION_MINS = 30;
var NO_ACTIVITY_NUM = -1;

var noActivity = 
  { color: "#444",  message: "&nbsp;",        totalTime: "--:--:--" };
var activities = [
  { color: "blue",  message: "domestic",      totalTime: "--:--:--" },
  { color: "green", message: "improve",       totalTime: "--:--:--" },
  { color: "red",   message: "exercise",      totalTime: "--:--:--" },
  { color: "yellow",message: "estimation",    totalTime: "--:--:--" },
  { color: "#505",  message: "social online", totalTime: "--:--:--" },
  { color: "#730",  message: "DVC plan",      totalTime: "--:--:--" },
  { color: "#660",  message: "DVC next",      totalTime: "--:--:--" }
];

var previousActivity = null;
var currentActivity = null;

function twoDigits(i) {
  var s = i.toString();
  return (s.length == 1) ? ("0" + s) : s;
};

function formatTimestamp(date) {
  var out = '';
  out += (1900 + date.getYear()) + '-';
  out += twoDigits(date.getMonth() + 1) + '-';
  out += twoDigits(date.getDate()) + " ";
  out += twoDigits(date.getHours()) + ":";
  out += twoDigits(date.getMinutes()) + ":";
  out += twoDigits(date.getSeconds());
  return out;
}

function log(line) {
  if (typeof(console) != 'undefined') {
    console.log(line);
  }
}

var ajaxTimeout = null;

function ajaxError() {
  document.getElementById('message').innerHTML = 'AJAX Error';
}

function handleAjaxResponse(response) {
  console.log('response', response);
  activityNumToSeconds = JSON.parse(response);
  for (var activityNum in activityNumToSeconds) {
    if (activityNumToSeconds.hasOwnProperty(activityNum)) {
      var seconds = activityNumToSeconds[activityNum];
      var s = seconds % 60;
      var m = Math.floor((seconds % 3600) / 60);
      var h = Math.floor(seconds / 3600);
      m = (m < 10) ? ("0" + m) : ("" + m);
      s = (s < 10) ? ("0" + s) : ("" + s);
      var hms = "" + h + ":" + m + ":" + s;
      if (activityNum >= 0 && activities[parseInt(activityNum)]) {
        activities[parseInt(activityNum)].totalTime = hms;
      }
    }
  }
  setupActivityList();
}

function postPreviousActivity(activity) {
  activity.startDate = formatTimestamp(activity.startDate);
  activity.finishDate = formatTimestamp(activity.finishDate);
  log(activity);

  ajaxTimeout = window.setTimeout(ajaxError, AJAX_TIMEOUT_MILLIS);
  request = new XMLHttpRequest();
  request.onerror = ajaxError;
  request.open("POST", "/append-log", true); // 3rd param means async=true
  request.onreadystatechange = function() {
    if (request.readyState == 4 && request.status == 200) {
      window.clearTimeout(ajaxTimeout);
      handleAjaxResponse(request.responseText);
    }
  };
  request.send(JSON.stringify(activity));
}

var minuteUpdateInterval = null;

function changeActivity(activityNum) {
  var oldIntention = document.getElementById('intention').value;
  var oldIntendedDuration = document.getElementById('intended-duration').value;

  var activity;
  if (activityNum == NO_ACTIVITY_NUM) {
    activity = noActivity;
  } else if (activityNum < activities.length) {
    activity = activities[activityNum];
  } else {
    return; // EARLY EXIT
  }

  snoozeFlashing();

  document.getElementById('color-wash').style.backgroundColor = activity.color;
  document.getElementById('message').innerHTML = activity.message;
  document.getElementById('intention').value = '';
  document.getElementById('intended-duration').value =
    DEFAULT_INTENDED_DURATION_MINS;

  var now = new Date();
  if (currentActivity) {
    previousActivity = currentActivity;
    currentActivity = null;

    previousActivity.finishDate = now;
    previousActivity.intention = oldIntention;
    previousActivity.intendedDuration = oldIntendedDuration;

    postPreviousActivity(previousActivity);
  }

  currentActivity = {
    startDate: now,
    finishDate: null,
    message: activity.message,
    activityNum: activityNum,
    color: activity.color
  };

  if (minuteUpdateInterval) {
    window.clearInterval(minuteUpdateInterval);
  }
  minuteUpdateInterval = window.setInterval(updateDurationSoFar, 60 * 1000);
  updateDurationSoFar();
}

function flashForOverTime() {
  var wash = document.getElementById('color-wash');
  if (wash.style.backgroundColor == 'black') {
    wash.style.backgroundColor = currentActivity.color;
  } else {
    wash.style.backgroundColor = 'black';
  }
}

var overTimeInterval = null;
function snoozeFlashing() {
  if (overTimeInterval) {
    window.clearInterval(overTimeInterval);
  }
  overTimeInterval = null;
  var wash = document.getElementById('color-wash');
  if (currentActivity) {
    wash.style.backgroundColor = currentActivity.color;
  }
}

function updateDurationSoFar() {
  if (!currentActivity) return;
  var numMillis = (new Date()) - currentActivity.startDate;
  var numMinutes = Math.floor(numMillis / (60 * 1000));
  document.getElementById('duration-so-far').innerHTML = numMinutes;

  var numIntendedMinutes =
    parseInt(document.getElementById('intended-duration').value);

  if (numIntendedMinutes > 0 &&
      numMinutes > numIntendedMinutes) {
    if (!overTimeInterval) {
      document.addEventListener('mousemove', snoozeFlashing, false);
      overTimeInterval = window.setInterval(flashForOverTime,
        OVER_TIME_FLASH_RATE_MILLIS);
    }
  }
}

function setupActivityList() {
  var html = '';
  for (var i = 0; i < activities.length; i++) {
    var activity = activities[i];
    html += "<div class='activity'>";
    html += "<div class='activity-num' "+
      "style='background-color:" + activity.color + "'>";
    html += i;
    html += "</div>"
    html += "<span class='activity-message'>" +
      activity.message + "</span><br>";
    html += "<span class='activity-total-time'>" +
      activity.totalTime + "</span>";
    html += "</div>";
  }
  document.getElementById('activity-list').innerHTML = html;
}

var blurIntentionTimeout = null;
function blurIntention() {
  // so next time Tab is pressed, it goes to intention
  document.getElementById('unfocus').focus();
}

var ESCAPE_KEY = 27;
function handleKeydownInIntentionFields(e) {
  if (e.keyCode == ESCAPE_KEY) {
    blurIntention();
    return;
  }

  // reset blur intention timeout
  if (blurIntentionTimeout) {
    window.clearTimeout(blurIntentionTimeout);
  }
  blurIntentionTimeout =
    window.setTimeout(blurIntention, BLUR_INTENTION_TIMEOUT_MILLIS);

  // don't let numbers entered switch the activity
  e.stopPropagation();

  return true;
}

function showIntentionFocus() {
  document.getElementById('intention').style.backgroundColor = 'white';
  document.getElementById('intention').style.color = 'black';
}

function showIntentionBlur() {
  document.getElementById('intention').style.backgroundColor = 'transparent';
  document.getElementById('intention').style.color = 'white';
}

function showIntendedDurationFocus() {
  document.getElementById('intended-duration').style.backgroundColor = 'white';
  document.getElementById('intended-duration').style.color = 'black';
}

function showIntendedDurationBlur() {
  document.getElementById('intended-duration').style.backgroundColor =
    'transparent';
  document.getElementById('intended-duration').style.color =
    'white';
}

var DIGIT_0 = 48;
var DIGIT_9 = 57;
var SPACE = 32;
function handleDocumentKeydown(e) {
  if (e.keyCode >= DIGIT_0 && e.keyCode <= DIGIT_9) {
    var activityNum = e.keyCode - DIGIT_0;
    changeActivity(activityNum);
  } else if (e.keyCode == SPACE) {
    changeActivity(NO_ACTIVITY_NUM);
  }
  return true;
}

function onloadcalled() {
  document.addEventListener('keydown', handleDocumentKeydown, false);
  document.getElementById('intention').addEventListener(
    'focus', showIntentionFocus, false);
  document.getElementById('intention').addEventListener(
    'blur', showIntentionBlur, false);
  document.getElementById('intended-duration').addEventListener(
    'focus', showIntendedDurationFocus, false);
  document.getElementById('intended-duration').addEventListener(
    'blur', showIntendedDurationBlur, false);
  document.getElementById('intention').addEventListener(
    'focus', handleKeydownInIntentionFields, false);
  document.getElementById('intention').addEventListener(
    'keydown', handleKeydownInIntentionFields, false);
  document.getElementById('intended-duration').addEventListener(
    'focus', handleKeydownInIntentionFields, false);
  document.getElementById('intended-duration').addEventListener(
    'keydown', handleKeydownInIntentionFields, false);

  changeActivity(NO_ACTIVITY_NUM);

  setupActivityList();

  blurIntention(); // so tab key works consistently
}

window.onload = onloadcalled;
