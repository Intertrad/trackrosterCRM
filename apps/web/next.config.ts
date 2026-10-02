import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // The beta browser runs on 127.0.0.1 while the dev server binds to the
  // local loopback interface. Allow its HMR/font requests so authenticated
  // acceptance checks hydrate the app instead of remaining on the shell.
  allowedDevOrigins: ['127.0.0.1'],

  /*
   * A second dev server needs its own build directory.
   *
   * The beta environment runs this same app against the beta API
   * (scripts/beta.mjs web), so two `next dev` processes exist at once. Sharing
   * `.next` is not viable: Next holds a dev lock in `.next/dev/lock` and the
   * second process refuses to start, and were it to start the two would
   * overwrite each other's build cache and manifests. Pointing beta at
   * `.next-beta` keeps the ordinary development server's directory untouched.
   *
   * Unset, this is exactly Next's default.
   */
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default nextConfig;
