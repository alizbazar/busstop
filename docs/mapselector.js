var mapSelector = (function() {

    function getStopsNearby() {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(function(position) {
                console.log(position.coords.latitude, position.coords.longitude);
                var myLocation = {lon: position.coords.longitude, lat: position.coords.latitude};
                var map = initMap(myLocation);
                
                loadHSL(myLocation, function() {
                    processStopData();
                    renderMap(map);
                });

            });
        }
    }

    var state = {
        stopsLoaded: {}, // stop codes "1234567"
        loadedCenters: [] // {lat:..., lon:...}, leg length 1500m
    };

    // Get 


    //This function takes in latitude and longitude of two location and returns the distance between them as the crow flies (in km)
    function calcCrow(lat1, lon1, lat2, lon2) 
    {
      var R = 6371000; // km
      // Exact calculation of Crow using projection
      // var dLat = toRad(lat2-lat1);
      // var dLon = toRad(lon2-lon1);
      // var lat1 = toRad(lat1);
      // var lat2 = toRad(lat2);

      // var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      //   Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
      // var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      // var d = R * c;
      
      // As precision is not very important and we are looking into distance 
      // of points very close to each other on earth circle, let's assume alpha ~= sin(alpha)
      var dy = toRad(lat2-lat1) * R;
      var dx = toRad(lon2-lon1) * R;
      var d = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
      return d;
    }

    // Converts numeric degrees to radians
    function toRad(Value) 
    {
        return Value * Math.PI / 180;
    }

    // Limits
    var x1 = 100, // This is additional radius to look after finding first closest stop
        x2 = 30, // This is a distance to look around each found stop
        focusable = [],
        stops = [],
        maxTot,
        x0;

    function processStopData() {

        x0 = stops[0].dist;
        lookupIn = x0 + x1;
        maxTot = lookupIn + x2;

        var i = 0;
        while(i < stops.length) {
            var stop = stops[i];
            if (stop.dist > lookupIn) {
                break;
            }
            i++;
        }
        console.log('nbr of stops found', i);

        // Move all stops so far into focusable
        focusable.push.apply(focusable, stops.splice(0, i));
        console.log('foucsable', focusable);

        i = 0;
        while(i < stops.length) {
            var stop = stops[i];
            if (stop.dist < maxTot) {
                var stopTooFar = focusable.every(function(includedStop, k) {
                    var crow = calcCrow(includedStop.lat, includedStop.lon, stop.lat, stop.lon);
                    console.log('crow', crow);
                    return crow > x2;
                });

                // Only increment i if splice didn't occur - otherwise i would stay the same
                if (stopTooFar) {
                    i++;
                } else {
                    focusable.push(stops.splice(i, 1)[0]);
                }
            } else {
                break;
            }
        }
        // Now we should have "focusable" ready and all the rest left in "stops"
        console.log(focusable);
        console.log(stops);
    }

    function initMap(loc) {
        var map = new google.maps.Map(document.getElementById('map'), {
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            maxZoom: 18,
            panControl: false,
            zoomControl: false,
            mapTypeControl: false,
            scaleControl: false,
            streetViewControl: false,
            overviewMapControl: false,
            zoom: 16,
            center: new google.maps.LatLng(loc.lat, loc.lon)
        });
        window.map = map;
        addGeolocationMarker(map);
        return map;
    }

    function renderMap(map) {

        function addMapsMarker(stop) {
            if (state.stopsLoaded[stop.code]) {
                return;
            }
            state.stopsLoaded[stop.code] = true;

            var marker = new MarkerWithLabel({
                position: new google.maps.LatLng(stop.lat, stop.lon),
                map: map,
                //animation: google.maps.Animation.DROP,
                labelContent: stop.name,
                labelAnchor: new google.maps.Point(30, 25),
                icon: {
                    url: /*"icons/hsl-icon-glyph.svg"*/"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgICA8ZGVmcz4KICAgIDxmb250IGhvcml6LWFkdi14PSIyMDQ4Ij4KICAgICAgICA8Zm9udC1mYWNlIApmb250LWZhbWlseT0iSFNMcGlrdG9LRUhZUyIKdW5pdHMtcGVyLWVtPSIyMDQ4IgovPgogICAgICA8Z2x5cGggdW5pY29kZT0iLiIKZD0iTTIwNSAyMDd2MTIyOXEwIDgzIDYwIDE0Mi41dDE0MyA1OS41aDEyMjhxODYgMCAxNDYuNSAtNTkuNXQ2MC41IC0xNDIuNXYtMTIyOXEwIC04NiAtNjAuNSAtMTQ2LjV0LTE0Ni41IC02MC41aC0xMjI4cS04NCAwIC0xNDMuNSA2MC41dC01OS41IDE0Ni41ek00NjkgMzk1cTAgLTIyIDEzIC0zN3QzMCAtMjBsNjEgLTEwdi0xMjlxMCAtMTAgOC41IC0xNy41dDIwLjUgLTcuNWg5OHE5IDAgMTcgNy41dDggMTcuNXYxMTQKcTExMiAtMTQgMjk3IC0xNHExOTIgMCAzMDEgMTR2LTExNHEwIC0xMCA4LjUgLTE3LjV0MTguNSAtNy41aDk4cTEyIDAgMjAuNSA3LjV0OC41IDE3LjV2MTI5bDYxIDEwcTQzIDExIDQzIDU3djk1OXEwIDMyIC0yMC41IDUzdC01Ny41IDI1cS0yNDYgMzAgLTQ3NyAzMHEtMjY4IDAgLTQ3OSAtMzBxLTM3IC00IC01Ny41IC0yNXQtMjAuNSAtNTN2LTk1OXpNNTU5IDY5NHY1OThxMCA0NSA0NSA0NWw4NDYgLTRxNDMgMCA0MyAtNDV2LTU5NHYtNApxMCAtMjEgLTkuNSAtMzEuNXQtMzMuNSAtMTMuNXEtMjQwIC00MSAtNDIwIC00MXEtMjI4IDAgLTQyNiA0NXEtMjUgNSAtMzUgMTV0LTEwIDMwek01OTIgNDgxcTIgMjEgMTggMzZ0MzcgMTVxMjIgMCAzNy41IC0xNS41dDE1LjUgLTM1LjVxMCAtMjMgLTE1LjUgLTM5dC0zNy41IC0xNnEtMjMgMiAtMzkgMTcuNXQtMTYgMzcuNXpNMTM0MSA0ODFxMiAyMCAxOCAzNS41dDM2IDE1LjVxMjIgMCAzNy41IC0xNS41dDE1LjUgLTM1LjUKcTAgLTIzIC0xNS41IC0zOXQtMzcuNSAtMTZxLTIyIDIgLTM4IDE4dC0xNiAzN3oiIC8+CiAgICA8L2ZvbnQ+CiAgICA8L2RlZnM+CiA8IS0tIENyZWF0ZWQgd2l0aCBTVkctZWRpdCAtIGh0dHA6Ly9zdmctZWRpdC5nb29nbGVjb2RlLmNvbS8gLS0+CiAgICA8Zz4KICAgICAgICA8cmVjdCBmaWxsPSIjZmZmIiBzdHJva2Utd2lkdGg9IjAiIHg9IjIiIHk9IjIiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgc3Ryb2tlPSIjZmZmIi8+CiAgICAgICAgPHRleHQgZm9udC1mYW1pbHk9IkhTTHBpa3RvS0VIWVMiIGZvbnQtc2l6ZT0iMjhweCIgeD0iLTIiIHk9IjIzIiBzdHlsZT0iZmlsbDojMDA3QUM5OyI+LjwvdGV4dD4KICAgIDwvZz4KPC9zdmc+",
                    //scaledSize: new google.maps.Size(18, 18),
                    anchor: new google.maps.Point(7, 8)
                }
            });
            marker.set('stop', stop);

            // Attach marker clickhandler
            google.maps.event.addListener(marker, 'click', function() {
                // TODO: select stop
                var stop = marker.get('stop');
                console.log(marker.get('stop'));
                window.marker = marker;

                render(stop.code);
            });
            return marker;
        }

        var locations = focusable;

        //create empty LatLngBounds object
        var bounds = new google.maps.LatLngBounds();

        var i, marker;
        for (i = 0; i < locations.length; i++) {  
          marker = addMapsMarker(locations[i]);

          //extend the bounds to include each marker's position
          bounds.extend(marker.position);
        }

        //now fit the map to the newly inclusive bounds
        map.fitBounds(bounds);


        // If dragged to a new area, load more stops
        google.maps.event.addListener(map, 'dragend', function() {
            var cent = map.getCenter();
            console.log('dragend', cent);
            var notLoaded = state.loadedCenters.every(function(loc, k) {
                return calcCrow(loc.lat, loc.lon, cent.k, cent.A) > 500;
            });

            if (notLoaded) {
                loadHSL({"lat": cent.k, "lon": cent.A}, function(stops) {
                    stops.forEach(function(stop) {
                        addMapsMarker(stop);
                    });
                });
            }
        });

        for (i = 0; i < stops.length; i++) {
            marker = addMapsMarker(stops[i]);
        }

    }

    function addGeolocationMarker(map) {
        var GeoMarker = new GeolocationMarker();
        GeoMarker.setMap(map);
    }

    function loadHSL(loc, callback) {
        if (state) {
            state.loadedCenters.push(loc);
        }
        var reittiopasEndpoint = 'http://api.reittiopas.fi/hsl/prod/';
        var params = {
            request: "stops_area",
            center_coordinate: loc.lon + ',' + loc.lat,
            epsg_in: "4326",
            epsg_out: "4326",
            user: "alizbazar",
            pass: "edatavuj"
        };
        var url = encodeURIComponent(reittiopasEndpoint + '?' + $.param(params));

        return $.getJSON('https://tools.alizweb.com/busatstop/hsl-proxy.php?url=' + url, {crossDomain: true}, function(data) {
            console.log(data);
            if (data && data.length > 0) {

                // Parse lat & lon and add them to stop data
                $.each(data, function(k, stop) {
                    var coords = stop.coords.split(',');
                    stop.lon = coords[0];
                    stop.lat = coords[1];
                });

                stops = data;
            }
            callback(data);
        });
    }

    
    var inited = false;
    var render;
    return {
        init: function(renderSchedules) {
            render = renderSchedules;
            if (!inited) {
                getStopsNearby();
                inited = true;
            }
        }
    }
}());