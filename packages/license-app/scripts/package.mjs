import { build } from 'electron-builder';

await build({
  config: {
    appId: 'app.stumpcast.license',
    productName: 'StumpCast License Generator',
    copyright: 'StumpCast',
    directories: {
      output: '../../release/license-generator',
      buildResources: 'build',
    },
    files: ['dist/**/*', 'package.json'],
    asar: false,
    npmRebuild: false,
    win: {
      target: [{ target: 'nsis', arch: ['x64'] }],
      artifactName: 'StumpCast-License-Generator-Setup-${version}.${ext}',
    },
    nsis: {
      oneClick: false,
      perMachine: false,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      shortcutName: 'StumpCast License Generator',
    },
  },
});
