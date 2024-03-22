class P25CallData {
    constructor({ key, system, dateTime, talkgroup, source, frequency, talkgroupLabel, talkgroupGroup, systemLabel, patches }) {
        this.key = key;
        this.system = system;
        this.dateTime = dateTime;
        this.talkgroup = talkgroup;
        this.source = source;
        this.frequency = frequency;
        this.talkgroupLabel = talkgroupLabel;
        this.talkgroupGroup = talkgroupGroup;
        this.systemLabel = systemLabel;
        this.patches = patches;
    }
}

module.exports = P25CallData;