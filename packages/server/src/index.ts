import { buildApp } from './app';
import { loadConfig } from './config';

export { buildApp, type StumpCastApp } from './app';
export { loadConfig, type ServerConfig } from './config';

const main = async () => {
  const config = loadConfig();
  const app = await buildApp(config);
  const port = await app.start();
  console.log(`StumpCast server listening on http://${config.host}:${port}`);

  const shutdown = async () => {
    await app.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

// Run only when executed directly (not when imported by tests or the desktop shell).
if (
  import.meta.url === new URL(process.argv[1] ?? '', 'file://').href ||
  process.env.STUMPCAST_RUN
) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
