const ZIP_SIGNATURES = {
  localFileHeader: 0x04034b50,
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

const crc32 = (buffer) => {
  const source = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '');
  let value = 0xffffffff;

  for (let index = 0; index < source.length; index += 1) {
    value = CRC32_TABLE[(value ^ source[index]) & 0xff] ^ (value >>> 8);
  }

  return (value ^ 0xffffffff) >>> 0;
};

const createLocalFileHeader = ({ fileNameBuffer, crcValue, size, dosTime, dosDate }) => {
  const header = Buffer.alloc(30);

  header.writeUInt32LE(ZIP_SIGNATURES.localFileHeader, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(dosTime, 10);
  header.writeUInt16LE(dosDate, 12);
  header.writeUInt32LE(crcValue, 14);
  header.writeUInt32LE(size, 18);
  header.writeUInt32LE(size, 22);
  header.writeUInt16LE(fileNameBuffer.length, 26);
  header.writeUInt16LE(0, 28);

  return header;
};

const createCentralDirectoryHeader = ({
  fileNameBuffer,
  crcValue,
  size,
  dosTime,
  dosDate,
  localHeaderOffset,
}) => {
  const header = Buffer.alloc(46);

  header.writeUInt32LE(ZIP_SIGNATURES.centralDirectoryHeader, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(dosTime, 12);
  header.writeUInt16LE(dosDate, 14);
  header.writeUInt32LE(crcValue, 16);
  header.writeUInt32LE(size, 20);
  header.writeUInt32LE(size, 24);
  header.writeUInt16LE(fileNameBuffer.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(localHeaderOffset, 42);

  return header;
};

const createEndOfCentralDirectory = ({ entryCount, centralDirectorySize, centralDirectoryOffset }) => {
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
};

const buildStoredZip = (entries = []) => {
  const localFileParts = [];
  const centralDirectoryParts = [];
  let runningOffset = 0;

  entries.forEach((entry) => {
    const fileName = String(entry?.name || '').replace(/\\/g, '/');
    const fileNameBuffer = Buffer.from(fileName, 'utf8');
    const fileBuffer = Buffer.isBuffer(entry?.data) ? entry.data : Buffer.from(entry?.data || '');
    const { dosTime, dosDate } = getDosDateTime(entry?.date);
    const crcValue = crc32(fileBuffer);

    const localHeader = createLocalFileHeader({
      fileNameBuffer,
      crcValue,
      size: fileBuffer.length,
      dosTime,
      dosDate,
    });

    localFileParts.push(localHeader, fileNameBuffer, fileBuffer);

    const centralHeader = createCentralDirectoryHeader({
      fileNameBuffer,
      crcValue,
      size: fileBuffer.length,
      dosTime,
      dosDate,
      localHeaderOffset: runningOffset,
    });

    centralDirectoryParts.push(centralHeader, fileNameBuffer);

    runningOffset += localHeader.length + fileNameBuffer.length + fileBuffer.length;
  });

  const centralDirectoryOffset = runningOffset;
  const centralDirectoryBuffer = Buffer.concat(centralDirectoryParts);
  const endOfCentralDirectory = createEndOfCentralDirectory({
    entryCount: entries.length,
    centralDirectorySize: centralDirectoryBuffer.length,
    centralDirectoryOffset,
  });

  return Buffer.concat([
    ...localFileParts,
    centralDirectoryBuffer,
    endOfCentralDirectory,
  ]);
};

module.exports = {
  buildStoredZip,
};
