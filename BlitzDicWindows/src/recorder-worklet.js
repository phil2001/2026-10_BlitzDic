class CaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {super();this.separate=options?.processorOptions?.separate===true;}
  process(inputs) {
    if(this.separate){
      const length=inputs[0]?.[0]?.length||inputs[1]?.[0]?.length||128;
      const stereo=new Float32Array(length*2);
      for(let track=0;track<2;track++){
        const channels=inputs[track]||[];
        for(const channel of channels)for(let i=0;i<length;i++)stereo[i*2+track]+=(channel[i]||0)/channels.length;
      }
      this.port.postMessage(stereo,[stereo.buffer]);return true;
    }
    const channels = inputs[0];
    if (channels?.length) {
      const mono = new Float32Array(channels[0].length);
      for (const channel of channels) for (let i = 0; i < mono.length; i++) mono[i] += channel[i] / channels.length;
      this.port.postMessage(mono, [mono.buffer]);
    }
    return true;
  }
}
registerProcessor('blitzdic-capture', CaptureProcessor);
