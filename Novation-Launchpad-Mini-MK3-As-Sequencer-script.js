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

NovationLMiniMK3.deckSyncIndex = -1;
NovationLMiniMK3.isPlaying = false;
NovationLMiniMK3.isRecording = false;
NovationLMiniMK3.seqLen = 8 * 4;
NovationLMiniMK3.seqPos = 0;
NovationLMiniMK3.editPos = -1;
NovationLMiniMK3.beatDistanceConnection = null;
NovationLMiniMK3.lastBeatDistance = 0;

NovationLMiniMK3.recording = [];
NovationLMiniMK3.samplesToIgnoreForNextstep = [];
NovationLMiniMK3.currentPlayingSamples = [];


NovationLMiniMK3.init = function (id, debugging) {
    midi.sendSysexMsg(this.MODE_PROG, this.MODE_PROG.length);

    //Initalize recording array
    for(let i = 0; i < this.seqLen;i++){
        this.recording.push([]);
    }

    let message = null;

    //Make seqencer pads white
    for(let i=0; i< this.seqLen;i++)
    {
        message = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x03, 0x00, NovationLMiniMK3.seqIndexToMidino(i), 0x01, 0xF7];
        midi.sendSysexMsg(message, message.length);
    }

    //Mark the current sequence position
    message = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x03, 0x00, NovationLMiniMK3.seqIndexToMidino(this.seqPos), 0x05, 0xF7];
    midi.sendSysexMsg(message, message.length);

    //Play pad
    message = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x03, 0x00, 0x59, 0x7B, 0xF7];
    midi.sendSysexMsg(message, message.length);

    //Recording pad
    message = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x03, 0x00, 0x4F, 0x07, 0xF7];
    midi.sendSysexMsg(message, message.length);

    //Clear pad
    message = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x03, 0x00, 0x45, 0x3C, 0xF7];
    midi.sendSysexMsg(message, message.length);

    this.setDeckSyncIndex(0);
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
    return samplerIndex + 1;
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
            let message = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x03, 0x00,this.PROG_MIDI_LAYOUT[prevDeckSyncIndex], 0x00, 0xF7];
            midi.sendSysexMsg(message, message.length);
        }

        {
            let message = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x03, 0x00,this.PROG_MIDI_LAYOUT[this.deckSyncIndex], 0x6C, 0xF7];
            midi.sendSysexMsg(message, message.length);
        }
    }
}

NovationLMiniMK3.playPress = function(){
    this.isPlaying = !this.isPlaying;
    let message = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x03, 0x00,0x59,this.isPlaying ? 0x15 : 0x7B, 0xF7];
    midi.sendSysexMsg(message, message.length);
    if(this.isPlaying)
        this.setSeqPos(0,false,false);
}

NovationLMiniMK3.recordPress = function(){
    this.isRecording = !this.isRecording;
    let message = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x03, 0x00,0x4F,this.isRecording ? 0x05 : 0x07, 0xF7];
    midi.sendSysexMsg(message, message.length);
}

NovationLMiniMK3.padPress = function(_channel, control, value, _status, group) {
    console.log(`padPress group: ${group}`);
    let padIndex = parseInt(group);
    if(this.isSamplerPad(padIndex)){
        let samplerIndex = this.padIndexToSamplerIndex(padIndex);
        console.log(`samplerIndex: ${samplerIndex}`);
        if(value > 0) {
            engine.setParameter(`[Sampler${samplerIndex}]`,"cue_gotoandplay", 1);
            let message = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x03, 0x00, control,0x25,0xF7];
            midi.sendSysexMsg(message, message.length);

            if(this.isRecording)
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
        else{
            let message = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x03, 0x00, control,0x00,0xF7];
            midi.sendSysexMsg(message, message.length);
        }
    }
    else if(this.isDeckSyncPad(padIndex)){
        if(value > 0){
            let deckIndex = padIndex;
            this.setDeckSyncIndex(deckIndex);
        }
    }
    else if(control == 0x59)
    {
        if(value > 0){
            this.playPress();
        }
    }
    else if(control == 0x4F)
    {
        if(value > 0){
            this.recordPress();
        }
    }
    else if(control == 0x45)
    {
        //Clear recording
        if(value > 0){
            for(let i = 0; i < this.seqLen; i++)
            {
                this.recording[i] = [];
            }
        }
    }
    else if(this.isSeqPad(padIndex))
    {
        if(value > 0)
        {
            let lastSeqPos = this.seqPos;
            this.seqPos = this.padIndexToSeqPos(padIndex);
            if(this.seqPos != lastSeqPos)
            {
                let message = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x03, 0x00, NovationLMiniMK3.seqIndexToMidino(lastSeqPos), 0x01, 0xF7];
                midi.sendSysexMsg(message, message.length);

                message = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x03, 0x00, NovationLMiniMK3.seqIndexToMidino(NovationLMiniMK3.seqPos), 0x05, 0xF7];
                midi.sendSysexMsg(message, message.length);

                
            }
            NovationLMiniMK3.lightOffPlayingSamplers();
            NovationLMiniMK3.playRecordedSamplesForSeqPos(this.seqPos);
        }
    }
}

NovationLMiniMK3.seqIndexToMidino = function(seqIndex) {
    let row = Math.floor(seqIndex / 8);
    let column = seqIndex % 8;
    return this.PROG_MIDI_LAYOUT[(5 * 9) + column + row * 9];
}

NovationLMiniMK3.samplerIndexToMidino = function(seqIndex) {
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

NovationLMiniMK3.playLightsForSeqPos = function(seqPos)
{
    let seqArr = NovationLMiniMK3.recording[seqPos];
    for(let i = 0; i < seqArr.length; i++)
    {
        let samplerIndex = seqArr[i];
        let message = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x03, 0x00,NovationLMiniMK3.samplerIndexToMidino(samplerIndex) ,0x25,0xF7];
        midi.sendSysexMsg(message, message.length);
        NovationLMiniMK3.currentPlayingSamples.push(samplerIndex);
    }
}


NovationLMiniMK3.lightOffPlayingSamplers = function(){
    console.log(`lightOffPlayingSamplers cnt: ${NovationLMiniMK3.currentPlayingSamples.length}`);
    for(let i = 0; i < NovationLMiniMK3.currentPlayingSamples.length; i++)
    {
        let samplerIndex = NovationLMiniMK3.currentPlayingSamples[i];
        let message = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x03, 0x00,NovationLMiniMK3.samplerIndexToMidino(samplerIndex) ,0x00,0xF7];
        midi.sendSysexMsg(message, message.length);
    }
    NovationLMiniMK3.currentPlayingSamples = [];
}

NovationLMiniMK3.setSeqPos = function(newSeqPos, playSamplers = true, playLights = true){
    let lastSeqPos = NovationLMiniMK3.seqPos;
    NovationLMiniMK3.seqPos = newSeqPos;
    let message = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x03, 0x00, NovationLMiniMK3.seqIndexToMidino(lastSeqPos), 0x01, 0xF7];
    midi.sendSysexMsg(message, message.length);

    message = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x03, 0x00, NovationLMiniMK3.seqIndexToMidino(NovationLMiniMK3.seqPos), 0x05, 0xF7];
    midi.sendSysexMsg(message, message.length);

    

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

        NovationLMiniMK3.setSeqPos(newSeqPos);
        NovationLMiniMK3.samplesToIgnoreForNextstep = [];
    }
}