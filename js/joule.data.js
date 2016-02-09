/*
 
	This function creates a data object.
	The distinction between public and private variables and methods is employed to make the code clearer (Yeah right)
	
	TO DO:
	 * Set change all variables to private and use accessors to set or get their values
	 This is spaghetti.  Needs splitting into smaller files, more consistency in style and
	 stop using the same name for variable, variable type and variable creator function!!!!!

*/
function myRepeat(str, repCount) {
    var res = "";
    for (var i = 0; i < repCount; i++) res += str;
    return res;
}

function dumpTree(tree, indent, ord) {
    var indentSpaces = myRepeat("  ", indent);
    var mstr = "";

    // Has someone given us an array or a node ?
    if (tree.hasOwnProperty("length")) {
        for (var i = 0; i < tree.length; i++) dumpTree(tree[i], indent + 1, i + 1);
    }
    else {
        if (tree.hasOwnProperty("master")) mstr = " MASTER";
        if (tree.hasOwnProperty("children")) {
            console.log(indentSpaces + ord.toString() + ". " + tree.pLName + mstr);
            dumpTree(tree.children, indent + 1);
        }
        else console.log(indentSpaces + ord.toString() + ". " + tree.pLName + " (leaf)" + mstr);
    }
}

function dumpRemappedTree(tree, indent) {
    var indentSpaces = myRepeat("  ", indent);
    var mstr = "";

    // Has someone given us an array or a node ?
    if (tree.hasOwnProperty("length")) {
        for (var i = 0; i < tree.length; i++) dumpRemappedTree(tree[i], indent + 1);
    }
    else {
        if (tree.hasOwnProperty("master")) mstr = " MASTER";
        if (tree.hasOwnProperty("children")) {
            console.log(indentSpaces + tree.name + mstr);
            dumpRemappedTree(tree.children, indent + 1);
        }
        else console.log(indentSpaces + tree.name + " (leaf)" + mstr);
    }
}

