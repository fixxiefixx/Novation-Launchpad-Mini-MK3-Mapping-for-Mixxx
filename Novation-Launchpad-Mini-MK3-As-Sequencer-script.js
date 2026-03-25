// eslint-disable-next-line no-var
var NovationLMiniMK3 = {};

NovationLMiniMK3.MODE_PROG = [ 0xf0, 0x00, 0x20, 0x29, 0x02, 0x0d, 0x0e, 0x01, 0xf7 ];
NovationLMiniMK3.MODE_LIVE = [ 0xf0, 0x00, 0x20, 0x29, 0x02, 0x0d, 0x0e, 0x00, 0xf7 ];
NovationLMiniMK3.MODE_READBACK = [ 0xf0, 0x00, 0x20, 0x29, 0x02, 0x0d, 0x0e, 0xf7 ];
NovationLMiniMK3.LAYOUT_SESSION = [0xf0, 0x00, 0x20, 0x29, 0x02, 0x0d, 0x00, 0x00, 0xf7];

NovationLMiniMK3.PROG_MIDI_LAYOUT =[0x5b, 0x5c, 0x5d, 0x5e, 0x5f, 0x60, 0x61, 0x62, 0x63,
    0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
    0x47, 0x48, 0x49, 0x4a, 0x4b, 0x4c, 0x4d, 0x4e, 0x4f,
    0x3d, 0x3e, 0x3f, 0x40, 0x41, 0x42, 0x43, 0x44, 0x45,
    0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x3b,
    0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f, 0x30, 0x31,
    0x1f, 0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27,
    0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d,
    0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13 ];


NovationLMiniMK3.colorCodes = {
    'off': 0x00,
    'gray': 0x01,
    'white': 0x03,
    'darkRed': 0x07,
    'red' : 0x05,
    'darkGreen' : 0x7B,
    'green' : 0x15,
    'blue' : 0x25,
    'purple' : 0x45,
    'pink' : 0x5F,
    'orange' : 0x3C,
    'beige' : 0x6C
};

NovationLMiniMK3.padButtons = {
    'play' : 0x59,
    'record' : 0x4F,
    'clear' : 0x45,
    'edit' : 0x3B,
    'bank1' : 0x60,
    'bank2' : 0x61
}

NovationLMiniMK3.deckSyncIndex = -1;
NovationLMiniMK3.isPlaying = false;
NovationLMiniMK3.isRecording = false;
NovationLMiniMK3.seqLen = 8 * 4;
NovationLMiniMK3.seqPos = 0;
NovationLMiniMK3.editPos = -1;
NovationLMiniMK3.beatDistanceConnection = null;
NovationLMiniMK3.lastBeatDistance = 0;
NovationLMiniMK3.bankIndex = 0;

NovationLMiniMK3.recording = [];
NovationLMiniMK3.samplesToIgnoreForNextstep = [];
NovationLMiniMK3.currentPlayingSamples = [];


NovationLMiniMK3.setPadColor = function(control, color){
    let message = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x03, 0x00, control, color, 0xF7];
    midi.sendSysexMsg(message, message.length);
}

NovationLMiniMK3.init = function (id, debugging) {
    midi.sendSysexMsg(this.MODE_PROG, this.MODE_PROG.length);

    //Initalize recording array
    for(let i = 0; i < this.seqLen;i++){
        this.recording.push([]);
    }

    //Make seqencer pads white
    for(let i=0; i< this.seqLen;i++)
    {
        NovationLMiniMK3.setPadColor(NovationLMiniMK3.seqIndexToMidino(i), NovationLMiniMK3.colorCodes.gray);
    }

    //Play pad
    NovationLMiniMK3.setPadColor(NovationLMiniMK3.padButtons.play, NovationLMiniMK3.colorCodes.darkGreen);

    //Recording pad
    NovationLMiniMK3.setPadColor(NovationLMiniMK3.padButtons.record, NovationLMiniMK3.colorCodes.darkRed);

    //Clear pad
    NovationLMiniMK3.setPadColor(NovationLMiniMK3.padButtons.clear, NovationLMiniMK3.colorCodes.orange);

    //Edit pad
    NovationLMiniMK3.setPadColor(NovationLMiniMK3.padButtons.edit, NovationLMiniMK3.colorCodes.purple);


    //light up sync buttons
    for(let i = 1; i < 4; i++)
    {
        NovationLMiniMK3.setPadColor(NovationLMiniMK3.PROG_MIDI_LAYOUT[i], NovationLMiniMK3.colorCodes.gray);
    }
    this.setDeckSyncIndex(0);

    //sampler bank buttons
    NovationLMiniMK3.setPadColor(NovationLMiniMK3.padButtons.bank1, NovationLMiniMK3.colorCodes.green);
    NovationLMiniMK3.setPadColor(NovationLMiniMK3.padButtons.bank2, NovationLMiniMK3.colorCodes.gray);
}

