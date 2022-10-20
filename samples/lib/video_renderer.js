import { VIDEO_STREAM_TYPE } from "./pull_demuxer_base.js";

const FRAME_BUFFER_TARGET_SIZE = 3;
const ENABLE_DEBUG_LOGGING = false;

function debugLog(msg) {
  if (!ENABLE_DEBUG_LOGGING)
    return;
  console.debug(msg);
}

// Controls demuxing and decoding of the video track, as well as rendering
// VideoFrames to canvas. Maintains a buffer of FRAME_BUFFER_TARGET_SIZE
// decoded frames for future rendering.
export class VideoRenderer {
  async initialize(demuxer) {
    this.frameBuffer = [];
    this.fillInProgress = false;

    this.demuxer = demuxer;
    await this.demuxer.initialize(VIDEO_STREAM_TYPE);
    const config = this.demuxer.getDecoderConfig();

    this.decoder = new VideoDecoder({
      output: this.bufferFrame.bind(this),
      error: e => console.error(e),
    });
    console.assert(VideoDecoder.isConfigSupported(config))
    this.decoder.configure(config);

    this.init_resolver = null;
    let promise = new Promise((resolver) => this.init_resolver = resolver );

    this.fillFrameBuffer();
    return promise;
  }

  async fillFrameBuffer() {
    if (this.frameBufferFull()) {
      debugLog('frame buffer full');

      if (this.init_resolver) {
        this.init_resolver();
        this.init_resolver = null;
      }

      return;
    }

    // This method can be called from multiple places and we some may already
    // be awaiting a demuxer read (only one read allowed at a time).
    if (this.fillInProgress) {
      return false;
    }
    this.fillInProgress = true;

    while (this.frameBuffer.length < FRAME_BUFFER_TARGET_SIZE &&
            this.decoder.decodeQueueSize < FRAME_BUFFER_TARGET_SIZE) {
      let chunk = await this.demuxer.getNextChunk();
      this.decoder.decode(chunk);
    }

    this.fillInProgress = false;

    // Give decoder a chance to work, see if we saturated the pipeline.
    setTimeout(this.fillFrameBuffer.bind(this), 0);
  }

  frameBufferFull() {
    return this.frameBuffer.length >= FRAME_BUFFER_TARGET_SIZE;
  }

  bufferFrame(frame) {
    debugLog(`bufferFrame(${frame.timestamp})`);
    this.frameBuffer.push(frame);
  }

  dispose() {
    for (const frame of this.frameBuffer) {
      frame.close();
    }
    this.frameBuffer = [];
    if (this.decoder.state !== 'closed') {
      this.decoder.close();
    }
  }
}
