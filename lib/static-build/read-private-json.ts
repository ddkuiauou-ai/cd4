import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';

export function readPrivateJsonText(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return gunzipSync(fs.readFileSync(file + '.gz')).toString('utf8');
  }
}
