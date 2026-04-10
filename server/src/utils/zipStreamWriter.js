const { once } = require('events');

const ZIP_SIGNATURES = {
  localFileHeader: 0x04034b50,
  dataDescriptor: 0x08074b50,
  centralDirectoryHeader: 0x02014b50,
  endOfCentralDirectory: 0x06054b50,
};

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }

  return table;
})();

const getDosDateTime = (inputDate = new Date()) => {
  const date = inputDate instanceof Date && !Number.isNaN(inputDate.getTime())
    ? inputDate
    : new Date();

  const year = Math.max(date.getFullYear(), 1980);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;

  return {
    dosTime: dosTime & 0xffff,
    dosDate: dosDate & 0xffff,
  };
};

class Crc32Accumulator {
  constructor() {
    this.value = 0xffffffff;
  }

  update(chunk) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk || '');
    for (let index = 0; index < buffer.length; index += 1) {
      this.value = CRC32_TABLE[(this.value ^ buffer[index]) & 0xff] ^ (this.value >>> 8);
    }
  }

  digest() {
    return (this.value ^ 0xffffffff) >>> 0;
  }
}

class ZipStreamWriter {
  constructor(output) {
    this.output = output;
    this.offset = 0;
    this.entries = [];
    this.finalized = false;
  }

  async write(chunk) {
    if (!chunk || chunk.length === 0) {
      return;
    }

    if (this.output.destroyed || this.output.writableEnded) {
      throw new Error('ZIP response stream is no longer writable.');
    }

    this.offset += chunk.length;
    if (!this.output.write(chunk)) {
      await once(this.output, 'drain');
    }
  }

  createLocalHeader(fileNameBuffer, dosTime, dosDate) {
    const header = Buffer.alloc(30);
    header.writeUInt32LE(ZIP_SIGNATURES.localFileHeader, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0008, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(dosTime, 10);
    header.writeUInt16LE(dosDate, 12);
    header.writeUInt32LE(0, 14);
    header.writeUInt32LE(0, 18);
    header.writeUInt32LE(0, 22);
    header.writeUInt16LE(fileNameBuffer.length, 26);
    header.writeUInt16LE(0, 28);
    return header;
  }

  createDataDescriptor(crcValue, size) {
    const descriptor = Buffer.alloc(16);
    descriptor.writeUInt32LE(ZIP_SIGNATURES.dataDescriptor, 0);
    descriptor.writeUInt32LE(crcValue, 4);
    descriptor.writeUInt32LE(size, 8);
    descriptor.writeUInt32LE(size, 12);
    return descriptor;
  }

  createCentralDirectoryHeader(entry) {
    const fileNameBuffer = Buffer.from(entry.name, 'utf8');
    const header = Buffer.alloc(46);
    header.writeUInt32LE(ZIP_SIGNATURES.centralDirectoryHeader, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x0008, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(entry.dosTime, 12);
    header.writeUInt16LE(entry.dosDate, 14);
    header.writeUInt32LE(entry.crc32, 16);
    header.writeUInt32LE(entry.compressedSize, 20);
    header.writeUInt32LE(entry.uncompressedSize, 24);
    header.writeUInt16LE(fileNameBuffer.length, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt32LE(0, 38);
    header.writeUInt32LE(entry.localHeaderOffset, 42);

    return {
      header,
      fileNameBuffer,
    };
  }

  createEndOfCentralDirectory(entryCount, centralDirectorySize, centralDirectoryOffset) {
    const footer = Buffer.alloc(22);
    footer.writeUInt32LE(ZIP_SIGNATURES.endOfCentralDirectory, 0);
    footer.writeUInt16LE(0, 4);
    footer.writeUInt16LE(0, 6);
    footer.writeUInt16LE(entryCount, 8);
    footer.writeUInt16LE(entryCount, 10);
    footer.writeUInt32LE(centralDirectorySize, 12);
    footer.writeUInt32LE(centralDirectoryOffset, 16);
    footer.writeUInt16LE(0, 20);
    return footer;
  }

  async addBuffer(name, buffer, date = new Date()) {
    const source = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '');
    const { dosTime, dosDate } = getDosDateTime(date);
    const crc = new Crc32Accumulator();
    crc.update(source);

    const fileNameBuffer = Buffer.from(name, 'utf8');
    const localHeaderOffset = this.offset;

    await this.write(this.createLocalHeader(fileNameBuffer, dosTime, dosDate));
    await this.write(fileNameBuffer);
    await this.write(source);

    const descriptor = this.createDataDescriptor(crc.digest(), source.length);
    await this.write(descriptor);

    this.entries.push({
      name,
      dosTime,
      dosDate,
      crc32: crc.digest(),
      compressedSize: source.length,
      uncompressedSize: source.length,
      localHeaderOffset,
    });
  }

  async addStream(name, readable, date = new Date()) {
    const { dosTime, dosDate } = getDosDateTime(date);
    const fileNameBuffer = Buffer.from(name, 'utf8');
    const localHeaderOffset = this.offset;
    const crc = new Crc32Accumulator();
    let size = 0;

    await this.write(this.createLocalHeader(fileNameBuffer, dosTime, dosDate));
    await this.write(fileNameBuffer);

    try {
      for await (const chunk of readable) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        crc.update(buffer);
        size += buffer.length;
        await this.write(buffer);
      }
    } catch (error) {
      if (readable && typeof readable.destroy === 'function') {
        readable.destroy(error);
      }
      throw error;
    }

    const crcValue = crc.digest();
    await this.write(this.createDataDescriptor(crcValue, size));

    this.entries.push({
      name,
      dosTime,
      dosDate,
      crc32: crcValue,
      compressedSize: size,
      uncompressedSize: size,
      localHeaderOffset,
    });
  }

  async finalize() {
    if (this.finalized) {
      return;
    }

    const centralDirectoryOffset = this.offset;

    for (const entry of this.entries) {
      const { header, fileNameBuffer } = this.createCentralDirectoryHeader(entry);
      await this.write(header);
      await this.write(fileNameBuffer);
    }

    const centralDirectorySize = this.offset - centralDirectoryOffset;
    await this.write(
      this.createEndOfCentralDirectory(
        this.entries.length,
        centralDirectorySize,
        centralDirectoryOffset
      )
    );

    this.finalized = true;
  }
}

module.exports = {
  ZipStreamWriter,
};
