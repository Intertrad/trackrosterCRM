import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { parseImportFile } from './import-file.js';
describe('Import upload boundaries', () => {
  it('bounds actual ZIP inflation even when central-directory sizes lie', async () => {
    const compressed = deflateRawSync(Buffer.alloc(21 * 1024 * 1024, 65));
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(8, 8);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(1, 24);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50);
    end.writeUInt16LE(1, 10);
    end.writeUInt32LE(46, 12);
    end.writeUInt32LE(local.length + compressed.length, 16);
    await expect(
      parseImportFile('oversized.xlsx', Buffer.concat([local, compressed, central, end])),
    ).rejects.toThrow('oversized compressed XLSX');
  });
  it('does not accept empty, oversized or malformed CSV uploads', async () => {
    await expect(parseImportFile('empty.csv', Buffer.from('name,country_code'))).rejects.toThrow(
      'data rows',
    );
    await expect(
      parseImportFile('oversized.csv', Buffer.alloc(5 * 1024 * 1024 + 1)),
    ).rejects.toThrow('5 MiB');
    await expect(
      parseImportFile('invalid.csv', Buffer.from('name,country_code\n"unclosed,FR')),
    ).rejects.toThrow('Invalid CSV');
  });
});