NovationLMiniMK3.shutdown = function() {
    midi.sendSysexMsg(this.MODE_LIVE, this.MODE_LIVE.length);
}

NovationLMiniMK3.isControlPad = function(padIndex){
    if(padIndex <= 8)
        return true;
    if((padIndex + 1) % 9 == 0)
        return true;
    return false;
}

NovationLMiniMK3.isSamplerPad = function(padIndex){
    return padIndex >= 9 && padIndex <= 43 && !this.isControlPad(padIndex);
}

NovationLMiniMK3.isSeqPad = function(padIndex){
    return padIndex >= 5*9 && padIndex <= (8*9)+8 && !this.isControlPad(padIndex);
}

NovationLMiniMK3.isDeckSyncPad = function(padIndex){
    return padIndex >= 0 && padIndex <= 3;
}

NovationLMiniMK3.padIndexToSamplerIndex = function(padIndex){
    let samplerIndex = padIndex - 9;
    samplerIndex = samplerIndex -  Math.floor(samplerIndex / 9);
    return samplerIndex + 1 + (NovationLMiniMK3.bankIndex * 32);
}

NovationLMiniMK3.padIndexToSeqPos = function(padIndex){
    let samplerIndex = padIndex - (9 * 5);
    samplerIndex = samplerIndex -  Math.floor(samplerIndex / 9);
    return samplerIndex;
}

NovationLMiniMK3.setDeckSyncIndex = function(deckIndex){
    if(this.deckSyncIndex != deckIndex){
        let prevDeckSyncIndex = this.deckSyncIndex;
        this.deckSyncIndex = deckIndex;

        if(this.beatDistanceConnection != null)
            this.beatDistanceConnection.disconnect();

        this.beatDistanceConnection = engine.makeConnection(`[Channel${deckIndex + 1}]`, "beat_distance", NovationLMiniMK3.beatDistanceChanged);

        if(prevDeckSyncIndex >= 0)
        {
            NovationLMiniMK3.setPadColor(this.PROG_MIDI_LAYOUT[prevDeckSyncIndex], NovationLMiniMK3.colorCodes.gray);
        }

        {
            NovationLMiniMK3.setPadColor(this.PROG_MIDI_LAYOUT[this.deckSyncIndex], NovationLMiniMK3.colorCodes.beige);
        }
    }
}

NovationLMiniMK3.playPress = function(){
    this.isPlaying = !this.isPlaying;
    NovationLMiniMK3.setPadColor(this.padButtons.play, this.isPlaying ? this.colorCodes.green : this.colorCodes.darkGreen);
    if(this.isPlaying)
    {
        let beatDistance = engine.getValue(`[Channel${this.deckSyncIndex + 1}]`,"beat_distance");
        let play = (Math.floor(beatDistance*4)) % 4 != 3;
        NovationLMiniMK3.setSeqPos(0, play, play);
    }
    else
    {
        this.lightOffPlayingSamplers();
        this.updateSeqPadColor(this.seqPos);
        NovationLMiniMK3.samplesToIgnoreForNextstep = [];
    }
}

NovationLMiniMK3.recordPress = function(){
    this.isRecording = !this.isRecording;
    NovationLMiniMK3.setPadColor(this.padButtons.record, this.isRecording ? this.colorCodes.red : this.colorCodes.darkRed);
}

