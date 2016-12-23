
 $('#schedule').tablesorter({sortList: [[1,0]]});


Offline.options = {
  // Should we check the connection status immediatly on page load.
  checkOnLoad: false,

  // Should we monitor AJAX requests to help decide if we have a connection.
  interceptRequests: false,

  checks: {
    image: {
        url: '//bussi.mobi/empty.gif'
    },
    active: 'image'
  },

  // Should we automatically retest periodically when the connection is down (set to false to disable).
  reconnect: {
    // How many seconds should we wait before rechecking.
    initialDelay: 3,

    // How long should we wait between retries.
    //delay: (1.5 * last delay, capped at 1 hour)
  },

  // Should we store and attempt to remake requests which fail while the connection is down.
  requests: false
};

var runOffline = typeof navigator.onLine === "boolean" && !navigator.onLine;
var previousReq = null;
// Make sure calls are made only if seemingly online
var ajaxRequest = function() {

    // If some request was deferred previously, reject that (to avoid multiple requests & callbacks)
    if (previousReq && previousReq.state === "deferred" && !!previousReq.deferred) {
        previousReq.deferred.reject();
    }

    if (typeof navigator.onLine === "boolean" && !navigator.onLine || Offline.state !== "up") {
        // We're offline

        // Store this to run once we're back online
        previousReq = {"that": this, "args": arguments, "state": "deferred", "deferred": new $.Deferred()};
        // Mark connection OFFLINE but only if the app was started ONLINE
        if (!runOffline) {
            Offline.markDown();
        }
        return previousReq.deferred;
    } else {
        // We seem to be online -> pipe the ajax
        previousReq = {"that": this, "args": arguments, "state": "executed", "deferred": $.ajax.apply(this, arguments)};

        return previousReq.deferred;
    }
};
// Once coming online, execute last deferred call, if such exists
Offline.on('confirmed-up', function() {
    if (previousReq && previousReq.state === "deferred" && !!previousReq.deferred) {
        previousReq.state === "executed";
        $.ajax.apply(previousReq.that, previousReq.args).done(function() {
            previousReq.deferred.resolveWith(this, arguments);
        }).fail(function() {
            previousReq.deferred.rejectWith(this, arguments);
        });
    }

    // Enable online-features when inet goes up
    $('#pageUrl, #follow, #openMapChooser').removeAttr('disabled');

    // The app appears to be online -> enable running online!
    if (runOffline) {
        runOffline = false;
    }
});

Offline.on('confirmed-down', function() {
    // if net is down, disable certain features
    $('#pageUrl, #follow, #openMapChooser').attr('disabled', 'disabled');
});
if (runOffline) {
    // disable certain buttons which would require to be online - like search of new stops and map
    $('#pageUrl, #follow, #openMapChooser').attr('disabled', 'disabled');
}

