function isP25Call(call) {
    if (!call.talkgroup.length <= 5 && parseInt(call.talkgroup) < 65535) {
        call.mode = "P25"
        return true;
    }

    call.mode = "UNKOWN";
    return false;
}

function isDmrCall(call) {
    call.mode = "DMR";

    return false; // just return false bc dmr isnt a concern
}

function isLtrCall(call) {
    if (call.talkgroup.length < 6) {
        return false;
    }

    const areaBit = call.talkgroup.substring(0, 1);
    const homeChannel = call.talkgroup.substring(1, 3);
    const tgid = call.talkgroup.substring(3);

    if (!['0', '1'].includes(areaBit)) {
        return false;
    }

    if (!/^[0-2][0-9]$/.test(homeChannel) || parseInt(homeChannel, 10) < 1 || parseInt(homeChannel, 10) > 20) {
        return false;
    }

    if (!/^\d+$/.test(tgid)) {
        return false;
    }

    call.mode = "LTR";
    return true;
}

module.exports = {
    isP25Call,
    isDmrCall,
    isLtrCall
}