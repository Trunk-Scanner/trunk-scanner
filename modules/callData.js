function isP25Call(call) {
    if (!call.talkgroup.length <= 5 && parseInt(call.talkgroup) < 65535) {
        return true;
    }

    call.mode = "UNKNOWN";
    return false;
}

function isDmrCall(call) {
    if (!call.talkgroup.length <= 8 && parseInt(call.talkgroup) < 16777215) {
        return true;
    }

    call.mode = "UNKNOWN";
    return false;
}

function isLtrCall(call) {
    if (call.talkgroup.length < 6) {
        return false;
    }

    const areaBit = call.talkgroup.substring(0, 1);
    const homeChannel = call.talkgroup.substring(1, 3);
    const tgid = call.talkgroup.substring(3);

    if (!['0', '1'].includes(areaBit)) {
        call.mode = "UNKNOWN";
        return false;
    }

    if (!/^[0-2][0-9]$/.test(homeChannel) || parseInt(homeChannel, 10) < 1 || parseInt(homeChannel, 10) > 20) {
        call.mode = "UNKNOWN";
        return false;
    }

    if (!/^\d+$/.test(tgid)) {
        call.mode = "UNKNOWN";
        return false;
    }

    return true;
}

module.exports = {
    isP25Call,
    isDmrCall,
    isLtrCall
}