function data() {

    // Public variables

    this.plotData = {};
    this.viewRange = {
        start: new Date().addMonths(-1),
        end: new Date()
    };

    // Private variables

    var that = this;
    var powerSuffixes = [];
    var carbonSuffixes = [];
    var table = [];
    var carbon = new timeSeries();
    var meterReadings = {};

    // Public methods

    this.setMetric = function (mt) {
	this.metricType = mt;
	if (mt == "power"){
	    this.chartUnit = " kW";
	    this.chartUnitFormatter = pwrFormatter;
	    this.selectedId = "kWselected";
	    this.selectedName = "Avg kW Selected";
	    this.allId = "kWTotal";
	    this.allName = "Avg kW Entire";
	    this.totalId = "TotalEnergy";
	    this.totalName = "Total Energy (kWh)"
	    this.totalField = "totalenergy";

	}
	else {
	    this.chartUnit = " gCO2/s";
	    this.chartUnitFormatter = carbonFormatter;
	    this.selectedId = "CO2/s selected";
	    this.selectedName = "g/s Selected";
	    this.allId = "CO2/s all";
	    this.allName = "g/s Entire";
	    this.totalId = "TotalC02";
	    this.totalName = "Total CO2 (tonnes)"
	    this.totalField = "totalcarbon";
	}
    }

    this.invalidatePlotLines = function() {
        for (var i = 0; i < joule.tree.plotLineDesc.length; i++) joule.tree.plotLineDesc[i].valid = false;
    }

    this.resetSelection = function(all) {
        for (var i = 0; i < joule.tree.plotLineDesc.length; i++) joule.tree.plotLineDesc[i].selected = false;
        if (!all) joule.tree.plotLineDesc[0].selected = true;
        joule.tree.selected = _.filter(joule.tree.plotLineDesc, function(d) {
            return d.selected;
        });
    }

    this.setPlotData = function(data) {

        that.plotData = data;

    }

    this.createPlotData = function(type, options) {

        switch (type) {
            case "sankey":
            var  skt = sankeyTree(options.rootId, options.maxDepth, options.step, options.interval);
	    console.log ("here skT");
	    return skt;
                break;
            case "line":
                return lineData();
                break;
            case "treeMap":
                return treeMap(options.rootId, options.maxDepth, options.step, options.interval);
                break;
            default:
                return;
        }

    }

    this.render = function(options) {

        if (typeof options == 'undefined') options = {};

        joule.chart.draw(options);

    }

    this.resetForNewRange = function () {
	updateSuffixes();
        for (var i = 0; i < joule.tree.plotLineDesc.length; i++) joule.tree.plotLineDesc[i].valid = false;
        for (var k in meterReadings)
            if (meterReadings.hasOwnProperty(k)) meterReadings[k].valid = false;
    }

    this.changeRange = function(range) {

        if (range[1].isBefore(range[0]) || range[0].isBefore(joule.data.zeroDate)) return false; // Make sure range remains consistent
        that.viewRange.start = range[0];
        that.viewRange.end = range[1];
	that.resetForNewRange();
        return true;

    };

    this.backup = function(){
	if (that.viewRange.end.isBefore (joule.data.zeroDate)) return false;
	that.viewRange.end.addMonths(-1).clearTime().moveToLastDayOfMonth();
	if (that.viewRange.start.isAfter(joule.data.zeroDate)){
	    that.viewRange.start.addMonths(-1).clearTime().moveToFirstDayOfMonth();
	}
	that.resetForNewRange();
        return true;
	}

    // Private methods

    var fetchSeg = function(urlStem, segSuf, index) {

        var url = urlStem + segSuf + ".json";
        var jsonData = joule.cache.getObject(url, true);

        return $.Deferred(function(deferredObj) {

            $.when(jsonData).done(function(meterData) {
                if (meterData.hasOwnProperty("data")) {
                    deferredObj.resolve(new timeSeries(meterData.data.start, meterData.data.step, meterData.data.readings), index);
                }
                else {
                    deferredObj.resolve(new timeSeries(), index); // if can't find, create empty time series
                    // deferredObj.reject(index);
                }

            }).fail(function() {
                deferredObj.resolve(new timeSeries(), index); // if can't find, create empty time series
                // deferredObj.reject(index);
            });

        });

    };

    var loadMeterData = function(meterNames) {

        function createMeterData(urlDir, meterIndex) {

            return $.Deferred(function(deferredObj) {

                var segments = [],
                    segmentsReq = [],
                    meterTs = new timeSeries();

                for (var i = 0; i < powerSuffixes.length; i++) {
                    segmentsReq[i] = $.when(fetchSeg(urlDir, powerSuffixes[i].year + "-" + powerSuffixes[i].month, i)).done(function(data, segIndex) {
                        segments[segIndex] = data;
                    }).fail(function(segIndex) {
                        segments[segIndex] = new timeSeries();
                    });
                }

                $.when.apply(this, segmentsReq).done(function() {
                    for (var i = 0; i < segments.length; i++) {
                        if (i == 0)
                            meterTs.set(segments[i].start, segments[i].step, segments[i].readings);
                        else
                            meterTs = meterTs.concat(segments[i]);
                    }
                    deferredObj.resolve(meterTs, meterIndex, true);
                }).fail(function() {
                    deferredObj.resolve(meterTs, meterIndex, false);
                });
            }).promise();

        };

        var loadCount = 0;
        var errorCount = 0;

	console.log (meterNames);

        return $.Deferred(function(deferredObj) {

            var metersReq = [];

            for (var i = 0; i < meterNames.length; i++) {
                var m = meterNames[i];
                var path = joule.config.sensorRootUrl.value + "/" + m + "/" + m + "-";
                if (!meterReadings.hasOwnProperty(m)) {
                    meterReadings[m] = {
                        "urlDir": path,
                        "valid": false,
                        "data": new timeSeries()
                    };
                }


                metersReq[i] = createMeterData(path, m).done(function(data, meterIndex, valid) {
                    if (valid) {
                        loadCount++;
                    }
                    else {
                        errorCount++;
                    }
                    meterReadings[meterIndex].data = data;
                    meterReadings[meterIndex].valid = valid;

                    joule.ui.progress(loadCount / meterNames.length, errorCount / meterNames.length);
                });

            }

            var test = $.when.apply($, metersReq).always(function() {
                deferredObj.resolve();
            });

        }).promise();

    };


    var loadCarbonData = function() {

	// Do we have the range already in?

	if (carbon.hasOwnProperty("start")){
	    if ((carbon.start <= that.viewRange.start ) && (carbon.end >= that.viewRange.end)){
		console.log ("Carbon already in");
		return;
	    }
	}



        return $.Deferred(function(deferredObj) {

            var segments = [],
            segmentsReq = [];
      

            for (var i = 0; i < carbonSuffixes.length; i++) {
                segmentsReq[i] = $.when(fetchSeg(config.carbonRootUrl.value, carbonSuffixes[i].year, i)).done(function(data, segIndex) {
                    segments[segIndex] = data;
                }).fail(function(segIndex) {
                    segments[segIndex] = new timeSeries();
                });
            }

            $.when.apply(this, segmentsReq).done(function() {
                for (var i = 0; i < segments.length; i++) {
                    if (i == 0)
                        carbon = segments[0].clone();
                    else {
                        carbon = carbon.concat(segments[i]);
		    }

                }
                deferredObj.resolve(carbon, true);
            }).fail(function() {
                deferredObj.resolve(carbon, false);
            });
        }).promise();


    };

	
    var carbonate = function(x, y) {

        if (that.metricType != "carbon") return y;

        // Find the carbon intensity for this time

        var start = carbon.start;
        var step = carbon.step;
        var offset = (x - carbon.start) / carbon.step;

        if ((offset >= 0) && (offset < carbon.readings.length)) {
            // grams of CO2/kWHr * kW -> g/s : divide by 3600   
            return y * carbon.readings[offset] / 3600;
        }
        return -1;

    }

    var getSuffixes = function(interval) {

        //* Produce an array of month segment suffixes for the viewrange

        var runningDate = new Date(that.viewRange.start);
        var monthStr;
        var yearStr;
        var suffixes = new Array();
        var monthString = new String();

        switch (interval) {
            case "monthly": // Earlier year, or same year and earlier or same month
                while ((runningDate.getFullYear() < that.viewRange.end.getFullYear()) ||
                    ((runningDate.getFullYear() == that.viewRange.end.getFullYear()) &&
                        (runningDate.getMonth() <= that.viewRange.end.getMonth()))) {
                    yearStr = runningDate.getFullYear().toString();
                    monthStr = zero(runningDate.getMonth() + 1);
                    suffixes.push({
                        "year": yearStr,
                        "month": monthStr
                    });
                    runningDate.addMonths(1);
                }
                break;
            case "yearly":
                while (runningDate.getFullYear() <= that.viewRange.end.getFullYear()) {
                    yearStr = runningDate.getFullYear().toString();
                    monthStr = zero(runningDate.getMonth() + 1);
                    suffixes.push({
                        "year": yearStr
                    });
                    runningDate.addYears(1);
                }
                break;
            default:
                while (runningDate.getMonth() <= that.viewRange.end.getMonth()) {
                    yearStr = runningDate.getFullYear().toString();
                    monthStr = zero(runningDate.getMonth() + 1);
                    suffixes.push({
                        "year": yearStr,
                        "month": monthStr
                    });
                    runningDate.addMonths(1);
                }
                break;
        }

        return suffixes;

    };

    var updateSuffixes = function() {

        powerSuffixes = getSuffixes("monthly");
        carbonSuffixes = getSuffixes("yearly");
    };

    var getMeterNames = function() {

        // Update plotLineDesc to show which plot lines are needed (even if not selected) and produce array of meters that are needed

        function descendNeeded(pL, needed) {

            function neededComponents(comps, needed) {

                for (var i = 0; i < comps.length; i++) {
                    if (joule.utils.isMeter(comps[i])) {
                        needed = _.union(needed, [comps[i]]);
                    }
                    else {
                        newPL = _.findWhere(joule.tree.plotLineDesc, {
                            "pLName": comps[i]
                        });
                        if (newPL !== null) {
                            if (!newPL.needed) {
                                newPL.needed = true;
                                needed = descendNeeded(newPL, needed);
                            }
                        }
                    }
                }

                return needed;

            };

            // mark all components of this plotline as needed, and if any are plotLines, descend into them

            if (pL.hasOwnProperty("components")) needed = _.union(needed, neededComponents(pL.components, needed.slice()));
            if (pL.hasOwnProperty("minus")) needed = _.union(needed, neededComponents(pL.minus, needed.slice()));
            if (pL.hasOwnProperty("primary")) needed = _.union(needed, neededComponents(pL.primary, needed.slice()));
            if (pL.hasOwnProperty("secondary")) needed = _.union(needed, neededComponents(pL.secondary, needed.slice()));

            return needed;

        }

        var needed = [];

        for (var i = 0; i < joule.tree.plotLineDesc.length; i++) {
            joule.tree.plotLineDesc[i].needed = false;
            var pL = joule.tree.plotLineDesc[i];
            if (pL.selected) pL.needed = !pL.valid;
            if (pL.needed) needed = _.union(needed, descendNeeded(pL, needed));
        }

        return needed;

    };

    var createTable = function() {

        var table = [];

        for (var i = 0; i < joule.tree.selected.length; i++) {

            var pL = joule.tree.selected[i];

            if (pL.points == undefined) continue;

            if (that.metricType == "carbon") { // Create data for the table
                table.push({
                    "colour": pL.id,
                    "description": pL.description,
                    "startmonthyear": yearMonthFormatter(new Date(pL.start)),
                    "endmonthyear": yearMonthFormatter(new Date(pL.end)),
                    "avgtotal": pwrFormatter(pL.points.avg),
                    "totalcarbon": carbonFormatter(pL.sum),
                    "id": pL.id
                });
            }
            else {
                table.push({
                    "colour": pL.id,
                    "description": pL.description,
                    "startmonthyear": yearMonthFormatter(new Date(pL.start)),
                    "endmonthyear": yearMonthFormatter(new Date(pL.end)),
                    "avgtotal": pwrFormatter(pL.points.avg),
                    "totalenergy": engFormatter(pL.sum),
                    "id": pL.id
                });
            }
        }

        return table;

    }

    var createPoints = function() {

        // Private methods

        function validateData(pL) { // Provide plot lines with final readings

            function getPlotLineData(name) { // Get plot line data from meterReadings[] or if it's not a meter call validatePlotLineData to go down one level

                var data;
                if (joule.utils.isMeter(name)) {
                    if (meterReadings[name].hasOwnProperty("data")) {
                        data = meterReadings[name].data.clone();
                    }
                    else {
                        data = [];
                    }
                }
                else {
                    var compPL = _.findWhere(joule.tree.plotLineDesc, {
                        "pLName": name
                    });
                    validateData(compPL);
                    data = compPL.data;
                }

                return data;

            }

            if (pL.valid) return;
            pL.processed = false;

            if (joule.utils.isMeter(pL.pLName)) {
                pL.data = getPlotLineData(pL.pLName);
                pL.valid = true;
                return;
            }

            if (pL.hasOwnProperty("components")) { // Do summations if needed
                var comps = pL.components;
                pL.data = getPlotLineData(comps[0]).clone();
                for (var k = 1; k < comps.length; k++) {
                    joule.utils.accumDataReadings(pL.data, getPlotLineData(comps[k]).clone(), 1);
                }

                if (pL.hasOwnProperty("minus")) {
                    var minus = pL.minus;
                    for (var k = 0; k < minus.length; k++) {
                        joule.utils.accumDataReadings(pL.data, getPlotLineData(minus[k]), -1);
                    }
                }
                pL.valid = true;
                return;
            }

            if (pL.hasOwnProperty("primary")) {
                var prim = pL.primary[0];
                pL.data = getPlotLineData(prim).clone();
                pL.valid = true;
                if (pL.hasOwnProperty("secondary")) {
                    pL.data = joule.utils.altDataReadings(pL.data, getPlotLineData(pL.secondary[0]));
                }
                return;
            }
        }

        // Private variables

        var pAA = {};
        pAA.data = [];
        var maxA = [];
        var end = new Date();
        var start = new Date();
        var invalid = true;
        table = [];

        // createPoints function code

        for (var p = 0; p < joule.tree.plotLineDesc.length; p++) { // For each plot line in plotLineDesc
            var pL = joule.tree.plotLineDesc[p];
            pL.processed = false;
            if (!pL.selected) continue;
            invalid = false;
            pL.error = true;
      //      pL.selected = false;

            validateData(pL);


            if (!pL.processed) { // Process data to set start and end dates and fix bad data

                if (!pL.hasOwnProperty("data")) continue;
                if (pL.data === null) continue;
                if (pL.data.readings.length < 2) continue;
                pL.error = false;
                pL.selected = true;
                pL.points = {};
                pL.points.data = [];

                pL.end = new Date();
                pL.start = new Date();
                var x = pL.data.start;

                var yMax = 0.0;
                var sum = 0.0;
                var points = 0;
                var avg = 0;
                var duration;

                points = 0;

                for (var i = 0; i < pL.data.readings.length; i++) {

                    var y = pL.data.readings[i];

                    if (!(typeof y === "number") || (y < 0) || (y > 1000)) {
                        var fakeY = 0;
                        if (pL.points.data.length > 0) {
                            fakeY = (pL.points.data[pL.points.data.length - 1].y);
                        }
                        pL.points.data.push({
                            bad: true,
                            x: new Date(x),
                            y: fakeY
                        });
                    }
                    else {
                        y = carbonate(x, y);
                        if (y >= 0) {
                            points++;
                            if (yMax < y) yMax = y;
                            pL.points.data.push({
                                x: new Date(x),
                                y: y
                            });
                        }
                        else pL.points.data.push({
                            bad: true,
                            x: new Date(x),
                            y: fakeY
                        });
                    }

                    x += pL.data.step;

                }

                if (points <= 0) continue;




                pL.points.data = _.filter(pL.points.data, function(v) {
                    return v.x.between(that.viewRange.start, that.viewRange.end)
                });
                if (pL.points.data.length == 0) continue;

                pL.points.id = p;
                pL.start = pL.points.data[0].x;

                pL.end = pL.points.data[pL.points.data.length - 1].x;

                if (points > 0) {

                    avg = joule.utils.avg(_.filter(pL.points.data, function(v) {
                        return v.x.between(that.viewRange.start, that.viewRange.end)
                    }));

                }
                duration = (pL.end - pL.start) / 1000 / 60 / 60; // milliseconds to hours
                if (that.metricType == "carbon") {
                    sum = avg * duration * 3600 / 1000 / 1000; // CO2 in tonnes is g/s * duration in hours * 3600 / 1000 / 1000        
                }
                else {
                    sum = avg * duration; // Energy in kW hr is just avg power in kW times hours
                }
                pL.yMax = yMax;
                pL.sum = sum;
                pL.points.avg = avg;

                pL.processed = true;
            }

            if (p === 0) { // Make sure all data is available by limiting the start and end date
                start = pL.start;
                end = pL.end;
            }
            else {
                if (start > pL.start) start = pL.start;
                if (end < pL.end) end = pL.end;
            }

            pAA.data.push(pL.points);
            maxA.push(pL.yMax);

        }

        if (invalid) {
	    console.log ("Invalid");
	    return false;
	}
        if (pAA.data.length === 0) {
            console.warn("Data is empty for the given viewRange. Selection will be moved back by a month");
            return false;
        }
        else {
            console.log()
            if (end < that.viewRange.end)
                that.viewRange.end = end;
            if (start > that.viewRange.start)
                that.viewRange.start = start;
            return true;
        }
    }

    var averageData = function(interval) {

        var averagedData = [];
        console.time("data");
        switch (interval) {
            case "hourly":
                return;
                break;
            case "daily":
                joule.tree.plotLineDesc.forEach(function(v, k, l) {
                    if (v.hasOwnProperty("points")) {
                        averagedData = _.groupBy(v.points.data, function(w) {
                            return w.x.toDateString();
                        });
                        v.points.data = [];
                        _.map(averagedData, function(v, k) {
                            return {
                                day: new Date(Date.parse(k)),
                                values: v
                            };
                        }).forEach(function(w) {
                            v.points.data.push({
                                "x": w.day,
                                "y": joule.utils.avg(w.values)
                            });
                        });
                    }
                });
                break;
            case "weekly":
                joule.tree.plotLineDesc.forEach(function(v, k, l) {
                    if (v.hasOwnProperty("points")) {
                        averagedData = _.groupBy(v.points.data, function(w) {
                            return w.x.moveToDayOfWeek(1, -1).toDateString();
                        });
                        v.points.data = [];
                        _.map(averagedData, function(v, k, l) {
                            return {
                                day: new Date(Date.parse(k)),
                                values: v
                            };
                        }).forEach(function(w) {
                            v.points.data.push({
                                x: w.day,
                                y: joule.utils.avg(w.values)
                            });
                        });
                    }
                });
                break;
            case "monthly":
                joule.tree.plotLineDesc.forEach(function(v, k, l) {
                    if (v.hasOwnProperty("points")) {
                        averagedData = _.groupBy(v.points.data, function(w) {
                            return w.x.moveToFirstDayOfMonth().toDateString();
                        });
                        v.points.data = [];
                        _.map(averagedData, function(v, k, l) {
                            return {
                                day: new Date(Date.parse(k)),
                                values: v
                            };
                        }).forEach(function(w) {
                            v.points.data.push({
                                x: w.day,
                                y: joule.utils.avg(w.values)
                            });
                        });
                    }
                });
                break;
            default:
                return;
        }
        console.timeEnd("data");
    }

    var lineData = function() {

        return update().done(function() {
            var data = [];
            var yMax = [];

            _.each(joule.tree.selected, function(v) {
                data.push(v.points);
                yMax.push(v.yMax);
            });

            that.plotData = {
                "start": that.viewRange.start,
                "end": that.viewRange.end,
                "data": data,
                "yMax": _.max(yMax),
                "table": createTable()
            };
        });

    }

    var sankeyTree = function(rootId, maxDepth, step, interval) {

        var sData = {};
        sData.nodes = [];
        sData.links = [];
        var subPlot = [];
        var minDepth = 0;
        var drill = false;

        if (typeof step !== 'number' || step < 0)
            step = 0;

        sData.step = step;

        if (typeof rootId == 'undefined') {
            if (typeof that.plotData.rootId != 'undefined')
                rootId = that.plotData.rootId;
            else
                rootId = 0;
        }

        if (typeof joule.tree.plotLineDesc[rootId] != 'undefined')
            minDepth = joule.tree.plotLineDesc[rootId].depth;

        if (typeof maxDepth == 'undefined' || maxDepth <= minDepth)
            maxDepth = joule.tree.absMaxDepth;
        else
            var maxDepth = parseInt(maxDepth);

        that.resetSelection(true);

        if (joule.tree.plotLineDesc[rootId].hasOwnProperty("children")) {
            joule.tree.plotLineDesc[rootId].selected = true;
            subPlot = joule.tree.plotLineDesc[rootId].children;
            drill = true;
        }
        else {
            joule.tree.plotLineDesc[rootId].selected = true;
            subPlot = joule.tree.plotLineDesc;
        }

        function selectPL(v) {
            if (v.depth >= minDepth && v.depth <= maxDepth) v.selected = true;
            if (v.hasOwnProperty("children") && drill) v.children.forEach(selectPL);
        }

        function createStructure(v) {
            if (v.depth > maxDepth) maxDepth = v.depth;
            if (v.selected && v.avg != 0 && typeof v.points != 'undefined' && !v.error) {
                sData.nodes.push({
                    node: v.id,
                    name: v.nodeName,
                    description: v.description,
                    depth: v.depth
                });
                if (v.depth > minDepth) {
                    if ((v.components.length > 1 || v.hasOwnProperty("minus")) && typeof v.children != 'undefined')
                        sData.links.push({
                            source: typeof v.parent.id == 'undefined' ? 0 : v.parent.id,
                            target: v.id,
                            value: v.points.data[step].y == 0 ? 0.001 : v.points.data[step].y
                        });
                    else if ((v.components.length == 1) && (v.points.data.length > 0)) {
                        sData.links.push({
                            source: typeof v.parent.id == 'undefined' ? 0 : v.parent.id,
                            target: v.id,
                            value: v.points.data[step].y == 0 ? 0.001 : v.points.data[step].y
                        });
                    }
                }
            }
        }

        subPlot.forEach(selectPL);

        // Get data for the selected nodes
        return update().then(function() {

	    if (typeof joule.tree.selected[0].points == 'undefined') return;
            if (typeof interval == 'undefined')
                if (typeof that.plotData.interval == 'undefined')
                    interval = 'hourly';
                else
                    interval = that.plotData.interval;

            averageData(interval);

            sData.interval = interval;
            sData.maxStep = joule.tree.selected[0].points.data.length - 1;
            sData.timestamp = joule.tree.selected[0].points.data[step].x;
            maxDepth = 0;
            joule.tree.selected.forEach(createStructure);
            sData.minDepth = minDepth;
            sData.maxDepth = maxDepth;
            sData.rootId = rootId;
            that.setPlotData(sData);
        });

    }

    var treeMap = function(rootId) {

        if (typeof rootId !== 'number' || typeof joule.tree.plotLineDesc[rootId] == 'undefined')
            rootId = joule.tree.master.id;

        var minDepth = joule.tree.plotLineDesc[rootId].depth;

        var maxDepth = joule.tree.absMaxDepth;

        if (typeof step !== 'number' || step < 0)
            step = 0;

        function extractTreeMap(plotLines, minDepth, maxDepth) {

            // This returns a sensible tree, that is, one with a root node that is the sum of the leaves
            // in a form ready for the tree map plot.  (The original display treeObj is actually a collection
            // of plotLines, not a tree at all.)

            typeof minDepth == 'undefined' ? minDepth = 0 : minDepth++;

            var extractedTree = [];

            plotLines.forEach(function(v, k, l) {
                  if ( /*v.depth == minDepth && */ !v.error && v.points.avg != 0) {
                    if (v.hasOwnProperty("children") && minDepth != maxDepth) {
  //                      console.log("pushing array");
                        var childrenArray = extractTreeMap(v.children, minDepth, maxDepth);
                        extractedTree.push({
                            id: v.id,
                            name: v.nodeName,
                            description: v.description,
                            type: "node",
                            children: childrenArray
                        });
                    }
                    else {
  //                      console.log("pushing single");
                        extractedTree.push({
                            id: v.id,
                            name: v.nodeName,
                            description: v.description,
                            selected: v.selected,
                            type: "leaf",
                            value: v.points.avg
                        });
                    }
                }

            });
//            console.log("extracted, root is " + extractedTree[0].name);
            // dumpRemappedTree(extractedTree, 0);
            return extractedTree;

        }

        function selectPL(v) {
            if (true) v.selected = true;
            if (v.hasOwnProperty("children")) v.children.forEach(selectPL);
        }

        // One of the plotLines may be designated 'master' (i.e. tree root) WHICH SHOULD BE CHANGED to 'map root'

        var subPlot = joule.tree.plotLineDesc;

        for (var p = 0; p < joule.tree.plotLineDesc.length; p++) {
            if (joule.tree.plotLineDesc[p].hasOwnProperty("tree map root")) {
//                console.log("Found tree map root at " + joule.tree.plotLineDesc[p].pLName);
                subPlot = [joule.tree.plotLineDesc[p]];
                break;
            }
        }
        subPlot.forEach(selectPL);
//        console.log("BEGIN{tree dump}");
//        dumpTree(subPlot, 0, 0);
//        console.log("END{tree dump}");


        return update().done(function() {
            that.setPlotData(extractTreeMap(subPlot.slice(), -1 /*minDepth*/ , maxDepth)[0]);
        });

    }

    var update = function() {

        joule.tree.selected = _.filter(joule.tree.plotLineDesc, function(d) {
            return d.selected;
        });

        return $.when(
            loadMeterData(getMeterNames()),
            loadCarbonData()
        ).done(function() {
            var iterations = 0;
            var validSelection = createPoints();
	    /*
            while (validSelection === false && iterations < 5) {
                console.log(that.viewRange);
                that.changeRange([that.viewRange.end.clone().addMonths(-1).clearTime().moveToFirstDayOfMonth(), that.viewRange.end.clearTime().addMonths(-1).moveToLastDayOfMonth()]);
                that.resetSelection();
                loadMeterData(getMeterNames());
                loadCarbonData();
                validSelection = createPoints();
                iterations++;
                console.log(iterations, validSelection, that.viewRange);
            }
	    */
	    if (!validSelection) joule.ui.backup();
        });

    }

    // Initilisation calls

    updateSuffixes();
    this.setMetric ("power");
}
