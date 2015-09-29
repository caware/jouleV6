function JSONCache() {

    //A Class for defining a unique index => JSON store

    var that = this;
    this.cache = {};
    this.cachehits = 0;
    this.cachemisses = 0;


    this.getObject = function(url, async) {

        var returnObj = {
            result: null
        };

        function CheckURLIsData(u) {
            return (u.search("S-m[0-9][0-9]*-20[0-9][0-9]-[0-9][0-9]*.json") >= 0);
        }

        var mightBeShortData;
        var returnObj = {};
        var cacheObj = {};
        var jsonFile;
        var found = false;
        //Fetches a json file from the cache, or downloads and inserts it if not already there.


        for (var c in this.cache) {
            if (this.cache.hasOwnProperty(c)) {
                if (c === url) {
                    found = true;
                    this.cachehits++;
                    return this.cache[url];
                }
            }
        }

        if (!found) {
            if (async)
                returnObj = $.ajax({
                    dataType: "json",
                    url: url
                }).done(function(data) {
                    that.cache[url] = data;
                });
            else
                returnObj = $.ajax({
                    dataType: "json",
                    url: url,
                    async: false
                });
        }
       
        return returnObj;
    };

    this.ajaxError = function(jqXHR, textStatus, errorThrown) {
        var error = {
            reqObj: jqXHR,
            status: textStatus,
            error: errorThrown
        };
    };

    this.clearCache = function() {
        this.cache = {};
    };

}
