import { build } from 'esbuild';
await build({
  entryPoints: ['tests/fixtures/player-controls.jsx'], bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic',
  outfile: 'tests/fixtures/player-controls.generated.js', define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'disposable-media-adapter', setup(builder) {
    builder.onResolve({ filter: /(?:^\.\/adapter$|instagram\/adapter$)/ }, () => ({ path: 'adapter', namespace: 'fixture' }));
    builder.onResolve({ filter: /instagram\/navigation$/ }, () => ({ path: 'navigation', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'navigation'
      ? 'export const navigatePost = url => globalThis.fixtureNavigate(url);'
      : `export const currentPostCode = () => globalThis.fixtureCode;
         export const activeVideo = () => document.getElementById('fixture-video');
         export const setNativeMuted = (video, muted) => globalThis.fixtureSetMuted(video, muted);` }));
  } }],
});