var runner = (function() {
    var cannon = function(callback) {
        var check, errorMargin, interval, time, timer;
        time = new Date().getTime();
        // These are arbitrary numbers
        interval = 2000;
        errorMargin = 700;
        check = function() {
            clearTimeout(timer);
            var newtime = new Date().getTime();
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
    };

    var callbackStack = [];

    // Setup OffOn tracker to run automatically with just underlying callback stack changing
    cannon(function() {
        if (callbackStack.length > 0) {
            $.each(callbackStack, function(i, cb) {
                cb();
            });
        }
    });

    var trackOffOn = function(cb) {
        // Add callback to the callbackStack
        callbackStack.push(cb);
        return {
            stop: function() {
                // Remove added callback from the stack
                // TODO: here might be risk of memory leak, verify...
                var i = callbackStack.indexOf(cb);
                if (i !== -1) {
                    callbackStack.splice(i, 1);
                }
            }
        }
    };

    return {
        trackOffOn: trackOffOn,
        runEvery: function(seconds, callback) {
            var fire, onOffTracker, timer;
            fire = function() {
                clearTimeout(timer);
                if (callback) {
                    callback();
                }
                timer = setTimeout(fire, seconds * 1000);
            };
            timer = setTimeout(fire, seconds * 1000);
            onOffTracker = trackOffOn(fire);
            return {
                stop: function() {
                    clearTimeout(timer);
                    onOffTracker.stop();
                }
            };
        }
    }
}());

var indicator = (function() {
    var $indicator = $('<div>').attr('id', 'indicator').appendTo('body');

    // On every wakeup, immediately dim the indicator
    runner.trackOffOn(function() {
        var currentView = $('.view').not('.hidden').attr('id');
        // Only fire if scheduling is used right now
        if (currentView != 'scheduleView' && currentView != 'timerView') {
            return;
        }
        $indicator.css('transition', 'none');
        $indicator.removeClass('refresh');
        $indicator.toggleClass('outdated', true);
    });

    return {
        update: function() {
            // Immediately reset the color indicator
            $indicator.css('transition', 'none');
            $indicator.addClass('refresh');
            $indicator.removeClass('outdated');
            // For some reason timeout is needed to get the transition work correctly
            setTimeout(function() {
                // Fade out indicator in 10s
                $indicator.css('transition', 'background-color 10s linear');
                $indicator.removeClass('refresh outdated');
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

             if (callback) {
                 this.fetchRealtimeSchedules(stopId, callback);
             }
             if (schedules[stopId]) {
                 return this.retrieveFromStorage(stopId);
             }
             return null;
         },
         fetchRealtimeSchedules: function(stopId, callback) {
             ajaxRequest({
                 url: "https://tools.alizweb.com/busatstop/departure-api.php",
                 //dataType: "jsonp", // now we support cors!
                 data: {"stop": stopId},
                 success: function(data) {
                     callback(data);
                 }
             }).fail(function() {
                 console.log('Error fetching real time timetables');
                 console.log(arguments);
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

             ajaxRequest({
                 url: "timetables/" + id + ".dat",
                 data: "text",
                 cache: false,
                 context: this,
                 success: function(data) {
                     this.add(id, data);
                     callback(data);
                 }
             }).fail(function() {
                 alert('Suosikkipysäkin aikataulujen lataaminen ei onnistunut.' + "\n"
                        + "Poista juuri lisäämäsi pysäkki suosikeista ja lisää se uudestaan!")
                 console.log('Error while retrieving timetables');
                 console.log(arguments);
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
            $('#withFavoritesView').toggleClass('hidden', false);

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
                $('#withFavoritesView').toggleClass('hidden', true);
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

 $('#pageUrl').on('typeahead:selected typeahead:autocompleted', function(e, suggestion) {
    submit(suggestion);
 });

 $(document.body).on('mousedown touchend', function(e) {
    // Require click to come from outside typeahead (which handles clicks itself)
    if ($(e.target).closest('.twitter-typeahead').length !== 0) {
        return;
    }
    // Hint has to be non-empty
    var hint = $('input.tt-hint').val();
    if (!hint) {
        return;
    }
    setTimeout(function() {
        $('#pageUrl').val(hint);
    }, 100);
 });

 $('#selectStop').on('submit', function(e) {
    e.preventDefault();

    var hintValue = $('input.tt-hint').val();
    var $pageUrl = $('#pageUrl');

    var pageUrl = $pageUrl.val();
    if (!pageUrl) {
        pageUrl = $pageUrl.attr('placeholder');
    }
    if (pageUrl.indexOf('(') === -1) {
        // Try to get it from the first hint, if such exists
        pageUrl = hintValue;
    }
    if (pageUrl.indexOf('(') !== -1) {
       var shortcode = pageUrl.substring(pageUrl.indexOf('(') + 1, pageUrl.indexOf(')'));
       var stopid = stopmap[shortcode];
    } else {
        alert('Valitse pysäkin nimi ehdotetuista vaihtoehdoista');
        return;
    }

    // Submit passing id and name as parameters
    submit({"value": pageUrl, "id": stopid});
 });

 function submit(item) {
    if (!item || !item.id) {
        console.log('Called submit() without correct stop item');
        return;
    }

    var $pageUrl = $('#pageUrl');

    // Lose focus off the field to allow hiding keyboard on mobile aso.
    $pageUrl.blur();

    // Because URL is fetched explicitly, clear possible timer
    if (timer) {
        timer.stop();
    }

    $('.view').not('#scheduleView').toggleClass('hidden', true);
    $('#scheduleView').toggleClass('hidden', false);
    window.scrollTo(0,0);
    $pageUrl.val('');
    renderSchedules(item.id);

    if (!!ga && navigator.onLine) {
        ga('send', 'event', 'mainInteractions', 'click', 'pageUrl', item.value);
    }
 }

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
        var lineNo = bus.line ? bus.line : bus.route.substring(1,6).replace(/^[\s0]+|\s+$/g, '');
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
        // This is in minutes
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
        // TODO: deprecate
        ajaxRequest({
            url: "https://tools.alizweb.com/busatstop/getData.php",
            // dataType: "jsonp",
            data: pageData,
            success: function(response) {
                var data = response.data;
                currentStop = {"name": data.stopname, "url": pageUrl};
                renderScheduleView(data);
                indicator.update();
            }
        }).fail(function() {
            $('#scheduleView').toggleClass('hidden', true);
            $('#indexView').toggleClass('hidden', false);
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
    var $star = $(this);
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
        // If query is stop number, it has to have at least 4 letters
        var isStopNumber = isNaN(query[1]) === false;
        if (isStopNumber && query.length < 4) {
            return;
        }

        var time = new Date().getTime();
        // Little throttling to avoid too many requests to the server
        // Also, always pass stop number through as partial stop number wouldn't give any results
        if (lastApiCall && !isStopNumber && (lastApiCall.state() == 'pending' || time - lastSuggestionTime < 300)) {
            lastApiCall.done(function(res) {
                updateSuggestions(res, cb, query);
            });
            return;
        }

        lastSuggestionTime = time;
        lastApiCall = ajaxRequest({
            url: "https://tools.alizweb.com/busatstop/stop-api.php",
            data: {"stop": query},
            success: function(res) {
                // TODO: add spinner to the field to indicate ongoing lookup
                updateSuggestions(res, cb, query);
            }
        })
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
        suggestions.push({"value": displayName, "id": stop.id});
        stopmap[stop['id2']] = stop.id;
    });
    cb(suggestions);
 }

function switchToView(view) {
    // Stop timer is switched out of view where tracking is possible
    if (timer && view != "timerView" && view != "scheduleView") {
        timer.stop();
    }
    $('.view').not('#' + view).toggleClass('hidden', true);
    $('#' + view).toggleClass('hidden', false);
    window.scrollTo(0,0);
}

 $('#schedule tbody').on('click', function(e) {
    var destination = $(e.target).closest('tr').data('destination');
    if (destination)
        timerWatch.init(destination);
 });

 $('.backToIndex').click(function(e) {
    switchToView('indexView');
    $('#pageUrl').val('');
 });

 $('#backToSchedule').click(function(e) {
    switchToView('scheduleView');
    e.preventDefault();
 });

 $('#openMapChooser').click(function(e) {
    switchToView('mapView');

    mapSelector.init(function(stopId) {
        switchToView('scheduleView');
        renderSchedules(stopId);
    });

    e.preventDefault();
 });

 $('#indexView').on('click', 'a.quickLink', function(e) {
    var url = $(this).attr('href');
    if (url[0] == '#') {
        url = url.substring(1);
    }
    switchToView('scheduleView');
    renderSchedules(url);
    e.preventDefault();
 });

 var timerWatch = (function() {
    var data, destination;
    var $view = $('#timerView');
    var lastTime = {};

    var timeTable = {};

    function updateTimer(minutesLeft) {
        if (typeof minutesLeft === "string" && minutesLeft.indexOf('~') == 0) {
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
            // Reset lastTime temp variable just to make sure no old data exist
            lastTime = {};
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
            var trimDest = function(dest) {
                var space = dest.indexOf(' ');
                if (space === -1) {
                    return dest;
                } else {
                    return dest.substring(0, space);
                }
            };
            $.each(data.lines, function(i, line) {
                if (trimDest(line.destination) == trimDest(destination)) {
                    if (line.rtime) {
                        updateCountdownUntil(line.rtime, true);
                    } else if ( (line.time && line.time != lastTime[destination]) || line.timeEstimate != lastTime[destination]) {
                        var time = line.time || line.timeEstimate;
                        // Sometimes realtime data is not returned on every check
                        // Thus if shorter time is present due to previously successcully received rtime data,
                        // respect that and assume there's less time left than what the schedule says
                        if (lastTime[destination]) {

                            // Don't update if previous prediction was sooner
                            // (this is because rtime may sometimes appear only on some of the requests,
                            //  thus if rtime prediction was that the bus was early, avoid replacing it with timetable data)
                            var lastTimeLeft = (Math.round(new Date().getTime() / 1000) - lastTime[destination]);
                            if ( lastTimeLeft > 0 && lastTime[destination] < time) {
                                time = lastTime[destination];
                            }
                        }
                        updateCountdownUntil(time);
                        lastTime[destination] = time;
                    }
                    return false;
                }
            });
        }
    }
 }());

 // Store hash changes to local storage for later resume
 !!window.localStorage && $(window).on('hashchange', function() {
    var hash = window.location.hash;
    localStorage.setItem('lastPageOpen', hash);
 });

/** Start app **/

 var hash = window.location.hash;
 // If no hash set, try to get it from localStorage
 if ((!hash || hash.length < 2) && window.localStorage) {
    hash = localStorage.getItem('lastPageOpen');
 }
 if (hash && hash.length > 1) {
    var url = hash.substring(1);
    renderSchedules(url);
 } else {
    switchToView('indexView');
 }
