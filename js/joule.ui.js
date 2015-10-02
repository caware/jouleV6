function JouleUIController() {
    var that = this;

    this.errorIds = [];
    this.errorTimeout = 4;
    this.scaleSelection = 'scale';

    var opts = {
        lines: 13, // The number of lines to draw
        length: 4, // The length of each line
        width: 6, // The line thickness
        radius: 12, // The radius of the inner circle
        corners: 0.5, // Corner roundness (0..1)
        rotate: 0, // The rotation offset
        direction: 1, // 1: clockwise, -1: counterclockwise
        color: '#000', // #rgb or #rrggbb or array of colors
        speed: 1, // Rounds per second
        trail: 29, // Afterglow percentage
        shadow: false, // Whether to render a shadow
        hwaccel: false, // Whether to use hardware acceleration
        className: 'spinner', // The CSS class to assign to the spinner
        zIndex: 2e9, // The z-index (defaults to 2000000000)
        top: '265', // Top position relative to parent in px
        left: '400' // Left position relative to parent in px
    };
    var spinner = new Spinner(opts).spin(document.getElementById("loading"));

    this.line = {

        addMonth: function(button) {
            $("#rangeDown").toggleClass("disabled", !joule.data.changeRange(-1));
        },

        toggleFilter: function() {
            joule.chart.filter = !joule.chart.filter;
            joule.chart.redraw({});
            $("#filter").toggleClass("active", joule.chart.filter);
        },

        toggleAreas: function() {
            joule.chart.areas = !joule.chart.areas;
            $(".f-area path").toggle(joule.chart.areas);
            $("#areas").toggleClass("active", joule.chart.areas);
        },

        removeMonth: function(button) {
            $("#rangeDown").toggleClass("disabled", !joule.data.changeRange(1));
        },

        scaleChange: function(scaleType) {

            $('#scaleAllButton').toggleClass('active', scaleType == 'all');
            $('#scaleSelectionButton').toggleClass('active', scaleType == 'scale');
            $('#zoomButton').toggleClass('active', scaleType == 'zoom');

            switch (scaleType) {
                case 'all':
                    joule.chart.scaleSelection = 'all';
                    break;
                case 'scale':
                    joule.chart.scaleSelection = 'scale';
                    break;
                case 'zoom':
                    joule.chart.scaleSelection = 'zoom';
                    break;
                default:
                    joule.chart.scaleSelection = 'scale';
            }
            joule.data.render();

        }

    };

    this.sankey = {

        playing: false,

        changeDepth: function(input) {
            joule.data.render({
                "maxDepth": $(input).val()
            });
        },

        levelUp: function() {
            if (joule.data.plotData.minDepth > 0) {
                joule.data.render({
                    "rootId": joule.tree.plotLineDesc[joule.data.plotData.rootId].parent.id,
                    "maxDepth": $("input[name=maxDepth]").val()
                });
            }
            else return;
        },

        stepUp: function() {
            if (joule.data.plotData.step < joule.data.plotData.maxStep) {
                joule.data.render({
                    "rootId": joule.data.plotData.rootId,
                    "maxDepth": $("input[name=maxDepth]").val(),
                    "step": joule.data.plotData.step + 1,
                    "interval": $("select[name=interval]").val()
                });
            }
        },

        stepDown: function() {
            if (joule.data.plotData.step > 0)
                joule.data.render({
                    "rootId": joule.data.plotData.rootId,
                    "maxDepth": $("input[name=maxDepth]").val(),
                    "step": joule.data.plotData.step - 1,
                    "interval": $("select[name=interval]").val()
                });
        },

        play: function() {
            var playing = that.sankey.playing = !that.sankey.playing;
            $("button[name=play] span").toggleClass("glyphicon-pause", playing);
            $("button[name=ff]").toggleClass("disabled", !playing);
            $("button[name=play] span").toggleClass("glyphicon-play", !playing);
            if (playing)
                that.sankey.playFn = setInterval(function() {
                    if (joule.data.plotData.step < joule.data.plotData.maxStep)
                        that.sankey.stepUp();
                    else
                        clearInterval(that.sankey.playFn);
                }, 1000);
            else clearInterval(that.sankey.playFn);
        },

        fastForward: function() {
            clearInterval(that.sankey.playFn);
            that.sankey.playFn = setInterval(function() {
                if (joule.data.plotData.step < joule.data.plotData.maxStep)
                    that.sankey.stepUp();
                else
                    clearInterval(that.sankey.playFn);
            }, 500);
        },

        intervalChange: function() {
            joule.data.render({
                "rootId": joule.data.plotData.rootId,
                "maxDepth": $("input[name=maxDepth]").val(),
                "interval": $("select[name=interval]").val()
            });
        }

    };

    this.treeMap = {

        intervalChange: function() {
            joule.data.render();
        }

    };

    this.tree = {

        reset: function() {
            joule.data.resetSelection();
            joule.data.render();
        },

        collapse: function() {
            joule.chart.treeUpdate({
                "expand": false
            });
        },

        expand: function() {
            joule.chart.treeUpdate({
                "expand": true
            });
        },

        nodeClick: function(d) {

            var returnObj = {};
            var options = {};

            switch (joule.chart.type) {
                case "line":
                    if (joule.tree.selected.length == 10 && !d.selected && d.type != "node") {
                        ui.showError(null, "You have reached the maximum 10 lines", "warning", 1.5, ui);
                        return;
                    }
                    if (joule.tree.plotLineDesc[d.id].selected) {
                        joule.tree.selected.length > 1 ? joule.tree.plotLineDesc[d.id].selected = false : ui.showError(null, "At least one sensor has to be selected", "warning", 1, ui);
                    }
                    else {
                        joule.tree.plotLineDesc[d.id].selected = true;
                        joule.data.render();
                    }
                    break;
                case "sankey":
                    if ((joule.tree.plotLineDesc[d.id].depth == joule.data.plotData.maxDepth) || (joule.tree.plotLineDesc[d.id].depth < joule.data.plotData.maxDepth && !joule.tree.plotLineDesc[d.id].hasOwnProperty("children") && d.id != joule.tree.master.id)) return; //The last condition in this if stement is to be removed once the tree structure is updated
                    if (d.id == joule.data.plotData.rootId && d.id != joule.tree.master.id)
                        options = {
                            "rootId": joule.tree.plotLineDesc[d.id].parent.id,
                            "maxDepth": $("input[name=maxDepth]").val()
                        };
                    else
                        options = {
                            "rootId": d.id,
                            "maxDepth": $("input[name=maxDepth]").val()
                        };
                    break;
                default:
                    return;
            }

            joule.tree.selected = _.filter(joule.tree.plotLineDesc, function(d) {
                return d.selected;
            });
            joule.data.render(options);

            return returnObj;

        }
    }

    this.graph = function(button, type) {

        $(button).hasClass("btn-success") ? null : $(button).toggleClass("btn-success", true).toggleClass("btn-default", false).siblings().toggleClass("btn-default", true).toggleClass("btn-success", false);

        switch (type) {
            case "line":
                if (joule.chart.type == "line") return;
                $(".btn-toolbar").hide();
                joule.chart.changing = true;
                joule.chart.type = "line";
                $(".btn-toolbar.line").show();
                joule.data.resetSelection();
                joule.data.render();
                break;
            case "sankey":
                if (joule.chart.type == "sankey") return;
                $(".btn-toolbar").hide();
                joule.chart.changing = true;
                joule.chart.type = "sankey";
                $(".btn-toolbar.sankey").show();
                joule.data.render();
                break;
            case "treeMap":
                if (joule.chart.type == "treeMap") return;
                $(".btn-toolbar").hide();
                joule.chart.changing = true;
                joule.chart.type = "treeMap";
                $(".btn-toolbar.treeMap").show();
                joule.data.render();
                break;
            default:
                return;
        }

    }

    this.units = function(button) {

        var unit = $(button).attr("unit");
        if (joule.data.metricType == unit) return;

	joule.data.setMetric (unit);
        $(".btn-units").html($("li[unit=" + unit + "] a").html());
        $("li[role=unit]").toggleClass("active", false);
        $(button).toggleClass("active", true);

        joule.data.invalidatePlotLines();
        joule.data.render();

    }

    this.progress = function(loaded, errors) {

        $(".progress-bar-success").css("width", loaded * 100 + "%");
        $(".progress-bar-danger").css("width", errors * 100 + "%");

    }

    this.changeRange = function(e) {

        var start = Date.parse($("input.date[name=startDate]:visible").val());
        $("input.date[name=startDate]").val($("input.date[name=startDate]:visible").val());
        var end = Date.parse($("input.date[name=endDate]:visible").val());

        if (start.isBefore(end)) {
            joule.data.changeRange([start, end]);
            joule.data.render();
        }

        $("input.date[name=startDate]").datetimepicker("setEndDate", end);
        $("input.date[name=endDate]").datetimepicker("setStartDate", start);

    };

    this.update = function() {

        switch (joule.chart.type) {
            case "line":
                $("input.date[name=endDate]").val(joule.data.viewRange.end.toString("dd-MM-yyyy HH:mm"));
                break;
            case "sankey":
                $(".sankey button[name=levelUp]").toggleClass("disabled", joule.data.plotData.minDepth < 1);
                var canProgress = _.some(_.filter(joule.tree.selected, function(v) {
                    return v.depth == joule.data.plotData.maxDepth;
                }), function(v) {
                    return v.hasOwnProperty("children") || v.depth == 1;
                }); // Hardcoded 1
                $("input[name=maxDepth]").attr("min", joule.data.plotData.minDepth + 1)
                    .attr("max", canProgress ? joule.tree.absMaxDepth : joule.data.plotData.maxDepth)
                    .attr("value", joule.data.plotData.maxDepth)
                    .prop("disabled", !canProgress && joule.data.plotData.maxDepth == joule.data.plotData.minDepth + 1);
                $("button[name=stepDown]").toggleClass("disabled", joule.data.plotData.step == 0);
                $("button[name=stepUp]").toggleClass("disabled", joule.data.plotData.step == joule.data.plotData.maxStep);
                break;
            default:
                return;
        }

    }

    this.jouleFinishedLoading = function() {
        $("button, a.noLink").click(function(e) {
            e.preventDefault();
        });
        $("input.date[name=startDate]").val(new Date().addMonths(-1).toString("dd-MM-yyyy HH:mm"));
        $("input.date[name=endDate]").val(new Date().toString("dd-MM-yyyy HH:mm"));
        $("button[name=" + joule.chart.type + "]").addClass("btn-success").removeClass("btn-default");
        $(".btn-toolbar." + joule.chart.type).show();
        $("input.date").datetimepicker({
            "format": "dd-mm-yyyy hh:ii",
            "startDate": joule.data.zeroDate = typeof joule.config.zeroDate !== 'undefined' ? new Date(joule.config.zeroDate.value) : new Date(2012, 11, 1),
            "endDate": new Date(),
            "todayHighlight": true,
            "minView": 1
        }).change(that.changeRange);
        $("#loading").css({
            "width": (joule.chart.dim.w + joule.chart.dim.margin.left + joule.chart.dim.margin.right) + "px",
            "height": (joule.chart.dim.margin.top + joule.chart.dim.margin.bottom + joule.chart.dim.h1 + joule.chart.dim.h2 + joule.chart.dim.spacing) + "px"
        });
        joule.chart.tree();
        joule.data.render();
    };

    this.loading = function(loading) {

        $("#loading").toggle(loading);
        if (loading)
            $(".progress").stop().fadeTo(200, 1);
        else {
            $(".progress").stop().fadeTo(2000, 0, function() {
                that.progress(0, 0);
            });
        }
    }

    this.jouleStopLoading = function() {

    };

    this.showError = function(error, errorText, errorType, timeout) {

        var id = new Date().getTime().toString();
        var genHTML = "<div class='alert alert-" + errorType + "' id='" + id + "'><strong>";

        switch (errorType) {
            case "warning":
                genHTML += "Warning: ";
                break;
            case "danger":
                genHTML += "Error: ";
                break;
            case "success":
                genHTML += "Success: ";
                break;
            case "info":
                genHTML += "Info: ";
                break;
        }

        genHTML += "</strong>" + errorText + "</div>";

        $('#alert-bar').show().prepend(genHTML);

        var time = timeout * 1000;
        var t = setTimeout('ui.hideError(' + id + ')', time);
    };

    this.hideError = function(id) {
        jQid = '#' + id;
        $(jQid + ", #alert-bar").hide("fast", function() {
            $(jQid).remove();
        });
    };

    this.catchError = function(useri, call, arg) {
        var obj = call.apply(null, arg);
        if (obj.status !== 200) {
            useri.showError(obj.status, obj.statusText, "danger", that.errorTimeout);
        }
        return obj;
    };

}
