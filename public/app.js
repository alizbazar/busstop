
 $('#schedule').tablesorter({sortList: [[1,0]]});

var runner = {
  trackOffOn: function(callback) {
    var check, errorMargin, interval, time, timer;
    time = new Date().getTime();
    interval = 2000;
    errorMargin = 700;
    check = function() {
      var newtime, timer;
      clearTimeout(timer);
      newtime = new Date().getTime();
      if ((newtime - time) > (interval + errorMargin)) {
        callback();
      }
      time = newtime;
      timer = setTimeout(check, interval);
    };
    timer = setTimeout(check, interval);
    return {
      timeSinceLastCheck: function() {
        return new Date().getTime() - time;
      },
      stop: function() {
        if (timer) {
          clearTimeout(timer);
        }
      }
    };
  },
  runEvery: function(seconds, callback) {
    var fire, onOffTracker, timer;
    timer = setTimeout(fire, seconds*1000);
    fire = function() {
      clearTimeout(timer);
      if (callback) {
        callback();
      }
      timer = setTimeout(fire, seconds*1000);
    };
    onOffTracker = runner.trackOffOn(fire);
    return {
      stop: function() {
        clearTimeout(timer);
        onOffTracker.stop();
      }
    };
  }
};

var indicator = (function() {
    var $indicator = $('<div>').attr('id', 'indicator').appendTo('body');
    return {
        update: function() {
            clearTimeout(null);
            // Immediately reset the color indicator
            $indicator.css('transition', 'none');
            $indicator.addClass('reset');
            // For some reason timeout is needed to get the transition work correctly
            setTimeout(function() {
                // Fade out indicator in 10s
                $indicator.css('transition', 'background-color 10s linear');
                $indicator.removeClass('reset');
            }, 20);
        }
    }
}());


 var timetables = (function() {
     var schedules = {};

     var importDb = function(data) {
         var busses = TAFFY();
         var getInfo = function(subj, start, end) {
             return subj.substring(start, end).trim();
         }
         data.split("\n").forEach(function(v,i) {
           v = v.trim();
           if (!v) {
             // Skip Empty
             return true;
           }

           // To save space perhaps unnecessary columns could be stripped on backend
           var obj = {
             stop: getInfo(v, 0, 7),
             route: getInfo(v, 7, 13),
             dir: getInfo(v, 13, 14),
             day: getInfo(v, 14, 16),
             //no: getInfo(v, 16, 20),
             //daychange: getInfo(v, 20, 21),
             //lowfloor: getInfo(v, 25, 26),
             validstart: getInfo(v, 26, 34),
             validend: getInfo(v, 34, 40)
           };

           var hour = parseInt(getInfo(v, 21, 23), 10);
           var minute = parseInt(getInfo(v, 23, 25), 10);
           var date = new Date();
           date.setHours(hour);
           date.setMinutes(minute);
           date.setSeconds(0);

           obj.time = Math.floor(date.getTime() / 1000);

           busses.insert(obj);
         });

         busses.sort("time asec");

         return busses;
     };

     var pad = function pad(n, width) {
         n = n + '';
         return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
     };

     var days = ["Su","Ma","Ti","Ke","To","Pe","La"];

     return {
         add: function(stopId, data) {
             if (!stopId || !data || schedules[stopId]) {
                 // Cancel if empty arguments or already exists
                 return;
             }
             schedules[stopId] = importDb(data);
         },
         get: function(stopId, callback) {

             if (callback && navigator.onLine) {
                 this.fetchRealtimeSchedules(stopId, callback);
             }
             if (schedules[stopId]) {
                 return this.retrieveFromStorage(stopId);
             }
             return null;
         },
         fetchRealtimeSchedules: function(stopId, callback) {
             $.ajax({
                 url: "http://tools.alizweb.com/busatstop/departure-api.php",
                 dataType: "jsonp",
                 data: {"stop": stopId},
                 success: function(data) {
                     callback(data);
                 },
                 error: function() {
                     console.log('Error fetching real time timetables');
                     console.log(arguments);
                 }
             });
         },
         retrieveFromStorage: function(stopId) {
             var db = schedules[stopId];
             var now = new Date();
             var timeGt = Math.floor(now.getTime() / 1000);
             var timeLt = timeGt + 7200;
             // Return in the same format as the departure-api.php
             return db({time: {gt: timeGt, lt: timeLt}, day: days[now.getDay()]}).map(function(o) {
                return {
                    "route": o.route + "      ".substring(o.route.length) + o.dir,
                    "time": o.time,
                    "stop": stopId
                 };
             });
         },
         download: function(id, callback) {

             $.ajax({
                 url: "timetables/" + id + ".dat",
                 data: "text",
                 cache: false,
                 context: this,
                 success: function(data) {
                     this.add(id, data);
                     callback(data);
                 },
                 error: function() {
                     console.log('Error while retrieving timetables');
                     console.log(arguments);
                 }
             });
         }
     };
 }());

 var favorites = (function() {

    var save = function() {
        if (!JSON || !window.localStorage) {
            return false;
        }
        window.localStorage.setItem('busatstop', JSON.stringify(data));
        return true;
    };

    // Init data table rightaway on loading
    var data = (function() {
        if (!JSON || !window.localStorage) {
            return {};
        }
        var retrieved = window.localStorage.getItem('busatstop');
        if (!!retrieved) {
            return JSON.parse(retrieved);
        }
        return {};
    }());

    var controls = {
        add: function(stop, onlyDOM) {
            var stopDomItem = $('<li>').data('stopName', stop.name);
            if (stop.id) {
                stopDomItem.data('stopId', stop.id);
            }
            if (stop.id && data[stop.id]) {
                timetables.add(stop.id, data[stop.id].data);
            } else if (stop.id) {
                timetables.download(stop.id, function(data) {
                    stop.data = data;
                    data[stop.id] = stop;
                    save();
                });
            }
            $('<a>').attr('href', '#' + stop.id).addClass('quickLink btn btn-success').html(stop.name).appendTo(stopDomItem);
            $('#starList').append(stopDomItem);
            $('.firstUseView').toggleClass('hidden', true);
            $('#withFavoritestView').toggleClass('hidden', false);

            if (onlyDOM) {
                return true;
            }
            if (stop.id) {
                data[stop.id] = stop;
            } else {
                data[stop.name] = stop.url;
            }
            return save();
        },
        remove: function(identifier) {
            var idType = isNaN(identifier) ? 'stopName' : 'stopId';
            delete data[identifier];

            $('#starList').find('li').each(function(i, item) {
                var $item = $(item);
                if ($item.data(idType) == identifier) {
                    $item.remove();
                    return false;
                }
            });
            if (this.isEmpty()) {
                $('#withFavoritestView').toggleClass('hidden', true);
                $('.firstUseView').toggleClass('hidden', false);
            }
            return save();
        },
        has: function(identifier) {
            return !!data[identifier];
        },
        isEmpty: function() {
            return Object.keys(data).length == 0;
        },
        get: function(identifier) {
            return data[identifier];
        }
    };

    if (!controls.isEmpty()) {
        $.each(data, function(key, content) {
            if (!isNaN(key)) {
                // content is in this case stop data object
                controls.add(content, true);
            } else {
                controls.add({"name": name, "url": url}, true);
            }
        });
    }

    return controls;
 }());

 $('#pageUrl').on('typeahead:selected', function() {
    $('#selectStop').submit();
 });

 $('#selectStop').on('submit', function(e) {
    var $pageUrl = $('#pageUrl');
    var pageUrl = $pageUrl.val();
    if (!pageUrl) {
        pageUrl = $pageUrl.attr('placeholder');
    }
    if (pageUrl.indexOf('(') !== -1) {
       var shortcode = pageUrl.substring(pageUrl.indexOf('(') + 1, pageUrl.indexOf(')'));
       var stopid = stopmap[shortcode];
    } else {
        alert('Valitse pysäkin nimi ehdotetuista vaihtoehdoista');
        return;
    }

    // Because URL is fetched explicitly, clear possible timer
    if (timer) {
        timer.stop();
    }

    $('.view').not('#scheduleView').toggleClass('hidden', true);
    $('#scheduleView').toggleClass('hidden', false);
    window.scrollTo(0,0);
    $pageUrl.val('');
    renderSchedules(stopid);

    ga('send', 'event', 'mainInteractions', 'click', 'pageUrl', pageUrl);

    e.preventDefault();
 });

 function parseUrl(url) {

    return {pageUrl: url};
 }

 var currentStop = {};
 function renderScheduleView(data) {
    // Render view
    timerWatch.updateData(data);

    $('#stopName').html(data.stopname);
    var hasFavorite = data.stopid ? favorites.has(data.stopid) : favorites.has(data.stopname);
    $('#starStop').toggleClass('starred', hasFavorite);
    var tbody = $('#schedule tbody');
    tbody.empty();
    $.each(data.lines, function(i, line) {
        var tr = $('<tr>').data('destination', line.destination);
        $('<td>').addClass('destination').html(line.destination).appendTo(tr);
        $('<td>').addClass('timeEstimate').text(line.timeEstimate).appendTo(tr);
        $('<td>').addClass('nextTimeEstimate').text(line.nextTimeEstimate).appendTo(tr);
        tr.appendTo(tbody);
    });

    $('#schedule').trigger('update');
 }