NovationLMiniMK3.bankIndexToButtonControl = function(bankIndex){
    switch(bankIndex){
        default:
        case 0: return NovationLMiniMK3.padButtons.bank1;
        case 1: return NovationLMiniMK3.padButtons.bank2;
    }
}

NovationLMiniMK3.setSamplerBank = function(bankIndex){
    if(NovationLMiniMK3.bankIndex != bankIndex)
    {
        let oldButtonControl = NovationLMiniMK3.bankIndexToButtonControl(NovationLMiniMK3.bankIndex);
        let newButtonControl = NovationLMiniMK3.bankIndexToButtonControl(bankIndex);
        NovationLMiniMK3.lightOffPlayingSamplers();
        NovationLMiniMK3.bankIndex = bankIndex;
        NovationLMiniMK3.setPadColor(oldButtonControl, NovationLMiniMK3.colorCodes.gray);
        NovationLMiniMK3.setPadColor(newButtonControl, NovationLMiniMK3.colorCodes.green);
        
        if(this.editPos >= 0)
        {
            NovationLMiniMK3.playLightsForSeqPos(this.editPos);
        }
        else if(NovationLMiniMK3.isPlaying)
        {
            NovationLMiniMK3.playLightsForSeqPos(NovationLMiniMK3.seqPos);
        }
    }
}

NovationLMiniMK3.padPress = function(_channel, control, value, _status, group) {
    console.log(`padPress group: ${group}`);
    let padIndex = parseInt(group);
    if(this.isSamplerPad(padIndex)){
        let samplerIndex = this.padIndexToSamplerIndex(padIndex);
        console.log(`samplerIndex: ${samplerIndex}`);
        if(value > 0) {
            if(this.editPos >= 0)
            {
                let recArr = NovationLMiniMK3.recording[this.editPos];
                if(recArr.includes(samplerIndex))
                {
                    recArr.splice(recArr.indexOf(samplerIndex), 1);
                    NovationLMiniMK3.setPadColor(control, NovationLMiniMK3.colorCodes.off);
                    if(recArr.length == 0)
                    {
                        NovationLMiniMK3.updateSeqPadColor(this.editPos);
                    }
                }
                else
                {
                    recArr.push(samplerIndex);
                    NovationLMiniMK3.setPadColor(control, NovationLMiniMK3.colorCodes.blue);
                    this.currentPlayingSamples.push(samplerIndex);
                    if(recArr.length == 1)
                    {
                        NovationLMiniMK3.updateSeqPadColor(this.editPos);
                    }
                }
            }
            else
            {
                engine.setParameter(`[Sampler${samplerIndex}]`,"cue_gotoandplay", 1);
                NovationLMiniMK3.setPadColor(control, this.colorCodes.blue);

                if(this.isRecording && this.isPlaying)
                {
                    let recordPos = this.seqPos;
                    if(this.isPlaying)
                    {
                        let beatDistance = engine.getValue(`[Channel${this.deckSyncIndex + 1}]`,"beat_distance");
                        if(beatDistance % (1.0/4.0) > (1.0/8.0))
                        {
                            recordPos += 1;
                            if(recordPos >= this.seqLen)
                                recordPos = 0;

                            NovationLMiniMK3.samplesToIgnoreForNextstep.push(samplerIndex);
                        }
                    }


                    let seqArr = this.recording[recordPos];
                    let alreadyRecorded = false;
                    for(let i = 0; i < seqArr.length; i++)
                    {
                        if(seqArr[i] == samplerIndex)
                        {
                            alreadyRecorded = true;
                            break;
                        }
                    }

                    if(!alreadyRecorded)
                    {
                        seqArr.push(samplerIndex);
                    }
                }
            }
        }
        else{
            if(this.editPos == -1)
            {
                NovationLMiniMK3.setPadColor(control, this.colorCodes.off);
            }
        }
    }
    else if(this.isDeckSyncPad(padIndex)){
        if(value > 0){
            let deckIndex = padIndex;
            this.setDeckSyncIndex(deckIndex);
        }
    }
    else if(control == NovationLMiniMK3.padButtons.play)
    {
        if(value > 0){
            this.playPress();
        }
    }
    else if(control == NovationLMiniMK3.padButtons.record)
    {
        if(value > 0){
            this.recordPress();
        }
    }
    else if(control == NovationLMiniMK3.padButtons.clear)
    {
        //Clear recording
        if(value > 0){
            for(let i = 0; i < this.seqLen; i++)
            {
                if(this.recording[i].length > 0)
                {
                    this.recording[i] = [];
                    NovationLMiniMK3.updateSeqPadColor(i);
                }
            }
        }
    }
    else if(control == NovationLMiniMK3.padButtons.edit)
    {
        if(value > 0)
        {
            if(NovationLMiniMK3.editPos >= 0)
            {
                let editedPos = NovationLMiniMK3.editPos;
                NovationLMiniMK3.editPos = -1;
                NovationLMiniMK3.updateSeqPadColor(editedPos);
                NovationLMiniMK3.lightOffPlayingSamplers();
                //NovationLMiniMK3.playLightsForSeqPos(this.seqPos);
                NovationLMiniMK3.setPadColor(NovationLMiniMK3.padButtons.edit, NovationLMiniMK3.colorCodes.purple);
            }
            else
            {
                NovationLMiniMK3.editPos = NovationLMiniMK3.seqPos;
                NovationLMiniMK3.updateSeqPadColor(NovationLMiniMK3.seqPos);
                NovationLMiniMK3.setPadColor(NovationLMiniMK3.padButtons.edit, NovationLMiniMK3.colorCodes.pink);
            }
        }
    }
    else if(this.isSeqPad(padIndex))
    {
        if(value > 0)
        {
            let lastEditPos = this.editPos;
            this.editPos = this.padIndexToSeqPos(padIndex);
            if(lastEditPos == this.editPos)
            {
                NovationLMiniMK3.editPos = -1;
                NovationLMiniMK3.updateSeqPadColor(lastEditPos);
                NovationLMiniMK3.lightOffPlayingSamplers();
                //NovationLMiniMK3.playLightsForSeqPos(this.seqPos);
                NovationLMiniMK3.setPadColor(NovationLMiniMK3.padButtons.edit, NovationLMiniMK3.colorCodes.purple);
            }
            else
            {
                if(lastEditPos >= 0)
                {
                    NovationLMiniMK3.updateSeqPadColor(lastEditPos);
                }
                NovationLMiniMK3.lightOffPlayingSamplers();
                NovationLMiniMK3.updateSeqPadColor(this.editPos);
                NovationLMiniMK3.playLightsForSeqPos(this.editPos);
                NovationLMiniMK3.setPadColor(NovationLMiniMK3.padButtons.edit, NovationLMiniMK3.colorCodes.pink);
            }
        }
    }
    else if(control == NovationLMiniMK3.padButtons.bank1)
    {
        NovationLMiniMK3.setSamplerBank(0);
    }
    else if(control == NovationLMiniMK3.padButtons.bank2)
    {
        NovationLMiniMK3.setSamplerBank(1);
    }
}

