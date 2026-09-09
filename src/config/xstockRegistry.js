/**
 * xStock quote registry — Backed Finance tokenized stocks on Solana.
 * These are Token-2022 mints (decimals 8) usable as the QUOTE side of a pool.
 *
 * All 102 entries verified on-chain 2026-09-08. Verification is by ISSUER, not by name:
 * every entry's freeze authority is Backed's JDq14BWvqCRFNu1krb12bcRpbGtJZ1FLEakMw6FdxJNs.
 * A name check alone is not enough — the Jupiter sweep that seeded this list also
 * returned pump.fun mints calling themselves "Tesla xStock" and "Gold xStock".
 * Decimals are read from the mint account, never assumed; they drive amount math.
 *
 * To be usable as a DBC quote mint a stock also needs an operator-issued
 * token badge, which is a separate on-chain account and not something this
 * list can tell you about. Ask src/services/tokenBadgeService.js.
 */
const XSTOCKS = {
  AAOIx: { mint: 'XsGHwSbPaUJu6r5dtJLHXkXenPgCQf4Sx2hb4e2sbCZ', decimals: 8, name: 'Applied Optoelectronics xStock' },
  AAPLx: { mint: 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp', decimals: 8, name: 'Apple xStock' },
  ABBVx: { mint: 'XswbinNKyPmzTa5CskMbCPvMW6G5CMnZXZEeQSSQoie', decimals: 8, name: 'AbbVie xStock' },
  AITx: { mint: 'XsvJzDTuRrc3cWVwPXVcaXaFJFVtGcpDsfCA56z868Q', decimals: 8, name: 'Applied Industrial Technologies xStock' },
  AMATx: { mint: 'XsQZdaWUAGC4R3fgD2N1fupKvJfJq6YM51ccnsLUWFA', decimals: 8, name: 'Applied Materials, Inc. xStock' },
  AMDx: { mint: 'XsXcJ6GZ9kVnjqGsjBnktRcuwMBmvKWh8S93RefZ1rF', decimals: 8, name: 'AMD xStock' },
  AMZNx: { mint: 'Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg', decimals: 8, name: 'Amazon xStock' },
  APLDx: { mint: 'Xs2ZEuDVSQkNnXHqfqEYKVShLHpecyKfdfpEYwiHtQE', decimals: 8, name: 'Applied Digital Corporation xStock' },
  ATOx: { mint: 'Xsz1UqWKSjB4X7zcvXV6XVL5eBA2YaRqEjXZVP6GXwZ', decimals: 8, name: 'Atmos Energy xStock' },
  AVGOx: { mint: 'XsgSaSvNSqLTtFuyWPBhK9196Xb9Bbdyjj4fH3cPJGo', decimals: 8, name: 'Broadcom xStock' },
  BEx: { mint: 'XsmGSEqT6VXpVis3aVBDxaNwPgHNXbkjkVUCncsLkNB', decimals: 8, name: 'Bloom Energy xStock' },
  'BRK.Bx': { mint: 'Xs6B6zawENwAbWVi7w92rjazLuAr5Az59qgWKcNb45x', decimals: 8, name: 'Berkshire Hathaway xStock' },
  CCONBx: { mint: 'XsvPonyU9dZWsZsT2rJ1MBRAmPw8gMtS7M3ERko8XkK', decimals: 8, name: 'China Construction Bank xStock' },
  CMCSAx: { mint: 'XsvKCaNsxg2GN8jjUmq71qukMJr7Q1c5R2Mk9P8kcS8', decimals: 8, name: 'Comcast xStock' },
  CNPx: { mint: 'Xsx9i1A6e4xc9r5Gxxy4uZV4YSmwAXBJScvGLRv4nH2', decimals: 8, name: 'CenterPoint Energy xStock' },
  COINx: { mint: 'Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu', decimals: 8, name: 'Coinbase xStock' },
  CRCLx: { mint: 'XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1', decimals: 8, name: 'Circle xStock' },
  CSCOx: { mint: 'Xsr3pdLQyXvDJBFgpR5nexCEZwXvigb8wbPYp4YoNFf', decimals: 8, name: 'Cisco xStock' },
  CSHEEx: { mint: 'XspgPmoq1m39tGMLmourzxXgGmSLbjfxiytABBwGA2u', decimals: 8, name: 'China Shenhua Energy xStock' },
  CSPCx: { mint: 'Xs5hnQoLHnA2xeHaaxYGkCV2Kp12SwCEeCKBK7BW3gr', decimals: 8, name: 'CSPC Pharmaceutical xStock' },
  CVXx: { mint: 'XsNNMt7WTNA2sV3jrb1NNfNgapxRF5i4i6GcnTRRHts', decimals: 8, name: 'Chevron xStock' },
  DTEx: { mint: 'XsVK4gk4X1ANBSKF9DGjy9WseKhBfMUuEmP8v7J8u2G', decimals: 8, name: 'DTE Energy xStock' },
  DUKx: { mint: 'XswU7kXY6dGgMqpiWW2jKSYVZMsCWv5LKcLaFBgYzPv', decimals: 8, name: 'Duke Energy xStock' },
  DVNx: { mint: 'Xs8WNVWbYNsHsqEu9WTb9AazMfG7wFxFat11V6mVK1x', decimals: 8, name: 'Devon Energy xStock' },
  Dx: { mint: 'XsiYzgRPqPjAaJjpDMo2CaQ7c9khuCwD7Hj1po2dxSj', decimals: 8, name: 'Dominion Energy xStock' },
  ENNHLx: { mint: 'XsfTYmMC73C6xJsc5k92ZWBdQtEtmnRsVtkN9s5RPQZ', decimals: 8, name: 'ENN Energy xStock' },
  ESx: { mint: 'XsgPX8MYf23yPRv9DrT5ofHn4mThBZgkhboLHz5uSx7', decimals: 8, name: 'Eversource Energy xStock' },
  EXEx: { mint: 'XsodbeGRpfyAzq1MMqZu7u1vCYNKNDuYrCtofaT1PJK', decimals: 8, name: 'Expand Energy xStock' },
  FANGx: { mint: 'XsdLjeamzdsWW5aBhsGVAaQFcZtCL6yF9nhtWfszGT3', decimals: 8, name: 'Diamondback Energy xStock' },
  FGDLx: { mint: 'XspurdrAqbRJMQfAUEfh88QxE3XbSWxQGu3GneJR6e3', decimals: 8, name: 'Franklin Responsibly Sourced Gold ETF xStock' },
  GLDx: { mint: 'Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re', decimals: 8, name: 'Gold xStock' },
  GMEx: { mint: 'Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc', decimals: 8, name: 'Gamestop xStock' },
  GOOGLx: { mint: 'XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN', decimals: 8, name: 'Alphabet xStock' },
  GSx: { mint: 'XsgaUyp4jd1fNBCxgtTKkW64xnnhQcvgaxzsbAq5ZD1', decimals: 8, name: 'Goldman Sachs xStock' },
  HONx: { mint: 'XsRbLZthfABAPAfumWNEJhPyiKDW6TvDVeAeW7oKqA2', decimals: 8, name: 'Honeywell xStock' },
  HOODx: { mint: 'XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg', decimals: 8, name: 'Robinhood xStock' },
  IJRx: { mint: 'XsyZcb97BzETAqi9BoP2C9D196MiMNBisGMVNje2Thz', decimals: 8, name: 'S&P Small Cap xStock' },
  INTCx: { mint: 'XshPgPdXFRWB8tP1j82rebb2Q9rPgGX37RuqzohmArM', decimals: 8, name: 'Intel xStock' },
  INTWx: { mint: 'Xs7zs57saNfGWUn3h5d2rFxxs43uVqzAY7iQVPHFbwE', decimals: 8, name: 'INTC 2x Long ETF xStock' },
  IRx: { mint: 'XsWx5RzivC8d5XwnLiMcgQqqhXiDnrTDwFCDap1o6NW', decimals: 8, name: 'Ingersoll Rand xStock' },
  ITAx: { mint: 'XsXoAR52Q2NYFkYiNqhCq4FauvyA1tdRsrmEYNf9fuh', decimals: 8, name: 'iShares U.S. Aerospace & Defense ETF xStock' },
  JNJx: { mint: 'XsGVi5eo1Dh2zUpic4qACcjuWGjNv8GCt3dm5XcX6Dn', decimals: 8, name: 'Johnson & Johnson xStock' },
  KORUx: { mint: 'Xs2LakxmT2YycpcxRDCJ7crPbFf91JKdAAWnfzANFmt', decimals: 8, name: 'Korea 3x Long ETF xStock' },
  KOx: { mint: 'XsaBXg8dU5cPM6ehmVctMkVqoiRG2ZjMo1cyBJ3AykQ', decimals: 8, name: 'Coca-Cola xStock' },
  KUNLx: { mint: 'XsxnZRxni2PYV3KTmfqJmZHFK1z55DV4pigWDuMZH8i', decimals: 8, name: 'Kunlun Energy xStock' },
  LAOPGx: { mint: 'XscTQ6FeMPkhTuhFsrCZRn4fBmGsvqnFmPKfbC9B24g', decimals: 8, name: 'Laopu Gold xStock' },
  LNGx: { mint: 'XsYLZdcMYST418xZhTV6KaHqr8BWqaKS3J45ywqigF9', decimals: 8, name: 'Cheniere Energy xStock' },
  LSCCx: { mint: 'XsjaZAWtPNA1ZWqbPZxaDWtx1h9L23ucmRquwuSHQuf', decimals: 8, name: 'Lattice Semiconductor xStock' },
  MAx: { mint: 'XsApJFV9MAktqnAc6jqzsHVujxkGm9xcSUffaBoYLKC', decimals: 8, name: 'Mastercard xStock' },
  MCDx: { mint: 'XsqE9cRRpzxcGKDXj1BJ7Xmg4GRhZoyY1KpmGSxAWT2', decimals: 8, name: 'McDonald\'s xStock' },
  MEITx: { mint: 'XsLvCfSnXJjoVaAJENHxKRzCZaWJpyVQQfJgkHp9oXM', decimals: 8, name: 'Meituan xStock' },
  METAx: { mint: 'Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu', decimals: 8, name: 'Meta xStock' },
  METx: { mint: 'XsGhGG2TNXuJLFL5q7pAomKtMVc2YvVqs4G1hyBZLfw', decimals: 8, name: 'MetLife xStock' },
  MOOx: { mint: 'Xs72K1Ta1D5ccNy3RzSyQWGgZywWvphX78pL8WBk1Bo', decimals: 8, name: 'VanEck Agribusiness ETF xStock' },
  MRKx: { mint: 'XsnQnU7AdbRZYe2akqqpibDdXjkieGFfSkbkjX1Sd1X', decimals: 8, name: 'Merck xStock' },
  MRVLx: { mint: 'XsuxRGDzbLjnJ72v74b7p9VY6N66uYgTCyfwwRjVCJA', decimals: 8, name: 'Marvell xStock' },
  MSFTx: { mint: 'XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX', decimals: 8, name: 'Microsoft xStock' },
  MSTRx: { mint: 'XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ', decimals: 8, name: 'MicroStrategy xStock' },
  MTBx: { mint: 'XsMXtu6uQkfvxCYURytUcQvhFCoqvphtoezVBh42CfZ', decimals: 8, name: 'M&T Bank xStock' },
  MUUx: { mint: 'XsjZG9MgLMECjzSSxq3G7rabDceoaDqhN4C4zwce4i8', decimals: 8, name: 'Micron 2x Long ETF xStock' },
  MVLLx: { mint: 'XsVEdRV17tPdXHamAi6TVFjyeSRHnCjdY5GXqAaevuk', decimals: 8, name: 'Marvell 2x Long ETF xStock' },
  NFLXx: { mint: 'XsEH7wWfJJu2ZT3UCFeVfALnVA6CP5ur7Ee11KmzVpL', decimals: 8, name: 'Netflix xStock' },
  NRGx: { mint: 'XsZ9qtReiaokaUfW3bEUx2AU4Zmcjk9Y95nEtFMqEXn', decimals: 8, name: 'NRG Energy xStock' },
  NVDAx: { mint: 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh', decimals: 8, name: 'NVIDIA xStock' },
  NVOx: { mint: 'XsfAzPzYrYjd4Dpa9BU3cusBsvWfVB9gBcyGC87S57n', decimals: 8, name: 'Novo Nordisk xStock' },
  ONx: { mint: 'XsTzZxvfNdVESw8oEn7cNPnfQ4SGk7ncBSezfU6dxa7', decimals: 8, name: 'ON Semiconductor xStock' },
  ORCLx: { mint: 'XsjFwUPiLofddX5cWFHW35GCbXcSu1BCUGfxoQAQjeL', decimals: 8, name: 'Oracle xStock' },
  PALLx: { mint: 'XsTTtPA5V19YwHKDv4xeVXNM6kdsQNJvg3MyWkRUckt', decimals: 8, name: 'abrdn Physical Palladium Shares xStock' },
  PEPx: { mint: 'Xsv99frTRUeornyvCfvhnDesQDWuvns1M852Pez91vF', decimals: 8, name: 'PepsiCo xStock' },
  PFEx: { mint: 'XsAtbqkAP1HJxy7hFDeq7ok6yM43DQ9mQ1Rh861X8rw', decimals: 8, name: 'Pfizer xStock' },
  PLTRx: { mint: 'XsoBhf2ufR8fTyNSjqfU71DYGaE6Z3SUGAidpzriAA4', decimals: 8, name: 'Palantir xStock' },
  PPLTx: { mint: 'Xst6eFD4YT6sz9RLMysN9SyvaZWtraSdVJQGu5ZkAme', decimals: 8, name: 'abrdn Physical Platinum Shares xStock' },
  QQQx: { mint: 'Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ', decimals: 8, name: 'Nasdaq xStock' },
  RGLDx: { mint: 'XsgiYbKzzyYzuxRj1R4E6rvfVccASCGepmWEMpJdFG2', decimals: 8, name: 'Royal Gold xStock' },
  SGOVx: { mint: 'XsYD72ntjj7ZwoFDZCDmN2gamTcLpnywqvG7PQN5vCN', decimals: 8, name: 'iShares 0-3 Month Treasury Bond ETF xStock' },
  SLVx: { mint: 'XsxAd6okt8y1RRK6gNg7iJaqiWNiq5Md5EDf3ZrF2dm', decimals: 8, name: 'iShares Silver Trust xStock' },
  SMHx: { mint: 'XstuBvLo7soZzj3beCCPonHpR3eUfPNSeQzw35Swons', decimals: 8, name: 'VanEck Semiconductor ETF xStock' },
  SNBIOx: { mint: 'XsyeAGJ5CS1uDtDcnFaHTW3QCF5eL2CAt8vcrRBeAs5', decimals: 8, name: 'Sino Biopharmaceutical xStock' },
  SNXXx: { mint: 'Xs3EFHHyP27EsAw3ftS8UFsN8kwkhFvbppji6bbkkPn', decimals: 8, name: 'SNDK 2x Long ETF xStock' },
  SOXSx: { mint: 'XsCucuUESBi3ZjRxmjwUzGYuf6ZrtZDUvK6XhRA4RR3', decimals: 8, name: '3x Short Semiconductor ETF xStock' },
  SOXXx: { mint: 'XsEsHeiNZf88sABxu74TPuXbQThdaQGdzPVZUBicjtQ', decimals: 8, name: 'iShares Semiconductor xStock' },
  SPCXx: { mint: 'Xs3oZwbHvqis4NYcf4YKWmEia2eC84wSiVrcYcTqpH8', decimals: 8, name: 'SpaceX xStock' },
  SPYx: { mint: 'XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W', decimals: 8, name: 'SP500 xStock' },
  STRCx: { mint: 'Xs78JED6PFZxWc2wCEPspZW9kL3Se5J7L5TChKgsidH', decimals: 8, name: 'Strategy PP Variable xStock' },
  TEx: { mint: 'XsEn37JjZxj3m9YayAyCCJFaQKBPZc6aUEiLEus5igu', decimals: 8, name: 'T1 Energy xStock' },
  TLNx: { mint: 'Xs8yLZVjsYmQ5Tu4e5JDVQeo4cbRRDCVERgtSGJFn3q', decimals: 8, name: 'Talen Energy xStock' },
  TSLAx: { mint: 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB', decimals: 8, name: 'Tesla xStock' },
  UBERx: { mint: 'XsAsZLF4MmsvS1sDxRMrUz7REjHfwbC9UAMXSRBqgEB', decimals: 8, name: 'Uber xStock' },
  URAx: { mint: 'Xsq9sEQjYiUTSZ55RrbHAzVfz8HotwFGrqgxkgiv4LB', decimals: 8, name: 'Global X Uranium ETF xStock' },
  VGKx: { mint: 'XsosCAu1L8Ebpr4SdBDV1EboYDRTWCH8j79UnHYzvbN', decimals: 8, name: 'Vanguard FTSE Europe ETF xStock' },
  VIDAx: { mint: 'XsfCC9VL4DamVGNgdJpfLXB3sBVa158Gbx8sh7NzmTk', decimals: 8, name: 'Vida Global xStock' },
  VLOx: { mint: 'XsmMjZH2ex52ecoCqBN1sMADoWQziXpe9j6z6QVmafF', decimals: 8, name: 'Valero Energy xStock' },
  VOOx: { mint: 'Xsd7TduTbjuYCFL7Uoujb8SbkZLmUsuYNLn7KdvX21x', decimals: 8, name: 'Vanguard S&P 500 xStock' },
  VTx: { mint: 'XsEdDDTcVGJU6nvdRdVnj53eKTrsCkvtrVfXGmUK68V', decimals: 8, name: 'Vanguard Total World xStock' },
  VUGx: { mint: 'XsNVBwVGqtDqmA2Waoiux5mfykH8nepLK74z3ZoQWK2', decimals: 8, name: 'Vanguard Growth ETF xStock' },
  VXUSx: { mint: 'XsLT5v4DAd1kwViPQh3SZiT5kzJfNLxzJxJN1dySZTe', decimals: 8, name: 'Vanguard Total International Stock ETF xStock' },
  Vx: { mint: 'XsqgsbXwWogGJsNcVZ3TyVouy2MbTkfCFhCGGGcQZ2p', decimals: 8, name: 'Visa xStock' },
  WECx: { mint: 'Xsxq7WqXpiNFrdWSd6CA27LXmCsCrGyC9C3uaebmaqU', decimals: 8, name: 'WEC Energy xStock' },
  WMTx: { mint: 'Xs151QeqTCiuKtinzfRATnUESM2xTU6V9Wy8Vy538ci', decimals: 8, name: 'Walmart xStock' },
  XELx: { mint: 'Xsr6MgLKmoEmN4aL78MQ2q98R8wJnZ3FaCZUMwkNbNU', decimals: 8, name: 'Xcel Energy xStock' },
  XOMx: { mint: 'XsaHND8sHyfMfsWPj6kSdd5VwvCayZvjYgKmmcNL5qh', decimals: 8, name: 'Exxon Mobil xStock' },
  XOPx: { mint: 'XsAk6BoV4kBXUM6WXodKyM21CN92G9jArwAzFvbh3LX', decimals: 8, name: 'SPDR S&P Oil & Gas Exploration & Production ETF xStock' },
};

const XSTOCK_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'; // Token-2022

// Case-insensitive symbol lookup map (keys may contain dots, e.g. BRK.Bx).
const _byUpper = {};
for (const [k, v] of Object.entries(XSTOCKS)) _byUpper[k.toUpperCase()] = { key: k, ...v };

/** Resolve a quote selector (symbol or mint) → { key, mint, decimals, name, isXStock }. */
function resolveXStock(sel) {
  if (!sel) return null;
  const s = String(sel).trim();
  const up = s.toUpperCase();
  if (_byUpper[up]) return { ..._byUpper[up], isXStock: true, programId: XSTOCK_PROGRAM_ID };
  // match by mint
  for (const [k, v] of Object.entries(XSTOCKS)) {
    if (v.mint === s) return { key: k, ...v, isXStock: true, programId: XSTOCK_PROGRAM_ID };
  }
  return null;
}

/** List for frontend dropdown (sorted by symbol). */
function xstockList() {
  return Object.entries(XSTOCKS)
    .map(([key, v]) => ({ key, mint: v.mint, name: v.name, decimals: v.decimals }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

// ---------------------------------------------------------------------------
// pairs.market helpers — a pair is either SOL or one of these symbols.
// canonical() is the single place that decides what a user-typed symbol means.
// ---------------------------------------------------------------------------

const _canonicalByUpper = new Map(
  Object.keys(XSTOCKS).map((s) => [s.toUpperCase(), s])
);

/** Canonical registry key for a user-supplied symbol, or null. Case-insensitive. */
function canonical(symbol) {
  if (!symbol) return null;
  return _canonicalByUpper.get(String(symbol).trim().toUpperCase()) || null;
}

/** Is this symbol a known xStock? */
function isStock(symbol) {
  return canonical(symbol) !== null;
}

/** Full entry with the canonical symbol folded in, or null. */
function getStock(symbol) {
  const key = canonical(symbol);
  return key ? { symbol: key, ...XSTOCKS[key] } : null;
}

/** Every stock, sorted by symbol, shaped like getStock(). */
function listStocks() {
  return Object.keys(XSTOCKS)
    .sort()
    .map((key) => ({ symbol: key, ...XSTOCKS[key] }));
}

module.exports = {
  XSTOCKS,
  XSTOCK_PROGRAM_ID,
  resolveXStock,
  xstockList,
  canonical,
  isStock,
  getStock,
  listStocks,
};
