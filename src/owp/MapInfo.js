exports.$ = (function () {
    var MapInfo = function (ruleSet, map) {
        this.ruleSet = ruleSet;
        this.map = map;
    };

    MapInfo.fromSettings = function (ruleSet, map, settings) {
        var mapInfo = new MapInfo(ruleSet, map, settings);

        var fields = (
            'audioFile,audioLeadIn,previewTime,countdown,modes,' +
            'letterBoxDuringBreaks,' +
            'title,artist,creator,difficulty,source,tags'
        ).split(',');

        var i, key;

        for (i = 0; i < fields.length; ++i) {
            key = fields[i];

            mapInfo[key] = settings && settings.hasOwnProperty(key) ? settings[key] : undefined;
        }

        return mapInfo;
    };

    return MapInfo;
}());