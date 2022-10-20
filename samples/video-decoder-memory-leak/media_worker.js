// The "media worker" houses and drives the AudioRenderer and VideoRenderer
// classes to perform demuxing and decoder I/O on a background worker thread.
console.info(`Worker started`);

// Ideally we would use the static import { module } from ... syntax for this
// and the modules below. But presently mp4box.js does not use ES6 modules,
// so we import it as an old-style script and use the dynamic import() to load
// our modules below.
importScripts('../third_party/mp4boxjs/mp4box.all.min.js');
let moduleLoadedResolver = null;
let modulesReady = new Promise(resolver => (moduleLoadedResolver = resolver));
let videoRenderer = null;

(async () => {
    import('../lib/video_renderer.js').then((module) => {
      videoRenderer = new module.VideoRenderer();
      moduleLoadedResolver();
      moduleLoadedResolver = null;
      console.info('Worker modules imported');
    });
})();

self.addEventListener('message', async function(e) {
  await modulesReady;

  console.info(`Worker message: ${JSON.stringify(e.data)}`);

  switch (e.data.command) {
    case 'initialize':
      let demuxerModule = await import('./mp4_pull_demuxer.js');
      let videoDemuxer = new demuxerModule.MP4PullDemuxer(e.data.videoFile);
      let videoReady = videoRenderer.initialize(videoDemuxer, e.data.canvas);
      await videoReady;
      postMessage({ command: 'initialize-done' });
      break;
    case 'dispose':
        videoRenderer.dispose();
        self.close();
        console.log('===dispoesd and clsoed=====');
        break;
    default:
      console.error(`Worker bad message: ${JSON.stringify(e.data)}`);
  }

});