NovationLMiniMK3.seqIndexToMidino = function(seqIndex) {
    let row = Math.floor(seqIndex / 8);
    let column = seqIndex % 8;
    return this.PROG_MIDI_LAYOUT[(5 * 9) + column + row * 9];
}

NovationLMiniMK3.samplerIndexToMidino = function(seqIndex) {
    seqIndex = seqIndex - NovationLMiniMK3.bankIndex * 32;
    let row = Math.floor((seqIndex-1) / 8);
    let column = (seqIndex-1) % 8;
    return this.PROG_MIDI_LAYOUT[9 + column + row * 9];
}

NovationLMiniMK3.playRecordedSamplesForSeqPos = function(seqPos)
{
    let seqArr = NovationLMiniMK3.recording[seqPos];
    for(let i = 0; i < seqArr.length; i++)
    {
        let samplerIndex = seqArr[i];

        if (!NovationLMiniMK3.samplesToIgnoreForNextstep.includes(samplerIndex)) {
            engine.setParameter(`[Sampler${samplerIndex}]`, "cue_gotoandplay", 1);
        }
    }
}

NovationLMiniMK3.isSamplerIndexVisible = function(samplerIndex){
    samplerIndex = samplerIndex - NovationLMiniMK3.bankIndex * 32;
    if(samplerIndex < 0)
        return false;
    if(samplerIndex >= 32)
        return false;
    return true;
}