function timeLeft(timeInSeconds) {
    var minutesLeft = Math.floor((timeInSeconds - new Date().getTime() / 1000) / 60);
    if (minutesLeft >= 60) {
        return '~' + Math.round(minutesLeft / 60) + 'h';
    } else {
        return minutesLeft;
    }
}

 var timer = null;
 function transformData(data) {
    var res = {"stopname": data.stopname, "stopid": data[0].stop, "lines": []};
    res.stopname = data.stopname;
    var routes = {};
    data.forEach(function(bus) {
        // Get only the human readable bus code and strip padding 0's
        var lineNo = bus.route.substring(1,6).replace(/^[\s0]+|\s+$/g, '');
        var dest = !bus.dest ? lineNo : lineNo + ' ' + bus.dest;
        if (!routes[dest]) {
            routes[dest] = [];
        }
        var line = {"time": bus.time, "destination": dest};
        if (bus.rtime) {
            var parts = bus.rtime.split(':');
            var time = new Date();
            time.setHours(parts[0]);
            time.setMinutes(parts[1]);
            time.setSeconds(parts[2]);
            line.rtime = Math.floor(time.getTime() / 1000);
        }
        routes[dest].push(line);
    });

    // Consolidate busses under routes
    $.each(routes, function(dest, busses) {
        var line = {};
        $.extend(line, busses[0]);
        var time = line.rtime ? line.rtime : line.time;
        line.timeEstimate = timeLeft(time);
        var nextLine = busses[1];
        if (nextLine) {
            time = nextLine.rtime ? nextLine.rtime : nextLine.time;
            line.nextTimeEstimate = timeLeft(time);
        }
        res.lines.push(line)
    });
    return res;
 }
 function renderSchedules(pageUrl) {
    // FIX: this is bad...
    var isRefresh = !pageUrl;
    var scheduleView = $('#scheduleView');
    if (pageUrl) {
        var pageData = parseUrl(pageUrl);
        scheduleView.data('pageData', pageData);
    } else {
        var pageData = scheduleView.data('pageData');
        pageUrl = pageData.pageUrl;
    }
    // TODO: validate pagedata
    if (pageUrl) {
        window.location.hash = pageUrl;
    }

    if (!isRefresh) {
        if (timer) {
            timer.stop();
        }
        timer = runner.runEvery(15, renderSchedules);
    }

    if (isNaN(pageData.pageUrl)) {
        $.ajax({
            url: "http://tools.alizweb.com/busatstop/getData.php",
            dataType: "jsonp",
            data: pageData,
            success: function(response) {
                var data = response.data;
                currentStop = {"name": data.stopname, "url": pageUrl};
                renderScheduleView(data);
                indicator.update();
            },
            error: function() {
                $('#scheduleView').toggleClass('hidden', true);
                $('#indexView').toggleClass('hidden', false);
            }
        });
    } else {
        var stopId = pageData.pageUrl;
        var storedData = timetables.get(stopId, function(rtData) {
            // Real time data
            rtData.stopname = rtData[0].stopname;
            currentStop = {"url": pageUrl, "name": rtData.stopname, "id": stopId};
            renderScheduleView(transformData(rtData));
            indicator.update();
        });

        if (!isRefresh && storedData && storedData.length > 0) {
            var stop = favorites.get(pageUrl);
            storedData.stopname = stop.name;
            renderScheduleView(transformData(storedData));
        }
        // TODO: remove pageUrl from this...
        currentStop = {"url": pageUrl, "id": stopId};
    }
 }

 $('#starStop').click(function(e) {
    $star = $(this);
    // get current stop
    if (!currentStop) {
        return false;
    }

    if (favorites.has(currentStop.id)) {
        favorites.remove(currentStop.id);
        $star.toggleClass('starred', false);
    } else {
        favorites.add(currentStop);
        $star.toggleClass('starred', true);

    }
    // check if it's starred
    // unstar / star to localstorage
    // change star state
    // change frontpage view state
    e.preventDefault();
 });

 var stopmap = {"E2213": "2222218"};
 var lastSuggestionTime;
 var lastApiCall;
 $('#pageUrl').typeahead({
    minLength: 3,
    highlight: true
 },
 {
    source: function(query, cb) {
        var time = new Date().getTime();
        // Little throttling to avoid too many requests to the server
        if (lastApiCall && (lastApiCall.state() == 'pending' || time - lastSuggestionTime < 300)) {
            lastApiCall.done(function(res) {
                updateSuggestions(res, cb, query);
            });
            return;
        }

        lastSuggestionTime = time;
        lastApiCall = $.get('http://tools.alizweb.com/busatstop/stop-api.php', {"stop": query}, function(res) {
            updateSuggestions(res, cb, query);
        });
    }
 });

 function updateSuggestions(res, cb, q) {
    var suggestions = [];
    $.each(res, function(k, stop) {
        // Search term has to be found somewhere in the data
        if ((stop.name + stop.id + stop['id2'] + stop.addr).toLowerCase().indexOf(q.toLowerCase()) === -1) {
            return;
        }
        var displayName = stop.name + ' (' + stop['id2'] + ')';
        suggestions.push({"value": displayName});
        stopmap[stop['id2']] = stop.id;
    });
    cb(suggestions);
 }

 $('#schedule tbody').on('click', function(e) {
    var destination = $(e.target).closest('tr').data('destination');
    if (destination)
        timerWatch.init(destination);
 });

 $('#backToIndex').click(function() {
    clearTimeout(timer);
    $('.view').not('#indexView').toggleClass('hidden', true);
    $('#indexView').toggleClass('hidden', false);
    if (timer) {
        timer.stop();
    }
    window.scrollTo(0,0);
    $('#pageUrl').val('');
 });

 $('#backToSchedule').click(function(e) {
    $('.view').not('#scheduleView').toggleClass('hidden', true);
    $('#scheduleView').toggleClass('hidden', false);
    e.preventDefault();
 });

 $('#indexView').on('click', 'a.quickLink', function(e) {
    var url = $(this).attr('href');
    if (url[0] == '#') {
        url = url.substring(1);
    }
    renderSchedules(url);
    $('.view').not('#scheduleView').toggleClass('hidden', true);
    $('#scheduleView').toggleClass('hidden', false);
    e.preventDefault();
    window.scrollTo(0,0);
 });

 var timerWatch = (function() {
    var data, destination;
    var $view = $('#timerView');
    var lastTime;

    var timeTable = {};

    function updateTimer(minutesLeft) {
        lastTimeLeft = minutesLeft;
        if (minutesLeft.indexOf('~') == 0) {
            minutesLeft = minutesLeft.substring(1);
        }
        minutesLeft = parseInt(minutesLeft, 10);

        var $timer = $view.find('.timeLeft');
        updateStyling($timer, minutesLeft);

        var time = new Date().getTime();
        time += minutesLeft * 60 * 1000;
        if ($timer.hasClass('hasCountdown')) {
            $timer.countdown('option', 'until', new Date(time));
        } else {
            $timer.countdown({compact: true, format: 'MS', padZeroes: true, until: new Date(time)});
        }
    };

    function updateStyling($timer, minutesLeft) {
        if (minutesLeft === null) {
            $timer.toggleClass('run', false).toggleClass('walk', false).toggleClass('offline', true);
        } else if (minutesLeft < 4) {
            $timer.toggleClass('run', true).toggleClass('walk', false).toggleClass('offline', false);
        } else if (minutesLeft < 7) {
            $timer.toggleClass('run', false).toggleClass('walk', true).toggleClass('offline', false);
        } else {
            $timer.toggleClass('run', false).toggleClass('walk', false).toggleClass('offline', false);
        }
    }

    function updateCountdownUntil(timeInSeconds, realtime) {
        var $timer = $view.find('.timeLeft');
        if (realtime) {
            var minutesLeft = timeLeft(timeInSeconds);
            updateStyling($timer, minutesLeft);
        } else {
            updateStyling($timer, null);
        }
        var time = timeInSeconds * 1000;
        if ($timer.hasClass('hasCountdown')) {
            $timer.countdown('option', 'until', new Date(time));
        } else {
            $timer.countdown({compact: true, format: 'MS', padZeroes: true, until: new Date(time)});
        }
    }

    return {
        'init': function(dest, latestData) {
            if (latestData) {
                data = latestData;
            }
            if (!data) {
                return;
            }
            destination = dest;
            $view.find('.busNo').html(destination);
            $view.find('.stopName').html(data.stopname);
            $('.view').not($view).toggleClass('hidden', true);
            $view.toggleClass('hidden', false);
            this.updateData(data);
        },
        'updateData': function(latestData) {
            data = latestData;
            if (!destination || $view.hasClass('hidden')) {
                return;
            }
            $.each(data.lines, function(i, line) {
                if (line.destination == destination) {
                    if (line.rtime) {
                        updateCountdownUntil(line.rtime, true);
                    } else if (line.time && line.time != lastTime) {
                        updateCountdownUntil(line.time);
                        lastTime = line.time;
                    } else if (line.timeEstimate != lastTime) {
                        updateTimer(line.timeEstimate);
                        lastTime = line.timeEstimate;
                    }
                    return false;
                }
            });
        }
    }
 }());


/** Start app **/

 var hash = window.location.hash;
 if (hash && hash.length > 1) {
    var url = hash.substring(1);
    renderSchedules(url);
 } else {
    $('.view').not('#indexView').toggleClass('hidden', true);
    $('#indexView').toggleClass('hidden', false);
 }
