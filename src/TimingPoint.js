define('TimingPoint', [ ], function () {
    function TimingPoint(options) {
        this.time = options.time;
        this.bpm = options.bpm;
        this.isInherited = options.isInherited;
        this.hitSoundVolume = options.hitSoundVolume;
    }

    TimingPoint.prototype.getEffectiveBPM = function (parent) {
        if (this.isInherited) {
            return this.bpm * parent.getEffectiveBPM();
        } else {
            return this.bpm;
        }
    }

    return TimingPoint;
});