NovationLMiniMK3.playLightsForSeqPos = function(seqPos)
{
    let seqArr = NovationLMiniMK3.recording[seqPos];
    for(let i = 0; i < seqArr.length; i++)
    {
        let samplerIndex = seqArr[i];
        if(NovationLMiniMK3.isSamplerIndexVisible(samplerIndex))
        {
            NovationLMiniMK3.setPadColor(NovationLMiniMK3.samplerIndexToMidino(samplerIndex), this.colorCodes.blue);
            NovationLMiniMK3.currentPlayingSamples.push(samplerIndex);
        }
    }
}


NovationLMiniMK3.lightOffPlayingSamplers = function(){
    console.log(`lightOffPlayingSamplers cnt: ${NovationLMiniMK3.currentPlayingSamples.length}`);
    for(let i = 0; i < NovationLMiniMK3.currentPlayingSamples.length; i++)
    {
        let samplerIndex = NovationLMiniMK3.currentPlayingSamples[i];
        if(NovationLMiniMK3.isSamplerIndexVisible(samplerIndex))
        {
            NovationLMiniMK3.setPadColor(NovationLMiniMK3.samplerIndexToMidino(samplerIndex), this.colorCodes.off);
        }
    }
    NovationLMiniMK3.currentPlayingSamples = [];
}

NovationLMiniMK3.updateSeqPadColor = function(seqPos){
    let control = NovationLMiniMK3.seqIndexToMidino(seqPos);
    if(seqPos == NovationLMiniMK3.editPos)
    {
        NovationLMiniMK3.setPadColor(control, this.colorCodes.pink);
    }
    else if(seqPos == NovationLMiniMK3.seqPos && NovationLMiniMK3.isPlaying)
    {
        NovationLMiniMK3.setPadColor(control, this.colorCodes.red);
    }
    else if(NovationLMiniMK3.recording[seqPos].length > 0)
    {
        NovationLMiniMK3.setPadColor(control, this.colorCodes.white);
    }
    else
    {
        NovationLMiniMK3.setPadColor(control, this.colorCodes.gray);
    }
}

NovationLMiniMK3.setSeqPos = function(newSeqPos, playSamplers = true, playLights = true){
    let lastSeqPos = NovationLMiniMK3.seqPos;
    NovationLMiniMK3.seqPos = newSeqPos;

    NovationLMiniMK3.updateSeqPadColor(lastSeqPos);
    NovationLMiniMK3.updateSeqPadColor(NovationLMiniMK3.seqPos);
    
    if(playSamplers)
        NovationLMiniMK3.playRecordedSamplesForSeqPos(NovationLMiniMK3.seqPos);

    if(playLights)
    {
        NovationLMiniMK3.lightOffPlayingSamplers();
        NovationLMiniMK3.playLightsForSeqPos(NovationLMiniMK3.seqPos);
    }
}


NovationLMiniMK3.beatDistanceChanged = function(value, group, control){
    if(!NovationLMiniMK3.isPlaying)
        return;
    let lastQSeqPos = NovationLMiniMK3.seqPos % 4;
    let qSeqPos = Math.floor(value * 4);
    //console.log(`qSeqPos: ${qSeqPos}`);
    if(lastQSeqPos != qSeqPos)
    {
        let newSeqPos = NovationLMiniMK3.seqPos;
        if(lastQSeqPos == 3 && qSeqPos == 0){
            //Forward beat
            newSeqPos += 1;
        }
        else if(lastQSeqPos == 0 && qSeqPos == 3){
            //Backward beat
            newSeqPos -= 1;
        }
        else
        {
            //Inner beat
            newSeqPos += qSeqPos - lastQSeqPos;
        }

        if(newSeqPos < 0)
            newSeqPos = NovationLMiniMK3.seqLen - 1;
        if(newSeqPos >= NovationLMiniMK3.seqLen)
            newSeqPos = 0;

        NovationLMiniMK3.setSeqPos(newSeqPos, true, NovationLMiniMK3.editPos == -1);
        NovationLMiniMK3.samplesToIgnoreForNextstep = [];
    }
}