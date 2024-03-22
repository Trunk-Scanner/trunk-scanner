class LtrCallData {
    constructor({ key, system, dateTime, talkgroup, source, frequency, talkgroupLabel, talkgroupGroup, systemLabel, patches }) {
        this.key = key;
        this.system = system;
        this.dateTime = dateTime;
        this.talkgroup = this.parseTalkgroup(talkgroup).talkgroup;
        this.homeChannel = this.parseTalkgroup(talkgroup).homeChannel;
        this.areaBit = this.parseTalkgroup(talkgroup).areaBit;
        this.source = source;
        this.frequency = frequency;
        this.talkgroupLabel = talkgroupLabel;
        this.talkgroupGroup = talkgroupGroup;
        this.systemLabel = systemLabel;
        this.patches = patches;
    }

    parseTalkgroup(talkgroup) {
        const areaBit = talkgroup.substring(0, 1);
        const homeChannel = talkgroup.substring(1, 3);
        const tgid = talkgroup.substring(3);

        return {
            areaBit: areaBit,
            homeChannel: homeChannel,
            talkgroup:tgid
        };
    }

}

module.exports = LtrCallData;